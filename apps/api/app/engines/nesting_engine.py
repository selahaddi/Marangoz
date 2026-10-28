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
    NestedPartPlacement,
    NestingResult,
    PanelPart,
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
    def _render_sheet_svg(
        cls,
        sheet_index: int,
        material: str,
        sheet_w: float,
        sheet_h: float,
        trim_mm: float,
        waste_pct: float,
        placements: list[NestedPartPlacement],
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
            f"(Kenar Temizlik: {trim_mm:.0f} mm | Testere Kerf: {MC.SAW_KERF_MM:.1f} mm)</text>",
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
            # SVG Y ekseni yukarıdan aşağıya olduğu için plaka sol-alt köşesine göre çeviriyoruz
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
                dim_label = f"{p.cut_length_mm:.0f}×{p.cut_width_mm:.0f}"
                svg_lines.append(
                    f'<text x="{cx:.1f}" y="{cy - 3:.1f}" text-anchor="middle" '
                    f'fill="{text_color}" font-size="10" font-weight="700">'
                    f"{p.part_id} {p.code}{rot_tag}</text>"
                )
                svg_lines.append(
                    f'<text x="{cx:.1f}" y="{cy + 10:.1f}" text-anchor="middle" '
                    f'fill="#E2E8F0" font-size="9">{dim_label} mm</text>'
                )
            svg_lines.append("</g>")

        svg_lines.append("</svg>")
        return "\n".join(svg_lines)

    @classmethod
    def run_nesting(cls, bom: BOMReport) -> NestingResult:
        """BOM parçalarını malzeme/kalınlığa göre gruplayıp 2D giyotin kesim optimizasyonu yapar."""
        try:
            sheet_w, sheet_h = cls.resolve_sheet_dimensions(bom.config.sheet_size)
            trim_mm = MC.SHEET_TRIM_MARGIN_MM
            kerf_mm = MC.SAW_KERF_MM

            usable_w = round(sheet_w - (2.0 * trim_mm), 2)
            usable_h = round(sheet_h - (2.0 * trim_mm), 2)
            sheet_gross_area_m2 = (sheet_w * sheet_h) / 1_000_000.0

            # Parçaları kalınlık ve malzemeye göre grupla
            grouped_parts: dict[tuple[float, str], list[PanelPart]] = defaultdict(list)
            for part in bom.parts:
                for _ in range(part.quantity):
                    grouped_parts[(part.thickness_mm, part.material)].append(part)

            all_sheets: list[SheetLayout] = []
            global_sheet_idx = 1

            # Kalçek ölçekleme: rectpack tam sayı (integer) ile en kararlı çalışır (0.1 mm hassasiyet = x10)
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
                    # Her parçaya testere kerf payı (+4.0 mm) eklenerek giyotin kesim boşluğu garantilenir
                    w_int = int(round((part.cut_length_mm + kerf_mm) * scale_int))
                    h_int = int(round((part.cut_width_mm + kerf_mm) * scale_int))
                    packer.add_rect(w_int, h_int, rid=rid)

                # Yeterli sayıda standart plaka ekle
                max_bins = max(4, len(part_list))
                for _ in range(max_bins):
                    packer.add_bin(bin_w_int, bin_h_int)

                packer.pack()

                # Eğer çok nadir bir durumda Guillotine algoritması tüm parçaları yerleştiremezse MaxRects yedeği
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
                            )
                        )

                    used_area_m2 = round(used_area_m2, 4)
                    waste_area_m2 = round(
                        max(0.0, sheet_gross_area_m2 - used_area_m2), 4
                    )
                    waste_pct = round(
                        (waste_area_m2 / sheet_gross_area_m2) * 100.0, 2
                    )

                    svg_str = cls._render_sheet_svg(
                        sheet_index=global_sheet_idx,
                        material=material,
                        sheet_w=sheet_w,
                        sheet_h=sheet_h,
                        trim_mm=trim_mm,
                        waste_pct=waste_pct,
                        placements=placements,
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
                            svg_content=svg_str,
                        )
                    )
                    global_sheet_idx += 1

            total_sheets = len(all_sheets)
            total_gross_m2 = total_sheets * sheet_gross_area_m2
            total_used_m2 = sum(s.used_area_m2 for s in all_sheets)
            overall_eff = (
                round((total_used_m2 / total_gross_m2) * 100.0, 2)
                if total_gross_m2 > 0
                else 0.0
            )
            overall_waste = round(100.0 - overall_eff, 2)

            combined_svg = "\n".join(s.svg_content for s in all_sheets)

            return NestingResult(
                sheet_width_mm=sheet_w,
                sheet_height_mm=sheet_h,
                kerf_mm=kerf_mm,
                total_sheets=total_sheets,
                overall_efficiency_percentage=overall_eff,
                overall_waste_percentage=overall_waste,
                sheets=all_sheets,
                combined_svg=combined_svg,
            )
        except Exception as exc:
            logger.exception("Nesting optimizasyonu sırasında hata oluştu: %s", exc)
            raise RuntimeError(f"Nesting hesaplama hatası: {exc}") from exc
