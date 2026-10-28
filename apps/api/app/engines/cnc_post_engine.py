"""Doğrudan CNC Makine Dili (ISO G-Code .nc ve Homag WoodWOP .mpr) Post-Processor Motoru.

Her bir ahşap panel için kesim konturu, 8 mm arkalık kanalı ve Sistem 32 delik
koordinatlarını doğrudan CNC tezgahlarına gönderilebilecek .nc ve .mpr formatlarına çevirir.
"""

from pathlib import Path

from app.schemas.cabinet import BOMReport, PanelPart


class CNCPostProcessorEngine:
    """ISO G-Code (.nc) ve Homag/Weeke WoodWOP 4.0 (.mpr) üreticisi."""

    @classmethod
    def export_part_gcode_string(cls, part: PanelPart) -> str:
        """Tek bir PanelPart nesnesi için 3 Eksen ISO CNC G-Code (.nc) programı üretir."""
        cut_l = part.cut_length_mm
        cut_w = part.cut_width_mm
        t = part.thickness_mm

        lines: list[str] = [
            "%",
            f"(MARANGOZ CAM POST-PROCESSOR - ISO G-CODE)",
            f"(PARCA: {part.part_id} {part.code} - {part.name})",
            f"(KESIM EBADI: {cut_l:.2f} x {cut_w:.2f} x {t:.1f} mm)",
            "G21 G90 G17 G40 G49 G80",
            "G0 Z35.000",
        ]

        # 1. Arkalık Kanalı Frezeleme (Varsa)
        if part.grooves:
            lines.extend(
                [
                    "(--- OP 1: 8MM ARKALIK KANALI FREZELEME ---)",
                    "T1 M6 (D8.0 KARBUR PARMAK FREZE)",
                    "S18000 M3",
                ]
            )
            for idx, groove in enumerate(part.grooves, start=1):
                gx0 = groove.x_start_mm
                gy0 = groove.y_start_mm + (groove.length_mm / 2.0)
                gx1 = groove.x_start_mm + groove.width_mm
                g_depth = -abs(groove.depth_mm)
                lines.extend(
                    [
                        f"(KANAL #{idx}: {groove.layer})",
                        f"G0 X{gx0:.3f} Y{gy0:.3f}",
                        "G0 Z5.000",
                        f"G1 Z{g_depth:.3f} F1500",
                        f"G1 X{gx1:.3f} Y{gy0:.3f} F4500",
                        "G0 Z25.000",
                    ]
                )

        # 2. Sistem 32 Çoklu Delik Operasyonları (Varsa)
        if part.drills:
            lines.extend(
                [
                    "(--- OP 2: SISTEM 32 CNC DELIK DELME ---)",
                    "T2 M6 (COKLU DELIK UNITE / MATKAP)",
                    "S6000 M3",
                ]
            )
            for idx, drill in enumerate(part.drills, start=1):
                z_depth = -abs(drill.depth_mm)
                lines.append(
                    f"(DELIK #{idx}: {drill.layer} D={drill.diameter_mm:.1f}mm)"
                )
                lines.append(
                    f"G81 X{drill.x_mm:.3f} Y{drill.y_mm:.3f} Z{z_depth:.3f} R5.000 F1800"
                )
            lines.append("G80")
            lines.append("G0 Z35.000")

        # 3. Parça Dış Ebatlama Konturu
        cut_z = -(t + 0.5)
        lines.extend(
            [
                "(--- OP 3: DIS KONTUR EBATLAMA ---)",
                "T1 M6 (D8.0 KARBUR PARMAK FREZE)",
                "S18000 M3",
                "G0 X0.000 Y0.000",
                "G0 Z5.000",
                f"G1 Z{cut_z:.3f} F1500",
                f"G1 X{cut_l:.3f} Y0.000 F5000",
                f"G1 X{cut_l:.3f} Y{cut_w:.3f}",
                f"G1 X0.000 Y{cut_w:.3f}",
                "G1 X0.000 Y0.000",
                "G0 Z50.000",
                "M5",
                "M30",
                "%",
            ]
        )
        return "\n".join(lines)

    @classmethod
    def export_part_mpr_string(cls, part: PanelPart) -> str:
        """Tek bir PanelPart nesnesi için Homag/Weeke WoodWOP 4.0 (.mpr) programı üretir."""
        cut_l = part.cut_length_mm
        cut_w = part.cut_width_mm
        t = part.thickness_mm

        lines: list[str] = [
            "[H",
            'VERSION="4.0 Alpha"',
            "OP=1",
            "FM=1",
            "GP=0",
            "UP=0",
            "DW=0",
            "VIEW=NOMIRROR",
            f"BSX={cut_l:.2f}",
            f"BSY={cut_w:.2f}",
            f"BSZ={t:.2f}",
            "FNX=0.00",
            "FNY=0.00",
            "RNX=0.00",
            "RNY=0.00",
            "RNZ=0.00",
            f'MAT="{part.material}"',
            "",
            "<100 \\WerkStck\\",
            'LA="BSX"',
            'BR="BSY"',
            'DI="BSZ"',
            'FNX="FNX"',
            'FNY="FNY"',
            "",
        ]

        # Kanal Blokları (<112 \Tasche\)
        for groove in part.grooves:
            cx = groove.x_start_mm + (groove.width_mm / 2.0)
            cy = groove.y_start_mm + (groove.length_mm / 2.0)
            lines.extend(
                [
                    "<112 \\Tasche\\",
                    f'XA="{cx:.2f}"',
                    f'YA="{cy:.2f}"',
                    f'LA="{groove.width_mm:.2f}"',
                    f'BR="{groove.length_mm:.2f}"',
                    'RD="0.00"',
                    'WI="0.00"',
                    f'TI="{groove.depth_mm:.2f}"',
                    'ZT="0.00"',
                    'XY="80"',
                    'T_="101"',
                    'F_="5"',
                    "",
                ]
            )

        # Dikey Delik Blokları (<102 \BohrVert\)
        for drill in part.drills:
            lines.extend(
                [
                    "<102 \\BohrVert\\",
                    f'XA="{drill.x_mm:.2f}"',
                    f'YA="{drill.y_mm:.2f}"',
                    'BM="LS"',
                    f'TI="{drill.depth_mm:.2f}"',
                    f'DU="{drill.diameter_mm:.2f}"',
                    'AN="1"',
                    'MI="0"',
                    'S_="1"',
                    "",
                ]
            )

        lines.append("!")
        return "\n".join(lines)

    @classmethod
    def export_all_cnc_programs(
        cls, bom: BOMReport, gcode_dir: Path, mpr_dir: Path
    ) -> tuple[list[Path], list[Path]]:
        """Tüm parçalar için .nc ve .mpr dosyalarını ilgili klasörlere yazar."""
        gcode_dir.mkdir(parents=True, exist_ok=True)
        mpr_dir.mkdir(parents=True, exist_ok=True)

        gcode_files: list[Path] = []
        mpr_files: list[Path] = []

        for part in bom.parts:
            nc_path = gcode_dir / f"{part.part_id}_{part.code}.nc"
            nc_path.write_text(cls.export_part_gcode_string(part), encoding="utf-8")
            gcode_files.append(nc_path)

            mpr_path = mpr_dir / f"{part.part_id}_{part.code}.mpr"
            mpr_path.write_text(cls.export_part_mpr_string(part), encoding="utf-8")
            mpr_files.append(mpr_path)

        return gcode_files, mpr_files

