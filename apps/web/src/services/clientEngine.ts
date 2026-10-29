/**
 * Tarayıcı İçi Deterministik Mühendislik Motoru
 * (BOM + Çekmece Kasa + Çoklu Modül Oda Hattı + Cabineo 3-Eksen + Rölöve Kertme/Kör Çıta + DXF R2010 + G-Code .nc + WoodWOP .mpr + Biesse .cix + Nesting Artık Depo + QR Etiket + ZIP).
 */

import type {
  BOMReport,
  CabinetConfig,
  CabinetType,
  CabinetZone,
  CatalogCategoryMeta,
  CuttingMode,
  DoorType,
  DrillPoint,
  EdgeBandSpec,
  FastenerType,
  GroovePath,
  HardwareItem,
  NestedPartPlacement,
  NestingResult,
  PanelPart,
  PlinthType,
  ProductionPackageResponse,
  RemnantStockItem,
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
  CNC_ROUTER_BIT_DIAMETER_MM: 10.0,
  REMNANT_MIN_DIM_SHORT_MM: 400.0,
  REMNANT_MIN_DIM_LONG_MM: 600.0,
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
  CABINEO_POCKET_DIAMETER_MM: 15.0,
  CABINEO_POCKET_DEPTH_MM: 10.8,
  CABINEO_POCKET_OFFSET_FROM_EDGE_MM: 16.0,
  CABINEO_SCREW_DIAMETER_MM: 5.0,
  CABINEO_SCREW_DEPTH_MM: 12.0,
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
  LAYER_NOTCH_CUT: "OUTLINE_NOTCH_CUT",
  LAYER_GROOVE_BACK: "GROOVE_BACK_8MM",
  LAYER_MINIFIX_CAM: "DRILL_MINIFIX_CAM_D15",
  LAYER_MINIFIX_BOLT: "DRILL_MINIFIX_BOLT_D8",
  LAYER_DOWEL: "DRILL_DOWEL_D8",
  LAYER_CABINEO_POCKET: "LAYER_CABINEO_POCKET_Z108",
  LAYER_CABINEO_SCREW: "DRILL_CABINEO_SCREW_D5",
  LAYER_SHELF_PIN: "DRILL_SHELF_PIN_D5",
  LAYER_HINGE_CUP: "DRILL_HINGE_CUP_D35",
  LAYER_DRAWER_SLIDE: "DRILL_SLIDE_D5",
} as const;

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

/**
 * Üretim Kataloğu Kategori Tanımları (6 Ana Mobilya & Oda Kategorisi)
 */
export const CATALOG_CATEGORIES: readonly CatalogCategoryMeta[] = [
  {
    id: "kitchen",
    label: "Mutfak & Ankastre Sistemleri",
    description:
      "Solo buzdolabı çevreleme nişi, evye altı, teleskopik çekmeceli kaşıklık/tencere, gazlı pistonlu üst dolap, boy kiler ve komple mutfak hatları",
  },
  {
    id: "bedroom",
    label: "Yatak Odası & Gardırop",
    description:
      "Çift kapaklı gardırop, tavandan tabana yüklük, 4 çekmeceli şifonyer, komodin ve 270 cm 6 kapaklı master gardırop hatları",
  },
  {
    id: "bathroom",
    label: "Banyo & Çamaşır Odası",
    description:
      "Çamaşır makinesi üstü nişli dolap kulesi, asma çekmeceli lavabo altı dolabı, banyo boy dolabı ve komple banyo setleri",
  },
  {
    id: "living",
    label: "Salon, TV Ünitesi & Kitaplık",
    description:
      "Geniş TV medya konsolu, kalkar kapaklı duvar modülü, 5 raflı Sistem 32 kitaplık, çekmeceli vitrin kulesi ve 280 cm salon duvar hattı",
  },
  {
    id: "hallway",
    label: "Antre, Vestiyer & Portmanto",
    description:
      "Çekmeceli yüksek ayakkabılık, oturma banklı antre modülü, robot süpürge nişli boy portmanto ve komple vestiyer hatları",
  },
  {
    id: "office",
    label: "Ofis, Çalışma & Arşiv",
    description:
      "Tam boy çift kapaklı klasör arşiv dolabı, 3 çekmeceli masa altı keson ve ikili kurumsal ofis arşiv duvarı",
  },
  {
    id: "special",
    label: "Çatı Eğimi, L-Köşe & Özel Mimari",
    description:
      "Merdiven altı ve mansard çatı eğimli dolaplar, 90° kör panelli L-köşe modülleri, kolon/süpürgelik kertmeli ve rölöve kör çıtalı özel üretim şablonları",
  },
];

/**
 * Fabrika Oda ve Kategori Hatları (29 Hazır Mühendislik Şablonu: Tekil Modüller + Çoklu Modül Oda Hatları)
 */
