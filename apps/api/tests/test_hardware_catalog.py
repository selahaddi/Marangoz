"""Häfele, Blum, Samet ve Donanım Kataloğu Testleri.
Marka bazlı hırdavat seçimi ve BOM entegrasyonunu doğrular.
"""

from app.core.hardware_catalog import (
    HARDWARE_CATALOG,
    HardwareBrand,
    HardwareCategory,
    get_hardware_by_brand,
    get_hardware_by_category,
    get_hardware_catalog_item,
)
from app.engines.bom_engine import BOMEngine
from app.schemas.cabinet import CabinetConfig, CabinetType, DoorType


def test_hardware_catalog_structure_and_lookups():
    """Katalog veri bütünlüğünü ve filtreleme fonksiyonlarını test eder."""
    assert len(HARDWARE_CATALOG) >= 15

    # Marka filtreleri
    blum_items = get_hardware_by_brand(HardwareBrand.BLUM)
    assert len(blum_items) >= 4
    for item in blum_items:
        assert item.brand == HardwareBrand.BLUM
        assert item.unit_price_tl > 0

    hafele_items = get_hardware_by_brand(HardwareBrand.HAFELE)
    assert len(hafele_items) >= 4

    samet_items = get_hardware_by_brand(HardwareBrand.SAMET)
    assert len(samet_items) >= 4

    # Kategori filtreleri
    drawers = get_hardware_by_category(HardwareCategory.DRAWER_SYSTEM)
    assert len(drawers) >= 6

    hinges = get_hardware_by_category(HardwareCategory.HINGE)
    assert len(hinges) >= 5

    # Tekil ürün sorgusu
    antaro = get_hardware_catalog_item("BLM-TNDM-ANT-500")
    assert antaro is not None
    assert "Tandembox" in antaro.name
    assert antaro.unit_price_tl == 950.0


def test_bom_hardware_brand_integration():
    """Dolap konfigürasyonunda marka seçildiğinde BOM'un ilgili hırdavatları üretmesini test eder."""
    base_config = {
        "name": "Mutfak Alt Dolabı",
        "cabinet_type": CabinetType.KITCHEN_BASE,
        "width_mm": 900.0,
        "height_mm": 860.0,
        "depth_mm": 580.0,
        "shelf_count": 1,
        "door_type": DoorType.DOUBLE,
        "drawer_count": 2,
        "drawer_front_height_mm": 180.0,
        "has_plinth": True,
        "plinth_height_mm": 100.0,
        "body_material": "Suntalam",
        "front_pvc_thickness_mm": 1.0,
        "hidden_pvc_thickness_mm": 0.4,
    }

    # 1. Blum Donanım Testi
    blum_cfg = CabinetConfig(**base_config, hardware_brand="blum")
    bom_blum = BOMEngine.generate_bom(blum_cfg)
    blum_codes = [h.code for h in bom_blum.hardware]
    assert "BLM-TNDM-ANT-500" in blum_codes
    assert "BLM-CLIP-110" in blum_codes

    # 2. Häfele Donanım Testi
    hafele_cfg = CabinetConfig(**base_config, hardware_brand="hafele")
    bom_hafele = BOMEngine.generate_bom(hafele_cfg)
    hafele_codes = [h.code for h in bom_hafele.hardware]
    assert "HAF-MTX-P-500" in hafele_codes
    assert "HAF-MET-110" in hafele_codes

    # 3. Samet Donanım Testi
    samet_cfg = CabinetConfig(**base_config, hardware_brand="samet")
    bom_samet = BOMEngine.generate_bom(samet_cfg)
    samet_codes = [h.code for h in bom_samet.hardware]
    assert "SMT-FLW-500" in samet_codes
    assert "SMT-MSTR-110" in samet_codes

    # 4. Gola Kulp Profili Testi
    gola_cfg = CabinetConfig(**base_config, handle_type="profile_l_gola")
    bom_gola = BOMEngine.generate_bom(gola_cfg)
    gola_codes = [h.code for h in bom_gola.hardware]
    assert "PRF-GOLA-L" in gola_codes

