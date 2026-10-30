import type {
  CabinetConfig,
  ChatMessage,
  RevisionResponse,
  RevisionResponseData,
} from "../types/cabinet";
import {
  getStoredGeminiApiKey,
  normalizeGeminiConfig,
  RESPONSE_SCHEMA,
  type GeminiRawConfig,
} from "./geminiClient";

const API_BASE = "/api/v1";

const isLocalHost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function parseUnit(rawVal: string, rawUnit?: string): number {
  const num = parseFloat(rawVal.replace(",", "."));
  if (Number.isNaN(num)) return 0;
  const unit = (rawUnit || "").toLowerCase().trim();
  if (unit === "m") return num * 1000.0;
  if (unit === "cm") return num * 10.0;
  if (unit === "mm") return num;
  if (num < 10.0) return num * 1000.0;
  if (num <= 300.0) return num * 10.0;
  return num;
}

export function computeCabinetDiff(
  oldCfg: CabinetConfig,
  newCfg: CabinetConfig
): string[] {
  const diffs: string[] = [];

  if (oldCfg.width_mm !== newCfg.width_mm) {
    diffs.push(`Genişlik: ${oldCfg.width_mm} mm ➔ ${newCfg.width_mm} mm`);
  }
  if (oldCfg.height_mm !== newCfg.height_mm) {
    diffs.push(`Yükseklik: ${oldCfg.height_mm} mm ➔ ${newCfg.height_mm} mm`);
  }
  if (oldCfg.depth_mm !== newCfg.depth_mm) {
    diffs.push(`Derinlik: ${oldCfg.depth_mm} mm ➔ ${newCfg.depth_mm} mm`);
  }
  if (oldCfg.shelf_count !== newCfg.shelf_count) {
    diffs.push(`Raf Sayısı: ${oldCfg.shelf_count} ➔ ${newCfg.shelf_count}`);
  }
  if (oldCfg.drawer_count !== newCfg.drawer_count) {
    diffs.push(`Çekmece: ${oldCfg.drawer_count} ➔ ${newCfg.drawer_count}`);
  }
  if (oldCfg.door_type !== newCfg.door_type) {
    diffs.push(`Kapak Tipi: ${oldCfg.door_type} ➔ ${newCfg.door_type}`);
  }

  const oldNicheH = oldCfg.niche_height_mm ?? oldCfg.appliance_niche_height_mm ?? 0;
  const newNicheH = newCfg.niche_height_mm ?? newCfg.appliance_niche_height_mm ?? 0;
  if (oldNicheH !== newNicheH) {
    diffs.push(`Açık Niş Boyu: ${oldNicheH} mm ➔ ${newNicheH} mm`);
  }
  if ((oldCfg.niche_bottom_offset_mm ?? 0) !== (newCfg.niche_bottom_offset_mm ?? 0)) {
    diffs.push(`Niş Yerden Kotu: ${oldCfg.niche_bottom_offset_mm ?? 0} mm ➔ ${newCfg.niche_bottom_offset_mm ?? 0} mm`);
  }
  if (Boolean(oldCfg.niche_back_open) !== Boolean(newCfg.niche_back_open)) {
    diffs.push(`Niş Arkalık Durumu: ${newCfg.niche_back_open ? "Açık" : "Kapalı"}`);
  }

  if (oldCfg.has_plinth !== newCfg.has_plinth) {
    diffs.push(`Baza / Ayak: ${newCfg.has_plinth ? `${newCfg.plinth_height_mm} mm Baza` : "Bazasız (Tavandan Tabana)"}`);
  }
  if (oldCfg.door_color_hex !== newCfg.door_color_hex) {
    diffs.push(`Kapak Rengi: ${oldCfg.door_color_hex} ➔ ${newCfg.door_color_hex}`);
  }
  if (oldCfg.body_color_hex !== newCfg.body_color_hex) {
    diffs.push(`Gövde Rengi: ${oldCfg.body_color_hex} ➔ ${newCfg.body_color_hex}`);
  }
  if (oldCfg.door_material !== newCfg.door_material && newCfg.door_material) {
    diffs.push(`Kapak Malzemesi: ${newCfg.door_material}`);
  }
  if (oldCfg.body_material !== newCfg.body_material) {
    diffs.push(`Gövde Malzemesi: ${newCfg.body_material}`);
  }
  if (oldCfg.fastener_type !== newCfg.fastener_type && newCfg.fastener_type) {
    diffs.push(`Bağlantı: ${oldCfg.fastener_type ?? "minifix_dowel"} ➔ ${newCfg.fastener_type}`);
  }
  if (oldCfg.cutting_mode !== newCfg.cutting_mode && newCfg.cutting_mode) {
    diffs.push(`Kesim Modu: ${oldCfg.cutting_mode ?? "panel_saw"} ➔ ${newCfg.cutting_mode}`);
  }

  const oldZonesLen = oldCfg.zones?.length ?? 0;
  const newZonesLen = newCfg.zones?.length ?? 0;
  if (oldZonesLen !== newZonesLen) {
    diffs.push(`Dikey Bölmeler: ${oldZonesLen} Bölme ➔ ${newZonesLen} Bölme`);
  }

  if (Boolean(oldCfg.has_slope) !== Boolean(newCfg.has_slope)) {
    if (newCfg.has_slope) {
      const side = newCfg.slope_side === "left" ? "Sol" : "Sağ";
      diffs.push(`Çatı Eğimi: Aktif (${side} Alçak ${(newCfg.slope_start_height_mm ?? 1200).toFixed(0)} mm)`);
    } else {
      diffs.push("Çatı Eğimi: İptal (Düz Tavan)");
    }
  }
  if (Boolean(oldCfg.is_corner_module) !== Boolean(newCfg.is_corner_module)) {
    diffs.push(`L-Köşe Modülü: ${newCfg.is_corner_module ? "Aktif (90° Kör Panelli)" : "İptal"}`);
  }

  return diffs;
}

