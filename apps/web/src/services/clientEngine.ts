/**
 * Tarayıcı İçi Deterministik Mühendislik Motoru
 * (BOM + Çekmece Kasa + Çoklu Modül Oda Hattı + DXF R2010 + G-Code .nc + WoodWOP .mpr + Nesting SVG + ZIP).
 */

import type {
  BOMReport,
  CabinetConfig,
  CabinetType,
  DoorType,
  DrillPoint,
  EdgeBandSpec,
  GroovePath,
  HardwareItem,
  NestedPartPlacement,
  NestingResult,
  PanelPart,
  ProductionPackageResponse,
  RoomLinePreset,
  SheetLayout,
  SheetSizeOption,
} from "../types/cabinet";

const MC = {
  BODY_THICKNESS_MM: 18.0,
  BACK_PANEL_GROOVED_THICKNESS_MM: 8.0,
  BACK_PANEL_NAILED_THICKNESS_MM: 3.0,
  SHEET_TRIM_MARGIN_MM: 10.0,
  SAW_KERF_MM: 4.0,
  PVC_IGNORE_THRESHOLD_MM: 1.0,
  BACK_GROOVE_OFFSET_FROM_REAR_MM: 10.0,
  BACK_GROOVE_WIDTH_MM: 8.5,
  BACK_GROOVE_DEPTH_MM: 8.0,
  BACK_PANEL_INSERTION_PER_SIDE_MM: 7.5,
  SHELF_WIDTH_CLEARANCE_MM: 2.0,
  SHELF_FRONT_SETBACK_MM: 20.0,
  DOOR_OUTER_GAP_MM: 2.0,
  DOOR_CENTER_GAP_MM: 2.0,
  SYSTEM_32_PITCH_MM: 32.0,
  MINIFIX_CAM_DIAMETER_MM: 15.0,
  MINIFIX_CAM_DEPTH_MM: 13.5,
  MINIFIX_CAM_CENTER_FROM_EDGE_MM: 34.0,
  MINIFIX_BOLT_DIAMETER_MM: 8.0,
  MINIFIX_BOLT_DEPTH_MM: 11.0,
  DOWEL_DIAMETER_MM: 8.0,
  DOWEL_DEPTH_MM: 12.0,
  DOWEL_OFFSET_FROM_MINIFIX_MM: 32.0,
  SHELF_PIN_DIAMETER_MM: 5.0,
  SHELF_PIN_DEPTH_MM: 12.0,
  SHELF_PIN_FRONT_OFFSET_MM: 37.0,
  SHELF_PIN_REAR_OFFSET_MM: 50.0,
  HINGE_CUP_DIAMETER_MM: 35.0,
  HINGE_CUP_DEPTH_MM: 13.0,
  HINGE_CUP_CENTER_FROM_EDGE_MM: 22.5,
  HINGE_EDGE_OFFSET_TOP_BOTTOM_MM: 100.0,
  DRAWER_SLIDE_CLEARANCE_TOTAL_MM: 26.0,
  DRAWER_BOX_HEIGHT_REDUCTION_MM: 45.0,
  DRAWER_SLIDE_SIZES_MM: [250.0, 300.0, 350.0, 400.0, 450.0, 500.0, 550.0],
  DRAWER_SLIDE_HOLE_DIAMETER_MM: 5.0,
  DRAWER_SLIDE_HOLE_DEPTH_MM: 12.0,
  LAYER_OUTLINE: "OUTLINE_CUT",
  LAYER_GROOVE_BACK: "GROOVE_BACK_8MM",
  LAYER_MINIFIX_CAM: "DRILL_MINIFIX_CAM_D15",
  LAYER_MINIFIX_BOLT: "DRILL_MINIFIX_BOLT_D8",
  LAYER_DOWEL: "DRILL_DOWEL_D8",
  LAYER_SHELF_PIN: "DRILL_SHELF_PIN_D5",
  LAYER_HINGE_CUP: "DRILL_HINGE_CUP_D35",
  LAYER_DRAWER_SLIDE: "DRILL_SLIDE_D5",
} as const;

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

/**
 * Fabrika Oda ve Kategori Hatları (Çoklu Modül Hazır Hat Şablonları)
 */
export const ROOM_LINE_PRESETS: readonly RoomLinePreset[] = [
  {
    id: "kitchen_full_line",
    category: "Mutfak Hattı",
    title: "Komple Mutfak Alt + Ankastre Kiler Hattı (3 Modül — 200 cm)",
    subtitle:
      "Modül 1: 80cm Evye Altı + Modül 2: 60cm 3 Çekmeceli Kaşıklık/Tencere + Modül 3: 60cm Boy Kiler",
    totalWidthMm: 2000,
    config: {
      name: "Mutfak Evye Altı Modülü",
      cabinet_type: "kitchen_base",
      width_mm: 800,
      height_mm: 820,
      depth_mm: 560,
      shelf_count: 1,
      door_type: "double",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 100,
      body_material: "18mm Beyaz MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [
        {
          name: "Mutfak 3 Çekmeceli Alt Modül",
          cabinet_type: "kitchen_base",
          width_mm: 600,
          height_mm: 820,
          depth_mm: 560,
          shelf_count: 0,
          door_type: "none",
          drawer_count: 3,
          drawer_front_height_mm: 228,
          has_plinth: true,
          plinth_height_mm: 100,
          body_material: "18mm Beyaz MDF-Lam",
          body_color_hex: "#F4F1EA",
          door_color_hex: "#374151",
          front_pvc_thickness_mm: 2.0,
          hidden_pvc_thickness_mm: 0.4,
          back_panel_type: "grooved_8mm",
          sheet_size: "2800x2100",
        },
        {
          name: "Mutfak Boy Kiler / Ankastre Kule",
          cabinet_type: "kitchen_tall",
          width_mm: 600,
          height_mm: 2100,
          depth_mm: 560,
          shelf_count: 4,
          door_type: "single_right",
          drawer_count: 2,
          drawer_front_height_mm: 200,
          has_plinth: true,
          plinth_height_mm: 100,
          body_material: "18mm Beyaz MDF-Lam",
          body_color_hex: "#F4F1EA",
          door_color_hex: "#374151",
          front_pvc_thickness_mm: 2.0,
          hidden_pvc_thickness_mm: 0.4,
          back_panel_type: "grooved_8mm",
          sheet_size: "2800x2100",
        },
      ],
    },
  },
  {
    id: "bedroom_master_wardrobe",
    category: "Yatak Odası Hattı",
    title: "6 Kapaklı & 3 Çekmeceli Master Gardırop Hattı (3 Modül — 270 cm)",
    subtitle:
      "Sol 90cm Gardırop + Orta 90cm 3 Çekmeceli & Kapaklı Modül + Sağ 90cm Gardırop",
    totalWidthMm: 2700,
    config: {
      name: "Sol Gardırop Modülü",
      cabinet_type: "wardrobe",
      width_mm: 900,
      height_mm: 2100,
      depth_mm: 580,
      shelf_count: 4,
      door_type: "double",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Doğal Meşe Suntalam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#C89F70",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [
        {
          name: "Orta Çekmeceli Gardırop Modülü",
          cabinet_type: "wardrobe",
          width_mm: 900,
          height_mm: 2100,
          depth_mm: 580,
          shelf_count: 3,
          door_type: "double",
          drawer_count: 3,
          drawer_front_height_mm: 180,
          has_plinth: true,
          plinth_height_mm: 80,
          body_material: "18mm Doğal Meşe Suntalam",
          body_color_hex: "#F4F1EA",
          door_color_hex: "#C89F70",
          front_pvc_thickness_mm: 2.0,
          hidden_pvc_thickness_mm: 0.4,
          back_panel_type: "grooved_8mm",
          sheet_size: "2800x2100",
        },
        {
          name: "Sağ Gardırop Modülü",
          cabinet_type: "wardrobe",
          width_mm: 900,
          height_mm: 2100,
          depth_mm: 580,
          shelf_count: 4,
          door_type: "double",
          drawer_count: 0,
          drawer_front_height_mm: 180,
          has_plinth: true,
          plinth_height_mm: 80,
          body_material: "18mm Doğal Meşe Suntalam",
          body_color_hex: "#F4F1EA",
          door_color_hex: "#C89F70",
          front_pvc_thickness_mm: 2.0,
          hidden_pvc_thickness_mm: 0.4,
          back_panel_type: "grooved_8mm",
          sheet_size: "2800x2100",
        },
      ],
    },
  },
  {
    id: "bedroom_dresser_set",
    category: "Yatak Odası Çekmece Seti",
    title: "4 Çekmeceli Şifonyer & Çift Komodin Hattı (3 Modül — 190 cm)",
    subtitle:
      "Sol 50cm 2 Çekmeceli Komodin + Orta 90cm 4 Çekmeceli Şifonyer + Sağ 50cm 2 Çekmeceli Komodin",
    totalWidthMm: 1900,
    config: {
      name: "Sol 2 Çekmeceli Komodin",
      cabinet_type: "dresser",
      width_mm: 500,
      height_mm: 520,
      depth_mm: 450,
      shelf_count: 0,
      door_type: "none",
      drawer_count: 2,
      drawer_front_height_mm: 200,
      has_plinth: true,
      plinth_height_mm: 60,
      body_material: "18mm Koyu Ceviz MDF-Lam",
      body_color_hex: "#6E472B",
      door_color_hex: "#EFECE6",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [
        {
          name: "4 Çekmeceli Yatak Odası Şifonyeri",
          cabinet_type: "dresser",
          width_mm: 900,
          height_mm: 860,
          depth_mm: 480,
          shelf_count: 0,
          door_type: "none",
          drawer_count: 4,
          drawer_front_height_mm: 185,
          has_plinth: true,
          plinth_height_mm: 60,
          body_material: "18mm Koyu Ceviz MDF-Lam",
          body_color_hex: "#6E472B",
          door_color_hex: "#EFECE6",
          front_pvc_thickness_mm: 2.0,
          hidden_pvc_thickness_mm: 0.4,
          back_panel_type: "grooved_8mm",
          sheet_size: "2800x2100",
        },
        {
          name: "Sağ 2 Çekmeceli Komodin",
          cabinet_type: "dresser",
          width_mm: 500,
          height_mm: 520,
          depth_mm: 450,
          shelf_count: 0,
          door_type: "none",
          drawer_count: 2,
          drawer_front_height_mm: 200,
          has_plinth: true,
          plinth_height_mm: 60,
          body_material: "18mm Koyu Ceviz MDF-Lam",
          body_color_hex: "#6E472B",
          door_color_hex: "#EFECE6",
          front_pvc_thickness_mm: 2.0,
          hidden_pvc_thickness_mm: 0.4,
          back_panel_type: "grooved_8mm",
          sheet_size: "2800x2100",
        },
      ],
    },
  },
  {
    id: "bathroom_vanity_line",
    category: "Banyo Mobilyası Hattı",
    title: "Banyo Lavabo Altı & Boy Dolabı Hattı (2 Modül — 125 cm)",
    subtitle:
      "80cm 2 Derin Çekmeceli Lavabo Altı Modülü + 45cm Banyo Boy/Havlu Dolabı",
    totalWidthMm: 1250,
    config: {
      name: "Banyo Lavabo Altı Çekmeceli Modül",
      cabinet_type: "bathroom_vanity",
      width_mm: 800,
      height_mm: 650,
      depth_mm: 480,
      shelf_count: 0,
      door_type: "none",
      drawer_count: 2,
      drawer_front_height_mm: 280,
      has_plinth: false,
      plinth_height_mm: 0,
      body_material: "18mm Antrasit MDF-Lam",
      body_color_hex: "#374151",
      door_color_hex: "#F4F1EA",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [
        {
          name: "Banyo Boy ve Havlu Dolabı",
          cabinet_type: "bathroom_tall",
          width_mm: 450,
          height_mm: 1800,
          depth_mm: 380,
          shelf_count: 4,
          door_type: "single_right",
          drawer_count: 1,
          drawer_front_height_mm: 260,
          has_plinth: false,
          plinth_height_mm: 0,
          body_material: "18mm Antrasit MDF-Lam",
          body_color_hex: "#374151",
          door_color_hex: "#F4F1EA",
          front_pvc_thickness_mm: 2.0,
          hidden_pvc_thickness_mm: 0.4,
          back_panel_type: "grooved_8mm",
          sheet_size: "2800x2100",
        },
      ],
    },
  },
  {
    id: "hallway_vestiyer_line",
    category: "Antre & Vestiyer Hattı",
    title: "Komple Antre Vestiyer & Oturma Banklı Portmanto (2 Modül — 180 cm)",
    subtitle:
      "90cm Çekmeceli Ayakkabılık/Oturma Bankı + 90cm Çift Kapaklı & Çekmeceli Portmanto",
    totalWidthMm: 1800,
    config: {
      name: "Antre Oturma Banklı Ayakkabılık",
      cabinet_type: "shoe_cabinet",
      width_mm: 900,
      height_mm: 550,
      depth_mm: 400,
      shelf_count: 0,
      door_type: "none",
      drawer_count: 2,
      drawer_front_height_mm: 200,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Doğal Meşe Suntalam",
      body_color_hex: "#C89F70",
      door_color_hex: "#F4F1EA",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [
        {
          name: "Boy Vestiyer / Portmanto Dolabı",
          cabinet_type: "shoe_cabinet",
          width_mm: 900,
          height_mm: 2100,
          depth_mm: 400,
          shelf_count: 4,
          door_type: "double",
          drawer_count: 2,
          drawer_front_height_mm: 180,
          has_plinth: true,
          plinth_height_mm: 80,
          body_material: "18mm Doğal Meşe Suntalam",
          body_color_hex: "#C89F70",
          door_color_hex: "#F4F1EA",
          front_pvc_thickness_mm: 2.0,
          hidden_pvc_thickness_mm: 0.4,
          back_panel_type: "grooved_8mm",
          sheet_size: "2800x2100",
        },
      ],
    },
  },
  {
    id: "living_tv_media_line",
    category: "Salon & Ofis Hattı",
    title: "TV Medya Konsolu & Çift Kitaplık Kulesi (3 Modül — 280 cm)",
    subtitle:
      "Sol 60cm Kitaplık Kulesi + Orta 160cm Çekmeceli TV Konsolu + Sağ 60cm Kitaplık Kulesi",
    totalWidthMm: 2800,
    config: {
      name: "Sol Kitaplık / Vitrin Kulesi",
      cabinet_type: "bookshelf",
      width_mm: 600,
      height_mm: 1850,
      depth_mm: 360,
      shelf_count: 4,
      door_type: "none",
      drawer_count: 1,
      drawer_front_height_mm: 220,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Koyu Ceviz MDF-Lam",
      body_color_hex: "#6E472B",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [
        {
          name: "Orta TV Medya Konsolu",
          cabinet_type: "tv_unit",
          width_mm: 1600,
          height_mm: 520,
          depth_mm: 420,
          shelf_count: 0,
          door_type: "none",
          drawer_count: 2,
          drawer_front_height_mm: 190,
          has_plinth: true,
          plinth_height_mm: 80,
          body_material: "18mm Koyu Ceviz MDF-Lam",
          body_color_hex: "#6E472B",
          door_color_hex: "#374151",
          front_pvc_thickness_mm: 2.0,
          hidden_pvc_thickness_mm: 0.4,
          back_panel_type: "grooved_8mm",
          sheet_size: "2800x2100",
        },
        {
          name: "Sağ Kitaplık / Vitrin Kulesi",
          cabinet_type: "bookshelf",
          width_mm: 600,
          height_mm: 1850,
          depth_mm: 360,
          shelf_count: 4,
          door_type: "none",
          drawer_count: 1,
          drawer_front_height_mm: 220,
          has_plinth: true,
          plinth_height_mm: 80,
          body_material: "18mm Koyu Ceviz MDF-Lam",
          body_color_hex: "#6E472B",
          door_color_hex: "#374151",
          front_pvc_thickness_mm: 2.0,
          hidden_pvc_thickness_mm: 0.4,
          back_panel_type: "grooved_8mm",
          sheet_size: "2800x2100",
        },
      ],
    },
  },
];

