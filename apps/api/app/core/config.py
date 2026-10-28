"""Uygulama konfigürasyonu ve fabrika üretim sabitleri (Hard Constraints).

Bu modül, docs/02_MANUFACTURING_AND_CAD_RULES.md belgesindeki değişmez
ahşap işleme ve CNC üretim kurallarını barındırır.
"""

import os
from functools import lru_cache
from pathlib import Path
from typing import Final

from pydantic_settings import BaseSettings, SettingsConfigDict


class ManufacturingConstants:
    """Fabrika üretim ve ahşap işleme değişmez sabitleri (mm cinsinden)."""

    # Malzeme kalınlıkları (mm)
    BODY_THICKNESS_MM: Final[float] = 18.0
    BACK_PANEL_GROOVED_THICKNESS_MM: Final[float] = 8.0
    BACK_PANEL_NAILED_THICKNESS_MM: Final[float] = 3.0

    # Plaka ve testere standartları (mm)
    STANDARD_SHEET_2800_2100: Final[tuple[float, float]] = (2800.0, 2100.0)
    STANDARD_SHEET_3660_1830: Final[tuple[float, float]] = (3660.0, 1830.0)
    SHEET_TRIM_MARGIN_MM: Final[float] = 10.0  # Her kenardan 10 mm temizlik payı
    SAW_KERF_MM: Final[float] = 4.0  # Testere talaş payı

    # Kenar Bandı (PVC) kuralları (mm)
    PVC_IGNORE_THRESHOLD_MM: Final[float] = 1.0  # 0.4 mm PVC düşümden ihmal edilir

    # 8 mm Kanal İçi Arkalık Kuralları (mm)
    BACK_GROOVE_OFFSET_FROM_REAR_MM: Final[float] = 10.0
    BACK_GROOVE_WIDTH_MM: Final[float] = 8.5
    BACK_GROOVE_DEPTH_MM: Final[float] = 8.0
    BACK_PANEL_INSERTION_PER_SIDE_MM: Final[float] = 7.5  # Toplam +15 mm

    # Hareketli Raf Toleransları (mm)
    SHELF_WIDTH_CLEARANCE_MM: Final[float] = 2.0  # Sağ 1 mm + Sol 1 mm boşluk
    SHELF_FRONT_SETBACK_MM: Final[float] = 20.0  # Ön kenardan içeri çekilme

    # Kapak Fuga (Boşluk) Kuralları (mm)
    DOOR_OUTER_GAP_MM: Final[float] = 2.0  # Dış kenarlardan boşluk
    DOOR_CENTER_GAP_MM: Final[float] = 2.0  # Çift kapak orta boşluk

    # Sistem 32 ve CNC Delik Standartları (mm)
    SYSTEM_32_PITCH_MM: Final[float] = 32.0
    MINIFIX_CAM_DIAMETER_MM: Final[float] = 15.0
    MINIFIX_CAM_DEPTH_MM: Final[float] = 13.5
    MINIFIX_CAM_CENTER_FROM_EDGE_MM: Final[float] = 34.0
    MINIFIX_BOLT_DIAMETER_MM: Final[float] = 8.0
    MINIFIX_BOLT_DEPTH_MM: Final[float] = 11.0
    DOWEL_DIAMETER_MM: Final[float] = 8.0
    DOWEL_DEPTH_MM: Final[float] = 12.0
    DOWEL_OFFSET_FROM_MINIFIX_MM: Final[float] = 32.0

    # Raf Pimi Delikleri (mm)
    SHELF_PIN_DIAMETER_MM: Final[float] = 5.0
    SHELF_PIN_DEPTH_MM: Final[float] = 12.0
    SHELF_PIN_FRONT_OFFSET_MM: Final[float] = 37.0
    SHELF_PIN_REAR_OFFSET_MM: Final[float] = 50.0

    # Tas Menteşe (35 mm) Kuralları (mm)
    HINGE_CUP_DIAMETER_MM: Final[float] = 35.0
    HINGE_CUP_DEPTH_MM: Final[float] = 13.0
    HINGE_CUP_CENTER_FROM_EDGE_MM: Final[float] = 22.5
    HINGE_EDGE_OFFSET_TOP_BOTTOM_MM: Final[float] = 100.0

    # Çekmece Kasa ve Teleskopik/Frenli Ray Kuralları (mm)
    DRAWER_SLIDE_CLEARANCE_TOTAL_MM: Final[float] = 26.0  # Sağ 13 mm + Sol 13 mm
    DRAWER_BOX_HEIGHT_REDUCTION_MM: Final[float] = 45.0   # Klapa yüksekliğinden düşüm
    DRAWER_SLIDE_SIZES_MM: Final[tuple[float, ...]] = (
        250.0,
        300.0,
        350.0,
        400.0,
        450.0,
        500.0,
        550.0,
    )
    DRAWER_SLIDE_HOLE_DIAMETER_MM: Final[float] = 5.0
    DRAWER_SLIDE_HOLE_DEPTH_MM: Final[float] = 12.0

    # Lamello Cabineo 12 (Saf Dikey Z-Ekseni 3-Eksen Nesting CNC Bağlantısı)
    CABINEO_POCKET_DIAMETER_MM: Final[float] = 15.0
    CABINEO_POCKET_DEPTH_MM: Final[float] = 10.8
    CABINEO_POCKET_OFFSET_FROM_EDGE_MM: Final[float] = 16.0
    CABINEO_SCREW_DIAMETER_MM: Final[float] = 5.0
    CABINEO_SCREW_DEPTH_MM: Final[float] = 12.0

    # CNC Router Nesting Çakı Çapı ve Artık Plaka (Remnant) Eşik Değerleri
    CNC_ROUTER_BIT_DIAMETER_MM: Final[float] = 10.0
    REMNANT_MIN_DIM_SHORT_MM: Final[float] = 400.0
    REMNANT_MIN_DIM_LONG_MM: Final[float] = 600.0

    # DXF Katman İsimleri (R2010)
    LAYER_OUTLINE: Final[str] = "OUTLINE_CUT"
    LAYER_NOTCH_CUT: Final[str] = "OUTLINE_NOTCH_CUT"
    LAYER_GROOVE_BACK: Final[str] = "GROOVE_BACK_8MM"
    LAYER_MINIFIX_CAM: Final[str] = "DRILL_MINIFIX_CAM_D15"
    LAYER_MINIFIX_BOLT: Final[str] = "DRILL_MINIFIX_BOLT_D8"
    LAYER_DOWEL: Final[str] = "DRILL_DOWEL_D8"
    LAYER_CABINEO_POCKET: Final[str] = "LAYER_CABINEO_POCKET_Z108"
    LAYER_CABINEO_SCREW: Final[str] = "DRILL_CABINEO_SCREW_D5"
    LAYER_SHELF_PIN: Final[str] = "DRILL_SHELF_PIN_D5"
    LAYER_HINGE_CUP: Final[str] = "DRILL_HINGE_CUP_D35"
    LAYER_DRAWER_SLIDE: Final[str] = "DRILL_SLIDE_D5"


class Settings(BaseSettings):
    """Ortam değişkenlerinden (.env) okunan uygulama ayarları."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    artifacts_dir: str = (
        "/tmp/marangoz_artifacts"
        if os.environ.get("VERCEL")
        else str(Path(__file__).resolve().parents[2] / "artifacts")
    )

    @property
    def cors_origin_list(self) -> list[str]:
        """Virgülle ayrılmış CORS adreslerini liste olarak döndürür."""
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Önbelleğe alınmış Settings nesnesini döndürür."""
    return Settings()

