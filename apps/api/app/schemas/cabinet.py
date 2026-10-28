"""Parametrik dolap tasarımı, BOM, CNC delik ve Nesting Pydantic V2 şemaları."""

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
    additional_modules: list["CabinetConfig"] = Field(
        default_factory=list,
        description="Çoklu modül / oda hattı içindeki yan yana ek modüller",
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

        if self.appliance_niche_height_mm > 0.0:
            self.has_plinth = False
            self.plinth_height_mm = 0.0
            if self.appliance_niche_height_mm > self.height_mm - 200.0:
                self.appliance_niche_height_mm = max(0.0, self.height_mm - 350.0)

        if self.height_mm - self.plinth_height_mm < 200.0:
            raise ValueError(
                "Gövde net yüksekliği (toplam yükseklik - baza) en az 200 mm olmalıdır."
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
    hinge_side: str | None = Field(
        default=None, description="Kapak menteşe yönü (left / right / None)"
    )
    module_index: int = Field(
        default=1, ge=1, description="Çoklu modül hattındaki modül sıra numarası"
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
    transform_3d: Box3DTransform = Field(description="3D sahne yerleşim verisi")


class HardwareItem(BaseModel):
    """Bağlantı elemanı ve aksesuar kalemi."""

    model_config = ConfigDict(extra="forbid")

    code: str = Field(description="Hırdavat stok kodu")
    name: str = Field(description="Hırdavat adı")
    unit: str = Field(description="Birim (Adet, Metre, Takım)")
    quantity: float = Field(ge=0.0, description="Miktar")
    note: str = Field(default="", description="Montaj açıklaması")


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
    kerf_mm: float = Field(ge=0.0, description="Testere talaş payı (mm)")
    used_area_m2: float = Field(ge=0.0, description="Kullanılan parça alanı (m²)")
    waste_area_m2: float = Field(ge=0.0, description="Fire alanı (m²)")
    waste_percentage: float = Field(ge=0.0, le=100.0, description="Fire yüzdesi (%)")
    placements: list[NestedPartPlacement] = Field(description="Yerleşen parçalar")
    svg_content: str = Field(description="Bu plakaya ait ölçekli SVG kesim şeması")


class NestingResult(BaseModel):
    """Tüm plakaların kesim optimizasyonu (Nesting) sonucu."""

    model_config = ConfigDict(extra="forbid")

    sheet_width_mm: float = Field(gt=0.0, description="Standart plaka boyu (mm)")
    sheet_height_mm: float = Field(gt=0.0, description="Standart plaka eni (mm)")
    kerf_mm: float = Field(ge=0.0, description="Testere talaş payı (mm)")
    total_sheets: int = Field(ge=1, description="Harcanan toplam plaka sayısı")
    overall_efficiency_percentage: float = Field(
        ge=0.0, le=100.0, description="Genel plaka verimlilik oranı (%)"
    )
    overall_waste_percentage: float = Field(
        ge=0.0, le=100.0, description="Genel fire oranı (%)"
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


class ProductionPackageResponse(BaseModel):
    """Tam üretim paketi yanıt şeması."""

    model_config = ConfigDict(extra="forbid")

    job_id: str = Field(description="Üretim paketi benzersiz kimliği")
    config: CabinetConfig = Field(description="Doğrulanmış dolap konfigürasyonu")
    bom: BOMReport = Field(description="Malzeme, kesim ve delik raporu")
    nesting: NestingResult = Field(description="Kesim optimizasyonu ve SVG şeması")
    glb_base64: str = Field(description="Base64 kodlu GLB 3D katı model verisi")
    dxf_filenames: list[str] = Field(description="Üretilen CNC DXF dosya adları")
    zip_download_url: str = Field(description="Üretim paketi ZIP indirme adresi")

