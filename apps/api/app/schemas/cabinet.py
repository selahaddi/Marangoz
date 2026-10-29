"""Parametrik dolap tasarımı, BOM, CNC delik ve Nesting Pydantic V2 şemaları."""

import math
from enum import StrEnum
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """Standart API JSON zarfı (docs/01_PROJECT_OVERVIEW_AND_ARCHITECTURE.md)."""

    model_config = ConfigDict(from_attributes=True)

    success: bool = Field(description="İşlem başarı durumu")
    data: T | None = Field(default=None, description="Yanıt verisi")
    error: str | None = Field(default=None, description="Hata mesajı (varsa)")


class CabinetType(StrEnum):
    """Desteklenen modüler dolap ve oda tipleri."""

    WARDROBE = "wardrobe"
    KITCHEN_BASE = "kitchen_base"
    KITCHEN_WALL = "kitchen_wall"
    KITCHEN_TALL = "kitchen_tall"
    BATHROOM_VANITY = "bathroom_vanity"
    BATHROOM_TALL = "bathroom_tall"
    DRESSER = "dresser"
    BOOKSHELF = "bookshelf"
    SHOE_CABINET = "shoe_cabinet"
    TV_UNIT = "tv_unit"


class DoorType(StrEnum):
    """Kapak konfigürasyonu seçenekleri."""

    NONE = "none"
    SINGLE_LEFT = "single_left"
    SINGLE_RIGHT = "single_right"
    DOUBLE = "double"
    FLAP_UP = "flap_up"


class BackPanelType(StrEnum):
    """Arkalık montaj ve malzeme tipi."""

    GROOVED_8MM = "grooved_8mm"
    NAILED_3MM = "nailed_3mm"


class SheetSizeOption(StrEnum):
    """Standart fabrika plaka ebatları (mm)."""

    SHEET_2800_2100 = "2800x2100"
    SHEET_3660_1830 = "3660x1830"


class FastenerType(StrEnum):
    """Gövde bağlantı elemanı mimarisi (Minifiks+Kavela veya 3-Eksen Lamello Cabineo)."""

    MINIFIX_DOWEL = "minifix_dowel"
    CABINEO_12 = "cabineo_12"


class CuttingMode(StrEnum):
    """Kesim teknolojisi modu (Yatar Daire/Ebatlama Testeresi veya 3-Eksen CNC Router Nesting)."""

    PANEL_SAW = "panel_saw"
    CNC_ROUTER = "cnc_router"


class PlinthType(StrEnum):
    """Alt baza ve terazi sistemi."""

    WOOD_PLINTH = "wood_plinth"
    ADJUSTABLE_LEGS = "adjustable_legs"


class EdgeBandSpec(BaseModel):
    """Parçanın 4 kenarındaki PVC bant kalınlıkları (mm)."""

    model_config = ConfigDict(extra="forbid")

    length_1_mm: float = Field(
        default=2.0,
        ge=0.0,
        le=2.0,
        description="Uzun kenar 1 (Ön) PVC kalınlığı (0, 0.4, 1.0, 2.0 mm)",
    )
    length_2_mm: float = Field(
        default=0.4,
        ge=0.0,
        le=2.0,
        description="Uzun kenar 2 (Arka) PVC kalınlığı (0, 0.4, 1.0, 2.0 mm)",
    )
    width_1_mm: float = Field(
        default=0.4,
        ge=0.0,
        le=2.0,
        description="Kısa kenar 1 (Üst/Sol) PVC kalınlığı (0, 0.4, 1.0, 2.0 mm)",
    )
    width_2_mm: float = Field(
        default=0.4,
        ge=0.0,
        le=2.0,
        description="Kısa kenar 2 (Alt/Sağ) PVC kalınlığı (0, 0.4, 1.0, 2.0 mm)",
    )


