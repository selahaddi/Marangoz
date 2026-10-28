"""Deterministik Malzeme İhtiyaç Planlaması (BOM), PVC Düşümü, Çekmece Kasa,
Çoklu Modül (Oda Hattı) ve Sistem 32 Delik Motoru.

Bu modül, docs/02_MANUFACTURING_AND_CAD_RULES.md ve
docs/05_MULTI_MODULE_ROOMS_DRAWERS_AND_CNC_POST.md içerisindeki tüm kuralları
%100 deterministik Python matematiği ile işletir.
"""

from app.core.config import ManufacturingConstants as MC
from app.schemas.cabinet import (
    BackPanelType,
    BOMReport,
    Box3DTransform,
    CabinetConfig,
    DoorType,
    DrillPoint,
    EdgeBandSpec,
    GroovePath,
    HardwareItem,
    PanelPart,
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
    ) -> list[DrillPoint]:
        """Yan dikme üzerindeki Minifiks mil, kavela, çekmece rayı ve raf pimi deliklerini üretir."""
        drills: list[DrillPoint] = []
        t_half = MC.BODY_THICKNESS_MM / 2.0
        bottom_conn_x = round(plinth_height_mm + t_half, 2)
        top_conn_x = round(height_mm - t_half, 2)

        conn_y_coords = cls._connection_depth_coords(depth_mm)

        for conn_x, label in ((bottom_conn_x, "Alt Tabla"), (top_conn_x, "Üst Tabla")):
            for y_pos in conn_y_coords:
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
        cls, inner_width_mm: float, depth_mm: float
    ) -> list[DrillPoint]:
        """Alt ve üst tabla üzerindeki Ø15 mm Minifiks eksantrik gövde deliklerini üretir."""
        drills: list[DrillPoint] = []
        conn_y_coords = cls._connection_depth_coords(depth_mm)
        left_cam_x = MC.MINIFIX_CAM_CENTER_FROM_EDGE_MM
        right_cam_x = round(inner_width_mm - MC.MINIFIX_CAM_CENTER_FROM_EDGE_MM, 2)

        for cam_x, side_label in ((left_cam_x, "Sol"), (right_cam_x, "Sağ")):
            for y_pos in conn_y_coords:
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
        plinth_h = config.plinth_height_mm if config.has_plinth else 0.0

        inner_w = round(w - (2.0 * t), 2)
        clear_inner_h = round(h - plinth_h - (2.0 * t), 2)

        # Çekmece bölgesi yüksekliği kontrolü
        drawer_count = config.drawer_count
        drawer_front_h = config.drawer_front_height_mm
        if drawer_count * drawer_front_h > clear_inner_h - 40.0 and drawer_count > 0:
            drawer_front_h = round((clear_inner_h - 20.0) / drawer_count, 2)
        drawer_zone_h = round(drawer_count * drawer_front_h, 2)

        # 1. Sol ve Sağ Yan Dikmeler
        side_edge = EdgeBandSpec(
            length_1_mm=config.front_pvc_thickness_mm,
            length_2_mm=config.hidden_pvc_thickness_mm,
            width_1_mm=config.hidden_pvc_thickness_mm,
            width_2_mm=config.hidden_pvc_thickness_mm,
        )
        side_cut_l, side_cut_w, side_ded_l, side_ded_w = cls.compute_cut_dimensions(
            h, d, side_edge
        )
        side_drills = cls._build_side_panel_drills(
            h, d, plinth_h, config.shelf_count, drawer_count, drawer_front_h
        )

        side_grooves: list[GroovePath] = []
        if config.back_panel_type == BackPanelType.GROOVED_8MM:
            groove_start_x = round(
                plinth_h + t - MC.BACK_PANEL_INSERTION_PER_SIDE_MM, 2
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

        parts.append(
            PanelPart(
                part_id=f"P{part_counter:02d}",
                code=f"{prefix}YAN_SOL",
                name=f"{label_prefix}Sol Yan Dikme",
                material=config.body_material,
                thickness_mm=t,
                quantity=1,
                net_length_mm=h,
                net_width_mm=d,
                cut_length_mm=side_cut_l,
                cut_width_mm=side_cut_w,
                pvc_deduction_length_mm=side_ded_l,
                pvc_deduction_width_mm=side_ded_w,
                edge_band=side_edge,
                area_m2=round((h * d) / 1_000_000.0, 4),
                drills=side_drills,
                grooves=side_grooves,
                transform_3d=Box3DTransform(
                    center_x_mm=round(x_offset_mm - w / 2.0 + t / 2.0, 2),
                    center_y_mm=round(h / 2.0, 2),
                    center_z_mm=0.0,
                    size_x_mm=t,
                    size_y_mm=h,
                    size_z_mm=d,
                    color_hex=config.body_color_hex,
                    module_index=module_idx,
                ),
            )
        )
        part_counter += 1

        parts.append(
            PanelPart(
                part_id=f"P{part_counter:02d}",
                code=f"{prefix}YAN_SAG",
                name=f"{label_prefix}Sağ Yan Dikme",
                material=config.body_material,
                thickness_mm=t,
                quantity=1,
                net_length_mm=h,
                net_width_mm=d,
                cut_length_mm=side_cut_l,
                cut_width_mm=side_cut_w,
                pvc_deduction_length_mm=side_ded_l,
                pvc_deduction_width_mm=side_ded_w,
                edge_band=side_edge,
                area_m2=round((h * d) / 1_000_000.0, 4),
                drills=side_drills,
                grooves=side_grooves,
                transform_3d=Box3DTransform(
                    center_x_mm=round(x_offset_mm + w / 2.0 - t / 2.0, 2),
                    center_y_mm=round(h / 2.0, 2),
                    center_z_mm=0.0,
                    size_x_mm=t,
                    size_y_mm=h,
                    size_z_mm=d,
                    color_hex=config.body_color_hex,
                    module_index=module_idx,
                ),
            )
        )
        part_counter += 1

        # 2. Üst ve Alt Tabla
        horiz_edge = EdgeBandSpec(
            length_1_mm=config.front_pvc_thickness_mm,
            length_2_mm=config.hidden_pvc_thickness_mm,
            width_1_mm=0.0,
            width_2_mm=0.0,
        )
        horiz_cut_l, horiz_cut_w, horiz_ded_l, horiz_ded_w = cls.compute_cut_dimensions(
            inner_w, d, horiz_edge
        )
        horiz_drills = cls._build_horizontal_panel_drills(inner_w, d)

        horiz_grooves: list[GroovePath] = []
        if config.back_panel_type == BackPanelType.GROOVED_8MM:
            horiz_grooves.append(
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
                name=f"{label_prefix}Üst Tabla",
                material=config.body_material,
                thickness_mm=t,
                quantity=1,
                net_length_mm=inner_w,
                net_width_mm=d,
                cut_length_mm=horiz_cut_l,
                cut_width_mm=horiz_cut_w,
                pvc_deduction_length_mm=horiz_ded_l,
                pvc_deduction_width_mm=horiz_ded_w,
                edge_band=horiz_edge,
                area_m2=round((inner_w * d) / 1_000_000.0, 4),
                drills=horiz_drills,
                grooves=horiz_grooves,
                transform_3d=Box3DTransform(
                    center_x_mm=x_offset_mm,
                    center_y_mm=round(h - t / 2.0, 2),
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

        parts.append(
            PanelPart(
                part_id=f"P{part_counter:02d}",
                code=f"{prefix}TABLA_ALT",
                name=f"{label_prefix}Alt Tabla",
                material=config.body_material,
                thickness_mm=t,
                quantity=1,
                net_length_mm=inner_w,
                net_width_mm=d,
                cut_length_mm=horiz_cut_l,
                cut_width_mm=horiz_cut_w,
                pvc_deduction_length_mm=horiz_ded_l,
                pvc_deduction_width_mm=horiz_ded_w,
                edge_band=horiz_edge,
                area_m2=round((inner_w * d) / 1_000_000.0, 4),
                drills=horiz_drills,
                grooves=horiz_grooves,
                transform_3d=Box3DTransform(
                    center_x_mm=x_offset_mm,
                    center_y_mm=round(plinth_h + t / 2.0, 2),
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

        # 3. Alt Baza Kayıtları
        if config.has_plinth and plinth_h > 0.0:
            plinth_edge = EdgeBandSpec(
                length_1_mm=config.hidden_pvc_thickness_mm,
                length_2_mm=config.hidden_pvc_thickness_mm,
                width_1_mm=0.0,
                width_2_mm=0.0,
            )
            plinth_cut_l, plinth_cut_w, p_ded_l, p_ded_w = cls.compute_cut_dimensions(
                inner_w, plinth_h, plinth_edge
            )
            for code_suffix, baza_label, z_pos in (
                ("ON", "Ön", round(d / 2.0 - 25.0, 2)),
                ("ARKA", "Arka", round(-d / 2.0 + 25.0, 2)),
            ):
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
                    plinth_h
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
                        material=config.body_material,
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
        if config.shelf_count > 0 and remaining_clear_h > 120.0:
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

            step_h = remaining_clear_h / (config.shelf_count + 1)
            shelf_z_center = round((rear_loss - MC.SHELF_FRONT_SETBACK_MM) / 2.0, 2)

            for s_idx in range(1, config.shelf_count + 1):
                shelf_y = round(
                    plinth_h + t + drawer_zone_h + (s_idx * step_h), 2
                )
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
            back_l = round(h - plinth_h - 4.0, 2)
            back_w = round(w - 4.0, 2)
            back_z = round(-d / 2.0 - back_t / 2.0, 2)

        parts.append(
            PanelPart(
                part_id=f"P{part_counter:02d}",
                code=f"{prefix}ARKALIK",
                name=f"{label_prefix}Arkalık Paneli",
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
                transform_3d=Box3DTransform(
                    center_x_mm=x_offset_mm,
                    center_y_mm=round(plinth_h + (h - plinth_h) / 2.0, 2),
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

        # 7. Kapaklar (Çekmece bölgesinin üstünde kalan alan için)
        total_hinges = 0
        door_avail_h = round((h - plinth_h - drawer_zone_h), 2)
        if config.door_type != DoorType.NONE and door_avail_h >= 240.0:
            door_net_h = round(door_avail_h - (2.0 * MC.DOOR_OUTER_GAP_MM), 2)
            door_edge = EdgeBandSpec(
                length_1_mm=config.front_pvc_thickness_mm,
                length_2_mm=config.front_pvc_thickness_mm,
                width_1_mm=config.front_pvc_thickness_mm,
                width_2_mm=config.front_pvc_thickness_mm,
            )
            door_y_center = round(
                plinth_h + drawer_zone_h + (door_avail_h / 2.0), 2
            )
            door_z_center = round(d / 2.0 + t / 2.0 + 1.5, 2)

            if config.door_type in (DoorType.SINGLE_LEFT, DoorType.SINGLE_RIGHT):
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
                        code=f"{prefix}KAPAK_TEK",
                        name=(
                            f"{label_prefix}Tek Kapak (Sol Menteşeli)"
                            if hinge_left
                            else f"{label_prefix}Tek Kapak (Sağ Menteşeli)"
                        ),
                        material=config.body_material,
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
                            center_y_mm=door_y_center,
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
                            code=f"{prefix}KAPAK_{side_code}",
                            name=f"{label_prefix}{side_label}",
                            material=config.body_material,
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
                                center_y_mm=door_y_center,
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

        conn_count_per_corner = len(cls._connection_depth_coords(d))
        minifix_sets = conn_count_per_corner * 4 + (drawer_count * 4)
        dowel_count = minifix_sets + (8 if config.has_plinth else 0)

        return (
            parts,
            part_counter,
            minifix_sets,
            dowel_count,
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
            total_hinges += m_hinges
            total_handles += m_handles
            total_shelf_pins += mod_cfg.shelf_count * 4
            total_drawer_slides += mod_cfg.drawer_count

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

        hardware: list[HardwareItem] = [
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
