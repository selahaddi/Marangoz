"""2D Giyotin Plaka Kesim Optimizasyonu (Nesting) ve Ölçekli SVG Üretim Motoru.

rectpack kütüphanesinin giyotin kesim algoritmalarını kullanarak:
- Standart plakalardan (2800x2100 veya 3660x1830 mm) 10 mm kenar temizlik payı düşer.
- Her kesim arasına 4.0 mm testere talaş payı (kerf) uygular.
- Fire oranını hesaplar ve etkileşimli SVG kesim şeması üretir.
"""

import logging
from collections import defaultdict

from rectpack import (
    GuillotineBssfSas,
    MaxRectsBssf,
    PackingBin,
    PackingMode,
    newPacker,
)

from app.core.config import ManufacturingConstants as MC
from app.schemas.cabinet import (
    BOMReport,
    CuttingMode,
    NestedPartPlacement,
    NestingResult,
    PanelPart,
    RemnantStockItem,
    SheetLayout,
    SheetSizeOption,
)

logger = logging.getLogger(__name__)


class NestingEngine:
    """Giyotin tipi 2D bin-packing kesim optimizasyonu ve SVG şema üreticisi."""

    @staticmethod
    def resolve_sheet_dimensions(sheet_size: SheetSizeOption) -> tuple[float, float]:
        """Plaka seçeneğinden (boy, en) mm ölçülerini döndürür."""
        if sheet_size == SheetSizeOption.SHEET_3660_1830:
            return MC.STANDARD_SHEET_3660_1830
        return MC.STANDARD_SHEET_2800_2100

    @classmethod
    def _detect_usable_remnants(
        cls,
        sheet_index: int,
        material: str,
        thickness_mm: float,
        sheet_w: float,
        sheet_h: float,
        trim_mm: float,
        kerf_mm: float,
        placements: list[NestedPartPlacement],
    ) -> list[RemnantStockItem]:
        """Plaka üzerindeki yerleşimden arta kalan ≥400×600 mm sağlam artık levhaları tespit eder."""
        if not placements:
            return []

        max_x = max(p.x_mm + p.width_mm for p in placements)
        max_y = max(p.y_mm + p.height_mm for p in placements)
        right_edge = sheet_w - trim_mm
        top_edge = sheet_h - trim_mm

        remnants: list[RemnantStockItem] = []
        rem_counter = 1

        # 1. Sağ dikey artık şerit (tüm kullanılabilir yükseklik boyunca)
        right_free_w = round(right_edge - max_x - kerf_mm, 2)
        usable_h = round(sheet_h - (2.0 * trim_mm), 2)
        if (
            min(right_free_w, usable_h) >= MC.REMNANT_MIN_DIM_SHORT_MM
            and max(right_free_w, usable_h) >= MC.REMNANT_MIN_DIM_LONG_MM
        ):
            remnants.append(
                RemnantStockItem(
                    remnant_id=f"REM-S{sheet_index}-{rem_counter:02d}",
                    sheet_index=sheet_index,
                    material=material,
                    thickness_mm=thickness_mm,
                    x_mm=round(max_x + kerf_mm, 2),
                    y_mm=trim_mm,
                    width_mm=right_free_w,
                    height_mm=usable_h,
                    area_m2=round((right_free_w * usable_h) / 1_000_000.0, 4),
                )
            )
            rem_counter += 1

        # 2. Üst yatay artık şerit (yerleşen parçaların üstünde kalan alan)
        top_free_w = round(max_x - trim_mm, 2)
        top_free_h = round(top_edge - max_y - kerf_mm, 2)
        if (
            min(top_free_w, top_free_h) >= MC.REMNANT_MIN_DIM_SHORT_MM
            and max(top_free_w, top_free_h) >= MC.REMNANT_MIN_DIM_LONG_MM
        ):
            remnants.append(
                RemnantStockItem(
                    remnant_id=f"REM-S{sheet_index}-{rem_counter:02d}",
                    sheet_index=sheet_index,
                    material=material,
                    thickness_mm=thickness_mm,
                    x_mm=trim_mm,
                    y_mm=round(max_y + kerf_mm, 2),
                    width_mm=top_free_w,
                    height_mm=top_free_h,
                    area_m2=round((top_free_w * top_free_h) / 1_000_000.0, 4),
                )
            )

        return remnants

    @classmethod
    def _render_sheet_svg(
        cls,
        sheet_index: int,
        material: str,
        sheet_w: float,
        sheet_h: float,
        trim_mm: float,
        kerf_mm: float,
        waste_pct: float,
        placements: list[NestedPartPlacement],
        remnants: list[RemnantStockItem] | None = None,
    ) -> str:
        """Tek bir plakanın kesim planını ölçekli ve etiketli SVG olarak üretir."""
        view_w = 960
        scale = (view_w - 40) / sheet_w
        view_h = int(sheet_h * scale) + 80
        ox = 20.0
        oy = 55.0

        usable_w = sheet_w - (2.0 * trim_mm)
        usable_h = sheet_h - (2.0 * trim_mm)

        svg_lines: list[str] = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {view_w} {view_h}" '
            f'width="100%" height="100%" font-family="Inter, system-ui, sans-serif">',
            '<rect width="100%" height="100%" fill="#0F172A" rx="8" />',
            # Başlık Çubuğu
            f'<text x="{ox}" y="28" fill="#F8FAFC" font-size="14" font-weight="700">'
            f"Plaka #{sheet_index} — {material} ({sheet_w:.0f} × {sheet_h:.0f} mm)</text>",
            f'<text x="{view_w - ox}" y="28" text-anchor="end" fill="#38BDF8" '
            f'font-size="13" font-weight="600">'
            f"Verimlilik: %{100.0 - waste_pct:.1f} | Fire: %{waste_pct:.1f}</text>",
            f'<text x="{ox}" y="44" fill="#94A3B8" font-size="11">'
            f"Net Kullanılabilir Alan: {usable_w:.0f} × {usable_h:.0f} mm "
            f"(Kenar Temizlik: {trim_mm:.0f} mm | Kesim Payı / Kerf: {kerf_mm:.1f} mm)</text>",
            # Ham Plaka Alanı
            f'<rect x="{ox:.1f}" y="{oy:.1f}" width="{sheet_w * scale:.1f}" '
            f'height="{sheet_h * scale:.1f}" fill="#1E293B" stroke="#475569" stroke-width="1.5" />',
            # Temizlik Payı İç Sınırı (Kesikli Çizgi)
            f'<rect x="{ox + trim_mm * scale:.1f}" y="{oy + trim_mm * scale:.1f}" '
            f'width="{usable_w * scale:.1f}" height="{usable_h * scale:.1f}" '
            f'fill="none" stroke="#64748B" stroke-width="1" stroke-dasharray="5,4" />',
        ]

        palette = (
            ("#0284C7", "#E0F2FE"),
            ("#0D9488", "#CCFBF1"),
            ("#4F46E5", "#E0E7FF"),
            ("#D97706", "#FEF3C7"),
            ("#7C3AED", "#EDE9FE"),
            ("#059669", "#D1FAE5"),
        )

        for idx, p in enumerate(placements):
            fill_color, text_color = palette[idx % len(palette)]
            px = ox + (p.x_mm * scale)
            py = oy + ((sheet_h - p.y_mm - p.height_mm) * scale)
            pw = p.width_mm * scale
            ph = p.height_mm * scale

            svg_lines.append(
                f'<g class="part-group">'
                f'<rect x="{px:.2f}" y="{py:.2f}" width="{pw:.2f}" height="{ph:.2f}" '
                f'fill="{fill_color}" fill-opacity="0.85" stroke="#F8FAFC" stroke-width="1.2" />'
            )

            if pw > 42 and ph > 22:
                cx = px + pw / 2.0
                cy = py + ph / 2.0
                rot_tag = " [90°]" if p.rotated else ""
                tab_tag = f" [{p.holding_tabs_count}×TAB]" if p.holding_tabs_count > 0 else ""
                l_tag = " [L-KERTME]" if p.notch_info else ""
                dim_label = f"{p.cut_length_mm:.0f}×{p.cut_width_mm:.0f}"
                svg_lines.append(
                    f'<text x="{cx:.1f}" y="{cy - 3:.1f}" text-anchor="middle" '
                    f'fill="{text_color}" font-size="10" font-weight="700">'
                    f"{p.part_id} {p.code}{rot_tag}{tab_tag}{l_tag}</text>"
                )
                svg_lines.append(
                    f'<text x="{cx:.1f}" y="{cy + 10:.1f}" text-anchor="middle" '
                    f'fill="#E2E8F0" font-size="9">{dim_label} mm</text>'
                )
            svg_lines.append("</g>")

        # Kullanılabilir Artık Levhaları (Remnants ≥ 400×600 mm) Yeşil Kesikli Çerçeve ile Göster
        for rem in remnants or []:
            rx = ox + (rem.x_mm * scale)
            ry = oy + ((sheet_h - rem.y_mm - rem.height_mm) * scale)
            rw = rem.width_mm * scale
            rh = rem.height_mm * scale
            rcx = rx + rw / 2.0
            rcy = ry + rh / 2.0
            svg_lines.extend(
                [
                    '<g class="remnant-group">',
                    f'<rect x="{rx:.2f}" y="{ry:.2f}" width="{rw:.2f}" height="{rh:.2f}" '
                    'fill="#065F46" fill-opacity="0.32" stroke="#10B981" stroke-width="1.5" stroke-dasharray="6,4" />',
                    f'<text x="{rcx:.1f}" y="{rcy - 4:.1f}" text-anchor="middle" fill="#6EE7B7" font-size="10" font-weight="700">'
                    f"ARTIK DEPO ({rem.remnant_id})</text>",
                    f'<text x="{rcx:.1f}" y="{rcy + 10:.1f}" text-anchor="middle" fill="#A7F3D0" font-size="9">'
                    f"{rem.width_mm:.0f}×{rem.height_mm:.0f} mm ({rem.area_m2:.2f} m²)</text>",
                    "</g>",
                ]
            )

        svg_lines.append("</svg>")
        return "\n".join(svg_lines)

    @classmethod
    def run_nesting(cls, bom: BOMReport) -> NestingResult:
        """BOM parçalarını malzeme/kalınlığa göre gruplayıp 2D giyotin kesim optimizasyonu yapar."""
        try:
            sheet_w, sheet_h = cls.resolve_sheet_dimensions(bom.config.sheet_size)
            trim_mm = MC.SHEET_TRIM_MARGIN_MM
            kerf_mm = (
                bom.config.router_bit_diameter_mm
                if bom.config.cutting_mode == CuttingMode.CNC_ROUTER
                else MC.SAW_KERF_MM
            )

            usable_w = round(sheet_w - (2.0 * trim_mm), 2)
            usable_h = round(sheet_h - (2.0 * trim_mm), 2)
            sheet_gross_area_m2 = (sheet_w * sheet_h) / 1_000_000.0

            # Parçaları kalınlık ve malzemeye göre grupla
            grouped_parts: dict[tuple[float, str], list[PanelPart]] = defaultdict(list)
            for part in bom.parts:
                for _ in range(part.quantity):
                    grouped_parts[(part.thickness_mm, part.material)].append(part)

            all_sheets: list[SheetLayout] = []
            all_remnants: list[RemnantStockItem] = []
            global_sheet_idx = 1

            # Ölçekleme: rectpack tam sayı (integer) ile en kararlı çalışır (0.1 mm hassasiyet = x10)
            scale_int = 10
            bin_w_int = int(round((usable_w + kerf_mm) * scale_int))
            bin_h_int = int(round((usable_h + kerf_mm) * scale_int))

            for (thickness_mm, material), part_list in grouped_parts.items():
                packer = newPacker(
                    mode=PackingMode.Offline,
                    bin_algo=PackingBin.BBF,
                    pack_algo=GuillotineBssfSas,
                    rotation=True,
                )

                part_lookup: dict[str, PanelPart] = {}
                for idx, part in enumerate(part_list):
                    rid = f"{part.part_id}_{idx}"
                    part_lookup[rid] = part
                    w_int = int(round((part.cut_length_mm + kerf_mm) * scale_int))
                    h_int = int(round((part.cut_width_mm + kerf_mm) * scale_int))
                    packer.add_rect(w_int, h_int, rid=rid)

                max_bins = max(4, len(part_list))
                for _ in range(max_bins):
                    packer.add_bin(bin_w_int, bin_h_int)

                packer.pack()

                packed_count = sum(len(b) for b in packer)
                if packed_count < len(part_list):
                    packer = newPacker(
                        mode=PackingMode.Offline,
                        bin_algo=PackingBin.BBF,
                        pack_algo=MaxRectsBssf,
                        rotation=True,
                    )
                    for idx, part in enumerate(part_list):
                        rid = f"{part.part_id}_{idx}"
                        w_int = int(round((part.cut_length_mm + kerf_mm) * scale_int))
                        h_int = int(round((part.cut_width_mm + kerf_mm) * scale_int))
                        packer.add_rect(w_int, h_int, rid=rid)
                    for _ in range(max_bins):
                        packer.add_bin(bin_w_int, bin_h_int)
                    packer.pack()

                for abin in packer:
                    if len(abin) == 0:
                        continue

                    placements: list[NestedPartPlacement] = []
                    used_area_m2 = 0.0

                    for rect in abin:
                        rid = str(rect.rid)
                        orig_part = part_lookup[rid]
                        x_mm = round((rect.x / scale_int) + trim_mm, 2)
                        y_mm = round((rect.y / scale_int) + trim_mm, 2)
                        placed_w = round((rect.width / scale_int) - kerf_mm, 2)
                        placed_h = round((rect.height / scale_int) - kerf_mm, 2)

                        is_rotated = abs(placed_w - orig_part.cut_length_mm) > 0.5
                        used_area_m2 += (placed_w * placed_h) / 1_000_000.0

                        placements.append(
                            NestedPartPlacement(
                                part_id=orig_part.part_id,
                                code=orig_part.code,
                                name=orig_part.name,
                                thickness_mm=thickness_mm,
                                sheet_index=global_sheet_idx,
                                x_mm=x_mm,
                                y_mm=y_mm,
                                width_mm=placed_w,
                                height_mm=placed_h,
                                rotated=is_rotated,
                                cut_length_mm=orig_part.cut_length_mm,
                                cut_width_mm=orig_part.cut_width_mm,
                                holding_tabs_count=orig_part.holding_tabs_count,
                                notch_info=orig_part.notch_info,
                                is_true_shape=bool(orig_part.notch_info),
                            )
                        )

                    used_area_m2 = round(used_area_m2, 4)
                    waste_area_m2 = round(
                        max(0.0, sheet_gross_area_m2 - used_area_m2), 4
                    )
                    waste_pct = round(
                        (waste_area_m2 / sheet_gross_area_m2) * 100.0, 2
                    )

                    sheet_remnants = cls._detect_usable_remnants(
                        sheet_index=global_sheet_idx,
                        material=material,
                        thickness_mm=thickness_mm,
                        sheet_w=sheet_w,
                        sheet_h=sheet_h,
                        trim_mm=trim_mm,
                        kerf_mm=kerf_mm,
                        placements=placements,
                    )
                    all_remnants.extend(sheet_remnants)

                    svg_str = cls._render_sheet_svg(
                        sheet_index=global_sheet_idx,
                        material=material,
                        sheet_w=sheet_w,
                        sheet_h=sheet_h,
                        trim_mm=trim_mm,
                        kerf_mm=kerf_mm,
                        waste_pct=waste_pct,
                        placements=placements,
                        remnants=sheet_remnants,
                    )

                    all_sheets.append(
                        SheetLayout(
                            sheet_index=global_sheet_idx,
                            material=material,
                            thickness_mm=thickness_mm,
                            sheet_width_mm=sheet_w,
                            sheet_height_mm=sheet_h,
                            usable_width_mm=usable_w,
                            usable_height_mm=usable_h,
                            trim_margin_mm=trim_mm,
                            kerf_mm=kerf_mm,
                            used_area_m2=used_area_m2,
                            waste_area_m2=waste_area_m2,
                            waste_percentage=waste_pct,
                            placements=placements,
                            remnants=sheet_remnants,
                            svg_content=svg_str,
                        )
                    )
                    global_sheet_idx += 1

            total_sheets = len(all_sheets)
            total_gross_m2 = total_sheets * sheet_gross_area_m2
            total_used_m2 = sum(s.used_area_m2 for s in all_sheets)
            reusable_remnant_m2 = round(sum(r.area_m2 for r in all_remnants), 4)
            overall_eff = (
                round((total_used_m2 / total_gross_m2) * 100.0, 2)
                if total_gross_m2 > 0
                else 0.0
            )
            overall_waste = round(100.0 - overall_eff, 2)
            effective_waste = (
                round(
                    max(
                        0.0,
                        ((total_gross_m2 - total_used_m2 - reusable_remnant_m2) / total_gross_m2)
                        * 100.0,
                    ),
                    2,
                )
                if total_gross_m2 > 0
                else 0.0
            )

            combined_svg = "\n".join(s.svg_content for s in all_sheets)

            return NestingResult(
                sheet_width_mm=sheet_w,
                sheet_height_mm=sheet_h,
                kerf_mm=kerf_mm,
                total_sheets=total_sheets,
                overall_efficiency_percentage=overall_eff,
                overall_waste_percentage=overall_waste,
                reusable_remnant_area_m2=reusable_remnant_m2,
                effective_waste_percentage=effective_waste,
                remnants=all_remnants,
                sheets=all_sheets,
                combined_svg=combined_svg,
            )
        except Exception as exc:
            logger.exception("Nesting optimizasyonu sırasında hata oluştu: %s", exc)
            raise RuntimeError(f"Nesting hesaplama hatası: {exc}") from exc
