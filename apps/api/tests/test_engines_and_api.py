"""Marangoz Mühendislik Motorları ve FastAPI Entegrasyon Testleri."""

import io
import zipfile

import ezdxf
from fastapi.testclient import TestClient

from app.core.config import ManufacturingConstants as MC
from app.engines.bom_engine import BOMEngine
from app.engines.cnc_post_engine import CNCPostProcessorEngine
from app.engines.dxf_engine import DXFProductionEngine
from app.engines.geometry_engine import CabinetGeometryEngine
from app.engines.nesting_engine import NestingEngine
from app.engines.parser_engine import SemanticParserEngine
from app.main import app
from app.schemas.cabinet import (
    BackPanelType,
    CabinetConfig,
    DoorType,
    EdgeBandSpec,
    SheetSizeOption,
)

client = TestClient(app)


def test_pvc_deduction_rules() -> None:
    """0.4 mm PVC'nin ihmal edildiğini, 1.0 ve 2.0 mm PVC'nin kesim ölçüsünden düşüldüğünü doğrular."""
    edge_spec = EdgeBandSpec(
        length_1_mm=2.0,  # Ön kenar 2.0 mm -> 2.0 mm düşülür
        length_2_mm=0.4,  # Arka kenar 0.4 mm -> 0.0 mm düşülür (ihmal)
        width_1_mm=1.0,   # Üst kenar 1.0 mm -> 1.0 mm düşülür
        width_2_mm=0.4,   # Alt kenar 0.4 mm -> 0.0 mm düşülür (ihmal)
    )
    cut_l, cut_w, ded_l, ded_w = BOMEngine.compute_cut_dimensions(
        net_length_mm=2100.0, net_width_mm=580.0, edge_band=edge_spec
    )
    assert ded_l == 1.0
    assert ded_w == 2.0
    assert cut_l == 2099.0
    assert cut_w == 578.0


def test_bom_engine_calculations() -> None:
    """Standart 900x2100x580 gardırop için parça, arkalık kanalı ve kapak ölçülerini doğrular."""
    config = CabinetConfig(
        width_mm=900.0,
        height_mm=2100.0,
        depth_mm=580.0,
        shelf_count=4,
        door_type=DoorType.DOUBLE,
        has_plinth=True,
        plinth_height_mm=80.0,
        front_pvc_thickness_mm=2.0,
        hidden_pvc_thickness_mm=0.4,
        back_panel_type=BackPanelType.GROOVED_8MM,
    )
    bom = BOMEngine.generate_bom(config)

    parts_by_code = {p.code: p for p in bom.parts}
    assert "YAN_SOL" in parts_by_code
    assert "YAN_SAG" in parts_by_code
    assert "TABLA_UST" in parts_by_code
    assert "TABLA_ALT" in parts_by_code
    assert "ARKALIK" in parts_by_code
    assert "KAPAK_SOL" in parts_by_code
    assert "KAPAK_SAG" in parts_by_code

    # Yan dikme: Net 2100x580, ön kenar 2.0 mm PVC -> Kesim 2100x578 mm
    yan_sol = parts_by_code["YAN_SOL"]
    assert yan_sol.net_length_mm == 2100.0
    assert yan_sol.net_width_mm == 580.0
    assert yan_sol.cut_length_mm == 2100.0
    assert yan_sol.cut_width_mm == 578.0
    assert len(yan_sol.grooves) == 1
    assert yan_sol.grooves[0].layer == MC.LAYER_GROOVE_BACK

    # Üst tabla: İç genişlik = 900 - 2*18 = 864 mm
    tabla_ust = parts_by_code["TABLA_UST"]
    assert tabla_ust.net_length_mm == 864.0
    assert tabla_ust.cut_length_mm == 864.0
    assert tabla_ust.cut_width_mm == 578.0

    # 8 mm Arkalık: İç genişlik (864) + 15 = 879 mm; İç yükseklik (2100 - 80 - 36 = 1984) + 15 = 1999 mm
    arkalik = parts_by_code["ARKALIK"]
    assert arkalik.thickness_mm == 8.0
    assert arkalik.net_width_mm == 879.0
    assert arkalik.net_length_mm == 1999.0

    # Çift kapak: Her biri 4 kenar 2.0 mm PVC -> boydan 4 mm, enden 4 mm PVC düşümü
    kapak_sol = parts_by_code["KAPAK_SOL"]
    assert kapak_sol.pvc_deduction_length_mm == 4.0
    assert kapak_sol.pvc_deduction_width_mm == 4.0
    assert len(kapak_sol.drills) == 4  # 2016 mm kapak yüksekliği için 4 adet Ø35 mm tas menteşe