export const ROOM_LINE_PRESETS: readonly RoomLinePreset[] = [
  // ============================================================================
  // 1. MUTFAK & ANKASTRE SİSTEMLERİ (7 Şablon)
  // ============================================================================
  {
    id: "kitchen_fridge_enclosure",
    categoryId: "kitchen",
    category: "Mutfak & Ankastre",
    title: "Solo Buzdolabı Çevreleme (Gömme) Modülü (85×235×65 cm)",
    subtitle:
      "Alt 185 cm açık buzdolabı nişi (arkalıksız) + Üst 50 cm gazlı pistonlu kalkar kapaklı meşe MDF-Lam depolama dolabı",
    totalWidthMm: 850,
    prompt:
      "Mutfakta solo buzdolabımızın etrafını saracak bir buzdolabı çevreleme (gömme) dolap modülü tasarlamak istiyorum. Dolabın toplam dış ölçüleri: Yükseklik 235 cm, genişlik 85 cm, derinlik 65 cm olsun. Alt kısımda buzdolabının rahat oturması ve hava sirkülasyonu için net 80 cm genişliğinde ve 185 cm yüksekliğinde açık bir niş (boşluk) bırakılsın; buzdolabının arkasına arkalık konmasın, açık kalsın. Buzdolabının üstünde kalan boşluğa ise yukarı doğru açılan (gazlı pistonlu) tek parça kalkar kapaklı derin bir üst depolama dolabı yerleştirilsin. Yan dikmeler tavandan tabana kadar yekpare 18 mm gövde malzemesi olarak insin. Gövde 18 mm beyaz suntalam, üst kapak 18 mm meşe desen MDF-Lam olsun. Üst dolabın arkalığı 8 mm kanala geçme yapılsın. Birleşimler minifix ve kavela ile System 32 standardında delinsin.",
    highlights: ["1850mm Açık Niş", "Gazlı Piston Kalkar Kapak", "Bazasız Yekpare Yan", "8mm Kanallı Üst Arkalık"],
    config: {
      name: "Buzdolabı Çevreleme (Gömme) Modülü",
      cabinet_type: "kitchen_tall",
      width_mm: 850,
      height_mm: 2350,
      depth_mm: 650,
      shelf_count: 0,
      door_type: "flap_up",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      appliance_niche_height_mm: 1850,
      has_plinth: false,
      plinth_height_mm: 0,
      body_material: "18mm Beyaz Suntalam",
      door_material: "18mm Doğal Meşe MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#C89F70",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "kitchen_sink_base_80",
    categoryId: "kitchen",
    category: "Mutfak & Ankastre",
    title: "Çift Kapaklı Mutfak Evye Altı Modülü (80×82×56 cm)",
    subtitle:
      "10 cm bazalı, çift kapaklı, 1 hareketli raflı standart tezgah altı mutfak modülü",
    totalWidthMm: 800,
    prompt:
      "80 cm genişliğinde, 82 cm yüksekliğinde, 56 cm derinliğinde, 1 hareketli raflı, çift kapaklı, 10 cm bazalı, beyaz gövdeli antrasit kapaklı mutfak evye altı dolabı",
    highlights: ["Çift Kapak (Ø35mm)", "100mm Alt Baza", "1 Hareketli Raf", "2.0mm Ön PVC"],
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
      door_material: "18mm Antrasit MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "kitchen_drawer_base_60",
    categoryId: "kitchen",
    category: "Mutfak & Ankastre",
    title: "3 Çekmeceli Mutfak Kaşıklık & Tencere Modülü (60×82×56 cm)",
    subtitle:
      "500 mm frenli teleskopik raylı 3 adet tam boy çekmece kasası, kapaksız tezgah altı modülü",
    totalWidthMm: 600,
    prompt:
      "60 cm genişliğinde, 82 cm yüksekliğinde, 56 cm derinliğinde, rafsız, kapaksız, 3 çekmeceli, beyaz gövdeli meşe kapaklı mutfak alt dolap modülü",
    highlights: ["3 Çekmece Kasası (15 Parça)", "500mm Teleskopik Ray", "26mm Ray Boşluğu", "8mm Çekmece Tabanı"],
    config: {
      name: "3 Çekmeceli Mutfak Alt Modülü",
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
      door_material: "18mm Doğal Meşe MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#C89F70",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "kitchen_wall_flap_80",
    categoryId: "kitchen",
    category: "Mutfak & Ankastre",
    title: "Gazlı Pistonlu Kalkar Kapaklı Mutfak Üst Dolabı (80×72×35 cm)",
    subtitle:
      "Duvara asma (bazasız), 100N gazlı pistonlu yukarı açılır kalkar kapak ve 2 hareketli raf",
    totalWidthMm: 800,
    prompt:
      "80 cm genişliğinde, 72 cm yüksekliğinde, 35 cm derinliğinde, 2 hareketli raflı, gazlı pistonlu kalkar kapaklı, bazasız beyaz gövdeli meşe kapaklı mutfak üst duvar dolabı",
    highlights: ["Gazlı Piston Kalkar Kapak", "2 Hareketli Raf", "Duvara Asma (Bazasız)", "350mm Üst Derinlik"],
    config: {
      name: "Kalkar Kapaklı Mutfak Üst Dolabı",
      cabinet_type: "kitchen_wall",
      width_mm: 800,
      height_mm: 720,
      depth_mm: 350,
      shelf_count: 2,
      door_type: "flap_up",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: false,
      plinth_height_mm: 0,
      body_material: "18mm Beyaz Suntalam",
      door_material: "18mm Doğal Meşe MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#C89F70",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "kitchen_wall_double_90",
    categoryId: "kitchen",
    category: "Mutfak & Ankastre",
    title: "Çift Kapaklı Mutfak Üst Duvar Modülü (90×72×35 cm)",
    subtitle:
      "Duvara asma (bazasız), çift kapaklı, Sistem 32 raf pimi delikli 2 hareketli raflı üst modül",
    totalWidthMm: 900,
    prompt:
      "90 cm genişliğinde, 72 cm yüksekliğinde, 35 cm derinliğinde, 2 hareketli raflı, çift kapaklı, bazasız beyaz mutfak üst dolabı",
    highlights: ["Çift Kapak", "Sistem 32 Raf Delikleri", "Bazasız Asma Gövde", "8mm Kanallı Arkalık"],
    config: {
      name: "Çift Kapaklı Mutfak Üst Modülü",
      cabinet_type: "kitchen_wall",
      width_mm: 900,
      height_mm: 720,
      depth_mm: 350,
      shelf_count: 2,
      door_type: "double",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: false,
      plinth_height_mm: 0,
      body_material: "18mm Beyaz Suntalam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#F4F1EA",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "kitchen_tall_pantry_60",
    categoryId: "kitchen",
    category: "Mutfak & Ankastre",
    title: "2 Çekmeceli & Tek Kapaklı Mutfak Boy Kiler Kulesi (60×210×58 cm)",
    subtitle:
      "Altta 2 derin erzak çekmecesi, üstte 4 hareketli raflı sağdan menteşeli boy kiler dolabı",
    totalWidthMm: 600,
    prompt:
      "60 cm genişliğinde, 210 cm yüksekliğinde, 58 cm derinliğinde, 4 hareketli raflı, 2 çekmeceli, sağ kapaklı, bazalı antrasit kapaklı mutfak boy kiler dolabı",
    highlights: ["2 Derin Erzak Çekmecesi", "4 Hareketli Raf", "Sağ Menteşe Tek Kapak", "2100mm Boy Kule"],
    config: {
      name: "Mutfak Boy Kiler Kulesi",
      cabinet_type: "kitchen_tall",
      width_mm: 600,
      height_mm: 2100,
      depth_mm: 580,
      shelf_count: 4,
      door_type: "single_right",
      drawer_count: 2,
      drawer_front_height_mm: 200,
      has_plinth: true,
      plinth_height_mm: 100,
      body_material: "18mm Beyaz MDF-Lam",
      door_material: "18mm Antrasit MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "kitchen_full_line",
    categoryId: "kitchen",
    category: "Mutfak & Ankastre",
    title: "Komple Mutfak Alt + Ankastre Kiler Hattı (3 Modül — 200 cm)",
    subtitle:
      "Modül 1: 80cm Evye Altı + Modül 2: 60cm 3 Çekmeceli Kaşıklık/Tencere + Modül 3: 60cm Boy Kiler",
    totalWidthMm: 2000,
    prompt:
      "80 cm genişliğinde, 82 cm yüksekliğinde, 56 cm derinliğinde, 1 raflı, çift kapaklı mutfak evye altı dolabı",
    highlights: ["3 Modül Ortak Nesting", "Toplam 5 Çekmece Kasası", "2000mm Hat Genişliği", "Tek ZIP CNC Paketi"],
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

  // ============================================================================
  // 2. YATAK ODASI & GARDIROP SİSTEMLERİ (6 Şablon)
  // ============================================================================
  {
    id: "bedroom_wardrobe_2drawer_90",
    categoryId: "bedroom",
    category: "Yatak Odası & Gardırop",
    title: "2 Çekmeceli & Çift Kapaklı Gardırop (90×210×58 cm)",
    subtitle:
      "Altta 2 dış çekmece, üstte çift kapaklı ve 3 hareketli raflı yatak odası gardırobu",
    totalWidthMm: 900,
    prompt:
      "210 cm yüksekliğinde, 90 cm genişliğinde, 58 cm derinliğinde, 3 hareketli raflı, 2 çekmeceli, çift kapaklı, beyaz gövdeli meşe kapaklı gardırop",
    highlights: ["Çift Kapak", "2 Dış Çekmece", "3 Hareketli Raf", "500mm Teleskopik Ray"],
    config: {
      name: "2 Çekmeceli & Çift Kapaklı Gardırop",
      cabinet_type: "wardrobe",
      width_mm: 900,
      height_mm: 2100,
      depth_mm: 580,
      shelf_count: 3,
      door_type: "double",
      drawer_count: 2,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Beyaz Suntalam",
      door_material: "18mm Doğal Meşe Suntalam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#C89F70",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "bedroom_tall_linen_60",
    categoryId: "bedroom",
    category: "Yatak Odası & Gardırop",
    title: "Tavandan Tabana Tek Kapaklı Yüklük / Elbise Dolabı (60×240×60 cm)",
    subtitle:
      "Bazasız, 5 hareketli raflı, sol menteşeli maksimum depolama kapasiteli boy yüklük",
    totalWidthMm: 600,
    prompt:
      "60 cm genişliğinde, 240 cm yüksekliğinde, 60 cm derinliğinde, 5 hareketli raflı, tek kapaklı, tavandan tabana bazasız beyaz gardırop yüklük",
    highlights: ["2400mm Tam Boy", "5 Hareketli Raf", "5 Adet Ø35mm Menteşe", "Bazasız Gövde"],
    config: {
      name: "Tavandan Tabana Tek Kapaklı Yüklük",
      cabinet_type: "wardrobe",
      width_mm: 600,
      height_mm: 2400,
      depth_mm: 600,
      shelf_count: 5,
      door_type: "single_left",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: false,
      plinth_height_mm: 0,
      body_material: "18mm Beyaz Suntalam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#F4F1EA",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "bedroom_dresser_4drawer_90",
    categoryId: "bedroom",
    category: "Yatak Odası & Gardırop",
    title: "4 Çekmeceli Yatak Odası Şifonyeri (90×86×48 cm)",
    subtitle:
      "4 adet frenli teleskopik raylı derin çekmece kasası, 6 cm bazalı meşe yatak odası şifonyeri",
    totalWidthMm: 900,
    prompt:
      "90 cm genişliğinde, 86 cm yüksekliğinde, 48 cm derinliğinde, 4 çekmeceli, kapaksız meşe yatak odası şifonyeri",
    highlights: ["4 Çekmece Kasası (20 Parça)", "400mm Teleskopik Ray", "Simetrik Klapa Boşluğu", "8mm Kanallı Arkalık"],
    config: {
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
      body_material: "18mm Doğal Meşe Suntalam",
      body_color_hex: "#C89F70",
      door_color_hex: "#C89F70",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "bedroom_nightstand_50",
    categoryId: "bedroom",
    category: "Yatak Odası & Gardırop",
    title: "2 Çekmeceli Yatak Başı Komodini (50×52×45 cm)",
    subtitle:
      "2 adet frenli çekmeceli, ceviz gövdeli ve krem klapalı kompakt yatak başı komodini",
    totalWidthMm: 500,
    prompt:
      "50 cm genişliğinde, 52 cm yüksekliğinde, 45 cm derinliğinde, 2 çekmeceli, kapaksız ceviz gövdeli krem kapaklı komodin",
    highlights: ["2 Çekmece Kasası", "400mm Teleskopik Ray", "Kompakt 500×520mm", "Ceviz & Krem Kombin"],
    config: {
      name: "2 Çekmeceli Yatak Başı Komodini",
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
      door_material: "18mm Krem MDF-Lam",
      body_color_hex: "#6E472B",
      door_color_hex: "#EFECE6",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "bedroom_master_wardrobe",
    categoryId: "bedroom",
    category: "Yatak Odası & Gardırop",
    title: "6 Kapaklı & 3 Çekmeceli Master Gardırop Hattı (3 Modül — 270 cm)",
    subtitle:
      "Sol 90cm Gardırop + Orta 90cm 3 Çekmeceli & Kapaklı Modül + Sağ 90cm Gardırop",
    totalWidthMm: 2700,
    prompt:
      "90 cm genişliğinde, 210 cm yüksekliğinde, 58 cm derinliğinde, 3 raflı, 3 çekmeceli, çift kapaklı meşe gardırop",
    highlights: ["3 Modül (2700mm Duvar)", "Toplam 6 Kapak + 3 Çekmece", "11 Hareketli Raf", "Ortak Plaka Nesting"],
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
    categoryId: "bedroom",
    category: "Yatak Odası & Gardırop",
    title: "4 Çekmeceli Şifonyer & Çift Komodin Takımı (3 Modül — 190 cm)",
    subtitle:
      "Sol 50cm 2 Çekmeceli Komodin + Orta 90cm 4 Çekmeceli Şifonyer + Sağ 50cm 2 Çekmeceli Komodin",
    totalWidthMm: 1900,
    prompt:
      "90 cm genişliğinde, 86 cm yüksekliğinde, 48 cm derinliğinde, 4 çekmeceli, kapaksız ceviz yatak odası şifonyeri",
    highlights: ["3 Modül Takım", "Toplam 8 Çekmece (40 Kutu Parçası)", "Ceviz & Krem", "Tek Tıkla Takım CNC"],
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

  // ============================================================================
  // 3. BANYO & ÇAMAŞIR ODASI SİSTEMLERİ (4 Şablon)
  // ============================================================================
  {
    id: "bathroom_washing_machine_tower",
    categoryId: "bathroom",
    category: "Banyo & Çamaşır Odası",
    title: "Çamaşır Makinesi Üstü Dolap Kulesi (70×220×65 cm)",
    subtitle:
      "Alt 90 cm açık çamaşır makinesi nişi (arkalıksız, bazasız) + Üst 130 cm çift kapaklı ve 3 raflı deterjan/havlu dolabı",
    totalWidthMm: 700,
    prompt:
      "Banyoda çamaşır makinesinin etrafını saracak dolap kulesi tasarlamak istiyorum. Toplam dış ölçüleri: Yükseklik 220 cm, genişlik 70 cm, derinlik 65 cm olsun. Alt kısımda çamaşır makinesi için 90 cm yüksekliğinde açık bir niş bırakılsın; üst kısımda 3 adet hareketli raflı ve çift kapaklı dolap olsun. Gövde 18 mm beyaz MDF-Lam, kapak antrasit MDF-Lam olsun.",
    highlights: ["900mm Çamaşır Makinesi Nişi", "Üstte 3 Raf + Çift Kapak", "Bazasız Yekpare Dikme", "Üst Bölge Kanallı Arkalık"],
    config: {
      name: "Çamaşır Makinesi Üstü Dolap Kulesi",
      cabinet_type: "bathroom_tall",
      width_mm: 700,
      height_mm: 2200,
      depth_mm: 650,
      shelf_count: 3,
      door_type: "double",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      appliance_niche_height_mm: 900,
      has_plinth: false,
      plinth_height_mm: 0,
      body_material: "18mm Beyaz MDF-Lam",
      door_material: "18mm Antrasit MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "bathroom_vanity_2drawer_80",
    categoryId: "bathroom",
    category: "Banyo & Çamaşır Odası",
    title: "2 Derin Çekmeceli Asma Banyo Lavabo Altı Dolabı (80×65×48 cm)",
    subtitle:
      "Duvara asma (bazasız), 2 adet 28 cm yüksekliğinde derin çekmeceli antrasit MDF-Lam lavabo altı modülü",
    totalWidthMm: 800,
    prompt:
      "80 cm genişliğinde, 65 cm yüksekliğinde, 48 cm derinliğinde, 2 çekmeceli, kapaksız, bazasız antrasit gövdeli beyaz kapaklı banyo lavabo altı dolabı",
    highlights: ["2 Derin Çekmece (280mm Klapa)", "Duvara Asma (Bazasız)", "Neme Dayanıklı MDF-Lam", "400mm Frenli Ray"],
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
      door_material: "18mm Beyaz MDF-Lam",
      body_color_hex: "#374151",
      door_color_hex: "#F4F1EA",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "bathroom_tall_45",
    categoryId: "bathroom",
    category: "Banyo & Çamaşır Odası",
    title: "Çekmeceli & Tek Kapaklı Banyo Boy Kulesi (45×180×38 cm)",
    subtitle:
      "Altta 1 derin çekmece, üstte 4 hareketli raflı ve sağdan menteşeli tek kapaklı banyo havlu kulesi",
    totalWidthMm: 450,
    prompt:
      "45 cm genişliğinde, 180 cm yüksekliğinde, 38 cm derinliğinde, 4 hareketli raflı, 1 çekmeceli, sağ kapaklı, bazasız antrasit banyo boy dolabı",
    highlights: ["1 Alt Çekmece + 4 Raf", "Sağ Menteşe Tek Kapak", "380mm Dar Banyo Derinliği", "Asma Gövde"],
    config: {
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
      door_material: "18mm Beyaz MDF-Lam",
      body_color_hex: "#374151",
      door_color_hex: "#F4F1EA",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "bathroom_vanity_line",
    categoryId: "bathroom",
    category: "Banyo & Çamaşır Odası",
    title: "Banyo Lavabo Altı & Boy Dolabı Komple Seti (2 Modül — 125 cm)",
    subtitle:
      "80cm 2 Derin Çekmeceli Lavabo Altı Modülü + 45cm Banyo Boy/Havlu Dolabı",
    totalWidthMm: 1250,
    prompt:
      "80 cm genişliğinde, 65 cm yüksekliğinde, 48 cm derinliğinde, 2 çekmeceli banyo lavabo altı dolabı",
    highlights: ["2 Modül Banyo Seti", "Toplam 3 Çekmece + 1 Boy Kapak", "1250mm Toplam En", "Ortak Plaka Nesting"],
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

  // ============================================================================
  // 4. SALON, TV ÜNİTESİ & KİTAPLIK SİSTEMLERİ (5 Şablon)
  // ============================================================================
  {
    id: "living_tv_console_180",
    categoryId: "living",
    category: "Salon, TV & Kitaplık",
    title: "2 Çekmeceli & Çift Kapaklı Geniş TV Medya Konsolu (180×52×42 cm)",
    subtitle:
      "8 cm bazalı, koyu ceviz MDF-Lam gövdeli, 2 çekmeceli ve çift kapaklı salon TV sehpası",
    totalWidthMm: 1800,
    prompt:
      "180 cm genişliğinde, 52 cm yüksekliğinde, 42 cm derinliğinde, rafsız, 2 çekmeceli, çift kapaklı, ceviz gövdeli antrasit kapaklı TV konsolu",
    highlights: ["1800mm Geniş Gövde", "2 Çekmece + Çift Kapak", "350mm Teleskopik Ray", "Ceviz & Antrasit"],
    config: {
      name: "Geniş TV Medya Konsolu",
      cabinet_type: "tv_unit",
      width_mm: 1800,
      height_mm: 520,
      depth_mm: 420,
      shelf_count: 0,
      door_type: "double",
      drawer_count: 2,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Koyu Ceviz MDF-Lam",
      door_material: "18mm Antrasit MDF-Lam",
      body_color_hex: "#6E472B",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "living_tv_wall_flap_120",
    categoryId: "living",
    category: "Salon, TV & Kitaplık",
    title: "Gazlı Pistonlu Kalkar Kapaklı TV Üst Duvar Modülü (120×40×32 cm)",
    subtitle:
      "Duvara asma (bazasız), yukarı açılır gazlı pistonlu tek parça kalkar kapaklı medya üst dolabı",
    totalWidthMm: 1200,
    prompt:
      "120 cm genişliğinde, 40 cm yüksekliğinde, 32 cm derinliğinde, rafsız, gazlı pistonlu kalkar kapaklı, bazasız ceviz gövdeli krem kapaklı TV üst duvar dolabı",
    highlights: ["1200mm Yatay Kalkar Kapak", "2 Adet 100N Gazlı Piston", "Bazasız Duvar Modülü", "320mm İnce Derinlik"],
    config: {
      name: "Kalkar Kapaklı TV Üst Duvar Modülü",
      cabinet_type: "kitchen_wall",
      width_mm: 1200,
      height_mm: 400,
      depth_mm: 320,
      shelf_count: 0,
      door_type: "flap_up",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: false,
      plinth_height_mm: 0,
      body_material: "18mm Koyu Ceviz MDF-Lam",
      door_material: "18mm Krem MDF-Lam",
      body_color_hex: "#6E472B",
      door_color_hex: "#EFECE6",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "living_bookshelf_5shelf_80",
    categoryId: "living",
    category: "Salon, TV & Kitaplık",
    title: "5 Raflı Açık Salon & Çalışma Odası Kitaplığı (80×195×35 cm)",
    subtitle:
      "Kapaksız, Sistem 32 raf pimi delikli 5 hareketli raflı, 8 mm kanallı arkalıklı kitaplık",
    totalWidthMm: 800,
    prompt:
      "80 cm genişliğinde, 195 cm yüksekliğinde, 35 cm derinliğinde, 5 hareketli raflı, kapaksız doğal meşe kitaplık",
    highlights: ["5 Hareketli Raf (20 Raf Pimi)", "Sistem 32 Delik Matrisi", "8mm Kanallı Arkalık", "2.0mm Ön PVC"],
    config: {
      name: "5 Raflı Açık Kitaplık Modülü",
      cabinet_type: "bookshelf",
      width_mm: 800,
      height_mm: 1950,
      depth_mm: 350,
      shelf_count: 5,
      door_type: "none",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Doğal Meşe Suntalam",
      body_color_hex: "#C89F70",
      door_color_hex: "#C89F70",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "living_vitrine_tower_60",
    categoryId: "living",
    category: "Salon, TV & Kitaplık",
    title: "Altta 2 Çekmeceli & Üstü 4 Açık Raflı Vitrin Kulesi (60×195×38 cm)",
    subtitle:
      "Altta 2 frenli çekmece, üstte 4 açık sergileme rafı bulunan hibrit salon kitaplık kulesi",
    totalWidthMm: 600,
    prompt:
      "60 cm genişliğinde, 195 cm yüksekliğinde, 38 cm derinliğinde, 4 hareketli raflı, 2 çekmeceli, kapaksız ceviz kitaplık kulesi",
    highlights: ["2 Alt Çekmece + 4 Açık Raf", "Hibrit Vitrin Tasarımı", "300mm Teleskopik Ray", "1950mm Kule Boyu"],
    config: {
      name: "Çekmeceli Kitaplık / Vitrin Kulesi",
      cabinet_type: "bookshelf",
      width_mm: 600,
      height_mm: 1950,
      depth_mm: 380,
      shelf_count: 4,
      door_type: "none",
      drawer_count: 2,
      drawer_front_height_mm: 200,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Koyu Ceviz MDF-Lam",
      door_material: "18mm Antrasit MDF-Lam",
      body_color_hex: "#6E472B",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "living_tv_media_line",
    categoryId: "living",
    category: "Salon, TV & Kitaplık",
    title: "TV Medya Konsolu & Çift Kitaplık Kulesi Salon Hattı (3 Modül — 280 cm)",
    subtitle:
      "Sol 60cm Kitaplık Kulesi + Orta 160cm Çekmeceli TV Konsolu + Sağ 60cm Kitaplık Kulesi",
    totalWidthMm: 2800,
    prompt:
      "160 cm genişliğinde, 52 cm yüksekliğinde, 42 cm derinliğinde, 2 çekmeceli, kapaksız ceviz TV medya konsolu",
    highlights: ["3 Modül Salon Duvarı (2800mm)", "8 Açık Raf + 4 Çekmece", "Simetrik Çift Kule", "Ortak Plaka Nesting"],
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

  // ============================================================================
  // 5. ANTRE, VESTİYER & PORTMANTO SİSTEMLERİ (4 Şablon)
  // ============================================================================
  {
    id: "hallway_shoe_cabinet_90",
    categoryId: "hallway",
    category: "Antre & Vestiyer",
    title: "2 Çekmeceli & Çift Kapaklı Yüksek Ayakkabılık (90×120×38 cm)",
    subtitle:
      "Altta 2 çekmece, üstte 4 hareketli raflı çift kapaklı geniş kapasiteli antre ayakkabılığı",
    totalWidthMm: 900,
    prompt:
      "90 cm genişliğinde, 120 cm yüksekliğinde, 38 cm derinliğinde, 4 hareketli raflı, 2 çekmeceli, çift kapaklı meşe gövdeli beyaz kapaklı ayakkabılık",
    highlights: ["4 Ayakkabı Rafı + 2 Çekmece", "Çift Kapak", "380mm Antre Derinliği", "80mm Alt Baza"],
    config: {
      name: "Çekmeceli Yüksek Ayakkabılık",
      cabinet_type: "shoe_cabinet",
      width_mm: 900,
      height_mm: 1200,
      depth_mm: 380,
      shelf_count: 4,
      door_type: "double",
      drawer_count: 2,
      drawer_front_height_mm: 160,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Doğal Meşe Suntalam",
      door_material: "18mm Beyaz Suntalam",
      body_color_hex: "#C89F70",
      door_color_hex: "#F4F1EA",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "hallway_bench_90",
    categoryId: "hallway",
    category: "Antre & Vestiyer",
    title: "Oturma Banklı & 2 Çekmeceli Antre Ayakkabılığı (90×55×40 cm)",
    subtitle:
      "Üzerine oturulabilir 55 cm ergonomik yükseklikte, 2 derin çekmeceli antre giyinme bankı",
    totalWidthMm: 900,
    prompt:
      "90 cm genişliğinde, 55 cm yüksekliğinde, 40 cm derinliğinde, rafsız, kapaksız, 2 çekmeceli meşe gövdeli beyaz kapaklı antre ayakkabılık bankı",
    highlights: ["550mm Oturma Yüksekliği", "2 Derin Çekmece Kasası", "350mm Teleskopik Ray", "Sağlam 18mm Gövde"],
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
      door_material: "18mm Beyaz Suntalam",
      body_color_hex: "#C89F70",
      door_color_hex: "#F4F1EA",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "hallway_robot_vac_portmanto",
    categoryId: "hallway",
    category: "Antre & Vestiyer",
    title: "Robot Süpürge Nişli Boy Portmanto / Vestiyer (90×215×45 cm)",
    subtitle:
      "Alt 22 cm açık robot süpürge istasyonu nişi (bazasız) + Üst 4 raflı ve çift kapaklı boy portmanto",
    totalWidthMm: 900,
    prompt:
      "Antre için toplam dış ölçüleri yükseklik 215 cm, genişlik 90 cm, derinlik 45 cm olan bir portmanto tasarlamak istiyorum. Alt kısımda robot süpürge istasyonu için 22 cm yüksekliğinde açık bir niş bırakılsın. Üst kısımda 4 adet hareketli raflı ve çift kapaklı dolap olsun. Gövde meşe suntalam, kapaklar beyaz MDF-Lam olsun.",
    highlights: ["220mm Robot Süpürge Nişi", "Çift Kapak + 4 Raf", "Bazasız Yekpare Yan Dikme", "Akıllı Ev Uyumlu"],
    config: {
      name: "Robot Süpürge Nişli Boy Portmanto",
      cabinet_type: "shoe_cabinet",
      width_mm: 900,
      height_mm: 2150,
      depth_mm: 450,
      shelf_count: 4,
      door_type: "double",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      appliance_niche_height_mm: 220,
      has_plinth: false,
      plinth_height_mm: 0,
      body_material: "18mm Doğal Meşe Suntalam",
      door_material: "18mm Beyaz MDF-Lam",
      body_color_hex: "#C89F70",
      door_color_hex: "#F4F1EA",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "hallway_vestiyer_line",
    categoryId: "hallway",
    category: "Antre & Vestiyer",
    title: "Komple Antre Vestiyer & Oturma Banklı Portmanto (2 Modül — 180 cm)",
    subtitle:
      "90cm Çekmeceli Ayakkabılık/Oturma Bankı + 90cm Çift Kapaklı & Çekmeceli Boy Portmanto",
    totalWidthMm: 1800,
    prompt:
      "90 cm genişliğinde, 210 cm yüksekliğinde, 40 cm derinliğinde, 4 raflı, 2 çekmeceli, çift kapaklı meşe portmanto",
    highlights: ["2 Modül Antre Hattı (1800mm)", "Oturma Bankı + Boy Portmanto", "Toplam 4 Çekmece + 2 Kapak", "Ortak Plaka Nesting"],
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

  // ============================================================================
  // 6. OFİS, ÇALIŞMA & ARŞİV DOLAPLARI (3 Şablon)
  // ============================================================================
  {
    id: "office_archive_cabinet_80",
    categoryId: "office",
    category: "Ofis & Arşiv",
    title: "Çift Kapaklı & 4 Raflı Tam Boy Klasör Arşiv Dolabı (80×200×40 cm)",
    subtitle:
      "Standart A4 klasör derinliğine (40 cm) uygun, 4 hareketli raflı ve çift kapaklı kurumsal ofis dolabı",
    totalWidthMm: 800,
    prompt:
      "80 cm genişliğinde, 200 cm yüksekliğinde, 40 cm derinliğinde, 4 hareketli raflı, çift kapaklı, gri gövdeli antrasit kapaklı ofis klasör arşiv dolabı",
    highlights: ["5 Klasör Katı (4 Raf)", "Çift Kapak (8 Menteşe)", "400mm Klasör Derinliği", "Sistem 32 Raf Pimi"],
    config: {
      name: "Çift Kapaklı Ofis Klasör Arşiv Dolabı",
      cabinet_type: "bookshelf",
      width_mm: 800,
      height_mm: 2000,
      depth_mm: 400,
      shelf_count: 4,
      door_type: "double",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Açık Gri Suntalam",
      door_material: "18mm Antrasit MDF-Lam",
      body_color_hex: "#9CA3AF",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "office_pedestal_keson_45",
    categoryId: "office",
    category: "Ofis & Arşiv",
    title: "3 Çekmeceli Masa Altı Ofis Keson Modülü (45×62×50 cm)",
    subtitle:
      "Çalışma masası altına sığan, 3 adet 450 mm teleskopik raylı çekmeceli kompakt ofis kesonu",
    totalWidthMm: 450,
    prompt:
      "45 cm genişliğinde, 62 cm yüksekliğinde, 50 cm derinliğinde, 3 çekmeceli, kapaksız, bazasız antrasit gövdeli meşe kapaklı masa altı keson",
    highlights: ["3 Çekmece Kasası (15 Parça)", "450mm Teleskopik Ray", "Masa Altı 620mm Boy", "Bazasız Kompakt"],
    config: {
      name: "3 Çekmeceli Masa Altı Ofis Kesonu",
      cabinet_type: "dresser",
      width_mm: 450,
      height_mm: 620,
      depth_mm: 500,
      shelf_count: 0,
      door_type: "none",
      drawer_count: 3,
      drawer_front_height_mm: 185,
      has_plinth: false,
      plinth_height_mm: 0,
      body_material: "18mm Antrasit MDF-Lam",
      door_material: "18mm Doğal Meşe MDF-Lam",
      body_color_hex: "#374151",
      door_color_hex: "#C89F70",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "office_double_archive_line",
    categoryId: "office",
    category: "Ofis & Arşiv",
    title: "İkili Ofis Klasör & Arşiv Dolabı Duvar Hattı (2 Modül — 160 cm)",
    subtitle:
      "Sol 80cm 2 Çekmeceli & Çift Kapaklı Arşiv Dolabı + Sağ 80cm 5 Raflı Açık Klasör Kitaplığı",
    totalWidthMm: 1600,
    prompt:
      "80 cm genişliğinde, 200 cm yüksekliğinde, 40 cm derinliğinde, 3 hareketli raflı, 2 çekmeceli, çift kapaklı ofis arşiv dolabı",
    highlights: ["2 Modül Ofis Hattı (1600mm)", "Kapaklı Arşiv + Açık Kitaplık", "Toplam 8 Raf + 2 Çekmece", "Ortak Plaka Nesting"],
    config: {
      name: "Sol Çekmeceli & Kapaklı Arşiv Dolabı",
      cabinet_type: "bookshelf",
      width_mm: 800,
      height_mm: 2000,
      depth_mm: 400,
      shelf_count: 3,
      door_type: "double",
      drawer_count: 2,
      drawer_front_height_mm: 190,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Doğal Meşe Suntalam",
      door_material: "18mm Antrasit MDF-Lam",
      body_color_hex: "#C89F70",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [
        {
          name: "Sağ 5 Raflı Açık Klasör Kitaplığı",
          cabinet_type: "bookshelf",
          width_mm: 800,
          height_mm: 2000,
          depth_mm: 400,
          shelf_count: 5,
          door_type: "none",
          drawer_count: 0,
          drawer_front_height_mm: 180,
          has_plinth: true,
          plinth_height_mm: 80,
          body_material: "18mm Doğal Meşe Suntalam",
          body_color_hex: "#C89F70",
          door_color_hex: "#374151",
          front_pvc_thickness_mm: 2.0,
          hidden_pvc_thickness_mm: 0.4,
          back_panel_type: "grooved_8mm",
          sheet_size: "2800x2100",
        },
      ],
    },
  },

  // ============================================================================
  // 7. ÇATI EĞİMİ, L-KÖŞE & ÖZEL MİMARİ SİSTEMLERİ (8 Şablon)
  // ============================================================================
  {
    id: "special_slope_stairs_left_90",
    categoryId: "special",
    category: "Çatı Eğimi & L-Köşe",
    title: "Merdiven Altı Eğimli Gardırop / Depolama Dolabı (90×210×58 cm — Sol Alçak)",
    subtitle:
      "Sol dikme 120 cm, sağ dikme 210 cm, Pisagor açılı üst tabla ve trapezoid arkalık kesimli merdiven altı dolabı",
    totalWidthMm: 900,
    prompt:
      "90 cm genişliğinde, 210 cm yüksekliğinde, 58 cm derinliğinde, merdiven altı için sol tarafı 120 cm'den başlayan çatı eğimli, 2 raflı, çift kapaklı meşe gardırop",
    highlights: ["Pisagor Eğimli Üst Tabla", "Trapezoid Arkalık (1200➔2100)", "Sol Alçak Dikme (120cm)", "2 Hareketli Raf"],
    config: {
      name: "Merdiven Altı Eğimli Gardırop",
      cabinet_type: "wardrobe",
      width_mm: 900,
      height_mm: 2100,
      depth_mm: 580,
      has_slope: true,
      slope_side: "left",
      slope_start_height_mm: 1200,
      slope_angle_deg: 45.0,
      shelf_count: 2,
      door_type: "double",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Beyaz Suntalam",
      door_material: "18mm Doğal Meşe Suntalam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#C89F70",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "special_slope_mansard_right_100",
    categoryId: "special",
    category: "Çatı Eğimi & L-Köşe",
    title: "Çatı Katı (Mansard) Sağa Eğimli Giyinme Dolabı (100×220×60 cm — Sağ Alçak)",
    subtitle:
      "Sol dikme 220 cm tam boy, sağ dikme 110 cm çatı alçalan dikme, trapezoid arkalıklı mansard giyinme dolabı",
    totalWidthMm: 1000,
    prompt:
      "100 cm genişliğinde, 220 cm yüksekliğinde, 60 cm derinliğinde, çatı katı için sağ tarafı 110 cm'ye alçalan çatı eğimli, 3 raflı, çift kapaklı antrasit giyinme dolabı",
    highlights: ["Mansard Çatı Eğimi (47.7°)", "Sağ Alçak Dikme (110cm)", "Trapezoid Arkalık (2200➔1100)", "Antrasit Kapak"],
    config: {
      name: "Mansard Çatı Katı Eğimli Dolap",
      cabinet_type: "wardrobe",
      width_mm: 1000,
      height_mm: 2200,
      depth_mm: 600,
      has_slope: true,
      slope_side: "right",
      slope_start_height_mm: 1100,
      slope_angle_deg: 47.7,
      shelf_count: 3,
      door_type: "double",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Beyaz Suntalam",
      door_material: "18mm Antrasit MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "special_slope_stairs_bookshelf_120",
    categoryId: "special",
    category: "Çatı Eğimi & L-Köşe",
    title: "Merdiven Altı Eğimli Açık Kitaplık & Çalışma Köşesi (120×180×35 cm)",
    subtitle:
      "Sol dikme 90 cm'den sağ dikme 180 cm'ye yükselen, 4 kademeli hareketli raflı kapaksız merdiven altı kitaplığı",
    totalWidthMm: 1200,
    prompt:
      "120 cm genişliğinde, 180 cm yüksekliğinde, 35 cm derinliğinde, merdiven altı için sol tarafı 90 cm'den başlayan eğimli, kapaksız, 4 raflı meşe açık kitaplık",
    highlights: ["Kapaksız Açık Raf", "Kademeli 4 Raf", "37.6° Çatı Eğimi", "Merdiven Altı Tasarruf"],
    config: {
      name: "Merdiven Altı Eğimli Açık Kitaplık",
      cabinet_type: "bookshelf",
      width_mm: 1200,
      height_mm: 1800,
      depth_mm: 350,
      has_slope: true,
      slope_side: "left",
      slope_start_height_mm: 900,
      slope_angle_deg: 37.6,
      shelf_count: 4,
      door_type: "none",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Doğal Meşe Suntalam",
      body_color_hex: "#C89F70",
      door_color_hex: "#C89F70",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "special_slope_kitchen_wall_80",
    categoryId: "special",
    category: "Çatı Eğimi & L-Köşe",
    title: "Çatı Katı Eğimli Mutfak Üst Duvar Dolabı (80×72×35 cm — Sol Alçak)",
    subtitle:
      "Sol 40 cm'den sağ 72 cm'ye yükselen çatı eğimli, gazlı pistonlu kalkar kapaklı asma üst dolap",
    totalWidthMm: 800,
    prompt:
      "80 cm genişliğinde, 72 cm yüksekliğinde, 35 cm derinliğinde, çatı katı için sol tarafı 40 cm eğimli, gazlı pistonlu kalkar kapaklı, bazasız mutfak üst dolabı",
    highlights: ["Gazlı Piston Kalkar Kapak", "Asma Çatı Üst Dolabı", "22.6° Eğimli Tavan", "Bazasız Gövde"],
    config: {
      name: "Çatı Katı Eğimli Mutfak Üst Dolabı",
      cabinet_type: "kitchen_wall",
      width_mm: 800,
      height_mm: 720,
      depth_mm: 350,
      has_slope: true,
      slope_side: "left",
      slope_start_height_mm: 400,
      slope_angle_deg: 22.6,
      shelf_count: 1,
      door_type: "flap_up",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: false,
      plinth_height_mm: 0,
      body_material: "18mm Beyaz Suntalam",
      door_material: "18mm Doğal Meşe MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#C89F70",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "special_corner_kitchen_base_100",
    categoryId: "special",
    category: "Çatı Eğimi & L-Köşe",
    title: "Mutfak Alt 90° L-Köşe Kör Dolap Modülü (100×82×60 cm)",
    subtitle:
      "10 cm kör kapama panelli, tek kapaklı, 1 raflı 10 cm bazalı L-köşe mutfak tezgah altı dönüş modülü",
    totalWidthMm: 1000,
    prompt:
      "100 cm genişliğinde, 82 cm yüksekliğinde, 60 cm derinliğinde, 10 cm kör kapama panelli 90 derece L-köşe mutfak alt dolabı, tek kapaklı, 1 raflı",
    highlights: ["100mm Kör Kapama Paneli", "90° L-Köşe Dönüş", "Tek Kapak Sol Menteşe", "100mm Baza"],
    config: {
      name: "Mutfak Alt 90° L-Köşe Kör Modülü",
      cabinet_type: "kitchen_base",
      width_mm: 1000,
      height_mm: 820,
      depth_mm: 600,
      is_corner_module: true,
      corner_angle_deg: 90.0,
      corner_blind_width_mm: 100.0,
      shelf_count: 1,
      door_type: "single_left",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 100,
      body_material: "18mm Beyaz MDF-Lam",
      door_material: "18mm Antrasit MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "special_corner_kitchen_wall_70",
    categoryId: "special",
    category: "Çatı Eğimi & L-Köşe",
    title: "Mutfak Üst 90° L-Köşe Kör Duvar Dolabı (70×72×35 cm)",
    subtitle:
      "8 cm kör panelli, duvara asma tek kapaklı ve 2 raflı 90° L-köşe mutfak üst duvar modülü",
    totalWidthMm: 700,
    prompt:
      "70 cm genişliğinde, 72 cm yüksekliğinde, 35 cm derinliğinde, 8 cm kör panelli 90 derece L-köşe mutfak üst dolabı, tek kapaklı, 2 raflı, bazasız",
    highlights: ["80mm Kör Kapama Paneli", "Duvara Asma (Bazasız)", "2 Hareketli Raf", "90° Köşe Dönüşü"],
    config: {
      name: "Mutfak Üst 90° L-Köşe Duvar Dolabı",
      cabinet_type: "kitchen_wall",
      width_mm: 700,
      height_mm: 720,
      depth_mm: 350,
      is_corner_module: true,
      corner_angle_deg: 90.0,
      corner_blind_width_mm: 80.0,
      shelf_count: 2,
      door_type: "single_left",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: false,
      plinth_height_mm: 0,
      body_material: "18mm Beyaz Suntalam",
      door_material: "18mm Beyaz MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#F4F1EA",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "special_corner_wardrobe_100",
    categoryId: "special",
    category: "Çatı Eğimi & L-Köşe",
    title: "90° L-Köşe Giyinme Odası Gardırobu (100×210×58 cm)",
    subtitle:
      "10 cm kör kapama panelli, tek kapaklı, 4 raflı ve 8 cm bazalı L-köşe gardırop kulesi",
    totalWidthMm: 1000,
    prompt:
      "100 cm genişliğinde, 210 cm yüksekliğinde, 58 cm derinliğinde, 10 cm kör panelli 90 derece L-köşe gardırop modülü, 4 raflı, tek kapaklı meşe dolap",
    highlights: ["100mm Kör Kapama Paneli", "4 Geniş Raf", "Giyinme Odası L-Dönüşü", "80mm Ahşap Baza"],
    config: {
      name: "L-Köşe Giyinme Odası Gardırobu",
      cabinet_type: "wardrobe",
      width_mm: 1000,
      height_mm: 2100,
      depth_mm: 580,
      is_corner_module: true,
      corner_angle_deg: 90.0,
      corner_blind_width_mm: 100.0,
      shelf_count: 4,
      door_type: "single_left",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Beyaz Suntalam",
      door_material: "18mm Doğal Meşe Suntalam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#C89F70",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "special_notch_and_scribing_wardrobe_110",
    categoryId: "special",
    category: "Çatı Eğimi & L-Köşe",
    title: "Duvara Sıfır Rölöve Kör Çıtalı & Kolon Kertmeli Gardırop (110×220×60 cm)",
    subtitle:
      "Sağ ve sol 40 mm rölöve kör çıtaları, 120×120 mm arka kolon kertmesi ve 80×15 mm süpürgelik kertmeli mimari dolap",
    totalWidthMm: 1100,
    prompt:
      "110 cm genişliğinde, 220 cm yüksekliğinde, 60 cm derinliğinde, sağ ve sol 40 mm rölöve kör çıtalı, 120x120 mm kolon kertmeli, 80x15 mm süpürgelik kertmeli, çift kapaklı kaşmir bej gardırop",
    highlights: ["Sağ/Sol 40mm Kör Çıta", "120×120mm Kolon Kertmesi", "80×15mm Süpürgelik Kertmesi", "Duvara Tam Gömme"],
    config: {
      name: "Mimari Kertmeli Gömme Gardırop",
      cabinet_type: "wardrobe",
      width_mm: 1100,
      height_mm: 2200,
      depth_mm: 600,
      left_filler_width_mm: 40.0,
      right_filler_width_mm: 40.0,
      has_column_notch: true,
      column_notch_width_mm: 120.0,
      column_notch_depth_mm: 120.0,
      has_baseboard_notch: true,
      baseboard_notch_height_mm: 80.0,
      baseboard_notch_depth_mm: 15.0,
      shelf_count: 3,
      door_type: "double",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Beyaz Suntalam",
      door_material: "18mm Kaşmir Bej MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#D6CEC2",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },

  // ============================================================================
  // EK MUTFAK, KAHVE BARI & ANKASTRE KOMBİNASYONLARI
  // ============================================================================
  {
    id: "kitchen_coffee_station_tall_90",
    categoryId: "kitchen",
    category: "Mutfak & Ankastre",
    title: "Tezgâh Üstü Ahşap Kahve Köşesi (Coffee Bar) Boy Dolabı (90×210×55 cm)",
    subtitle:
      "Alt çift kapak + Orta 45 cm ceviz açık kahve barı nişi + Üst çift kapaklı depolama dolabı",
    totalWidthMm: 900,
    prompt:
      "90 cm genişliğinde, 210 cm yüksekliğinde, 55 cm derinliğinde, tezgâh hizasında 45 cm yüksekliğinde açık ahşap kahve köşesi nişi olan, altı ve üstü çift kapaklı antrasit mutfak boy dolabı",
    highlights: ["450mm Ahşap Kahve Nişi", "850mm Tezgâh Seviyesi", "Alt ve Üst Bağımsız Kapak", "100mm Baza"],
    config: {
      name: "Ahşap Kahve Barı Nişli Boy Dolap",
      cabinet_type: "kitchen_tall",
      width_mm: 900,
      height_mm: 2100,
      depth_mm: 550,
      niche_height_mm: 450.0,
      niche_bottom_offset_mm: 850.0,
      niche_color_hex: "#9C6644",
      niche_back_open: false,
      shelf_count: 2,
      door_type: "double",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 100,
      body_material: "18mm Beyaz MDF-Lam",
      door_material: "18mm Antrasit MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "kitchen_oven_microwave_tower_60",
    categoryId: "kitchen",
    category: "Mutfak & Ankastre",
    title: "Ankastre Fırın & Mikrodalga Boy Kule Dolabı (60×215×58 cm)",
    subtitle:
      "Altta 2 derin tencere çekmecesi, ortada 60 cm açık menfezli fırın nişi, üstte tek kapaklı mikrodalga dolabı",
    totalWidthMm: 600,
    prompt:
      "60 cm genişliğinde, 215 cm yüksekliğinde, 58 cm derinliğinde, altta 2 çekmeceli, ortada 60 cm ankastre fırın nişli açık arkalıklı, üstte tek kapaklı antrasit mutfak kule dolabı",
    highlights: ["600mm Fırın Nişi (Açık Arkalık)", "2 Derin Çekmece (500mm Ray)", "Üst Tek Kapak", "Hava Sirkülasyonu"],
    config: {
      name: "Ankastre Fırın & Cihaz Kulesi",
      cabinet_type: "kitchen_tall",
      width_mm: 600,
      height_mm: 2150,
      depth_mm: 580,
      niche_height_mm: 600.0,
      niche_bottom_offset_mm: 800.0,
      niche_color_hex: "#2D3134",
      niche_back_open: true,
      drawer_count: 2,
      drawer_front_height_mm: 200.0,
      shelf_count: 1,
      door_type: "single_right",
      has_plinth: true,
      plinth_height_mm: 100,
      body_material: "18mm Beyaz MDF-Lam",
      door_material: "18mm Antrasit MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "kitchen_cabineo_adj_legs_base_80",
    categoryId: "kitchen",
    category: "Mutfak & Ankastre",
    title: "Lamello Cabineo 12 & Ayarlı Ayaklı Mutfak Tencere Dolabı (80×82×56 cm)",
    subtitle:
      "3-eksen CNC Lamello Cabineo 12 cepli montaj, 10 cm ayarlı plastik ayaklı çift kapaklı modern tezgah altı",
    totalWidthMm: 800,
    prompt:
      "80 cm genişliğinde, 82 cm yüksekliğinde, 56 cm derinliğinde, Lamello Cabineo 12 bağlantılı, ayarlı plastik ayaklı, çift kapaklı meşe kapaklı mutfak alt dolabı",
    highlights: ["Lamello Cabineo 12 (Ø15/D10.8mm)", "3-Eksen CNC Uyumlu", "Ayarlı Plastik Ayaklar", "Suya Dayanıklı Baza"],
    config: {
      name: "Cabineo 12 & Ayarlı Ayaklı Mutfak Modülü",
      cabinet_type: "kitchen_base",
      width_mm: 800,
      height_mm: 820,
      depth_mm: 560,
      fastener_type: "cabineo_12",
      plinth_type: "adjustable_legs",
      has_plinth: true,
      plinth_height_mm: 100,
      shelf_count: 1,
      door_type: "double",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      body_material: "18mm Beyaz MDF-Lam",
      door_material: "18mm Doğal Meşe MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#C89F70",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "kitchen_luxury_island_bar_line",
    categoryId: "kitchen",
    category: "Mutfak & Ankastre",
    title: "Lüks Kahve Barı & Ada Komple Mutfak Hattı (3 Modül — 230 cm)",
    subtitle:
      "Modül 1: 90cm Tezgâh Üstü Ahşap Kahve Barı + Modül 2: 80cm Cabineo Çift Kapaklı Alt Dolap + Modül 3: 60cm 3 Çekmeceli Kaşıklık",
    totalWidthMm: 2300,
    prompt:
      "90 cm genişliğinde, 210 cm yüksekliğinde ahşap kahve nişli boy dolap",
    highlights: ["3 Modül Lüks Ada Hattı", "Kahve Barı Kulesi", "Toplam 3 Çekmece + 4 Kapak", "Ortak Plaka Nesting"],
    config: {
      name: "Ahşap Kahve Barı Nişli Boy Dolap",
      cabinet_type: "kitchen_tall",
      width_mm: 900,
      height_mm: 2100,
      depth_mm: 550,
      niche_height_mm: 450.0,
      niche_bottom_offset_mm: 850.0,
      niche_color_hex: "#9C6644",
      shelf_count: 2,
      door_type: "double",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 100,
      body_material: "18mm Beyaz MDF-Lam",
      door_material: "18mm Antrasit MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [
        {
          name: "Cabineo 12 & Ayarlı Ayaklı Mutfak Modülü",
          cabinet_type: "kitchen_base",
          width_mm: 800,
          height_mm: 820,
          depth_mm: 560,
          fastener_type: "cabineo_12",
          plinth_type: "adjustable_legs",
          has_plinth: true,
          plinth_height_mm: 100,
          shelf_count: 1,
          door_type: "double",
          drawer_count: 0,
          drawer_front_height_mm: 180,
          body_material: "18mm Beyaz MDF-Lam",
          door_material: "18mm Doğal Meşe MDF-Lam",
          body_color_hex: "#F4F1EA",
          door_color_hex: "#C89F70",
          front_pvc_thickness_mm: 2.0,
          hidden_pvc_thickness_mm: 0.4,
          back_panel_type: "grooved_8mm",
          sheet_size: "2800x2100",
        },
        {
          name: "3 Çekmeceli Kaşıklık Modülü",
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
          door_material: "18mm Doğal Meşe MDF-Lam",
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

  // ============================================================================
  // EK YATAK ODASI, ÇOKLU BÖLME (ZONES) & ŞİFONYER KOMBİNASYONLARI
  // ============================================================================
  {
    id: "bedroom_wardrobe_2zone_equal_160",
    categoryId: "bedroom",
    category: "Yatak Odası & Gardırop",
    title: "2 Bölmeli Simetrik Master Gardırop: Sol Raflı, Sağ Askılıklı (160×220×60 cm)",
    subtitle:
      "Dikey ara dikmeli, sol bölmede 4 hareketli raf, sağ bölmede oval elbise askı borusu ve üst şapkalık rafı",
    totalWidthMm: 1600,
    prompt:
      "160 cm genişliğinde, 220 cm yüksekliğinde, 60 cm derinliğinde, dikey ara dikmeli 2 bölmeli gardırop; sol bölme 4 hareketli raflı, sağ bölme elbise askılıklı, kaşmir bej kapaklı",
    highlights: ["Dikey Ara Dikme", "Sol 4 Raf (5 Kat)", "Sağ Elbise Askı Borusu", "2 Geniş Kapak"],
    config: {
      name: "2 Bölmeli Simetrik Master Gardırop",
      cabinet_type: "wardrobe",
      width_mm: 1600,
      height_mm: 2200,
      depth_mm: 600,
      zones: [
        {
          name: "Sol Bölme (Raflı)",
          width_ratio: 1.0,
          shelf_count: 4,
          drawer_count: 0,
          door_type: "single_left",
        },
        {
          name: "Sağ Bölme (Askılıklı)",
          width_ratio: 1.0,
          shelf_count: 1,
          drawer_count: 0,
          has_hanging_rod: true,
          door_type: "single_right",
        },
      ],
      shelf_count: 4,
      door_type: "double",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Beyaz Suntalam",
      door_material: "18mm Kaşmir Bej MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#D6CEC2",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "bedroom_wardrobe_2zone_drawers_150",
    categoryId: "bedroom",
    category: "Yatak Odası & Gardırop",
    title: "2 Bölmeli Asimetrik Gardırop: Sol Askılık & 2 Çekmece, Sağ 5 Raf (150×210×58 cm)",
    subtitle:
      "Geniş sol bölmede ceket askılığı ve 2 alt çekmece kasası (çift kapak), sağ dar bölmede 5 kat çamaşır rafı (tek kapak)",
    totalWidthMm: 1500,
    prompt:
      "150 cm genişliğinde, 210 cm yüksekliğinde, 58 cm derinliğinde, 2 bölmeli gardırop; geniş bölmede askılık ve 2 alt çekmece, dar bölmede 5 raf, meşe kapaklı",
    highlights: ["Asimetrik 2 Bölme", "Sol 2 Çekmece + Askılık", "Sağ 5 Raf", "Toplam 3 Bağımsız Kapak"],
    config: {
      name: "Asimetrik Askılıklı & Çekmeceli Gardırop",
      cabinet_type: "wardrobe",
      width_mm: 1500,
      height_mm: 2100,
      depth_mm: 580,
      zones: [
        {
          name: "Sol Askılık & Çekmece",
          width_ratio: 1.3,
          shelf_count: 1,
          drawer_count: 2,
          drawer_front_height_mm: 180,
          has_hanging_rod: true,
          door_type: "double",
        },
        {
          name: "Sağ Çamaşır Rafı",
          width_ratio: 0.8,
          shelf_count: 5,
          drawer_count: 0,
          door_type: "single_right",
        },
      ],
      shelf_count: 3,
      door_type: "double",
      drawer_count: 2,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Beyaz Suntalam",
      door_material: "18mm Doğal Meşe Suntalam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#C89F70",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "bedroom_wardrobe_3zone_master_240",
    categoryId: "bedroom",
    category: "Yatak Odası & Gardırop",
    title: "3 Bölmeli Lüks Master Gardırop: Raflı, Çekmeceli & Çift Askılıklı (240×220×60 cm)",
    subtitle:
      "2 adet dikey ara dikme, sol 5 raflı kule, orta 3 çekmeceli ceket askılığı, sağ tam boy abiye/kaban askılığı",
    totalWidthMm: 2400,
    prompt:
      "240 cm genişliğinde, 220 cm yüksekliğinde, 60 cm derinliğinde, 3 bölmeli master gardırop; sol 5 raflı, orta 3 çekmeceli ve ceket askılıklı, sağ boy elbiselik, ceviz kapaklı",
    highlights: ["2 Dikey Ara Dikme", "Toplam 3 Çekmece", "2 Ayrı Askılık Alanı", "2400mm Master En"],
    config: {
      name: "3 Bölmeli Lüks Master Gardırop",
      cabinet_type: "wardrobe",
      width_mm: 2400,
      height_mm: 2200,
      depth_mm: 600,
      zones: [
        {
          name: "Sol Raf Kulesi",
          width_ratio: 0.9,
          shelf_count: 5,
          drawer_count: 0,
          door_type: "single_left",
        },
        {
          name: "Orta Çekmece & Ceket Askısı",
          width_ratio: 1.2,
          shelf_count: 1,
          drawer_count: 3,
          drawer_front_height_mm: 170,
          has_hanging_rod: true,
          door_type: "double",
        },
        {
          name: "Sağ Boy Elbiselik",
          width_ratio: 0.9,
          shelf_count: 1,
          drawer_count: 0,
          has_hanging_rod: true,
          door_type: "single_right",
        },
      ],
      shelf_count: 4,
      door_type: "double",
      drawer_count: 3,
      drawer_front_height_mm: 170,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Beyaz Suntalam",
      door_material: "18mm Koyu Ceviz MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#6E472B",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "bedroom_dresser_5drawer_high_80",
    categoryId: "bedroom",
    category: "Yatak Odası & Gardırop",
    title: "5 Çekmeceli Yüksek Yatak Odası Çamaşırlığı (80×120×48 cm)",
    subtitle:
      "8 cm bazalı, 5 adet tam açılır teleskopik raylı çekmece kasası ve simetrik 210 mm klapalı şifonyer kulesi",
    totalWidthMm: 800,
    prompt:
      "80 cm genişliğinde, 120 cm yüksekliğinde, 48 cm derinliğinde, 5 çekmeceli, kapaksız, antrasit kapaklı yüksek yatak odası çamaşırlığı",
    highlights: ["5 Çekmece Kasası (25 Parça)", "1200mm Yüksek Kule", "400mm Teleskopik Ray", "Maksimum Çamaşır Alanı"],
    config: {
      name: "5 Çekmeceli Yüksek Çamaşırlık",
      cabinet_type: "dresser",
      width_mm: 800,
      height_mm: 1200,
      depth_mm: 480,
      drawer_count: 5,
      drawer_front_height_mm: 210,
      door_type: "none",
      shelf_count: 0,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Beyaz Suntalam",
      door_material: "18mm Antrasit MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "bedroom_nightstand_single_drawer_50",
    categoryId: "bedroom",
    category: "Yatak Odası & Gardırop",
    title: "1 Çekmeceli & 1 Açık Raflı Yatak Başı Komodini (50×50×40 cm)",
    subtitle:
      "Üstte 1 frenli çekmece, altta açık kitap/telefon koyma rafı ve 6 cm ahşap bazalı kompakt komodin",
    totalWidthMm: 500,
    prompt:
      "50 cm genişliğinde, 50 cm yüksekliğinde, 40 cm derinliğinde, 1 çekmeceli, 1 açık raflı, kapaksız meşe komodin",
    highlights: ["1 Çekmece Kasası", "1 Açık Alt Raf", "Kompakt 500×500mm", "300mm Ray"],
    config: {
      name: "1 Çekmeceli Komodin",
      cabinet_type: "dresser",
      width_mm: 500,
      height_mm: 500,
      depth_mm: 400,
      drawer_count: 1,
      drawer_front_height_mm: 180,
      door_type: "none",
      shelf_count: 1,
      has_plinth: true,
      plinth_height_mm: 60,
      body_material: "18mm Doğal Meşe Suntalam",
      door_material: "18mm Beyaz Suntalam",
      body_color_hex: "#C89F70",
      door_color_hex: "#F4F1EA",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },

  // ============================================================================
  // EK BANYO & ÇAMAŞIR ODASI KOMBİNASYONLARI
  // ============================================================================
  {
    id: "bathroom_laundry_stacked_tower_70",
    categoryId: "bathroom",
    category: "Banyo & Çamaşır Odası",
    title: "Çamaşır Odası: Çamaşır + Kurutma Makinesi Üst Üste Kulesi (70×230×68 cm)",
    subtitle:
      "Alt 170 cm açık çift makine nişi (havalandırma menfezli açık arkalık), üstte gazlı pistonlu kalkar kapaklı deterjanlık",
    totalWidthMm: 700,
    prompt:
      "70 cm genişliğinde, 230 cm yüksekliğinde, 68 cm derinliğinde, altta 170 cm çamaşır ve kurutma makinesi boşluğu olan, arkalıksız havalandırmalı, üstte gazlı pistonlu kalkar kapaklı banyo kulesi",
    highlights: ["1700mm Çift Makine Nişi", "Açık Menfez Arkalık", "Üst Kalkar Kapak", "680mm Derin Gövde"],
    config: {
      name: "Çamaşır ve Kurutma Makinesi Kulesi",
      cabinet_type: "bathroom_tall",
      width_mm: 700,
      height_mm: 2300,
      depth_mm: 680,
      appliance_niche_height_mm: 1700,
      niche_bottom_offset_mm: 0,
      niche_back_open: true,
      has_plinth: false,
      plinth_height_mm: 0,
      door_type: "flap_up",
      shelf_count: 1,
      drawer_count: 0,
      drawer_front_height_mm: 180,
      body_material: "18mm Beyaz MDF-Lam",
      door_material: "18mm Doğal Meşe MDF-Lam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#C89F70",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "bathroom_single_door_hanging_40",
    categoryId: "bathroom",
    category: "Banyo & Çamaşır Odası",
    title: "Duvara Asma Tek Kapaklı Kompakt Banyo Havlu Dolabı (40×140×35 cm)",
    subtitle:
      "Sol menteşeli tek kapaklı, 3 hareketli raflı, banyolar için duvara asma (bazasız) neme dayanıklı havluluk dolabı",
    totalWidthMm: 400,
    prompt:
      "40 cm genişliğinde, 140 cm yüksekliğinde, 35 cm derinliğinde, tek kapak sol menteşeli, 3 raflı, bazasız duvara asma antrasit banyo dolabı",
    highlights: ["Sol Menteşe Tek Kapak", "Duvara Asma (Bazasız)", "3 Hareketli Raf", "400mm Dar Banyo Ölçüsü"],
    config: {
      name: "Asma Tek Kapaklı Banyo Havluluk",
      cabinet_type: "bathroom_tall",
      width_mm: 400,
      height_mm: 1400,
      depth_mm: 350,
      shelf_count: 3,
      door_type: "single_left",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: false,
      plinth_height_mm: 0,
      body_material: "18mm Antrasit MDF-Lam",
      door_material: "18mm Beyaz MDF-Lam",
      body_color_hex: "#374151",
      door_color_hex: "#F4F1EA",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },

  // ============================================================================
  // EK SALON, ŞARAPLIK & KİTAPLIK KOMBİNASYONLARI
  // ============================================================================
  {
    id: "living_wine_bar_credenza_120",
    categoryId: "living",
    category: "Salon, TV & Kitaplık",
    title: "Şaraplık & Kadeklik Aksan Nişli Salon Büfe Konsolu (120×140×42 cm)",
    subtitle:
      "Alt çift kapak + Orta 38 cm ceviz kadeh ve şişelik nişi + Üst çift kapaklı vitrin saklama dolabı",
    totalWidthMm: 1200,
    prompt:
      "120 cm genişliğinde, 140 cm yüksekliğinde, 42 cm derinliğinde, ortasında 38 cm ahşap ceviz kadeh nişi olan, alt ve üstü çift kapaklı antrasit salon büfe dolabı",
    highlights: ["380mm Ahşap Kadeh Nişi", "Alt & Üst Çift Kapak", "Ceviz ve Antrasit", "Salon Büfe Konsolu"],
    config: {
      name: "Şaraplık ve Aksan Nişli Büfe Konsolu",
      cabinet_type: "tv_unit",
      width_mm: 1200,
      height_mm: 1400,
      depth_mm: 420,
      niche_height_mm: 380.0,
      niche_bottom_offset_mm: 500.0,
      niche_color_hex: "#6E472B",
      niche_back_open: false,
      shelf_count: 2,
      door_type: "double",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Antrasit MDF-Lam",
      door_material: "18mm Antrasit MDF-Lam",
      body_color_hex: "#374151",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "living_open_display_bookshelf_100",
    categoryId: "living",
    category: "Salon, TV & Kitaplık",
    title: "Tamamen Açık 5 Raflı Kütüphane & Teşhir Ünitesi (100×200×32 cm)",
    subtitle:
      "Kapaksız, Sistem 32 raf pimi delikli, 5 hareketli raflı, 8 cm bazalı ceviz desenli salon kitaplığı",
    totalWidthMm: 1000,
    prompt:
      "100 cm genişliğinde, 200 cm yüksekliğinde, 32 cm derinliğinde, kapaksız, 5 hareketli raflı koyu ceviz salon açık kitaplığı",
    highlights: ["Kapaksız Açık Raf", "6 Kitap Katı (5 Raf)", "Sistem 32 Raf Delikleri", "Koyu Ceviz Doku"],
    config: {
      name: "5 Raflı Açık Salon Kitaplığı",
      cabinet_type: "bookshelf",
      width_mm: 1000,
      height_mm: 2000,
      depth_mm: 320,
      shelf_count: 5,
      door_type: "none",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Koyu Ceviz MDF-Lam",
      body_color_hex: "#6E472B",
      door_color_hex: "#6E472B",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },

  // ============================================================================
  // EK ANTRE, ÇOK AMAÇLI & TEMİZLİK KOMBİNASYONLARI
  // ============================================================================
  {
    id: "hallway_cleaner_broom_closet_2zone_100",
    categoryId: "hallway",
    category: "Antre & Vestiyer",
    title: "2 Bölmeli Çok Amaçlı Temizlik & Süpürge Dolabı (100×210×45 cm)",
    subtitle:
      "Sol bölmede dikey elektrikli süpürge ve ütü masası nişi, sağ bölmede 5 katlı deterjan ve havlu rafları",
    totalWidthMm: 1000,
    prompt:
      "100 cm genişliğinde, 210 cm yüksekliğinde, 45 cm derinliğinde, 2 bölmeli temizlik dolabı; sol bölme süpürge ve ütü masası için boy niş, sağ bölme 5 raflı, çift kapaklı beyaz dolap",
    highlights: ["Dikey Süpürge Nişi", "5 Katlı Deterjan Rafı", "2 Dikey Bölme", "Çift Kapak"],
    config: {
      name: "Çok Amaçlı Temizlik ve Süpürge Dolabı",
      cabinet_type: "shoe_cabinet",
      width_mm: 1000,
      height_mm: 2100,
      depth_mm: 450,
      zones: [
        {
          name: "Sol Süpürge/Ütü Masası Nişi",
          width_ratio: 0.8,
          shelf_count: 1,
          drawer_count: 0,
          door_type: "single_left",
        },
        {
          name: "Sağ Deterjan & Erzak Rafı",
          width_ratio: 1.2,
          shelf_count: 5,
          drawer_count: 0,
          door_type: "single_right",
        },
      ],
      shelf_count: 4,
      door_type: "double",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Beyaz Suntalam",
      door_material: "18mm Beyaz Suntalam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#F4F1EA",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "hallway_single_right_drawer_entry_45",
    categoryId: "hallway",
    category: "Antre & Vestiyer",
    title: "Tek Kapak Sağ Menteşeli & 1 Çekmeceli Dar Antre Ayakkabılığı (45×190×38 cm)",
    subtitle:
      "Altta 1 anahtarlık/fırça çekmecesi, üstte 4 raflı sağ menteşeli ayakkabı/terlik dolabı",
    totalWidthMm: 450,
    prompt:
      "45 cm genişliğinde, 190 cm yüksekliğinde, 38 cm derinliğinde, altta 1 çekmeceli, üstte sağ tek kapaklı, 4 raflı antrasit kapaklı dar antre dolabı",
    highlights: ["1 Dış Çekmece", "Sağ Menteşe Tek Kapak", "380mm Dar Giriş Eni", "4 Hareketli Raf"],
    config: {
      name: "Tek Kapaklı & Çekmeceli Dar Ayakkabılık",
      cabinet_type: "shoe_cabinet",
      width_mm: 450,
      height_mm: 1900,
      depth_mm: 380,
      shelf_count: 4,
      door_type: "single_right",
      drawer_count: 1,
      drawer_front_height_mm: 160,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Doğal Meşe Suntalam",
      door_material: "18mm Antrasit MDF-Lam",
      body_color_hex: "#C89F70",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },

  // ============================================================================
  // EK OFİS, ÇALIŞMA & MİMARİ KERTMELİ KOMBİNASYONLAR
  // ============================================================================
  {
    id: "office_baseboard_notch_floor_to_ceiling_90",
    categoryId: "office",
    category: "Ofis & Arşiv",
    title: "Süpürgelik Kertmeli & Bazasız Tavandan Tabana Arşiv Dolabı (90×230×40 cm)",
    subtitle:
      "Doğrudan zemine basan bazasız yekpare gövde, 100×18 mm arka süpürgelik kertmesi ve 5 raflı çift kapaklı arşiv dolabı",
    totalWidthMm: 900,
    prompt:
      "90 cm genişliğinde, 230 cm yüksekliğinde, 40 cm derinliğinde, tavandan tabana bazasız, 100x18 mm süpürgelik kertmeli, 5 hareketli raflı, çift kapaklı gri ofis dolabı",
    highlights: ["Bazasız Zemin Basma", "100×18mm Süpürgelik Kertmesi", "6 Klasör Katı (5 Raf)", "2300mm Boy"],
    config: {
      name: "Bazasız & Süpürgelik Kertmeli Arşiv Dolabı",
      cabinet_type: "bookshelf",
      width_mm: 900,
      height_mm: 2300,
      depth_mm: 400,
      has_plinth: false,
      plinth_height_mm: 0,
      has_baseboard_notch: true,
      baseboard_notch_height_mm: 100.0,
      baseboard_notch_depth_mm: 18.0,
      shelf_count: 5,
      door_type: "double",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      body_material: "18mm Açık Gri Suntalam",
      door_material: "18mm Antrasit MDF-Lam",
      body_color_hex: "#9CA3AF",
      door_color_hex: "#374151",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [],
    },
  },
  {
    id: "office_youth_study_workstation_line",
    categoryId: "office",
    category: "Ofis & Arşiv",
    title: "Komple Çalışma & Genç Odası Duvar Hattı (3 Modül — 220 cm)",
    subtitle:
      "Modül 1: 120cm 2 Bölmeli Gardırop + Modül 2: 60cm 4 Raflı Açık Kitaplık + Modül 3: 40cm 3 Çekmeceli Masa Yanı Keson",
    totalWidthMm: 2200,
    prompt:
      "120 cm genişliğinde 2 bölmeli gardırop",
    highlights: ["3 Modül Genç Odası", "Bölmeli Gardırop + Kitaplık + Keson", "Toplam 3 Çekmece + 5 Raf", "2200mm Hat"],
    config: {
      name: "2 Bölmeli Askılıklı & Raflı Gardırop",
      cabinet_type: "wardrobe",
      width_mm: 1200,
      height_mm: 2000,
      depth_mm: 550,
      zones: [
        {
          name: "Sol Askılık Bölmesi",
          width_ratio: 1.0,
          shelf_count: 1,
          has_hanging_rod: true,
          drawer_count: 0,
          door_type: "single_left",
        },
        {
          name: "Sağ Raf Bölmesi",
          width_ratio: 1.0,
          shelf_count: 3,
          drawer_count: 0,
          door_type: "single_right",
        },
      ],
      shelf_count: 3,
      door_type: "double",
      drawer_count: 0,
      drawer_front_height_mm: 180,
      has_plinth: true,
      plinth_height_mm: 80,
      body_material: "18mm Beyaz Suntalam",
      door_material: "18mm Doğal Meşe Suntalam",
      body_color_hex: "#F4F1EA",
      door_color_hex: "#C89F70",
      front_pvc_thickness_mm: 2.0,
      hidden_pvc_thickness_mm: 0.4,
      back_panel_type: "grooved_8mm",
      sheet_size: "2800x2100",
      additional_modules: [
        {
          name: "4 Raflı Açık Çalışma Kitaplığı",
          cabinet_type: "bookshelf",
          width_mm: 600,
          height_mm: 2000,
          depth_mm: 350,
          shelf_count: 4,
          door_type: "none",
          drawer_count: 0,
          drawer_front_height_mm: 180,
          has_plinth: true,
          plinth_height_mm: 80,
          body_material: "18mm Doğal Meşe Suntalam",
          body_color_hex: "#C89F70",
          door_color_hex: "#C89F70",
          front_pvc_thickness_mm: 2.0,
          hidden_pvc_thickness_mm: 0.4,
          back_panel_type: "grooved_8mm",
          sheet_size: "2800x2100",
        },
        {
          name: "3 Çekmeceli Masa Yanı Keson",
          cabinet_type: "dresser",
          width_mm: 400,
          height_mm: 720,
          depth_mm: 500,
          shelf_count: 0,
          door_type: "none",
          drawer_count: 3,
          drawer_front_height_mm: 215,
          has_plinth: false,
          plinth_height_mm: 0,
          body_material: "18mm Beyaz Suntalam",
          door_material: "18mm Doğal Meşe MDF-Lam",
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
  } else if (
    text.includes("banyo boy") ||
    text.includes("çamaşır") ||
    text.includes("camasir")
  ) {
    cabinetType = "bathroom_tall";
    name = "Banyo Boy / Çamaşır Makinesi Dolabı";
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
    text.includes("komodin") ||
    text.includes("keson")
  ) {
    cabinetType = "dresser";
    name = "Şifonyer / Komodin / Keson Modülü";
    widthMm = 900.0;
    heightMm = 860.0;
    depthMm = 480.0;
    drawerCount = 4;
  } else if (
    text.includes("kitaplık") ||
    text.includes("kitaplik") ||
    text.includes("dosya") ||
    text.includes("klasör") ||
    text.includes("arşiv") ||
    text.includes("arsiv")
  ) {
    cabinetType = "bookshelf";
    name = "Parametrik Kitaplık / Ofis Arşiv Modülü";
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

  // 2b. Açık Niş / Cihaz Boşluğu Tespiti (Alt Niş vs. Orta Niş / Kahve Köşesi / Fırın)
  let applianceNicheHeightMm = 0.0;
  let nicheHeightMm = 0.0;
  let nicheBottomOffsetMm = 0.0;
  let nicheColorHex: string | undefined = undefined;
  let nicheBackOpen = false;

  const isCoffee = text.includes("kahve") || text.includes("coffee");
  const isOven = text.includes("fırın") || text.includes("firin") || text.includes("ankastre");
  const isMicro = text.includes("mikrodalga");
  const isMidNicheKeyword =
    text.includes("orta niş") ||
    text.includes("orta nis") ||
    text.includes("orta açık") ||
    isCoffee ||
    isOven ||
    isMicro;
  const isBottomNicheKeyword =
    text.includes("alt niş") ||
    text.includes("alt nis") ||
    text.includes("buzdolab") ||
    text.includes("çamaşır makine") ||
    text.includes("camasir makine");

  const nicheMatch =
    text.match(
      /(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yüksekli[ğg]inde\s*)?(?:açık\s*)?(?:bir\s*)?(?:niş|nis|boşluk|bosluk)/i
    ) ??
    text.match(
      /(?:niş|nis|boşluk|bosluk)[^.]*?(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yüksekli[ğg]inde|yükseklik|boy)/i
    );
  if (nicheMatch) {
    nicheHeightMm = toMm(nicheMatch[1], nicheMatch[2]);
  } else if (isCoffee) {
    nicheHeightMm = 450.0;
  } else if (isOven) {
    nicheHeightMm = 600.0;
  } else if (isMicro) {
    nicheHeightMm = 380.0;
  } else if (text.includes("buzdolab")) {
    nicheHeightMm = Math.min(1850.0, Math.max(0.0, heightMm - 450.0));
  }
  applianceNicheHeightMm = nicheHeightMm;

  // Başlangıç alt kotu (0 = alt niş, >0 = orta açık niş)
  const offsetMatch =
    text.match(/(?:tabandan|yerden|alttan|zeminden)\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i) ??
    text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:yükseklikten|kotundan|üzerinde|uzerinde)/i);
  if (offsetMatch) {
    nicheBottomOffsetMm = toMm(offsetMatch[1], offsetMatch[2]);
  } else if (isMidNicheKeyword && !isBottomNicheKeyword) {
    nicheBottomOffsetMm = 850.0; // Standart tezgah üstü açık niş kotu
  }

  // Arkalık açık mı
  if (
    text.includes("arkalıksız") ||
    text.includes("arkaliksiz") ||
    text.includes("arkalık açık") ||
    text.includes("priz") ||
    isOven ||
    (isCoffee && text.includes("açık"))
  ) {
    nicheBackOpen = true;
  }

  // Kontrast niş aksan rengi
  if (text.includes("ahşap niş") || text.includes("ahsap nis") || text.includes("meşe niş")) {
    nicheColorHex = "#9C6644";
  } else if (text.includes("antrasit niş") || text.includes("siyah niş")) {
    nicheColorHex = "#2D3134";
  } else if (text.includes("beyaz niş")) {
    nicheColorHex = "#F8FAFC";
  } else if (text.includes("ceviz niş")) {
    nicheColorHex = "#5C4033";
  }

  if (nicheHeightMm > 0 && nicheBottomOffsetMm <= 0) {
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

  // Paket A, B, C: Bağlantı sistemi, kesim modu, rölöve kertmesi ve kör çıta tespiti
  const fastenerType: FastenerType =
    text.includes("cabineo") ||
    text.includes("lamello") ||
    text.includes("3 eksen") ||
    text.includes("3-eksen")
      ? "cabineo_12"
      : "minifix_dowel";

  const cuttingMode: CuttingMode =
    text.includes("cnc router") ||
    text.includes("router kesim") ||
    text.includes("vakum")
      ? "cnc_router"
      : "panel_saw";

  const plinthType: PlinthType =
    text.includes("ayarlı ayak") ||
    text.includes("ayarli ayak") ||
    text.includes("plastik ayak") ||
    text.includes("rotilli ayak")
      ? "adjustable_legs"
      : "wood_plinth";

  const hasBaseboardNotch =
    text.includes("süpürgelik") || text.includes("supurgelik");
  const hasColumnNotch =
    text.includes("kolon kert") ||
    text.includes("kiriş kert") ||
    text.includes("kolon çentik");

  let leftFillerWidthMm = 0.0;
  let rightFillerWidthMm = 0.0;
  if (text.includes("kör çıta") || text.includes("kor cita")) {
    leftFillerWidthMm = 50.0;
    if (text.includes("sağ") || text.includes("çift")) {
      rightFillerWidthMm = 50.0;
    }
  }

  // Çoklu Bölme (Zones) veya Elbise Askılığı Tespiti
  let zones: CabinetZone[] | undefined = undefined;
  const isThreeZones =
    text.includes("3 bölmeli") ||
    text.includes("3 bolmeli") ||
    text.includes("üç bölmeli") ||
    text.includes("uc bolmeli") ||
    text.includes("orta bölme") ||
    text.includes("orta bolme") ||
    text.includes("ortası") ||
    text.includes("ortada");

  if (isThreeZones) {
    zones = [
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
  } else if (
    text.includes("bölmeli") ||
    text.includes("bolmeli") ||
    text.includes("dikmeli") ||
    text.includes("kolonlu") ||
    ((text.includes("sol") || text.includes("solu") || text.includes("solda")) &&
      (text.includes("sağ") || text.includes("sağı") || text.includes("sagda")))
  ) {
    let solRaf = 0;
    let sagRaf = 0;
    let solCek = 0;
    let sagCek = 0;
    let solAski = false;
    let sagAski = false;

    const mSolRaf = text.match(/sol[a-z\s]*?(\d+)\s*raf/);
    if (mSolRaf) solRaf = parseInt(mSolRaf[1], 10);
    else if (text.includes("sol") && text.includes("raf")) solRaf = 3;

    const mSolCek = text.match(/sol[a-z\s]*?(\d+)\s*çekmece/);
    if (mSolCek) solCek = parseInt(mSolCek[1], 10);

    if (
      text.includes("sol") &&
      (text.includes("askı") || text.includes("aski") || text.includes("elbise"))
    ) {
      solAski = true;
    }

    const mSagRaf = text.match(/sağ[a-z\s]*?(\d+)\s*raf/);
    if (mSagRaf) sagRaf = parseInt(mSagRaf[1], 10);

    const mSagCek = text.match(/sağ[a-z\s]*?(\d+)\s*çekmece/);
    if (mSagCek) sagCek = parseInt(mSagCek[1], 10);
    else if (text.includes("sağ") && text.includes("çekmece")) sagCek = 2;

    if (
      text.includes("sağ") &&
      (text.includes("askı") || text.includes("aski") || text.includes("elbise"))
    ) {
      sagAski = true;
    }

    if (
      !solAski &&
      !sagAski &&
      (text.includes("askı") || text.includes("aski") || text.includes("elbise"))
    ) {
      sagAski = true;
    }

    zones = [
      {
        id: "z_1",
        name: "Sol Bölme",
        width_ratio: 1.0,
        shelf_count: solRaf,
        drawer_count: solCek,
        has_hanging_rod: solAski,
        door_type: "single_left",
      },
      {
        id: "z_2",
        name: "Sağ Bölme",
        width_ratio: 1.0,
        shelf_count: sagRaf,
        drawer_count: sagCek,
        has_hanging_rod: sagAski,
        door_type: "single_right",
      },
    ];
  } else if (
    text.includes("askılık") ||
    text.includes("askilik") ||
    text.includes("askı borusu") ||
    text.includes("aski borusu") ||
    text.includes("elbise askı")
  ) {
    zones = [
      {
        id: "z_1",
        name: "Ana Askı Bölmesi",
        width_ratio: 1.0,
        shelf_count: text.includes("raf") ? shelfCount : 1,
        drawer_count: drawerCount,
        has_hanging_rod: true,
        door_type: doorType,
      },
    ];
  }

  // Çatı Eğimi (Merdiven Altı / Mansard) ve L-Köşe Modülü Tespiti
  let hasSlope = false;
  let slopeSide: "left" | "right" = "left";
  let slopeStartHeightMm = 1200.0;
  if (
    text.includes("merdiven altı") ||
    text.includes("merdiven alti") ||
    text.includes("çatı eğimi") ||
    text.includes("cati egimi") ||
    text.includes("tavan eğimi") ||
    text.includes("tavan egimi") ||
    text.includes("mansard") ||
    text.includes("eğimli dolap") ||
    text.includes("egimli dolap") ||
    text.includes("eğimli tavan") ||
    text.includes("egimli tavan") ||
    text.includes("çatı katı") ||
    text.includes("cati kati")
  ) {
    hasSlope = true;
    if (
      text.includes("sağ tarafı eğimli") ||
      text.includes("sağa doğru") ||
      text.includes("sağ alçak") ||
      text.includes("sag alcak")
    ) {
      slopeSide = "right";
    }
    const mSlopeH =
      text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?(?:'den|den|'dan|dan)?\s*(?:başlayan|alçalan|yükselen|başlayıp)/) ||
      text.match(/alçak\s*(?:tarafı?|dikme|kenar)\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/);
    if (mSlopeH) {
      slopeStartHeightMm = toMm(mSlopeH[1], mSlopeH[2]);
    } else {
      slopeStartHeightMm = Math.max(400, heightMm - 600);
    }
  }

  const isCornerModule =
    text.includes("l-köşe") ||
    text.includes("l köşe") ||
    text.includes("l-kose") ||
    text.includes("l kose") ||
    text.includes("köşe dolap") ||
    text.includes("kose dolap") ||
    text.includes("köşe modül") ||
    text.includes("kose modul");

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
    niche_height_mm: nicheHeightMm,
    niche_bottom_offset_mm: nicheBottomOffsetMm,
    niche_color_hex: nicheColorHex,
    niche_back_open: nicheBackOpen,
    additional_modules: [],
    zones,
    has_slope: hasSlope,
    slope_side: slopeSide,
    slope_start_height_mm: slopeStartHeightMm,
    is_corner_module: isCornerModule,
    corner_blind_width_mm: 100.0,
    corner_angle_deg: 90.0,
    has_plinth: hasPlinth,
    plinth_height_mm: plinthHeightMm,
    plinth_type: plinthType,
    fastener_type: fastenerType,
    cutting_mode: cuttingMode,
    router_bit_diameter_mm: 10.0,
    left_filler_width_mm: leftFillerWidthMm,
    right_filler_width_mm: rightFillerWidthMm,
    has_baseboard_notch: hasBaseboardNotch,
    baseboard_notch_height_mm: 80.0,
    baseboard_notch_depth_mm: 15.0,
    has_column_notch: hasColumnNotch,
    column_notch_width_mm: 120.0,
    column_notch_depth_mm: 120.0,
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

function buildDoorDrills(
  doorH: number,
  doorW: number,
  hingeOnLeft: boolean
): DrillPoint[] {
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
}

function generateZonesParts(
  config: CabinetConfig,
  moduleIdx: number,
  xOffsetMm: number,
  startPartCounter: number,
  multiMode: boolean
): {
  parts: PanelPart[];
  nextCounter: number;
  totalHandles: number;
  totalHinges: number;
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
  const rawNicheH = Math.max(
    config.niche_height_mm ?? 0.0,
    config.appliance_niche_height_mm ?? 0.0
  );
  const nicheOffset = config.niche_bottom_offset_mm ?? 0.0;
  const isBottomNiche = rawNicheH > 0 && nicheOffset <= 0;
  const nicheH = isBottomNiche
    ? Math.min(rawNicheH, Math.max(0.0, h - 260.0))
    : 0.0;
  const plinthH = config.has_plinth && !isBottomNiche ? config.plinth_height_mm : 0.0;
  const baseOffsetY = isBottomNiche ? nicheH : plinthH;
  const innerW = round2(w - 2.0 * t);
  const clearInnerH = round2(h - baseOffsetY - 2.0 * t);
  const isGrooved = config.back_panel_type === "grooved_8mm";
  const rearLoss = isGrooved
    ? MC.BACK_GROOVE_OFFSET_FROM_REAR_MM + MC.BACK_GROOVE_WIDTH_MM
    : 0.0;

  const doorMat =
    config.door_material && config.door_material.trim()
      ? config.door_material.trim()
      : config.body_material;

  let totalHandles = 0;
  let totalHinges = 0;
  let totalGasStruts = 0;

  const zones = config.zones ?? [];
  const dividerCount = Math.max(0, zones.length - 1);
  const totalDividerT = dividerCount * t;
  const availW = Math.max(100.0, innerW - totalDividerT);

  // Genişlik Dağılımı
  let fixedWTotal = 0;
  let flexRatioTotal = 0;
  zones.forEach((z) => {
    if (z.width_mm && z.width_mm > 0) fixedWTotal += z.width_mm;
    else flexRatioTotal += (z.width_ratio && z.width_ratio > 0 ? z.width_ratio : 1.0);
  });
  const remainingFlexW = Math.max(50.0, availW - fixedWTotal);
  const zoneWidths: number[] = zones.map((z) => {
    if (z.width_mm && z.width_mm > 0) return round2(z.width_mm);
    const r = (z.width_ratio && z.width_ratio > 0 ? z.width_ratio : 1.0);
    return round2(remainingFlexW * (r / (flexRatioTotal || 1.0)));
  });

  // Koordinatların Hesaplanması
  let curX = round2(xOffsetMm - innerW / 2.0);
  const zoneCoords: { startX: number; endX: number; centerX: number; width: number }[] = [];
  const dividerCoords: { centerX: number }[] = [];

  for (let i = 0; i < zones.length; i++) {
    const zw = zoneWidths[i];
    const startX = curX;
    const endX = round2(curX + zw);
    const centerX = round2((startX + endX) / 2.0);
    zoneCoords.push({ startX, endX, centerX, width: zw });
    curX = endX;
    if (i < dividerCount) {
      dividerCoords.push({ centerX: round2(curX + t / 2.0) });
      curX = round2(curX + t);
    }
  }

  // 1. İç Ara Dikmeler (Vertical Dividers)
  const dividerNetW = round2(d - rearLoss - 10.0);
  const dividerEdge: EdgeBandSpec = {
    length_1_mm: config.front_pvc_thickness_mm,
    length_2_mm: config.hidden_pvc_thickness_mm,
    width_1_mm: 0.0,
    width_2_mm: 0.0,
  };
  const [divCutL, divCutW, divDedL, divDedW] = computeCutDimensions(
    clearInnerH,
    dividerNetW,
    dividerEdge
  );

  dividerCoords.forEach((dc, divIdx) => {
    const divNum = String(divIdx + 1).padStart(2, "0");
    parts.push({
      part_id: padId(partCounter++),
      code: `${prefix}DIKME_${divNum}`,
      name: `${labelPrefix}İç Ara Dikme #${divIdx + 1}`,
      material: config.body_material,
      thickness_mm: t,
      quantity: 1,
      net_length_mm: clearInnerH,
      net_width_mm: dividerNetW,
      cut_length_mm: divCutL,
      cut_width_mm: divCutW,
      pvc_deduction_length_mm: divDedL,
      pvc_deduction_width_mm: divDedW,
      edge_band: dividerEdge,
      area_m2: round4((clearInnerH * dividerNetW) / 1_000_000.0),
      grain_direction: "length",
      drills: [],
      grooves: [],
      transform_3d: {
        center_x_mm: dc.centerX,
        center_y_mm: round2(baseOffsetY + t + clearInnerH / 2.0),
        center_z_mm: round2(-5.0),
        size_x_mm: t,
        size_y_mm: clearInnerH,
        size_z_mm: dividerNetW,
        color_hex: config.body_color_hex,
        is_door: false,
        is_drawer: false,
        hinge_side: null,
        module_index: moduleIdx,
      },
    });
  });

  // 2. Her Bölmenin (Zone) Donanımları: Çekmeceler, Raflar, Askılık, Açık Niş ve Kapaklar
  zones.forEach((z, zi) => {
    const zc = zoneCoords[zi];
    const zw = zc.width;
    const zName = z.name || `Bölme #${zi + 1}`;

    const zRawNicheH = Math.max(z.niche_height_mm ?? 0.0, z.appliance_niche_height_mm ?? 0.0);
    const zNicheOffset = z.niche_bottom_offset_mm ?? 0.0;
    const zIsMidNiche = zRawNicheH > 0 && zNicheOffset > 0;

    const zLowerClearH = zIsMidNiche ? round2(Math.min(zNicheOffset, clearInnerH - 180.0)) : 0.0;
    const zMidNicheH = zIsMidNiche
      ? round2(Math.min(zRawNicheH, Math.max(100.0, clearInnerH - zLowerClearH - t)))
      : 0.0;
    const zUpperClearH = zIsMidNiche
      ? round2(clearInnerH - zLowerClearH - zMidNicheH - 2.0 * t)
      : 0.0;
    const zHasUpperShelf = zIsMidNiche && zUpperClearH >= 80.0;

    // 2a. Açık Niş Ara Tablaları (Varsa)
    if (zIsMidNiche) {
      const zHorizEdge: EdgeBandSpec = {
        length_1_mm: config.front_pvc_thickness_mm,
        length_2_mm: config.hidden_pvc_thickness_mm,
        width_1_mm: 0.0,
        width_2_mm: 0.0,
      };
      const [zhCutL, zhCutW, zhDedL, zhDedW] = computeCutDimensions(zw, d, zHorizEdge);

      // Niş Alt Tablası
      parts.push({
        part_id: padId(partCounter++),
        code: `${prefix}Z${zi + 1}_TABLA_ARA_NIS_ALT`,
        name: `${labelPrefix}${zName} Niş Alt Tablası`,
        material: config.body_material,
        thickness_mm: t,
        quantity: 1,
        net_length_mm: zw,
        net_width_mm: d,
        cut_length_mm: zhCutL,
        cut_width_mm: zhCutW,
        pvc_deduction_length_mm: zhDedL,
        pvc_deduction_width_mm: zhDedW,
        edge_band: zHorizEdge,
        area_m2: round4((zw * d) / 1_000_000.0),
        grain_direction: "length",
        drills: [],
        grooves: [],
        transform_3d: {
          center_x_mm: zc.centerX,
          center_y_mm: round2(baseOffsetY + t + zLowerClearH + t / 2.0),
          center_z_mm: 0.0,
          size_x_mm: zw,
          size_y_mm: t,
          size_z_mm: d,
          color_hex: z.niche_color_hex || config.niche_color_hex || config.body_color_hex,
          is_door: false,
          is_drawer: false,
          is_niche: true,
          hinge_side: null,
          module_index: moduleIdx,
        },
      });

      // Niş Üst Tablası
      if (zHasUpperShelf) {
        parts.push({
          part_id: padId(partCounter++),
          code: `${prefix}Z${zi + 1}_TABLA_ARA_NIS_UST`,
          name: `${labelPrefix}${zName} Niş Üst Tablası`,
          material: config.body_material,
          thickness_mm: t,
          quantity: 1,
          net_length_mm: zw,
          net_width_mm: d,
          cut_length_mm: zhCutL,
          cut_width_mm: zhCutW,
          pvc_deduction_length_mm: zhDedL,
          pvc_deduction_width_mm: zhDedW,
          edge_band: zHorizEdge,
          area_m2: round4((zw * d) / 1_000_000.0),
          grain_direction: "length",
          drills: [],
          grooves: [],
          transform_3d: {
            center_x_mm: zc.centerX,
            center_y_mm: round2(baseOffsetY + t + zLowerClearH + t + zMidNicheH + t / 2.0),
            center_z_mm: 0.0,
            size_x_mm: zw,
            size_y_mm: t,
            size_z_mm: d,
            color_hex: z.niche_color_hex || config.niche_color_hex || config.body_color_hex,
            is_door: false,
            is_drawer: false,
            is_niche: true,
            hinge_side: null,
            module_index: moduleIdx,
          },
        });
      }

      // Niş Aksan Arkalığı (Eğer niche_back_open false ve renk tanımlıysa)
      if (!z.niche_back_open && (z.niche_color_hex || config.niche_color_hex)) {
        const nColor = z.niche_color_hex || config.niche_color_hex!;
        const noEdgeBack: EdgeBandSpec = { length_1_mm: 0, length_2_mm: 0, width_1_mm: 0, width_2_mm: 0 };
        const backZ = isGrooved
          ? round2(-d / 2.0 + MC.BACK_GROOVE_OFFSET_FROM_REAR_MM + MC.BACK_GROOVE_WIDTH_MM / 2.0)
          : round2(-d / 2.0 - 4.0);
        parts.push({
          part_id: padId(partCounter++),
          code: `${prefix}Z${zi + 1}_ARKALIK_NIS_AKSAN`,
          name: `${labelPrefix}${zName} Açık Niş Aksan Arkalığı`,
          material: "8mm Kontrast MDF-Lam",
          thickness_mm: 8.0,
          quantity: 1,
          net_length_mm: zMidNicheH,
          net_width_mm: zw,
          cut_length_mm: zMidNicheH,
          cut_width_mm: zw,
          pvc_deduction_length_mm: 0.0,
          pvc_deduction_width_mm: 0.0,
          edge_band: noEdgeBack,
          area_m2: round4((zMidNicheH * zw) / 1_000_000.0),
          grain_direction: "length",
          drills: [],
          grooves: [],
          transform_3d: {
            center_x_mm: zc.centerX,
            center_y_mm: round2(baseOffsetY + t + zLowerClearH + t + zMidNicheH / 2.0),
            center_z_mm: backZ,
            size_x_mm: zw,
            size_y_mm: zMidNicheH,
            size_z_mm: 8.0,
            color_hex: nColor,
            is_door: false,
            is_drawer: false,
            is_niche: true,
            hinge_side: null,
            module_index: moduleIdx,
          },
        });
      }
    }

    // 2b. Çekmeceler
    const zActiveDrawerH = zIsMidNiche ? zLowerClearH : clearInnerH;
    const zDrawerCount = z.drawer_count ?? 0;
    let zDrawerFrontH = z.drawer_front_height_mm ?? 180.0;
    if (zDrawerCount > 0 && zDrawerCount * zDrawerFrontH > zActiveDrawerH - 20.0) {
      zDrawerFrontH = round2((zActiveDrawerH - 10.0) / zDrawerCount);
    }
    const zDrawerZoneH = round2(zDrawerCount * zDrawerFrontH);

    if (zDrawerCount > 0) {
      const slideLen = selectDrawerSlideLength(d);
      const boxH = round2(Math.max(80.0, zDrawerFrontH - MC.DRAWER_BOX_HEIGHT_REDUCTION_MM));
      const boxInnerW = round2(zw - MC.DRAWER_SLIDE_CLEARANCE_TOTAL_MM - 2.0 * t);
      const frontNetW = round2(zw - 2.0 * MC.DOOR_OUTER_GAP_MM);
      const frontNetH = round2(zDrawerFrontH - MC.DOOR_CENTER_GAP_MM);

      const frontEdge: EdgeBandSpec = {
        length_1_mm: config.front_pvc_thickness_mm,
        length_2_mm: config.front_pvc_thickness_mm,
        width_1_mm: config.front_pvc_thickness_mm,
        width_2_mm: config.front_pvc_thickness_mm,
      };
      const [fCutL, fCutW, fDedL, fDedW] = computeCutDimensions(frontNetW, frontNetH, frontEdge);

      const boxEdge: EdgeBandSpec = {
        length_1_mm: config.hidden_pvc_thickness_mm,
        length_2_mm: 0.0,
        width_1_mm: 0.0,
        width_2_mm: 0.0,
      };
      const [bsCutL, bsCutW, bsDedL, bsDedW] = computeCutDimensions(slideLen, boxH, boxEdge);
      const [bfCutL, bfCutW, bfDedL, bfDedW] = computeCutDimensions(boxInnerW, boxH, boxEdge);

      const bottomW = round2(boxInnerW + 15.0);
      const bottomL = round2(slideLen - 2.0 * t + 15.0);
      const noEdge: EdgeBandSpec = { length_1_mm: 0, length_2_mm: 0, width_1_mm: 0, width_2_mm: 0 };

      for (let dIdx = 1; dIdx <= zDrawerCount; dIdx += 1) {
        const dStr = String(dIdx).padStart(2, "0");
        const centerY = round2(baseOffsetY + t + (dIdx - 0.5) * zDrawerFrontH);
        const klapaZ = round2(d / 2.0 + t / 2.0 + 1.5);
        const boxZ = round2(d / 2.0 - slideLen / 2.0 - 5.0);
        totalHandles += 1;

        // Klapa
        parts.push({
          part_id: padId(partCounter++),
          code: `${prefix}Z${zi + 1}_CEK_KLAPA_${dStr}`,
          name: `${labelPrefix}${zName} Çekmece #${dIdx} Klapası`,
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
            center_x_mm: zc.centerX,
            center_y_mm: centerY,
            center_z_mm: klapaZ,
            size_x_mm: frontNetW,
            size_y_mm: frontNetH,
            size_z_mm: t,
            color_hex: z.door_color_hex || config.door_color_hex,
            is_door: false,
            is_drawer: true,
            hinge_side: null,
            module_index: moduleIdx,
          },
        });

        // Yanlar
        for (const [sideCode, sideName, sideX] of [
          ["SOL", "Sol Yan", round2(zc.centerX - boxInnerW / 2.0 - t / 2.0)],
          ["SAG", "Sağ Yan", round2(zc.centerX + boxInnerW / 2.0 + t / 2.0)],
        ] as const) {
          parts.push({
            part_id: padId(partCounter++),
            code: `${prefix}Z${zi + 1}_CEK_${dStr}_${sideCode}`,
            name: `${labelPrefix}${zName} Çekmece #${dIdx} ${sideName}`,
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
              center_x_mm: sideX,
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

        // Ön & Arka
        for (const [fbCode, fbName, fbZ] of [
          ["ON", "İç Ön Kasa", round2(boxZ + slideLen / 2.0 - t / 2.0)],
          ["ARKA", "İç Arka Kasa", round2(boxZ - slideLen / 2.0 + t / 2.0)],
        ] as const) {
          parts.push({
            part_id: padId(partCounter++),
            code: `${prefix}Z${zi + 1}_CEK_${dStr}_${fbCode}`,
            name: `${labelPrefix}${zName} Çekmece #${dIdx} ${fbName}`,
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
              center_x_mm: zc.centerX,
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

        // Taban
        parts.push({
          part_id: padId(partCounter++),
          code: `${prefix}Z${zi + 1}_CEK_${dStr}_TABAN`,
          name: `${labelPrefix}${zName} Çekmece #${dIdx} Tabanı (8mm)`,
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
            center_x_mm: zc.centerX,
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

    // 2c. Elbise Askılığı
    const zRemainH = zIsMidNiche ? zUpperClearH : round2(clearInnerH - zDrawerZoneH);
    if (z.has_hanging_rod && zRemainH > 300.0) {
      const rodL = round2(zw - 4.0);
      const rodCenterY = zIsMidNiche
        ? round2(baseOffsetY + t + zLowerClearH + t + zMidNicheH + t + zUpperClearH - 70.0)
        : round2(baseOffsetY + t + clearInnerH - 70.0);
      parts.push({
        part_id: padId(partCounter++),
        code: `${prefix}Z${zi + 1}_ASKILIK`,
        name: `${labelPrefix}${zName} Elbise Askı Borusu (Alüminyum)`,
        material: "Alüminyum Oval Askı Borusu",
        thickness_mm: 15,
        quantity: 1,
        net_length_mm: rodL,
        net_width_mm: 30,
        cut_length_mm: rodL,
        cut_width_mm: 30,
        pvc_deduction_length_mm: 0,
        pvc_deduction_width_mm: 0,
        edge_band: { length_1_mm: 0, length_2_mm: 0, width_1_mm: 0, width_2_mm: 0 },
        area_m2: 0.01,
        grain_direction: "none",
        drills: [],
        grooves: [],
        transform_3d: {
          center_x_mm: zc.centerX,
          center_y_mm: rodCenterY,
          center_z_mm: 0.0,
          size_x_mm: rodL,
          size_y_mm: 30.0,
          size_z_mm: 15.0,
          color_hex: "#CBD5E1",
          is_door: false,
          is_drawer: false,
          is_hanging_rod: true,
          hinge_side: null,
          module_index: moduleIdx,
        },
      });
    }

    // 2d. Raflar
    if (z.shelf_count > 0 && zRemainH > 120.0) {
      const shelfNetL = round2(zw - MC.SHELF_WIDTH_CLEARANCE_MM);
      const shelfNetW = round2(d - rearLoss - MC.SHELF_FRONT_SETBACK_MM);
      const shelfEdge: EdgeBandSpec = {
        length_1_mm: config.front_pvc_thickness_mm,
        length_2_mm: config.hidden_pvc_thickness_mm,
        width_1_mm: config.hidden_pvc_thickness_mm,
        width_2_mm: config.hidden_pvc_thickness_mm,
      };
      const [sCutL, sCutW, sDedL, sDedW] = computeCutDimensions(shelfNetL, shelfNetW, shelfEdge);
      const stepH = zRemainH / (z.shelf_count + 1);
      const shelfZCenter = round2((rearLoss - MC.SHELF_FRONT_SETBACK_MM) / 2.0);
      const shelfBaseY = zIsMidNiche
        ? round2(baseOffsetY + t + zLowerClearH + t + zMidNicheH + t)
        : round2(baseOffsetY + t + zDrawerZoneH);

      for (let sIdx = 1; sIdx <= z.shelf_count; sIdx += 1) {
        parts.push({
          part_id: padId(partCounter++),
          code: `${prefix}Z${zi + 1}_RAF_${String(sIdx).padStart(2, "0")}`,
          name: `${labelPrefix}${zName} Hareketli Raf #${sIdx}`,
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
            center_x_mm: zc.centerX,
            center_y_mm: round2(shelfBaseY + sIdx * stepH),
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

    // 2e. Kapaklar (Yardımcı Kapak Oluşturucu)
    const generateZoneDoorCavity = (
      availH: number,
      yCenter: number,
      doorCodeSuffix: string,
      doorNameSuffix: string
    ) => {
      if (!z.door_type || z.door_type === "none" || availH < 180.0) return;
      const doorNetH = round2(availH - 4.0);
      const doorEdge: EdgeBandSpec = {
        length_1_mm: config.front_pvc_thickness_mm,
        length_2_mm: config.front_pvc_thickness_mm,
        width_1_mm: config.front_pvc_thickness_mm,
        width_2_mm: config.front_pvc_thickness_mm,
      };
      const doorZCenter = round2(d / 2.0 + t / 2.0 + 1.5);
      const doorColor = z.door_color_hex || config.door_color_hex;

      if (z.door_type === "flap_up") {
        const doorNetW = round2(zw - 2.0 * MC.DOOR_OUTER_GAP_MM);
        const [dCutL, dCutW, dDedL, dDedW] = computeCutDimensions(doorNetH, doorNetW, doorEdge);
        totalGasStruts += 2;
        totalHandles += 1;
        parts.push({
          part_id: padId(partCounter++),
          code: `${prefix}Z${zi + 1}_KAPAK_${doorCodeSuffix ? doorCodeSuffix + "_" : ""}KALKAR`,
          name: `${labelPrefix}${zName} ${doorNameSuffix}Kalkar Kapak`,
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
          drills: [],
          grooves: [],
          transform_3d: {
            center_x_mm: zc.centerX,
            center_y_mm: yCenter,
            center_z_mm: doorZCenter,
            size_x_mm: doorNetW,
            size_y_mm: doorNetH,
            size_z_mm: t,
            color_hex: doorColor,
            is_door: true,
            is_drawer: false,
            hinge_side: "top",
            module_index: moduleIdx,
          },
        });
      } else if (z.door_type === "single_left" || z.door_type === "single_right") {
        const doorNetW = round2(zw - 2.0 * MC.DOOR_OUTER_GAP_MM);
        const [dCutL, dCutW, dDedL, dDedW] = computeCutDimensions(doorNetH, doorNetW, doorEdge);
        const hingeLeft = z.door_type === "single_left";
        const dDrills = buildDoorDrills(doorNetH, doorNetW, hingeLeft);
        totalHinges += dDrills.length;
        totalHandles += 1;
        parts.push({
          part_id: padId(partCounter++),
          code: `${prefix}Z${zi + 1}_KAPAK_${doorCodeSuffix ? doorCodeSuffix + "_" : ""}TEK`,
          name: hingeLeft
            ? `${labelPrefix}${zName} ${doorNameSuffix}Tek Kapak (Sol Menteşeli)`
            : `${labelPrefix}${zName} ${doorNameSuffix}Tek Kapak (Sağ Menteşeli)`,
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
            center_x_mm: zc.centerX,
            center_y_mm: yCenter,
            center_z_mm: doorZCenter,
            size_x_mm: doorNetW,
            size_y_mm: doorNetH,
            size_z_mm: t,
            color_hex: doorColor,
            is_door: true,
            is_drawer: false,
            hinge_side: hingeLeft ? "left" : "right",
            module_index: moduleIdx,
          },
        });
      } else if (z.door_type === "double") {
        const doorNetW = round2((zw - 2.0 * MC.DOOR_OUTER_GAP_MM - MC.DOOR_CENTER_GAP_MM) / 2.0);
        const [dCutL, dCutW, dDedL, dDedW] = computeCutDimensions(doorNetH, doorNetW, doorEdge);
        totalHandles += 2;
        for (const [sideCode, sideLabel, isLeft, relCx] of [
          ["SOL", "Sol Kapak", true, round2(-doorNetW / 2.0 - MC.DOOR_CENTER_GAP_MM / 2.0)],
          ["SAG", "Sağ Kapak", false, round2(doorNetW / 2.0 + MC.DOOR_CENTER_GAP_MM / 2.0)],
        ] as const) {
          const dDrills = buildDoorDrills(doorNetH, doorNetW, isLeft);
          totalHinges += dDrills.length;
          parts.push({
            part_id: padId(partCounter++),
            code: `${prefix}Z${zi + 1}_KAPAK_${doorCodeSuffix ? doorCodeSuffix + "_" : ""}${sideCode}`,
            name: `${labelPrefix}${zName} ${doorNameSuffix}${sideLabel}`,
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
              center_x_mm: round2(zc.centerX + relCx),
              center_y_mm: yCenter,
              center_z_mm: doorZCenter,
              size_x_mm: doorNetW,
              size_y_mm: doorNetH,
              size_z_mm: t,
              color_hex: doorColor,
              is_door: true,
              is_drawer: false,
              hinge_side: isLeft ? "left" : "right",
              module_index: moduleIdx,
            },
          });
        }
      }
    };

    if (zIsMidNiche) {
      if (zDrawerCount === 0 && zLowerClearH >= 180.0) {
        generateZoneDoorCavity(
          round2(zLowerClearH + t),
          round2(baseOffsetY + t / 2.0 + zLowerClearH / 2.0),
          "ALT",
          "Alt "
        );
      }
      if (zHasUpperShelf && zUpperClearH >= 180.0) {
        generateZoneDoorCavity(
          round2(zUpperClearH + t),
          round2(baseOffsetY + t + zLowerClearH + t + zMidNicheH + t / 2.0 + zUpperClearH / 2.0),
          "UST",
          "Üst "
        );
      }
    } else {
      const zDoorAvailH = round2(clearInnerH - zDrawerZoneH);
      if (zDoorAvailH >= 200.0) {
        generateZoneDoorCavity(
          round2(zDoorAvailH + (zDrawerCount === 0 ? 2.0 * t : t)),
          round2(baseOffsetY + zDrawerZoneH + zDoorAvailH / 2.0),
          "",
          ""
        );
      }
    }
  });

  return {
    parts,
    nextCounter: partCounter,
    totalHandles,
    totalHinges,
    totalGasStruts,
  };
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
  cabineoCount: number;
  adjustableLegsCount: number;
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
  const rawNicheH = Math.max(
    config.niche_height_mm ?? 0.0,
    config.appliance_niche_height_mm ?? 0.0
  );
  const nicheOffset = config.niche_bottom_offset_mm ?? 0.0;
  const isBottomNiche = rawNicheH > 0 && nicheOffset <= 0;
  const nicheH = isBottomNiche
    ? Math.min(rawNicheH, Math.max(0.0, h - 260.0))
    : 0.0;
  const plinthH = config.has_plinth && !isBottomNiche ? config.plinth_height_mm : 0.0;
  const baseOffsetY = isBottomNiche ? nicheH : plinthH;
  const doorMat =
    config.door_material && config.door_material.trim()
      ? config.door_material.trim()
      : config.body_material;

  const isCabineo = config.fastener_type === "cabineo_12";
  const isAdjustableLegs = config.plinth_type === "adjustable_legs";

  const innerW = round2(w - 2.0 * t);
  const clearInnerH = round2(h - baseOffsetY - 2.0 * t);

  // Açık Orta Niş Parametreleri
  const isMidNiche = rawNicheH > 0 && nicheOffset > 0;
  const lowerClearH = isMidNiche
    ? round2(Math.min(nicheOffset, clearInnerH - 180.0))
    : 0.0;
  const midNicheH = isMidNiche
    ? round2(Math.min(rawNicheH, Math.max(100.0, clearInnerH - lowerClearH - t)))
    : 0.0;
  const upperClearH = isMidNiche
    ? round2(clearInnerH - lowerClearH - midNicheH - 2.0 * t)
    : 0.0;
  const hasUpperNicheShelf = isMidNiche && upperClearH >= 80.0;

  const drawerCount = config.drawer_count ?? 0;
  let drawerFrontH = config.drawer_front_height_mm ?? 180.0;
  const activeDrawerSpace = isMidNiche ? lowerClearH : clearInnerH;
  if (drawerCount > 0 && drawerCount * drawerFrontH > activeDrawerSpace - 20.0) {
    drawerFrontH = round2((activeDrawerSpace - 10.0) / drawerCount);
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
      if (isCabineo) {
        sideDrills.push({
          x_mm: connX,
          y_mm: yPos,
          diameter_mm: MC.CABINEO_SCREW_DIAMETER_MM,
          depth_mm: MC.CABINEO_SCREW_DEPTH_MM,
          layer: MC.LAYER_CABINEO_SCREW,
          description: `${label} Lamello Cabineo Vida Karşılık Deliği (Saf Z-Ekseni Ø5mm)`,
        });
      } else {
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
  }

  // Niş Ara Tablaları İçin Yan Dikme Delikleri
  if (isMidNiche) {
    const shelfXCoords = [round2(baseOffsetY + t + lowerClearH + tHalf)];
    if (hasUpperNicheShelf) {
      shelfXCoords.push(round2(baseOffsetY + t + lowerClearH + t + midNicheH + tHalf));
    }
    for (const sConnX of shelfXCoords) {
      for (const yPos of connYCoords) {
        if (isCabineo) {
          sideDrills.push({
            x_mm: sConnX,
            y_mm: yPos,
            diameter_mm: MC.CABINEO_SCREW_DIAMETER_MM,
            depth_mm: MC.CABINEO_SCREW_DEPTH_MM,
            layer: MC.LAYER_CABINEO_SCREW,
            description: "Niş Ara Tabla Cabineo Vida Karşılık Deliği (Ø5mm)",
          });
        } else {
          sideDrills.push({
            x_mm: sConnX,
            y_mm: yPos,
            diameter_mm: MC.MINIFIX_BOLT_DIAMETER_MM,
            depth_mm: MC.MINIFIX_BOLT_DEPTH_MM,
            layer: MC.LAYER_MINIFIX_BOLT,
            description: "Niş Ara Tabla Minifiks Mil Deliği",
          });
          const dowelY = round2(yPos + MC.DOWEL_OFFSET_FROM_MINIFIX_MM);
          if (dowelY <= d - 25.0) {
            sideDrills.push({
              x_mm: sConnX,
              y_mm: dowelY,
              diameter_mm: MC.DOWEL_DIAMETER_MM,
              depth_mm: MC.DOWEL_DEPTH_MM,
              layer: MC.LAYER_DOWEL,
              description: "Niş Ara Tabla Kavela Deliği",
            });
          }
        }
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

  const sideNotchNotes: string[] = [];
  if (config.has_baseboard_notch) {
    sideNotchNotes.push(
      `Süpürgelik Kertmesi: ${config.baseboard_notch_height_mm ?? 80}×${config.baseboard_notch_depth_mm ?? 15}mm`
    );
  }
  if (config.has_column_notch) {
    sideNotchNotes.push(
      `Arka Kolon Kertmesi: ${config.column_notch_width_mm ?? 120}×${config.column_notch_depth_mm ?? 120}mm`
    );
  }
  const sideNotchInfo = sideNotchNotes.join(" | ");

  const hasSlope = Boolean(config.has_slope);
  const slopeSide = config.slope_side || "left";
  const slopeStartH = config.slope_start_height_mm ?? 1200.0;
  const leftH = hasSlope && slopeSide === "left" ? slopeStartH : h;
  const rightH = hasSlope && slopeSide === "right" ? slopeStartH : h;

  const [solCutL, solCutW, solDedL, solDedW] = computeCutDimensions(
    leftH,
    d,
    sideEdge
  );
  const [sagCutL, sagCutW, sagDedL, sagDedW] = computeCutDimensions(
    rightH,
    d,
    sideEdge
  );

  const solDrills = sideDrills.filter((dp) => dp.x_mm <= leftH - 20.0);
  const sagDrills = sideDrills.filter((dp) => dp.x_mm <= rightH - 20.0);

  const solName =
    hasSlope && slopeSide === "left"
      ? `${labelPrefix}Sol Yan Eğimli Dikme (Alçak Taraf)`
      : `${labelPrefix}Sol Yan Dikme`;
  const sagName =
    hasSlope && slopeSide === "right"
      ? `${labelPrefix}Sağ Yan Eğimli Dikme (Alçak Taraf)`
      : `${labelPrefix}Sağ Yan Dikme`;

  parts.push({
    part_id: padId(partCounter++),
    code: `${prefix}YAN_SOL`,
    name: solName,
    material: config.body_material,
    thickness_mm: t,
    quantity: 1,
    net_length_mm: leftH,
    net_width_mm: d,
    cut_length_mm: solCutL,
    cut_width_mm: solCutW,
    pvc_deduction_length_mm: solDedL,
    pvc_deduction_width_mm: solDedW,
    edge_band: sideEdge,
    area_m2: round4((leftH * d) / 1_000_000.0),
    grain_direction: "length",
    drills: solDrills,
    grooves: sideGrooves,
    notch_info: sideNotchInfo,
    transform_3d: {
      center_x_mm: round2(xOffsetMm - w / 2.0 + t / 2.0),
      center_y_mm: round2(leftH / 2.0),
      center_z_mm: 0.0,
      size_x_mm: t,
      size_y_mm: leftH,
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
    name: sagName,
    material: config.body_material,
    thickness_mm: t,
    quantity: 1,
    net_length_mm: rightH,
    net_width_mm: d,
    cut_length_mm: sagCutL,
    cut_width_mm: sagCutW,
    pvc_deduction_length_mm: sagDedL,
    pvc_deduction_width_mm: sagDedW,
    edge_band: sideEdge,
    area_m2: round4((rightH * d) / 1_000_000.0),
    grain_direction: "length",
    drills: sagDrills,
    grooves: sideGrooves,
    notch_info: sideNotchInfo,
    transform_3d: {
      center_x_mm: round2(xOffsetMm + w / 2.0 - t / 2.0),
      center_y_mm: round2(rightH / 2.0),
      center_z_mm: 0.0,
      size_x_mm: t,
      size_y_mm: rightH,
      size_z_mm: d,
      color_hex: config.body_color_hex,
      is_door: false,
      is_drawer: false,
      hinge_side: null,
      module_index: moduleIdx,
    },
  });

  // Üst ve Alt Tabla (Çatı Eğimi Geometrisi)
  const horizEdge: EdgeBandSpec = {
    length_1_mm: config.front_pvc_thickness_mm,
    length_2_mm: config.hidden_pvc_thickness_mm,
    width_1_mm: 0.0,
    width_2_mm: 0.0,
  };

  let topLen = innerW;
  let rotZ = 0.0;
  let topCenterY = round2(h - t / 2.0);
  let topName = `${labelPrefix}Üst Tabla`;
  let isTopSloped = false;

  if (hasSlope) {
    const deltaH = Math.abs(h - slopeStartH);
    topLen = round2(Math.sqrt(innerW ** 2 + deltaH ** 2));
    const slopeDeg = round2((Math.atan2(deltaH, Math.max(1.0, innerW)) * 180) / Math.PI);
    rotZ = slopeSide === "left" ? slopeDeg : -slopeDeg;
    topCenterY = round2((slopeStartH + h) / 2.0);
    topName = `${labelPrefix}Açılı Eğimli Üst Tabla`;
    isTopSloped = true;
  }

  const [horizCutL, horizCutW, horizDedL, horizDedW] = computeCutDimensions(
    topLen,
    d,
    horizEdge
  );
  const [altCutL, altCutW, altDedL, altDedW] = computeCutDimensions(
    innerW,
    d,
    horizEdge
  );

  const horizDrills: DrillPoint[] = [];
  const camOffset = isCabineo
    ? MC.CABINEO_POCKET_OFFSET_FROM_EDGE_MM
    : MC.MINIFIX_CAM_CENTER_FROM_EDGE_MM;
  for (const [camX, sideLabel] of [
    [camOffset, "Sol"],
    [round2(innerW - camOffset), "Sağ"],
  ] as const) {
    for (const yPos of connYCoords) {
      if (isCabineo) {
        horizDrills.push({
          x_mm: camX,
          y_mm: yPos,
          diameter_mm: MC.CABINEO_POCKET_DIAMETER_MM,
          depth_mm: MC.CABINEO_POCKET_DEPTH_MM,
          layer: MC.LAYER_CABINEO_POCKET,
          description: `${sideLabel} Lamello Cabineo 12 Gövde Yuvası (Saf Z-Ekseni Ø15mm, Z=-10.8mm)`,
        });
      } else {
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
  }

  const horizGrooves: GroovePath[] =
    config.back_panel_type === "grooved_8mm"
      ? [
          {
            x_start_mm: 0.0,
            y_start_mm: MC.BACK_GROOVE_OFFSET_FROM_REAR_MM,
            width_mm: topLen,
            length_mm: MC.BACK_GROOVE_WIDTH_MM,
            depth_mm: MC.BACK_GROOVE_DEPTH_MM,
            layer: MC.LAYER_GROOVE_BACK,
          },
        ]
      : [];

  parts.push({
    part_id: padId(partCounter++),
    code: `${prefix}TABLA_UST`,
    name: topName,
    material: config.body_material,
    thickness_mm: t,
    quantity: 1,
    net_length_mm: topLen,
    net_width_mm: d,
    cut_length_mm: horizCutL,
    cut_width_mm: horizCutW,
    pvc_deduction_length_mm: horizDedL,
    pvc_deduction_width_mm: horizDedW,
    edge_band: horizEdge,
    area_m2: round4((topLen * d) / 1_000_000.0),
    grain_direction: "length",
    drills: horizDrills,
    grooves: horizGrooves,
    transform_3d: {
      center_x_mm: xOffsetMm,
      center_y_mm: topCenterY,
      center_z_mm: 0.0,
      size_x_mm: innerW,
      size_y_mm: t,
      size_z_mm: d,
      color_hex: config.body_color_hex,
      is_door: false,
      is_drawer: false,
      hinge_side: null,
      module_index: moduleIdx,
      rotation_z_deg: rotZ,
      is_sloped: isTopSloped,
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
    cut_length_mm: altCutL,
    cut_width_mm: altCutW,
    pvc_deduction_length_mm: altDedL,
    pvc_deduction_width_mm: altDedW,
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

  // Açık Orta Niş Ara Tablaları ve Aksan Arkalığı
  if (isMidNiche) {
    // 1. Niş Alt Tablası
    parts.push({
      part_id: padId(partCounter++),
      code: `${prefix}TABLA_ARA_NIS_ALT`,
      name: `${labelPrefix}Açık Niş Alt Tablası`,
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
        center_y_mm: round2(baseOffsetY + t + lowerClearH + t / 2.0),
        center_z_mm: 0.0,
        size_x_mm: innerW,
        size_y_mm: t,
        size_z_mm: d,
        color_hex: config.niche_color_hex || config.body_color_hex,
        is_door: false,
        is_drawer: false,
        is_niche: true,
        hinge_side: null,
        module_index: moduleIdx,
      },
    });

    // 2. Niş Üst Tablası (Üst Dolap Tabanı)
    if (hasUpperNicheShelf) {
      parts.push({
        part_id: padId(partCounter++),
        code: `${prefix}TABLA_ARA_NIS_UST`,
        name: `${labelPrefix}Açık Niş Üst Tablası (Üst Dolap Tabanı)`,
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
          center_y_mm: round2(baseOffsetY + t + lowerClearH + t + midNicheH + t / 2.0),
          center_z_mm: 0.0,
          size_x_mm: innerW,
          size_y_mm: t,
          size_z_mm: d,
          color_hex: config.niche_color_hex || config.body_color_hex,
          is_door: false,
          is_drawer: false,
          is_niche: true,
          hinge_side: null,
          module_index: moduleIdx,
        },
      });
    }

    // 3. Niş Aksan Arkalığı (Eğer niche_back_open false ve renk tanımlıysa)
    if (!config.niche_back_open && config.niche_color_hex) {
      const isGroovedLiner = config.back_panel_type === "grooved_8mm";
      const linerZ = isGroovedLiner
        ? round2(-d / 2.0 + MC.BACK_GROOVE_OFFSET_FROM_REAR_MM + MC.BACK_GROOVE_WIDTH_MM / 2.0)
        : round2(-d / 2.0 - 4.0);
      parts.push({
        part_id: padId(partCounter++),
        code: `${prefix}ARKALIK_NIS_AKSAN`,
        name: `${labelPrefix}Açık Niş Arka Aksan Paneli`,
        material: "8mm Kontrast MDF-Lam",
        thickness_mm: 8.0,
        quantity: 1,
        net_length_mm: midNicheH,
        net_width_mm: innerW,
        cut_length_mm: midNicheH,
        cut_width_mm: innerW,
        pvc_deduction_length_mm: 0.0,
        pvc_deduction_width_mm: 0.0,
        edge_band: { length_1_mm: 0, length_2_mm: 0, width_1_mm: 0, width_2_mm: 0 },
        area_m2: round4((midNicheH * innerW) / 1_000_000.0),
        grain_direction: "length",
        drills: [],
        grooves: [],
        transform_3d: {
          center_x_mm: xOffsetMm,
          center_y_mm: round2(baseOffsetY + t + lowerClearH + t + midNicheH / 2.0),
          center_z_mm: linerZ,
          size_x_mm: innerW,
          size_y_mm: midNicheH,
          size_z_mm: 8.0,
          color_hex: config.niche_color_hex,
          is_door: false,
          is_drawer: false,
          is_niche: true,
          hinge_side: null,
          module_index: moduleIdx,
        },
      });
    }
  }

  // Baza Kayıtları (Ahşap Baza vs. Ayarlı Plastik Ayak + Klipsli Ön Baza)
  let adjustableLegsCount = 0;
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
    const plinthRecords: [string, string, number][] = isAdjustableLegs
      ? [["ON", "Ön Klipsli (Ayarlı Ayak)", round2(d / 2.0 - 25.0)]]
      : [
          ["ON", "Ön", round2(d / 2.0 - 25.0)],
          ["ARKA", "Arka", round2(-d / 2.0 + 25.0)],
        ];
    if (isAdjustableLegs) {
      adjustableLegsCount = 4;
    }
    for (const [suffix, label, zPos] of plinthRecords) {
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

  // Arkalık (Gövde arkası paneli)
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
  const noEdgeBack: EdgeBandSpec = {
    length_1_mm: 0.0,
    length_2_mm: 0.0,
    width_1_mm: 0.0,
    width_2_mm: 0.0,
  };

  if (isMidNiche && config.niche_back_open) {
    // Alt Arkalık (Açık niş arkasında arkalık olmadan, alt dolap arkalığı)
    const lowerBackL = round2(lowerClearH + t);
    parts.push({
      part_id: padId(partCounter++),
      code: `${prefix}ARKALIK_ALT`,
      name: `${labelPrefix}Alt Bölme Arkalık Paneli`,
      material: backMat,
      thickness_mm: backT,
      quantity: 1,
      net_length_mm: lowerBackL,
      net_width_mm: backW,
      cut_length_mm: lowerBackL,
      cut_width_mm: backW,
      pvc_deduction_length_mm: 0.0,
      pvc_deduction_width_mm: 0.0,
      edge_band: noEdgeBack,
      area_m2: round4((lowerBackL * backW) / 1_000_000.0),
      grain_direction: "length",
      drills: [],
      grooves: [],
      transform_3d: {
        center_x_mm: xOffsetMm,
        center_y_mm: round2(baseOffsetY + lowerBackL / 2.0),
        center_z_mm: backZ,
        size_x_mm: backW,
        size_y_mm: lowerBackL,
        size_z_mm: backT,
        color_hex: "#E5E0D5",
        is_door: false,
        is_drawer: false,
        hinge_side: null,
        module_index: moduleIdx,
      },
    });

    // Üst Arkalık (Açık niş üstündeki kapalı dolap arkalığı)
    if (hasUpperNicheShelf && upperClearH >= 80.0) {
      const upperBackL = round2(upperClearH + t);
      parts.push({
        part_id: padId(partCounter++),
        code: `${prefix}ARKALIK_UST`,
        name: `${labelPrefix}Üst Bölme Arkalık Paneli`,
        material: backMat,
        thickness_mm: backT,
        quantity: 1,
        net_length_mm: upperBackL,
        net_width_mm: backW,
        cut_length_mm: upperBackL,
        cut_width_mm: backW,
        pvc_deduction_length_mm: 0.0,
        pvc_deduction_width_mm: 0.0,
        edge_band: noEdgeBack,
        area_m2: round4((upperBackL * backW) / 1_000_000.0),
        grain_direction: "length",
        drills: [],
        grooves: [],
        transform_3d: {
          center_x_mm: xOffsetMm,
          center_y_mm: round2(h - upperBackL / 2.0),
          center_z_mm: backZ,
          size_x_mm: backW,
          size_y_mm: upperBackL,
          size_z_mm: backT,
          color_hex: "#E5E0D5",
          is_door: false,
          is_drawer: false,
          hinge_side: null,
          module_index: moduleIdx,
        },
      });
    }
  } else {
    const trapHStart = slopeSide === "left" ? slopeStartH : h;
    const trapHEnd = slopeSide === "left" ? h : slopeStartH;
    const arkalikNotch = hasSlope
      ? `[ACILI-CATI-EGIMI] ${slopeSide.toUpperCase()} ${trapHStart.toFixed(0)}➔${trapHEnd.toFixed(0)}mm`
      : "";

    parts.push({
      part_id: padId(partCounter++),
      code: `${prefix}ARKALIK`,
      name: hasSlope
        ? `${labelPrefix}Eğimli Çatı Arkalık Paneli`
        : nicheH > 0
        ? `${labelPrefix}Üst Dolap Arkalık Paneli`
        : `${labelPrefix}Arkalık Paneli`,
      material: backMat,
      thickness_mm: backT,
      quantity: 1,
      net_length_mm: backL,
      net_width_mm: backW,
      cut_length_mm: backL,
      cut_width_mm: backW,
      pvc_deduction_length_mm: 0.0,
      pvc_deduction_width_mm: 0.0,
      edge_band: noEdgeBack,
      area_m2: round4((backL * backW) / 1_000_000.0),
      grain_direction: "length",
      drills: [],
      grooves: [],
      notch_info: arkalikNotch,
      is_trapezoid: hasSlope,
      trapezoid_h_start_mm: hasSlope ? trapHStart : undefined,
      trapezoid_h_end_mm: hasSlope ? trapHEnd : undefined,
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
  }

  let totalHandles = 0;
  let totalHinges = 0;
  let totalGasStruts = 0;

  const hasZones = Boolean(
    config.zones &&
      (config.zones.length > 1 || config.zones.some((z) => z.has_hanging_rod))
  );
  if (hasZones) {
    const zRes = generateZonesParts(
      config,
      moduleIdx,
      xOffsetMm,
      partCounter,
      multiMode
    );
    parts.push(...zRes.parts);
    partCounter = zRes.nextCounter;
    totalHandles += zRes.totalHandles;
    totalHinges += zRes.totalHinges;
    totalGasStruts += zRes.totalGasStruts;
  } else {
    // Çekmece Kasa ve Klapaları (Tek Gövde Modu)
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
  const shelfAvailSpace = isMidNiche ? upperClearH : remainingClearH;
  if (config.shelf_count > 0 && shelfAvailSpace > 120.0) {
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
    const stepH = shelfAvailSpace / (config.shelf_count + 1);
    const shelfZCenter = round2((rearLoss - MC.SHELF_FRONT_SETBACK_MM) / 2.0);
    const shelfBaseY = isMidNiche
      ? round2(baseOffsetY + t + lowerClearH + t + midNicheH + t)
      : round2(baseOffsetY + t + drawerZoneH);

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
          center_y_mm: round2(shelfBaseY + sIdx * stepH),
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

  // Kapaklar (Tek Gövde Modu - Yardımcı Kapak Motoru)
  const generateDoorsForCavity = (
    availH: number,
    yCenter: number,
    codePrefix: string,
    namePrefix: string
  ) => {
    if (config.door_type === "none" || availH < 180.0) return;
    const doorNetH = round2(availH - 2.0 * MC.DOOR_OUTER_GAP_MM);
    const doorEdge: EdgeBandSpec = {
      length_1_mm: config.front_pvc_thickness_mm,
      length_2_mm: config.front_pvc_thickness_mm,
      width_1_mm: config.front_pvc_thickness_mm,
      width_2_mm: config.front_pvc_thickness_mm,
    };
    const doorZCenter = round2(d / 2.0 + t / 2.0 + 1.5);

    if (config.door_type === "flap_up") {
      const doorNetW = round2(w - 2.0 * MC.DOOR_OUTER_GAP_MM);
      const [dCutL, dCutW, dDedL, dDedW] = computeCutDimensions(doorNetH, doorNetW, doorEdge);
      const topX = round2(doorNetH - MC.HINGE_CUP_CENTER_FROM_EDGE_MM);
      const leftY = round2(Math.min(MC.HINGE_EDGE_OFFSET_TOP_BOTTOM_MM, doorNetW * 0.2));
      const rightY = round2(Math.max(doorNetW - MC.HINGE_EDGE_OFFSET_TOP_BOTTOM_MM, doorNetW * 0.8));
      const dDrills: DrillPoint[] = [
        {
          x_mm: topX,
          y_mm: leftY,
          diameter_mm: MC.HINGE_CUP_DIAMETER_MM,
          depth_mm: MC.HINGE_CUP_DEPTH_MM,
          layer: MC.LAYER_HINGE_CUP,
          description: `${namePrefix}Kalkar Kapak Sol Tas Menteşe Yuvası (Ø35mm)`,
        },
        {
          x_mm: topX,
          y_mm: rightY,
          diameter_mm: MC.HINGE_CUP_DIAMETER_MM,
          depth_mm: MC.HINGE_CUP_DEPTH_MM,
          layer: MC.LAYER_HINGE_CUP,
          description: `${namePrefix}Kalkar Kapak Sağ Tas Menteşe Yuvası (Ø35mm)`,
        },
      ];
      totalHinges += 2;
      totalHandles += 1;
      totalGasStruts += 2;

      parts.push({
        part_id: padId(partCounter++),
        code: `${prefix}${codePrefix ? codePrefix + "_" : ""}KAPAK_KALKAR`,
        name: `${labelPrefix}${namePrefix}Kalkar Kapak (Gazlı Pistonlu)`,
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
          center_y_mm: yCenter,
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
      const [dCutL, dCutW, dDedL, dDedW] = computeCutDimensions(doorNetH, doorNetW, doorEdge);
      const hingeLeft = config.door_type === "single_left";
      const dDrills = buildDoorDrills(doorNetH, doorNetW, hingeLeft);
      totalHinges += dDrills.length;
      totalHandles += 1;

      parts.push({
        part_id: padId(partCounter++),
        code: `${prefix}${codePrefix ? codePrefix + "_" : ""}KAPAK_TEK`,
        name: hingeLeft
          ? `${labelPrefix}${namePrefix}Tek Kapak (Sol Menteşeli)`
          : `${labelPrefix}${namePrefix}Tek Kapak (Sağ Menteşeli)`,
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
          center_y_mm: yCenter,
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
      const doorNetW = round2((w - 2.0 * MC.DOOR_OUTER_GAP_MM - MC.DOOR_CENTER_GAP_MM) / 2.0);
      const [dCutL, dCutW, dDedL, dDedW] = computeCutDimensions(doorNetH, doorNetW, doorEdge);
      for (const [sideCode, sideLabel, isLeft, relCx] of [
        ["SOL", "Sol Kapak", true, -(doorNetW / 2.0 + MC.DOOR_CENTER_GAP_MM / 2.0)],
        ["SAG", "Sağ Kapak", false, doorNetW / 2.0 + MC.DOOR_CENTER_GAP_MM / 2.0],
      ] as const) {
        const dDrills = buildDoorDrills(doorNetH, doorNetW, isLeft);
        totalHinges += dDrills.length;
        totalHandles += 1;
        parts.push({
          part_id: padId(partCounter++),
          code: `${prefix}${codePrefix ? codePrefix + "_" : ""}KAPAK_${sideCode}`,
          name: `${labelPrefix}${namePrefix}${sideLabel}`,
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
            center_y_mm: yCenter,
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
  };

  if (isMidNiche) {
    if (drawerCount === 0 && lowerClearH >= 180.0) {
      generateDoorsForCavity(
        round2(lowerClearH + t),
        round2(baseOffsetY + t / 2.0 + lowerClearH / 2.0),
        "ALT",
        "Alt "
      );
    }
    if (hasUpperNicheShelf && upperClearH >= 180.0) {
      generateDoorsForCavity(
        round2(upperClearH + t),
        round2(baseOffsetY + t + lowerClearH + t + midNicheH + t / 2.0 + upperClearH / 2.0),
        "UST",
        "Üst "
      );
    }
  } else {
    const doorAvailH = round2(h - baseOffsetY - drawerZoneH);
    if (doorAvailH >= 240.0) {
      generateDoorsForCavity(
        doorAvailH,
        round2(baseOffsetY + drawerZoneH + doorAvailH / 2.0),
        "",
        ""
      );
    }
  }
}

  // 7. Şantiye ve Rölöve Kör Çıtaları (Sol / Sağ Duvar Alıştırma Payı)
  for (const [fillerW, sideCode, sideLabel, sign] of [
    [config.left_filler_width_mm ?? 0, "SOL", "Sol Duvar Kör Çıtası (Rölöve Payı)", -1.0],
    [config.right_filler_width_mm ?? 0, "SAG", "Sağ Duvar Kör Çıtası (Rölöve Payı)", 1.0],
  ] as const) {
    if (fillerW && fillerW > 0) {
      const fEdge: EdgeBandSpec = {
        length_1_mm: config.front_pvc_thickness_mm,
        length_2_mm: 0.0,
        width_1_mm: config.hidden_pvc_thickness_mm,
        width_2_mm: config.hidden_pvc_thickness_mm,
      };
      const [fCutL, fCutW, fDedL, fDedW] = computeCutDimensions(h, fillerW, fEdge);
      parts.push({
        part_id: padId(partCounter++),
        code: `${prefix}KOR_CITA_${sideCode}`,
        name: `${labelPrefix}${sideLabel}`,
        material: doorMat,
        thickness_mm: t,
        quantity: 1,
        net_length_mm: h,
        net_width_mm: fillerW,
        cut_length_mm: fCutL,
        cut_width_mm: fCutW,
        pvc_deduction_length_mm: fDedL,
        pvc_deduction_width_mm: fDedW,
        edge_band: fEdge,
        area_m2: round4((h * fillerW) / 1_000_000.0),
        grain_direction: "length",
        drills: [],
        grooves: [],
        notch_info: "Şantiye Duvar Alıştırma Payı (Tıraşlanabilir)",
        transform_3d: {
          center_x_mm: round2(xOffsetMm + sign * (w / 2.0 + fillerW / 2.0)),
          center_y_mm: round2(h / 2.0),
          center_z_mm: round2(d / 2.0 - t / 2.0),
          size_x_mm: fillerW,
          size_y_mm: h,
          size_z_mm: t,
          color_hex: config.door_color_hex,
          is_door: false,
          is_drawer: false,
          hinge_side: null,
          module_index: moduleIdx,
        },
      });
    }
  }

  // 7b. L-Köşe Dönüş Kör Paneli
  if (config.is_corner_module) {
    const cornerW = config.corner_blind_width_mm || 100.0;
    const cornerEdge: EdgeBandSpec = {
      length_1_mm: config.front_pvc_thickness_mm,
      length_2_mm: 0.0,
      width_1_mm: 0.0,
      width_2_mm: 0.0,
    };
    const [ccL, ccW, cdL, cdW] = computeCutDimensions(h, cornerW, cornerEdge);
    parts.push({
      part_id: padId(partCounter++),
      code: `${prefix}KOR_KAPAMA_KOSE`,
      name: `${labelPrefix}L-Köşe Kör Kapama Paneli`,
      material: doorMat,
      thickness_mm: t,
      quantity: 1,
      net_length_mm: h,
      net_width_mm: cornerW,
      cut_length_mm: ccL,
      cut_width_mm: ccW,
      pvc_deduction_length_mm: cdL,
      pvc_deduction_width_mm: cdW,
      edge_band: cornerEdge,
      area_m2: round4((h * cornerW) / 1_000_000.0),
      grain_direction: "length",
      drills: [],
      grooves: [],
      notch_info: `L-Köşe ${config.corner_angle_deg ?? 90}° Dönüş Kör Paneli`,
      transform_3d: {
        center_x_mm: round2(xOffsetMm + w / 2.0 - cornerW / 2.0),
        center_y_mm: round2(h / 2.0),
        center_z_mm: round2(d / 2.0 - t / 2.0),
        size_x_mm: cornerW,
        size_y_mm: h,
        size_z_mm: t,
        color_hex: config.door_color_hex,
        is_door: false,
        is_drawer: false,
        hinge_side: null,
        module_index: moduleIdx,
        corner_rotation_y_deg: config.corner_angle_deg ?? 90,
      },
    });
  }

  // 8. 3-Eksen CNC Router Nesting Vakum Tutunma Sekmesi (Holding Tabs) Hesabı
  if (config.cutting_mode === "cnc_router") {
    for (const p of parts) {
      if (p.area_m2 < 0.15 || Math.min(p.cut_length_mm, p.cut_width_mm) < 180.0) {
        p.holding_tabs_count = 4;
      }
    }
  }

  const intermediateShelfConnUnits = isMidNiche ? (hasUpperNicheShelf ? 2 : 1) * (connYCoords.length * 2) : 0;
  const baseConnUnits = connYCoords.length * 4 + drawerCount * 4 + intermediateShelfConnUnits;
  const minifixSets = isCabineo ? 0 : baseConnUnits;
  const dowelCount = isCabineo
    ? 0
    : baseConnUnits + (config.has_plinth && plinthH > 0 && !isAdjustableLegs ? 8 : 0);
  const cabineoCount = isCabineo ? baseConnUnits : 0;

  return {
    parts,
    nextCounter: partCounter,
    minifixSets,
    dowelCount,
    cabineoCount,
    adjustableLegsCount,
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
  let totalCabineo = 0;
  let totalAdjustableLegs = 0;
  let totalHinges = 0;
  let totalHandles = 0;
  let totalGasStruts = 0;
  let totalShelfPins = 0;
  let totalDrawerSlides = 0;

  allModules.forEach((modCfg, idx) => {
    const centerXOffset = round2(currentLeftX + modCfg.width_mm / 2.0);
    currentLeftX += modCfg.width_mm;

    const mergedModCfg: CabinetConfig = {
      ...modCfg,
      fastener_type: modCfg.fastener_type ?? config.fastener_type,
      cutting_mode: modCfg.cutting_mode ?? config.cutting_mode,
      router_bit_diameter_mm:
        modCfg.router_bit_diameter_mm ?? config.router_bit_diameter_mm,
      plinth_type: modCfg.plinth_type ?? config.plinth_type,
      has_baseboard_notch:
        modCfg.has_baseboard_notch ?? config.has_baseboard_notch,
      baseboard_notch_height_mm:
        modCfg.baseboard_notch_height_mm ?? config.baseboard_notch_height_mm,
      baseboard_notch_depth_mm:
        modCfg.baseboard_notch_depth_mm ?? config.baseboard_notch_depth_mm,
      has_column_notch: modCfg.has_column_notch ?? config.has_column_notch,
      column_notch_width_mm:
        modCfg.column_notch_width_mm ?? config.column_notch_width_mm,
      column_notch_depth_mm:
        modCfg.column_notch_depth_mm ?? config.column_notch_depth_mm,
    };

    const res = generateSingleModuleParts(
      mergedModCfg,
      idx + 1,
      centerXOffset,
      partCounter,
      multiMode
    );
    parts.push(...res.parts);
    partCounter = res.nextCounter;
    totalMinifix += res.minifixSets;
    totalDowels += res.dowelCount;
    totalCabineo += res.cabineoCount;
    totalAdjustableLegs += res.adjustableLegsCount;
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

  const hardware: HardwareItem[] = [];
  if (totalCabineo > 0) {
    hardware.push({
      code: "HRD-CBN-12",
      name: "Lamello Cabineo 12 Tek Parça Gövde Bağlantısı (Saf Z-Ekseni CNC)",
      unit: "Adet",
      quantity: totalCabineo,
      note: "Yan delik ve kavela gerektirmeyen 3-Eksen CNC üst yüzey cep bağlantısı",
    });
  }
  if (totalMinifix > 0) {
    hardware.push({
      code: "HRD-MNFX-15",
      name: "Minifiks Bağlantı Takımı (Ø15 Eksantrik + Mil)",
      unit: "Takım",
      quantity: totalMinifix,
      note: "Gövde ve çekmece kasa birleştirmeleri",
    });
  }
  if (totalDowels > 0) {
    hardware.push({
      code: "HRD-KVLA-08",
      name: "Ahşap Kavela (Ø8x35mm)",
      unit: "Adet",
      quantity: totalDowels,
      note: "Sistem 32 kavela delikleri ve baza kayıtları",
    });
  }
  if (totalAdjustableLegs > 0) {
    hardware.push({
      code: "HRD-AYK-100",
      name: "Ayarlı Plastik Baza Ayağı (100mm) + Baza Klipsi",
      unit: "Adet",
      quantity: totalAdjustableLegs,
      note: "Eğimli şantiye zeminlerinde teraziye alma ve klipsli ön baza montajı",
    });
  }

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
): {
  placed: NestedPartPlacement[];
  unplaced: PanelPart[];
  freeRects: FreeRect[];
} {
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
      holding_tabs_count: part.holding_tabs_count ?? 0,
      notch_info: part.notch_info,
      is_true_shape: Boolean(part.notch_info),
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

  return { placed, unplaced, freeRects };
}

function detectUsableRemnants(
  freeRects: FreeRect[],
  sheetIndex: number,
  material: string,
  thicknessMm: number,
  trimMm: number,
  kerfMm: number
): RemnantStockItem[] {
  const remnants: RemnantStockItem[] = [];
  let remCounter = 1;
  for (const fr of freeRects) {
    const netW = round2(Math.max(0.0, fr.w - kerfMm));
    const netH = round2(Math.max(0.0, fr.h - kerfMm));
    const shortSide = Math.min(netW, netH);
    const longSide = Math.max(netW, netH);
    if (
      shortSide >= MC.REMNANT_MIN_DIM_SHORT_MM &&
      longSide >= MC.REMNANT_MIN_DIM_LONG_MM
    ) {
      const areaM2 = round4((netW * netH) / 1_000_000.0);
      remnants.push({
        remnant_id: `REM-S${String(sheetIndex).padStart(2, "0")}-R${remCounter++}`,
        sheet_index: sheetIndex,
        material,
        thickness_mm: thicknessMm,
        x_mm: round2(fr.x + trimMm),
        y_mm: round2(fr.y + trimMm),
        width_mm: netW,
        height_mm: netH,
        area_m2: areaM2,
        reusable: true,
      });
    }
  }
  return remnants;
}

function renderSheetSvg(
  sheetIndex: number,
  material: string,
  sheetW: number,
  sheetH: number,
  trimMm: number,
  kerfMm: number,
  wastePct: number,
  placements: NestedPartPlacement[],
  remnants: RemnantStockItem[]
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
    `<text x="${ox}" y="44" fill="#94A3B8" font-size="11">Net Kullanılabilir Alan: ${usableW} × ${usableH} mm (Kenar Temizlik: ${trimMm} mm | Kerf / Çakı: ${kerfMm.toFixed(1)} mm)</text>`,
    `<rect x="${ox}" y="${oy}" width="${(sheetW * scale).toFixed(1)}" height="${(sheetH * scale).toFixed(1)}" fill="#1E293B" stroke="#475569" stroke-width="1.5" />`,
    `<rect x="${(ox + trimMm * scale).toFixed(1)}" y="${(oy + trimMm * scale).toFixed(1)}" width="${(usableW * scale).toFixed(1)}" height="${(usableH * scale).toFixed(1)}" fill="none" stroke="#64748B" stroke-width="1" stroke-dasharray="5,4" />`,
  ];

  remnants.forEach((r) => {
    const rx = ox + r.x_mm * scale;
    const ry = oy + (sheetH - r.y_mm - r.height_mm) * scale;
    const rw = r.width_mm * scale;
    const rh = r.height_mm * scale;
    const rcx = rx + rw / 2;
    const rcy = ry + rh / 2;
    lines.push(
      `<g class="remnant-group"><rect x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" width="${rw.toFixed(2)}" height="${rh.toFixed(2)}" fill="#10B981" fill-opacity="0.16" stroke="#10B981" stroke-width="1.5" stroke-dasharray="6,3" />`,
      `<text x="${rcx.toFixed(1)}" y="${(rcy - 3).toFixed(1)}" text-anchor="middle" fill="#6EE7B7" font-size="9.5" font-weight="700">ARTIK DEPO: ${r.remnant_id}</text>`,
      `<text x="${rcx.toFixed(1)}" y="${(rcy + 9).toFixed(1)}" text-anchor="middle" fill="#A7F3D0" font-size="8.5">${r.width_mm.toFixed(0)}×${r.height_mm.toFixed(0)} mm (${r.area_m2.toFixed(2)} m²)</text></g>`
    );
  });

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
      const tabTag =
        p.holding_tabs_count && p.holding_tabs_count > 0
          ? ` [${p.holding_tabs_count}×TAB]`
          : "";
      const lTag = p.notch_info ? " [L-KERTME]" : "";
      lines.push(
        `<text x="${cx.toFixed(1)}" y="${(cy - 2).toFixed(1)}" text-anchor="middle" fill="${textColor}" font-size="9.5" font-weight="700">${p.part_id} ${p.code}${rotTag}${tabTag}${lTag}</text>`
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
  const isRouter = bom.config.cutting_mode === "cnc_router";
  const kerfMm = isRouter
    ? bom.config.router_bit_diameter_mm ?? MC.CNC_ROUTER_BIT_DIAMETER_MM
    : MC.SAW_KERF_MM;
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
      const { placed, unplaced, freeRects } = packGuillotineSheet(
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

      const remnants = detectUsableRemnants(
        freeRects,
        globalSheetIdx,
        material,
        thicknessMm,
        trimMm,
        kerfMm
      );

      const svgContent = renderSheetSvg(
        globalSheetIdx,
        material,
        sheetW,
        sheetH,
        trimMm,
        kerfMm,
        wastePct,
        placed,
        remnants
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
        remnants,
        svg_content: svgContent,
      });

      globalSheetIdx += 1;
      queue = unplaced;
    }
  }

  const totalSheets = allSheets.length;
  const totalGrossM2 = totalSheets * sheetGrossAreaM2;
  const totalUsedM2 = allSheets.reduce((acc, s) => acc + s.used_area_m2, 0);
  const totalRemnantM2 = round4(
    allSheets.reduce(
      (acc, s) =>
        acc + (s.remnants ?? []).reduce((ra, r) => ra + r.area_m2, 0),
      0
    )
  );
  const overallEff =
    totalGrossM2 > 0 ? round2((totalUsedM2 / totalGrossM2) * 100.0) : 0;
  const overallWaste = round2(100.0 - overallEff);
  const effectiveWaste =
    totalGrossM2 > 0
      ? round2(
          Math.max(
            0,
            ((totalGrossM2 - totalUsedM2 - totalRemnantM2) / totalGrossM2) *
              100.0
          )
        )
      : 0;

  return {
    sheet_width_mm: sheetW,
    sheet_height_mm: sheetH,
    kerf_mm: kerfMm,
    total_sheets: totalSheets,
    overall_efficiency_percentage: overallEff,
    overall_waste_percentage: overallWaste,
    reusable_remnant_area_m2: totalRemnantM2,
    effective_waste_percentage: effectiveWaste,
    sheets: allSheets,
    combined_svg: allSheets.map((s) => s.svg_content).join("\n"),
  };
}

/**
 * 4. CNC DXF (AutoCAD R2010), ISO G-Code (.nc), Homag WoodWOP (.mpr) ve Biesse bSolid (.cix) Üretici
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
      "(--- OP 2: SISTEM 32 / CABINEO CNC DELIK DELME ---)",
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

export function generatePartCixString(part: PanelPart): string {
  const cutL = part.cut_length_mm;
  const cutW = part.cut_width_mm;
  const t = part.thickness_mm;

  const lines: string[] = [
    "BEGIN ID CID3",
    "  REL=5.0",
    "END ID",
    "",
    "BEGIN MAINDATA",
    `  LPX=${cutL.toFixed(2)}`,
    `  LPY=${cutW.toFixed(2)}`,
    `  LPZ=${t.toFixed(2)}`,
    '  ORLST="1"',
    "  SIMMETRY=1",
    '  MATERIAL="WOOD"',
    "END MAINDATA",
    "",
  ];

  part.grooves.forEach((g, idx) => {
    const gx0 = g.x_start_mm;
    const gy0 = g.y_start_mm + g.length_mm / 2.0;
    const gx1 = g.x_start_mm + g.width_mm;
    lines.push(
      "BEGIN MACRO",
      "  NAME=ROUTG",
      `  PARAM,NAME=ID,VALUE="GRV_${idx + 1}"`,
      "  PARAM,NAME=SIDE,VALUE=0",
      '  PARAM,NAME=CRN,VALUE="1"',
      `  PARAM,NAME=X,VALUE=${gx0.toFixed(2)}`,
      `  PARAM,NAME=Y,VALUE=${gy0.toFixed(2)}`,
      `  PARAM,NAME=XE,VALUE=${gx1.toFixed(2)}`,
      `  PARAM,NAME=YE,VALUE=${gy0.toFixed(2)}`,
      `  PARAM,NAME=Z,VALUE=${g.depth_mm.toFixed(2)}`,
      `  PARAM,NAME=DIA,VALUE=${g.length_mm.toFixed(2)}`,
      '  PARAM,NAME=TNM,VALUE="FREZE_8MM"',
      "END MACRO",
      ""
    );
  });

  part.drills.forEach((d, idx) => {
    lines.push(
      "BEGIN MACRO",
      "  NAME=BG",
      `  PARAM,NAME=ID,VALUE="DRL_${idx + 1}"`,
      "  PARAM,NAME=SIDE,VALUE=0",
      '  PARAM,NAME=CRN,VALUE="1"',
      `  PARAM,NAME=X,VALUE=${d.x_mm.toFixed(2)}`,
      `  PARAM,NAME=Y,VALUE=${d.y_mm.toFixed(2)}`,
      "  PARAM,NAME=Z,VALUE=0.00",
      `  PARAM,NAME=DP,VALUE=${d.depth_mm.toFixed(2)}`,
      `  PARAM,NAME=DIA,VALUE=${d.diameter_mm.toFixed(2)}`,
      "  PARAM,NAME=THR,VALUE=0",
      `  PARAM,NAME=LAY,VALUE="${d.layer}"`,
      "END MACRO",
      ""
    );
  });

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

function buildQrLabelsHtmlString(jobId: string, bom: BOMReport): string {
  const cards = bom.parts
    .map(
      (p) => `
    <div class="label-card">
      <div class="hdr">
        <strong>#${jobId} · ${p.part_id} · ${p.code}</strong>
        <span>${p.thickness_mm}mm</span>
      </div>
      <div class="title">${p.name}</div>
      <div class="dims">KESİM: <b>${p.cut_length_mm} × ${p.cut_width_mm} mm</b> | NET: ${p.net_length_mm} × ${p.net_width_mm} mm</div>
      <div class="pvc">PVC (Ön/Arka/Üst/Alt): ${p.edge_band.length_1_mm} / ${p.edge_band.length_2_mm} / ${p.edge_band.width_1_mm} / ${p.edge_band.width_2_mm} mm</div>
      <div class="cnc">CNC: ${p.drills.length} Delik | ${p.grooves.length} Kanal ${p.notch_info ? `| ${p.notch_info}` : ""}</div>
    </div>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>Marangoz QR Parça Etiketleri - #${jobId}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 16px; background: #f8fafc; color: #0f172a; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .label-card { border: 2px solid #0f172a; border-radius: 8px; padding: 10px; background: #fff; page-break-inside: avoid; }
  .hdr { display: flex; justify-content: space-between; font-size: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
  .title { font-size: 14px; font-weight: 700; margin-top: 6px; }
  .dims, .pvc, .cnc { font-size: 11px; margin-top: 4px; }
</style>
</head>
<body>
  <h2>Marangoz Atölye Barkod / QR Parça Etiketleri (#${jobId} — ${bom.config.name})</h2>
  <div class="grid">${cards}</div>
</body>
</html>`;
}

const localDxfBlobUrls = new Map<string, string>();
const localGcodeBlobUrls = new Map<string, string>();
const localMprBlobUrls = new Map<string, string>();
const localCixBlobUrls = new Map<string, string>();

export function getLocalDxfBlobUrl(filename: string): string | undefined {
  return localDxfBlobUrls.get(filename);
}
export function getLocalGcodeBlobUrl(filename: string): string | undefined {
  return localGcodeBlobUrls.get(filename);
}
export function getLocalMprBlobUrl(filename: string): string | undefined {
  return localMprBlobUrls.get(filename);
}
export function getLocalCixBlobUrl(filename: string): string | undefined {
  return localCixBlobUrls.get(filename);
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
    {
      name: "etiketler/parca_etiketleri_qr.html",
      content: buildQrLabelsHtmlString(jobId, bom),
    },
  ];

  for (const sheet of nesting.sheets) {
    zipFiles.push({
      name: `nesting/plaka_${String(sheet.sheet_index).padStart(2, "0")}_kesim_semasi.svg`,
      content: sheet.svg_content,
    });
  }

  const dxfFilenames: string[] = [];
  const cixFilenames: string[] = [];
  for (const part of bom.parts) {
    const baseName = `${part.part_id}_${part.code}`;
    const dxfName = `${baseName}.dxf`;
    const ncName = `${baseName}.nc`;
    const mprName = `${baseName}.mpr`;
    const cixName = `${baseName}.cix`;

    const dxfContent = generatePartDxfString(part);
    const ncContent = generatePartGcodeString(part);
    const mprContent = generatePartMprString(part);
    const cixContent = generatePartCixString(part);

    dxfFilenames.push(dxfName);
    cixFilenames.push(cixName);
    zipFiles.push(
      { name: `cnc_dxf/${dxfName}`, content: dxfContent },
      { name: `cnc_gcode/${ncName}`, content: ncContent },
      { name: `cnc_mpr/${mprName}`, content: mprContent },
      { name: `cnc_cix/${cixName}`, content: cixContent }
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
    localCixBlobUrls.set(
      cixName,
      URL.createObjectURL(new Blob([cixContent], { type: "text/plain" }))
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
    cix_filenames: cixFilenames,
    zip_download_url: zipBlobUrl,
  };
}
