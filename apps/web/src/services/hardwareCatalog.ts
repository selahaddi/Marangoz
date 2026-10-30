/**
 * Häfele, Blum, Samet ve Standart Donanım & Mekanizma Kataloğu (TypeScript).
 * docs/03_ANTIGRAVITY_AGENT_RULES.md uyarınca any yasaktır.
 */

export type HardwareBrand = "generic" | "blum" | "hafele" | "samet";

export type HardwareCategory =
  | "drawer_system"
  | "hinge"
  | "lift_system"
  | "handle_profile"
  | "fastener"
  | "accessory";

export interface CatalogHardwareItem {
  code: string;
  brand: HardwareBrand;
  category: HardwareCategory;
  name: string;
  description: string;
  unit: string;
  unit_price_tl: number;
  specs: Record<string, string | number | boolean>;
}

export const HARDWARE_CATALOG: readonly CatalogHardwareItem[] = [
  // --- ÇEKMECE SİSTEMLERİ ---
  {
    code: "HRD-CRAY-500",
    brand: "generic",
    category: "drawer_system",
    name: "Standart Frenli Teleskopik Bilyalı Ray (500mm)",
    description: "45 kg taşıma kapasiteli, çift yaylı hidrolik frenli teleskopik çekmece rayı",
    unit: "Takım",
    unit_price_tl: 240.0,
    specs: { load_kg: 45, length_mm: 500, soft_close: true, type: "telescopic" },
  },
  {
    code: "BLM-TNDM-ANT-500",
    brand: "blum",
    category: "drawer_system",
    name: "Blum Tandembox Antaro Çift Cidarlı Çekmece Kiti (500mm, 30kg, Blumotion)",
    description: "İpek beyazı metalik bordürlü, entegre Blumotion frenli, senkronize yumuşak kapanış",
    unit: "Takım",
    unit_price_tl: 950.0,
    specs: { load_kg: 30, length_mm: 500, soft_close: true, side_color: "silk_white" },
  },
  {
    code: "BLM-LEGRA-500",
    brand: "blum",
    category: "drawer_system",
    name: "Blum Legrabox Orion Grisi İnce Yanak Çekmece Kiti (500mm, 40kg, Blumotion)",
    description: "12.8 mm düz dik yanaklar, entegre Blumotion fren, üstün kayma konforu",
    unit: "Takım",
    unit_price_tl: 1650.0,
    specs: { load_kg: 40, length_mm: 500, soft_close: true, side_color: "orion_gray" },
  },
  {
    code: "BLM-MOV-500",
    brand: "blum",
    category: "drawer_system",
    name: "Blum Movento Gizli Ahşap Çekmece Rayı (500mm, 40kg, Blumotion)",
    description: "4 boyutlu ayar imkanı, 40 kg taşıma, dişli senkronizasyonlu ipeksi hareket",
    unit: "Takım",
    unit_price_tl: 820.0,
    specs: { load_kg: 40, length_mm: 500, soft_close: true, type: "undermount" },
  },
  {
    code: "HAF-MTX-P-500",
    brand: "hafele",
    category: "drawer_system",
    name: "Häfele Matrix Box P Antrasit Çift Cidarlı Çekmece (500mm, 35kg, Soft-Close)",
    description: "Antrasit metal yanak, entegre sıvı pistonlu fren sistemi, 35 kg yük kapasitesi",
    unit: "Takım",
    unit_price_tl: 780.0,
    specs: { load_kg: 35, length_mm: 500, soft_close: true, side_color: "anthracite" },
  },
  {
    code: "HAF-ALTO-500",
    brand: "hafele",
    category: "drawer_system",
    name: "Häfele Alto Drawer İnce Kenarlı Çekmece Sistemi (500mm, 30kg)",
    description: "İnce düz metal panel, modern minimalist tasarım, frenli montaj rayları",
    unit: "Takım",
    unit_price_tl: 650.0,
    specs: { load_kg: 30, length_mm: 500, soft_close: true, side_color: "white" },
  },
  {
    code: "SMT-FLW-500",
    brand: "samet",
    category: "drawer_system",
    name: "Samet Flowbox Antrasit İnce Yanaklı Çekmece Sistemi (500mm, 40kg, Frenli)",
    description: "12.8 mm ultra ince yanak profili, pürüzsüz kayma ve mükemmel senkronizasyon",
    unit: "Takım",
    unit_price_tl: 580.0,
    specs: { load_kg: 40, length_mm: 500, soft_close: true, side_color: "anthracite" },
  },
  {
    code: "SMT-SMART-500",
    brand: "samet",
    category: "drawer_system",
    name: "Samet Smart Slide Gizli Kısmi Açılır Frenli Ray (500mm)",
    description: "Ahşap çekmece kasası altına montaj, adaptif yavaşlatıcı fren mekanizması",
    unit: "Takım",
    unit_price_tl: 320.0,
    specs: { load_kg: 30, length_mm: 500, soft_close: true, type: "undermount" },
  },
  {
    code: "SMT-SAMBOX-500",
    brand: "samet",
    category: "drawer_system",
    name: "Samet Sambox Tek Cidarlı Metal Çekmece Yanı (500mm, Beyaz)",
    description: "Ekonomik metal yanak sistemi, epoksi toz boyalı gövde",
    unit: "Takım",
    unit_price_tl: 190.0,
    specs: { load_kg: 25, length_mm: 500, soft_close: false, side_color: "white" },
  },

  // --- MENTEŞE SİSTEMLERİ ---
  {
    code: "HRD-MNTS-35",
    brand: "generic",
    category: "hinge",
    name: "Standart Frenli Düz Tas Menteşe (Ø35mm, 110°)",
    description: "Pistonlu sessiz kapanan vidalı tabanlı düz mobilya menteşesi",
    unit: "Adet",
    unit_price_tl: 35.0,
    specs: { cup_diameter_mm: 35, angle_deg: 110, soft_close: true },
  },
  {
    code: "BLM-CLIP-110",
    brand: "blum",
    category: "hinge",
    name: "Blum Clip Top Blumotion 110° Entegre Frenli Düz Menteşe (Ø35mm)",
    description: "Gövdeye entegre Blumotion sıvı pistonu, aletsiz klipsli montaj ve 3D ayar",
    unit: "Adet",
    unit_price_tl: 115.0,
    specs: { cup_diameter_mm: 35, angle_deg: 110, soft_close: true, model: "Clip Top Blumotion" },
  },
  {
    code: "BLM-CLIP-155",
    brand: "blum",
    category: "hinge",
    name: "Blum Clip Top 155° Geniş Açılı İç Çekmece Menteşesi",
    description: "İç çekmeceli dolaplarda sıfır çıkıntı sağlayan geniş açılı frenli menteşe",
    unit: "Adet",
    unit_price_tl: 220.0,
    specs: { cup_diameter_mm: 35, angle_deg: 155, soft_close: true, zero_protrusion: true },
  },
  {
    code: "BLM-TIPON-DOOR",
    brand: "blum",
    category: "hinge",
    name: "Blum Tip-On Kapak İçin Bas-Aç Mekanizması (Mıknatıslı)",
    description: "Kulpsuz kapaklar için bas-aç itici piston ve ayarlı manyetik tutucu",
    unit: "Adet",
    unit_price_tl: 95.0,
    specs: { stroke_mm: 38, magnetic: true, type: "push_to_open" },
  },
  {
    code: "HAF-MET-110",
    brand: "hafele",
    category: "hinge",
    name: "Häfele Metalla 300 Frenli Klipsli Tas Menteşe (Ø35mm, 110°)",
    description: "Entegre hidrolik yavaşlatıcılı, nikel kaplama çelik tas menteşe",
    unit: "Adet",
    unit_price_tl: 68.0,
    specs: { cup_diameter_mm: 35, angle_deg: 110, soft_close: true },
  },
  {
    code: "HAF-DUO-110",
    brand: "hafele",
    category: "hinge",
    name: "Häfele Duomatic Frenli Tas Menteşe (Ø35mm, 110°)",
    description: "Alman standardı 4 delikli klipsli taban ve entegre yumuşak kapanma",
    unit: "Adet",
    unit_price_tl: 75.0,
    specs: { cup_diameter_mm: 35, angle_deg: 110, soft_close: true },
  },
  {
    code: "SMT-MSTR-110",
    brand: "samet",
    category: "hinge",
    name: "Samet Master Frenli Klipsli Tas Menteşe (Ø35mm, 110°)",
    description: "Gövdeye entegre fren mekanizması, aletsiz tek hamlede klips montajı",
    unit: "Adet",
    unit_price_tl: 52.0,
    specs: { cup_diameter_mm: 35, angle_deg: 110, soft_close: true },
  },
  {
    code: "SMT-STAR-110",
    brand: "samet",
    category: "hinge",
    name: "Samet Star Düz Menteşe (Ø35mm, 110°)",
    description: "Ekonomik düz tas menteşe, sürgülü montaj tabanlı",
    unit: "Adet",
    unit_price_tl: 30.0,
    specs: { cup_diameter_mm: 35, angle_deg: 110, soft_close: false },
  },

  // --- KALKAR KAPAK MEKANİZMALARI ---
  {
    code: "HRD-PSTN-100",
    brand: "generic",
    category: "lift_system",
    name: "Gazlı Piston Kalkar Kapak Makası (100N)",
    description: "Yukarı açılır kalkar kapaklar için gazlı amortisör piston",
    unit: "Adet",
    unit_price_tl: 45.0,
    specs: { force_n: 100, stroke_mm: 90, type: "gas_strut" },
  },
  {
    code: "BLM-AVN-HKS",
    brand: "blum",
    category: "lift_system",
    name: "Blum Aventos HK-S Kompakt Mekanik Kalkar Kapak Seti",
    description: "Küçük üst dolaplar ve aspiratör üstü için entegre Blumotion frenli mekanik kalkar mekanizma",
    unit: "Takım",
    unit_price_tl: 890.0,
    specs: { soft_close: true, stop_anywhere: true, type: "mechanical_lift" },
  },
  {
    code: "BLM-AVN-HF",
    brand: "blum",
    category: "lift_system",
    name: "Blum Aventos HF İki Parçalı Katlanır Kalkar Kapak Seti",
    description: "Büyük iki parçalı mutfak üst dolap kapakları için katlanır kalkar mekanizma",
    unit: "Takım",
    unit_price_tl: 2450.0,
    specs: { soft_close: true, bi_fold: true, type: "mechanical_lift" },
  },
  {
    code: "HAF-FREE-17",
    brand: "hafele",
    category: "lift_system",
    name: "Häfele Free Flap 1.7 Mekanik Kademeli Kalkar Kapak Makası",
    description: "İstenilen açıda durabilen, entegre yumuşak açılıp kapanan mekanik makas seti",
    unit: "Takım",
    unit_price_tl: 720.0,
    specs: { soft_close: true, stop_anywhere: true, type: "mechanical_lift" },
  },
  {
    code: "SMT-D-LITE",
    brand: "samet",
    category: "lift_system",
    name: "Samet D-Lite Lift İnce Mekanik Kalkar Kapak Sistemi",
    description: "Dolap içinde minimum yer kaplayan, aletsiz montajlı kalkar mekanizma",
    unit: "Takım",
    unit_price_tl: 620.0,
    specs: { soft_close: true, stop_anywhere: true, type: "mechanical_lift" },
  },

  // --- KULP VE GOLA PROFİLLERİ ---
  {
    code: "HRD-KULP-160",
    brand: "generic",
    category: "handle_profile",
    name: "Standart Alüminyum Çubuk Kulp (160mm Eksen)",
    description: "Mat eloksal kaplama, M4 vida bağlantılı ergonomik mobilya kulpu",
    unit: "Adet",
    unit_price_tl: 65.0,
    specs: { length_mm: 192, hole_distance_mm: 160, finish: "matte_aluminum" },
  },
  {
    code: "PRF-GOLA-L",
    brand: "hafele",
    category: "handle_profile",
    name: "Häfele L-Gola Yatay Alüminyum Profil (Tezgah Altı Kulpsuz Çözüm)",
    description: "Üst çekmeceler ve kapaklar için tezgah altına gömülen L kesitli alüminyum kulp profili",
    unit: "Metre",
    unit_price_tl: 280.0,
    specs: { profile_type: "L", finish: "matte_black", mounting: "horizontal" },
  },
  {
    code: "PRF-GOLA-C",
    brand: "hafele",
    category: "handle_profile",
    name: "Häfele C-Gola Yatay Alüminyum Profil (Çift Yönlü Çekmece Arası)",
    description: "Orta çekmeceler arası iki yönden parmak geçişi sağlayan C kesitli gola profili",
    unit: "Metre",
    unit_price_tl: 320.0,
    specs: { profile_type: "C", finish: "matte_black", mounting: "horizontal" },
  },
  {
    code: "PRF-GOLA-V",
    brand: "hafele",
    category: "handle_profile",
    name: "Häfele Dikey Gola Alüminyum Profil (Boy Dolaplar)",
    description: "Boy kiler ve buzdolabı dolapları için dikey gömme kulp profili",
    unit: "Metre",
    unit_price_tl: 350.0,
    specs: { profile_type: "vertical", finish: "matte_black", mounting: "vertical" },
  },

  // --- GÖVDE BAĞLANTI ELEMANLARI (FASTENERS) ---
  {
    code: "HRD-MNFX-15",
    brand: "generic",
    category: "fastener",
    name: "Minifiks Bağlantı Takımı (Ø15 Eksantrik + Çelik Mil)",
    description: "Sistem 32 uyumlu demontabl gövde ve raf bağlantı mekanizması",
    unit: "Takım",
    unit_price_tl: 12.0,
    specs: { diameter_mm: 15, shaft_len_mm: 34 },
  },
  {
    code: "HRD-CBN-12",
    brand: "generic",
    category: "fastener",
    name: "Lamello Cabineo 12 Tek Parça Gövde Bağlantısı (Saf Z-Ekseni CNC)",
    description: "Cumbadan delik gerektirmeyen, 3-eksen CNC nestingde tek bağlamada işlenen 900N bağlantı",
    unit: "Adet",
    unit_price_tl: 18.0,
    specs: { pocket_diameter_mm: 15, pocket_depth_mm: 10.8, screw_len_mm: 12 },
  },
  {
    code: "HAF-RFX-20",
    brand: "hafele",
    category: "fastener",
    name: "Häfele Rafix 20 Tablalı Gövde ve Raf Bağlantısı",
    description: "Ø20mm gömme gövdeli, alyan başlı sağlam gövde ve sabit raf bağlantı elemanı",
    unit: "Adet",
    unit_price_tl: 14.0,
    specs: { diameter_mm: 20, depth_mm: 12.7 },
  },
  {
    code: "HRD-KVLA-08",
    brand: "generic",
    category: "fastener",
    name: "Ahşap Yivli Kayın Kavela (Ø8x35mm)",
    description: "Gövde birleştirme ve kaymayı önleyici yivli sert kayın kavela pimi",
    unit: "Adet",
    unit_price_tl: 1.5,
    specs: { diameter_mm: 8, length_mm: 35 },
  },
];

export function getHardwareCatalogItem(code: string): CatalogHardwareItem | null {
  return HARDWARE_CATALOG.find((item) => item.code === code) ?? null;
}

export function getHardwareByBrand(brand: HardwareBrand): CatalogHardwareItem[] {
  return HARDWARE_CATALOG.filter((item) => item.brand === brand);
}

export function getHardwareByCategory(category: HardwareCategory): CatalogHardwareItem[] {
  return HARDWARE_CATALOG.filter((item) => item.category === category);
}

