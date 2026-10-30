"""Atölye İmalat ve Montaj Şeması (Shop Drawing) Motoru Testleri."""

from app.engines.bom_engine import BOMEngine
from app.engines.shop_drawing_engine import ShopDrawingEngine
from app.schemas.cabinet import CabinetConfig, CabinetType, DoorType


def test_shop_drawing_svg_generation():
    """BOM'dan 2D SVG montaj şeması üretilmesini ve kritik teknik resim elemanlarını doğrular."""
    config = CabinetConfig(
        name="Gardırop İmalat Şeması",
        cabinet_type=CabinetType.WARDROBE,
        width_mm=1000.0,
        height_mm=2100.0,
        depth_mm=600.0,
        shelf_count=3,
        door_type=DoorType.DOUBLE,
        drawer_count=2,
        drawer_front_height_mm=180.0,
        has_plinth=True,
        plinth_height_mm=100.0,
        has_baseboard_notch=True,
        baseboard_notch_height_mm=80.0,
        baseboard_notch_depth_mm=15.0,
        body_material="18mm Beyaz Suntalam",
        front_pvc_thickness_mm=1.0,
        hidden_pvc_thickness_mm=0.4,
    )

    bom = BOMEngine.generate_bom(config)
    svg = ShopDrawingEngine.generate_svg(bom)

    assert svg.startswith("<svg")
    assert svg.endswith("</svg>")
    assert 'viewBox="0 0 1600 1000"' in svg
    assert "ÖN GÖRÜNÜŞ" in svg
    assert "YAN KESİT GÖRÜNÜŞÜ" in svg
    assert "G: 1000 mm" in svg
    assert "Y: 2100 mm" in svg
    assert "D: 600 mm" in svg
    assert "SÜPÜRGELİK KERTME" in svg
    assert "ARKALIK KANALI" in svg
    assert "BAZA (100 mm)" in svg
    assert "KRİTİK İMALAT" in svg