/**
 * 1. Doğal Dil Ayrıştırıcı (Deterministic Semantic Parser)
 */
export function parsePromptDeterministic(prompt: string): CabinetConfig {
  const text = prompt.toLowerCase();

  let cabinetType: CabinetType = "wardrobe";
  let name = "Parametrik Gardırop Modülü";
  let widthMm = 900.0;
  let heightMm = 2100.0;
  let depthMm = 580.0;
  let hasPlinth = true;
  let plinthHeightMm = 80.0;
  let drawerCount = 0;

  if (
    text.includes("buzdolab") ||
    text.includes("kiler") ||
    text.includes("boy kiler") ||
    text.includes("ankastre kule")
  ) {
    cabinetType = "kitchen_tall";
    name = "Buzdolabı / Kiler Dolabı Modülü";
    widthMm = 850.0;
    heightMm = 2350.0;
    depthMm = 650.0;
    hasPlinth = false;
    plinthHeightMm = 0.0;
  } else if (
    text.includes("mutfak üst") ||
    text.includes("üst modül") ||
    text.includes("duvar dolab")
  ) {
    cabinetType = "kitchen_wall";
    name = "Mutfak Üst Dolap Modülü";
    widthMm = 800.0;
    heightMm = 720.0;
    depthMm = 350.0;
    hasPlinth = false;
    plinthHeightMm = 0.0;
  } else if (
    text.includes("boy kiler") ||
    text.includes("ankastre kule") ||
    text.includes("kiler dolab")
  ) {
    cabinetType = "kitchen_tall";
    name = "Mutfak Boy Kiler / Ankastre Modülü";
    widthMm = 600.0;
    heightMm = 2100.0;
    depthMm = 580.0;
    hasPlinth = true;
    plinthHeightMm = 100.0;
  } else if (
    text.includes("mutfak alt") ||
    text.includes("alt modül") ||
    text.includes("tezgah altı") ||
    text.includes("evye")
  ) {
    cabinetType = "kitchen_base";
    name = "Mutfak Alt Dolap Modülü";
    widthMm = 800.0;
    heightMm = 820.0;
    depthMm = 560.0;
    hasPlinth = true;
    plinthHeightMm = 100.0;
  } else if (text.includes("banyo boy")) {
    cabinetType = "bathroom_tall";
    name = "Banyo Boy Dolabı Modülü";
    widthMm = 450.0;
    heightMm = 1800.0;
    depthMm = 380.0;
  } else if (text.includes("banyo") || text.includes("lavabo")) {
    cabinetType = "bathroom_vanity";
    name = "Banyo Lavabo Altı Modülü";
    widthMm = 800.0;
    heightMm = 650.0;
    depthMm = 480.0;
    hasPlinth = false;
    plinthHeightMm = 0.0;
    drawerCount = 2;
  } else if (
    text.includes("şifonyer") ||
    text.includes("sifonyer") ||
    text.includes("komodin")
  ) {
    cabinetType = "dresser";
    name = "Şifonyer / Komodin Modülü";
    widthMm = 900.0;
    heightMm = 860.0;
    depthMm = 480.0;
    drawerCount = 4;
  } else if (
    text.includes("kitaplık") ||
    text.includes("kitaplik") ||
    text.includes("dosya")
  ) {
    cabinetType = "bookshelf";
    name = "Parametrik Kitaplık / Ofis Modülü";
    widthMm = 800.0;
    heightMm = 1800.0;
    depthMm = 350.0;
  } else if (
    text.includes("ayakkabılık") ||
    text.includes("ayakkabilik") ||
    text.includes("portmanto") ||
    text.includes("vestiyer")
  ) {
    cabinetType = "shoe_cabinet";
    name = "Vestiyer / Portmanto Modülü";
    widthMm = 900.0;
    heightMm = 1200.0;
    depthMm = 380.0;
  } else if (
    text.includes("tv") ||
    text.includes("televizyon") ||
    text.includes("konsol")
  ) {
    cabinetType = "tv_unit";
    name = "TV Ünitesi / Medya Konsolu";
    widthMm = 1600.0;
    heightMm = 500.0;
    depthMm = 420.0;
    drawerCount = 2;
  }

  const toMm = (valStr: string, unitStr?: string): number => {
    const val = parseFloat(valStr.replace(",", "."));
    const unit = (unitStr ?? "").trim();
    if (unit === "m" || (!unit && val < 4.0)) return Math.round(val * 1000);
    if (unit === "cm" || (!unit && val >= 20 && val <= 275)) {
      return Math.round(val * 10);
    }
    return Math.round(val);
  };

  // 1. Önce 'dış ölçü' veya 'toplam dış ölçü' kapsamı var mı kontrol et (iç niş/boşluk ölçüleriyle karışmaması için)
  const outerScopeMatch = text.match(
    /(?:dış\s*ölçü|dış\s*ebat|toplam\s*ölçü)[^.]*?(?:\.|$)/i
  );
  const searchScope = outerScopeMatch ? outerScopeMatch[0] : text;

  const wMatch =
    searchScope.match(/(?:genişlik|genislik|en)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i) ??
    searchScope.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:genişli[ğg]inde|genişlik|genislik|eninde|en\b)/i) ??
    text.match(/(?:genişlik|genislik|en)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i) ??
    text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:genişli[ğg]inde|genişlik|genislik|eninde|en\b)/i);
  if (wMatch) {
    const rawVal = wMatch[1] && !isNaN(parseFloat(wMatch[1])) ? wMatch[1] : wMatch[2];
    const rawUnit = wMatch[2] && isNaN(parseFloat(wMatch[2])) ? wMatch[2] : wMatch[1];
    widthMm = toMm(rawVal, rawUnit);
  }

  const hMatch =
    searchScope.match(/(?:yükseklik|yukseklik|boy)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i) ??
    searchScope.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yüksekli[ğg]inde|yükseklik|yukseklik|boyunda|boy\b)/i) ??
    text.match(/(?:yükseklik|yukseklik|boy)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i) ??
    text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yüksekli[ğg]inde|yükseklik|yukseklik|boyunda|boy\b)/i);
  if (hMatch) {
    const rawVal = hMatch[1] && !isNaN(parseFloat(hMatch[1])) ? hMatch[1] : hMatch[2];
    const rawUnit = hMatch[2] && isNaN(parseFloat(hMatch[2])) ? hMatch[2] : hMatch[1];
    heightMm = toMm(rawVal, rawUnit);
  }

  const dMatch =
    searchScope.match(/(?:derinlik)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i) ??
    searchScope.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:derinli[ğg]inde|derinlik)/i) ??
    text.match(/(?:derinlik)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i) ??
    text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:derinli[ğg]inde|derinlik)/i);
  if (dMatch) {
    const rawVal = dMatch[1] && !isNaN(parseFloat(dMatch[1])) ? dMatch[1] : dMatch[2];
    const rawUnit = dMatch[2] && isNaN(parseFloat(dMatch[2])) ? dMatch[2] : dMatch[1];
    depthMm = toMm(rawVal, rawUnit);
  }

  // 2b. Alt Cihaz / Buzdolabı Niş Boşluğu Tespiti
  let applianceNicheHeightMm = 0.0;
  const nicheMatch =
    text.match(
      /(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yüksekli[ğg]inde\s*)?(?:açık\s*)?(?:bir\s*)?(?:niş|nis|boşluk|bosluk)/i
    ) ??
    text.match(
      /(?:niş|nis|boşluk|bosluk)[^.]*?(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yüksekli[ğg]inde|yükseklik|boy)/i
    );
  if (nicheMatch) {
    applianceNicheHeightMm = toMm(nicheMatch[1], nicheMatch[2]);
  } else if (
    text.includes("buzdolab") &&
    (text.includes("niş") ||
      text.includes("nis") ||
      text.includes("boşluk") ||
      text.includes("bosluk") ||
      text.includes("çevreleme") ||
      text.includes("gömme"))
  ) {
    applianceNicheHeightMm = Math.min(1850.0, Math.max(0.0, heightMm - 450.0));
  }

  if (applianceNicheHeightMm > 0) {
    hasPlinth = false;
    plinthHeightMm = 0.0;
  }

  let shelfCount =
    cabinetType === "dresser" ||
    cabinetType === "bathroom_vanity" ||
    applianceNicheHeightMm > 0 ||
    text.includes("buzdolab")
      ? 0
      : cabinetType === "kitchen_wall"
      ? 2
      : 4;
  if (text.includes("rafsız") || text.includes("rafsiz")) {
    shelfCount = 0;
  } else {
    const sMatch = text.match(/(\d+)\s*(?:adet\s*)?(?:hareketli\s*)?raf/);
    if (sMatch) shelfCount = parseInt(sMatch[1], 10);
  }

  if (text.includes("çekmecesiz") || text.includes("cekmecesiz")) {
    drawerCount = 0;
  } else {
    const drMatch = text.match(/(\d+)\s*(?:adet\s*)?(?:frenli\s*)?[çc]ekmece/);
    if (drMatch) drawerCount = parseInt(drMatch[1], 10);
  }

  let doorType: DoorType =
    cabinetType === "bookshelf" ||
    cabinetType === "dresser" ||
    cabinetType === "bathroom_vanity"
      ? "none"
      : "double";
  if (
    text.includes("kapaksız") ||
    text.includes("kapaksiz") ||
    text.includes("açık raf")
  ) {
    doorType = "none";
  } else if (
    text.includes("kalkar kapak") ||
    text.includes("kalkar") ||
    text.includes("gazlı piston") ||
    text.includes("gazli piston") ||
    text.includes("yukarı doğru açılan") ||
    text.includes("yukarı açılır")
  ) {
    doorType = "flap_up";
  } else if (
    text.includes("çift kapak") ||
    text.includes("cift kapak") ||
    text.includes("iki kapak") ||
    text.includes("2 kapak")
  ) {
    doorType = "double";
  } else if (text.includes("sağ kapak") || text.includes("sag kapak")) {
    doorType = "single_right";
  } else if (
    text.includes("tek kapak") ||
    text.includes("sol kapak") ||
    text.includes("1 kapak") ||
    text.includes("tek parça")
  ) {
    doorType = "single_left";
  }

  if (
    text.includes("bazasız") ||
    text.includes("bazasiz") ||
    text.includes("tavandan tabana")
  ) {
    hasPlinth = false;
    plinthHeightMm = 0.0;
  }

  const colorMap: Record<string, [string, string]> = {
    beyaz: ["#F4F1EA", "18mm Beyaz Suntalam"],
    antrasit: ["#374151", "18mm Antrasit MDF-Lam"],
    siyah: ["#1F2937", "18mm Siyah MDF-Lam"],
    meşe: ["#C89F70", "18mm Doğal Meşe Suntalam"],
    mese: ["#C89F70", "18mm Doğal Meşe Suntalam"],
    ceviz: ["#6E472B", "18mm Koyu Ceviz MDF-Lam"],
    gri: ["#9CA3AF", "18mm Açık Gri Suntalam"],
    krem: ["#EFECE6", "18mm Krem MDF-Lam"],
  };

  let bodyColorHex = "#F4F1EA";
  let doorColorHex = "#D7C4A3";
  let bodyMaterial = "18mm Beyaz Suntalam";
  let doorMaterial = "";

  for (const [word, [hex, mat]] of Object.entries(colorMap)) {
    const bodyClause = text.match(
      new RegExp(`(?:gövde|govde)[^.,;]*${word}[^.,;]*|${word}[^.,;]*(?:gövde|govde)[^.,;]*`, "i")
    );
    const doorClause = text.match(
      new RegExp(`kapak[^.,;]*${word}[^.,;]*|${word}[^.,;]*kapak[^.,;]*`, "i")
    );
    if (bodyClause) {
      bodyColorHex = hex;
      const clauseStr = bodyClause[0];
      if (clauseStr.includes("mdf")) {
        bodyMaterial = mat.replace("Suntalam", "MDF-Lam");
      } else if (clauseStr.includes("suntalam")) {
        bodyMaterial = mat.replace("MDF-Lam", "Suntalam");
      } else {
        bodyMaterial = mat;
      }
    }
    if (doorClause) {
      doorColorHex = hex;
      const clauseStr = doorClause[0];
      if (clauseStr.includes("mdf")) {
        doorMaterial = mat.replace("Suntalam", "MDF-Lam");
      } else if (clauseStr.includes("suntalam")) {
        doorMaterial = mat.replace("MDF-Lam", "Suntalam");
      } else {
        doorMaterial = mat;
      }
    }
    if (!bodyClause && !doorClause && text.includes(word)) {
      bodyColorHex = hex;
      bodyMaterial = text.includes("mdf")
        ? mat.replace("Suntalam", "MDF-Lam")
        : mat;
      if (!text.includes("kapak")) {
        doorColorHex = hex;
      }
    }
  }

  widthMm = Math.max(300, Math.min(2700, widthMm));
  heightMm = Math.max(300, Math.min(2750, heightMm));
  depthMm = Math.max(200, Math.min(900, depthMm));
  shelfCount = Math.max(0, Math.min(12, shelfCount));
  drawerCount = Math.max(0, Math.min(6, drawerCount));
  applianceNicheHeightMm = Math.max(
    0,
    Math.min(heightMm - 260, applianceNicheHeightMm)
  );

  return {
    name,
    cabinet_type: cabinetType,
    width_mm: widthMm,
    height_mm: heightMm,
    depth_mm: depthMm,
    shelf_count: shelfCount,
    door_type: doorType,
    drawer_count: drawerCount,
    drawer_front_height_mm: 180.0,
    appliance_niche_height_mm: applianceNicheHeightMm,
    additional_modules: [],
    has_plinth: hasPlinth,
    plinth_height_mm: plinthHeightMm,
    body_material: bodyMaterial,
    door_material: doorMaterial,
    body_color_hex: bodyColorHex,
    door_color_hex: doorColorHex,
    front_pvc_thickness_mm: 2.0,
    hidden_pvc_thickness_mm: 0.4,
    back_panel_type:
      text.includes("3mm") || text.includes("duralit")
        ? "nailed_3mm"
        : "grooved_8mm",
    sheet_size: text.includes("3660") ? "3660x1830" : "2800x2100",
  };
}

