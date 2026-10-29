"""Marangozluk Kural ve Taşıma Kapasitesi Mühendislik Motoru Testleri.
Euler-Bernoulli sehim hesabı, donanım taşıma kapasitesi ve şantiye uyumluluk kurallarını doğrular.
"""

import pytest
from app.engines.bom_engine import BOMEngine
from app.engines.engineering_engine import EngineeringEngine
from app.schemas.cabinet import (
    CabinetConfig,
    CabinetType,
    DoorType,
    FastenerType,
    PanelPart,
    Box3DTransform,
)


def test_euler_bernoulli_shelf_sag_calculation():
    """Geniş raflarda 18 mm suntalam esnemesini ve tolerans kontrolünü test eder."""
    # 1. 950 mm genişliğinde suntalam raf: 25 kg yük altında 2.0 mm sınırını aşmalı
    wide_shelf = EngineeringEngine.calculate_shelf_deflection(
        shelf_id="P-01",
        span_mm=950.0,
        depth_mm=550.0,
        thickness_mm=18.0,
        material="Suntalam Beyaz",
        design_load_kg=25.0,
    )
    assert not wide_shelf.is_acceptable
    assert wide_shelf.deflection_mm > wide_shelf.allowable_deflection_mm
    assert wide_shelf.warning is not None
    assert "esneme sınırını aşıyor" in wide_shelf.warning
    assert wide_shelf.recommendation is not None
    assert "orta dikme" in wide_shelf.recommendation

    # 2. 500 mm genişliğinde suntalam raf: esneme sınırı içinde kalmalı
    narrow_shelf = EngineeringEngine.calculate_shelf_deflection(
        shelf_id="P-02",
        span_mm=500.0,
        depth_mm=550.0,
        thickness_mm=18.0,
        material="Suntalam Beyaz",
        design_load_kg=25.0,
    )
    assert narrow_shelf.is_acceptable
    assert narrow_shelf.deflection_mm <= narrow_shelf.allowable_deflection_mm
    assert narrow_shelf.warning is None

    # 3. 800 mm genişliğinde ve 25 mm kalınlığında kalınlaştırılmış raf: atalet momenti t^3 ile katlanarak güvenli olmalı
    thick_shelf = EngineeringEngine.calculate_shelf_deflection(
        shelf_id="P-03",
        span_mm=800.0,
        depth_mm=550.0,
        thickness_mm=25.0,
        material="Suntalam Beyaz",
        design_load_kg=25.0,
    )
    assert thick_shelf.is_acceptable
    assert thick_shelf.deflection_mm <= thick_shelf.allowable_deflection_mm


def test_door_weight_and_hardware_audit():
    """Kapak ağırlığı, menteşe adedi ve gazlı piston seçimi testleri."""
    # 1. 2100x500x18 mm boy kapak (Ağırlık ~14.2 kg): En az 4 menteşe gerektirir
    door_part = PanelPart(
        part_id="D-01",
        code="KAPAK_SOL",
        name="Sol Boy Kapak",
        material="MDF Lake",
        thickness_mm=18.0,
        quantity=1,
        net_length_mm=2100.0,
        net_width_mm=496.0,
        cut_length_mm=2098.0,
        cut_width_mm=494.0,
        pvc_deduction_length_mm=2.0,
        pvc_deduction_width_mm=2.0,
        area_m2=1.0416,
        edge_band={"length_1_mm": 1.0, "length_2_mm": 1.0, "width_1_mm": 1.0, "width_2_mm": 1.0},
        transform_3d=Box3DTransform(
            center_x_mm=0.0,
            center_y_mm=1000.0,
            center_z_mm=300.0,
            size_x_mm=496.0,
            size_y_mm=2100.0,
            size_z_mm=18.0,
            color_hex="#ffffff",
            is_door=True,
            is_drawer=False,
            hinge_side="left",
            module_index=1,
        ),
        drills=[],
    )

    audit = EngineeringEngine.audit_door_hardware(
        part=door_part,
        door_type=DoorType.SINGLE_LEFT,
        carcass_material="MDF",
    )
    assert audit.weight_kg > 12.0
    assert audit.recommended_hinge_count >= 4

    # 2. Kalkar kapak (flap_up) gazlı piston kuvveti testi
    flap_door_part = PanelPart(
        part_id="D-02",
        code="KAPAK_KALKAR",
        name="Kalkar Üst Kapak",
        material="MDF Lake",
        thickness_mm=18.0,
        quantity=1,
        net_length_mm=400.0,
        net_width_mm=800.0,
        cut_length_mm=398.0,
        cut_width_mm=798.0,
        pvc_deduction_length_mm=2.0,
        pvc_deduction_width_mm=2.0,
        area_m2=0.32,
        edge_band={"length_1_mm": 1.0, "length_2_mm": 1.0, "width_1_mm": 1.0, "width_2_mm": 1.0},
        transform_3d=Box3DTransform(
            center_x_mm=0.0,
            center_y_mm=1500.0,
            center_z_mm=300.0,
            size_x_mm=800.0,
            size_y_mm=400.0,
            size_z_mm=18.0,
            color_hex="#ffffff",
            is_door=True,
            is_drawer=False,
            hinge_side="top",
            module_index=1,
        ),
        drills=[],
    )

    flap_audit = EngineeringEngine.audit_door_hardware(
        part=flap_door_part,
        door_type=DoorType.FLAP_UP,
        carcass_material="MDF",
    )
    assert flap_audit.recommended_gas_piston_n is not None
    assert flap_audit.recommended_gas_piston_n in (80, 100, 120, 150)


def test_site_fitting_and_bom_integration():
    """BOM üretiminde mühendislik denetiminin otomatik üretilmesini ve sağlık skorunu doğrular."""
    # 1000 mm genişliğinde, 4 raflı, kapaklı dolap
    config = CabinetConfig(
        name="Test Gardırop",
        cabinet_type=CabinetType.WARDROBE,
        width_mm=1000.0,
        height_mm=2100.0,
        depth_mm=600.0,
        shelf_count=4,
        door_type=DoorType.DOUBLE,
        drawer_count=0,
        drawer_front_height_mm=180.0,
        has_plinth=True,
        plinth_height_mm=100.0,
        body_material="Suntalam",
        door_material="MDF",
        body_color_hex="#ffffff",
        door_color_hex="#ffffff",
        front_pvc_thickness_mm=1.0,
        hidden_pvc_thickness_mm=0.4,
        back_panel_type="grooved_8mm",
        sheet_size="2800x2100",
        fastener_type=FastenerType.CABINEO_12,
    )

    bom = BOMEngine.generate_bom(config)
    assert bom.engineering_audit is not None
    report = bom.engineering_audit

    # 1000 mm dolabın iç rafları ~964 mm olacağından sehim uyarısı üretilmelidir
    assert len(report.shelf_deflections) > 0
    failed_shelves = [s for s in report.shelf_deflections if not s.is_acceptable]
    assert len(failed_shelves) > 0

    # Sağlık skoru 100'ün altına düşmeli ve kritik uyarı bayrağı kalkmalı
    assert report.overall_health_score < 100
    assert report.has_critical_issues is True
    assert len(report.summary_messages) > 0