def test_dxf_r2010_and_glb_generation() -> None:
    """DXF R2010 katmanlarının ve 3D GLB modelinin hatasız üretildiğini doğrular."""
    config = CabinetConfig()
    bom = BOMEngine.generate_bom(config)

    # GLB testi
    glb_bytes = CabinetGeometryEngine.generate_glb_bytes(bom)
    assert len(glb_bytes) > 500
    assert glb_bytes[:4] == b"glTF"

    # DXF R2010 testi
    side_part = bom.parts[0]
    dxf_str = DXFProductionEngine.export_part_dxf_string(side_part)
    doc = ezdxf.read(io.StringIO(dxf_str))
    assert doc.dxfversion == "AC1024"  # AutoCAD 2010 (R2010)
    assert MC.LAYER_OUTLINE in doc.layers
    assert MC.LAYER_GROOVE_BACK in doc.layers
    assert MC.LAYER_SHELF_PIN in doc.layers


def test_nesting_engine_and_svg() -> None:
    """Giyotin kesim optimizasyonunun tüm parçaları yerleştirdiğini ve SVG ürettiğini doğrular."""
    config = CabinetConfig(sheet_size=SheetSizeOption.SHEET_2800_2100)
    bom = BOMEngine.generate_bom(config)
    nesting = NestingEngine.run_nesting(bom)

    assert nesting.total_sheets >= 2  # 18mm gövde plakası + 8mm arkalık plakası
    total_placed = sum(len(s.placements) for s in nesting.sheets)
    assert total_placed == bom.total_parts_count
    assert "<svg" in nesting.combined_svg


def test_semantic_parser_and_fastapi_endpoints() -> None:
    """Doğal dil ayrıştırma ve tam üretim paketi API uç noktalarını test eder."""
    health_res = client.get("/api/v1/healthz")
    assert health_res.status_code == 200
    assert health_res.json()["success"] is True

    prompt_text = (
        "220 cm yüksekliğinde, 100 cm genişliğinde, 60 cm derinliğinde, "
        "5 raflı, çift kapaklı, antrasit gövdeli gardırop"
    )
    parse_res = client.post("/api/v1/parse", json={"prompt": prompt_text})
    assert parse_res.status_code == 200
    parsed_json = parse_res.json()
    assert parsed_json["success"] is True
    cfg_data = parsed_json["data"]
    assert cfg_data["height_mm"] == 2200.0
    assert cfg_data["width_mm"] == 1000.0
    assert cfg_data["depth_mm"] == 600.0
    assert cfg_data["shelf_count"] == 5
    assert cfg_data["door_type"] == "double"

    gen_res = client.post("/api/v1/generate", json=cfg_data)
    assert gen_res.status_code == 200
    gen_json = gen_res.json()
    assert gen_json["success"] is True
    pkg = gen_json["data"]
    assert len(pkg["dxf_filenames"]) == pkg["bom"]["total_parts_count"]

    # ZIP indirme testi
    zip_res = client.get(pkg["zip_download_url"])
    assert zip_res.status_code == 200
    with zipfile.ZipFile(io.BytesIO(zip_res.content), "r") as zf:
        names = zf.namelist()
        assert "3d_model/cabinet_model.glb" in names
        assert "bom/kesim_ve_malzeme_listesi.csv" in names
        assert any(n.startswith("cnc_dxf/") and n.endswith(".dxf") for n in names)
        assert any(n.startswith("cnc_gcode/") and n.endswith(".nc") for n in names)
        assert any(n.startswith("cnc_mpr/") and n.endswith(".mpr") for n in names)
        assert any(n.startswith("nesting/") and n.endswith(".svg") for n in names)


