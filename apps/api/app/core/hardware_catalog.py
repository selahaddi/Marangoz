"""Häfele, Blum, Samet ve Standart Donanım & Mekanizma Kataloğu.

Bu modül, mobilya üretiminde kullanılan lider markaların (Blum, Häfele, Samet)
çekmece rayları, frenli menteşeleri, kalkar kapak mekanizmaları, Gola profilleri
ve bağlantı elemanlarını teknik özellikleri ve birim maliyetleriyle kataloglar.
"""

from enum import StrEnum
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class HardwareBrand(StrEnum):
    """Donanım üretici markaları."""

    GENERIC = "generic"
    BLUM = "blum"
    HAFELE = "hafele"
    SAMET = "samet"


class HardwareCategory(StrEnum):
    """Donanım ürün kategorileri."""

    DRAWER_SYSTEM = "drawer_system"
    HINGE = "hinge"
    LIFT_SYSTEM = "lift_system"
    HANDLE_PROFILE = "handle_profile"
    FASTENER = "fastener"
    ACCESSORY = "accessory"


class CatalogHardwareItem(BaseModel):
    """Katalog donanım öğesi modeli."""

    model_config = ConfigDict(extra="forbid")

    code: str = Field(description="Üretici stok kodu")
    brand: HardwareBrand = Field(description="Üretici marka")
    category: HardwareCategory = Field(description="Ürün kategorisi")
    name: str = Field(description="Ürün tam adı")
    description: str = Field(description="Teknik açıklama")
    unit: str = Field(description="Birim (Adet, Takım, Metre)")
    unit_price_tl: float = Field(ge=0.0, description="Ortalama atölye birim alış fiyatı (TL)")
    specs: dict[str, Any] = Field(default_factory=dict, description="Teknik özellikler")