/**
 * 2. Deterministik BOM, Çekmece Kasa, Çoklu Modül ve Sistem 32 Delik Motoru
 */
function pvcDeductionForEdge(pvcMm: number): number {
  return pvcMm < MC.PVC_IGNORE_THRESHOLD_MM ? 0.0 : round2(pvcMm);
}

function computeCutDimensions(
  netLength: number,
  netWidth: number,
  edge: EdgeBandSpec
): [number, number, number, number] {
  const dedL = round2(
    pvcDeductionForEdge(edge.width_1_mm) + pvcDeductionForEdge(edge.width_2_mm)
  );
  const dedW = round2(
    pvcDeductionForEdge(edge.length_1_mm) + pvcDeductionForEdge(edge.length_2_mm)
  );
  return [round2(netLength - dedL), round2(netWidth - dedW), dedL, dedW];
}

function connectionDepthCoords(depthMm: number): number[] {
  const frontX = round2(depthMm - 50.0);
  const rearX = 60.0;
  if (depthMm >= 500.0) {
    return [rearX, round2(depthMm / 2.0), frontX];
  }
  return [rearX, frontX];
}

function hingeCountForHeight(doorHeightMm: number): number {
  if (doorHeightMm <= 900.0) return 2;
  if (doorHeightMm <= 1600.0) return 3;
  if (doorHeightMm <= 2100.0) return 4;
  return 5;
}

function selectDrawerSlideLength(depthMm: number): number {
  const maxAllowed = depthMm - 40.0;
  let chosen = 250.0;
  for (const size of MC.DRAWER_SLIDE_SIZES_MM) {
    if (size <= maxAllowed) chosen = size;
  }
  return chosen;
}

