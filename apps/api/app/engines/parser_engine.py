"""Doğal Dil Ayrıştırıcı (Semantic Parser) Motoru.

Kullanıcının serbest metin istemini (Türkçe/İngilizce) doğrulanmış bir CabinetConfig
nesnesine dönüştürür. Gemini API anahtarı tanımlıysa Gemini JSON Schema modunu kullanır;
anahtar yoksa veya bağlantı kesilirse deterministik Türkçe/İngilizce kural tabanlı
dil ayrıştırıcısını devreye sokar. LLM hiçbir geometrik veya delik hesabı yapmaz.
"""

import json
import logging
import re

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.schemas.cabinet import (
    BackPanelType,
    CabinetConfig,
    CabinetType,
    CabinetZone,
    CuttingMode,
    DoorType,
    FastenerType,
    PlinthType,
    SheetSizeOption,
)

logger = logging.getLogger(__name__)


class ZoneParseSchema(BaseModel):
    """Bölme (Zone) ayrıştırma şeması."""

    name: str = Field(default="", description="Bölme adı (örn: Sol Bölme, Sağ Bölme, Orta)")
    width_ratio: float = Field(default=1.0, description="Genişlik payı oranı (örn: 1.0)")
    width_mm: float = Field(default=0.0, description="Sabit genişlik (mm) verilmişse, yoksa 0.0")
    shelf_count: int = Field(default=0, description="Bu bölmedeki hareketli raf adedi")
    door_type: DoorType = Field(default=DoorType.NONE, description="Bu bölmenin kapak tipi")
    drawer_count: int = Field(default=0, description="Bu bölmedeki çekmece adedi")
    drawer_front_height_mm: float = Field(default=180.0, description="Çekmece klapa yüksekliği (mm)")
    has_hanging_rod: bool = Field(default=False, description="Bu bölmede elbise askı borusu var mı")
    appliance_niche_height_mm: float = Field(default=0.0, description="Bölme alt nişi (mm)")
    niche_height_mm: float = Field(default=0.0, description="Bölme açık niş yüksekliği (mm)")
    niche_bottom_offset_mm: float = Field(default=0.0, description="Niş alt başlangıç mesafesi (mm). 0 ise zemin/alt niş, >0 ise orta açık niş")
    niche_color_hex: str = Field(default="", description="Niş arka/iç aksan rengi hex kodu")
    niche_back_open: bool = Field(default=False, description="Niş arkalığı açık (priz/havalandırma için arkalıksız)")
    door_color_hex: str = Field(default="", description="Bölme kapağı özel rengi")


class CabinetParseSchema(BaseModel):
    """Gemini API ile yapılandırılmış JSON çıktısı için özyinelemesiz şema."""

    name: str = Field(default="Parametrik Dolap", description="Dolap veya modül adı")
    cabinet_type: CabinetType = Field(default=CabinetType.WARDROBE, description="Dolap tipi")
    width_mm: float = Field(default=900.0, description="Dış genişlik (mm)")
    height_mm: float = Field(default=2100.0, description="Dış yükseklik (mm)")
    depth_mm: float = Field(default=580.0, description="Dış derinlik (mm)")
    shelf_count: int = Field(default=3, description="Hareketli raf adedi (0-12)")
    door_type: DoorType = Field(default=DoorType.DOUBLE, description="Kapak tipi")
    drawer_count: int = Field(default=0, description="Çekmece adedi (0-6)")
    drawer_front_height_mm: float = Field(default=180.0, description="Çekmece klapa yüksekliği (mm)")
    has_plinth: bool = Field(default=True, description="Alt baza var mı")
    plinth_height_mm: float = Field(default=80.0, description="Baza yüksekliği (mm)")
    appliance_niche_height_mm: float = Field(
        default=0.0,
        description="Alt açık cihaz/buzdolabı niş boşluğu yüksekliği (mm). Yoksa 0.",
    )
    niche_height_mm: float = Field(
        default=0.0,
        description="Açık niş yüksekliği (mm). Kahve barı, fırın, mikrodalga veya solo cihaz için.",
    )
    niche_bottom_offset_mm: float = Field(
        default=0.0,
        description="Niş alt kotu (mm). 0 ise zemin nişi, >0 ise orta açık niş.",
    )
    niche_color_hex: str = Field(
        default="",
        description="Niş içi veya arkalık aksan rengi hex kodu",
    )
    niche_back_open: bool = Field(
        default=False,
        description="Niş arkası açık mı (duvar/priz/havalandırma için arkalıksız)",
    )
    body_material: str = Field(default="18mm Beyaz Suntalam", description="Gövde malzemesi")
    door_material: str = Field(default="", description="Kapak malzemesi (belirtilmişse)")
    body_color_hex: str = Field(default="#F4F1EA", description="Gövde renk hex kodu")
    door_color_hex: str = Field(default="#C89F70", description="Kapak renk hex kodu")
    front_pvc_thickness_mm: float = Field(default=2.0, description="Ön kenar PVC kalınlığı (mm)")
    hidden_pvc_thickness_mm: float = Field(default=0.4, description="Görünmeyen kenar PVC kalınlığı (mm)")
    back_panel_type: BackPanelType = Field(default=BackPanelType.GROOVED_8MM, description="Arkalık tipi")
    sheet_size: SheetSizeOption = Field(default=SheetSizeOption.SHEET_2800_2100, description="Plaka ebadı")
    fastener_type: FastenerType = Field(
        default=FastenerType.MINIFIX_DOWEL,
        description="Bağlantı elemanı tipi (minifix_dowel veya cabineo_12)",
    )
    cutting_mode: CuttingMode = Field(
        default=CuttingMode.PANEL_SAW,
        description="Makine kesim modu (panel_saw veya cnc_router)",
    )
    plinth_type: PlinthType = Field(
        default=PlinthType.WOOD_PLINTH,
        description="Alt baza tipi (wood_plinth veya adjustable_legs)",
    )
    has_baseboard_notch: bool = Field(
        default=False, description="Arka süpürgelik kertmesi var mı"
    )
    baseboard_notch_height_mm: float = Field(
        default=80.0, description="Süpürgelik kertme yüksekliği (mm)"
    )
    baseboard_notch_depth_mm: float = Field(
        default=15.0, description="Süpürgelik kertme derinliği (mm)"
    )
    has_column_notch: bool = Field(
        default=False, description="Arka kolon kertmesi var mı"
    )
    column_notch_width_mm: float = Field(
        default=120.0, description="Kolon kertme genişliği (mm)"
    )
    column_notch_depth_mm: float = Field(
        default=120.0, description="Kolon kertme derinliği (mm)"
    )
    left_filler_width_mm: float = Field(
        default=0.0, description="Sol duvar kör kapama çıtası genişliği (mm)"
    )
    right_filler_width_mm: float = Field(
        default=0.0, description="Sağ duvar kör kapama çıtası genişliği (mm)"
    )
    zones: list[ZoneParseSchema] = Field(
        default_factory=list,
        description="İç dikmelerle ayrılmış dikey bölmeler listesi (örn: sol raflı, sağ askılı ve çekmeceli)",
    )
    has_slope: bool = Field(default=False, description="Çatı veya merdiven altı eğimi var mı")
    slope_side: str = Field(default="left", description="Eğimin alçak kenarı (left veya right)")
    slope_start_height_mm: float = Field(default=1200.0, description="Eğimli alçak kenar boyu (mm)")
    slope_angle_deg: float = Field(default=0.0, description="Çatı eğim açısı (derece)")
    is_corner_module: bool = Field(default=False, description="L-Köşe dönüş modülü mü")
    corner_angle_deg: float = Field(default=90.0, description="L-Köşe açısı (derece)")
    corner_blind_width_mm: float = Field(default=100.0, description="L-Köşe kör kapama paneli genişliği (mm)")


