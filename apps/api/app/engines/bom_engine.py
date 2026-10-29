"""Deterministik Malzeme İhtiyaç Planlaması (BOM), PVC Düşümü, Çekmece Kasa,
Çoklu Modül (Oda Hattı) ve Sistem 32 Delik Motoru.

Bu modül, docs/02_MANUFACTURING_AND_CAD_RULES.md ve
docs/05_MULTI_MODULE_ROOMS_DRAWERS_AND_CNC_POST.md içerisindeki tüm kuralları
%100 deterministik Python matematiği ile işletir.
"""

import math

from app.core.config import ManufacturingConstants as MC
from app.schemas.cabinet import (
    BackPanelType,
    BOMReport,
    Box3DTransform,
    CabinetConfig,
    CabinetZone,
    CuttingMode,
    DoorType,
    DrillPoint,
    EdgeBandSpec,
    FastenerType,
    GroovePath,
    HardwareItem,
    PanelPart,
    PlinthType,
)


class BOMEngine:
    """Dolap veya çoklu modül oda hattından kesim listesi, PVC düşümü ve CNC koordinatları üretir."""

    @staticmethod
    def pvc_deduction_for_edge(pvc_thickness_mm: float) -> float:
        """Kenar bandı kalınlığına göre testere kesim ölçüsünden düşülecek payı hesaplar."""
        if pvc_thickness_mm < MC.PVC_IGNORE_THRESHOLD_MM:
            return 0.0
        return round(pvc_thickness_mm, 2)

    @classmethod
    def compute_cut_dimensions(
        cls,
        net_length_mm: float,
        net_width_mm: float,
        edge_band: EdgeBandSpec,
    ) -> tuple[float, float, float, float]:
        """Net ölçülerden ve 4 kenar PVC bilgisinden kesim ölçülerini hesaplar."""
        ded_len = cls.pvc_deduction_for_edge(
            edge_band.width_1_mm
        ) + cls.pvc_deduction_for_edge(edge_band.width_2_mm)
        ded_wid = cls.pvc_deduction_for_edge(
            edge_band.length_1_mm
        ) + cls.pvc_deduction_for_edge(edge_band.length_2_mm)

        cut_length = round(net_length_mm - ded_len, 2)
        cut_width = round(net_width_mm - ded_wid, 2)
        return cut_length, cut_width, round(ded_len, 2), round(ded_wid, 2)

    @staticmethod
    def _connection_depth_coords(depth_mm: float) -> list[float]:
        """Derinlik boyunca Minifiks bağlantı Y koordinatlarını döndürür."""
        front_x = round(depth_mm - 50.0, 2)
        rear_x = 60.0
        if depth_mm >= 500.0:
            mid_x = round(depth_mm / 2.0, 2)
            return [rear_x, mid_x, front_x]
        return [rear_x, front_x]

    @staticmethod
    def _hinge_count_for_height(door_height_mm: float) -> int:
        """Kapak yüksekliğine göre endüstriyel tas menteşe sayısını belirler."""
        if door_height_mm <= 900.0:
            return 2
        if door_height_mm <= 1600.0:
            return 3
        if door_height_mm <= 2100.0:
            return 4
        return 5

    @staticmethod
    def select_drawer_slide_length(depth_mm: float) -> float:
        """Gövde derinliğine uygun en büyük standart teleskopik/frenli ray boyunu seçer."""
        max_allowed = depth_mm - 40.0
        chosen = 250.0
        for size in MC.DRAWER_SLIDE_SIZES_MM:
            if size <= max_allowed:
                chosen = size
        return chosen

    @classmethod
    def _build_side_panel_drills(
        cls,
        height_mm: float,
        depth_mm: float,
        plinth_height_mm: float,
        shelf_count: int,
        drawer_count: int,
        drawer_front_height_mm: float,
        fastener_type: FastenerType = FastenerType.MINIFIX_DOWEL,
        niche_shelf_x_coords: list[float] | None = None,
    ) -> list[DrillPoint]:
        """Yan dikme üzerindeki Minifiks+Kavela veya Lamello Cabineo, çekmece rayı ve raf pimi deliklerini üretir."""
        drills: list[DrillPoint] = []
        t_half = MC.BODY_THICKNESS_MM / 2.0
        bottom_conn_x = round(plinth_height_mm + t_half, 2)
        top_conn_x = round(height_mm - t_half, 2)

        conn_y_coords = cls._connection_depth_coords(depth_mm)

        for conn_x, label in ((bottom_conn_x, "Alt Tabla"), (top_conn_x, "Üst Tabla")):
            for y_pos in conn_y_coords:
                if fastener_type == FastenerType.CABINEO_12:
                    drills.append(
                        DrillPoint(
                            x_mm=conn_x,
                            y_mm=y_pos,
                            diameter_mm=MC.CABINEO_SCREW_DIAMETER_MM,
                            depth_mm=MC.CABINEO_SCREW_DEPTH_MM,
                            layer=MC.LAYER_CABINEO_SCREW,
                            description=f"{label} Lamello Cabineo 12 Vida Deliği (Saf Z-Ekseni)",
                        )
                    )
                else:
                    drills.append(
                        DrillPoint(
                            x_mm=conn_x,
                            y_mm=y_pos,
                            diameter_mm=MC.MINIFIX_BOLT_DIAMETER_MM,
                            depth_mm=MC.MINIFIX_BOLT_DEPTH_MM,
                            layer=MC.LAYER_MINIFIX_BOLT,
                            description=f"{label} Minifiks Mil Deliği",
                        )
                    )
                    dowel_y = round(y_pos + MC.DOWEL_OFFSET_FROM_MINIFIX_MM, 2)
                    if dowel_y <= depth_mm - 25.0:
                        drills.append(
                            DrillPoint(
                                x_mm=conn_x,
                                y_mm=dowel_y,
                                diameter_mm=MC.DOWEL_DIAMETER_MM,
                                depth_mm=MC.DOWEL_DEPTH_MM,
                                layer=MC.LAYER_DOWEL,
                                description=f"{label} Kavela Deliği",
                            )
                        )

        # Niş Ara Tablaları Delikleri
        if niche_shelf_x_coords:
            for s_conn_x in niche_shelf_x_coords:
                for y_pos in conn_y_coords:
                    if fastener_type == FastenerType.CABINEO_12:
                        drills.append(
                            DrillPoint(
                                x_mm=s_conn_x,
                                y_mm=y_pos,
                                diameter_mm=MC.CABINEO_SCREW_DIAMETER_MM,
                                depth_mm=MC.CABINEO_SCREW_DEPTH_MM,
                                layer=MC.LAYER_CABINEO_SCREW,
                                description="Niş Ara Tabla Cabineo Vida Karşılık Deliği",
                            )
                        )
                    else:
                        drills.append(
                            DrillPoint(
                                x_mm=s_conn_x,
                                y_mm=y_pos,
                                diameter_mm=MC.MINIFIX_BOLT_DIAMETER_MM,
                                depth_mm=MC.MINIFIX_BOLT_DEPTH_MM,
                                layer=MC.LAYER_MINIFIX_BOLT,
                                description="Niş Ara Tabla Minifiks Mil Deliği",
                            )
                        )
                        dowel_y = round(y_pos + MC.DOWEL_OFFSET_FROM_MINIFIX_MM, 2)
                        if dowel_y <= depth_mm - 25.0:
                            drills.append(
                                DrillPoint(
                                    x_mm=s_conn_x,
                                    y_mm=dowel_y,
                                    diameter_mm=MC.DOWEL_DIAMETER_MM,
                                    depth_mm=MC.DOWEL_DEPTH_MM,
                                    layer=MC.LAYER_DOWEL,
                                    description="Niş Ara Tabla Kavela Deliği",
                                )
                            )

        # Çekmece Rayı Sistem 32 Montaj Delikleri (DRILL_SLIDE_D5)
        drawer_zone_h = drawer_count * drawer_front_height_mm
        if drawer_count > 0:
            slide_offsets_from_front = (37.0, 165.0, 293.0)
            for d_idx in range(drawer_count):
                rail_x = round(
                    plinth_height_mm
                    + MC.BODY_THICKNESS_MM
                    + (d_idx * drawer_front_height_mm)
                    + 45.0,
                    2,
                )
                for front_off in slide_offsets_from_front:
                    hole_y = round(depth_mm - front_off, 2)
                    if hole_y >= 40.0:
                        drills.append(
                            DrillPoint(
                                x_mm=rail_x,
                                y_mm=hole_y,
                                diameter_mm=MC.DRAWER_SLIDE_HOLE_DIAMETER_MM,
                                depth_mm=MC.DRAWER_SLIDE_HOLE_DEPTH_MM,
                                layer=MC.LAYER_DRAWER_SLIDE,
                                description=f"Çekmece #{d_idx + 1} Ray Montaj Deliği",
                            )
                        )

        # Sistem 32 Raf Pimi Delikleri
        if shelf_count > 0:
            lower_bound_x = plinth_height_mm + MC.BODY_THICKNESS_MM + drawer_zone_h
            clear_h = height_mm - MC.BODY_THICKNESS_MM - lower_bound_x
            if clear_h > 120.0:
                step_h = clear_h / (shelf_count + 1)
                pin_y_rear = round(
                    MC.BACK_GROOVE_OFFSET_FROM_REAR_MM
                    + MC.BACK_GROOVE_WIDTH_MM
                    + MC.SHELF_PIN_REAR_OFFSET_MM,
                    2,
                )
                pin_y_front = round(depth_mm - MC.SHELF_PIN_FRONT_OFFSET_MM, 2)

                for idx in range(1, shelf_count + 1):
                    center_x = round(lower_bound_x + (idx * step_h), 2)
                    for offset in (-MC.SYSTEM_32_PITCH_MM, 0.0, MC.SYSTEM_32_PITCH_MM):
                        hole_x = round(center_x + offset, 2)
                        for hole_y in (pin_y_rear, pin_y_front):
                            drills.append(
                                DrillPoint(
                                    x_mm=hole_x,
                                    y_mm=hole_y,
                                    diameter_mm=MC.SHELF_PIN_DIAMETER_MM,
                                    depth_mm=MC.SHELF_PIN_DEPTH_MM,
                                    layer=MC.LAYER_SHELF_PIN,
                                    description=f"Raf {idx} Sistem 32 Pim Deliği",
                                )
                            )

        return drills

    @classmethod
    def _build_horizontal_panel_drills(
        cls,
        inner_width_mm: float,
        depth_mm: float,
        fastener_type: FastenerType = FastenerType.MINIFIX_DOWEL,
    ) -> list[DrillPoint]:
        """Alt ve üst tabla üzerindeki Ø15 mm Minifiks eksantrik veya Lamello Cabineo 12 yuvalarını üretir."""
        drills: list[DrillPoint] = []
        conn_y_coords = cls._connection_depth_coords(depth_mm)
        offset_x = (
            MC.CABINEO_POCKET_OFFSET_FROM_EDGE_MM
            if fastener_type == FastenerType.CABINEO_12
            else MC.MINIFIX_CAM_CENTER_FROM_EDGE_MM
        )
        left_cam_x = offset_x
        right_cam_x = round(inner_width_mm - offset_x, 2)

        for cam_x, side_label in ((left_cam_x, "Sol"), (right_cam_x, "Sağ")):
            for y_pos in conn_y_coords:
                if fastener_type == FastenerType.CABINEO_12:
                    drills.append(
                        DrillPoint(
                            x_mm=cam_x,
                            y_mm=y_pos,
                            diameter_mm=MC.CABINEO_POCKET_DIAMETER_MM,
                            depth_mm=MC.CABINEO_POCKET_DEPTH_MM,
                            layer=MC.LAYER_CABINEO_POCKET,
                            description=f"{side_label} Yan Bağlantı Lamello Cabineo 12 Cebi (Z=10.8mm)",
                        )
                    )
                else:
                    drills.append(
                        DrillPoint(
                            x_mm=cam_x,
                            y_mm=y_pos,
                            diameter_mm=MC.MINIFIX_CAM_DIAMETER_MM,
                            depth_mm=MC.MINIFIX_CAM_DEPTH_MM,
                            layer=MC.LAYER_MINIFIX_CAM,
                            description=f"{side_label} Yan Bağlantı Minifiks Gövde Yuvası",
                        )
                    )
        return drills

    @classmethod
    def _build_door_hinge_drills(
        cls, door_height_mm: float, door_width_mm: float, hinge_on_left: bool
    ) -> list[DrillPoint]:
        """Kapak üzerindeki Ø35 mm tas menteşe yuvası deliklerini üretir."""
        drills: list[DrillPoint] = []
        hinge_count = cls._hinge_count_for_height(door_height_mm)
        hinge_y = (
            MC.HINGE_CUP_CENTER_FROM_EDGE_MM
            if hinge_on_left
            else round(door_width_mm - MC.HINGE_CUP_CENTER_FROM_EDGE_MM, 2)
        )

        top_x = round(
            max(door_height_mm - MC.HINGE_EDGE_OFFSET_TOP_BOTTOM_MM, door_height_mm * 0.75),
            2,
        )
        bottom_x = round(
            min(MC.HINGE_EDGE_OFFSET_TOP_BOTTOM_MM, door_height_mm * 0.25), 2
        )

        if hinge_count == 2 or top_x <= bottom_x:
            x_positions = [bottom_x, top_x]
        else:
            span = top_x - bottom_x
            step = span / (hinge_count - 1)
            x_positions = [round(bottom_x + i * step, 2) for i in range(hinge_count)]

        for idx, x_pos in enumerate(x_positions, start=1):
            drills.append(
                DrillPoint(
                    x_mm=x_pos,
                    y_mm=hinge_y,
                    diameter_mm=MC.HINGE_CUP_DIAMETER_MM,
                    depth_mm=MC.HINGE_CUP_DEPTH_MM,
                    layer=MC.LAYER_HINGE_CUP,
                    description=f"Tas Menteşe Yuvası #{idx} (Ø35mm)",
                )
            )
        return drills

    @classmethod
    def _generate_zones_parts(
        cls,
        config: CabinetConfig,
        module_idx: int,
        x_offset_mm: float,
        start_part_counter: int,
        multi_mode: bool,
    ) -> tuple[list[PanelPart], int, int, int, int]:
        """İç ara dikmeler ve her bölme (zone) için çekmece, askılık, raf ve kapak parçalarını üretir.

        Returns:
            (parts, next_part_counter, total_handles, total_hinges, total_gas_struts)
        """
        parts: list[PanelPart] = []
        part_counter = start_part_counter
        prefix = f"M{module_idx}_" if multi_mode else ""
        label_prefix = f"[Modül {module_idx}] " if multi_mode else ""

        t = MC.BODY_THICKNESS_MM
        w = config.width_mm
        h = config.height_mm
        d = config.depth_mm
        raw_niche_h = max(
            getattr(config, "niche_height_mm", 0.0) or 0.0,
            getattr(config, "appliance_niche_height_mm", 0.0) or 0.0,
        )
        niche_offset = getattr(config, "niche_bottom_offset_mm", 0.0) or 0.0
        is_bottom_niche = raw_niche_h > 0.0 and niche_offset <= 0.0
        niche_h = min(raw_niche_h, max(0.0, h - 260.0)) if is_bottom_niche else 0.0
        plinth_h = config.plinth_height_mm if (config.has_plinth and not is_bottom_niche) else 0.0
        base_offset_y = niche_h if is_bottom_niche else plinth_h
        inner_w = round(w - 2.0 * t, 2)
        clear_inner_h = round(h - base_offset_y - 2.0 * t, 2)
        is_grooved = config.back_panel_type == BackPanelType.GROOVED_8MM
        rear_loss = (
            MC.BACK_GROOVE_OFFSET_FROM_REAR_MM + MC.BACK_GROOVE_WIDTH_MM
            if is_grooved
            else 0.0
        )
        door_mat = (
            config.door_material.strip()
            if config.door_material and config.door_material.strip()
            else config.body_material
        )

        total_handles = 0
        total_hinges = 0
        total_gas_struts = 0

        zones = config.zones or []
        divider_count = max(0, len(zones) - 1)
        total_divider_t = divider_count * t
        avail_w = max(100.0, inner_w - total_divider_t)

        fixed_w_total = sum(z.width_mm for z in zones if z.width_mm and z.width_mm > 0.0)
        flex_ratio_total = sum(
            z.width_ratio if z.width_ratio and z.width_ratio > 0.0 else 1.0
            for z in zones
            if not (z.width_mm and z.width_mm > 0.0)
        )
        remaining_flex_w = max(50.0, avail_w - fixed_w_total)
        zone_widths: list[float] = []
        for z in zones:
            if z.width_mm and z.width_mm > 0.0:
                zone_widths.append(round(z.width_mm, 2))
            else:
                r = z.width_ratio if z.width_ratio and z.width_ratio > 0.0 else 1.0
                zone_widths.append(round(remaining_flex_w * (r / (flex_ratio_total or 1.0)), 2))

        cur_x = round(x_offset_mm - inner_w / 2.0, 2)
        zone_coords: list[dict[str, float]] = []
        divider_coords: list[dict[str, float]] = []

        for i, zw in enumerate(zone_widths):
            start_x = cur_x
            end_x = round(cur_x + zw, 2)
            center_x = round((start_x + end_x) / 2.0, 2)
            zone_coords.append({"startX": start_x, "endX": end_x, "centerX": center_x, "width": zw})
            cur_x = end_x
            if i < divider_count:
                divider_coords.append({"centerX": round(cur_x + t / 2.0, 2)})
                cur_x = round(cur_x + t, 2)

        # 1. İç Ara Dikmeler (Vertical Dividers)
        divider_net_w = round(d - rear_loss - 10.0, 2)
        divider_edge = EdgeBandSpec(
            length_1_mm=config.front_pvc_thickness_mm,
            length_2_mm=config.hidden_pvc_thickness_mm,
            width_1_mm=0.0,
            width_2_mm=0.0,
        )
        div_cut_l, div_cut_w, div_ded_l, div_ded_w = cls.compute_cut_dimensions(
            clear_inner_h, divider_net_w, divider_edge
        )

        for div_idx, dc in enumerate(divider_coords, start=1):
            div_num = f"{div_idx:02d}"
            parts.append(
                PanelPart(
                    part_id=f"P{part_counter:02d}",
                    code=f"{prefix}DIKME_{div_num}",
                    name=f"{label_prefix}İç Ara Dikme #{div_idx}",
                    material=config.body_material,
                    thickness_mm=t,
                    quantity=1,
                    net_length_mm=clear_inner_h,
                    net_width_mm=divider_net_w,
                    cut_length_mm=div_cut_l,
                    cut_width_mm=div_cut_w,
                    pvc_deduction_length_mm=div_ded_l,
                    pvc_deduction_width_mm=div_ded_w,
                    edge_band=divider_edge,
                    area_m2=round((clear_inner_h * divider_net_w) / 1_000_000.0, 4),
                    grain_direction="length",
                    drills=[],
                    grooves=[],
                    transform_3d=Box3DTransform(
                        center_x_mm=dc["centerX"],
                        center_y_mm=round(base_offset_y + t + clear_inner_h / 2.0, 2),
                        center_z_mm=-5.0,
                        size_x_mm=t,
                        size_y_mm=clear_inner_h,
                        size_z_mm=divider_net_w,
                        color_hex=config.body_color_hex,
                        module_index=module_idx,
                    ),
                )
            )
            part_counter += 1

        # 2. Bölmeler (Zones)
        for zi, z in enumerate(zones):
            zc = zone_coords[zi]
            zw = zc["width"]
            z_name = z.name or f"Bölme #{zi + 1}"

            z_raw_niche_h = max(
                getattr(z, "niche_height_mm", 0.0) or 0.0,
                getattr(z, "appliance_niche_height_mm", 0.0) or 0.0,
            )
            z_niche_offset = getattr(z, "niche_bottom_offset_mm", 0.0) or 0.0
            z_is_mid_niche = z_raw_niche_h > 0.0 and z_niche_offset > 0.0

            z_lower_clear_h = round(min(z_niche_offset, clear_inner_h - 180.0), 2) if z_is_mid_niche else 0.0
            z_mid_niche_h = (
                round(min(z_raw_niche_h, max(100.0, clear_inner_h - z_lower_clear_h - t)), 2)
                if z_is_mid_niche
                else 0.0
            )
            z_upper_clear_h = (
                round(clear_inner_h - z_lower_clear_h - z_mid_niche_h - 2.0 * t, 2)
                if z_is_mid_niche
                else 0.0
            )
            z_has_upper_shelf = z_is_mid_niche and z_upper_clear_h >= 80.0

            # 2a. Açık Niş Ara Tablaları (Varsa)
            if z_is_mid_niche:
                zh_edge = EdgeBandSpec(
                    length_1_mm=config.front_pvc_thickness_mm,
                    length_2_mm=config.hidden_pvc_thickness_mm,
                    width_1_mm=0.0,
                    width_2_mm=0.0,
                )
                zh_cut_l, zh_cut_w, zh_ded_l, zh_ded_w = cls.compute_cut_dimensions(zw, d, zh_edge)
                n_color = z.niche_color_hex or config.niche_color_hex or config.body_color_hex

                # Niş Alt Tablası
                parts.append(
                    PanelPart(
                        part_id=f"P{part_counter:02d}",
                        code=f"{prefix}Z{zi + 1}_TABLA_ARA_NIS_ALT",
                        name=f"{label_prefix}{z_name} Niş Alt Tablası",
                        material=config.body_material,
                        thickness_mm=t,
                        quantity=1,
                        net_length_mm=zw,
                        net_width_mm=d,
                        cut_length_mm=zh_cut_l,
                        cut_width_mm=zh_cut_w,
                        pvc_deduction_length_mm=zh_ded_l,
                        pvc_deduction_width_mm=zh_ded_w,
                        edge_band=zh_edge,
                        area_m2=round((zw * d) / 1_000_000.0, 4),
                        grain_direction="length",
                        drills=[],
                        grooves=[],
                        transform_3d=Box3DTransform(
                            center_x_mm=zc["centerX"],
                            center_y_mm=round(base_offset_y + t + z_lower_clear_h + t / 2.0, 2),
                            center_z_mm=0.0,
                            size_x_mm=zw,
                            size_y_mm=t,
                            size_z_mm=d,
                            color_hex=n_color,
                            is_niche=True,
                            module_index=module_idx,
                        ),
                    )
                )
                part_counter += 1

                # Niş Üst Tablası
                if z_has_upper_shelf:
                    parts.append(
                        PanelPart(
                            part_id=f"P{part_counter:02d}",
                            code=f"{prefix}Z{zi + 1}_TABLA_ARA_NIS_UST",
                            name=f"{label_prefix}{z_name} Niş Üst Tablası",
                            material=config.body_material,
                            thickness_mm=t,
                            quantity=1,
                            net_length_mm=zw,
                            net_width_mm=d,
                            cut_length_mm=zh_cut_l,
                            cut_width_mm=zh_cut_w,
                            pvc_deduction_length_mm=zh_ded_l,
                            pvc_deduction_width_mm=zh_ded_w,
                            edge_band=zh_edge,
                            area_m2=round((zw * d) / 1_000_000.0, 4),
                            grain_direction="length",
                            drills=[],
                            grooves=[],
                            transform_3d=Box3DTransform(
                                center_x_mm=zc["centerX"],
                                center_y_mm=round(base_offset_y + t + z_lower_clear_h + t + z_mid_niche_h + t / 2.0, 2),
                                center_z_mm=0.0,
                                size_x_mm=zw,
                                size_y_mm=t,
                                size_z_mm=d,
                                color_hex=n_color,
                                is_niche=True,
                                module_index=module_idx,
                            ),
                        )
                    )
                    part_counter += 1

                # Niş Arka Aksan Paneli
                if not getattr(z, "niche_back_open", False) and (z.niche_color_hex or config.niche_color_hex):
                    accent_color = z.niche_color_hex or config.niche_color_hex
                    no_edge_back = EdgeBandSpec(length_1_mm=0.0, length_2_mm=0.0, width_1_mm=0.0, width_2_mm=0.0)
                    back_z = round(-d / 2.0 + MC.BACK_GROOVE_OFFSET_FROM_REAR_MM + MC.BACK_GROOVE_WIDTH_MM / 2.0, 2) if is_grooved else round(-d / 2.0 - 4.0, 2)
                    parts.append(
                        PanelPart(
                            part_id=f"P{part_counter:02d}",
                            code=f"{prefix}Z{zi + 1}_ARKALIK_NIS_AKSAN",
                            name=f"{label_prefix}{z_name} Açık Niş Aksan Arkalığı",
                            material="8mm Kontrast MDF-Lam",
                            thickness_mm=8.0,
                            quantity=1,
                            net_length_mm=z_mid_niche_h,
                            net_width_mm=zw,
                            cut_length_mm=z_mid_niche_h,
                            cut_width_mm=zw,
                            pvc_deduction_length_mm=0.0,
                            pvc_deduction_width_mm=0.0,
                            edge_band=no_edge_back,
                            area_m2=round((z_mid_niche_h * zw) / 1_000_000.0, 4),
                            grain_direction="length",
                            drills=[],
                            grooves=[],
                            transform_3d=Box3DTransform(
                                center_x_mm=zc["centerX"],
                                center_y_mm=round(base_offset_y + t + z_lower_clear_h + t + z_mid_niche_h / 2.0, 2),
                                center_z_mm=back_z,
                                size_x_mm=zw,
                                size_y_mm=z_mid_niche_h,
                                size_z_mm=8.0,
                                color_hex=accent_color,
                                is_niche=True,
                                module_index=module_idx,
                            ),
                        )
                    )
                    part_counter += 1

            # 2b. Çekmeceler
            z_active_drawer_h = z_lower_clear_h if z_is_mid_niche else clear_inner_h
            z_drawer_count = z.drawer_count or 0
            z_drawer_front_h = z.drawer_front_height_mm or 180.0
            if z_drawer_count > 0 and z_drawer_count * z_drawer_front_h > z_active_drawer_h - 20.0:
                z_drawer_front_h = round((z_active_drawer_h - 10.0) / z_drawer_count, 2)
            z_drawer_zone_h = round(z_drawer_count * z_drawer_front_h, 2)

            if z_drawer_count > 0:
                slide_len = cls.select_drawer_slide_length(d)
                box_h = round(max(80.0, z_drawer_front_h - MC.DRAWER_BOX_HEIGHT_REDUCTION_MM), 2)
                box_inner_w = round(zw - MC.DRAWER_SLIDE_CLEARANCE_TOTAL_MM - 2.0 * t, 2)
                front_net_w = round(zw - 2.0 * MC.DOOR_OUTER_GAP_MM, 2)
                front_net_h = round(z_drawer_front_h - MC.DOOR_CENTER_GAP_MM, 2)

                front_edge = EdgeBandSpec(
                    length_1_mm=config.front_pvc_thickness_mm,
                    length_2_mm=config.front_pvc_thickness_mm,
                    width_1_mm=config.front_pvc_thickness_mm,
                    width_2_mm=config.front_pvc_thickness_mm,
                )
                f_cut_l, f_cut_w, f_ded_l, f_ded_w = cls.compute_cut_dimensions(
                    front_net_w, front_net_h, front_edge
                )

                box_edge = EdgeBandSpec(
                    length_1_mm=config.hidden_pvc_thickness_mm,
                    length_2_mm=0.0,
                    width_1_mm=0.0,
                    width_2_mm=0.0,
                )
                bs_cut_l, bs_cut_w, bs_ded_l, bs_ded_w = cls.compute_cut_dimensions(
                    slide_len, box_h, box_edge
                )
                bf_cut_l, bf_cut_w, bf_ded_l, bf_ded_w = cls.compute_cut_dimensions(
                    box_inner_w, box_h, box_edge
                )

                bottom_w = round(box_inner_w + 15.0, 2)
                bottom_l = round(slide_len - 2.0 * t + 15.0, 2)
                no_edge = EdgeBandSpec(length_1_mm=0.0, length_2_mm=0.0, width_1_mm=0.0, width_2_mm=0.0)

                for d_idx in range(1, z_drawer_count + 1):
                    d_str = f"{d_idx:02d}"
                    center_y = round(base_offset_y + t + (d_idx - 0.5) * z_drawer_front_h, 2)
                    klapa_z = round(d / 2.0 + t / 2.0 + 1.5, 2)
                    box_z = round(d / 2.0 - slide_len / 2.0 - 5.0, 2)
                    total_handles += 1

                    # Klapa
                    parts.append(
                        PanelPart(
                            part_id=f"P{part_counter:02d}",
                            code=f"{prefix}Z{zi + 1}_CEK_KLAPA_{d_str}",
                            name=f"{label_prefix}{z_name} Çekmece #{d_idx} Klapası",
                            material=door_mat,
                            thickness_mm=t,
                            quantity=1,
                            net_length_mm=front_net_w,
                            net_width_mm=front_net_h,
                            cut_length_mm=f_cut_l,
                            cut_width_mm=f_cut_w,
                            pvc_deduction_length_mm=f_ded_l,
                            pvc_deduction_width_mm=f_ded_w,
                            edge_band=front_edge,
                            area_m2=round((front_net_w * front_net_h) / 1_000_000.0, 4),
                            grain_direction="length",
                            drills=[],
                            grooves=[],
                            transform_3d=Box3DTransform(
                                center_x_mm=zc["centerX"],
                                center_y_mm=center_y,
                                center_z_mm=klapa_z,
                                size_x_mm=front_net_w,
                                size_y_mm=front_net_h,
                                size_z_mm=t,
                                color_hex=z.door_color_hex or config.door_color_hex,
                                is_drawer=True,
                                module_index=module_idx,
                            ),
                        )
                    )
                    part_counter += 1

                    # Yanlar
                    for side_code, side_name, side_x in (
                        ("SOL", "Sol Yan", round(zc["centerX"] - box_inner_w / 2.0 - t / 2.0, 2)),
                        ("SAG", "Sağ Yan", round(zc["centerX"] + box_inner_w / 2.0 + t / 2.0, 2)),
                    ):
                        parts.append(
                            PanelPart(
                                part_id=f"P{part_counter:02d}",
                                code=f"{prefix}Z{zi + 1}_CEK_{d_str}_{side_code}",
                                name=f"{label_prefix}{z_name} Çekmece #{d_idx} {side_name}",
                                material=config.body_material,
                                thickness_mm=t,
                                quantity=1,
                                net_length_mm=slide_len,
                                net_width_mm=box_h,
                                cut_length_mm=bs_cut_l,
                                cut_width_mm=bs_cut_w,
                                pvc_deduction_length_mm=bs_ded_l,
                                pvc_deduction_width_mm=bs_ded_w,
                                edge_band=box_edge,
                                area_m2=round((slide_len * box_h) / 1_000_000.0, 4),
                                grain_direction="length",
                                drills=[],
                                grooves=[],
                                transform_3d=Box3DTransform(
                                    center_x_mm=side_x,
                                    center_y_mm=center_y,
                                    center_z_mm=box_z,
                                    size_x_mm=t,
                                    size_y_mm=box_h,
                                    size_z_mm=slide_len,
                                    color_hex=config.body_color_hex,
                                    is_drawer=True,
                                    module_index=module_idx,
                                ),
                            )
                        )
                        part_counter += 1

                    # Ön & Arka
                    for fb_code, fb_name, fb_z in (
                        ("ON", "İç Ön Kasa", round(box_z + slide_len / 2.0 - t / 2.0, 2)),
                        ("ARKA", "İç Arka Kasa", round(box_z - slide_len / 2.0 + t / 2.0, 2)),
                    ):
                        parts.append(
                            PanelPart(
                                part_id=f"P{part_counter:02d}",
                                code=f"{prefix}Z{zi + 1}_CEK_{d_str}_{fb_code}",
                                name=f"{label_prefix}{z_name} Çekmece #{d_idx} {fb_name}",
                                material=config.body_material,
                                thickness_mm=t,
                                quantity=1,
                                net_length_mm=box_inner_w,
                                net_width_mm=box_h,
                                cut_length_mm=bf_cut_l,
                                cut_width_mm=bf_cut_w,
                                pvc_deduction_length_mm=bf_ded_l,
                                pvc_deduction_width_mm=bf_ded_w,
                                edge_band=box_edge,
                                area_m2=round((box_inner_w * box_h) / 1_000_000.0, 4),
                                grain_direction="length",
                                drills=[],
                                grooves=[],
                                transform_3d=Box3DTransform(
                                    center_x_mm=zc["centerX"],
                                    center_y_mm=center_y,
                                    center_z_mm=fb_z,
                                    size_x_mm=box_inner_w,
                                    size_y_mm=box_h,
                                    size_z_mm=t,
                                    color_hex=config.body_color_hex,
                                    is_drawer=True,
                                    module_index=module_idx,
                                ),
                            )
                        )
                        part_counter += 1

                    # Taban
                    parts.append(
                        PanelPart(
                            part_id=f"P{part_counter:02d}",
                            code=f"{prefix}Z{zi + 1}_CEK_{d_str}_TABAN",
                            name=f"{label_prefix}{z_name} Çekmece #{d_idx} Tabanı (8mm)",
                            material="8mm Beyaz MDF-Lam Arkalık",
                            thickness_mm=MC.BACK_PANEL_GROOVED_THICKNESS_MM,
                            quantity=1,
                            net_length_mm=bottom_w,
                            net_width_mm=bottom_l,
                            cut_length_mm=bottom_w,
                            cut_width_mm=bottom_l,
                            pvc_deduction_length_mm=0.0,
                            pvc_deduction_width_mm=0.0,
                            edge_band=no_edge,
                            area_m2=round((bottom_w * bottom_l) / 1_000_000.0, 4),
                            grain_direction="length",
                            drills=[],
                            grooves=[],
                            transform_3d=Box3DTransform(
                                center_x_mm=zc["centerX"],
                                center_y_mm=round(center_y - box_h / 2.0 + 8.0, 2),
                                center_z_mm=box_z,
                                size_x_mm=bottom_w,
                                size_y_mm=MC.BACK_PANEL_GROOVED_THICKNESS_MM,
                                size_z_mm=bottom_l,
                                color_hex="#E5E0D5",
                                is_drawer=True,
                                module_index=module_idx,
                            ),
                        )
                    )
                    part_counter += 1

            # 2c. Elbise Askılığı
            z_remain_h = z_upper_clear_h if z_is_mid_niche else round(clear_inner_h - z_drawer_zone_h, 2)
            if z.has_hanging_rod and z_remain_h > 300.0:
                rod_l = round(zw - 4.0, 2)
                no_edge = EdgeBandSpec(length_1_mm=0.0, length_2_mm=0.0, width_1_mm=0.0, width_2_mm=0.0)
                rod_center_y = (
                    round(base_offset_y + t + z_lower_clear_h + t + z_mid_niche_h + t + z_upper_clear_h - 70.0, 2)
                    if z_is_mid_niche
                    else round(base_offset_y + t + clear_inner_h - 70.0, 2)
                )
                parts.append(
                    PanelPart(
                        part_id=f"P{part_counter:02d}",
                        code=f"{prefix}Z{zi + 1}_ASKILIK",
                        name=f"{label_prefix}{z_name} Elbise Askı Borusu (Alüminyum)",
                        material="Alüminyum Oval Askı Borusu",
                        thickness_mm=15.0,
                        quantity=1,
                        net_length_mm=rod_l,
                        net_width_mm=30.0,
                        cut_length_mm=rod_l,
                        cut_width_mm=30.0,
                        pvc_deduction_length_mm=0.0,
                        pvc_deduction_width_mm=0.0,
                        edge_band=no_edge,
                        area_m2=0.01,
                        grain_direction="none",
                        drills=[],
                        grooves=[],
                        transform_3d=Box3DTransform(
                            center_x_mm=zc["centerX"],
                            center_y_mm=rod_center_y,
                            center_z_mm=0.0,
                            size_x_mm=rod_l,
                            size_y_mm=30.0,
                            size_z_mm=15.0,
                            color_hex="#CBD5E1",
                            is_hanging_rod=True,
                            module_index=module_idx,
                        ),
                    )
                )
                part_counter += 1

            # 2d. Raflar
            if z.shelf_count > 0 and z_remain_h > 120.0:
                shelf_net_l = round(zw - MC.SHELF_WIDTH_CLEARANCE_MM, 2)
                shelf_net_w = round(d - rear_loss - MC.SHELF_FRONT_SETBACK_MM, 2)
                shelf_edge = EdgeBandSpec(
                    length_1_mm=config.front_pvc_thickness_mm,
                    length_2_mm=config.hidden_pvc_thickness_mm,
                    width_1_mm=config.hidden_pvc_thickness_mm,
                    width_2_mm=config.hidden_pvc_thickness_mm,
                )
                s_cut_l, s_cut_w, s_ded_l, s_ded_w = cls.compute_cut_dimensions(
                    shelf_net_l, shelf_net_w, shelf_edge
                )
                step_h = z_remain_h / (z.shelf_count + 1)
                shelf_z_center = round((rear_loss - MC.SHELF_FRONT_SETBACK_MM) / 2.0, 2)
                shelf_base_y = (
                    round(base_offset_y + t + z_lower_clear_h + t + z_mid_niche_h + t, 2)
                    if z_is_mid_niche
                    else round(base_offset_y + t + z_drawer_zone_h, 2)
                )

                for s_idx in range(1, z.shelf_count + 1):
                    shelf_y = round(shelf_base_y + s_idx * step_h, 2)
                    parts.append(
                        PanelPart(
                            part_id=f"P{part_counter:02d}",
                            code=f"{prefix}Z{zi + 1}_RAF_{s_idx:02d}",
                            name=f"{label_prefix}{z_name} Hareketli Raf #{s_idx}",
                            material=config.body_material,
                            thickness_mm=t,
                            quantity=1,
                            net_length_mm=shelf_net_l,
                            net_width_mm=shelf_net_w,
                            cut_length_mm=s_cut_l,
                            cut_width_mm=s_cut_w,
                            pvc_deduction_length_mm=s_ded_l,
                            pvc_deduction_width_mm=s_ded_w,
                            edge_band=shelf_edge,
                            area_m2=round((shelf_net_l * shelf_net_w) / 1_000_000.0, 4),
                            grain_direction="length",
                            drills=[],
                            grooves=[],
                            transform_3d=Box3DTransform(
                                center_x_mm=zc["centerX"],
                                center_y_mm=shelf_y,
                                center_z_mm=shelf_z_center,
                                size_x_mm=shelf_net_l,
                                size_y_mm=t,
                                size_z_mm=shelf_net_w,
                                color_hex=config.body_color_hex,
                                module_index=module_idx,
                            ),
                        )
                    )
                    part_counter += 1

            # 2e. Kapaklar (Yardımcı Kapak Motoru)
            def _build_zone_door_cavity(
                avail_h: float,
                y_center: float,
                door_code_suffix: str = "",
                door_name_suffix: str = "",
            ) -> None:
                nonlocal part_counter, total_handles, total_hinges, total_gas_struts
                if not z.door_type or z.door_type == DoorType.NONE or avail_h < 180.0:
                    return

                door_net_h = round(avail_h - 4.0, 2)
                door_edge = EdgeBandSpec(
                    length_1_mm=config.front_pvc_thickness_mm,
                    length_2_mm=config.front_pvc_thickness_mm,
                    width_1_mm=config.front_pvc_thickness_mm,
                    width_2_mm=config.front_pvc_thickness_mm,
                )
                door_z_center = round(d / 2.0 + t / 2.0 + 1.5, 2)
                door_color = z.door_color_hex or config.door_color_hex
                code_mid = f"{door_code_suffix}_" if door_code_suffix else ""

                if z.door_type == DoorType.FLAP_UP:
                    door_net_w = round(zw - 2.0 * MC.DOOR_OUTER_GAP_MM, 2)
                    d_cut_l, d_cut_w, d_ded_l, d_ded_w = cls.compute_cut_dimensions(
                        door_net_h, door_net_w, door_edge
                    )
                    total_gas_struts += 2
                    total_handles += 1
                    parts.append(
                        PanelPart(
                            part_id=f"P{part_counter:02d}",
                            code=f"{prefix}Z{zi + 1}_KAPAK_{code_mid}KALKAR",
                            name=f"{label_prefix}{z_name} {door_name_suffix}Kalkar Kapak",
                            material=door_mat,
                            thickness_mm=t,
                            quantity=1,
                            net_length_mm=door_net_h,
                            net_width_mm=door_net_w,
                            cut_length_mm=d_cut_l,
                            cut_width_mm=d_cut_w,
                            pvc_deduction_length_mm=d_ded_l,
                            pvc_deduction_width_mm=d_ded_w,
                            edge_band=door_edge,
                            area_m2=round((door_net_h * door_net_w) / 1_000_000.0, 4),
                            grain_direction="length",
                            drills=[],
                            grooves=[],
                            transform_3d=Box3DTransform(
                                center_x_mm=zc["centerX"],
                                center_y_mm=y_center,
                                center_z_mm=door_z_center,
                                size_x_mm=door_net_w,
                                size_y_mm=door_net_h,
                                size_z_mm=t,
                                color_hex=door_color,
                                is_door=True,
                                hinge_side="top",
                                module_index=module_idx,
                            ),
                        )
                    )
                    part_counter += 1
                elif z.door_type in (DoorType.SINGLE_LEFT, DoorType.SINGLE_RIGHT):
                    door_net_w = round(zw - 2.0 * MC.DOOR_OUTER_GAP_MM, 2)
                    d_cut_l, d_cut_w, d_ded_l, d_ded_w = cls.compute_cut_dimensions(
                        door_net_h, door_net_w, door_edge
                    )
                    hinge_left = z.door_type == DoorType.SINGLE_LEFT
                    d_drills = cls._build_door_hinge_drills(door_net_h, door_net_w, hinge_on_left=hinge_left)
                    total_hinges += len(d_drills)
                    total_handles += 1
                    parts.append(
                        PanelPart(
                            part_id=f"P{part_counter:02d}",
                            code=f"{prefix}Z{zi + 1}_KAPAK_{code_mid}TEK",
                            name=(
                                f"{label_prefix}{z_name} {door_name_suffix}Tek Kapak (Sol Menteşeli)"
                                if hinge_left
                                else f"{label_prefix}{z_name} {door_name_suffix}Tek Kapak (Sağ Menteşeli)"
                            ),
                            material=door_mat,
                            thickness_mm=t,
                            quantity=1,
                            net_length_mm=door_net_h,
                            net_width_mm=door_net_w,
                            cut_length_mm=d_cut_l,
                            cut_width_mm=d_cut_w,
                            pvc_deduction_length_mm=d_ded_l,
                            pvc_deduction_width_mm=d_ded_w,
                            edge_band=door_edge,
                            area_m2=round((door_net_h * door_net_w) / 1_000_000.0, 4),
                            grain_direction="length",
                            drills=d_drills,
                            grooves=[],
                            transform_3d=Box3DTransform(
                                center_x_mm=zc["centerX"],
                                center_y_mm=y_center,
                                center_z_mm=door_z_center,
                                size_x_mm=door_net_w,
                                size_y_mm=door_net_h,
                                size_z_mm=t,
                                color_hex=door_color,
                                is_door=True,
                                hinge_side="left" if hinge_left else "right",
                                module_index=module_idx,
                            ),
                        )
                    )
                    part_counter += 1
                elif z.door_type == DoorType.DOUBLE:
                    door_net_w = round((zw - 2.0 * MC.DOOR_OUTER_GAP_MM - MC.DOOR_CENTER_GAP_MM) / 2.0, 2)
                    d_cut_l, d_cut_w, d_ded_l, d_ded_w = cls.compute_cut_dimensions(
                        door_net_h, door_net_w, door_edge
                    )
                    total_handles += 2
                    for side_code, side_label, is_left, rel_cx in (
                        ("SOL", "Sol Kapak", True, round(-door_net_w / 2.0 - MC.DOOR_CENTER_GAP_MM / 2.0, 2)),
                        ("SAG", "Sağ Kapak", False, round(door_net_w / 2.0 + MC.DOOR_CENTER_GAP_MM / 2.0, 2)),
                    ):
                        d_drills = cls._build_door_hinge_drills(door_net_h, door_net_w, hinge_on_left=is_left)
                        total_hinges += len(d_drills)
                        parts.append(
                            PanelPart(
                                part_id=f"P{part_counter:02d}",
                                code=f"{prefix}Z{zi + 1}_KAPAK_{code_mid}{side_code}",
                                name=f"{label_prefix}{z_name} {door_name_suffix}{side_label}",
                                material=door_mat,
                                thickness_mm=t,
                                quantity=1,
                                net_length_mm=door_net_h,
                                net_width_mm=door_net_w,
                                cut_length_mm=d_cut_l,
                                cut_width_mm=d_cut_w,
                                pvc_deduction_length_mm=d_ded_l,
                                pvc_deduction_width_mm=d_ded_w,
                                edge_band=door_edge,
                                area_m2=round((door_net_h * door_net_w) / 1_000_000.0, 4),
                                grain_direction="length",
                                drills=d_drills,
                                grooves=[],
                                transform_3d=Box3DTransform(
                                    center_x_mm=round(zc["centerX"] + rel_cx, 2),
                                    center_y_mm=y_center,
                                    center_z_mm=door_z_center,
                                    size_x_mm=door_net_w,
                                    size_y_mm=door_net_h,
                                    size_z_mm=t,
                                    color_hex=door_color,
                                    is_door=True,
                                    hinge_side="left" if is_left else "right",
                                    module_index=module_idx,
                                ),
                            )
                        )
                        part_counter += 1

            if z_is_mid_niche:
                if z_drawer_count == 0 and z_lower_clear_h >= 180.0:
                    _build_zone_door_cavity(
                        round(z_lower_clear_h + t, 2),
                        round(base_offset_y + t / 2.0 + z_lower_clear_h / 2.0, 2),
                        "ALT",
                        "Alt ",
                    )
                if z_has_upper_shelf and z_upper_clear_h >= 180.0:
                    _build_zone_door_cavity(
                        round(z_upper_clear_h + t, 2),
                        round(base_offset_y + t + z_lower_clear_h + t + z_mid_niche_h + t / 2.0 + z_upper_clear_h / 2.0, 2),
                        "UST",
                        "Üst ",
                    )
            else:
                z_door_avail_h = round(clear_inner_h - z_drawer_zone_h, 2)
                if z_door_avail_h >= 200.0:
                    _build_zone_door_cavity(
                        round(z_door_avail_h + (2.0 * t if z_drawer_count == 0 else t), 2),
                        round(base_offset_y + z_drawer_zone_h + z_door_avail_h / 2.0, 2),
                        "",
                        "",
                    )

        return parts, part_counter, total_handles, total_hinges, total_gas_struts

    @classmethod
    def _generate_single_module_parts(
        cls,
        config: CabinetConfig,
        module_idx: int,
        x_offset_mm: float,
        start_part_counter: int,
        multi_mode: bool,
    ) -> tuple[list[PanelPart], int, int, int, int, int]:
        """Tek bir modülün tüm gövde, raf, arkalık, çekmece ve kapak parçalarını üretir.

        Returns:
            (parts, next_part_counter, minifix_sets, dowel_count, total_hinges, handles_count)
        """
        parts: list[PanelPart] = []
        part_counter = start_part_counter
        prefix = f"M{module_idx}_" if multi_mode else ""
        label_prefix = f"[Modül {module_idx}] " if multi_mode else ""

        t = MC.BODY_THICKNESS_MM
        w = config.width_mm
        h = config.height_mm
        d = config.depth_mm
        raw_niche_h = max(
            float(getattr(config, "niche_height_mm", 0.0) or 0.0),
            float(getattr(config, "appliance_niche_height_mm", 0.0) or 0.0),
        )
        niche_offset = float(getattr(config, "niche_bottom_offset_mm", 0.0) or 0.0)
        is_bottom_niche = raw_niche_h > 0 and niche_offset <= 0
        niche_h = min(raw_niche_h, max(0.0, h - 260.0)) if is_bottom_niche else 0.0
        plinth_h = config.plinth_height_mm if (config.has_plinth and not is_bottom_niche) else 0.0
        base_offset_y = round(niche_h if is_bottom_niche else plinth_h, 2)
        door_mat = (
            config.door_material.strip()
            if getattr(config, "door_material", "") and config.door_material.strip()
            else config.body_material
        )

        inner_w = round(w - (2.0 * t), 2)
        clear_inner_h = round(h - base_offset_y - (2.0 * t), 2)

        # Açık Orta Niş Parametreleri
        is_mid_niche = raw_niche_h > 0 and niche_offset > 0
        lower_clear_h = (
            round(min(niche_offset, clear_inner_h - 180.0), 2)
            if is_mid_niche
            else 0.0
        )
        mid_niche_h = (
            round(min(raw_niche_h, max(100.0, clear_inner_h - lower_clear_h - t)), 2)
            if is_mid_niche
            else 0.0
        )
        upper_clear_h = (
            round(clear_inner_h - lower_clear_h - mid_niche_h - 2.0 * t, 2)
            if is_mid_niche
            else 0.0
        )
        has_upper_niche_shelf = is_mid_niche and upper_clear_h >= 80.0

        # Çekmece bölgesi yüksekliği kontrolü
        drawer_count = config.drawer_count
        drawer_front_h = config.drawer_front_height_mm
        active_drawer_space = lower_clear_h if is_mid_niche else clear_inner_h
        if drawer_count > 0 and (drawer_count * drawer_front_h > active_drawer_space - 20.0):
            drawer_front_h = round((active_drawer_space - 10.0) / drawer_count, 2)
        drawer_zone_h = round(drawer_count * drawer_front_h, 2)

        # Niş Ara Tablaları Delikleri
        niche_shelf_x_coords: list[float] = []
        if is_mid_niche:
            t_half = t / 2.0
            niche_shelf_x_coords.append(round(base_offset_y + t + lower_clear_h + t_half, 2))
            if has_upper_niche_shelf:
                niche_shelf_x_coords.append(
                    round(base_offset_y + t + lower_clear_h + t + mid_niche_h + t_half, 2)
                )

        # 1. Sol ve Sağ Yan Dikmeler (Çatı Eğimi Desteği)
        has_slope = getattr(config, "has_slope", False)
        slope_side = getattr(config, "slope_side", "left")
        slope_start_h = float(getattr(config, "slope_start_height_mm", 1200.0) or 1200.0)

        left_h = slope_start_h if (has_slope and slope_side == "left") else h
        right_h = slope_start_h if (has_slope and slope_side == "right") else h

        side_edge = EdgeBandSpec(
            length_1_mm=config.front_pvc_thickness_mm,
            length_2_mm=config.hidden_pvc_thickness_mm,
            width_1_mm=config.hidden_pvc_thickness_mm,
            width_2_mm=config.hidden_pvc_thickness_mm,
        )

        # Sol Dikme
        sol_cut_l, sol_cut_w, sol_ded_l, sol_ded_w = cls.compute_cut_dimensions(
            left_h, d, side_edge
        )
        sol_drills = cls._build_side_panel_drills(
            left_h,
            d,
            base_offset_y,
            config.shelf_count,
            drawer_count,
            drawer_front_h,
            fastener_type=config.fastener_type,
            niche_shelf_x_coords=niche_shelf_x_coords,
        )

        # Sağ Dikme
        sag_cut_l, sag_cut_w, sag_ded_l, sag_ded_w = cls.compute_cut_dimensions(
            right_h, d, side_edge
        )
        sag_drills = cls._build_side_panel_drills(
            right_h,
            d,
            base_offset_y,
            config.shelf_count,
            drawer_count,
            drawer_front_h,
            fastener_type=config.fastener_type,
            niche_shelf_x_coords=niche_shelf_x_coords,
        )

        side_notch_str = (
            f"Süpürgelik Kertmesi: {config.baseboard_notch_depth_mm:.0f}×{config.baseboard_notch_height_mm:.0f}mm"
            if config.has_baseboard_notch
            else ""
        )

        side_grooves: list[GroovePath] = []
        if config.back_panel_type == BackPanelType.GROOVED_8MM:
            groove_start_x = round(
                base_offset_y + t - MC.BACK_PANEL_INSERTION_PER_SIDE_MM, 2
            )
            groove_len_x = round(
                clear_inner_h + (2.0 * MC.BACK_PANEL_INSERTION_PER_SIDE_MM), 2
            )
            side_grooves.append(
                GroovePath(
                    x_start_mm=groove_start_x,
                    y_start_mm=MC.BACK_GROOVE_OFFSET_FROM_REAR_MM,
                    width_mm=groove_len_x,
                    length_mm=MC.BACK_GROOVE_WIDTH_MM,
                    depth_mm=MC.BACK_GROOVE_DEPTH_MM,
                    layer=MC.LAYER_GROOVE_BACK,
                )
            )

        sol_name = (
            f"{label_prefix}Sol Yan Eğimli Dikme (Alçak Taraf)"
            if (has_slope and slope_side == "left")
            else f"{label_prefix}Sol Yan Dikme"
        )
        parts.append(
            PanelPart(
                part_id=f"P{part_counter:02d}",
                code=f"{prefix}YAN_SOL",
                name=sol_name,
                material=config.body_material,
                thickness_mm=t,
                quantity=1,
                net_length_mm=left_h,
                net_width_mm=d,
                cut_length_mm=sol_cut_l,
                cut_width_mm=sol_cut_w,
                pvc_deduction_length_mm=sol_ded_l,
                pvc_deduction_width_mm=sol_ded_w,
                edge_band=side_edge,
                area_m2=round((left_h * d) / 1_000_000.0, 4),
                drills=sol_drills,
                grooves=side_grooves,
                notch_info=side_notch_str,
                transform_3d=Box3DTransform(
                    center_x_mm=round(x_offset_mm - w / 2.0 + t / 2.0, 2),
                    center_y_mm=round(left_h / 2.0, 2),
                    center_z_mm=0.0,
                    size_x_mm=t,
                    size_y_mm=left_h,
                    size_z_mm=d,
                    color_hex=config.body_color_hex,
                    module_index=module_idx,
                ),
            )
        )
        part_counter += 1

        sag_name = (
            f"{label_prefix}Sağ Yan Eğimli Dikme (Alçak Taraf)"
            if (has_slope and slope_side == "right")
            else f"{label_prefix}Sağ Yan Dikme"
        )
        parts.append(
            PanelPart(
                part_id=f"P{part_counter:02d}",
                code=f"{prefix}YAN_SAG",
                name=sag_name,
                material=config.body_material,
                thickness_mm=t,
                quantity=1,
                net_length_mm=right_h,
                net_width_mm=d,
                cut_length_mm=sag_cut_l,
                cut_width_mm=sag_cut_w,
                pvc_deduction_length_mm=sag_ded_l,
                pvc_deduction_width_mm=sag_ded_w,
                edge_band=side_edge,
                area_m2=round((right_h * d) / 1_000_000.0, 4),
                drills=sag_drills,
                grooves=side_grooves,
                notch_info=side_notch_str,
                transform_3d=Box3DTransform(
                    center_x_mm=round(x_offset_mm + w / 2.0 - t / 2.0, 2),
                    center_y_mm=round(right_h / 2.0, 2),
                    center_z_mm=0.0,
                    size_x_mm=t,
                    size_y_mm=right_h,
                    size_z_mm=d,
                    color_hex=config.body_color_hex,
                    module_index=module_idx,
                ),
            )
        )
        part_counter += 1

        # 2. Üst ve Alt Tabla (Çatı Eğimi Geometrisi)
        horiz_edge = EdgeBandSpec(
            length_1_mm=config.front_pvc_thickness_mm,
            length_2_mm=config.hidden_pvc_thickness_mm,
            width_1_mm=0.0,
            width_2_mm=0.0,
        )

        col_notch_str = (
            f"Kolon Kertmesi: {config.column_notch_width_mm:.0f}×{config.column_notch_depth_mm:.0f}mm"
            if config.has_column_notch
            else ""
        )

        if has_slope:
            delta_h = abs(h - slope_start_h)
            top_len = round(math.sqrt(inner_w**2 + delta_h**2), 2)
            slope_deg = round(math.degrees(math.atan2(delta_h, max(1.0, inner_w))), 1)
            rot_z = slope_deg if slope_side == "left" else -slope_deg
            top_center_y = round((slope_start_h + h) / 2.0, 2)
            top_name = f"{label_prefix}Açılı Eğimli Üst Tabla"
            top_notch = f"Çatı Eğimi: {slope_deg:.1f}° ({rot_z:+.1f}°)"
            is_top_sloped = True
        else:
            top_len = inner_w
            rot_z = 0.0
            top_center_y = round(h - t / 2.0, 2)
            top_name = f"{label_prefix}Üst Tabla"
            top_notch = col_notch_str
            is_top_sloped = False

        top_cut_l, top_cut_w, top_ded_l, top_ded_w = cls.compute_cut_dimensions(
            top_len, d, horiz_edge
        )
        alt_cut_l, alt_cut_w, alt_ded_l, alt_ded_w = cls.compute_cut_dimensions(
            inner_w, d, horiz_edge
        )

        top_drills = cls._build_horizontal_panel_drills(
            top_len, d, fastener_type=config.fastener_type
        )
        alt_drills = cls._build_horizontal_panel_drills(
            inner_w, d, fastener_type=config.fastener_type
        )

        top_grooves: list[GroovePath] = []
        alt_grooves: list[GroovePath] = []
        if config.back_panel_type == BackPanelType.GROOVED_8MM:
            top_grooves.append(
                GroovePath(
                    x_start_mm=0.0,
                    y_start_mm=MC.BACK_GROOVE_OFFSET_FROM_REAR_MM,
                    width_mm=top_len,
                    length_mm=MC.BACK_GROOVE_WIDTH_MM,
                    depth_mm=MC.BACK_GROOVE_DEPTH_MM,
                    layer=MC.LAYER_GROOVE_BACK,
                )
            )
            alt_grooves.append(
                GroovePath(
                    x_start_mm=0.0,
                    y_start_mm=MC.BACK_GROOVE_OFFSET_FROM_REAR_MM,
                    width_mm=inner_w,
                    length_mm=MC.BACK_GROOVE_WIDTH_MM,
                    depth_mm=MC.BACK_GROOVE_DEPTH_MM,
                    layer=MC.LAYER_GROOVE_BACK,
                )
            )

        parts.append(
            PanelPart(
                part_id=f"P{part_counter:02d}",
                code=f"{prefix}TABLA_UST",
                name=top_name,
                material=config.body_material,
                thickness_mm=t,
                quantity=1,
                net_length_mm=top_len,
                net_width_mm=d,
                cut_length_mm=top_cut_l,
                cut_width_mm=top_cut_w,
                pvc_deduction_length_mm=top_ded_l,
                pvc_deduction_width_mm=top_ded_w,
                edge_band=horiz_edge,
                area_m2=round((top_len * d) / 1_000_000.0, 4),
                drills=top_drills,
                grooves=top_grooves,
                notch_info=top_notch,
                transform_3d=Box3DTransform(
                    center_x_mm=x_offset_mm,
                    center_y_mm=top_center_y,
                    center_z_mm=0.0,
                    size_x_mm=inner_w,
                    size_y_mm=t,
                    size_z_mm=d,
                    color_hex=config.body_color_hex,
                    module_index=module_idx,
                    rotation_z_deg=rot_z,
                    is_sloped=is_top_sloped,
                ),
            )
        )
        part_counter += 1

        parts.append(
            PanelPart(
                part_id=f"P{part_counter:02d}",
                code=f"{prefix}TABLA_ALT",
                name=(
                    f"{label_prefix}Üst Dolap Alt Tablası (Niş Üstü)"
                    if niche_h > 0.0
                    else f"{label_prefix}Alt Tabla"
                ),
                material=config.body_material,
                thickness_mm=t,
                quantity=1,
                net_length_mm=inner_w,
                net_width_mm=d,
                cut_length_mm=alt_cut_l,
                cut_width_mm=alt_cut_w,
                pvc_deduction_length_mm=alt_ded_l,
                pvc_deduction_width_mm=alt_ded_w,
                edge_band=horiz_edge,
                area_m2=round((inner_w * d) / 1_000_000.0, 4),
                drills=alt_drills,
                grooves=alt_grooves,
                notch_info=col_notch_str,
                transform_3d=Box3DTransform(
                    center_x_mm=x_offset_mm,
                    center_y_mm=round(base_offset_y + t / 2.0, 2),
                    center_z_mm=0.0,
                    size_x_mm=inner_w,
                    size_y_mm=t,
                    size_z_mm=d,
                    color_hex=config.body_color_hex,
                    module_index=module_idx,
                ),
            )
        )
        part_counter += 1

        # Açık Orta Niş Ara Tablaları ve Aksan Arkalığı
        if is_mid_niche:
            # 1. Niş Alt Tablası
            parts.append(
                PanelPart(
                    part_id=f"P{part_counter:02d}",
                    code=f"{prefix}TABLA_ARA_NIS_ALT",
                    name=f"{label_prefix}Açık Niş Alt Tablası",
                    material=config.body_material,
                    thickness_mm=t,
                    quantity=1,
                    net_length_mm=inner_w,
                    net_width_mm=d,
                    cut_length_mm=alt_cut_l,
                    cut_width_mm=alt_cut_w,
                    pvc_deduction_length_mm=alt_ded_l,
                    pvc_deduction_width_mm=alt_ded_w,
                    edge_band=horiz_edge,
                    area_m2=round((inner_w * d) / 1_000_000.0, 4),
                    grain_direction="length",
                    drills=alt_drills,
                    grooves=alt_grooves,
                    transform_3d=Box3DTransform(
                        center_x_mm=x_offset_mm,
                        center_y_mm=round(base_offset_y + t + lower_clear_h + t / 2.0, 2),
                        center_z_mm=0.0,
                        size_x_mm=inner_w,
                        size_y_mm=t,
                        size_z_mm=d,
                        color_hex=config.niche_color_hex or config.body_color_hex,
                        is_niche=True,
                        module_index=module_idx,
                    ),
                )
            )
            part_counter += 1

            # 2. Niş Üst Tablası (varsa)
            if has_upper_niche_shelf:
                parts.append(
                    PanelPart(
                        part_id=f"P{part_counter:02d}",
                        code=f"{prefix}TABLA_ARA_NIS_UST",
                        name=f"{label_prefix}Açık Niş Üst Tablası (Üst Dolap Tabanı)",
                        material=config.body_material,
                        thickness_mm=t,
                        quantity=1,
                        net_length_mm=inner_w,
                        net_width_mm=d,
                        cut_length_mm=alt_cut_l,
                        cut_width_mm=alt_cut_w,
                        pvc_deduction_length_mm=alt_ded_l,
                        pvc_deduction_width_mm=alt_ded_w,
                        edge_band=horiz_edge,
                        area_m2=round((inner_w * d) / 1_000_000.0, 4),
                        grain_direction="length",
                        drills=alt_drills,
                        grooves=alt_grooves,
                        transform_3d=Box3DTransform(
                            center_x_mm=x_offset_mm,
                            center_y_mm=round(base_offset_y + t + lower_clear_h + t + mid_niche_h + t / 2.0, 2),
                            center_z_mm=0.0,
                            size_x_mm=inner_w,
                            size_y_mm=t,
                            size_z_mm=d,
                            color_hex=config.niche_color_hex or config.body_color_hex,
                            is_niche=True,
                            module_index=module_idx,
                        ),
                    )
                )
                part_counter += 1

            # 3. Niş Aksan Arkalığı (Eğer niche_back_open false ve niche_color_hex tanımlıysa)
            if not config.niche_back_open and config.niche_color_hex:
                liner_z = (
                    round(-d / 2.0 + MC.BACK_GROOVE_OFFSET_FROM_REAR_MM + MC.BACK_GROOVE_WIDTH_MM / 2.0, 2)
                    if config.back_panel_type == BackPanelType.GROOVED_8MM
                    else round(-d / 2.0 - 4.0, 2)
                )
                parts.append(
                    PanelPart(
                        part_id=f"P{part_counter:02d}",
                        code=f"{prefix}ARKALIK_NIS_AKSAN",
                        name=f"{label_prefix}Açık Niş Arka Aksan Paneli",
                        material="8mm Kontrast MDF-Lam",
                        thickness_mm=8.0,
                        quantity=1,
                        net_length_mm=mid_niche_h,
                        net_width_mm=inner_w,
                        cut_length_mm=mid_niche_h,
                        cut_width_mm=inner_w,
                        pvc_deduction_length_mm=0.0,
                        pvc_deduction_width_mm=0.0,
                        edge_band=EdgeBandSpec(length_1_mm=0.0, length_2_mm=0.0, width_1_mm=0.0, width_2_mm=0.0),
                        area_m2=round((mid_niche_h * inner_w) / 1_000_000.0, 4),
                        grain_direction="length",
                        drills=[],
                        grooves=[],
                        transform_3d=Box3DTransform(
                            center_x_mm=x_offset_mm,
                            center_y_mm=round(base_offset_y + t + lower_clear_h + t + mid_niche_h / 2.0, 2),
                            center_z_mm=liner_z,
                            size_x_mm=inner_w,
                            size_y_mm=mid_niche_h,
                            size_z_mm=8.0,
                            color_hex=config.niche_color_hex,
                            is_niche=True,
                            module_index=module_idx,
                        ),
                    )
                )
                part_counter += 1

        # 3. Alt Baza Kayıtları (Cihaz alt nişi yoksa)
        if config.has_plinth and plinth_h > 0.0 and not is_bottom_niche:
            is_adjustable_legs = config.plinth_type == PlinthType.ADJUSTABLE_LEGS
            plinth_edge = EdgeBandSpec(
                length_1_mm=config.hidden_pvc_thickness_mm,
                length_2_mm=config.hidden_pvc_thickness_mm,
                width_1_mm=0.0,
                width_2_mm=0.0,
            )
            plinth_cut_l, plinth_cut_w, p_ded_l, p_ded_w = cls.compute_cut_dimensions(
                inner_w, plinth_h, plinth_edge
            )
            plinth_records = (
                [("ON", "Ön Klipsli (Ayarlı Ayak)", round(d / 2.0 - 25.0, 2))]
                if is_adjustable_legs
                else [
                    ("ON", "Ön", round(d / 2.0 - 25.0, 2)),
                    ("ARKA", "Arka", round(-d / 2.0 + 25.0, 2)),
                ]
            )
            for code_suffix, baza_label, z_pos in plinth_records:
                parts.append(
                    PanelPart(
                        part_id=f"P{part_counter:02d}",
                        code=f"{prefix}BAZA_{code_suffix}",
                        name=f"{label_prefix}{baza_label} Baza Kaydı",
                        material=config.body_material,
                        thickness_mm=t,
                        quantity=1,
                        net_length_mm=inner_w,
                        net_width_mm=plinth_h,
                        cut_length_mm=plinth_cut_l,
                        cut_width_mm=plinth_cut_w,
                        pvc_deduction_length_mm=p_ded_l,
                        pvc_deduction_width_mm=p_ded_w,
                        edge_band=plinth_edge,
                        area_m2=round((inner_w * plinth_h) / 1_000_000.0, 4),
                        drills=[],
                        grooves=[],
                        transform_3d=Box3DTransform(
                            center_x_mm=x_offset_mm,
                            center_y_mm=round(plinth_h / 2.0, 2),
                            center_z_mm=z_pos,
                            size_x_mm=inner_w,
                            size_y_mm=plinth_h,
                            size_z_mm=t,
                            color_hex=config.body_color_hex,
                            module_index=module_idx,
                        ),
                    )
                )
                part_counter += 1

        # 6. Arkalık Paneli
        no_edge = EdgeBandSpec(
            length_1_mm=0.0, length_2_mm=0.0, width_1_mm=0.0, width_2_mm=0.0
        )
        if config.back_panel_type == BackPanelType.GROOVED_8MM:
            back_t = MC.BACK_PANEL_GROOVED_THICKNESS_MM
            back_mat = "8mm Beyaz MDF-Lam Arkalık"
            back_l = round(
                clear_inner_h + (2.0 * MC.BACK_PANEL_INSERTION_PER_SIDE_MM), 2
            )
            back_w = round(inner_w + (2.0 * MC.BACK_PANEL_INSERTION_PER_SIDE_MM), 2)
            back_z = round(
                -d / 2.0
                + MC.BACK_GROOVE_OFFSET_FROM_REAR_MM
                + MC.BACK_GROOVE_WIDTH_MM / 2.0,
                2,
            )
        else:
            back_t = MC.BACK_PANEL_NAILED_THICKNESS_MM
            back_mat = "3mm Beyaz Duralit Arkalık"
            back_l = round(h - base_offset_y - 4.0, 2)
            back_w = round(w - 4.0, 2)
            back_z = round(-d / 2.0 - back_t / 2.0, 2)

        if is_mid_niche and config.niche_back_open:
            lower_back_l = round(lower_clear_h + t, 2)
            parts.append(
                PanelPart(
                    part_id=f"P{part_counter:02d}",
                    code=f"{prefix}ARKALIK_ALT",
                    name=f"{label_prefix}Alt Bölme Arkalık Paneli",
                    material=back_mat,
                    thickness_mm=back_t,
                    quantity=1,
                    net_length_mm=lower_back_l,
                    net_width_mm=back_w,
                    cut_length_mm=lower_back_l,
                    cut_width_mm=back_w,
                    pvc_deduction_length_mm=0.0,
                    pvc_deduction_width_mm=0.0,
                    edge_band=no_edge,
                    area_m2=round((lower_back_l * back_w) / 1_000_000.0, 4),
                    drills=[],
                    grooves=[],
                    transform_3d=Box3DTransform(
                        center_x_mm=x_offset_mm,
                        center_y_mm=round(base_offset_y + lower_back_l / 2.0, 2),
                        center_z_mm=back_z,
                        size_x_mm=back_w,
                        size_y_mm=lower_back_l,
                        size_z_mm=back_t,
                        color_hex="#E5E0D5",
                        module_index=module_idx,
                    ),
                )
            )
            part_counter += 1

            if has_upper_niche_shelf and upper_clear_h >= 80.0:
                upper_back_l = round(upper_clear_h + t, 2)
                parts.append(
                    PanelPart(
                        part_id=f"P{part_counter:02d}",
                        code=f"{prefix}ARKALIK_UST",
                        name=f"{label_prefix}Üst Bölme Arkalık Paneli",
                        material=back_mat,
                        thickness_mm=back_t,
                        quantity=1,
                        net_length_mm=upper_back_l,
                        net_width_mm=back_w,
                        cut_length_mm=upper_back_l,
                        cut_width_mm=back_w,
                        pvc_deduction_length_mm=0.0,
                        pvc_deduction_width_mm=0.0,
                        edge_band=no_edge,
                        area_m2=round((upper_back_l * back_w) / 1_000_000.0, 4),
                        drills=[],
                        grooves=[],
                        transform_3d=Box3DTransform(
                            center_x_mm=x_offset_mm,
                            center_y_mm=round(h - upper_back_l / 2.0, 2),
                            center_z_mm=back_z,
                            size_x_mm=back_w,
                            size_y_mm=upper_back_l,
                            size_z_mm=back_t,
                            color_hex="#E5E0D5",
                            module_index=module_idx,
                        ),
                    )
                )
                part_counter += 1
        else:
            trap_h_start = slope_start_h if (has_slope and slope_side == "left") else h
            trap_h_end = h if (has_slope and slope_side == "left") else slope_start_h
            arkalik_notch = (
                f"[ACILI-CATI-EGIMI] {slope_side.upper()} {trap_h_start:.0f}➔{trap_h_end:.0f}mm"
                if has_slope
                else ""
            )

            parts.append(
                PanelPart(
                    part_id=f"P{part_counter:02d}",
                    code=f"{prefix}ARKALIK",
                    name=(
                        f"{label_prefix}Eğimli Çatı Arkalık Paneli"
                        if has_slope
                        else (
                            f"{label_prefix}Üst Dolap Arkalık Paneli"
                            if niche_h > 0.0
                            else f"{label_prefix}Arkalık Paneli"
                        )
                    ),
                    material=back_mat,
                    thickness_mm=back_t,
                    quantity=1,
                    net_length_mm=back_l,
                    net_width_mm=back_w,
                    cut_length_mm=back_l,
                    cut_width_mm=back_w,
                    pvc_deduction_length_mm=0.0,
                    pvc_deduction_width_mm=0.0,
                    edge_band=no_edge,
                    area_m2=round((back_l * back_w) / 1_000_000.0, 4),
                    drills=[],
                    grooves=[],
                    notch_info=arkalik_notch,
                    is_trapezoid=has_slope,
                    trapezoid_h_start_mm=trap_h_start if has_slope else None,
                    trapezoid_h_end_mm=trap_h_end if has_slope else None,
                    transform_3d=Box3DTransform(
                        center_x_mm=x_offset_mm,
                        center_y_mm=round(base_offset_y + (h - base_offset_y) / 2.0, 2),
                        center_z_mm=back_z,
                        size_x_mm=back_w,
                        size_y_mm=back_l,
                        size_z_mm=back_t,
                        color_hex="#E5E0D5",
                        module_index=module_idx,
                    ),
                )
            )
            part_counter += 1


        total_handles = 0
        total_hinges = 0
        has_zones = bool(
            config.zones
            and (len(config.zones) > 1 or any(z.has_hanging_rod for z in config.zones))
        )

        if has_zones:
            (
                z_parts,
                part_counter,
                total_handles,
                total_hinges,
                _z_gas,
            ) = cls._generate_zones_parts(
                config=config,
                module_idx=module_idx,
                x_offset_mm=x_offset_mm,
                start_part_counter=part_counter,
                multi_mode=multi_mode,
            )
            parts.extend(z_parts)
        else:
            # 4. Çekmece Kasa ve Klapaları (Varsa)
            total_handles = 0
            if drawer_count > 0:
                slide_len = cls.select_drawer_slide_length(d)
                box_h = round(max(80.0, drawer_front_h - MC.DRAWER_BOX_HEIGHT_REDUCTION_MM), 2)
                box_inner_w = round(
                    inner_w - MC.DRAWER_SLIDE_CLEARANCE_TOTAL_MM - (2.0 * t), 2
                )
                front_net_w = round(w - (2.0 * MC.DOOR_OUTER_GAP_MM), 2)
                front_net_h = round(drawer_front_h - MC.DOOR_CENTER_GAP_MM, 2)

                front_edge = EdgeBandSpec(
                    length_1_mm=config.front_pvc_thickness_mm,
                    length_2_mm=config.front_pvc_thickness_mm,
                    width_1_mm=config.front_pvc_thickness_mm,
                    width_2_mm=config.front_pvc_thickness_mm,
                )
                f_cut_l, f_cut_w, f_ded_l, f_ded_w = cls.compute_cut_dimensions(
                    front_net_w, front_net_h, front_edge
                )

                box_edge = EdgeBandSpec(
                    length_1_mm=config.hidden_pvc_thickness_mm,
                    length_2_mm=0.0,
                    width_1_mm=0.0,
                    width_2_mm=0.0,
                )
                bs_cut_l, bs_cut_w, bs_ded_l, bs_ded_w = cls.compute_cut_dimensions(
                    slide_len, box_h, box_edge
                )
                bf_cut_l, bf_cut_w, bf_ded_l, bf_ded_w = cls.compute_cut_dimensions(
                    box_inner_w, box_h, box_edge
                )

                no_edge = EdgeBandSpec(
                    length_1_mm=0.0, length_2_mm=0.0, width_1_mm=0.0, width_2_mm=0.0
                )
                bottom_w = round(box_inner_w + 15.0, 2)
                bottom_l = round(slide_len - (2.0 * t) + 15.0, 2)

                for d_idx in range(1, drawer_count + 1):
                    center_y = round(
                        base_offset_y
                        + t
                        + ((d_idx - 0.5) * drawer_front_h),
                        2,
                    )
                    klapa_z = round(d / 2.0 + t / 2.0 + 1.5, 2)
                    box_z = round((d / 2.0) - (slide_len / 2.0) - 5.0, 2)
                    total_handles += 1

                    # 4a. Çekmece Ön Klapası
                    parts.append(
                        PanelPart(
                            part_id=f"P{part_counter:02d}",
                            code=f"{prefix}CEK_KLAPA_{d_idx:02d}",
                            name=f"{label_prefix}Çekmece #{d_idx} Ön Klapası",
                            material=door_mat,
                            thickness_mm=t,
                            quantity=1,
                            net_length_mm=front_net_w,
                            net_width_mm=front_net_h,
                            cut_length_mm=f_cut_l,
                            cut_width_mm=f_cut_w,
                            pvc_deduction_length_mm=f_ded_l,
                            pvc_deduction_width_mm=f_ded_w,
                            edge_band=front_edge,
                            area_m2=round((front_net_w * front_net_h) / 1_000_000.0, 4),
                            drills=[],
                            grooves=[],
                            transform_3d=Box3DTransform(
                                center_x_mm=x_offset_mm,
                                center_y_mm=center_y,
                                center_z_mm=klapa_z,
                                size_x_mm=front_net_w,
                                size_y_mm=front_net_h,
                                size_z_mm=t,
                                color_hex=config.door_color_hex,
                                is_drawer=True,
                                module_index=module_idx,
                            ),
                        )
                    )
                    part_counter += 1

                    # 4b. Çekmece Yan Kasaları (Sol & Sağ)
                    for s_code, s_name, sx_sign in (
                        ("SOL", "Sol Yan Kasa", -1.0),
                        ("SAG", "Sağ Yan Kasa", 1.0),
                    ):
                        side_box_x = round(
                            x_offset_mm
                            + sx_sign * ((box_inner_w / 2.0) + (t / 2.0)),
                            2,
                        )
                        parts.append(
                            PanelPart(
                                part_id=f"P{part_counter:02d}",
                                code=f"{prefix}CEK_{d_idx:02d}_YAN_{s_code}",
                                name=f"{label_prefix}Çekmece #{d_idx} {s_name}",
                                material=config.body_material,
                                thickness_mm=t,
                                quantity=1,
                                net_length_mm=slide_len,
                                net_width_mm=box_h,
                                cut_length_mm=bs_cut_l,
                                cut_width_mm=bs_cut_w,
                                pvc_deduction_length_mm=bs_ded_l,
                                pvc_deduction_width_mm=bs_ded_w,
                                edge_band=box_edge,
                                area_m2=round((slide_len * box_h) / 1_000_000.0, 4),
                                drills=[],
                                grooves=[],
                                transform_3d=Box3DTransform(
                                    center_x_mm=side_box_x,
                                    center_y_mm=center_y,
                                    center_z_mm=box_z,
                                    size_x_mm=t,
                                    size_y_mm=box_h,
                                    size_z_mm=slide_len,
                                    color_hex=config.body_color_hex,
                                    is_drawer=True,
                                    module_index=module_idx,
                                ),
                            )
                        )
                        part_counter += 1

                    # 4c. Çekmece İç Ön ve Arka Kasa
                    for fb_code, fb_name, fbz in (
                        ("ON", "İç Ön Kasa", round(box_z + slide_len / 2.0 - t / 2.0, 2)),
                        (
                            "ARKA",
                            "İç Arka Kasa",
                            round(box_z - slide_len / 2.0 + t / 2.0, 2),
                        ),
                    ):
                        parts.append(
                            PanelPart(
                                part_id=f"P{part_counter:02d}",
                                code=f"{prefix}CEK_{d_idx:02d}_{fb_code}",
                                name=f"{label_prefix}Çekmece #{d_idx} {fb_name}",
                                material=config.body_material,
                                thickness_mm=t,
                                quantity=1,
                                net_length_mm=box_inner_w,
                                net_width_mm=box_h,
                                cut_length_mm=bf_cut_l,
                                cut_width_mm=bf_cut_w,
                                pvc_deduction_length_mm=bf_ded_l,
                                pvc_deduction_width_mm=bf_ded_w,
                                edge_band=box_edge,
                                area_m2=round((box_inner_w * box_h) / 1_000_000.0, 4),
                                drills=[],
                                grooves=[],
                                transform_3d=Box3DTransform(
                                    center_x_mm=x_offset_mm,
                                    center_y_mm=center_y,
                                    center_z_mm=fbz,
                                    size_x_mm=box_inner_w,
                                    size_y_mm=box_h,
                                    size_z_mm=t,
                                    color_hex=config.body_color_hex,
                                    is_drawer=True,
                                    module_index=module_idx,
                                ),
                            )
                        )
                        part_counter += 1

                    # 4d. Çekmece Tabanı (8 mm MDF-Lam)
                    parts.append(
                        PanelPart(
                            part_id=f"P{part_counter:02d}",
                            code=f"{prefix}CEK_{d_idx:02d}_TABAN",
                            name=f"{label_prefix}Çekmece #{d_idx} Alt Tabanı (8mm)",
                            material="8mm Beyaz MDF-Lam Arkalık",
                            thickness_mm=MC.BACK_PANEL_GROOVED_THICKNESS_MM,
                            quantity=1,
                            net_length_mm=bottom_w,
                            net_width_mm=bottom_l,
                            cut_length_mm=bottom_w,
                            cut_width_mm=bottom_l,
                            pvc_deduction_length_mm=0.0,
                            pvc_deduction_width_mm=0.0,
                            edge_band=no_edge,
                            area_m2=round((bottom_w * bottom_l) / 1_000_000.0, 4),
                            drills=[],
                            grooves=[],
                            transform_3d=Box3DTransform(
                                center_x_mm=x_offset_mm,
                                center_y_mm=round(center_y - box_h / 2.0 + 8.0, 2),
                                center_z_mm=box_z,
                                size_x_mm=bottom_w,
                                size_y_mm=MC.BACK_PANEL_GROOVED_THICKNESS_MM,
                                size_z_mm=bottom_l,
                                color_hex="#E5E0D5",
                                is_drawer=True,
                                module_index=module_idx,
                            ),
                        )
                    )
                    part_counter += 1

            # 5. Hareketli Raflar
            remaining_clear_h = round(clear_inner_h - drawer_zone_h, 2)
            shelf_avail_space = upper_clear_h if is_mid_niche else remaining_clear_h
            if config.shelf_count > 0 and shelf_avail_space > 120.0:
                shelf_net_l = round(inner_w - MC.SHELF_WIDTH_CLEARANCE_MM, 2)
                if config.back_panel_type == BackPanelType.GROOVED_8MM:
                    rear_loss = MC.BACK_GROOVE_OFFSET_FROM_REAR_MM + MC.BACK_GROOVE_WIDTH_MM
                else:
                    rear_loss = 0.0
                shelf_net_w = round(d - rear_loss - MC.SHELF_FRONT_SETBACK_MM, 2)

                shelf_edge = EdgeBandSpec(
                    length_1_mm=config.front_pvc_thickness_mm,
                    length_2_mm=config.hidden_pvc_thickness_mm,
                    width_1_mm=config.hidden_pvc_thickness_mm,
                    width_2_mm=config.hidden_pvc_thickness_mm,
                )
                s_cut_l, s_cut_w, s_ded_l, s_ded_w = cls.compute_cut_dimensions(
                    shelf_net_l, shelf_net_w, shelf_edge
                )

                step_h = shelf_avail_space / (config.shelf_count + 1)
                shelf_z_center = round((rear_loss - MC.SHELF_FRONT_SETBACK_MM) / 2.0, 2)
                shelf_base_y = (
                    round(base_offset_y + t + lower_clear_h + t + mid_niche_h + t, 2)
                    if is_mid_niche
                    else round(base_offset_y + t + drawer_zone_h, 2)
                )

                for s_idx in range(1, config.shelf_count + 1):
                    shelf_y = round(shelf_base_y + (s_idx * step_h), 2)
                    parts.append(
                        PanelPart(
                            part_id=f"P{part_counter:02d}",
                            code=f"{prefix}RAF_{s_idx:02d}",
                            name=f"{label_prefix}Hareketli Raf #{s_idx}",
                            material=config.body_material,
                            thickness_mm=t,
                            quantity=1,
                            net_length_mm=shelf_net_l,
                            net_width_mm=shelf_net_w,
                            cut_length_mm=s_cut_l,
                            cut_width_mm=s_cut_w,
                            pvc_deduction_length_mm=s_ded_l,
                            pvc_deduction_width_mm=s_ded_w,
                            edge_band=shelf_edge,
                            area_m2=round((shelf_net_l * shelf_net_w) / 1_000_000.0, 4),
                            drills=[],
                            grooves=[],
                            transform_3d=Box3DTransform(
                                center_x_mm=x_offset_mm,
                                center_y_mm=shelf_y,
                                center_z_mm=shelf_z_center,
                                size_x_mm=shelf_net_l,
                                size_y_mm=t,
                                size_z_mm=shelf_net_w,
                                color_hex=config.body_color_hex,
                                module_index=module_idx,
                            ),
                        )
                    )
                    part_counter += 1

            # 7. Kapaklar
            total_hinges = 0

            def _build_cavity_doors(
                avail_h: float,
                y_center: float,
                code_suffix: str = "",
                name_prefix: str = "",
            ) -> None:
                nonlocal part_counter, total_hinges, total_handles
                if config.door_type == DoorType.NONE or avail_h < 180.0:
                    return

                door_net_h = round(avail_h - (2.0 * MC.DOOR_OUTER_GAP_MM), 2)
                door_edge = EdgeBandSpec(
                    length_1_mm=config.front_pvc_thickness_mm,
                    length_2_mm=config.front_pvc_thickness_mm,
                    width_1_mm=config.front_pvc_thickness_mm,
                    width_2_mm=config.front_pvc_thickness_mm,
                )
                door_z_center = round(d / 2.0 + t / 2.0 + 1.5, 2)
                code_mid = f"{code_suffix}_" if code_suffix else ""

                if config.door_type == DoorType.FLAP_UP:
                    door_net_w = round(w - (2.0 * MC.DOOR_OUTER_GAP_MM), 2)
                    d_cut_l, d_cut_w, d_ded_l, d_ded_w = cls.compute_cut_dimensions(
                        door_net_h, door_net_w, door_edge
                    )
                    top_hinge_x = round(door_net_h - MC.HINGE_CUP_CENTER_FROM_EDGE_MM, 2)
                    hinge_drills = [
                        DrillPoint(
                            x_mm=top_hinge_x,
                            y_mm=100.0,
                            diameter_mm=MC.HINGE_CUP_DIAMETER_MM,
                            depth_mm=MC.HINGE_CUP_DEPTH_MM,
                            layer=MC.LAYER_HINGE_CUP,
                            description=f"{name_prefix}Üst Kalkar Kapak Sol Tas Menteşe Yuvası (Ø35mm)",
                        ),
                        DrillPoint(
                            x_mm=top_hinge_x,
                            y_mm=round(door_net_w - 100.0, 2),
                            diameter_mm=MC.HINGE_CUP_DIAMETER_MM,
                            depth_mm=MC.HINGE_CUP_DEPTH_MM,
                            layer=MC.LAYER_HINGE_CUP,
                            description=f"{name_prefix}Üst Kalkar Kapak Sağ Tas Menteşe Yuvası (Ø35mm)",
                        ),
                    ]
                    total_hinges += 2
                    total_handles += 1

                    parts.append(
                        PanelPart(
                            part_id=f"P{part_counter:02d}",
                            code=f"{prefix}KAPAK_{code_mid}KALKAR",
                            name=f"{label_prefix}{name_prefix}Kalkar Kapak (Gazlı Pistonlu)",
                            material=door_mat,
                            thickness_mm=t,
                            quantity=1,
                            net_length_mm=door_net_h,
                            net_width_mm=door_net_w,
                            cut_length_mm=d_cut_l,
                            cut_width_mm=d_cut_w,
                            pvc_deduction_length_mm=d_ded_l,
                            pvc_deduction_width_mm=d_ded_w,
                            edge_band=door_edge,
                            area_m2=round((door_net_h * door_net_w) / 1_000_000.0, 4),
                            drills=hinge_drills,
                            grooves=[],
                            transform_3d=Box3DTransform(
                                center_x_mm=x_offset_mm,
                                center_y_mm=y_center,
                                center_z_mm=door_z_center,
                                size_x_mm=door_net_w,
                                size_y_mm=door_net_h,
                                size_z_mm=t,
                                color_hex=config.door_color_hex,
                                is_door=True,
                                hinge_side="top",
                                module_index=module_idx,
                            ),
                        )
                    )
                    part_counter += 1
                elif config.door_type in (DoorType.SINGLE_LEFT, DoorType.SINGLE_RIGHT):
                    door_net_w = round(w - (2.0 * MC.DOOR_OUTER_GAP_MM), 2)
                    d_cut_l, d_cut_w, d_ded_l, d_ded_w = cls.compute_cut_dimensions(
                        door_net_h, door_net_w, door_edge
                    )
                    hinge_left = config.door_type == DoorType.SINGLE_LEFT
                    hinge_drills = cls._build_door_hinge_drills(
                        door_net_h, door_net_w, hinge_on_left=hinge_left
                    )
                    total_hinges += len(hinge_drills)
                    total_handles += 1

                    parts.append(
                        PanelPart(
                            part_id=f"P{part_counter:02d}",
                            code=f"{prefix}KAPAK_{code_mid}TEK",
                            name=(
                                f"{label_prefix}{name_prefix}Tek Kapak (Sol Menteşeli)"
                                if hinge_left
                                else f"{label_prefix}{name_prefix}Tek Kapak (Sağ Menteşeli)"
                            ),
                            material=door_mat,
                            thickness_mm=t,
                            quantity=1,
                            net_length_mm=door_net_h,
                            net_width_mm=door_net_w,
                            cut_length_mm=d_cut_l,
                            cut_width_mm=d_cut_w,
                            pvc_deduction_length_mm=d_ded_l,
                            pvc_deduction_width_mm=d_ded_w,
                            edge_band=door_edge,
                            area_m2=round((door_net_h * door_net_w) / 1_000_000.0, 4),
                            drills=hinge_drills,
                            grooves=[],
                            transform_3d=Box3DTransform(
                                center_x_mm=x_offset_mm,
                                center_y_mm=y_center,
                                center_z_mm=door_z_center,
                                size_x_mm=door_net_w,
                                size_y_mm=door_net_h,
                                size_z_mm=t,
                                color_hex=config.door_color_hex,
                                is_door=True,
                                hinge_side="left" if hinge_left else "right",
                                module_index=module_idx,
                            ),
                        )
                    )
                    part_counter += 1
                elif config.door_type == DoorType.DOUBLE:
                    door_net_w = round(
                        (w - (2.0 * MC.DOOR_OUTER_GAP_MM) - MC.DOOR_CENTER_GAP_MM) / 2.0,
                        2,
                    )
                    d_cut_l, d_cut_w, d_ded_l, d_ded_w = cls.compute_cut_dimensions(
                        door_net_h, door_net_w, door_edge
                    )
                    for side_code, side_label, is_left, rel_cx in (
                        (
                            "SOL",
                            "Sol Kapak",
                            True,
                            -(door_net_w / 2.0 + MC.DOOR_CENTER_GAP_MM / 2.0),
                        ),
                        (
                            "SAG",
                            "Sağ Kapak",
                            False,
                            door_net_w / 2.0 + MC.DOOR_CENTER_GAP_MM / 2.0,
                        ),
                    ):
                        hinge_drills = cls._build_door_hinge_drills(
                            door_net_h, door_net_w, hinge_on_left=is_left
                        )
                        total_hinges += len(hinge_drills)
                        total_handles += 1
                        parts.append(
                            PanelPart(
                                part_id=f"P{part_counter:02d}",
                                code=f"{prefix}KAPAK_{code_mid}{side_code}",
                                name=f"{label_prefix}{name_prefix}{side_label}",
                                material=door_mat,
                                thickness_mm=t,
                                quantity=1,
                                net_length_mm=door_net_h,
                                net_width_mm=door_net_w,
                                cut_length_mm=d_cut_l,
                                cut_width_mm=d_cut_w,
                                pvc_deduction_length_mm=d_ded_l,
                                pvc_deduction_width_mm=d_ded_w,
                                edge_band=door_edge,
                                area_m2=round((door_net_h * door_net_w) / 1_000_000.0, 4),
                                drills=hinge_drills,
                                grooves=[],
                                transform_3d=Box3DTransform(
                                    center_x_mm=round(x_offset_mm + rel_cx, 2),
                                    center_y_mm=y_center,
                                    center_z_mm=door_z_center,
                                    size_x_mm=door_net_w,
                                    size_y_mm=door_net_h,
                                    size_z_mm=t,
                                    color_hex=config.door_color_hex,
                                    is_door=True,
                                    hinge_side="left" if is_left else "right",
                                    module_index=module_idx,
                                ),
                            )
                        )
                        part_counter += 1

            if is_mid_niche:
                if drawer_count == 0 and lower_clear_h >= 180.0:
                    _build_cavity_doors(
                        round(lower_clear_h + t, 2),
                        round(base_offset_y + t / 2.0 + lower_clear_h / 2.0, 2),
                        "ALT",
                        "Alt ",
                    )
                if has_upper_niche_shelf and upper_clear_h >= 180.0:
                    _build_cavity_doors(
                        round(upper_clear_h + t, 2),
                        round(base_offset_y + t + lower_clear_h + t + mid_niche_h + t / 2.0 + upper_clear_h / 2.0, 2),
                        "UST",
                        "Üst ",
                    )
            else:
                door_avail_h = round((h - base_offset_y - drawer_zone_h), 2)
                if door_avail_h >= 240.0:
                    _build_cavity_doors(
                        door_avail_h,
                        round(base_offset_y + drawer_zone_h + (door_avail_h / 2.0), 2),
                        "",
                        "",
                    )

        # 8. Şantiye Rölöve Duvar Kapama Payları (Scribing Fillers / Kör Çıtalar)
        filler_edge = EdgeBandSpec(
            length_1_mm=config.front_pvc_thickness_mm,
            length_2_mm=0.0,
            width_1_mm=config.hidden_pvc_thickness_mm,
            width_2_mm=config.hidden_pvc_thickness_mm,
        )
        for f_code, f_label, f_w, f_cx in (
            (
                "SOL",
                "Sol Duvar Rölöve Kör Çıtası (Scribing Filler)",
                config.left_filler_width_mm,
                round(x_offset_mm - w / 2.0 - config.left_filler_width_mm / 2.0, 2),
            ),
            (
                "SAG",
                "Sağ Duvar Rölöve Kör Çıtası (Scribing Filler)",
                config.right_filler_width_mm,
                round(x_offset_mm + w / 2.0 + config.right_filler_width_mm / 2.0, 2),
            ),
        ):
            if f_w >= 15.0:
                fc_l, fc_w, fd_l, fd_w = cls.compute_cut_dimensions(h, f_w, filler_edge)
                parts.append(
                    PanelPart(
                        part_id=f"P{part_counter:02d}",
                        code=f"{prefix}KOR_CITA_{f_code}",
                        name=f"{label_prefix}{f_label}",
                        material=door_mat,
                        thickness_mm=t,
                        quantity=1,
                        net_length_mm=h,
                        net_width_mm=f_w,
                        cut_length_mm=fc_l,
                        cut_width_mm=fc_w,
                        pvc_deduction_length_mm=fd_l,
                        pvc_deduction_width_mm=fd_w,
                        edge_band=filler_edge,
                        area_m2=round((h * f_w) / 1_000_000.0, 4),
                        drills=[],
                        grooves=[],
                        notch_info="Şantiye Duvar Alıştırma Payı (Scribing)",
                        transform_3d=Box3DTransform(
                            center_x_mm=f_cx,
                            center_y_mm=round(h / 2.0, 2),
                            center_z_mm=round(d / 2.0 - t / 2.0, 2),
                            size_x_mm=f_w,
                            size_y_mm=h,
                            size_z_mm=t,
                            color_hex=config.door_color_hex,
                            module_index=module_idx,
                        ),
                    )
                )
                part_counter += 1

        # L-Köşe Dönüş Kör Paneli
        if getattr(config, "is_corner_module", False):
            corner_w = float(getattr(config, "corner_blind_width_mm", 100.0) or 100.0)
            corner_edge = EdgeBandSpec(
                length_1_mm=config.front_pvc_thickness_mm,
                length_2_mm=0.0,
                width_1_mm=0.0,
                width_2_mm=0.0,
            )
            cc_l, cc_w, cd_l, cd_w = cls.compute_cut_dimensions(h, corner_w, corner_edge)
            parts.append(
                PanelPart(
                    part_id=f"P{part_counter:02d}",
                    code=f"{prefix}KOR_KAPAMA_KOSE",
                    name=f"{label_prefix}L-Köşe Kör Kapama Paneli",
                    material=door_mat,
                    thickness_mm=t,
                    quantity=1,
                    net_length_mm=h,
                    net_width_mm=corner_w,
                    cut_length_mm=cc_l,
                    cut_width_mm=cc_w,
                    pvc_deduction_length_mm=cd_l,
                    pvc_deduction_width_mm=cd_w,
                    edge_band=corner_edge,
                    area_m2=round((h * corner_w) / 1_000_000.0, 4),
                    drills=[],
                    grooves=[],
                    notch_info=f"L-Köşe {getattr(config, 'corner_angle_deg', 90.0):.0f}° Dönüş Kör Paneli",
                    transform_3d=Box3DTransform(
                        center_x_mm=round(x_offset_mm + w / 2.0 - corner_w / 2.0, 2),
                        center_y_mm=round(h / 2.0, 2),
                        center_z_mm=round(d / 2.0 - t / 2.0, 2),
                        size_x_mm=corner_w,
                        size_y_mm=h,
                        size_z_mm=t,
                        color_hex=config.door_color_hex,
                        module_index=module_idx,
                        corner_rotation_y_deg=float(getattr(config, "corner_angle_deg", 90.0) or 90.0),
                    ),
                )
            )
            part_counter += 1

        conn_count_per_corner = len(cls._connection_depth_coords(d))
        divider_count = max(0, len(config.zones) - 1) if has_zones else 0
        effective_drawers = (
            sum(z.drawer_count or 0 for z in config.zones)
            if has_zones
            else drawer_count
        )
        intermediate_shelf_conn_units = (
            (2 if has_upper_niche_shelf else 1) * (conn_count_per_corner * 2)
            if is_mid_niche
            else 0
        )
        base_conn_units = (
            conn_count_per_corner * 4
            + (divider_count * conn_count_per_corner * 2)
            + (effective_drawers * 4)
            + intermediate_shelf_conn_units
        )
        is_adjustable_legs = config.plinth_type == PlinthType.ADJUSTABLE_LEGS
        adjustable_legs_count = (
            4
            if (config.has_plinth and plinth_h > 0.0 and not is_bottom_niche and is_adjustable_legs)
            else 0
        )
        cabineo_count = (
            base_conn_units
            if config.fastener_type == FastenerType.CABINEO_12
            else 0
        )
        minifix_sets = (
            0
            if config.fastener_type == FastenerType.CABINEO_12
            else base_conn_units
        )
        dowel_count = (
            0
            if config.fastener_type == FastenerType.CABINEO_12
            else base_conn_units + (8 if (config.has_plinth and not is_bottom_niche and not is_adjustable_legs) else 0)
        )

        return (
            parts,
            part_counter,
            minifix_sets,
            dowel_count,
            cabineo_count,
            adjustable_legs_count,
            total_hinges,
            total_handles,
        )

    @classmethod
    def generate_bom(cls, config: CabinetConfig) -> BOMReport:
        """Tekil modül veya çoklu modül oda hattından birleşik BOM ve CNC verisi üretir."""
        all_modules: list[CabinetConfig] = [config, *config.additional_modules]
        multi_mode = len(all_modules) > 1

        total_line_width = sum(m.width_mm for m in all_modules)
        current_left_x = -total_line_width / 2.0

        parts: list[PanelPart] = []
        part_counter = 1
        total_minifix = 0
        total_dowels = 0
        total_cabineo = 0
        total_adjustable_legs = 0
        total_hinges = 0
        total_handles = 0
        total_shelf_pins = 0
        total_drawer_slides = 0

        for idx, mod_cfg in enumerate(all_modules, start=1):
            center_x_offset = round(current_left_x + (mod_cfg.width_mm / 2.0), 2)
            current_left_x += mod_cfg.width_mm

            (
                mod_parts,
                part_counter,
                m_minifix,
                m_dowels,
                m_cabineo,
                m_adj_legs,
                m_hinges,
                m_handles,
            ) = cls._generate_single_module_parts(
                config=mod_cfg,
                module_idx=idx,
                x_offset_mm=center_x_offset,
                start_part_counter=part_counter,
                multi_mode=multi_mode,
            )
            parts.extend(mod_parts)
            total_minifix += m_minifix
            total_dowels += m_dowels
            total_cabineo += m_cabineo
            total_adjustable_legs += m_adj_legs
            total_hinges += m_hinges
            total_handles += m_handles
            if mod_cfg.zones and len(mod_cfg.zones) > 1:
                total_shelf_pins += sum((z.shelf_count or 0) for z in mod_cfg.zones) * 4
                total_drawer_slides += sum((z.drawer_count or 0) for z in mod_cfg.zones)
            else:
                total_shelf_pins += mod_cfg.shelf_count * 4
                total_drawer_slides += mod_cfg.drawer_count

        # CNC Router Nesting modunda küçük parçalara vakum tutunma sekmesi (holding tabs) tanımla
        if config.cutting_mode == CuttingMode.CNC_ROUTER:
            for part in parts:
                if (
                    part.area_m2 < 0.15
                    or min(part.cut_length_mm, part.cut_width_mm) < 180.0
                ):
                    part.holding_tabs_count = 4

        # PVC Metraj ve Alan Hesaplaması
        pvc_04_mm = 0.0
        pvc_10_mm = 0.0
        pvc_20_mm = 0.0
        total_net_area = 0.0
        total_cut_area = 0.0
        total_drills = 0

        for part in parts:
            total_net_area += part.area_m2 * part.quantity
            total_cut_area += (
                (part.cut_length_mm * part.cut_width_mm) / 1_000_000.0
            ) * part.quantity
            total_drills += len(part.drills) * part.quantity

            edges = (
                (part.edge_band.length_1_mm, part.net_length_mm),
                (part.edge_band.length_2_mm, part.net_length_mm),
                (part.edge_band.width_1_mm, part.net_width_mm),
                (part.edge_band.width_2_mm, part.net_width_mm),
            )
            for pvc_t, edge_len in edges:
                if abs(pvc_t - 0.4) < 0.05:
                    pvc_04_mm += edge_len * part.quantity
                elif abs(pvc_t - 1.0) < 0.05:
                    pvc_10_mm += edge_len * part.quantity
                elif abs(pvc_t - 2.0) < 0.05:
                    pvc_20_mm += edge_len * part.quantity

        pvc_04_m = round(pvc_04_mm / 1000.0, 2)
        pvc_10_m = round(pvc_10_mm / 1000.0, 2)
        pvc_20_m = round(pvc_20_mm / 1000.0, 2)

        hardware: list[HardwareItem] = []
        if total_cabineo > 0:
            hardware.append(
                HardwareItem(
                    code="HRD-CBN-12",
                    name="Lamello Cabineo 12 Tek Parça Gövde Bağlantısı (Saf Z-Ekseni CNC)",
                    unit="Adet",
                    quantity=float(total_cabineo),
                    note="Cumbadan yatay delik gerektirmez; 3 eksen nesting CNC'de tek bağlamada işlenir (~900N çekme direnci)",
                )
            )
        if total_minifix > 0:
            hardware.extend(
                [
                    HardwareItem(
                        code="HRD-MNFX-15",
                        name="Minifiks Bağlantı Takımı (Ø15 Eksantrik + Mil)",
                        unit="Takım",
                        quantity=float(total_minifix),
                        note="Gövde ve çekmece kasa birleştirmeleri",
                    ),
                    HardwareItem(
                        code="HRD-KVLA-08",
                        name="Ahşap Kavela (Ø8x35mm)",
                        unit="Adet",
                        quantity=float(total_dowels),
                        note="Sistem 32 kavela delikleri ve baza kayıtları",
                    ),
                ]
            )

        if total_adjustable_legs > 0:
            hardware.append(
                HardwareItem(
                    code="HRD-AYK-100",
                    name="Ayarlı Plastik Baza Ayağı (100mm) + Baza Klipsi",
                    unit="Adet",
                    quantity=float(total_adjustable_legs),
                    note="Eğimli şantiye zeminlerinde teraziye alma ve klipsli ön baza montajı",
                )
            )

        if total_shelf_pins > 0:
            hardware.append(
                HardwareItem(
                    code="HRD-RAFP-05",
                    name="Çelik Raf Pimi (Ø5mm)",
                    unit="Adet",
                    quantity=float(total_shelf_pins),
                    note="Hareketli raflar için (raf başı 4 adet)",
                )
            )

        if total_drawer_slides > 0:
            slide_len = cls.select_drawer_slide_length(config.depth_mm)
            hardware.append(
                HardwareItem(
                    code=f"HRD-CRAY-{int(slide_len)}",
                    name=f"Frenli Teleskopik Çekmece Rayı ({int(slide_len)}mm)",
                    unit="Takım",
                    quantity=float(total_drawer_slides),
                    note=f"{total_drawer_slides} adet çekmece için sağ/sol ray takımı",
                )
            )

        total_gas_struts = 0
        total_hanging_rods = 0
        for m in all_modules:
            if m.zones and len(m.zones) > 1:
                total_gas_struts += sum(2 for z in m.zones if z.door_type == DoorType.FLAP_UP)
                total_hanging_rods += sum(1 for z in m.zones if z.has_hanging_rod)
            elif m.door_type == DoorType.FLAP_UP:
                total_gas_struts += 2

        if total_gas_struts > 0:
            hardware.append(
                HardwareItem(
                    code="HRD-PSTN-100",
                    name="Gazlı Piston Kalkar Kapak Makası (100N)",
                    unit="Adet",
                    quantity=float(total_gas_struts),
                    note="Yukarı açılır kalkar kapak için sağ/sol piston",
                )
            )

        if total_hinges > 0:
            hardware.append(
                HardwareItem(
                    code="HRD-MNTS-35",
                    name="Frenli Düz Tas Menteşe (Ø35mm)",
                    unit="Adet",
                    quantity=float(total_hinges),
                    note="Kapak bağlantıları için",
                )
            )

        if total_handles > 0:
            hardware.append(
                HardwareItem(
                    code="HRD-KULP-160",
                    name="Alüminyum Mobilya Kulpu (160mm)",
                    unit="Adet",
                    quantity=float(total_handles),
                    note="Kapak ve çekmece kulpları",
                )
            )

        if total_hanging_rods > 0:
            hardware.extend(
                [
                    HardwareItem(
                        code="HRD-ELB-ASK",
                        name="Oval Krom Elbise Askı Borusu (Alüminyum/Krom)",
                        unit="Adet",
                        quantity=float(total_hanging_rods),
                        note="Elbise dolabı bölmeleri için askı borusu",
                    ),
                    HardwareItem(
                        code="HRD-ASK-FLS",
                        name="Oval Askı Borusu Yan Bağlantı Flanşı",
                        unit="Adet",
                        quantity=float(total_hanging_rods * 2),
                        note="Askı borusu gövde/dikme sabitleme flanşları (borusu başı 2 adet)",
                    ),
                ]
            )

        if pvc_20_m > 0:
            hardware.append(
                HardwareItem(
                    code="PVC-20-22",
                    name="2.0 mm × 22 mm PVC Kenar Bandı",
                    unit="Metre",
                    quantity=pvc_20_m,
                    note="Görünen ön kenarlar, kapaklar ve çekmece klapaları",
                )
            )
        if pvc_10_m > 0:
            hardware.append(
                HardwareItem(
                    code="PVC-10-22",
                    name="1.0 mm × 22 mm PVC Kenar Bandı",
                    unit="Metre",
                    quantity=pvc_10_m,
                    note="Ara kenarlar",
                )
            )
        if pvc_04_m > 0:
            hardware.append(
                HardwareItem(
                    code="PVC-04-22",
                    name="0.4 mm × 22 mm PVC Kenar Bandı",
                    unit="Metre",
                    quantity=pvc_04_m,
                    note="Gizli / arka kenarlar ve çekmece iç kasaları",
                )
            )

        return BOMReport(
            config=config,
            parts=parts,
            hardware=hardware,
            total_net_area_m2=round(total_net_area, 4),
            total_cut_area_m2=round(total_cut_area, 4),
            total_pvc_04_meters=pvc_04_m,
            total_pvc_10_meters=pvc_10_m,
            total_pvc_20_meters=pvc_20_m,
            total_parts_count=sum(p.quantity for p in parts),
            total_drill_count=total_drills,
        )
