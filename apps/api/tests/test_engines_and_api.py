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
    CabinetType,
    CabinetZone,
    CuttingMode,
    DoorType,
    EdgeBandSpec,
    FastenerType,
    PlinthType,
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


def test_cabineo_3axis_rolove_fillers_and_remnants() -> None:
    """Paket A (Lamello Cabineo + Biesse CIX), Paket B (Kör çıta, süpürgelik kertme, ayarlı ayak) ve Paket C (CNC Router + Remnants) doğrular."""
    cfg = CabinetConfig(
        name="Rölöve Uyumlu 3-Eksen Cabineo Gardırop",
        width_mm=900.0,
        height_mm=2100.0,
        depth_mm=580.0,
        shelf_count=3,
        door_type=DoorType.DOUBLE,
        fastener_type=FastenerType.CABINEO_12,
        cutting_mode=CuttingMode.CNC_ROUTER,
        router_bit_diameter_mm=10.0,
        plinth_type=PlinthType.ADJUSTABLE_LEGS,
        has_plinth=True,
        plinth_height_mm=100.0,
        left_filler_width_mm=40.0,
        right_filler_width_mm=40.0,
        has_baseboard_notch=True,
        has_column_notch=True,
    )
    bom = BOMEngine.generate_bom(cfg)
    parts_by_code = {p.code: p for p in bom.parts}

    # Sol ve sağ rölöve kör çıtaları üretilmiş olmalı
    assert "KOR_CITA_SOL" in parts_by_code
    assert "KOR_CITA_SAG" in parts_by_code
    assert parts_by_code["KOR_CITA_SOL"].net_width_mm == 40.0
    assert parts_by_code["KOR_CITA_SOL"].holding_tabs_count == 4

    # Cabineo 12 cepleri ve hırdavat kalemi kontrolü
    tabla_ust = parts_by_code["TABLA_UST"]
    assert any(d.layer == MC.LAYER_CABINEO_POCKET for d in tabla_ust.drills)
    assert any(h.code == "HRD-CBN-12" for h in bom.hardware)
    assert any(h.code == "HRD-AYK-100" for h in bom.hardware)

    # Süpürgelik ve kolon kertme bilgileri
    assert "Süpürgelik" in parts_by_code["YAN_SOL"].notch_info
    assert "Kolon" in parts_by_code["TABLA_UST"].notch_info

    # Biesse .cix post-processor kontrolü
    cix_str = CNCPostProcessorEngine.export_part_cix_string(tabla_ust)
    assert "BEGIN ID CID3" in cix_str
    assert "NAME=BG" in cix_str

    # CNC Router Nesting (10 mm çakı payı) ve Remnant (Artık Levha >= 400x600 mm) kontrolü
    nesting = NestingEngine.run_nesting(bom)
    assert nesting.kerf_mm == 10.0
    assert len(nesting.remnants) >= 1
    assert nesting.reusable_remnant_area_m2 > 0.0
    assert "ARTIK DEPO" in nesting.combined_svg