function generateSingleModuleParts(
  config: CabinetConfig,
  moduleIdx: number,
  xOffsetMm: number,
  startPartCounter: number,
  multiMode: boolean
): {
  parts: PanelPart[];
  nextCounter: number;
  minifixSets: number;
  dowelCount: number;
  totalHinges: number;
  totalHandles: number;
  totalGasStruts: number;
} {
  const parts: PanelPart[] = [];
  let partCounter = startPartCounter;
  const padId = (n: number): string => `P${String(n).padStart(2, "0")}`;
  const prefix = multiMode ? `M${moduleIdx}_` : "";
  const labelPrefix = multiMode ? `[Modül ${moduleIdx}] ` : "";

  const t = MC.BODY_THICKNESS_MM;
  const w = config.width_mm;
  const h = config.height_mm;
  const d = config.depth_mm;
  const nicheH = Math.min(
    config.appliance_niche_height_mm ?? 0.0,
    Math.max(0.0, h - 260.0)
  );
  const plinthH = config.has_plinth && nicheH <= 0 ? config.plinth_height_mm : 0.0;
  const baseOffsetY = Math.max(plinthH, nicheH);
  const doorMat =
    config.door_material && config.door_material.trim()
      ? config.door_material.trim()
      : config.body_material;

  const innerW = round2(w - 2.0 * t);
  const clearInnerH = round2(h - baseOffsetY - 2.0 * t);

  const drawerCount = config.drawer_count ?? 0;
  let drawerFrontH = config.drawer_front_height_mm ?? 180.0;
  if (drawerCount > 0 && drawerCount * drawerFrontH > clearInnerH - 40.0) {
    drawerFrontH = round2((clearInnerH - 20.0) / drawerCount);
  }
  const drawerZoneH = round2(drawerCount * drawerFrontH);

  // Yan Dikme Delikleri
  const sideDrills: DrillPoint[] = [];
  const tHalf = t / 2.0;
  const bottomConnX = round2(baseOffsetY + tHalf);
  const topConnX = round2(h - tHalf);
  const connYCoords = connectionDepthCoords(d);

  for (const [connX, label] of [
    [bottomConnX, "Alt Tabla"],
    [topConnX, "Üst Tabla"],
  ] as const) {
    for (const yPos of connYCoords) {
      sideDrills.push({
        x_mm: connX,
        y_mm: yPos,
        diameter_mm: MC.MINIFIX_BOLT_DIAMETER_MM,
        depth_mm: MC.MINIFIX_BOLT_DEPTH_MM,
        layer: MC.LAYER_MINIFIX_BOLT,
        description: `${label} Minifiks Mil Deliği`,
      });
      const dowelY = round2(yPos + MC.DOWEL_OFFSET_FROM_MINIFIX_MM);
      if (dowelY <= d - 25.0) {
        sideDrills.push({
          x_mm: connX,
          y_mm: dowelY,
          diameter_mm: MC.DOWEL_DIAMETER_MM,
          depth_mm: MC.DOWEL_DEPTH_MM,
          layer: MC.LAYER_DOWEL,
          description: `${label} Kavela Deliği`,
        });
      }
    }
  }

  // Çekmece Rayı Montaj Delikleri
  if (drawerCount > 0) {
    const slideOffsets = [37.0, 165.0, 293.0];
    for (let dIdx = 0; dIdx < drawerCount; dIdx += 1) {
      const railX = round2(baseOffsetY + t + dIdx * drawerFrontH + 45.0);
      for (const frontOff of slideOffsets) {
        const holeY = round2(d - frontOff);
        if (holeY >= 40.0) {
          sideDrills.push({
            x_mm: railX,
            y_mm: holeY,
            diameter_mm: MC.DRAWER_SLIDE_HOLE_DIAMETER_MM,
            depth_mm: MC.DRAWER_SLIDE_HOLE_DEPTH_MM,
            layer: MC.LAYER_DRAWER_SLIDE,
            description: `Çekmece #${dIdx + 1} Ray Montaj Deliği`,
          });
        }
      }
    }
  }

  // Sistem 32 Raf Pimi Delikleri
  const remainingClearH = round2(clearInnerH - drawerZoneH);
  if (config.shelf_count > 0 && remainingClearH > 120.0) {
    const lowerBoundX = baseOffsetY + t + drawerZoneH;
    const stepH = remainingClearH / (config.shelf_count + 1);
    const pinYRear = round2(
      MC.BACK_GROOVE_OFFSET_FROM_REAR_MM +
        MC.BACK_GROOVE_WIDTH_MM +
        MC.SHELF_PIN_REAR_OFFSET_MM
    );
    const pinYFront = round2(d - MC.SHELF_PIN_FRONT_OFFSET_MM);

    for (let idx = 1; idx <= config.shelf_count; idx += 1) {
      const centerX = round2(lowerBoundX + idx * stepH);
      for (const offset of [-MC.SYSTEM_32_PITCH_MM, 0.0, MC.SYSTEM_32_PITCH_MM]) {
        const holeX = round2(centerX + offset);
        for (const holeY of [pinYRear, pinYFront]) {
          sideDrills.push({
            x_mm: holeX,
            y_mm: holeY,
            diameter_mm: MC.SHELF_PIN_DIAMETER_MM,
            depth_mm: MC.SHELF_PIN_DEPTH_MM,
            layer: MC.LAYER_SHELF_PIN,
            description: `Raf ${idx} Sistem 32 Pim Deliği`,
          });
        }
      }
    }
  }

  const sideEdge: EdgeBandSpec = {
    length_1_mm: config.front_pvc_thickness_mm,
    length_2_mm: config.hidden_pvc_thickness_mm,
    width_1_mm: config.hidden_pvc_thickness_mm,
    width_2_mm: config.hidden_pvc_thickness_mm,
  };
  const [sideCutL, sideCutW, sideDedL, sideDedW] = computeCutDimensions(
    h,
    d,
    sideEdge
  );

  const sideGrooves: GroovePath[] = [];
  if (config.back_panel_type === "grooved_8mm") {
    sideGrooves.push({
      x_start_mm: round2(baseOffsetY + t - MC.BACK_PANEL_INSERTION_PER_SIDE_MM),
      y_start_mm: MC.BACK_GROOVE_OFFSET_FROM_REAR_MM,
      width_mm: round2(clearInnerH + 2.0 * MC.BACK_PANEL_INSERTION_PER_SIDE_MM),
      length_mm: MC.BACK_GROOVE_WIDTH_MM,
      depth_mm: MC.BACK_GROOVE_DEPTH_MM,
      layer: MC.LAYER_GROOVE_BACK,
    });
  }

  parts.push({
    part_id: padId(partCounter++),
    code: `${prefix}YAN_SOL`,
    name: `${labelPrefix}Sol Yan Dikme`,
    material: config.body_material,
    thickness_mm: t,
    quantity: 1,
    net_length_mm: h,
    net_width_mm: d,
    cut_length_mm: sideCutL,
    cut_width_mm: sideCutW,
    pvc_deduction_length_mm: sideDedL,
    pvc_deduction_width_mm: sideDedW,
    edge_band: sideEdge,
    area_m2: round4((h * d) / 1_000_000.0),
    grain_direction: "length",
    drills: sideDrills,
    grooves: sideGrooves,
    transform_3d: {
      center_x_mm: round2(xOffsetMm - w / 2.0 + t / 2.0),
      center_y_mm: round2(h / 2.0),
      center_z_mm: 0.0,
      size_x_mm: t,
      size_y_mm: h,
      size_z_mm: d,
      color_hex: config.body_color_hex,
      is_door: false,
      is_drawer: false,
      hinge_side: null,
      module_index: moduleIdx,
    },
  });

  parts.push({
    part_id: padId(partCounter++),
    code: `${prefix}YAN_SAG`,
    name: `${labelPrefix}Sağ Yan Dikme`,
    material: config.body_material,
    thickness_mm: t,
    quantity: 1,
    net_length_mm: h,
    net_width_mm: d,
    cut_length_mm: sideCutL,
    cut_width_mm: sideCutW,
    pvc_deduction_length_mm: sideDedL,
    pvc_deduction_width_mm: sideDedW,
    edge_band: sideEdge,
    area_m2: round4((h * d) / 1_000_000.0),
    grain_direction: "length",
    drills: sideDrills,
    grooves: sideGrooves,
    transform_3d: {
      center_x_mm: round2(xOffsetMm + w / 2.0 - t / 2.0),
      center_y_mm: round2(h / 2.0),
      center_z_mm: 0.0,
      size_x_mm: t,
      size_y_mm: h,
      size_z_mm: d,
      color_hex: config.body_color_hex,
      is_door: false,
      is_drawer: false,
      hinge_side: null,
      module_index: moduleIdx,
    },
  });

  // Üst ve Alt Tabla
  const horizEdge: EdgeBandSpec = {
    length_1_mm: config.front_pvc_thickness_mm,
    length_2_mm: config.hidden_pvc_thickness_mm,
    width_1_mm: 0.0,
    width_2_mm: 0.0,
  };
  const [horizCutL, horizCutW, horizDedL, horizDedW] = computeCutDimensions(
    innerW,
    d,
    horizEdge
  );
  const horizDrills: DrillPoint[] = [];
  for (const [camX, sideLabel] of [
    [MC.MINIFIX_CAM_CENTER_FROM_EDGE_MM, "Sol"],
    [round2(innerW - MC.MINIFIX_CAM_CENTER_FROM_EDGE_MM), "Sağ"],
  ] as const) {
    for (const yPos of connYCoords) {
      horizDrills.push({
        x_mm: camX,
        y_mm: yPos,
        diameter_mm: MC.MINIFIX_CAM_DIAMETER_MM,
        depth_mm: MC.MINIFIX_CAM_DEPTH_MM,
        layer: MC.LAYER_MINIFIX_CAM,
        description: `${sideLabel} Yan Bağlantı Minifiks Gövde Yuvası`,
      });
    }
  }

  const horizGrooves: GroovePath[] =
    config.back_panel_type === "grooved_8mm"
      ? [
          {
            x_start_mm: 0.0,
            y_start_mm: MC.BACK_GROOVE_OFFSET_FROM_REAR_MM,
            width_mm: innerW,
            length_mm: MC.BACK_GROOVE_WIDTH_MM,
            depth_mm: MC.BACK_GROOVE_DEPTH_MM,
            layer: MC.LAYER_GROOVE_BACK,
          },
        ]
      : [];

  parts.push({
    part_id: padId(partCounter++),
    code: `${prefix}TABLA_UST`,
    name: `${labelPrefix}Üst Tabla`,
    material: config.body_material,
    thickness_mm: t,
    quantity: 1,
    net_length_mm: innerW,
    net_width_mm: d,
    cut_length_mm: horizCutL,
    cut_width_mm: horizCutW,
    pvc_deduction_length_mm: horizDedL,
    pvc_deduction_width_mm: horizDedW,
    edge_band: horizEdge,
    area_m2: round4((innerW * d) / 1_000_000.0),
    grain_direction: "length",
    drills: horizDrills,
    grooves: horizGrooves,
    transform_3d: {
      center_x_mm: xOffsetMm,
      center_y_mm: round2(h - t / 2.0),
      center_z_mm: 0.0,
      size_x_mm: innerW,
      size_y_mm: t,
      size_z_mm: d,
      color_hex: config.body_color_hex,
      is_door: false,
      is_drawer: false,
      hinge_side: null,
      module_index: moduleIdx,
    },
  });

  parts.push({
    part_id: padId(partCounter++),
    code: `${prefix}TABLA_ALT`,
    name:
      nicheH > 0
        ? `${labelPrefix}Üst Dolap Alt Tablası (Niş Üstü)`
        : `${labelPrefix}Alt Tabla`,
    material: config.body_material,
    thickness_mm: t,
    quantity: 1,
    net_length_mm: innerW,
    net_width_mm: d,
    cut_length_mm: horizCutL,
    cut_width_mm: horizCutW,
    pvc_deduction_length_mm: horizDedL,
    pvc_deduction_width_mm: horizDedW,
    edge_band: horizEdge,
    area_m2: round4((innerW * d) / 1_000_000.0),
    grain_direction: "length",
    drills: horizDrills,
    grooves: horizGrooves,
    transform_3d: {
      center_x_mm: xOffsetMm,
      center_y_mm: round2(baseOffsetY + t / 2.0),
      center_z_mm: 0.0,
      size_x_mm: innerW,
      size_y_mm: t,
      size_z_mm: d,
      color_hex: config.body_color_hex,
      is_door: false,
      is_drawer: false,
      hinge_side: null,
      module_index: moduleIdx,
    },
  });

  // Baza Kayıtları
  if (config.has_plinth && plinthH > 0) {
    const plinthEdge: EdgeBandSpec = {
      length_1_mm: config.hidden_pvc_thickness_mm,
      length_2_mm: config.hidden_pvc_thickness_mm,
      width_1_mm: 0.0,
      width_2_mm: 0.0,
    };
    const [pCutL, pCutW, pDedL, pDedW] = computeCutDimensions(
      innerW,
      plinthH,
      plinthEdge
    );
    for (const [suffix, label, zPos] of [
      ["ON", "Ön", round2(d / 2.0 - 25.0)],
      ["ARKA", "Arka", round2(-d / 2.0 + 25.0)],
    ] as const) {
      parts.push({
        part_id: padId(partCounter++),
        code: `${prefix}BAZA_${suffix}`,
        name: `${labelPrefix}${label} Baza Kaydı`,
        material: config.body_material,
        thickness_mm: t,
        quantity: 1,
        net_length_mm: innerW,
        net_width_mm: plinthH,
        cut_length_mm: pCutL,
        cut_width_mm: pCutW,
        pvc_deduction_length_mm: pDedL,
        pvc_deduction_width_mm: pDedW,
        edge_band: plinthEdge,
        area_m2: round4((innerW * plinthH) / 1_000_000.0),
        grain_direction: "length",
        drills: [],
        grooves: [],
        transform_3d: {
          center_x_mm: xOffsetMm,
          center_y_mm: round2(plinthH / 2.0),
          center_z_mm: zPos,
          size_x_mm: innerW,
          size_y_mm: plinthH,
          size_z_mm: t,
          color_hex: config.body_color_hex,
          is_door: false,
          is_drawer: false,
          hinge_side: null,
          module_index: moduleIdx,
        },
      });
    }
  }

  // Çekmece Kasa ve Klapaları
  let totalHandles = 0;
  if (drawerCount > 0) {
    const slideLen = selectDrawerSlideLength(d);
    const boxH = round2(
      Math.max(80.0, drawerFrontH - MC.DRAWER_BOX_HEIGHT_REDUCTION_MM)
    );
    const boxInnerW = round2(
      innerW - MC.DRAWER_SLIDE_CLEARANCE_TOTAL_MM - 2.0 * t
    );
    const frontNetW = round2(w - 2.0 * MC.DOOR_OUTER_GAP_MM);
    const frontNetH = round2(drawerFrontH - MC.DOOR_CENTER_GAP_MM);

    const frontEdge: EdgeBandSpec = {
      length_1_mm: config.front_pvc_thickness_mm,
      length_2_mm: config.front_pvc_thickness_mm,
      width_1_mm: config.front_pvc_thickness_mm,
      width_2_mm: config.front_pvc_thickness_mm,
    };
    const [fCutL, fCutW, fDedL, fDedW] = computeCutDimensions(
      frontNetW,
      frontNetH,
      frontEdge
    );

    const boxEdge: EdgeBandSpec = {
      length_1_mm: config.hidden_pvc_thickness_mm,
      length_2_mm: 0.0,
      width_1_mm: 0.0,
      width_2_mm: 0.0,
    };
    const [bsCutL, bsCutW, bsDedL, bsDedW] = computeCutDimensions(
      slideLen,
      boxH,
      boxEdge
    );
    const [bfCutL, bfCutW, bfDedL, bfDedW] = computeCutDimensions(
      boxInnerW,
      boxH,
      boxEdge
    );

    const noEdge: EdgeBandSpec = {
      length_1_mm: 0.0,
      length_2_mm: 0.0,
      width_1_mm: 0.0,
      width_2_mm: 0.0,
    };
    const bottomW = round2(boxInnerW + 15.0);
    const bottomL = round2(slideLen - 2.0 * t + 15.0);

    for (let dIdx = 1; dIdx <= drawerCount; dIdx += 1) {
      const dStr = String(dIdx).padStart(2, "0");
      const centerY = round2(baseOffsetY + t + (dIdx - 0.5) * drawerFrontH);
      const klapaZ = round2(d / 2.0 + t / 2.0 + 1.5);
      const boxZ = round2(d / 2.0 - slideLen / 2.0 - 5.0);
      totalHandles += 1;

      parts.push({
        part_id: padId(partCounter++),
        code: `${prefix}CEK_KLAPA_${dStr}`,
        name: `${labelPrefix}Çekmece #${dIdx} Ön Klapası`,
        material: doorMat,
        thickness_mm: t,
        quantity: 1,
        net_length_mm: frontNetW,
        net_width_mm: frontNetH,
        cut_length_mm: fCutL,
        cut_width_mm: fCutW,
        pvc_deduction_length_mm: fDedL,
        pvc_deduction_width_mm: fDedW,
        edge_band: frontEdge,
        area_m2: round4((frontNetW * frontNetH) / 1_000_000.0),
        grain_direction: "length",
        drills: [],
        grooves: [],
        transform_3d: {
          center_x_mm: xOffsetMm,
          center_y_mm: centerY,
          center_z_mm: klapaZ,
          size_x_mm: frontNetW,
          size_y_mm: frontNetH,
          size_z_mm: t,
          color_hex: config.door_color_hex,
          is_door: false,
          is_drawer: true,
          hinge_side: null,
          module_index: moduleIdx,
        },
      });

      for (const [sCode, sName, sxSign] of [
        ["SOL", "Sol Yan Kasa", -1.0],
        ["SAG", "Sağ Yan Kasa", 1.0],
      ] as const) {
        parts.push({
          part_id: padId(partCounter++),
          code: `${prefix}CEK_${dStr}_YAN_${sCode}`,
          name: `${labelPrefix}Çekmece #${dIdx} ${sName}`,
          material: config.body_material,
          thickness_mm: t,
          quantity: 1,
          net_length_mm: slideLen,
          net_width_mm: boxH,
          cut_length_mm: bsCutL,
          cut_width_mm: bsCutW,
          pvc_deduction_length_mm: bsDedL,
          pvc_deduction_width_mm: bsDedW,
          edge_band: boxEdge,
          area_m2: round4((slideLen * boxH) / 1_000_000.0),
          grain_direction: "length",
          drills: [],
          grooves: [],
          transform_3d: {
            center_x_mm: round2(
              xOffsetMm + sxSign * (boxInnerW / 2.0 + t / 2.0)
            ),
            center_y_mm: centerY,
            center_z_mm: boxZ,
            size_x_mm: t,
            size_y_mm: boxH,
            size_z_mm: slideLen,
            color_hex: config.body_color_hex,
            is_door: false,
            is_drawer: true,
            hinge_side: null,
            module_index: moduleIdx,
          },
        });
      }

      for (const [fbCode, fbName, fbZ] of [
        ["ON", "İç Ön Kasa", round2(boxZ + slideLen / 2.0 - t / 2.0)],
        ["ARKA", "İç Arka Kasa", round2(boxZ - slideLen / 2.0 + t / 2.0)],
      ] as const) {
        parts.push({
          part_id: padId(partCounter++),
          code: `${prefix}CEK_${dStr}_${fbCode}`,
          name: `${labelPrefix}Çekmece #${dIdx} ${fbName}`,
          material: config.body_material,
          thickness_mm: t,
          quantity: 1,
          net_length_mm: boxInnerW,
          net_width_mm: boxH,
          cut_length_mm: bfCutL,
          cut_width_mm: bfCutW,
          pvc_deduction_length_mm: bfDedL,
          pvc_deduction_width_mm: bfDedW,
          edge_band: boxEdge,
          area_m2: round4((boxInnerW * boxH) / 1_000_000.0),
          grain_direction: "length",
          drills: [],
          grooves: [],
          transform_3d: {
            center_x_mm: xOffsetMm,
            center_y_mm: centerY,
            center_z_mm: fbZ,
            size_x_mm: boxInnerW,
            size_y_mm: boxH,
            size_z_mm: t,
            color_hex: config.body_color_hex,
            is_door: false,
            is_drawer: true,
            hinge_side: null,
            module_index: moduleIdx,
          },
        });
      }

      parts.push({
        part_id: padId(partCounter++),
        code: `${prefix}CEK_${dStr}_TABAN`,
        name: `${labelPrefix}Çekmece #${dIdx} Alt Tabanı (8mm)`,
        material: "8mm Beyaz MDF-Lam Arkalık",
        thickness_mm: MC.BACK_PANEL_GROOVED_THICKNESS_MM,
        quantity: 1,
        net_length_mm: bottomW,
        net_width_mm: bottomL,
        cut_length_mm: bottomW,
        cut_width_mm: bottomL,
        pvc_deduction_length_mm: 0.0,
        pvc_deduction_width_mm: 0.0,
        edge_band: noEdge,
        area_m2: round4((bottomW * bottomL) / 1_000_000.0),
        grain_direction: "length",
        drills: [],
        grooves: [],
        transform_3d: {
          center_x_mm: xOffsetMm,
          center_y_mm: round2(centerY - boxH / 2.0 + 8.0),
          center_z_mm: boxZ,
          size_x_mm: bottomW,
          size_y_mm: MC.BACK_PANEL_GROOVED_THICKNESS_MM,
          size_z_mm: bottomL,
          color_hex: "#E5E0D5",
          is_door: false,
          is_drawer: true,
          hinge_side: null,
          module_index: moduleIdx,
        },
      });
    }
  }

  // Hareketli Raflar
  if (config.shelf_count > 0 && remainingClearH > 120.0) {
    const shelfNetL = round2(innerW - MC.SHELF_WIDTH_CLEARANCE_MM);
    const rearLoss =
      config.back_panel_type === "grooved_8mm"
        ? MC.BACK_GROOVE_OFFSET_FROM_REAR_MM + MC.BACK_GROOVE_WIDTH_MM
        : 0.0;
    const shelfNetW = round2(d - rearLoss - MC.SHELF_FRONT_SETBACK_MM);
    const shelfEdge: EdgeBandSpec = {
      length_1_mm: config.front_pvc_thickness_mm,
      length_2_mm: config.hidden_pvc_thickness_mm,
      width_1_mm: config.hidden_pvc_thickness_mm,
      width_2_mm: config.hidden_pvc_thickness_mm,
    };
    const [sCutL, sCutW, sDedL, sDedW] = computeCutDimensions(
      shelfNetL,
      shelfNetW,
      shelfEdge
    );
    const stepH = remainingClearH / (config.shelf_count + 1);
    const shelfZCenter = round2((rearLoss - MC.SHELF_FRONT_SETBACK_MM) / 2.0);

    for (let sIdx = 1; sIdx <= config.shelf_count; sIdx += 1) {
      parts.push({
        part_id: padId(partCounter++),
        code: `${prefix}RAF_${String(sIdx).padStart(2, "0")}`,
        name: `${labelPrefix}Hareketli Raf #${sIdx}`,
        material: config.body_material,
        thickness_mm: t,
        quantity: 1,
        net_length_mm: shelfNetL,
        net_width_mm: shelfNetW,
        cut_length_mm: sCutL,
        cut_width_mm: sCutW,
        pvc_deduction_length_mm: sDedL,
        pvc_deduction_width_mm: sDedW,
        edge_band: shelfEdge,
        area_m2: round4((shelfNetL * shelfNetW) / 1_000_000.0),
        grain_direction: "length",
        drills: [],
        grooves: [],
        transform_3d: {
          center_x_mm: xOffsetMm,
          center_y_mm: round2(baseOffsetY + t + drawerZoneH + sIdx * stepH),
          center_z_mm: shelfZCenter,
          size_x_mm: shelfNetL,
          size_y_mm: t,
          size_z_mm: shelfNetW,
          color_hex: config.body_color_hex,
          is_door: false,
          is_drawer: false,
          hinge_side: null,
          module_index: moduleIdx,
        },
      });
    }
  }

  // Arkalık (Alt cihaz/buzdolabı niş boşluğu varsa arkalık yalnızca üst dolap arkasını kapatır)
  const noEdge: EdgeBandSpec = {
    length_1_mm: 0.0,
    length_2_mm: 0.0,
    width_1_mm: 0.0,
    width_2_mm: 0.0,
  };
  const isGrooved = config.back_panel_type === "grooved_8mm";
  const backT = isGrooved
    ? MC.BACK_PANEL_GROOVED_THICKNESS_MM
    : MC.BACK_PANEL_NAILED_THICKNESS_MM;
  const backMat = isGrooved
    ? "8mm Beyaz MDF-Lam Arkalık"
    : "3mm Beyaz Duralit Arkalık";
  const backL = isGrooved
    ? round2(clearInnerH + 2.0 * MC.BACK_PANEL_INSERTION_PER_SIDE_MM)
    : round2(h - baseOffsetY - 4.0);
  const backW = isGrooved
    ? round2(innerW + 2.0 * MC.BACK_PANEL_INSERTION_PER_SIDE_MM)
    : round2(w - 4.0);
  const backZ = isGrooved
    ? round2(
        -d / 2.0 +
          MC.BACK_GROOVE_OFFSET_FROM_REAR_MM +
          MC.BACK_GROOVE_WIDTH_MM / 2.0
      )
    : round2(-d / 2.0 - backT / 2.0);

  parts.push({
    part_id: padId(partCounter++),
    code: `${prefix}ARKALIK`,
    name: `${labelPrefix}Arkalık Paneli`,
    material: backMat,
    thickness_mm: backT,
    quantity: 1,
    net_length_mm: backL,
    net_width_mm: backW,
    cut_length_mm: backL,
    cut_width_mm: backW,
    pvc_deduction_length_mm: 0.0,
    pvc_deduction_width_mm: 0.0,
    edge_band: noEdge,
    area_m2: round4((backL * backW) / 1_000_000.0),
    grain_direction: "length",
    drills: [],
    grooves: [],
    transform_3d: {
      center_x_mm: xOffsetMm,
      center_y_mm: round2(baseOffsetY + (h - baseOffsetY) / 2.0),
      center_z_mm: backZ,
      size_x_mm: backW,
      size_y_mm: backL,
      size_z_mm: backT,
      color_hex: "#E5E0D5",
      is_door: false,
      is_drawer: false,
      hinge_side: null,
      module_index: moduleIdx,
    },
  });

  // Kapaklar
  let totalHinges = 0;
  let totalGasStruts = 0;
  const buildDoorDrills = (
    doorH: number,
    doorW: number,
    hingeOnLeft: boolean
  ): DrillPoint[] => {
    const count = hingeCountForHeight(doorH);
    const hingeY = hingeOnLeft
      ? MC.HINGE_CUP_CENTER_FROM_EDGE_MM
      : round2(doorW - MC.HINGE_CUP_CENTER_FROM_EDGE_MM);
    const topX = round2(
      Math.max(doorH - MC.HINGE_EDGE_OFFSET_TOP_BOTTOM_MM, doorH * 0.75)
    );
    const bottomX = round2(
      Math.min(MC.HINGE_EDGE_OFFSET_TOP_BOTTOM_MM, doorH * 0.25)
    );
    const step =
      count > 2 && topX > bottomX ? (topX - bottomX) / (count - 1) : 0;
    const drills: DrillPoint[] = [];
    for (let i = 0; i < count; i += 1) {
      const xPos =
        count === 2 || topX <= bottomX
          ? i === 0
            ? bottomX
            : topX
          : round2(bottomX + i * step);
      drills.push({
        x_mm: xPos,
        y_mm: hingeY,
        diameter_mm: MC.HINGE_CUP_DIAMETER_MM,
        depth_mm: MC.HINGE_CUP_DEPTH_MM,
        layer: MC.LAYER_HINGE_CUP,
        description: `Tas Menteşe Yuvası #${i + 1} (Ø35mm)`,
      });
    }
    return drills;
  };

  const doorAvailH = round2(h - baseOffsetY - drawerZoneH);
  if (config.door_type !== "none" && doorAvailH >= 240.0) {
    const doorNetH = round2(doorAvailH - 2.0 * MC.DOOR_OUTER_GAP_MM);
    const doorEdge: EdgeBandSpec = {
      length_1_mm: config.front_pvc_thickness_mm,
      length_2_mm: config.front_pvc_thickness_mm,
      width_1_mm: config.front_pvc_thickness_mm,
      width_2_mm: config.front_pvc_thickness_mm,
    };
    const doorYCenter = round2(baseOffsetY + drawerZoneH + doorAvailH / 2.0);
    const doorZCenter = round2(d / 2.0 + t / 2.0 + 1.5);

    if (config.door_type === "flap_up") {
      const doorNetW = round2(w - 2.0 * MC.DOOR_OUTER_GAP_MM);
      const [dCutL, dCutW, dDedL, dDedW] = computeCutDimensions(
        doorNetH,
        doorNetW,
        doorEdge
      );
      const topX = round2(doorNetH - MC.HINGE_CUP_CENTER_FROM_EDGE_MM);
      const leftY = round2(
        Math.min(MC.HINGE_EDGE_OFFSET_TOP_BOTTOM_MM, doorNetW * 0.2)
      );
      const rightY = round2(
        Math.max(
          doorNetW - MC.HINGE_EDGE_OFFSET_TOP_BOTTOM_MM,
          doorNetW * 0.8
        )
      );
      const dDrills: DrillPoint[] = [
        {
          x_mm: topX,
          y_mm: leftY,
          diameter_mm: MC.HINGE_CUP_DIAMETER_MM,
          depth_mm: MC.HINGE_CUP_DEPTH_MM,
          layer: MC.LAYER_HINGE_CUP,
          description: "Üst Kalkar Kapak Sol Tas Menteşe Yuvası (Ø35mm)",
        },
        {
          x_mm: topX,
          y_mm: rightY,
          diameter_mm: MC.HINGE_CUP_DIAMETER_MM,
          depth_mm: MC.HINGE_CUP_DEPTH_MM,
          layer: MC.LAYER_HINGE_CUP,
          description: "Üst Kalkar Kapak Sağ Tas Menteşe Yuvası (Ø35mm)",
        },
      ];
      totalHinges += 2;
      totalHandles += 1;
      totalGasStruts += 2;

      parts.push({
        part_id: padId(partCounter++),
        code: `${prefix}KAPAK_KALKAR`,
        name: `${labelPrefix}Kalkar Kapak (Gazlı Pistonlu)`,
        material: doorMat,
        thickness_mm: t,
        quantity: 1,
        net_length_mm: doorNetH,
        net_width_mm: doorNetW,
        cut_length_mm: dCutL,
        cut_width_mm: dCutW,
        pvc_deduction_length_mm: dDedL,
        pvc_deduction_width_mm: dDedW,
        edge_band: doorEdge,
        area_m2: round4((doorNetH * doorNetW) / 1_000_000.0),
        grain_direction: "length",
        drills: dDrills,
        grooves: [],
        transform_3d: {
          center_x_mm: xOffsetMm,
          center_y_mm: doorYCenter,
          center_z_mm: doorZCenter,
          size_x_mm: doorNetW,
          size_y_mm: doorNetH,
          size_z_mm: t,
          color_hex: config.door_color_hex,
          is_door: true,
          is_drawer: false,
          hinge_side: "top",
          module_index: moduleIdx,
        },
      });
    } else if (
      config.door_type === "single_left" ||
      config.door_type === "single_right"
    ) {
      const doorNetW = round2(w - 2.0 * MC.DOOR_OUTER_GAP_MM);
      const [dCutL, dCutW, dDedL, dDedW] = computeCutDimensions(
        doorNetH,
        doorNetW,
        doorEdge
      );
      const hingeLeft = config.door_type === "single_left";
      const dDrills = buildDoorDrills(doorNetH, doorNetW, hingeLeft);
      totalHinges += dDrills.length;
      totalHandles += 1;

      parts.push({
        part_id: padId(partCounter++),
        code: `${prefix}KAPAK_TEK`,
        name: hingeLeft
          ? `${labelPrefix}Tek Kapak (Sol Menteşeli)`
          : `${labelPrefix}Tek Kapak (Sağ Menteşeli)`,
        material: doorMat,
        thickness_mm: t,
        quantity: 1,
        net_length_mm: doorNetH,
        net_width_mm: doorNetW,
        cut_length_mm: dCutL,
        cut_width_mm: dCutW,
        pvc_deduction_length_mm: dDedL,
        pvc_deduction_width_mm: dDedW,
        edge_band: doorEdge,
        area_m2: round4((doorNetH * doorNetW) / 1_000_000.0),
        grain_direction: "length",
        drills: dDrills,
        grooves: [],
        transform_3d: {
          center_x_mm: xOffsetMm,
          center_y_mm: doorYCenter,
          center_z_mm: doorZCenter,
          size_x_mm: doorNetW,
          size_y_mm: doorNetH,
          size_z_mm: t,
          color_hex: config.door_color_hex,
          is_door: true,
          is_drawer: false,
          hinge_side: hingeLeft ? "left" : "right",
          module_index: moduleIdx,
        },
      });
    } else if (config.door_type === "double") {
      const doorNetW = round2(
        (w - 2.0 * MC.DOOR_OUTER_GAP_MM - MC.DOOR_CENTER_GAP_MM) / 2.0
      );
      const [dCutL, dCutW, dDedL, dDedW] = computeCutDimensions(
        doorNetH,
        doorNetW,
        doorEdge
      );
      for (const [sideCode, sideLabel, isLeft, relCx] of [
        [
          "SOL",
          "Sol Kapak",
          true,
          -(doorNetW / 2.0 + MC.DOOR_CENTER_GAP_MM / 2.0),
        ],
        [
          "SAG",
          "Sağ Kapak",
          false,
          doorNetW / 2.0 + MC.DOOR_CENTER_GAP_MM / 2.0,
        ],
      ] as const) {
        const dDrills = buildDoorDrills(doorNetH, doorNetW, isLeft);
        totalHinges += dDrills.length;
        totalHandles += 1;
        parts.push({
          part_id: padId(partCounter++),
          code: `${prefix}KAPAK_${sideCode}`,
          name: `${labelPrefix}${sideLabel}`,
          material: doorMat,
          thickness_mm: t,
          quantity: 1,
          net_length_mm: doorNetH,
          net_width_mm: doorNetW,
          cut_length_mm: dCutL,
          cut_width_mm: dCutW,
          pvc_deduction_length_mm: dDedL,
          pvc_deduction_width_mm: dDedW,
          edge_band: doorEdge,
          area_m2: round4((doorNetH * doorNetW) / 1_000_000.0),
          grain_direction: "length",
          drills: dDrills,
          grooves: [],
          transform_3d: {
            center_x_mm: round2(xOffsetMm + relCx),
            center_y_mm: doorYCenter,
            center_z_mm: doorZCenter,
            size_x_mm: doorNetW,
            size_y_mm: doorNetH,
            size_z_mm: t,
            color_hex: config.door_color_hex,
            is_door: true,
            is_drawer: false,
            hinge_side: isLeft ? "left" : "right",
            module_index: moduleIdx,
          },
        });
      }
    }
  }

  const minifixSets = connectionDepthCoords(d).length * 4 + drawerCount * 4;
  const dowelCount = minifixSets + (config.has_plinth && plinthH > 0 ? 8 : 0);

  return {
    parts,
    nextCounter: partCounter,
    minifixSets,
    dowelCount,
    totalHinges,
    totalHandles,
    totalGasStruts,
  };
}