HARDWARE_CATALOG: list[CatalogHardwareItem] = [
    # --- ÇEKMECE SİSTEMLERİ ---
    CatalogHardwareItem(
        code="HRD-CRAY-500",
        brand=HardwareBrand.GENERIC,
        category=HardwareCategory.DRAWER_SYSTEM,
        name="Standart Frenli Teleskopik Bilyalı Ray (500mm)",
        description="45 kg taşıma kapasiteli, çift yaylı hidrolik frenli teleskopik çekmece rayı",
        unit="Takım",
        unit_price_tl=240.0,
        specs={"load_kg": 45, "length_mm": 500, "soft_close": True, "type": "telescopic"},
    ),
    CatalogHardwareItem(
        code="BLM-TNDM-ANT-500",
        brand=HardwareBrand.BLUM,
        category=HardwareCategory.DRAWER_SYSTEM,
        name="Blum Tandembox Antaro Çift Cidarlı Çekmece Kiti (500mm, 30kg, Blumotion)",
        description="İpek beyazı metalik bordürlü, entegre Blumotion frenli, senkronize yumuşak kapanış",
        unit="Takım",
        unit_price_tl=950.0,
        specs={"load_kg": 30, "length_mm": 500, "soft_close": True, "side_color": "silk_white"},
    ),
    CatalogHardwareItem(
        code="BLM-LEGRA-500",
        brand=HardwareBrand.BLUM,
        category=HardwareCategory.DRAWER_SYSTEM,
        name="Blum Legrabox Orion Grisi İnce Yanak Çekmece Kiti (500mm, 40kg, Blumotion)",
        description="12.8 mm düz dik yanaklar, entegre Blumotion fren, üstün kayma konforu",
        unit="Takım",
        unit_price_tl=1650.0,
        specs={"load_kg": 40, "length_mm": 500, "soft_close": True, "side_color": "orion_gray"},
    ),
    CatalogHardwareItem(
        code="BLM-MOV-500",
        brand=HardwareBrand.BLUM,
        category=HardwareCategory.DRAWER_SYSTEM,
        name="Blum Movento Gizli Ahşap Çekmece Rayı (500mm, 40kg, Blumotion)",
        description="4 boyutlu ayar imkanı, 40 kg taşıma, dişli senkronizasyonlu ipeksi hareket",
        unit="Takım",
        unit_price_tl=820.0,
        specs={"load_kg": 40, "length_mm": 500, "soft_close": True, "type": "undermount"},
    ),
    CatalogHardwareItem(
        code="HAF-MTX-P-500",
        brand=HardwareBrand.HAFELE,
        category=HardwareCategory.DRAWER_SYSTEM,
        name="Häfele Matrix Box P Antrasit Çift Cidarlı Çekmece (500mm, 35kg, Soft-Close)",
        description="Antrasit metal yanak, entegre sıvı pistonlu fren sistemi, 35 kg yük kapasitesi",
        unit="Takım",
        unit_price_tl=780.0,
        specs={"load_kg": 35, "length_mm": 500, "soft_close": True, "side_color": "anthracite"},
    ),
    CatalogHardwareItem(
        code="HAF-ALTO-500",
        brand=HardwareBrand.HAFELE,
        category=HardwareCategory.DRAWER_SYSTEM,
        name="Häfele Alto Drawer İnce Kenarlı Çekmece Sistemi (500mm, 30kg)",
        description="İnce düz metal panel, modern minimalist tasarım, frenli montaj rayları",
        unit="Takım",
        unit_price_tl=650.0,
        specs={"load_kg": 30, "length_mm": 500, "soft_close": True, "side_color": "white"},
    ),
    CatalogHardwareItem(
        code="SMT-FLW-500",
        brand=HardwareBrand.SAMET,
        category=HardwareCategory.DRAWER_SYSTEM,
        name="Samet Flowbox Antrasit İnce Yanaklı Çekmece Sistemi (500mm, 40kg, Frenli)",
        description="12.8 mm ultra ince yanak profili, pürüzsüz kayma ve mükemmel senkronizasyon",
        unit="Takım",
        unit_price_tl=580.0,
        specs={"load_kg": 40, "length_mm": 500, "soft_close": True, "side_color": "anthracite"},
    ),
    CatalogHardwareItem(
        code="SMT-SMART-500",
        brand=HardwareBrand.SAMET,
        category=HardwareCategory.DRAWER_SYSTEM,
        name="Samet Smart Slide Gizli Kısmi Açılır Frenli Ray (500mm)",
        description="Ahşap çekmece kasası altına montaj, adaptif yavaşlatıcı fren mekanizması",
        unit="Takım",
        unit_price_tl=320.0,
        specs={"load_kg": 30, "length_mm": 500, "soft_close": True, "type": "undermount"},
    ),
    CatalogHardwareItem(
        code="SMT-SAMBOX-500",
        brand=HardwareBrand.SAMET,
        category=HardwareCategory.DRAWER_SYSTEM,
        name="Samet Sambox Tek Cidarlı Metal Çekmece Yanı (500mm, Beyaz)",
        description="Ekonomik metal yanak sistemi, epoksi toz boyalı gövde",
        unit="Takım",
        unit_price_tl=190.0,
        specs={"load_kg": 25, "length_mm": 500, "soft_close": False, "side_color": "white"},
    ),

    # --- MENTEŞE SİSTEMLERİ ---
    CatalogHardwareItem(
        code="HRD-MNTS-35",
        brand=HardwareBrand.GENERIC,
        category=HardwareCategory.HINGE,
        name="Standart Frenli Düz Tas Menteşe (Ø35mm, 110°)",
        description="Pistonlu sessiz kapanan vidalı tabanlı düz mobilya menteşesi",
        unit="Adet",
        unit_price_tl=35.0,
        specs={"cup_diameter_mm": 35, "angle_deg": 110, "soft_close": True},
    ),
    CatalogHardwareItem(
        code="BLM-CLIP-110",
        brand=HardwareBrand.BLUM,
        category=HardwareCategory.HINGE,
        name="Blum Clip Top Blumotion 110° Entegre Frenli Düz Menteşe (Ø35mm)",
        description="Gövdeye entegre Blumotion sıvı pistonu, aletsiz klipsli montaj ve 3D ayar",
        unit="Adet",
        unit_price_tl=115.0,
        specs={"cup_diameter_mm": 35, "angle_deg": 110, "soft_close": True, "model": "Clip Top Blumotion"},
    ),
    CatalogHardwareItem(
        code="BLM-CLIP-155",
        brand=HardwareBrand.BLUM,
        category=HardwareCategory.HINGE,
        name="Blum Clip Top 155° Geniş Açılı İç Çekmece Menteşesi",
        description="İç çekmeceli dolaplarda sıfır çıkıntı sağlayan geniş açılı frenli menteşe",
        unit="Adet",
        unit_price_tl=220.0,
        specs={"cup_diameter_mm": 35, "angle_deg": 155, "soft_close": True, "zero_protrusion": True},
    ),
    CatalogHardwareItem(
        code="BLM-TIPON-DOOR",
        brand=HardwareBrand.BLUM,
        category=HardwareCategory.HINGE,
        name="Blum Tip-On Kapak İçin Bas-Aç Mekanizması (Mıknatıslı)",
        description="Kulpsuz kapaklar için bas-aç itici piston ve ayarlı manyetik tutucu",
        unit="Adet",
        unit_price_tl=95.0,
        specs={"stroke_mm": 38, "magnetic": True, "type": "push_to_open"},
    ),
    CatalogHardwareItem(
        code="HAF-MET-110",
        brand=HardwareBrand.HAFELE,
        category=HardwareCategory.HINGE,
        name="Häfele Metalla 300 Frenli Klipsli Tas Menteşe (Ø35mm, 110°)",
        description="Entegre hidrolik yavaşlatıcılı, nikel kaplama çelik tas menteşe",
        unit="Adet",
        unit_price_tl=68.0,
        specs={"cup_diameter_mm": 35, "angle_deg": 110, "soft_close": True},
    ),
    CatalogHardwareItem(
        code="HAF-DUO-110",
        brand=HardwareBrand.HAFELE,
        category=HardwareCategory.HINGE,
        name="Häfele Duomatic Frenli Tas Menteşe (Ø35mm, 110°)",
        description="Alman standardı 4 delikli klipsli taban ve entegre yumuşak kapanma",
        unit="Adet",
        unit_price_tl=75.0,
        specs={"cup_diameter_mm": 35, "angle_deg": 110, "soft_close": True},
    ),
    CatalogHardwareItem(
        code="SMT-MSTR-110",
        brand=HardwareBrand.SAMET,
        category=HardwareCategory.HINGE,
        name="Samet Master Frenli Klipsli Tas Menteşe (Ø35mm, 110°)",
        description="Gövdeye entegre fren mekanizması, aletsiz tek hamlede klips montajı",
        unit="Adet",
        unit_price_tl=52.0,
        specs={"cup_diameter_mm": 35, "angle_deg": 110, "soft_close": True},
    ),
    CatalogHardwareItem(
        code="SMT-STAR-110",
        brand=HardwareBrand.SAMET,
        category=HardwareCategory.HINGE,
        name="Samet Star Düz Menteşe (Ø35mm, 110°)",
        description="Ekonomik düz tas menteşe, sürgülü montaj tabanlı",
        unit="Adet",
        unit_price_tl=30.0,
        specs={"cup_diameter_mm": 35, "angle_deg": 110, "soft_close": False},
    ),

    # --- KALKAR KAPAK MEKANİZMALARI ---
    CatalogHardwareItem(
        code="HRD-PSTN-100",
        brand=HardwareBrand.GENERIC,
        category=HardwareCategory.LIFT_SYSTEM,
        name="Gazlı Piston Kalkar Kapak Makası (100N)",
        description="Yukarı açılır kalkar kapaklar için gazlı amortisör piston",
        unit="Adet",
        unit_price_tl=45.0,
        specs={"force_n": 100, "stroke_mm": 90, "type": "gas_strut"},
    ),
    CatalogHardwareItem(
        code="BLM-AVN-HKS",
        brand=HardwareBrand.BLUM,
        category=HardwareCategory.LIFT_SYSTEM,
        name="Blum Aventos HK-S Kompakt Mekanik Kalkar Kapak Seti",
        description="Küçük üst dolaplar ve aspiratör üstü için entegre Blumotion frenli mekanik kalkar mekanizma",
        unit="Takım",
        unit_price_tl=890.0,
        specs={"soft_close": True, "stop_anywhere": True, "type": "mechanical_lift"},
    ),
    CatalogHardwareItem(
        code="BLM-AVN-HF",
        brand=HardwareBrand.BLUM,
        category=HardwareCategory.LIFT_SYSTEM,
        name="Blum Aventos HF İki Parçalı Katlanır Kalkar Kapak Seti",
        description="Büyük iki parçalı mutfak üst dolap kapakları için katlanır kalkar mekanizma",
        unit="Takım",
        unit_price_tl=2450.0,
        specs={"soft_close": True, "bi_fold": True, "type": "mechanical_lift"},
    ),
    CatalogHardwareItem(
        code="HAF-FREE-17",
        brand=HardwareBrand.HAFELE,
        category=HardwareCategory.LIFT_SYSTEM,
        name="Häfele Free Flap 1.7 Mekanik Kademeli Kalkar Kapak Makası",
        description="İstenilen açıda durabilen, entegre yumuşak açılıp kapanan mekanik makas seti",
        unit="Takım",
        unit_price_tl=720.0,
        specs={"soft_close": True, "stop_anywhere": True, "type": "mechanical_lift"},
    ),
    CatalogHardwareItem(
        code="SMT-D-LITE",
        brand=HardwareBrand.SAMET,
        category=HardwareCategory.LIFT_SYSTEM,
        name="Samet D-Lite Lift İnce Mekanik Kalkar Kapak Sistemi",
        description="Dolap içinde minimum yer kaplayan, aletsiz montajlı kalkar mekanizma",
        unit="Takım",
        unit_price_tl=620.0,
        specs={"soft_close": True, "stop_anywhere": True, "type": "mechanical_lift"},
    ),

    # --- KULP VE GOLA PROFİLLERİ ---
    CatalogHardwareItem(
        code="HRD-KULP-160",
        brand=HardwareBrand.GENERIC,
        category=HardwareCategory.HANDLE_PROFILE,
        name="Standart Alüminyum Çubuk Kulp (160mm Eksen)",
        description="Mat eloksal kaplama, M4 vida bağlantılı ergonomik mobilya kulpu",
        unit="Adet",
        unit_price_tl=65.0,
        specs={"length_mm": 192, "hole_distance_mm": 160, "finish": "matte_aluminum"},
    ),
    CatalogHardwareItem(
        code="PRF-GOLA-L",
        brand=HardwareBrand.HAFELE,
        category=HardwareCategory.HANDLE_PROFILE,
        name="Häfele L-Gola Yatay Alüminyum Profil (Tezgah Altı Kulpsuz Çözüm)",
        description="Üst çekmeceler ve kapaklar için tezgah altına gömülen L kesitli alüminyum kulp profili",
        unit="Metre",
        unit_price_tl=280.0,
        specs={"profile_type": "L", "finish": "matte_black", "mounting": "horizontal"},
    ),
    CatalogHardwareItem(
        code="PRF-GOLA-C",
        brand=HardwareBrand.HAFELE,
        category=HardwareCategory.HANDLE_PROFILE,
        name="Häfele C-Gola Yatay Alüminyum Profil (Çift Yönlü Çekmece Arası)",
        description="Orta çekmeceler arası iki yönden parmak geçişi sağlayan C kesitli gola profili",
        unit="Metre",
        unit_price_tl=320.0,
        specs={"profile_type": "C", "finish": "matte_black", "mounting": "horizontal"},
    ),
    CatalogHardwareItem(
        code="PRF-GOLA-V",
        brand=HardwareBrand.HAFELE,
        category=HardwareCategory.HANDLE_PROFILE,
        name="Häfele Dikey Gola Alüminyum Profil (Boy Dolaplar)",
        description="Boy kiler ve buzdolabı dolapları için dikey gömme kulp profili",
        unit="Metre",
        unit_price_tl=350.0,
        specs={"profile_type": "vertical", "finish": "matte_black", "mounting": "vertical"},
    ),

    # --- GÖVDE BAĞLANTI ELEMANLARI (FASTENERS) ---
    CatalogHardwareItem(
        code="HRD-MNFX-15",
        brand=HardwareBrand.GENERIC,
        category=HardwareCategory.FASTENER,
        name="Minifiks Bağlantı Takımı (Ø15 Eksantrik + Çelik Mil)",
        description="Sistem 32 uyumlu demontabl gövde ve raf bağlantı mekanizması",
        unit="Takım",
        unit_price_tl=12.0,
        specs={"diameter_mm": 15, "shaft_len_mm": 34},
    ),
    CatalogHardwareItem(
        code="HRD-CBN-12",
        brand=HardwareBrand.GENERIC,
        category=HardwareCategory.FASTENER,
        name="Lamello Cabineo 12 Tek Parça Gövde Bağlantısı (Saf Z-Ekseni CNC)",
        description="Cumbadan delik gerektirmeyen, 3-eksen CNC nestingde tek bağlamada işlenen 900N bağlantı",
        unit="Adet",
        unit_price_tl=18.0,
        specs={"pocket_diameter_mm": 15, "pocket_depth_mm": 10.8, "screw_len_mm": 12},
    ),
    CatalogHardwareItem(
        code="HAF-RFX-20",
        brand=HardwareBrand.HAFELE,
        category=HardwareCategory.FASTENER,
        name="Häfele Rafix 20 Tablalı Gövde ve Raf Bağlantısı",
        description="Ø20mm gömme gövdeli, alyan başlı sağlam gövde ve sabit raf bağlantı elemanı",
        unit="Adet",
        unit_price_tl=14.0,
        specs={"diameter_mm": 20, "depth_mm": 12.7},
    ),
    CatalogHardwareItem(
        code="HRD-KVLA-08",
        brand=HardwareBrand.GENERIC,
        category=HardwareCategory.FASTENER,
        name="Ahşap Yivli Kayın Kavela (Ø8x35mm)",
        description="Gövde birleştirme ve kaymayı önleyici yivli sert kayın kavela pimi",
        unit="Adet",
        unit_price_tl=1.5,
        specs={"diameter_mm": 8, "length_mm": 35},
    ),
]


def get_hardware_catalog_item(code: str) -> CatalogHardwareItem | None:
    """Stok koduna göre katalogdan ürün döndürür."""
    for item in HARDWARE_CATALOG:
        if item.code == code:
            return item
    return None


def get_hardware_by_brand(brand: HardwareBrand) -> list[CatalogHardwareItem]:
    """Markaya göre katalog öğelerini filtreler."""
    return [item for item in HARDWARE_CATALOG if item.brand == brand]


def get_hardware_by_category(category: HardwareCategory) -> list[CatalogHardwareItem]:
    """Kategoriye göre katalog öğelerini filtreler."""
    return [item for item in HARDWARE_CATALOG if item.category == category]

