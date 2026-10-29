"""Konuşma tabanlı iteratif dolap revizyon motoru (Conversational Mutation / Diff Engine).

Kullanıcının mevcut dolap parametrelerini kaybetmeden doğal dille
(örn: "genişliği 110 cm yap", "altına 2 çekmece ekle", "kapakları antrasit yap")
tasarımı adım adım değiştirebilmesini sağlar.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from google import genai
from google.genai import types

from app.core.config import get_settings
from app.engines.parser_engine import CabinetParseSchema, SemanticParserEngine
from app.schemas.cabinet import (
    BackPanelType,
    CabinetConfig,
    CabinetType,
    CabinetZone,
    CuttingMode,
    DoorType,
    FastenerType,
    PlinthType,
)
from app.schemas.revision import ChatMessage

logger = logging.getLogger(__name__)


class RevisionEngine:
    """Mevcut dolap üzerinde artımlı (incremental) doğal dil revizyonu uygular."""

    REVISION_SYSTEM_INSTRUCTION = (
        "Sen mobilya fabrikası için uzman bir CAD/CAM Tasarım ve Revizyon Asistanısın. "
        "Kullanıcı mevcut bir dolap tasarımında değişiklik (revizyon) istemektedir. "
        "Girdi olarak sana MEVCUT DOLAP PARAMETRELERİ (JSON) ve KULLANICININ REVİZYON İSTEĞİ verilecektir. "
        "GÖREVİN: "
        "1. Kullanıcının değiştirmek istediği özellikleri (ölçü, çekmece, raf, kapak, açık niş, renk, malzeme vb.) tespit et. "
        "2. Kullanıcının açıkça DEĞİŞTİRMEDİĞİ tüm mevcut parametreleri (iç bölmeler, kertmeler, bağlantı tipleri vb.) AYNEN KORU. "
        "3. Sıfırdan yeni bir dolap üretme; mevcut dolabı mutasyona uğrat. "
        "4. Çıktı olarak güncellenmiş parametreleri CabinetParseSchema formatında JSON olarak üret."
    )

    COLOR_MAP: dict[str, tuple[str, str]] = {
        "beyaz": ("#F4F1EA", "18mm Beyaz Suntalam"),
        "antrasit": ("#374151", "18mm Antrasit MDF-Lam"),
        "siyah": ("#1F2937", "18mm Siyah MDF-Lam"),
        "meşe": ("#C89F70", "18mm Doğal Meşe Suntalam"),
        "mese": ("#C89F70", "18mm Doğal Meşe Suntalam"),
        "ceviz": ("#6E472B", "18mm Koyu Ceviz MDF-Lam"),
        "gri": ("#9CA3AF", "18mm Açık Gri Suntalam"),
        "krem": ("#EFECE6", "18mm Krem MDF-Lam"),
        "çam": ("#D9B382", "18mm Çam Suntalam"),
    }

    @staticmethod
    def _to_mm(val_str: str, unit_str: str | None) -> float:
        val = float(val_str.replace(",", "."))
        unit = (unit_str or "").lower().strip()
        if unit == "m" or (not unit and val < 4.0):
            return round(val * 1000.0, 1)
        if unit == "cm" or (not unit and 20.0 <= val <= 275.0):
            return round(val * 10.0, 1)
        return round(val, 1)

    @classmethod
    def compute_diff(cls, old_cfg: CabinetConfig, new_cfg: CabinetConfig) -> list[str]:
        """İki CabinetConfig arasındaki somut mühendislik farklarını insan okunur liste olarak üretir."""
        diffs: list[str] = []

        if old_cfg.width_mm != new_cfg.width_mm:
            diffs.append(f"Genişlik: {old_cfg.width_mm:.0f} mm ➔ {new_cfg.width_mm:.0f} mm")
        if old_cfg.height_mm != new_cfg.height_mm:
            diffs.append(f"Yükseklik: {old_cfg.height_mm:.0f} mm ➔ {new_cfg.height_mm:.0f} mm")
        if old_cfg.depth_mm != new_cfg.depth_mm:
            diffs.append(f"Derinlik: {old_cfg.depth_mm:.0f} mm ➔ {new_cfg.depth_mm:.0f} mm")

        if old_cfg.door_type != new_cfg.door_type:
            diffs.append(f"Kapak: {old_cfg.door_type.value} ➔ {new_cfg.door_type.value}")
        if old_cfg.shelf_count != new_cfg.shelf_count:
            diffs.append(f"Raf Sayısı: {old_cfg.shelf_count} ➔ {new_cfg.shelf_count}")
        if old_cfg.drawer_count != new_cfg.drawer_count:
            diffs.append(f"Çekmece: {old_cfg.drawer_count} ➔ {new_cfg.drawer_count}")

        old_niche = max(old_cfg.niche_height_mm or 0.0, old_cfg.appliance_niche_height_mm or 0.0)
        new_niche = max(new_cfg.niche_height_mm or 0.0, new_cfg.appliance_niche_height_mm or 0.0)
        if old_niche != new_niche:
            diffs.append(f"Açık Niş Boyu: {old_niche:.0f} mm ➔ {new_niche:.0f} mm")
        if (old_cfg.niche_bottom_offset_mm or 0.0) != (new_cfg.niche_bottom_offset_mm or 0.0):
            diffs.append(f"Niş Taban Kotu: {old_cfg.niche_bottom_offset_mm or 0:.0f} mm ➔ {new_cfg.niche_bottom_offset_mm or 0:.0f} mm")
        if (old_cfg.niche_back_open or False) != (new_cfg.niche_back_open or False):
            diffs.append("Niş Arkalığı: " + ("Açık (Priz/Hava)" if new_cfg.niche_back_open else "Kapalı"))
        if (old_cfg.niche_color_hex or "") != (new_cfg.niche_color_hex or ""):
            diffs.append(f"Niş Aksan Rengi: {new_cfg.niche_color_hex or 'Standart'}")

        if old_cfg.has_plinth != new_cfg.has_plinth:
            diffs.append("Baza: " + ("Var" if new_cfg.has_plinth else "Bazasız (Tavandan Tabana)"))
        if old_cfg.plinth_type != new_cfg.plinth_type:
            diffs.append(f"Ayak/Baza Tipi: {old_cfg.plinth_type.value} ➔ {new_cfg.plinth_type.value}")

        if old_cfg.door_color_hex != new_cfg.door_color_hex:
            diffs.append(f"Kapak Rengi: {old_cfg.door_color_hex} ➔ {new_cfg.door_color_hex}")
        if old_cfg.body_color_hex != new_cfg.body_color_hex:
            diffs.append(f"Gövde Rengi: {old_cfg.body_color_hex} ➔ {new_cfg.body_color_hex}")
        if old_cfg.door_material != new_cfg.door_material and new_cfg.door_material:
            diffs.append(f"Kapak Malzemesi: {new_cfg.door_material}")
        if old_cfg.body_material != new_cfg.body_material:
            diffs.append(f"Gövde Malzemesi: {new_cfg.body_material}")

        if old_cfg.fastener_type != new_cfg.fastener_type:
            diffs.append(f"Bağlantı: {old_cfg.fastener_type.value} ➔ {new_cfg.fastener_type.value}")
        if old_cfg.cutting_mode != new_cfg.cutting_mode:
            diffs.append(f"Kesim Modu: {old_cfg.cutting_mode.value} ➔ {new_cfg.cutting_mode.value}")

        old_zones_len = len(old_cfg.zones or [])
        new_zones_len = len(new_cfg.zones or [])
        if old_zones_len != new_zones_len:
            diffs.append(f"Dikey Bölmeler: {old_zones_len} Bölme ➔ {new_zones_len} Bölme")

        return diffs

    @classmethod
    def _deterministic_mutate(
        cls, current_config: CabinetConfig, instruction: str
    ) -> tuple[CabinetConfig, str, list[str]]:
        """Çevrimdışı ve kural tabanlı deterministik revizyon motoru."""
        text = instruction.lower().strip()
        updated_dict = current_config.model_dump()
        reasons: list[str] = []

        # 1. Genişlik Revizyonu
        m_w_abs = (
            re.search(r"geni[şs]li[ğg]i(?:ni)?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yap|ayarla|olsun)", text)
            or re.search(r"(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*geni[şs]li[ğg]inde\s*(?:yap|olsun)", text)
        )
        if m_w_abs:
            val = cls._to_mm(m_w_abs.group(1), m_w_abs.group(2))
            updated_dict["width_mm"] = max(300.0, min(2700.0, val))
            reasons.append(f"Genişlik {val:.0f} mm olarak güncellendi")
        else:
            m_w_inc = re.search(r"(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:daha\s*)?(?:geni[şs]let|büyüt|art[ıi]r)", text)
            if m_w_inc:
                delta = cls._to_mm(m_w_inc.group(1), m_w_inc.group(2))
                updated_dict["width_mm"] = min(2700.0, current_config.width_mm + delta)
                reasons.append(f"Genişlik {delta:.0f} mm artırıldı")
            m_w_dec = re.search(r"(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:daha\s*)?(?:daralt|küçült|azalt)", text)
            if m_w_dec:
                delta = cls._to_mm(m_w_dec.group(1), m_w_dec.group(2))
                updated_dict["width_mm"] = max(300.0, current_config.width_mm - delta)
                reasons.append(f"Genişlik {delta:.0f} mm daraltıldı")

        # 2. Yükseklik Revizyonu
        m_h_abs = (
            re.search(r"yüksekli[ğg]i(?:ni)?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yap|ayarla|olsun)", text)
            or re.search(r"boyu(?:nu)?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yap|ayarla|olsun)", text)
            or re.search(r"(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*yüksekli[ğg]inde\s*(?:yap|olsun)", text)
        )
        if m_h_abs:
            val = cls._to_mm(m_h_abs.group(1), m_h_abs.group(2))
            updated_dict["height_mm"] = max(300.0, min(2750.0, val))
            reasons.append(f"Yükseklik {val:.0f} mm olarak güncellendi")
        else:
            m_h_inc = re.search(r"(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:daha\s*)?(?:yükselt|uzat|art[ıi]r)", text)
            if m_h_inc:
                delta = cls._to_mm(m_h_inc.group(1), m_h_inc.group(2))
                updated_dict["height_mm"] = min(2750.0, current_config.height_mm + delta)
                reasons.append(f"Yükseklik {delta:.0f} mm artırıldı")

        # 3. Derinlik Revizyonu
        m_d_abs = re.search(r"derinli[ğg]i(?:ni)?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yap|ayarla|olsun)", text)
        if m_d_abs:
            val = cls._to_mm(m_d_abs.group(1), m_d_abs.group(2))
            updated_dict["depth_mm"] = max(200.0, min(900.0, val))
            reasons.append(f"Derinlik {val:.0f} mm olarak güncellendi")

        # 4. Çekmece Revizyonu
        if "çekmecesiz" in text or "cekmecesiz" in text or "çekmeceleri kaldır" in text or "çekmeceyi kaldır" in text:
            updated_dict["drawer_count"] = 0
            reasons.append("Çekmeceler kaldırıldı")
        else:
            m_dr_add = re.search(r"(\d+)\s*(?:adet\s*)?(?:tane\s*)?çekmece\s*(?:daha\s*)?ekle", text)
            if m_dr_add:
                add_cnt = int(m_dr_add.group(1))
                new_cnt = min(6, (current_config.drawer_count or 0) + add_cnt)
                updated_dict["drawer_count"] = new_cnt
                reasons.append(f"{add_cnt} adet çekmece eklendi (Toplam: {new_cnt})")
            else:
                m_dr_set = re.search(r"(\d+)\s*çekmeceli\s*(?:yap|olsun)|çekmece(?:yi|leri| sayısını)?\s*(\d+)\s*(?:yap|olsun|adet)", text)
                if m_dr_set:
                    cnt_str = m_dr_set.group(1) or m_dr_set.group(2)
                    cnt = min(6, max(0, int(cnt_str)))
                    updated_dict["drawer_count"] = cnt
                    reasons.append(f"Çekmece adedi {cnt} yapıldı")

        # 5. Raf Revizyonu
        if "rafsız" in text or "rafsiz" in text or "rafları kaldır" in text:
            updated_dict["shelf_count"] = 0
            reasons.append("Raflar kaldırıldı")
        else:
            m_sh_add = re.search(r"(\d+)\s*(?:adet\s*)?(?:tane\s*)?raf\s*(?:daha\s*)?ekle", text)
            if m_sh_add:
                add_cnt = int(m_sh_add.group(1))
                new_cnt = min(12, current_config.shelf_count + add_cnt)
                updated_dict["shelf_count"] = new_cnt
                reasons.append(f"{add_cnt} adet raf eklendi (Toplam: {new_cnt})")
            else:
                m_sh_set = re.search(r"(\d+)\s*raflı\s*(?:yap|olsun)|raf(?: sayısını)?\s*(\d+)\s*(?:yap|olsun|adet)", text)
                if m_sh_set:
                    cnt_str = m_sh_set.group(1) or m_sh_set.group(2)
                    cnt = min(12, max(0, int(cnt_str)))
                    updated_dict["shelf_count"] = cnt
                    reasons.append(f"Raf sayısı {cnt} yapıldı")

        # 6. Kapak Tipi Revizyonu
        if any(k in text for k in ("kapaksız yap", "kapaksiz yap", "açık yap", "kapakları kaldır", "kapakları sök")):
            updated_dict["door_type"] = DoorType.NONE
            reasons.append("Dolap kapaksız (açık) hale getirildi")
        elif "kalkar kapak" in text or "kalkar yap" in text or "pistonlu yap" in text:
            updated_dict["door_type"] = DoorType.FLAP_UP
            reasons.append("Kapak tipi gazlı pistonlu kalkar kapak olarak ayarlandı")
        elif "çift kapak" in text or "iki kapak" in text:
            updated_dict["door_type"] = DoorType.DOUBLE
            reasons.append("Kapak tipi çift kapak yapıldı")
        elif "tek kapak" in text or "tek parça kapak" in text:
            if "sağ" in text:
                updated_dict["door_type"] = DoorType.SINGLE_RIGHT
                reasons.append("Kapak sağ menteşeli tek kapak yapıldı")
            else:
                updated_dict["door_type"] = DoorType.SINGLE_LEFT
                reasons.append("Kapak sol menteşeli tek kapak yapıldı")

        # 7. Açık Niş, Kahve Barı & Ankastre Revizyonu
        if "nişi kaldır" in text or "nişsiz yap" in text or "boşluğu kapat" in text:
            updated_dict["niche_height_mm"] = 0.0
            updated_dict["appliance_niche_height_mm"] = 0.0
            updated_dict["niche_bottom_offset_mm"] = 0.0
            updated_dict["niche_color_hex"] = None
            updated_dict["niche_back_open"] = False
            reasons.append("Açık niş kaldırıldı, kapalı dolaba dönüştürüldü")
        elif any(k in text for k in ("kahve barı", "kahve bari", "kahve köşesi", "kahve istasyonu")):
            updated_dict["niche_height_mm"] = 450.0
            updated_dict["appliance_niche_height_mm"] = 450.0
            updated_dict["niche_bottom_offset_mm"] = 850.0
            updated_dict["niche_color_hex"] = "#9C6644"
            updated_dict["niche_back_open"] = False
            reasons.append("Tezgâh üstü ahşap kahve köşesi açık nişi (450 mm) eklendi")
        elif any(k in text for k in ("ankastre fırın", "fırın nişi", "fırın koy")):
            updated_dict["niche_height_mm"] = 600.0
            updated_dict["appliance_niche_height_mm"] = 600.0
            updated_dict["niche_bottom_offset_mm"] = 800.0
            updated_dict["niche_back_open"] = True
            updated_dict["niche_color_hex"] = "#2D3134"
            reasons.append("600 mm ankastre fırın boşluğu ve menfezli açık arkalık eklendi")
        elif "buzdolabı" in text and any(k in text for k in ("niş", "boşluk", "çevrele")):
            h = updated_dict.get("height_mm", current_config.height_mm)
            updated_dict["niche_height_mm"] = min(1850.0, max(0.0, h - 450.0))
            updated_dict["appliance_niche_height_mm"] = updated_dict["niche_height_mm"]
            updated_dict["niche_bottom_offset_mm"] = 0.0
            updated_dict["has_plinth"] = False
            updated_dict["door_type"] = DoorType.FLAP_UP
            reasons.append("Alt buzdolabı zemin nişi (185 cm) ve üst kalkar kapak tanımlandı")

        if "nişin arkasını açık yap" in text or "arkalıksız niş" in text or "prizli niş" in text:
            updated_dict["niche_back_open"] = True
            reasons.append("Niş arkalığı duvar prizi/havalandırma için açık bırakıldı")

        # 8. Baza & Kertmeler
        if "bazasız yap" in text or "tavandan tabana" in text:
            updated_dict["has_plinth"] = False
            updated_dict["plinth_height_mm"] = 0.0
            reasons.append("Alt baza kaldırıldı (tavandan tabana gövde)")
        elif "baza ekle" in text or "bazalı yap" in text:
            updated_dict["has_plinth"] = True
            updated_dict["plinth_height_mm"] = 80.0
            reasons.append("80 mm ahşap baza eklendi")

        if "ayarlı ayak" in text or "plastik ayak" in text:
            updated_dict["plinth_type"] = PlinthType.ADJUSTABLE_LEGS
            reasons.append("Baza sistemi ayarlı plastik ayak olarak güncellendi")

        if "süpürgelik kertmesi" in text:
            updated_dict["has_baseboard_notch"] = True
            reasons.append("80×15 mm süpürgelik kertmesi aktif edildi")
        if "kolon kertmesi" in text:
            updated_dict["has_column_notch"] = True
            reasons.append("120×120 mm arka kolon kertmesi aktif edildi")

        # 9. Renk ve Malzeme Revizyonu
        for word, (hex_code, mat_label) in cls.COLOR_MAP.items():
            if f"kapakları {word}" in text or f"kapak {word}" in text or f"{word} kapak" in text:
                updated_dict["door_color_hex"] = hex_code
                updated_dict["door_material"] = mat_label
                reasons.append(f"Kapak rengi {word.capitalize()} ({hex_code}) yapıldı")
            elif f"gövdeyi {word}" in text or f"gövde {word}" in text or f"{word} gövde" in text:
                updated_dict["body_color_hex"] = hex_code
                updated_dict["body_material"] = mat_label
                reasons.append(f"Gövde rengi {word.capitalize()} ({hex_code}) yapıldı")
            elif f"nişi {word}" in text or f"{word} niş" in text:
                updated_dict["niche_color_hex"] = hex_code
                reasons.append(f"Niş aksan rengi {word.capitalize()} yapıldı")
            elif f"{word} yap" in text:
                updated_dict["door_color_hex"] = hex_code
                updated_dict["door_material"] = mat_label
                reasons.append(f"Renk şeması {word.capitalize()} olarak güncellendi")

        # 10. Bağlantı Tipi
        if "cabineo" in text or "lamello" in text or "3 eksen" in text:
            updated_dict["fastener_type"] = FastenerType.CABINEO_12
            reasons.append("Bağlantı sistemi Lamello Cabineo 12 (3-Eksen CNC) olarak ayarlandı")
        elif "minifiks" in text or "minifix" in text:
            updated_dict["fastener_type"] = FastenerType.MINIFIX_DOWEL
            reasons.append("Bağlantı sistemi Minifiks + Kavela olarak ayarlandı")

        new_config = CabinetConfig.model_validate(updated_dict)
        diff_summary = cls.compute_diff(current_config, new_config)

        if not reasons:
            assistant_msg = (
                "İsteminize göre ölçü ve parametreler incelendi, mevcut dolap tasarımınız güncellendi."
            )
        else:
            assistant_msg = "Tasarım başarıyla revize edildi: " + ", ".join(reasons) + "."

        return new_config, assistant_msg, diff_summary

    @classmethod
    def _gemini_mutate(
        cls,
        current_config: CabinetConfig,
        instruction: str,
        history: list[ChatMessage],
    ) -> tuple[CabinetConfig, str, list[str]]:
        """Gemini 2.5/3.8 Flash kullanarak akıllı cerrahi revizyon uygular."""
        settings = get_settings()
        api_key = settings.gemini_api_key.strip()
        if not api_key:
            return cls._deterministic_mutate(current_config, instruction)

        current_json = current_config.model_dump_json(indent=2)
        history_context = ""
        if history:
            history_lines = [f"- {m.role}: {m.content}" for m in history[-4:]]
            history_context = "\nÖnceki Sohbet Geçmişi:\n" + "\n".join(history_lines) + "\n"

        prompt = (
            f"MEVCUT DOLAP PARAMETRELERİ (JSON):\n{current_json}\n\n"
            f"{history_context}"
            f"KULLANICI REVİZYON KOMUTU:\n\"{instruction}\"\n\n"
            "Lütfen yalnızca kullanıcının talep ettiği değişiklikleri uygulayarak "
            "CabinetParseSchema şemasına uygun güncellenmiş JSON parametrelerini üret."
        )

        candidate_models = [
            settings.gemini_model,
            "gemini-2.5-flash",
            "gemini-3.8-flash",
        ]
        models_to_try: list[str] = []
        for m in candidate_models:
            if m and m not in models_to_try:
                models_to_try.append(m)

        client = genai.Client(api_key=api_key)
        for model_name in models_to_try:
            try:
                gen_config = types.GenerateContentConfig(
                    system_instruction=cls.REVISION_SYSTEM_INSTRUCTION,
                    response_mime_type="application/json",
                    response_schema=CabinetParseSchema,
                    temperature=0.0,
                )
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=gen_config,
                )
                if response and response.text:
                    parsed_schema = CabinetParseSchema.model_validate_json(response.text)
                    new_config = SemanticParserEngine._parsed_schema_to_config(parsed_schema)
                    diff_summary = cls.compute_diff(current_config, new_config)
                    assistant_msg = (
                        f"Revizyon uygulandı: {', '.join(diff_summary)}"
                        if diff_summary
                        else "İstediğiniz düzenlemeler uygulandı."
                    )
                    return new_config, assistant_msg, diff_summary
            except Exception as e:
                logger.warning("Gemini revizyon modeli (%s) hatası: %s", model_name, e)
                continue

        return cls._deterministic_mutate(current_config, instruction)

    @classmethod
    def revise_config(
        cls,
        current_config: CabinetConfig,
        instruction: str,
        history: list[ChatMessage] | None = None,
    ) -> tuple[CabinetConfig, str, list[str]]:
        """Mevcut dolap üzerinde revizyon uygular, güncellenmiş nesneyi ve özetini döndürür."""
        hist = history or []
        try:
            settings = get_settings()
            if settings.gemini_api_key.strip():
                return cls._gemini_mutate(current_config, instruction, hist)
        except Exception as e:
            logger.warning("Revizyon motoru API çağırma hatası, deterministiğe düşülüyor: %s", e)

        return cls._deterministic_mutate(current_config, instruction)