export function generateBomLocal(config: CabinetConfig): BOMReport {
  const allModules: CabinetConfig[] = [
    config,
    ...(config.additional_modules ?? []),
  ];
  const multiMode = allModules.length > 1;
  const totalLineWidth = allModules.reduce((acc, m) => acc + m.width_mm, 0);
  let currentLeftX = -totalLineWidth / 2.0;

  const parts: PanelPart[] = [];
  let partCounter = 1;
  let totalMinifix = 0;
  let totalDowels = 0;
  let totalHinges = 0;
  let totalHandles = 0;
  let totalGasStruts = 0;
  let totalShelfPins = 0;
  let totalDrawerSlides = 0;

  allModules.forEach((modCfg, idx) => {
    const centerXOffset = round2(currentLeftX + modCfg.width_mm / 2.0);
    currentLeftX += modCfg.width_mm;

    const res = generateSingleModuleParts(
      modCfg,
      idx + 1,
      centerXOffset,
      partCounter,
      multiMode
    );
    parts.push(...res.parts);
    partCounter = res.nextCounter;
    totalMinifix += res.minifixSets;
    totalDowels += res.dowelCount;
    totalHinges += res.totalHinges;
    totalHandles += res.totalHandles;
    totalGasStruts += res.totalGasStruts;
    totalShelfPins += modCfg.shelf_count * 4;
    totalDrawerSlides += modCfg.drawer_count ?? 0;
  });

  let pvc04Mm = 0;
  let pvc10Mm = 0;
  let pvc20Mm = 0;
  let totalNetArea = 0;
  let totalCutArea = 0;
  let totalDrills = 0;

  for (const part of parts) {
    totalNetArea += part.area_m2 * part.quantity;
    totalCutArea +=
      ((part.cut_length_mm * part.cut_width_mm) / 1_000_000.0) * part.quantity;
    totalDrills += part.drills.length * part.quantity;
    const edges: [number, number][] = [
      [part.edge_band.length_1_mm, part.net_length_mm],
      [part.edge_band.length_2_mm, part.net_length_mm],
      [part.edge_band.width_1_mm, part.net_width_mm],
      [part.edge_band.width_2_mm, part.net_width_mm],
    ];
    for (const [pvcT, len] of edges) {
      if (Math.abs(pvcT - 0.4) < 0.05) pvc04Mm += len * part.quantity;
      else if (Math.abs(pvcT - 1.0) < 0.05) pvc10Mm += len * part.quantity;
      else if (Math.abs(pvcT - 2.0) < 0.05) pvc20Mm += len * part.quantity;
    }
  }

  const pvc04M = round2(pvc04Mm / 1000.0);
  const pvc10M = round2(pvc10Mm / 1000.0);
  const pvc20M = round2(pvc20Mm / 1000.0);

  const hardware: HardwareItem[] = [
    {
      code: "HRD-MNFX-15",
      name: "Minifiks Bağlantı Takımı (Ø15 Eksantrik + Mil)",
      unit: "Takım",
      quantity: totalMinifix,
      note: "Gövde ve çekmece kasa birleştirmeleri",
    },
    {
      code: "HRD-KVLA-08",
      name: "Ahşap Kavela (Ø8x35mm)",
      unit: "Adet",
      quantity: totalDowels,
      note: "Sistem 32 kavela delikleri ve baza kayıtları",
    },
  ];

  if (totalShelfPins > 0) {
    hardware.push({
      code: "HRD-RAFP-05",
      name: "Çelik Raf Pimi (Ø5mm)",
      unit: "Adet",
      quantity: totalShelfPins,
      note: "Hareketli raflar için (raf başı 4 adet)",
    });
  }
  if (totalDrawerSlides > 0) {
    const slideLen = selectDrawerSlideLength(config.depth_mm);
    hardware.push({
      code: `HRD-CRAY-${slideLen}`,
      name: `Frenli Teleskopik Çekmece Rayı (${slideLen}mm)`,
      unit: "Takım",
      quantity: totalDrawerSlides,
      note: `${totalDrawerSlides} adet çekmece için sağ/sol ray takımı`,
    });
  }
  if (totalHinges > 0) {
    hardware.push({
      code: "HRD-MNTS-35",
      name: "Frenli Düz Tas Menteşe (Ø35mm)",
      unit: "Adet",
      quantity: totalHinges,
      note: "Kapak bağlantıları için",
    });
  }
  if (totalGasStruts > 0) {
    hardware.push({
      code: "HRD-PSTN-100",
      name: "Gazlı Piston Kalkar Kapak Makası (100N)",
      unit: "Adet",
      quantity: totalGasStruts,
      note: "Üst kalkar kapak sağ/sol amortisörleri",
    });
  }
  if (totalHandles > 0) {
    hardware.push({
      code: "HRD-KULP-160",
      name: "Alüminyum Mobilya Kulpu (160mm)",
      unit: "Adet",
      quantity: totalHandles,
      note: "Kapak ve çekmece kulpları",
    });
  }
  if (pvc20M > 0) {
    hardware.push({
      code: "PVC-20-22",
      name: "2.0 mm × 22 mm PVC Kenar Bandı",
      unit: "Metre",
      quantity: pvc20M,
      note: "Görünen ön kenarlar, kapaklar ve çekmece klapaları",
    });
  }
  if (pvc10M > 0) {
    hardware.push({
      code: "PVC-10-22",
      name: "1.0 mm × 22 mm PVC Kenar Bandı",
      unit: "Metre",
      quantity: pvc10M,
      note: "Ara kenarlar",
    });
  }
  if (pvc04M > 0) {
    hardware.push({
      code: "PVC-04-22",
      name: "0.4 mm × 22 mm PVC Kenar Bandı",
      unit: "Metre",
      quantity: pvc04M,
      note: "Gizli / arka kenarlar ve çekmece iç kasaları",
    });
  }

  return {
    config,
    parts,
    hardware,
    total_net_area_m2: round4(totalNetArea),
    total_cut_area_m2: round4(totalCutArea),
    total_pvc_04_meters: pvc04M,
    total_pvc_10_meters: pvc10M,
    total_pvc_20_meters: pvc20M,
    total_parts_count: parts.reduce((acc, p) => acc + p.quantity, 0),
    total_drill_count: totalDrills,
  };
}