export function mutateCabinetDeterministic(
  currentConfig: CabinetConfig,
  instruction: string
): RevisionResponseData {
  const text = instruction.toLowerCase().trim();
  const updated: CabinetConfig = JSON.parse(JSON.stringify(currentConfig));
  const reasons: string[] = [];

  // 1. Genişlik
  const mWAbs =
    text.match(/geni[şs]li[ğg]i(?:ni)?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yap|ayarla|olsun)/) ||
    text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*geni[şs]li[ğg]inde\s*(?:yap|olsun)/);
  if (mWAbs) {
    const val = parseUnit(mWAbs[1], mWAbs[2]);
    updated.width_mm = clamp(val, 300, 2700, updated.width_mm);
    reasons.push(`Genişlik ${val.toFixed(0)} mm yapıldı`);
  } else {
    const mWInc = text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:daha\s*)?(?:geni[şs]let|büyüt|art[ıi]r)/);
    if (mWInc) {
      const delta = parseUnit(mWInc[1], mWInc[2]);
      updated.width_mm = clamp(updated.width_mm + delta, 300, 2700, updated.width_mm);
      reasons.push(`Genişlik ${delta.toFixed(0)} mm artırıldı`);
    }
    const mWDec = text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:daha\s*)?(?:daralt|küçült|azalt)/);
    if (mWDec) {
      const delta = parseUnit(mWDec[1], mWDec[2]);
      updated.width_mm = clamp(updated.width_mm - delta, 300, 2700, updated.width_mm);
      reasons.push(`Genişlik ${delta.toFixed(0)} mm daraltıldı`);
    }
  }

  // 2. Yükseklik / Boy
  const mHAbs =
    text.match(/yüksekli[ğg]i(?:ni)?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yap|ayarla|olsun)/) ||
    text.match(/boyu(?:nu)?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yap|ayarla|olsun)/) ||
    text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*yüksekli[ğg]inde\s*(?:yap|olsun)/);
  if (mHAbs) {
    const val = parseUnit(mHAbs[1], mHAbs[2]);
    updated.height_mm = clamp(val, 400, 3000, updated.height_mm);
    reasons.push(`Yükseklik ${val.toFixed(0)} mm yapıldı`);
  } else {
    const mHInc = text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:daha\s*)?(?:yükselt|uzat|art[ıi]r)/);
    if (mHInc) {
      const delta = parseUnit(mHInc[1], mHInc[2]);
      updated.height_mm = clamp(updated.height_mm + delta, 400, 3000, updated.height_mm);
      reasons.push(`Yükseklik ${delta.toFixed(0)} mm yükseltildi`);
    }
    const mHDec = text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:daha\s*)?(?:alçalt|k[ıi]salt|azalt)/);
    if (mHDec) {
      const delta = parseUnit(mHDec[1], mHDec[2]);
      updated.height_mm = clamp(updated.height_mm - delta, 400, 3000, updated.height_mm);
      reasons.push(`Yükseklik ${delta.toFixed(0)} mm alçaltıldı`);
    }
  }

  // 3. Derinlik
  const mDAbs =
    text.match(/derinli[ğg]i(?:ni)?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yap|ayarla|olsun)/) ||
    text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*derinli[ğg]inde\s*(?:yap|olsun)/);
  if (mDAbs) {
    const val = parseUnit(mDAbs[1], mDAbs[2]);
    updated.depth_mm = clamp(val, 200, 900, updated.depth_mm);
    reasons.push(`Derinlik ${val.toFixed(0)} mm yapıldı`);
  }

  // 4. Çekmece
  const mDrwAdd = text.match(/(?:alt[ıi]na|altına|içine)?\s*(\d+)\s*(?:tane|adet)?\s*çekmece\s*(?:ekle|koy|yap)/);
  if (mDrwAdd) {
    const count = parseInt(mDrwAdd[1], 10);
    updated.drawer_count = clamp(updated.drawer_count + count, 0, 6, 0);
    reasons.push(`${count} adet çekmece eklendi`);
  } else if (text.includes("çekmece ekle") || text.includes("çekmeceli yap")) {
    updated.drawer_count = updated.drawer_count > 0 ? updated.drawer_count : 2;
    reasons.push("Çekmece eklendi");
  } else if (text.includes("çekmeceleri kaldır") || text.includes("çekmecesiz")) {
    updated.drawer_count = 0;
    reasons.push("Çekmeceler kaldırıldı");
  }

  // 5. Raflar
  const mShfAdd = text.match(/(\d+)\s*(?:tane|adet)?\s*raf\s*(?:daha\s*)?(?:ekle|koy|art[ıi]r)/);
  if (mShfAdd) {
    const count = parseInt(mShfAdd[1], 10);
    updated.shelf_count = clamp(updated.shelf_count + count, 0, 12, 0);
    reasons.push(`${count} adet raf eklendi`);
  } else {
    const mShfSet = text.match(/(\d+)\s*(?:rafl[ıi]|raf\s*yap|adet\s*raf)/);
    if (mShfSet) {
      const count = parseInt(mShfSet[1], 10);
      updated.shelf_count = clamp(count, 0, 12, 0);
      reasons.push(`Raf sayısı ${count} yapıldı`);
    } else if (text.includes("rafsız") || text.includes("rafları kaldır")) {
      updated.shelf_count = 0;
      reasons.push("Raflar kaldırıldı");
    }
  }

  // 6. Kapak Tipi
  if (text.includes("kalkar kapak") || text.includes("pistonlu kapak") || text.includes("flap")) {
    updated.door_type = "flap_up";
    reasons.push("Üstten kalkar kapak (gazlı pistonlu) olarak ayarlandı");
  } else if (text.includes("çift kapak") || text.includes("iki kapak")) {
    updated.door_type = "double";
    reasons.push("Çift kapaklı yapıldı");
  } else if (text.includes("tek kapak") || text.includes("sol kapak")) {
    updated.door_type = "single_left";
    reasons.push("Tek kapaklı yapıldı");
  } else if (text.includes("sağ kapak")) {
    updated.door_type = "single_right";
    reasons.push("Tek sağ kapaklı yapıldı");
  } else if (text.includes("kapaksız") || text.includes("açık dolap") || text.includes("açık raf")) {
    updated.door_type = "none";
    reasons.push("Kapaklar kaldırıldı (açık dolap)");
  }

  // 7. Niş / Kahve Barı / Ankastre
  if (
    text.includes("kahve") ||
    text.includes("kahve köşesi") ||
    text.includes("kahve barı") ||
    text.includes("orta niş") ||
    text.includes("açık niş")
  ) {
    const mNicheH = text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:boyunda|yüksekliğinde|açık\s*niş)/);
    const nicheH = mNicheH ? parseUnit(mNicheH[1], mNicheH[2]) : 450.0;
    updated.niche_height_mm = nicheH;
    updated.appliance_niche_height_mm = nicheH;
    updated.niche_bottom_offset_mm = updated.niche_bottom_offset_mm || 850.0;
    if (text.includes("ahşap niş") || text.includes("ahsap")) {
      updated.niche_color_hex = "#9C6644";
    }
    if (text.includes("arkası açık") || text.includes("arkalıksız") || text.includes("priz")) {
      updated.niche_back_open = true;
    }
    reasons.push(`Orta açık niş / kahve köşesi (${nicheH.toFixed(0)} mm) eklendi`);
  } else if (text.includes("fırın") || text.includes("mikrodalga") || text.includes("ankastre")) {
    updated.niche_height_mm = 595.0;
    updated.appliance_niche_height_mm = 595.0;
    updated.niche_bottom_offset_mm = 850.0;
    updated.niche_back_open = true;
    reasons.push("Ankastre fırın nişi (595 mm) tanımlandı");
  } else if (text.includes("buzdolabı")) {
    const mFrH = text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:boyunda|yüksekliğinde)?\s*buzdolabı/);
    const frH = mFrH ? parseUnit(mFrH[1], mFrH[2]) : 1850.0;
    updated.appliance_niche_height_mm = frH;
    updated.niche_height_mm = frH;
    updated.niche_bottom_offset_mm = 0.0;
    updated.has_plinth = false;
    updated.door_type = "flap_up";
    reasons.push(`Buzdolabı alt nişi (${frH.toFixed(0)} mm) ve üst kalkar kapak ayarlandı`);
  }

  // 8. Baza
  if (text.includes("bazasız") || text.includes("tavandan tabana") || text.includes("baza iptal")) {
    updated.has_plinth = false;
    updated.plinth_height_mm = 0.0;
    reasons.push("Baza kaldırıldı (tavandan tabana)");
  } else if (text.includes("bazalı") || text.includes("baza ekle")) {
    updated.has_plinth = true;
    updated.plinth_height_mm = updated.plinth_height_mm > 0 ? updated.plinth_height_mm : 80.0;
    reasons.push("Baza eklendi");
  }

  // 9. Renkler
  const colorMap: Record<string, string> = {
    antrasit: "#374151",
    siyah: "#1E293B",
    beyaz: "#F4F1EA",
    meşe: "#C89F70",
    mese: "#C89F70",
    ceviz: "#6E472B",
    gri: "#94A3B8",
    kaşmir: "#D6CEC2",
    kasmir: "#D6CEC2",
    krem: "#EDE8D0",
    lacivert: "#1E3A8A",
    yeşil: "#2D5A27",
    yesil: "#2D5A27",
  };

  for (const [colorName, hex] of Object.entries(colorMap)) {
    if (text.includes(`kapakları ${colorName}`) || text.includes(`kapak ${colorName}`) || text.includes(`${colorName} kapak`)) {
      updated.door_color_hex = hex;
      reasons.push(`Kapak rengi ${colorName} (${hex}) olarak güncellendi`);
    } else if (text.includes(`gövdeyi ${colorName}`) || text.includes(`gövde ${colorName}`) || text.includes(`${colorName} gövde`)) {
      updated.body_color_hex = hex;
      reasons.push(`Gövde rengi ${colorName} (${hex}) olarak güncellendi`);
    } else if (text.includes(`rengini ${colorName}`) || text.includes(`${colorName} yap`)) {
      updated.door_color_hex = hex;
      reasons.push(`Renk ${colorName} (${hex}) yapıldı`);
    }
  }

  // 10. Süpürgelik, Kolon Kertmesi, Kör Çıtalar ve Bağlantı Donanımı
  if (text.includes("süpürgelik") || text.includes("supurgelik")) {
    updated.has_baseboard_notch = true;
    updated.baseboard_notch_height_mm = 80.0;
    updated.baseboard_notch_depth_mm = 15.0;
    reasons.push("Arka süpürgelik L-kertmesi (80x15 mm) aktif edildi");
  }
  if (text.includes("kolon kertmesi") || text.includes("kiriş kertmesi")) {
    updated.has_column_notch = true;
    updated.column_notch_width_mm = 120.0;
    updated.column_notch_depth_mm = 120.0;
    reasons.push("Arka kolon kertmesi (120x120 mm) aktif edildi");
  }
  if (text.includes("kör çıta") || text.includes("kor cita") || text.includes("rölöve")) {
    updated.left_filler_width_mm = 40.0;
    updated.right_filler_width_mm = 40.0;
    reasons.push("Sağ ve sol rölöve kör çıtaları (40 mm) eklendi");
  }
  if (text.includes("ayarlı ayak") || text.includes("plastik ayak")) {
    updated.plinth_type = "adjustable_legs";
    reasons.push("Ayarlı plastik ayak ve klipsli baza sistemine geçildi");
  }
  if (text.includes("cabineo") || text.includes("lamello") || text.includes("3 eksen")) {
    updated.fastener_type = "cabineo_12";
    reasons.push("Bağlantı sistemi Lamello Cabineo 12 (3-Eksen CNC) yapıldı");
  } else if (text.includes("minifiks") || text.includes("minifix")) {
    updated.fastener_type = "minifix_dowel";
    reasons.push("Bağlantı sistemi Minifiks + Kavela yapıldı");
  }
  if (text.includes("cnc router") || text.includes("freze kesim")) {
    updated.cutting_mode = "cnc_router";
    reasons.push("Kesim modu CNC Router Freze olarak ayarlandı");
  }

  // 10b. Çoklu Dikey Bölme (Zones) & Askılık
  if (text.includes("bölmeleri kaldır") || text.includes("tek bölmeli yap") || text.includes("tek gövde yap")) {
    updated.zones = [];
    reasons.push("İç dikmeler kaldırıldı, tek gövdeye dönüştürüldü");
  } else if (text.includes("3 bölmeli yap") || text.includes("üç bölmeli yap") || text.includes("3 bölmeye ayır")) {
    updated.zones = [
      {
        id: "z_1",
        name: "Sol Bölme",
        width_ratio: 1.0,
        shelf_count: 4,
        drawer_count: 0,
        has_hanging_rod: false,
        door_type: "single_left",
      },
      {
        id: "z_2",
        name: "Orta Bölme",
        width_ratio: 1.2,
        shelf_count: 1,
        drawer_count: 2,
        has_hanging_rod: true,
        door_type: "double",
      },
      {
        id: "z_3",
        name: "Sağ Bölme",
        width_ratio: 1.0,
        shelf_count: 1,
        drawer_count: 0,
        has_hanging_rod: true,
        door_type: "single_right",
      },
    ];
    reasons.push("Dolap içi 3 dikey bölmeye (Sol Raflı, Orta Askı+Çekmece, Sağ Askılı) ayrıldı");
  } else if (text.includes("2 bölmeli yap") || text.includes("iki bölmeli yap") || text.includes("2 bölmeye ayır") || text.includes("ortadan böl")) {
    updated.zones = [
      {
        id: "z_1",
        name: "Sol Bölme",
        width_ratio: 1.0,
        shelf_count: 4,
        drawer_count: 0,
        has_hanging_rod: false,
        door_type: "single_left",
      },
      {
        id: "z_2",
        name: "Sağ Bölme",
        width_ratio: 1.0,
        shelf_count: 1,
        drawer_count: 2,
        has_hanging_rod: true,
        door_type: "single_right",
      },
    ];
    reasons.push("Dolap içi 2 dikey bölmeye (Sol 4 Raflı, Sağ Askılıklı ve 2 Çekmeceli) ayrıldı");
  } else if (text.includes("askılık ekle") || text.includes("askı borusu ekle") || text.includes("elbise askısı ekle") || text.includes("askılıklı yap")) {
    if (updated.zones && updated.zones.length > 0) {
      updated.zones[updated.zones.length - 1].has_hanging_rod = true;
    } else {
      updated.zones = [
        {
          id: "z_1",
          name: "Ana Askı Bölmesi",
          width_ratio: 1.0,
          shelf_count: 1,
          drawer_count: updated.drawer_count ?? 0,
          has_hanging_rod: true,
          door_type: updated.door_type ?? "double",
        },
      ];
    }
    reasons.push("Elbise askı borusu eklendi");
  }

  // 11. Çatı Eğimi (Mansard Çatı / Merdiven Altı)
  if (
    text.includes("eğimi kaldır") ||
    text.includes("egimi kaldir") ||
    text.includes("çatı eğimini kaldır") ||
    text.includes("düz tavan")
  ) {
    updated.has_slope = false;
    reasons.push("Çatı eğimi kaldırıldı (düz tavan)");
  } else if (
    text.includes("çatı") ||
    text.includes("cati") ||
    text.includes("merdiven") ||
    text.includes("eğim") ||
    text.includes("egim") ||
    text.includes("mansard")
  ) {
    updated.has_slope = true;
    if (text.includes("sağ") || text.includes("sag")) {
      updated.slope_side = "right";
    } else {
      updated.slope_side = "left";
    }
    const mSlH =
      text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?(?:'den|den|'dan|dan)?\s*(?:başlayan|alçalan|yükselen|başlayıp)/) ||
      text.match(/alçak\s*(?:tarafı?|dikme|kenar)\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/);
    if (mSlH) {
      updated.slope_start_height_mm = parseUnit(mSlH[1], mSlH[2]);
    } else {
      updated.slope_start_height_mm = Math.max(400, updated.height_mm - 600);
    }
    const deltaH = Math.abs(updated.height_mm - updated.slope_start_height_mm);
    updated.slope_angle_deg =
      Math.round(Math.atan2(deltaH, Math.max(1, updated.width_mm)) * (180 / Math.PI) * 10) / 10;
    reasons.push(
      `Çatı / merdiven eğimi (${updated.slope_side === "left" ? "Sol" : "Sağ"} başlangıç: ${updated.slope_start_height_mm.toFixed(0)} mm) uygulandı`
    );
  }

  // 12. L-Köşe Modülü
  if (text.includes("köşe iptal") || text.includes("düz modül yap")) {
    updated.is_corner_module = false;
    reasons.push("Köşe dönüşü iptal edildi");
  } else if (
    text.includes("l-köşe") ||
    text.includes("l köşe") ||
    text.includes("l-kose") ||
    text.includes("köşe modül") ||
    text.includes("köşe dolap")
  ) {
    updated.is_corner_module = true;
    updated.corner_blind_width_mm = 100.0;
    updated.corner_angle_deg = 90.0;
    reasons.push("L-Köşe 90° dönüş ve kör kapama paneli uygulandı");
  }

  const diffs = computeCabinetDiff(currentConfig, updated);
  const assistantMessage =
    reasons.length > 0
      ? `Talebiniz doğrultusunda değişiklikler uygulandı:\n- ${reasons.join("\n- ")}`
      : "Belirttiğiniz revizyon mevcut parametreler korunarak uygulandı.";

  return {
    updated_config: updated,
    assistant_message: assistantMessage,
    diff_summary: diffs,
  };
}