def test_parse_sketch_api_and_router_true_shape_nesting() -> None:
    """Multimodal Vision eskiz API ucunu (/api/v1/parse_sketch) ve True-Shape L-Kertme SVG etiketlerini doğrular."""
    from fastapi.testclient import TestClient
    from app.main import app
    import base64

    client = TestClient(app)

    # 1. /api/v1/parse_sketch uç noktası testi
    dummy_svg = b'<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>'
    dummy_b64 = base64.b64encode(dummy_svg).decode("ascii")

    resp = client.post(
        "/api/v1/parse_sketch",
        json={
            "image_base64": dummy_b64,
            "mime_type": "image/svg+xml",
            "prompt": "90 cm genisliginde, 210 cm yuksekliginde gardırop",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["width_mm"] == 900.0
    assert data["data"]["height_mm"] == 2100.0

    # 2. True-Shape L-Kertmeli CNC Router Nesting doğrulaması
    cfg = CabinetConfig(
        name="L-Kertmeli Router Test Dolabi",
        width_mm=800.0,
        height_mm=2000.0,
        depth_mm=550.0,
        shelf_count=2,
        door_type=DoorType.DOUBLE,
        cutting_mode=CuttingMode.CNC_ROUTER,
        router_bit_diameter_mm=10.0,
        has_baseboard_notch=True,
        baseboard_notch_height_mm=80.0,
        baseboard_notch_depth_mm=15.0,
    )
    bom = BOMEngine.generate_bom(cfg)
    nesting = NestingEngine.run_nesting(bom)

    # Nesting placements içerisinde notch_info ve is_true_shape alanlarının doluluğu
    notched_placements = [
        p for sheet in nesting.sheets for p in sheet.placements if p.is_true_shape
    ]
    assert len(notched_placements) >= 2
    assert any("[L-KERTME]" in nesting.combined_svg for sheet in nesting.sheets)


def test_cabinet_zones_and_vertical_dividers() -> None:
    """Faz 1 İç Bölme & Dikme Motoru: Çoklu bölme, ara dikme, askılık ve bağımsız kapak/çekmeceleri doğrular."""
    cfg = CabinetConfig(
        name="2 Bölmeli Gardırop (Sol Raflı, Sağ Askılı ve Çekmeceli)",
        width_mm=1600.0,
        height_mm=2200.0,
        depth_mm=600.0,
        zones=[
            CabinetZone(
                name="Sol Bölme",
                width_ratio=1.0,
                shelf_count=4,
                drawer_count=0,
                has_hanging_rod=False,
                door_type=DoorType.SINGLE_LEFT,
            ),
            CabinetZone(
                name="Sağ Bölme",
                width_ratio=1.0,
                shelf_count=0,
                drawer_count=2,
                has_hanging_rod=True,
                door_type=DoorType.SINGLE_RIGHT,
            ),
        ],
    )

    bom = BOMEngine.generate_bom(cfg)
    part_codes = [p.code for p in bom.parts]

    # 1. İç ara dikme doğrulaması
    assert "DIKME_01" in part_codes
    dikme = next(p for p in bom.parts if p.code == "DIKME_01")
    assert dikme.net_length_mm == 2200.0 - cfg.plinth_height_mm - (2.0 * MC.BODY_THICKNESS_MM)
    assert dikme.thickness_mm == MC.BODY_THICKNESS_MM

    # 2. Sol Bölme (4 adet hareketli raf ve tek sol kapak)
    assert "Z1_RAF_01" in part_codes
    assert "Z1_RAF_04" in part_codes
    assert "Z1_KAPAK_TEK" in part_codes
    sol_kapak = next(p for p in bom.parts if p.code == "Z1_KAPAK_TEK")
    assert sol_kapak.transform_3d.hinge_side == "left"

    # 3. Sağ Bölme (2 adet çekmece, askılık borusu ve tek sağ kapak)
    assert "Z2_CEK_KLAPA_01" in part_codes
    assert "Z2_CEK_KLAPA_02" in part_codes
    assert "Z2_ASKILIK" in part_codes
    askilik = next(p for p in bom.parts if p.code == "Z2_ASKILIK")
    assert askilik.transform_3d.is_hanging_rod is True
    assert "Z2_KAPAK_TEK" in part_codes
    sag_kapak = next(p for p in bom.parts if p.code == "Z2_KAPAK_TEK")
    assert sag_kapak.transform_3d.hinge_side == "right"

    # 4. Donanım (Hardware) doğrulaması
    hw_codes = {h.code: h.quantity for h in bom.hardware}
    # Askı borusu ve 2 adet flanş
    assert "HRD-ELB-ASK" in hw_codes
    assert hw_codes["HRD-ELB-ASK"] == 1.0
    assert "HRD-ASK-FLS" in hw_codes
    assert hw_codes["HRD-ASK-FLS"] == 2.0
    # 4 raf x 4 pim = 16 adet pim
    assert "HRD-RAFP-05" in hw_codes
    assert hw_codes["HRD-RAFP-05"] == 16.0
    # 2 çekmece rayı takımı
    assert any("HRD-CRAY" in c for c in hw_codes)


def test_mid_niche_coffee_station_and_appliance_cutouts():
    """Faz 2: Açık Niş, Kahve Barı, Ankastre Fırın ve Parçalı Kapak / Arkalık CAD/CAM Mühendislik Testi."""
    # 1. Tekil Modül Açık Niş (Kahve Barı / Ankastre)
    cfg_coffee = CabinetConfig(
        name="Kahve Köşesi Dolabı",
        cabinet_type=CabinetType.KITCHEN_BASE,
        width_mm=900.0,
        height_mm=2100.0,
        depth_mm=600.0,
        shelf_count=2,
        door_type=DoorType.DOUBLE,
        drawer_count=0,
        has_plinth=True,
        plinth_height_mm=80.0,
        niche_height_mm=500.0,
        niche_bottom_offset_mm=850.0,
        niche_color_hex="#9C6644",
        niche_back_open=True,
    )
    bom_coffee = BOMEngine.generate_bom(cfg_coffee)
    part_codes = [p.code for p in bom_coffee.parts]

    # Niş ara tablaları mevcut olmalı
    assert "TABLA_ARA_NIS_ALT" in part_codes
    assert "TABLA_ARA_NIS_UST" in part_codes

    # Arkalık açık olduğu için ikiye bölünmeli
    assert "ARKALIK_ALT" in part_codes
    assert "ARKALIK_UST" in part_codes
    assert "ARKALIK" not in part_codes

    # Kapaklar niş boşluğunu açık bırakarak alt ve üst olarak ayrılmalı
    assert "KAPAK_ALT_SOL" in part_codes
    assert "KAPAK_ALT_SAG" in part_codes
    assert "KAPAK_UST_SOL" in part_codes
    assert "KAPAK_UST_SAG" in part_codes

    # Niş ara tablası is_niche bayrağını taşımalı
    nis_alt = next(p for p in bom_coffee.parts if p.code == "TABLA_ARA_NIS_ALT")
    assert nis_alt.transform_3d.is_niche is True
    assert nis_alt.transform_3d.color_hex == "#9C6644"

    # Yan dikmelerde niş rafları için Minifix/Dowel veya Cabineo delikleri üretilmeli
    yan_sol = next(p for p in bom_coffee.parts if p.code == "YAN_SOL")
    nis_drills = [d for d in yan_sol.drills if "Niş Ara Tabla" in d.description]
    assert len(nis_drills) > 0

    # 2. Bölme Bazlı Açık Niş (Multi-Zone Niche)
    cfg_zones_niche = CabinetConfig(
        name="2 Bölmeli Ankastre Dolap",
        cabinet_type=CabinetType.WARDROBE,
        width_mm=1600.0,
        height_mm=2200.0,
        depth_mm=600.0,
        zones=[
            CabinetZone(
                name="Ankastre Fırın Bölmesi",
                width_ratio=1.0,
                door_type=DoorType.DOUBLE,
                niche_height_mm=600.0,
                niche_bottom_offset_mm=800.0,
                niche_color_hex="#2D3134",
                niche_back_open=True,
            ),
            CabinetZone(
                name="Kiler Bölmesi",
                width_ratio=1.0,
                shelf_count=4,
                door_type=DoorType.SINGLE_RIGHT,
            ),
        ],
    )
    bom_zones = BOMEngine.generate_bom(cfg_zones_niche)
    z_codes = [p.code for p in bom_zones.parts]

    assert "Z1_TABLA_ARA_NIS_ALT" in z_codes
    assert "Z1_TABLA_ARA_NIS_UST" in z_codes
    assert "Z1_KAPAK_ALT_SOL" in z_codes
    assert "Z1_KAPAK_UST_SOL" in z_codes
    assert "Z2_KAPAK_TEK" in z_codes

    # 3. Doğal Dil Ayrıştırıcısı (Semantic Parser) ile Kahve Barı Tespiti
    prompt = "210 cm boyunda 90 cm genişliğinde kahve köşesi, 50 cm açık nişli ve arkası açık, üst ve alt çift kapaklı"
    parsed_cfg = SemanticParserEngine._deterministic_rule_parse(prompt)
    assert parsed_cfg.height_mm == 2100.0
    assert parsed_cfg.width_mm == 900.0
    assert parsed_cfg.niche_height_mm == 500.0
    assert parsed_cfg.niche_bottom_offset_mm == 850.0
    assert parsed_cfg.niche_back_open is True