/**
 * 3. 2D Giyotin Plaka Kesim Optimizasyonu (Nesting) ve SVG Üretici
 */
interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function packGuillotineSheet(
  usableW: number,
  usableH: number,
  kerfMm: number,
  remainingParts: PanelPart[],
  sheetIndex: number,
  trimMm: number
): { placed: NestedPartPlacement[]; unplaced: PanelPart[] } {
  const freeRects: FreeRect[] = [
    { x: 0, y: 0, w: usableW + kerfMm, h: usableH + kerfMm },
  ];
  const placed: NestedPartPlacement[] = [];
  const unplaced: PanelPart[] = [];

  const sorted = [...remainingParts].sort(
    (a, b) =>
      b.cut_length_mm * b.cut_width_mm - a.cut_length_mm * a.cut_width_mm
  );

  for (const part of sorted) {
    const rw = part.cut_length_mm + kerfMm;
    const rh = part.cut_width_mm + kerfMm;

    let bestIdx = -1;
    let bestShortSide = Number.POSITIVE_INFINITY;
    let bestRotated = false;

    for (let i = 0; i < freeRects.length; i += 1) {
      const fr = freeRects[i];
      if (rw <= fr.w && rh <= fr.h) {
        const shortSide = Math.min(fr.w - rw, fr.h - rh);
        if (shortSide < bestShortSide) {
          bestShortSide = shortSide;
          bestIdx = i;
          bestRotated = false;
        }
      }
      if (rh <= fr.w && rw <= fr.h) {
        const shortSide = Math.min(fr.w - rh, fr.h - rw);
        if (shortSide < bestShortSide) {
          bestShortSide = shortSide;
          bestIdx = i;
          bestRotated = true;
        }
      }
    }

    if (bestIdx === -1) {
      unplaced.push(part);
      continue;
    }

    const chosen = freeRects.splice(bestIdx, 1)[0];
    const usedW = bestRotated ? rh : rw;
    const usedH = bestRotated ? rw : rh;

    placed.push({
      part_id: part.part_id,
      code: part.code,
      name: part.name,
      thickness_mm: part.thickness_mm,
      sheet_index: sheetIndex,
      x_mm: round2(chosen.x + trimMm),
      y_mm: round2(chosen.y + trimMm),
      width_mm: round2(usedW - kerfMm),
      height_mm: round2(usedH - kerfMm),
      rotated: bestRotated,
      cut_length_mm: part.cut_length_mm,
      cut_width_mm: part.cut_width_mm,
    });

    const remW = chosen.w - usedW;
    const remH = chosen.h - usedH;
    if (remW > 0 && remH > 0) {
      if (remW < remH) {
        freeRects.push({
          x: chosen.x + usedW,
          y: chosen.y,
          w: remW,
          h: usedH,
        });
        freeRects.push({
          x: chosen.x,
          y: chosen.y + usedH,
          w: chosen.w,
          h: remH,
        });
      } else {
        freeRects.push({
          x: chosen.x,
          y: chosen.y + usedH,
          w: usedW,
          h: remH,
        });
        freeRects.push({
          x: chosen.x + usedW,
          y: chosen.y,
          w: remW,
          h: chosen.h,
        });
      }
    } else if (remW > 0) {
      freeRects.push({
        x: chosen.x + usedW,
        y: chosen.y,
        w: remW,
        h: chosen.h,
      });
    } else if (remH > 0) {
      freeRects.push({
        x: chosen.x,
        y: chosen.y + usedH,
        w: chosen.w,
        h: remH,
      });
    }
  }

  return { placed, unplaced };
}