def test_drawer_box_and_multi_module_room_line() -> None:
    """Çekmece kasası, teleskopik ray delikleri, çoklu modül oda hattı ve CNC post-processor'ü doğrular."""
    mod1 = CabinetConfig(
        name="Sol Gardırop",
        width_mm=900.0,
        height_mm=2100.0,
        depth_mm=580.0,
        shelf_count=3,
        drawer_count=2,
        drawer_front_height_mm=180.0,
        door_type=DoorType.DOUBLE,
        additional_modules=[
            CabinetConfig(
                name="Sağ Çekmeceli Modül",
                width_mm=600.0,
                height_mm=2100.0,
                depth_mm=580.0,
                shelf_count=4,
                drawer_count=3,
                drawer_front_height_mm=180.0,
                door_type=DoorType.SINGLE_RIGHT,
            )
        ],
    )
    bom = BOMEngine.generate_bom(mod1)

    codes = [p.code for p in bom.parts]
    assert "M1_YAN_SOL" in codes
    assert "M1_CEK_KLAPA_01" in codes
    assert "M2_YAN_SAG" in codes
    assert "M2_CEK_KLAPA_03" in codes

    # Ray montaj delikleri kontrolü
    m1_yan = next(p for p in bom.parts if p.code == "M1_YAN_SOL")
    slide_drills = [d for d in m1_yan.drills if d.layer == MC.LAYER_DRAWER_SLIDE]
    assert len(slide_drills) == 6  # 2 çekmece x 3 delik

    # G-Code ve WoodWOP MPR üretimi kontrolü
    gcode_str = CNCPostProcessorEngine.export_part_gcode_string(m1_yan)
    mpr_str = CNCPostProcessorEngine.export_part_mpr_string(m1_yan)
    assert "G21 G90" in gcode_str
    assert "G81" in gcode_str
    assert "<100 \\WerkStck\\" in mpr_str
    assert "<102 \\BohrVert\\" in mpr_str


def test_refrigerator_enclosure_niche_and_flap_door() -> None:
    """Buzdolabı çevreleme modülünde 1850mm açık alt niş, üst kalkar kapak ve gazlı piston hesabını doğrular."""
    fridge_prompt = (
        "Mutfakta solo buzdolabımızın etrafını saracak bir buzdolabı çevreleme (gömme) dolap modülü "
        "tasarlamak istiyorum. Dolabın toplam dış ölçüleri: Yükseklik 235 cm, genişlik 85 cm, "
        "derinlik 65 cm olsun. Alt kısımda buzdolabının rahat oturması ve hava sirkülasyonu için net "
        "80 cm genişliğinde ve 185 cm yüksekliğinde açık bir niş (boşluk) bırakılsın; buzdolabının "
        "arkasına arkalık konmasın, açık kalsın. Buzdolabının üstünde kalan boşluğa ise yukarı doğru "
        "açılan (gazlı pistonlu) tek parça kalkar kapaklı derin bir üst depolama dolabı yerleştirilsin. "
        "Yan dikmeler tavandan tabana kadar yekpare 18 mm gövde malzemesi olarak insin. Gövde 18 mm "
        "beyaz suntalam, üst kapak 18 mm meşe desen MDF-Lam olsun. Üst dolabın arkalığı 8 mm kanala "
        "geçme yapılsın. Birleşimler minifix ve kavela ile System 32 standardında delinsin."
    )
    cfg = SemanticParserEngine._deterministic_rule_parse(fridge_prompt)
    assert cfg.width_mm == 850.0
    assert cfg.height_mm == 2350.0
    assert cfg.depth_mm == 650.0
    assert cfg.appliance_niche_height_mm == 1850.0
    assert cfg.has_plinth is False
    assert cfg.door_type == DoorType.FLAP_UP
    assert cfg.shelf_count == 0
    assert cfg.body_material == "18mm Beyaz Suntalam"
    assert cfg.door_material == "18mm Doğal Meşe MDF-Lam"

    bom = BOMEngine.generate_bom(cfg)
    assert bom.total_parts_count == 6
    parts_by_code = {p.code: p for p in bom.parts}
    assert set(parts_by_code.keys()) == {
        "YAN_SOL",
        "YAN_SAG",
        "TABLA_UST",
        "TABLA_ALT",
        "ARKALIK",
        "KAPAK_KALKAR",
    }

    # Alt tabla nişin hemen üstünde (Y = 1850 + 9 = 1859 mm) yer almalı
    assert parts_by_code["TABLA_ALT"].transform_3d.center_y_mm == 1859.0
    # Arkalık yalnızca üst dolabı (2350 - 1850 - 36 + 15 = 479 mm) kapatmalı
    assert parts_by_code["ARKALIK"].net_length_mm == 479.0
    assert parts_by_code["ARKALIK"].net_width_mm == 829.0
    # Üst kalkar kapak 496 x 846 mm (kesim 492 x 842 mm) ve üstten menteşeli olmalı
    kapak = parts_by_code["KAPAK_KALKAR"]
    assert kapak.net_length_mm == 496.0
    assert kapak.net_width_mm == 846.0
    assert kapak.cut_length_mm == 492.0
    assert kapak.cut_width_mm == 842.0
    assert kapak.transform_3d.hinge_side == "top"
    assert kapak.material == "18mm Doğal Meşe MDF-Lam"
    assert any(h.code == "HRD-PSTN-100" and h.quantity == 2 for h in bom.hardware)