class CabinetZone(BaseModel):
    """Dolap içi dikey bölme (Zone) konfigürasyonu."""

    model_config = ConfigDict(extra="ignore")

    id: str = Field(default="", description="Bölme kimliği")
    name: str = Field(default="Bölme", description="Bölme adı (Sol Bölme, Sağ Bölme vb.)")
    width_ratio: float = Field(
        default=1.0, ge=0.1, le=10.0, description="Genişlik oranı payı (varsayılan 1.0 = eşit)"
    )
    width_mm: float | None = Field(
        default=None, ge=100.0, le=2500.0, description="Özel net genişlik mm (varsa oranın yerine geçer)"
    )
    shelf_count: int = Field(default=0, ge=0, le=12, description="Bu bölmedeki hareketli raf adedi")
    door_type: DoorType = Field(default=DoorType.NONE, description="Bu bölmeye ait kapak tipi")
    drawer_count: int = Field(default=0, ge=0, le=6, description="Bu bölmedeki alt çekmece adedi")
    drawer_front_height_mm: float = Field(
        default=180.0, ge=120.0, le=350.0, description="Çekmece klapa yüksekliği (mm)"
    )
    has_hanging_rod: bool = Field(default=False, description="Elbise askı borusu var mı?")
    appliance_niche_height_mm: float = Field(
        default=0.0, ge=0.0, le=2200.0, description="Açık niş / cihaz boşluğu yüksekliği (mm)"
    )
    niche_height_mm: float = Field(
        default=0.0, ge=0.0, le=2200.0, description="Açık niş / cihaz boşluğu yüksekliği (mm)"
    )
    niche_bottom_offset_mm: float = Field(
        default=0.0, ge=0.0, le=2200.0, description="Nişin alt başlangıç kotu (0 = alt açık niş, >0 = orta açık niş)"
    )
    niche_color_hex: str | None = Field(
        default=None,
        pattern=r"^(#[0-9A-Fa-f]{6})?$",
        description="Açık niş içi ve arka paneli kontrast rengi (HEX)",
    )
    niche_back_open: bool = Field(default=False, description="Niş arkalığı açık mı (duvar prizi, havalandırma)")
    door_color_hex: str | None = Field(default=None, description="Bu bölmenin kapağına özel renk (HEX)")