export async function reviseCabinet(
  currentConfig: CabinetConfig,
  instruction: string,
  history: ChatMessage[] = [],
  customApiKey?: string
): Promise<RevisionResponseData> {
  const apiKey = (customApiKey || getStoredGeminiApiKey() || "").trim();
  const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    reqHeaders["x-gemini-api-key"] = apiKey;
  }

  // 1. FastAPI /api/v1/revise (yerel veya backend proxy)
  if (isLocalHost) {
    try {
      const res = await fetch(`${API_BASE}/revise`, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify({
          current_config: currentConfig,
          instruction,
          history: history.map((h) => ({ role: h.role, content: h.content })),
        }),
      });
      if (res.ok) {
        const payload = (await res.json()) as RevisionResponse;
        if (payload.success && payload.data?.updated_config) {
          return payload.data;
        }
      }
    } catch {
      // Backend erişilemezse bir sonraki aşamaya geç
    }
  }

  // 2. Vercel /api/revise
  try {
    const res = await fetch("/api/revise", {
      method: "POST",
      headers: reqHeaders,
      body: JSON.stringify({
        current_config: currentConfig,
        instruction,
        history: history.map((h) => ({ role: h.role, content: h.content })),
      }),
    });
    if (res.ok) {
      const payload = (await res.json()) as RevisionResponse;
      if (payload.success && payload.data?.updated_config) {
        return payload.data;
      }
    }
  } catch {
    // Devam et
  }

  // 3. Tarayıcıda doğrudan Gemini API (Kullanıcının anahtarı varsa)
  if (apiKey) {
    const historyText = history
      .slice(-4)
      .map((m) => `- ${m.role}: ${m.content}`)
      .join("\n");
    const prompt =
      `MEVCUT DOLAP PARAMETRELERİ (JSON):\n${JSON.stringify(currentConfig, null, 2)}\n\n` +
      (historyText ? `Önceki Sohbet Geçmişi:\n${historyText}\n\n` : "") +
      `KULLANICI REVİZYON TALEBİ:\n"${instruction}"\n\n` +
      "Lütfen yalnızca kullanıcının talep ettiği değişiklikleri uygulayarak şemaya uygun güncellenmiş JSON parametrelerini üret.";
    const systemPrompt =
      "Sen mobilya CAD/CAM revizyon motorusun. Mevcut dolap JSON şemasını al, kullanıcının talimatını uygulayarak güncellenmiş tek bir JSON döndür. " +
      "Kullanıcının değiştirmediği tüm alanları (bölmeler, kertmeler, bağlantı tipi, eğim vb.) kesinlikle KORU. Asla silme veya varsayılana sıfırlama. " +
      "Ölçüleri mm cinsinden yaz (120 cm -> 1200 mm). Renkleri hex koduna çevir (#374151 vb.).";

    for (const model of ["gemini-2.5-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash"]) {
      try {
        const generationConfig: Record<string, unknown> = {
          response_mime_type: "application/json",
          response_schema: RESPONSE_SCHEMA,
          temperature: 0,
        };
        if (model.startsWith("gemini-2.5")) {
          generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemPrompt }] },
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig,
            }),
          }
        );

        if (res.ok) {
          const json = (await res.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const normalized = normalizeGeminiConfig(JSON.parse(rawText) as GeminiRawConfig);
            if (currentConfig.additional_modules?.length) {
              normalized.additional_modules = [...currentConfig.additional_modules];
            }
            const diffs = computeCabinetDiff(currentConfig, normalized);
            return {
              updated_config: normalized,
              assistant_message:
                diffs.length > 0
                  ? `Dolap başarıyla revize edildi:\n${diffs.map((d) => `- ${d}`).join("\n")}`
                  : "İstediğiniz düzenlemeler uygulandı.",
              diff_summary: diffs,
            };
          }
        }
      } catch {
        // Sonraki modeli dene
      }
    }
  }

  // 4. Çevrimdışı ve Kesintisiz Deterministik Kural Motoru
  return mutateCabinetDeterministic(currentConfig, instruction);
}