class SemanticParserEngine:
    """Doğal dil mobilya tarifini CabinetConfig şemasına ayrıştırır."""

    SYSTEM_INSTRUCTION = (
        "Sen bir mobilya fabrikası için Doğal Dil Ayrıştırıcısısın (Semantic Parser). "
        "Kullanıcının Türkçe veya İngilizce dolap tarifini dikkatle oku ve yalnızca "
        "CabinetConfig JSON şemasına uygun parametreleri çıkar. "
        "Ölçüler santimetre (cm) verilmişse milimetreye (mm) çevir (örn: 235 cm -> 2350 mm). "
        "Toplam dış ölçüleri width_mm, height_mm, depth_mm olarak yaz; alt kısımda buzdolabı veya "
        "cihaz için açık bir niş/boşluk yüksekliği tarif edilmişse (örn: 185 cm açık niş) bunu "
        "appliance_niche_height_mm ve niche_height_mm alanına mm cinsinden (1850) yaz, niche_bottom_offset_mm=0 ve has_plinth=false yap. "
        "Orta açık niş, kahve istasyonu / kahve köşesi, ankastre fırın veya mikrodalga boşluğu varsa "
        "niche_height_mm ve niche_bottom_offset_mm değerlerini doldur (örn: yerden 85 cm yükseklikte 45 cm niş -> niche_bottom_offset_mm=850, niche_height_mm=450). "
        "Arkalık açık veya priz/havalandırma istenmişse niche_back_open=true yap. "
        "Niş arka/iç rengi belirtilmişse (örn: ahşap kontrast niş) niche_color_hex alanını doldur. "
        "Gazlı pistonlu / yukarı doğru açılan kalkar kapak istenmişse door_type='flap_up' seç. "
        "İstemde açıkça raf adedi belirtilmemişse ve üst kalkar kapaklı niş dolabıysa shelf_count=0 ver. "
        "Eğer kullanıcı dolabın içini dikey bölmelere / kolonlara ayırmışsa (örn: 'sol tarafı 4 raflı, sağ tarafı askılıklı ve 2 çekmeceli', "
        "'2 bölmeli gardırop', '3 bölmeli sol raflı orta askılı'), her bölmeyi 'zones' dizisinde tanımla. "
        "Her bölme için name, width_ratio, shelf_count, door_type, drawer_count, has_hanging_rod parametrelerini doldur. "
        "Çatı eğimi, tavan eğimi, mansard çatı veya merdiven altı dolap istenmişse has_slope=true yap, "
        "eğimin alçak tarafını slope_side ('left' veya 'right') ve alçak kenar boyunu slope_start_height_mm olarak yaz. "
        "L-Köşe dönüş modülü veya 90 derece köşe dolap istenmişse is_corner_module=true yap. "
        "Lamello Cabineo 12 veya 3-eksen bağlantı istenmişse fastener_type='cabineo_12' seç. "
        "Ayarlı plastik ayak istenmişse plinth_type='adjustable_legs' seç. "
        "Süpürgelik kertmesi varsa has_baseboard_notch=true, kolon kertmesi varsa has_column_notch=true yap. "
        "Hiçbir kesim veya delik hesabı yapma, sadece şema parametrelerini çıkar."
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
        """Yakalanan sayısal değeri birim bilgisine göre milimetreye dönüştürür."""
        val = float(val_str.replace(",", "."))
        unit = (unit_str or "").lower().strip()
        if unit == "m" or (not unit and val < 4.0):
            return round(val * 1000.0, 1)
        if unit == "cm" or (not unit and 20.0 <= val <= 275.0):
            return round(val * 10.0, 1)
        return round(val, 1)

    @classmethod
    def _deterministic_rule_parse(cls, prompt: str) -> CabinetConfig:
        """Metin içerisindeki ölçü, raf, kapak, renk ve malzeme ifadelerini deterministik ayrıştırır."""
        text = prompt.lower()

        # 1. Dolap / Oda Tipi Tespiti
        cabinet_type = CabinetType.WARDROBE
        name = "Parametrik Gardırop Modülü"
        width_mm = 900.0
        height_mm = 2100.0
        depth_mm = 580.0
        has_plinth = True
        plinth_height_mm = 80.0
        drawer_count = 0

        if any(k in text for k in ("buzdolab", "kiler", "boy kiler", "ankastre kule")):
            cabinet_type = CabinetType.KITCHEN_TALL
            name = "Buzdolabı / Kiler Dolabı Modülü"
            width_mm, height_mm, depth_mm = 850.0, 2350.0, 650.0
            has_plinth = False
            plinth_height_mm = 0.0
        elif any(k in text for k in ("mutfak üst", "üst modül", "duvar dolab")):
            cabinet_type = CabinetType.KITCHEN_WALL
            name = "Mutfak Üst Dolap Modülü"
            width_mm, height_mm, depth_mm = 800.0, 720.0, 350.0
            has_plinth = False
            plinth_height_mm = 0.0
        elif any(k in text for k in ("mutfak alt", "alt modül", "tezgah altı", "evye")):
            cabinet_type = CabinetType.KITCHEN_BASE
            name = "Mutfak Alt Dolap Modülü"
            width_mm, height_mm, depth_mm = 800.0, 820.0, 560.0
            has_plinth = True
            plinth_height_mm = 100.0
        elif any(k in text for k in ("banyo boy", "kirli sepet", "çamaşır", "camasir")):
            cabinet_type = CabinetType.BATHROOM_TALL
            name = "Banyo Boy / Çamaşır Makinesi Dolabı"
            width_mm, height_mm, depth_mm = 450.0, 1800.0, 380.0
        elif any(k in text for k in ("banyo", "lavabo")):
            cabinet_type = CabinetType.BATHROOM_VANITY
            name = "Banyo Lavabo Altı Modülü"
            width_mm, height_mm, depth_mm = 800.0, 650.0, 480.0
            has_plinth = False
            plinth_height_mm = 0.0
            drawer_count = 2
        elif any(k in text for k in ("şifonyer", "sifonyer", "komodin", "keson")):
            cabinet_type = CabinetType.DRESSER
            name = "Şifonyer / Komodin / Keson Modülü"
            width_mm, height_mm, depth_mm = 900.0, 860.0, 480.0
            drawer_count = 4
        elif any(k in text for k in ("kitaplık", "kitaplik", "dosya", "klasör", "arşiv", "arsiv")):
            cabinet_type = CabinetType.BOOKSHELF
            name = "Parametrik Kitaplık / Ofis Arşiv Modülü"
            width_mm, height_mm, depth_mm = 800.0, 1800.0, 350.0
        elif any(k in text for k in ("ayakkabılık", "ayakkabilik", "portmanto", "vestiyer")):
            cabinet_type = CabinetType.SHOE_CABINET
            name = "Vestiyer / Portmanto Modülü"
            width_mm, height_mm, depth_mm = 900.0, 1200.0, 380.0
        elif any(k in text for k in ("tv", "televizyon", "konsol")):
            cabinet_type = CabinetType.TV_UNIT
            name = "TV Ünitesi / Medya Konsolu"
            width_mm, height_mm, depth_mm = 1600.0, 500.0, 420.0
            drawer_count = 2

        # 2. Ölçülerin Çıkarılması (Önce 'dış ölçü' / 'toplam ölçü' kapsamı kontrol edilir)
        outer_scope = text
        outer_match = re.search(r"(?:dış\s*ölçü|dış\s*ebat|toplam\s*ölçü)[^.]*?(?:\.|$)", text)
        if outer_match:
            outer_scope = outer_match.group(0)

        w_match = (
            re.search(r"(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:genişli[ğg]inde|genişlik|genislik|eninde|en\b)", outer_scope)
            or re.search(r"(?:genişlik|genislik|en)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?", outer_scope)
            or re.search(r"(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:genişli[ğg]inde|genişlik|genislik|eninde|en\b)", text)
            or re.search(r"(?:genişlik|genislik|en)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?", text)
        )
        if w_match:
            g1, g2 = w_match.group(1), w_match.group(2)
            val, unit = (g1, g2) if (g1 and re.match(r"^\d+(?:[.,]\d+)?$", g1)) else (g2, g1)
            if val:
                width_mm = cls._to_mm(val, unit)

        h_match = (
            re.search(r"(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yüksekli[ğg]inde|yükseklik|yukseklik|boyunda|boy\b|tezgah\s*altı|tezgah\s*alti)", outer_scope)
            or re.search(r"(?:yükseklik|yukseklik|boy)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?", outer_scope)
            or re.search(r"(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yüksekli[ğg]inde|yükseklik|yukseklik|boyunda|boy\b|tezgah\s*altı|tezgah\s*alti)", text)
            or re.search(r"(?:yükseklik|yukseklik|boy)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?", text)
        )
        if h_match:
            g1, g2 = h_match.group(1), h_match.group(2)
            val, unit = (g1, g2) if (g1 and re.match(r"^\d+(?:[.,]\d+)?$", g1)) else (g2, g1)
            if val:
                height_mm = cls._to_mm(val, unit)

        d_match = (
            re.search(r"(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:derinli[ğg]inde|derinlik)", outer_scope)
            or re.search(r"(?:derinlik)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?", outer_scope)
            or re.search(r"(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:derinli[ğg]inde|derinlik)", text)
            or re.search(r"(?:derinlik)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?", text)
        )
        if d_match:
            g1, g2 = d_match.group(1), d_match.group(2)
            val, unit = (g1, g2) if (g1 and re.match(r"^\d+(?:[.,]\d+)?$", g1)) else (g2, g1)
            if val:
                depth_mm = cls._to_mm(val, unit)

        # Eğer WxHxD veya WxD (örn. 100x60 cm) formatı kullanılmışsa
        dim_pair = re.search(
            r"(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?",
            text,
        )
        if dim_pair and not (w_match and d_match):
            unit = dim_pair.group(3)
            p1 = cls._to_mm(dim_pair.group(1), unit)
            p2 = cls._to_mm(dim_pair.group(2), unit)
            # İkili ebat verilmişse (örn: 100x60 cm), büyük olan genişlik, küçük olan derinliktir
            if not w_match:
                width_mm = max(p1, p2)
            if not d_match:
                depth_mm = min(p1, p2)

        if not (w_match or h_match or d_match):
            dim_triplet = re.search(
                r"(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?",
                text,
            )
            if dim_triplet:
                unit = dim_triplet.group(4)
                d1 = cls._to_mm(dim_triplet.group(1), unit)
                d2 = cls._to_mm(dim_triplet.group(2), unit)
                d3 = cls._to_mm(dim_triplet.group(3), unit)
                sorted_dims = sorted([d1, d2, d3])
                depth_mm = sorted_dims[0]
                width_mm = d1 if d1 != depth_mm else sorted_dims[1]
                height_mm = d2 if d2 not in (width_mm, depth_mm) else sorted_dims[2]

        # 2b. Açık Niş, Cihaz & Ankastre Tespiti (Alt Niş vs. Orta Açık Niş)
        appliance_niche_height_mm = 0.0
        niche_height_mm = 0.0
        niche_bottom_offset_mm = 0.0
        niche_color_hex = ""
        niche_back_open = False

        is_coffee = any(k in text for k in ("kahve barı", "kahve bari", "kahve köşesi", "kahve kosesi", "kahve istasyonu"))
        is_oven = any(k in text for k in ("ankastre fırın", "ankastre firin", "fırın nişi", "firin nisi", "fırın", "firin"))
        is_micro = any(k in text for k in ("mikrodalga", "mikro dalga"))
        is_mid_niche_keyword = is_coffee or is_oven or is_micro or any(k in text for k in ("orta niş", "orta nis", "açık niş", "acik nis"))
        is_bottom_niche_keyword = any(k in text for k in ("buzdolab", "çamaşır makine", "camasir makine"))

        niche_match = (
            re.search(
                r"(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yüksekli[ğg]inde\s*)?(?:açık\s*)?(?:bir\s*)?(?:niş|nis|boşluk|bosluk)",
                text,
            )
            or re.search(
                r"(?:niş|nis|boşluk|bosluk)[^.]*?(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yüksekli[ğg]inde|yükseklik|boy)",
                text,
            )
        )
        if niche_match:
            niche_height_mm = cls._to_mm(niche_match.group(1), niche_match.group(2))
        elif is_coffee:
            niche_height_mm = 450.0
        elif is_oven:
            niche_height_mm = 600.0
        elif is_micro:
            niche_height_mm = 380.0
        elif "buzdolab" in text:
            niche_height_mm = min(1850.0, max(0.0, height_mm - 450.0))

        appliance_niche_height_mm = niche_height_mm

        # Başlangıç alt kotu (0 = alt niş, >0 = orta açık niş)
        offset_match = (
            re.search(r"(?:tabandan|yerden|alttan|zeminden)\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?", text)
            or re.search(r"(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yükseklikten|kotundan|üzerinde|uzerinde)", text)
        )
        if offset_match:
            niche_bottom_offset_mm = cls._to_mm(offset_match.group(1), offset_match.group(2))
        elif is_mid_niche_keyword and not is_bottom_niche_keyword:
            niche_bottom_offset_mm = 850.0

        if any(k in text for k in ("arkalıksız", "arkaliksiz", "arkalık açık", "arkalik acik", "priz")) or is_oven or (is_coffee and "açık" in text):
            niche_back_open = True

        if any(k in text for k in ("ahşap niş", "ahsap nis", "meşe niş", "mese nis")):
            niche_color_hex = "#9C6644"
        elif any(k in text for k in ("antrasit niş", "siyah niş")):
            niche_color_hex = "#2D3134"
        elif "beyaz niş" in text:
            niche_color_hex = "#F8FAFC"
        elif "ceviz niş" in text:
            niche_color_hex = "#5C4033"

        if niche_height_mm > 0 and niche_bottom_offset_mm <= 0:
            has_plinth = False
            plinth_height_mm = 0.0

        # 3. Raf ve Çekmece Sayısı
        shelf_count = (
            0
            if (
                cabinet_type in (CabinetType.DRESSER, CabinetType.BATHROOM_VANITY)
                or appliance_niche_height_mm > 0
                or "buzdolab" in text
            )
            else (2 if cabinet_type == CabinetType.KITCHEN_WALL else 4)
        )
        if "rafsız" in text or "rafsiz" in text:
            shelf_count = 0
        else:
            shelf_match = re.search(r"(\d+)\s*(?:adet\s*)?(?:hareketli\s*|iç\s*|ic\s*|sabit\s*)?raf", text)
            if shelf_match:
                shelf_count = int(shelf_match.group(1))

        if "çekmecesiz" in text or "cekmecesiz" in text:
            drawer_count = 0
        else:
            drawer_match = re.search(r"(\d+)\s*(?:adet\s*)?(?:frenli\s*|tandem\s*|teleskopik\s*)?[çc]ekmece", text)
            if drawer_match:
                drawer_count = int(drawer_match.group(1))

        # 4. Kapak Tipi
        door_type = (
            DoorType.NONE
            if cabinet_type
            in (
                CabinetType.BOOKSHELF,
                CabinetType.DRESSER,
                CabinetType.BATHROOM_VANITY,
            )
            else DoorType.DOUBLE
        )
        if any(k in text for k in ("kapaksız", "kapaksiz", "açık raf", "acik raf")):
            door_type = DoorType.NONE
        elif any(
            k in text
            for k in (
                "kalkar kapak",
                "kalkar",
                "gazlı piston",
                "gazli piston",
                "yukarı doğru açılan",
                "yukarı açılır",
            )
        ):
            door_type = DoorType.FLAP_UP
        elif any(k in text for k in ("çift kapak", "cift kapak", "iki kapak", "2 kapak")):
            door_type = DoorType.DOUBLE
        elif any(k in text for k in ("sağ kapak", "sag kapak", "sağa açılır", "sağ menteşe", "sag mentese", "sağ menteşeli", "sag menteseli")):
            door_type = DoorType.SINGLE_RIGHT
        elif any(k in text for k in ("tek kapak", "sol kapak", "1 kapak", "tek parça", "sol menteşe", "sol mentese", "sol menteşeli", "sol menteseli")):
            door_type = DoorType.SINGLE_LEFT

        # 5. Baza Bilgisi
        if any(k in text for k in ("bazasız", "bazasiz", "tavandan tabana")):
            has_plinth = False
            plinth_height_mm = 0.0
        elif "bazalı" in text or "bazali" in text:
            has_plinth = True
            plinth_match = re.search(r"(\d+)\s*(mm|cm)?\s*baza", text)
            if plinth_match:
                plinth_height_mm = cls._to_mm(
                    plinth_match.group(1), plinth_match.group(2) or "mm"
                )

        # 6. Renk ve Malzeme
        body_color_hex = "#F4F1EA"
        door_color_hex = "#D7C4A3"
        body_material = "18mm Beyaz Suntalam"
        door_material = ""

        for color_word, (hex_val, mat_label) in cls.COLOR_MAP.items():
            body_clause = re.search(
                rf"(?:gövde|govde)\b(?:\s+\w+){{0,3}}\s+\b{color_word}\b(?!\s+(?:kapak|kapaklı|kapakli))\b|\b{color_word}\b(?:\s+\w+){{0,3}}\s+(?:gövde|govde)\b",
                text,
            )
            door_clause = re.search(
                rf"(?:üst\s+|alt\s+)?kapak\b(?:\s+\w+){{0,3}}\s+\b{color_word}\b|\b{color_word}\b(?:\s+\w+){{0,3}}\s+(?:kapak|kapaklı|kapakli)\b",
                text,
            )
            if body_clause:
                body_color_hex = hex_val
                clause_str = body_clause.group(0)
                if "mdf" in clause_str:
                    body_material = mat_label.replace("Suntalam", "MDF-Lam")
                elif "suntalam" in clause_str:
                    body_material = mat_label.replace("MDF-Lam", "Suntalam")
                else:
                    body_material = mat_label
            if door_clause:
                door_color_hex = hex_val
                clause_str = door_clause.group(0)
                if "suntalam" in clause_str:
                    door_material = mat_label.replace("MDF-Lam", "Suntalam")
                else:
                    door_material = mat_label.replace("Suntalam", "MDF-Lam")
            if not body_clause and not door_clause and color_word in text:
                body_color_hex = hex_val
                body_material = (
                    mat_label.replace("Suntalam", "MDF-Lam")
                    if "mdf" in text
                    else mat_label
                )
                if "kapak" not in text:
                    door_color_hex = hex_val

        # 7. Arkalık, Plaka Ebadı, Bağlantı Tipi ve Şantiye Rölöve Parametreleri
        back_panel_type = BackPanelType.GROOVED_8MM
        if "3 mm" in text or "3mm" in text or "duralit" in text or "çakma" in text:
            back_panel_type = BackPanelType.NAILED_3MM

        sheet_size = SheetSizeOption.SHEET_2800_2100
        if "3660" in text or "1830" in text:
            sheet_size = SheetSizeOption.SHEET_3660_1830

        fastener_type = (
            FastenerType.CABINEO_12
            if any(k in text for k in ("cabineo", "lamello", "3 eksen", "3-eksen"))
            else FastenerType.MINIFIX_DOWEL
        )
        cutting_mode = (
            CuttingMode.CNC_ROUTER
            if any(k in text for k in ("cnc router", "freze kesim", "nesting freze", "vakum"))
            else CuttingMode.PANEL_SAW
        )
        plinth_type = (
            PlinthType.ADJUSTABLE_LEGS
            if any(k in text for k in ("ayarlı ayak", "ayarli ayak", "rotil ayak", "plastik ayak"))
            else PlinthType.WOOD_PLINTH
        )
        has_baseboard_notch = any(
            k in text for k in ("süpürgelik", "supurgelik", "süpürgelik kertme")
        )
        has_column_notch = any(
            k in text for k in ("kolon kertme", "kiriş kertme", "kolon çıkıntı")
        )
        left_filler_width_mm = (
            40.0 if any(k in text for k in ("kör çıta", "kor cita", "kapama payı", "duvar boşluk")) else 0.0
        )
        right_filler_width_mm = left_filler_width_mm

        # Sınır değerlerini güvenli aralığa kırp
        width_mm = max(300.0, min(2700.0, width_mm))
        height_mm = max(300.0, min(2750.0, height_mm))
        depth_mm = max(200.0, min(900.0, depth_mm))
        shelf_count = max(0, min(12, shelf_count))
        drawer_count = max(0, min(6, drawer_count))
        appliance_niche_height_mm = max(
            0.0, min(height_mm - 260.0, appliance_niche_height_mm)
        )

        # 8. Çoklu Bölme (Zones) veya Elbise Askılığı Tespiti
        zones: list[CabinetZone] = []
        is_three_zones = any(
            k in text
            for k in ("3 bölmeli", "3 bolmeli", "üç bölmeli", "uc bolmeli", "orta bölme", "orta bolme", "ortası", "ortada")
        )
        if is_three_zones:
            zones = [
                CabinetZone(
                    name="Sol Bölme",
                    width_ratio=1.0,
                    shelf_count=4,
                    drawer_count=0,
                    has_hanging_rod=False,
                    door_type=DoorType.SINGLE_LEFT,
                ),
                CabinetZone(
                    name="Orta Bölme",
                    width_ratio=1.2,
                    shelf_count=1,
                    drawer_count=2,
                    has_hanging_rod=True,
                    door_type=DoorType.DOUBLE,
                ),
                CabinetZone(
                    name="Sağ Bölme",
                    width_ratio=1.0,
                    shelf_count=1,
                    drawer_count=0,
                    has_hanging_rod=True,
                    door_type=DoorType.SINGLE_RIGHT,
                ),
            ]
        elif any(k in text for k in ("bölmeli", "bolmeli", "dikmeli", "kolonlu")) or (
            ("sol" in text or "solu" in text or "solda" in text)
            and ("sağ" in text or "sağı" in text or "sagda" in text)
        ):
            sol_raf = 0
            sag_raf = 0
            sol_cek = 0
            sag_cek = 0
            sol_aski = False
            sag_aski = False

            m_sol_raf = re.search(r"sol[a-z\s]*?(\d+)\s*raf", text)
            if m_sol_raf:
                sol_raf = int(m_sol_raf.group(1))
            elif "sol" in text and "raf" in text:
                sol_raf = 3

            m_sol_cek = re.search(r"sol[a-z\s]*?(\d+)\s*çekmece", text)
            if m_sol_cek:
                sol_cek = int(m_sol_cek.group(1))

            if "sol" in text and any(k in text for k in ("askı", "aski", "elbise")):
                sol_aski = True

            m_sag_raf = re.search(r"sağ[a-z\s]*?(\d+)\s*raf", text)
            if m_sag_raf:
                sag_raf = int(m_sag_raf.group(1))

            m_sag_cek = re.search(r"sağ[a-z\s]*?(\d+)\s*çekmece", text)
            if m_sag_cek:
                sag_cek = int(m_sag_cek.group(1))
            elif "sağ" in text and "çekmece" in text:
                sag_cek = 2

            if "sağ" in text and any(k in text for k in ("askı", "aski", "elbise")):
                sag_aski = True

            if not sol_aski and not sag_aski and any(k in text for k in ("askı", "aski", "elbise")):
                sag_aski = True

            zones = [
                CabinetZone(
                    name="Sol Bölme",
                    width_ratio=1.0,
                    shelf_count=sol_raf,
                    drawer_count=sol_cek,
                    has_hanging_rod=sol_aski,
                    door_type=DoorType.SINGLE_LEFT,
                ),
                CabinetZone(
                    name="Sağ Bölme",
                    width_ratio=1.0,
                    shelf_count=sag_raf,
                    drawer_count=sag_cek,
                    has_hanging_rod=sag_aski,
                    door_type=DoorType.SINGLE_RIGHT,
                ),
            ]
        elif any(k in text for k in ("askılık", "askilik", "askı borusu", "aski borusu", "elbise askı")):
            zones = [
                CabinetZone(
                    name="Ana Askı Bölmesi",
                    width_ratio=1.0,
                    shelf_count=1 if "raf" not in text else shelf_count,
                    drawer_count=drawer_count,
                    has_hanging_rod=True,
                    door_type=door_type,
                )
            ]

        # 9. Çatı Eğimi (Merdiven Altı / Mansard Çatı) Tespiti
        has_slope = False
        slope_side = "left"
        slope_start_height_mm = 1200.0
        if any(
            k in text
            for k in (
                "merdiven altı",
                "merdiven alti",
                "çatı eğimi",
                "cati egimi",
                "tavan eğimi",
                "tavan egimi",
                "mansard",
                "eğimli dolap",
                "egimli dolap",
                "eğimli tavan",
                "egimli tavan",
                "çatı katı",
                "cati kati",
                "eğimli",
                "egimli",
            )
        ):
            has_slope = True
            if any(k in text for k in ("sağa eğim", "saga egim", "sağ eğim", "sag egim", "sağ alçak", "sag alcak")):
                slope_side = "right"
            elif any(k in text for k in ("sola eğim", "sola egim", "sol eğim", "sol egim", "sol alçak", "sol alcak")):
                slope_side = "left"
            elif any(k in text for k in ("sağ", "sag")) and not any(k in text for k in ("sol",)):
                slope_side = "right"
            else:
                slope_side = "left"

            m_slope_h = (
                re.search(
                    r"(?:başlangı[çc][ıi]?|baslangı[çc][ıi]?|alçak|kısa\s*taraf|başlayan)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?",
                    text,
                )
                or re.search(
                    r"(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?(?:'den|den|'dan|dan)?\s*(?:başlayan|alçalan|yükselen|başlayıp|başlangı[çc][ıi]?|baslangı[çc][ıi]?)",
                    text,
                )
                or re.search(
                    r"alçak\s*(?:tarafı?|dikme|kenar)\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?",
                    text,
                )
            )
            if m_slope_h:
                slope_start_height_mm = cls._to_mm(m_slope_h.group(1), m_slope_h.group(2))
            else:
                slope_start_height_mm = max(400.0, height_mm - 600.0)

        # 10. L-Köşe Modülü Tespiti
        is_corner_module = any(
            k in text
            for k in (
                "l-köşe",
                "l köşe",
                "l-kose",
                "l kose",
                "köşe dolap",
                "kose dolap",
                "köşe modül",
                "kose modul",
            )
        )
        corner_blind_width_mm = 100.0
        blind_match = re.search(r"(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:kör\s*kapama|kör\s*panel|kapatma)", text)
        if blind_match:
            corner_blind_width_mm = cls._to_mm(blind_match.group(1), blind_match.group(2))

        return CabinetConfig(
            name=name,
            cabinet_type=cabinet_type,
            width_mm=width_mm,
            height_mm=height_mm,
            depth_mm=depth_mm,
            shelf_count=shelf_count,
            door_type=door_type,
            drawer_count=drawer_count,
            has_plinth=has_plinth,
            plinth_height_mm=plinth_height_mm,
            appliance_niche_height_mm=appliance_niche_height_mm,
            niche_height_mm=niche_height_mm,
            niche_bottom_offset_mm=niche_bottom_offset_mm,
            niche_color_hex=niche_color_hex or None,
            niche_back_open=niche_back_open,
            body_material=body_material,
            door_material=door_material,
            body_color_hex=body_color_hex,
            door_color_hex=door_color_hex,
            front_pvc_thickness_mm=2.0,
            hidden_pvc_thickness_mm=0.4,
            back_panel_type=back_panel_type,
            sheet_size=sheet_size,
            fastener_type=fastener_type,
            cutting_mode=cutting_mode,
            plinth_type=plinth_type,
            has_baseboard_notch=has_baseboard_notch,
            has_column_notch=has_column_notch,
            left_filler_width_mm=left_filler_width_mm,
            right_filler_width_mm=right_filler_width_mm,
            zones=zones,
            has_slope=has_slope,
            slope_side=slope_side,
            slope_start_height_mm=slope_start_height_mm,
            is_corner_module=is_corner_module,
            corner_blind_width_mm=corner_blind_width_mm,
        )

    @classmethod
    def parse_prompt(
        cls, prompt: str, api_key_override: str | None = None
    ) -> CabinetConfig:
        """Doğal dil istemini Gemini API (varsa) veya deterministik ayrıştırıcı ile CabinetConfig'e çevirir."""
        settings = get_settings()
        api_key = (api_key_override or settings.gemini_api_key or "").strip()
        if api_key:
            candidate_models = [
                settings.gemini_model,
                "gemini-2.5-flash",
                "gemini-2.0-flash",
            ]
            models_to_try: list[str] = []
            for m in candidate_models:
                if m and m not in models_to_try:
                    models_to_try.append(m)

            client = genai.Client(api_key=api_key)
            for model_name in models_to_try:
                try:
                    gen_config = types.GenerateContentConfig(
                        system_instruction=cls.SYSTEM_INSTRUCTION,
                        response_mime_type="application/json",
                        response_schema=CabinetParseSchema,
                        temperature=0.0,
                    )
                    if model_name.startswith("gemini-2.5"):
                        gen_config.thinking_config = types.ThinkingConfig(
                            thinking_budget=0
                        )
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=gen_config,
                    )
                    if response.text:
                        parsed = CabinetParseSchema.model_validate_json(response.text)
                        return cls._parsed_schema_to_config(parsed)
                except Exception as exc:
                    logger.warning(
                        "Gemini API modeli (%s) ayrıştırmada başarısız oldu: %s",
                        model_name,
                        exc,
                    )
                    if any(err in str(exc) for err in ("RESOURCE_EXHAUSTED", "429", "QuotaFailure", "limit exceeded")):
                        logger.info("Gemini kota sınırı algılandı, doğrudan kural tabanlı ayrıştırıcıya geçiliyor.")
                        break
                    continue

        return cls._deterministic_rule_parse(prompt)

    @classmethod
    def _parsed_schema_to_config(cls, parsed: CabinetParseSchema) -> CabinetConfig:
        """Gemini'den dönen CabinetParseSchema nesnesini sınır kontrolleriyle CabinetConfig'e çevirir."""
        width_mm = max(300.0, min(2700.0, parsed.width_mm))
        height_mm = max(300.0, min(2750.0, parsed.height_mm))
        depth_mm = max(200.0, min(900.0, parsed.depth_mm))
        shelf_count = max(0, min(12, parsed.shelf_count))
        drawer_count = max(0, min(6, parsed.drawer_count))
        drawer_front_height = max(
            120.0, min(350.0, parsed.drawer_front_height_mm or 180.0)
        )
        raw_niche_h = max(
            float(parsed.niche_height_mm or 0.0),
            float(parsed.appliance_niche_height_mm or 0.0),
        )
        niche_offset = max(0.0, float(parsed.niche_bottom_offset_mm or 0.0))
        is_bottom_niche = raw_niche_h > 0 and niche_offset <= 0
        clamped_niche_h = (
            max(0.0, min(height_mm - 260.0, raw_niche_h))
            if is_bottom_niche
            else (
                max(0.0, min(height_mm - niche_offset - 180.0, raw_niche_h))
                if raw_niche_h > 0
                else 0.0
            )
        )
        has_plinth = False if is_bottom_niche else parsed.has_plinth

        zones: list[CabinetZone] = []
        for z in parsed.zones:
            zones.append(
                CabinetZone(
                    name=z.name,
                    width_ratio=max(0.1, z.width_ratio),
                    width_mm=max(0.0, z.width_mm),
                    shelf_count=max(0, min(12, z.shelf_count)),
                    door_type=z.door_type,
                    drawer_count=max(0, min(6, z.drawer_count)),
                    drawer_front_height_mm=z.drawer_front_height_mm,
                    has_hanging_rod=z.has_hanging_rod,
                    appliance_niche_height_mm=z.appliance_niche_height_mm or z.niche_height_mm,
                    niche_height_mm=z.niche_height_mm or z.appliance_niche_height_mm,
                    niche_bottom_offset_mm=z.niche_bottom_offset_mm,
                    niche_color_hex=z.niche_color_hex or None,
                    niche_back_open=z.niche_back_open,
                    door_color_hex=z.door_color_hex,
                )
            )

        return CabinetConfig(
            name=parsed.name,
            cabinet_type=parsed.cabinet_type,
            width_mm=width_mm,
            height_mm=height_mm,
            depth_mm=depth_mm,
            shelf_count=shelf_count,
            door_type=parsed.door_type,
            drawer_count=drawer_count,
            drawer_front_height_mm=drawer_front_height,
            has_plinth=has_plinth,
            plinth_height_mm=parsed.plinth_height_mm if has_plinth else 0.0,
            appliance_niche_height_mm=clamped_niche_h,
            niche_height_mm=clamped_niche_h,
            niche_bottom_offset_mm=niche_offset,
            niche_color_hex=parsed.niche_color_hex or None,
            niche_back_open=parsed.niche_back_open,
            body_material=parsed.body_material,
            door_material=parsed.door_material or "",
            body_color_hex=parsed.body_color_hex,
            door_color_hex=parsed.door_color_hex,
            front_pvc_thickness_mm=parsed.front_pvc_thickness_mm,
            hidden_pvc_thickness_mm=parsed.hidden_pvc_thickness_mm,
            back_panel_type=parsed.back_panel_type,
            sheet_size=parsed.sheet_size,
            fastener_type=parsed.fastener_type,
            cutting_mode=parsed.cutting_mode,
            plinth_type=parsed.plinth_type,
            has_baseboard_notch=parsed.has_baseboard_notch,
            baseboard_notch_height_mm=parsed.baseboard_notch_height_mm,
            baseboard_notch_depth_mm=parsed.baseboard_notch_depth_mm,
            has_column_notch=parsed.has_column_notch,
            column_notch_width_mm=parsed.column_notch_width_mm,
            column_notch_depth_mm=parsed.column_notch_depth_mm,
            left_filler_width_mm=parsed.left_filler_width_mm,
            right_filler_width_mm=parsed.right_filler_width_mm,
            additional_modules=[],
            zones=zones,
            has_slope=parsed.has_slope,
            slope_side=parsed.slope_side if parsed.slope_side in ("left", "right") else "left",
            slope_start_height_mm=max(300.0, min(height_mm, parsed.slope_start_height_mm)),
            slope_angle_deg=parsed.slope_angle_deg,
            is_corner_module=parsed.is_corner_module,
            corner_angle_deg=parsed.corner_angle_deg,
            corner_blind_width_mm=max(50.0, min(600.0, parsed.corner_blind_width_mm)),
        )

    @classmethod
    def parse_sketch(
        cls,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
        prompt: str = "",
        api_key_override: str | None = None,
    ) -> CabinetConfig:
        """Kullanıcının kağıt üzerine el ile çizdiği ölçülü dolap eskizini veya rölöve fotoğrafını CabinetConfig'e dönüştürür."""
        settings = get_settings()
        api_key = (api_key_override or settings.gemini_api_key or "").strip()
        user_prompt = (
            prompt.strip()
            or "Bu mobilya / dolap eskizindeki veya rölöve krokisindeki dış ölçüleri, "
            "iç bölmeleri, rafları, çekmeceleri, nişleri ve kapakları dikkatle analiz et ve parametreleri çıkar."
        )

        if api_key:
            client = genai.Client(api_key=api_key)
            candidate_models = [
                settings.gemini_model.strip(),
                "gemini-2.5-flash",
                "gemini-2.0-flash",
            ]
            models_to_try: list[str] = []
            for m in candidate_models:
                if m and m not in models_to_try:
                    models_to_try.append(m)

            image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

            for model_name in models_to_try:
                try:
                    gen_config = types.GenerateContentConfig(
                        system_instruction=cls.SYSTEM_INSTRUCTION
                        + " Görseldeki el yazısı veya teknik çizim ölçülerini (genişlik, yükseklik, derinlik) dikkatle oku. Ölçü birimleri cm ise mm'ye çevir.",
                        response_mime_type="application/json",
                        response_schema=CabinetParseSchema,
                        temperature=0.0,
                    )
                    if model_name.startswith("gemini-2.5"):
                        gen_config.thinking_config = types.ThinkingConfig(
                            thinking_budget=0
                        )

                    response = client.models.generate_content(
                        model=model_name,
                        contents=[image_part, user_prompt],
                        config=gen_config,
                    )
                    if response.text:
                        parsed = CabinetParseSchema.model_validate_json(response.text)
                        return cls._parsed_schema_to_config(parsed)
                except Exception as exc:
                    logger.warning(
                        "Gemini Vision modeli (%s) eskiz ayrıştırmada hata verdi: %s",
                        model_name,
                        exc,
                    )
                    continue

        # API anahtarı yoksa veya Vision başarısızsa eşlik eden metin isteminden deterministik parse
        if prompt.strip():
            return cls._deterministic_rule_parse(prompt)

        return CabinetConfig(
            name="Eskizden Çıkarılan Dolap",
            cabinet_type=CabinetType.WARDROBE,
            width_mm=900.0,
            height_mm=2100.0,
            depth_mm=580.0,
            shelf_count=3,
            door_type=DoorType.DOUBLE,
            drawer_count=2,
            drawer_front_height_mm=180.0,
            has_plinth=True,
            plinth_height_mm=80.0,
            appliance_niche_height_mm=0.0,
            body_material="18mm Beyaz Suntalam",
            door_material="18mm Doğal Meşe Suntalam",
            body_color_hex="#F4F1EA",
            door_color_hex="#C89F70",
            front_pvc_thickness_mm=2.0,
            hidden_pvc_thickness_mm=0.4,
            back_panel_type=BackPanelType.GROOVED_8MM,
            sheet_size=SheetSizeOption.SHEET_2800_2100,
            additional_modules=[],
        )