class CabinetConfig(BaseModel):
    """Doğal dilden veya arayüzden gelen doğrulanmış parametrik dolap modeli."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(
        default="Parametrik Gardırop Modülü",
        min_length=2,
        max_length=120,
        description="Modül adı veya açıklaması",
    )
    cabinet_type: CabinetType = Field(
        default=CabinetType.WARDROBE,
        description="Dolap modül tipi",
    )
    width_mm: float = Field(
        default=900.0,
        ge=300.0,
        le=2700.0,
        description="Dıştan dışa toplam dolap genişliği (W, mm)",
    )
    height_mm: float = Field(
        default=2100.0,
        ge=300.0,
        le=2750.0,
        description="Dıştan dışa toplam dolap yüksekliği (H, mm)",
    )
    depth_mm: float = Field(
        default=580.0,
        ge=200.0,
        le=900.0,
        description="Gövde derinliği (D, kapak hariç, mm)",
    )
    shelf_count: int = Field(
        default=4,
        ge=0,
        le=12,
        description="Hareketli iç raf adedi",
    )
    door_type: DoorType = Field(
        default=DoorType.DOUBLE,
        description="Kapak tipi (none, single_left, single_right, double)",
    )
    drawer_count: int = Field(
        default=0,
        ge=0,
        le=6,
        description="Modül alt kısmındaki çekmece adedi (0-6)",
    )
    drawer_front_height_mm: float = Field(
        default=180.0,
        ge=120.0,
        le=350.0,
        description="Her bir çekmece ön klapa yüksekliği (mm)",
    )
    appliance_niche_height_mm: float = Field(
        default=0.0,
        ge=0.0,
        le=2200.0,
        description="Alt kısımda bırakılacak açık cihaz / buzdolabı niş yüksekliği (mm)",
    )
    niche_height_mm: float = Field(
        default=0.0,
        ge=0.0,
        le=2200.0,
        description="Açık niş / cihaz boşluğu yüksekliği (mm). appliance_niche_height_mm ile geriye dönük uyumludur.",
    )
    niche_bottom_offset_mm: float = Field(
        default=0.0,
        ge=0.0,
        le=2200.0,
        description="Nişin bazadan/zeminden başlangıç yüksekliği mm (0 = alt açık niş/buzdolabı, >0 = orta niş/kahve köşesi/fırın)",
    )
    niche_color_hex: str | None = Field(
        default=None,
        pattern=r"^(#[0-9A-Fa-f]{6})?$",
        description="Açık niş içi ve arka paneli için kontrast renk (HEX)",
    )
    niche_back_open: bool = Field(
        default=False,
        description="Niş arkalığı açık/menfezli mi (duvar prizi, kablo geçişi veya ankastre fırın arkası için)",
    )
    additional_modules: list["CabinetConfig"] = Field(
        default_factory=list,
        description="Çoklu modül / oda hattı içindeki yan yana ek modüller",
    )
    zones: list[CabinetZone] = Field(
        default_factory=list,
        description="Dolap içi dikey bölmeler ve donanımları (boş ise tekil standart gövde kullanılır)",
    )
    has_plinth: bool = Field(
        default=True,
        description="Alt baza (tekmelik) var mı?",
    )
    plinth_height_mm: float = Field(
        default=80.0,
        ge=0.0,
        le=200.0,
        description="Alt baza yüksekliği (mm)",
    )
    body_material: str = Field(
        default="18mm Beyaz Suntalam",
        min_length=2,
        max_length=80,
        description="Gövde plaka malzemesi",
    )
    door_material: str = Field(
        default="",
        max_length=80,
        description="Kapak ve çekmece klapa malzemesi (boş ise body_material kullanılır)",
    )
    body_color_hex: str = Field(
        default="#F4F1EA",
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="3D önizleme için gövde rengi (HEX)",
    )
    door_color_hex: str = Field(
        default="#D7C4A3",
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="3D önizleme için kapak rengi (HEX)",
    )
    front_pvc_thickness_mm: float = Field(
        default=2.0,
        description="Görünen ön kenarlarda kullanılacak PVC bant kalınlığı (0.4, 1.0, 2.0 mm)",
    )
    hidden_pvc_thickness_mm: float = Field(
        default=0.4,
        description="Gizli/arka kenarlarda kullanılacak PVC bant kalınlığı (0.0, 0.4, 1.0 mm)",
    )
    back_panel_type: BackPanelType = Field(
        default=BackPanelType.GROOVED_8MM,
        description="Arkalık tipi (8 mm kanal içi veya 3 mm çakma)",
    )
    sheet_size: SheetSizeOption = Field(
        default=SheetSizeOption.SHEET_2800_2100,
        description="Kesim optimizasyonu yapılacak standart plaka ebadı",
    )
    fastener_type: FastenerType = Field(
        default=FastenerType.MINIFIX_DOWEL,
        description="Bağlantı elemanı sistemi (minifix_dowel veya 3-eksen cabineo_12)",
    )
    cutting_mode: CuttingMode = Field(
        default=CuttingMode.PANEL_SAW,
        description="Kesim modu (panel_saw: 4mm testere kerf, cnc_router: 10mm çakı + tutunma sekmesi)",
    )
    router_bit_diameter_mm: float = Field(
        default=10.0,
        ge=6.0,
        le=16.0,
        description="CNC Router nesting freze çakı çapı (mm)",
    )
    left_filler_width_mm: float = Field(
        default=0.0,
        ge=0.0,
        le=150.0,
        description="Sol duvar rölöve kapama (kör çıta / scribing filler) payı (mm)",
    )
    right_filler_width_mm: float = Field(
        default=0.0,
        ge=0.0,
        le=150.0,
        description="Sağ duvar rölöve kapama (kör çıta / scribing filler) payı (mm)",
    )
    has_baseboard_notch: bool = Field(
        default=False,
        description="Yan dikme arkasında süpürgelik kertmesi var mı?",
    )
    baseboard_notch_height_mm: float = Field(
        default=80.0,
        ge=30.0,
        le=200.0,
        description="Süpürgelik kertmesi yüksekliği (mm)",
    )
    baseboard_notch_depth_mm: float = Field(
        default=15.0,
        ge=5.0,
        le=60.0,
        description="Süpürgelik kertmesi derinliği (mm)",
    )
    has_column_notch: bool = Field(
        default=False,
        description="Arka köşede kolon/kiriş kertmesi var mı?",
    )
    column_notch_width_mm: float = Field(
        default=120.0,
        ge=30.0,
        le=400.0,
        description="Kolon kertmesi genişliği (X, mm)",
    )
    column_notch_depth_mm: float = Field(
        default=120.0,
        ge=30.0,
        le=400.0,
        description="Kolon kertmesi derinliği (Z, mm)",
    )
    plinth_type: PlinthType = Field(
        default=PlinthType.WOOD_PLINTH,
        description="Alt baza tipi (wood_plinth veya adjustable_legs)",
    )
    # Faz 4: Çatı Eğimi (Mansard Çatı / Merdiven Altı Eğimli Dolap)
    has_slope: bool = Field(
        default=False,
        description="Çatı veya merdiven altı eğimi var mı?",
    )
    slope_side: str = Field(
        default="left",
        pattern=r"^(left|right)$",
        description="Eğimin başladığı alçak kenar ('left' veya 'right')",
    )
    slope_start_height_mm: float = Field(
        default=1200.0,
        ge=300.0,
        le=2800.0,
        description="Eğimli tarafın başlangıç alçak dikme boyu (mm)",
    )
    slope_angle_deg: float = Field(
        default=0.0,
        ge=0.0,
        le=75.0,
        description="Hesaplanan veya belirtilen çatı eğim açısı (derece)",
    )

    # Faz 4: L-Köşe Modülü
    is_corner_module: bool = Field(
        default=False,
        description="L-Köşe dönüş modülü mü?",
    )
    corner_angle_deg: float = Field(
        default=90.0,
        ge=45.0,
        le=135.0,
        description="Köşe dönüş açısı (derece, genelde 90.0)",
    )
    corner_blind_width_mm: float = Field(
        default=100.0,
        ge=40.0,
        le=300.0,
        description="L-Köşe birleşim kör kapama paneli genişliği (mm)",
    )

    @field_validator("front_pvc_thickness_mm", "hidden_pvc_thickness_mm")
    @classmethod
    def validate_pvc_thickness(cls, value: float) -> float:
        """Yalnızca standart PVC bant kalınlıklarına izin verir."""
        allowed = (0.0, 0.4, 1.0, 2.0)
        if round(value, 2) not in allowed:
            raise ValueError(
                f"Geçersiz PVC kalınlığı: {value} mm. İzin verilen değerler: {allowed}"
            )
        return round(value, 2)

    @model_validator(mode="after")
    def validate_cabinet_proportions(self) -> "CabinetConfig":
        """Baza yüksekliği ve kapak uyumluluğunu doğrular."""
        if not self.has_plinth:
            self.plinth_height_mm = 0.0
        elif self.plinth_height_mm < 50.0:
            self.plinth_height_mm = 80.0

        # Yalnızca tabandan başlayan buzdolabı nişlerinde baza kaldırılır
        if self.appliance_niche_height_mm > 0.0 and (self.niche_bottom_offset_mm or 0.0) == 0.0:
            self.has_plinth = False
            self.plinth_height_mm = 0.0
            if self.appliance_niche_height_mm > self.height_mm - 200.0:
                self.appliance_niche_height_mm = max(0.0, self.height_mm - 350.0)

        if self.height_mm - self.plinth_height_mm < 200.0:
            raise ValueError(
                "Gövde net yüksekliği (toplam yükseklik - baza) en az 200 mm olmalıdır."
            )

        if self.has_slope:
            if self.slope_start_height_mm >= self.height_mm:
                self.slope_start_height_mm = max(300.0, self.height_mm - 400.0)
            delta_h = self.height_mm - self.slope_start_height_mm
            self.slope_angle_deg = round(
                math.degrees(math.atan2(delta_h, max(1.0, self.width_mm))), 1
            )

        return self


class DrillPoint(BaseModel):
    """Parça yüzeyindeki tekil CNC delik koordinatı ve parametresi."""

    model_config = ConfigDict(extra="forbid")

    x_mm: float = Field(description="Parça sol alt köşesinden X koordinatı (mm)")
    y_mm: float = Field(description="Parça sol alt köşesinden Y koordinatı (mm)")
    diameter_mm: float = Field(gt=0.0, description="Delik çapı (mm)")
    depth_mm: float = Field(gt=0.0, description="Delik derinliği (mm)")
    layer: str = Field(description="DXF R2010 katman adı")
    description: str = Field(description="Operasyon açıklaması")


class GroovePath(BaseModel):
    """Parça yüzeyindeki CNC kanal (testere/freze) dikdörtgen yolu."""

    model_config = ConfigDict(extra="forbid")

    x_start_mm: float = Field(description="Kanal başlangıç X koordinatı (mm)")
    y_start_mm: float = Field(description="Kanal başlangıç Y koordinatı (mm)")
    width_mm: float = Field(gt=0.0, description="Kanal X yönü genişliği (mm)")
    length_mm: float = Field(gt=0.0, description="Kanal Y yönü uzunluğu (mm)")
    depth_mm: float = Field(gt=0.0, description="Kanal derinliği (mm)")
    layer: str = Field(description="DXF R2010 katman adı")


class Box3DTransform(BaseModel):
    """Parçanın 3D sahnedeki merkez koordinatları ve boyutları (mm)."""

    model_config = ConfigDict(extra="forbid")

    center_x_mm: float = Field(description="X ekseni merkez konumu (Sol->Sağ, mm)")
    center_y_mm: float = Field(description="Y ekseni merkez konumu (Alt->Üst, mm)")
    center_z_mm: float = Field(description="Z ekseni merkez konumu (Arka->Ön, mm)")
    size_x_mm: float = Field(gt=0.0, description="3D X boyutu (mm)")
    size_y_mm: float = Field(gt=0.0, description="3D Y boyutu (mm)")
    size_z_mm: float = Field(gt=0.0, description="3D Z boyutu (mm)")
    color_hex: str = Field(description="Parça 3D rengi (HEX)")
    is_door: bool = Field(default=False, description="Kapak parçası mı?")
    is_drawer: bool = Field(default=False, description="Çekmece parçası mı?")
    is_hanging_rod: bool = Field(default=False, description="Elbise askı borusu mu?")
    is_niche: bool = Field(default=False, description="Niş içi veya niş arka paneli mi?")
    hinge_side: str | None = Field(
        default=None, description="Kapak menteşe yönü (left / right / None)"
    )
    module_index: int = Field(
        default=1, ge=1, description="Çoklu modül hattındaki modül sıra numarası"
    )
    rotation_z_deg: float = Field(
        default=0.0, description="Z ekseni etrafında dönme açısı (eğimli üst tabla için)"
    )
    is_sloped: bool = Field(default=False, description="Eğimli parça mı?")
    corner_rotation_y_deg: float = Field(
        default=0.0, description="L-Köşe dönüşü için Y ekseni dönme açısı"
    )


class PanelPart(BaseModel):
    """Üretilecek tekil ahşap panel parçası (BOM ve CNC birimi)."""

    model_config = ConfigDict(extra="forbid")

    part_id: str = Field(description="Benzersiz parça kimliği (örn. P01)")
    code: str = Field(description="Kısa üretim kodu (örn. YAN_SOL)")
    name: str = Field(description="Parça Türkçe adı (örn. Sol Yan Dikme)")
    material: str = Field(description="Malzeme cinsi")
    thickness_mm: float = Field(gt=0.0, description="Plaka kalınlığı (18, 8, 3 mm)")
    quantity: int = Field(default=1, ge=1, description="Parça adedi")
    net_length_mm: float = Field(gt=0.0, description="Bitmiş (net) boy ölçüsü (mm)")
    net_width_mm: float = Field(gt=0.0, description="Bitmiş (net) en ölçüsü (mm)")
    cut_length_mm: float = Field(
        gt=0.0, description="PVC düşülmüş testere kesim boyu (mm)"
    )
    cut_width_mm: float = Field(
        gt=0.0, description="PVC düşülmüş testere kesim eni (mm)"
    )
    pvc_deduction_length_mm: float = Field(
        ge=0.0, description="Boydan düşülen toplam PVC payı (mm)"
    )
    pvc_deduction_width_mm: float = Field(
        ge=0.0, description="Enden düşülen toplam PVC payı (mm)"
    )
    edge_band: EdgeBandSpec = Field(description="4 kenar PVC bant bilgisi")
    area_m2: float = Field(gt=0.0, description="Parça net alanı (m²)")
    grain_direction: str = Field(
        default="length", description="Desen/su yolu yönü (length / none)"
    )
    drills: list[DrillPoint] = Field(
        default_factory=list, description="CNC delik listesi"
    )
    grooves: list[GroovePath] = Field(
        default_factory=list, description="CNC kanal listesi"
    )
    holding_tabs_count: int = Field(
        default=0,
        ge=0,
        description="Küçük parça vakum tutunma sekmesi adedi (CNC Router Nesting)",
    )
    notch_info: str = Field(
        default="",
        description="Süpürgelik veya kolon kertme bilgisi",
    )
    is_trapezoid: bool = Field(
        default=False,
        description="Parça yamuk (çatı eğimli açılı) kesim mi?",
    )
    trapezoid_h_start_mm: float | None = Field(
        default=None,
        description="Eğimli parçanın kısa kenar yüksekliği (mm)",
    )
    trapezoid_h_end_mm: float | None = Field(
        default=None,
        description="Eğimli parçanın uzun kenar yüksekliği (mm)",
    )
    transform_3d: Box3DTransform = Field(description="3D sahne yerleşim verisi")


class HardwareItem(BaseModel):
    """Bağlantı elemanı ve aksesuar kalemi."""

    model_config = ConfigDict(extra="forbid")

    code: str = Field(description="Hırdavat stok kodu")
    name: str = Field(description="Hırdavat adı")
    unit: str = Field(description="Birim (Adet, Metre, Takım)")
    quantity: float = Field(ge=0.0, description="Miktar")
    note: str = Field(default="", description="Montaj açıklaması")


class ShelfDeflectionResult(BaseModel):
    """Euler-Bernoulli kiriş teorisine göre raf sehim (esneme) analizi sonucu."""

    model_config = ConfigDict(extra="forbid")

    shelf_id: str = Field(description="Raf parça kimliği")
    span_mm: float = Field(ge=0.0, description="Raf net açıklığı (mm)")
    depth_mm: float = Field(ge=0.0, description="Raf derinliği (mm)")
    thickness_mm: float = Field(gt=0.0, description="Raf et kalınlığı (mm)")
    material: str = Field(description="Raf malzemesi (suntalam, mdf, masif)")
    load_kg: float = Field(ge=0.0, description="Raf üzerindeki tasarım yükü (kg)")
    deflection_mm: float = Field(ge=0.0, description="Hesaplanan maksimum sehim (mm)")
    allowable_deflection_mm: float = Field(
        ge=0.0, description="İzin verilen maksimum sehim sınırı (mm)"
    )
    is_acceptable: bool = Field(description="Sehim sınırı güvenli mi?")
    warning: str | None = Field(default=None, description="Mühendislik uyarısı")
    recommendation: str | None = Field(
        default=None, description="Marangozluk takviye tavsiyesi"
    )


class DoorHardwareAudit(BaseModel):
    """Kapak ağırlığı, menteşe adedi ve gazlı amortisör taşıma kapasitesi denetimi."""

    model_config = ConfigDict(extra="forbid")

    door_id: str = Field(description="Kapak parça kimliği")
    height_mm: float = Field(gt=0.0, description="Kapak yüksekliği (mm)")
    width_mm: float = Field(gt=0.0, description="Kapak genişliği (mm)")
    weight_kg: float = Field(gt=0.0, description="Kapak net ağırlığı (kg)")
    door_type: str = Field(description="Kapak açılma tipi")
    current_hinge_count: int = Field(ge=0, description="Mevcut menteşe adedi")
    recommended_hinge_count: int = Field(ge=2, description="Önerilen menteşe adedi")
    recommended_gas_piston_n: int | None = Field(
        default=None, description="Kalkar kapak için önerilen piston kuvveti (Newton)"
    )
    is_acceptable: bool = Field(description="Donanım kapasitesi yeterli mi?")
    warning: str | None = Field(default=None, description="Kapasite aşım uyarısı")


class SiteFittingAudit(BaseModel):
    """Şantiye, rölöve, süpürgelik ve duvar tolerans uyumluluk denetimi."""

    model_config = ConfigDict(extra="forbid")

    has_wall_clash_risk: bool = Field(
        default=False, description="Duvar veya niş sürtünme riski var mı?"
    )
    has_baseboard_clash_risk: bool = Field(
        default=False, description="Süpürgelik baza çakışma riski var mı?"
    )
    warnings: list[str] = Field(default_factory=list, description="Şantiye uyarıları")
    recommendations: list[str] = Field(
        default_factory=list, description="Rölöve ve montaj tavsiyeleri"
    )


class EngineeringAuditReport(BaseModel):
    """Marangozluk Mühendislik ve Taşıma Kapasitesi Kural Motoru Denetim Raporu."""

    model_config = ConfigDict(extra="forbid")

    shelf_deflections: list[ShelfDeflectionResult] = Field(
        default_factory=list, description="Raf sehim analizleri"
    )
    door_audits: list[DoorHardwareAudit] = Field(
        default_factory=list, description="Kapak donanım yük analizleri"
    )
    site_fitting: SiteFittingAudit = Field(description="Şantiye uyumluluk analizi")
    overall_health_score: int = Field(
        ge=0, le=100, description="Genel mobilya mühendislik sağlık skoru (0-100)"
    )
    has_critical_issues: bool = Field(
        default=False, description="Kritik mühendislik hatası var mı?"
    )
    summary_messages: list[str] = Field(
        default_factory=list, description="Özet mühendislik değerlendirmeleri"
    )


class BOMReport(BaseModel):
    """Malzeme İhtiyaç ve Kesim Listesi (Bill of Materials) raporu."""

    model_config = ConfigDict(extra="forbid")

    config: CabinetConfig = Field(description="Girdi dolap konfigürasyonu")
    parts: list[PanelPart] = Field(description="Tüm ahşap kesim parçaları")
    hardware: list[HardwareItem] = Field(description="Bağlantı elemanları ve PVC özeti")
    total_net_area_m2: float = Field(ge=0.0, description="Toplam net parça alanı (m²)")
    total_cut_area_m2: float = Field(ge=0.0, description="Toplam kesim alanı (m²)")
    total_pvc_04_meters: float = Field(
        ge=0.0, description="0.4 mm PVC toplam metrajı (m)"
    )
    total_pvc_10_meters: float = Field(
        ge=0.0, description="1.0 mm PVC toplam metrajı (m)"
    )
    total_pvc_20_meters: float = Field(
        ge=0.0, description="2.0 mm PVC toplam metrajı (m)"
    )
    total_parts_count: int = Field(ge=0, description="Toplam parça adedi")
    total_drill_count: int = Field(ge=0, description="Toplam CNC delik sayısı")
    engineering_audit: EngineeringAuditReport | None = Field(
        default=None, description="Marangozluk mühendislik ve yük kapasitesi denetim raporu"
    )


class NestedPartPlacement(BaseModel):
    """Plaka üzerine yerleştirilmiş parçanın 2D koordinatları."""

    model_config = ConfigDict(extra="forbid")

    part_id: str = Field(description="Parça kimliği")
    code: str = Field(description="Parça kodu")
    name: str = Field(description="Parça adı")
    thickness_mm: float = Field(description="Parça kalınlığı (mm)")
    sheet_index: int = Field(ge=1, description="Plaka numarası (1-tabanlı)")
    x_mm: float = Field(ge=0.0, description="Plaka sol alt köşesinden X konumu (mm)")
    y_mm: float = Field(ge=0.0, description="Plaka sol alt köşesinden Y konumu (mm)")
    width_mm: float = Field(gt=0.0, description="Yerleşim X genişliği (mm)")
    height_mm: float = Field(gt=0.0, description="Yerleşim Y yüksekliği (mm)")
    rotated: bool = Field(default=False, description="90 derece döndürüldü mü?")
    cut_length_mm: float = Field(gt=0.0, description="Orijinal kesim boyu (mm)")
    cut_width_mm: float = Field(gt=0.0, description="Orijinal kesim eni (mm)")
    holding_tabs_count: int = Field(
        default=0,
        ge=0,
        description="Küçük parça vakum tutunma sekmesi adedi",
    )
    notch_info: str | None = Field(
        default=None,
        description="Parçanın kertme detayı (örn: Süpürgelik 80x15mm)",
    )
    is_true_shape: bool = Field(
        default=False,
        description="CNC Router true-shape / L-geometri ile yerleştirildi mi?",
    )


class RemnantStockItem(BaseModel):
    """Kesim sonrası arta kalan ve sanal depoya alınabilir (≥400×600 mm) sağlam levha parçası."""

    model_config = ConfigDict(extra="forbid")

    remnant_id: str = Field(description="Artık levha kimliği (örn. REM-S1-01)")
    sheet_index: int = Field(ge=1, description="Çıktığı plaka numarası")
    material: str = Field(description="Malzeme cinsi")
    thickness_mm: float = Field(gt=0.0, description="Kalınlık (mm)")
    x_mm: float = Field(ge=0.0, description="Plaka sol alt X koordinatı (mm)")
    y_mm: float = Field(ge=0.0, description="Plaka sol alt Y koordinatı (mm)")
    width_mm: float = Field(gt=0.0, description="Artık levha X boyutu (mm)")
    height_mm: float = Field(gt=0.0, description="Artık levha Y boyutu (mm)")
    area_m2: float = Field(gt=0.0, description="Kullanılabilir artık levha alanı (m²)")


class SheetLayout(BaseModel):
    """Tek bir standart plakanın kesim yerleşim özeti."""

    model_config = ConfigDict(extra="forbid")

    sheet_index: int = Field(ge=1, description="Plaka sıra numarası")
    material: str = Field(description="Plaka malzemesi ve kalınlığı")
    thickness_mm: float = Field(gt=0.0, description="Plaka kalınlığı (mm)")
    sheet_width_mm: float = Field(gt=0.0, description="Ham plaka boyu (mm)")
    sheet_height_mm: float = Field(gt=0.0, description="Ham plaka eni (mm)")
    usable_width_mm: float = Field(gt=0.0, description="Temizlik payı düşülmüş net boy")
    usable_height_mm: float = Field(gt=0.0, description="Temizlik payı düşülmüş net en")
    trim_margin_mm: float = Field(ge=0.0, description="Kenar temizlik payı (mm)")
    kerf_mm: float = Field(ge=0.0, description="Testere veya CNC çakı talaş payı (mm)")
    used_area_m2: float = Field(ge=0.0, description="Kullanılan parça alanı (m²)")
    waste_area_m2: float = Field(ge=0.0, description="Fire alanı (m²)")
    waste_percentage: float = Field(ge=0.0, le=100.0, description="Fire yüzdesi (%)")
    placements: list[NestedPartPlacement] = Field(description="Yerleşen parçalar")
    remnants: list[RemnantStockItem] = Field(
        default_factory=list,
        description="Plakadan çıkan kullanılabilir artık parçalar (≥400×600 mm)",
    )
    svg_content: str = Field(description="Bu plakaya ait ölçekli SVG kesim şeması")


class NestingResult(BaseModel):
    """Tüm plakaların kesim optimizasyonu (Nesting) sonucu."""

    model_config = ConfigDict(extra="forbid")

    sheet_width_mm: float = Field(gt=0.0, description="Standart plaka boyu (mm)")
    sheet_height_mm: float = Field(gt=0.0, description="Standart plaka eni (mm)")
    kerf_mm: float = Field(ge=0.0, description="Testere veya CNC çakı talaş payı (mm)")
    total_sheets: int = Field(ge=1, description="Harcanan toplam plaka sayısı")
    overall_efficiency_percentage: float = Field(
        ge=0.0, le=100.0, description="Genel plaka verimlilik oranı (%)"
    )
    overall_waste_percentage: float = Field(
        ge=0.0, le=100.0, description="Genel fire oranı (%)"
    )
    reusable_remnant_area_m2: float = Field(
        default=0.0,
        ge=0.0,
        description="Stoka geri kazanılan kullanılabilir artık plaka alanı (m²)",
    )
    effective_waste_percentage: float = Field(
        default=0.0,
        ge=0.0,
        le=100.0,
        description="Kullanılabilir artıklar düşüldükten sonraki gerçek net fire oranı (%)",
    )
    remnants: list[RemnantStockItem] = Field(
        default_factory=list,
        description="Tüm plakalardan çıkan stoka alınabilir artık levhalar",
    )
    sheets: list[SheetLayout] = Field(description="Plaka bazlı yerleşim planları")
    combined_svg: str = Field(description="Tüm plakaları içeren birleşik SVG şeması")


class ParsePromptRequest(BaseModel):
    """Doğal dil isteminden dolap konfigürasyonu çıkarma isteği."""

    model_config = ConfigDict(extra="forbid")

    prompt: str = Field(
        min_length=5,
        max_length=2000,
        description="Kullanıcının doğal dildeki dolap tarifi",
    )


class ParseSketchRequest(BaseModel):
    """Eskiz veya çizim fotoğrafından dolap konfigürasyonu çıkarma isteği."""

    model_config = ConfigDict(extra="forbid")

    image_base64: str = Field(description="Base64 kodlanmış görsel verisi (JPEG/PNG/WEBP)")
    mime_type: str = Field(default="image/jpeg", description="Görsel MIME türü")
    prompt: str = Field(
        default="",
        max_length=2000,
        description="Görsele eşlik eden ek kullanıcı notu veya istem",
    )


class ProductionPackageResponse(BaseModel):
    """Tam üretim paketi yanıt şeması."""

    model_config = ConfigDict(extra="forbid")

    job_id: str = Field(description="Üretim paketi benzersiz kimliği")
    config: CabinetConfig = Field(description="Doğrulanmış dolap konfigürasyonu")
    bom: BOMReport = Field(description="Malzeme, kesim ve delik raporu")
    nesting: NestingResult = Field(description="Kesim optimizasyonu ve SVG şeması")
    glb_base64: str = Field(description="Base64 kodlu GLB 3D katı model verisi")
    dxf_filenames: list[str] = Field(description="Üretilen CNC DXF dosya adları")
    cix_filenames: list[str] = Field(
        default_factory=list, description="Üretilen Biesse .cix dosya adları"
    )
    zip_download_url: str = Field(description="Üretim paketi ZIP indirme adresi")