function renderSheetSvg(
  sheetIndex: number,
  material: string,
  sheetW: number,
  sheetH: number,
  trimMm: number,
  wastePct: number,
  placements: NestedPartPlacement[]
): string {
  const viewW = 960;
  const scale = (viewW - 40) / sheetW;
  const viewH = Math.round(sheetH * scale) + 80;
  const ox = 20;
  const oy = 55;
  const usableW = sheetW - 2 * trimMm;
  const usableH = sheetH - 2 * trimMm;

  const palette: [string, string][] = [
    ["#0284C7", "#E0F2FE"],
    ["#0D9488", "#CCFBF1"],
    ["#4F46E5", "#E0E7FF"],
    ["#D97706", "#FEF3C7"],
    ["#7C3AED", "#EDE9FE"],
    ["#059669", "#D1FAE5"],
  ];

  const lines: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewW} ${viewH}" width="100%" height="100%" font-family="Inter, system-ui, sans-serif">`,
    `<rect width="100%" height="100%" fill="#0F172A" rx="8" />`,
    `<text x="${ox}" y="28" fill="#F8FAFC" font-size="14" font-weight="700">Plaka #${sheetIndex} — ${material} (${sheetW} × ${sheetH} mm)</text>`,
    `<text x="${viewW - ox}" y="28" text-anchor="end" fill="#38BDF8" font-size="13" font-weight="600">Verimlilik: %${(100 - wastePct).toFixed(1)} | Fire: %${wastePct.toFixed(1)}</text>`,
    `<text x="${ox}" y="44" fill="#94A3B8" font-size="11">Net Kullanılabilir Alan: ${usableW} × ${usableH} mm (Kenar Temizlik: ${trimMm} mm | Testere Kerf: ${MC.SAW_KERF_MM.toFixed(1)} mm)</text>`,
    `<rect x="${ox}" y="${oy}" width="${(sheetW * scale).toFixed(1)}" height="${(sheetH * scale).toFixed(1)}" fill="#1E293B" stroke="#475569" stroke-width="1.5" />`,
    `<rect x="${(ox + trimMm * scale).toFixed(1)}" y="${(oy + trimMm * scale).toFixed(1)}" width="${(usableW * scale).toFixed(1)}" height="${(usableH * scale).toFixed(1)}" fill="none" stroke="#64748B" stroke-width="1" stroke-dasharray="5,4" />`,
  ];

  placements.forEach((p, idx) => {
    const [fillColor, textColor] = palette[idx % palette.length];
    const px = ox + p.x_mm * scale;
    const py = oy + (sheetH - p.y_mm - p.height_mm) * scale;
    const pw = p.width_mm * scale;
    const ph = p.height_mm * scale;

    lines.push(
      `<g class="part-group"><rect x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${pw.toFixed(2)}" height="${ph.toFixed(2)}" fill="${fillColor}" fill-opacity="0.85" stroke="#F8FAFC" stroke-width="1.2" />`
    );
    if (pw > 38 && ph > 20) {
      const cx = px + pw / 2;
      const cy = py + ph / 2;
      const rotTag = p.rotated ? " [90°]" : "";
      lines.push(
        `<text x="${cx.toFixed(1)}" y="${(cy - 2).toFixed(1)}" text-anchor="middle" fill="${textColor}" font-size="9.5" font-weight="700">${p.part_id} ${p.code}${rotTag}</text>`
      );
      lines.push(
        `<text x="${cx.toFixed(1)}" y="${(cy + 9).toFixed(1)}" text-anchor="middle" fill="#E2E8F0" font-size="8.5">${p.cut_length_mm}×${p.cut_width_mm}</text>`
      );
    }
    lines.push(`</g>`);
  });

  lines.push(`</svg>`);
  return lines.join("\n");
}

export function runNestingLocal(bom: BOMReport): NestingResult {
  const sheetSize: SheetSizeOption = bom.config.sheet_size;
  const [sheetW, sheetH] =
    sheetSize === "3660x1830" ? [3660.0, 1830.0] : [2800.0, 2100.0];
  const trimMm = MC.SHEET_TRIM_MARGIN_MM;
  const kerfMm = MC.SAW_KERF_MM;
  const usableW = round2(sheetW - 2.0 * trimMm);
  const usableH = round2(sheetH - 2.0 * trimMm);
  const sheetGrossAreaM2 = (sheetW * sheetH) / 1_000_000.0;

  const groups = new Map<string, PanelPart[]>();
  for (const part of bom.parts) {
    const key = `${part.thickness_mm}__${part.material}`;
    const list = groups.get(key) ?? [];
    for (let q = 0; q < part.quantity; q += 1) {
      list.push(part);
    }
    groups.set(key, list);
  }

  const allSheets: SheetLayout[] = [];
  let globalSheetIdx = 1;

  for (const [key, groupParts] of groups.entries()) {
    const [thickStr, material] = key.split("__");
    const thicknessMm = parseFloat(thickStr);
    let queue = [...groupParts];

    while (queue.length > 0) {
      const { placed, unplaced } = packGuillotineSheet(
        usableW,
        usableH,
        kerfMm,
        queue,
        globalSheetIdx,
        trimMm
      );
      if (placed.length === 0) break;

      const usedAreaM2 = round4(
        placed.reduce(
          (acc, p) => acc + (p.width_mm * p.height_mm) / 1_000_000.0,
          0
        )
      );
      const wasteAreaM2 = round4(Math.max(0, sheetGrossAreaM2 - usedAreaM2));
      const wastePct = round2((wasteAreaM2 / sheetGrossAreaM2) * 100.0);

      const svgContent = renderSheetSvg(
        globalSheetIdx,
        material,
        sheetW,
        sheetH,
        trimMm,
        wastePct,
        placed
      );

      allSheets.push({
        sheet_index: globalSheetIdx,
        material,
        thickness_mm: thicknessMm,
        sheet_width_mm: sheetW,
        sheet_height_mm: sheetH,
        usable_width_mm: usableW,
        usable_height_mm: usableH,
        trim_margin_mm: trimMm,
        kerf_mm: kerfMm,
        used_area_m2: usedAreaM2,
        waste_area_m2: wasteAreaM2,
        waste_percentage: wastePct,
        placements: placed,
        svg_content: svgContent,
      });

      globalSheetIdx += 1;
      queue = unplaced;
    }
  }

  const totalSheets = allSheets.length;
  const totalGrossM2 = totalSheets * sheetGrossAreaM2;
  const totalUsedM2 = allSheets.reduce((acc, s) => acc + s.used_area_m2, 0);
  const overallEff =
    totalGrossM2 > 0 ? round2((totalUsedM2 / totalGrossM2) * 100.0) : 0;

  return {
    sheet_width_mm: sheetW,
    sheet_height_mm: sheetH,
    kerf_mm: kerfMm,
    total_sheets: totalSheets,
    overall_efficiency_percentage: overallEff,
    overall_waste_percentage: round2(100.0 - overallEff),
    sheets: allSheets,
    combined_svg: allSheets.map((s) => s.svg_content).join("\n"),
  };
}

/**
 * 4. CNC DXF (AutoCAD R2010), ISO G-Code (.nc) ve Homag WoodWOP (.mpr) Üretici
 */
export function generatePartDxfString(part: PanelPart): string {
  const lines: string[] = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$ACADVER",
    "1",
    "AC1024",
    "9",
    "$INSUNITS",
    "70",
    "4",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
  ];

  const addRectLwPolyline = (
    x0: number,
    y0: number,
    w: number,
    h: number,
    layer: string
  ) => {
    const coords: [number, number][] = [
      [x0, y0],
      [x0 + w, y0],
      [x0 + w, y0 + h],
      [x0, y0 + h],
    ];
    lines.push("0", "LWPOLYLINE", "8", layer, "90", "4", "70", "1");
    for (const [cx, cy] of coords) {
      lines.push("10", cx.toFixed(2), "20", cy.toFixed(2));
    }
  };

  addRectLwPolyline(0, 0, part.cut_length_mm, part.cut_width_mm, MC.LAYER_OUTLINE);

  for (const g of part.grooves) {
    addRectLwPolyline(
      g.x_start_mm,
      g.y_start_mm,
      g.width_mm,
      g.length_mm,
      g.layer
    );
  }

  for (const d of part.drills) {
    const r = d.diameter_mm / 2.0;
    lines.push(
      "0",
      "CIRCLE",
      "8",
      d.layer,
      "10",
      d.x_mm.toFixed(2),
      "20",
      d.y_mm.toFixed(2),
      "30",
      "0.0",
      "40",
      r.toFixed(2)
    );
  }

  lines.push("0", "ENDSEC", "0", "EOF");
  return lines.join("\n");
}

export function generatePartGcodeString(part: PanelPart): string {
  const cutL = part.cut_length_mm;
  const cutW = part.cut_width_mm;
  const t = part.thickness_mm;

  const lines: string[] = [
    "%",
    `(MARANGOZ CAM POST-PROCESSOR - ISO G-CODE)`,
    `(PARCA: ${part.part_id} ${part.code} - ${part.name})`,
    `(KESIM EBADI: ${cutL.toFixed(2)} x ${cutW.toFixed(2)} x ${t.toFixed(1)} mm)`,
    "G21 G90 G17 G40 G49 G80",
    "G0 Z35.000",
  ];

  if (part.grooves.length > 0) {
    lines.push(
      "(--- OP 1: 8MM ARKALIK KANALI FREZELEME ---)",
      "T1 M6 (D8.0 KARBUR PARMAK FREZE)",
      "S18000 M3"
    );
    part.grooves.forEach((g, idx) => {
      const gx0 = g.x_start_mm;
      const gy0 = g.y_start_mm + g.length_mm / 2.0;
      const gx1 = g.x_start_mm + g.width_mm;
      lines.push(
        `(KANAL #${idx + 1}: ${g.layer})`,
        `G0 X${gx0.toFixed(3)} Y${gy0.toFixed(3)}`,
        "G0 Z5.000",
        `G1 Z-${Math.abs(g.depth_mm).toFixed(3)} F1500`,
        `G1 X${gx1.toFixed(3)} Y${gy0.toFixed(3)} F4500`,
        "G0 Z25.000"
      );
    });
  }

  if (part.drills.length > 0) {
    lines.push(
      "(--- OP 2: SISTEM 32 CNC DELIK DELME ---)",
      "T2 M6 (COKLU DELIK UNITE / MATKAP)",
      "S6000 M3"
    );
    part.drills.forEach((d, idx) => {
      lines.push(
        `(DELIK #${idx + 1}: ${d.layer} D=${d.diameter_mm.toFixed(1)}mm)`,
        `G81 X${d.x_mm.toFixed(3)} Y${d.y_mm.toFixed(3)} Z-${Math.abs(d.depth_mm).toFixed(3)} R5.000 F1800`
      );
    });
    lines.push("G80", "G0 Z35.000");
  }

  const cutZ = -(t + 0.5);
  lines.push(
    "(--- OP 3: DIS KONTUR EBATLAMA ---)",
    "T1 M6 (D8.0 KARBUR PARMAK FREZE)",
    "S18000 M3",
    "G0 X0.000 Y0.000",
    "G0 Z5.000",
    `G1 Z${cutZ.toFixed(3)} F1500`,
    `G1 X${cutL.toFixed(3)} Y0.000 F5000`,
    `G1 X${cutL.toFixed(3)} Y${cutW.toFixed(3)}`,
    `G1 X0.000 Y${cutW.toFixed(3)}`,
    "G1 X0.000 Y0.000",
    "G0 Z50.000",
    "M5",
    "M30",
    "%"
  );
  return lines.join("\n");
}

export function generatePartMprString(part: PanelPart): string {
  const cutL = part.cut_length_mm;
  const cutW = part.cut_width_mm;
  const t = part.thickness_mm;

  const lines: string[] = [
    "[H",
    'VERSION="4.0 Alpha"',
    "OP=1",
    "FM=1",
    "VIEW=NOMIRROR",
    `BSX=${cutL.toFixed(2)}`,
    `BSY=${cutW.toFixed(2)}`,
    `BSZ=${t.toFixed(2)}`,
    "FNX=0.00",
    "FNY=0.00",
    `MAT="${part.material}"`,
    "",
    "<100 \\WerkStck\\",
    'LA="BSX"',
    'BR="BSY"',
    'DI="BSZ"',
    'FNX="FNX"',
    'FNY="FNY"',
    "",
  ];

  for (const g of part.grooves) {
    const cx = g.x_start_mm + g.width_mm / 2.0;
    const cy = g.y_start_mm + g.length_mm / 2.0;
    lines.push(
      "<112 \\Tasche\\",
      `XA="${cx.toFixed(2)}"`,
      `YA="${cy.toFixed(2)}"`,
      `LA="${g.width_mm.toFixed(2)}"`,
      `BR="${g.length_mm.toFixed(2)}"`,
      `TI="${g.depth_mm.toFixed(2)}"`,
      'T_="101"',
      'F_="5"',
      ""
    );
  }

  for (const d of part.drills) {
    lines.push(
      "<102 \\BohrVert\\",
      `XA="${d.x_mm.toFixed(2)}"`,
      `YA="${d.y_mm.toFixed(2)}"`,
      'BM="LS"',
      `TI="${d.depth_mm.toFixed(2)}"`,
      `DU="${d.diameter_mm.toFixed(2)}"`,
      'AN="1"',
      ""
    );
  }

  lines.push("!");
  return lines.join("\n");
}

/**
 * 5. Standart ZIP Arşivi Oluşturucu
 */
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function createZipBlob(
  files: { name: string; content: string | Uint8Array }[]
): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes =
      typeof file.content === "string"
        ? encoder.encode(file.content)
        : file.content;
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + size;
  }

  const centralSize = centralParts.reduce((acc, p) => acc + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, eocd], {
    type: "application/zip",
  });
}

function buildBomCsvString(bom: BOMReport): string {
  const header = [
    "Parca_ID",
    "Kod",
    "Parca_Adi",
    "Malzeme",
    "Kalinlik_mm",
    "Adet",
    "Net_Boy_mm",
    "Net_En_mm",
    "Kesim_Boy_mm",
    "Kesim_En_mm",
    "PVC_Boy_Dusum_mm",
    "PVC_En_Dusum_mm",
    "PVC_On_mm",
    "PVC_Arka_mm",
    "PVC_Ust_mm",
    "PVC_Alt_mm",
    "Alan_m2",
    "CNC_Delik_Sayisi",
  ].join(",");

  const rows = bom.parts.map((p) =>
    [
      p.part_id,
      p.code,
      `"${p.name}"`,
      `"${p.material}"`,
      p.thickness_mm,
      p.quantity,
      p.net_length_mm,
      p.net_width_mm,
      p.cut_length_mm,
      p.cut_width_mm,
      p.pvc_deduction_length_mm,
      p.pvc_deduction_width_mm,
      p.edge_band.length_1_mm,
      p.edge_band.length_2_mm,
      p.edge_band.width_1_mm,
      p.edge_band.width_2_mm,
      p.area_m2,
      p.drills.length,
    ].join(",")
  );
  return [header, ...rows].join("\n");
}

const localDxfBlobUrls = new Map<string, string>();
const localGcodeBlobUrls = new Map<string, string>();
const localMprBlobUrls = new Map<string, string>();

export function getLocalDxfBlobUrl(filename: string): string | undefined {
  return localDxfBlobUrls.get(filename);
}
export function getLocalGcodeBlobUrl(filename: string): string | undefined {
  return localGcodeBlobUrls.get(filename);
}
export function getLocalMprBlobUrl(filename: string): string | undefined {
  return localMprBlobUrls.get(filename);
}

export function generateProductionPackageLocal(
  config: CabinetConfig
): ProductionPackageResponse {
  const jobId = Math.random().toString(16).slice(2, 14);
  const bom = generateBomLocal(config);
  const nesting = runNestingLocal(bom);

  const zipFiles: { name: string; content: string | Uint8Array }[] = [
    {
      name: "bom/kesim_ve_malzeme_listesi.csv",
      content: buildBomCsvString(bom),
    },
    {
      name: "bom/bom_report.json",
      content: JSON.stringify(bom, null, 2),
    },
  ];

  for (const sheet of nesting.sheets) {
    zipFiles.push({
      name: `nesting/plaka_${String(sheet.sheet_index).padStart(2, "0")}_kesim_semasi.svg`,
      content: sheet.svg_content,
    });
  }

  const dxfFilenames: string[] = [];
  for (const part of bom.parts) {
    const baseName = `${part.part_id}_${part.code}`;
    const dxfName = `${baseName}.dxf`;
    const ncName = `${baseName}.nc`;
    const mprName = `${baseName}.mpr`;

    const dxfContent = generatePartDxfString(part);
    const ncContent = generatePartGcodeString(part);
    const mprContent = generatePartMprString(part);

    dxfFilenames.push(dxfName);
    zipFiles.push(
      { name: `cnc_dxf/${dxfName}`, content: dxfContent },
      { name: `cnc_gcode/${ncName}`, content: ncContent },
      { name: `cnc_mpr/${mprName}`, content: mprContent }
    );

    localDxfBlobUrls.set(
      dxfName,
      URL.createObjectURL(new Blob([dxfContent], { type: "application/dxf" }))
    );
    localGcodeBlobUrls.set(
      ncName,
      URL.createObjectURL(new Blob([ncContent], { type: "text/plain" }))
    );
    localMprBlobUrls.set(
      mprName,
      URL.createObjectURL(new Blob([mprContent], { type: "text/plain" }))
    );
  }

  const zipBlob = createZipBlob(zipFiles);
  const zipBlobUrl = URL.createObjectURL(zipBlob);

  return {
    job_id: jobId,
    config,
    bom,
    nesting,
    glb_base64: "",
    dxf_filenames: dxfFilenames,
    zip_download_url: zipBlobUrl,
  };
}
