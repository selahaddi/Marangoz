"""Atölye İmalat ve Montaj Şeması Vektörel Çizim Motoru (Shop Floor Drawing Engine).

Bu modül, marangoz ustası ve montaj ekibi için:
1. Parça ID'lerini ve montaj koordinatlarını gösteren 2D Ön Görünüş (Front Elevation)
2. Arkalık kanalı, süpürgelik kertmesi ve raf kaçışını gösteren 2D Yan Kesit (Side Section)
3. Mimari teknik resim ölçü çizgileri, kapak açılış üçgenleri ve antet bilgilerini
içeren yüksek çözünürlüklü vektörel SVG formatında atölye imalat şeması üretir.
"""

import math
from app.schemas.cabinet import BOMReport, CabinetConfig, DoorType, PanelPart


class ShopDrawingEngine:
    """Atölye montaj şeması ve teknik resim vektör üreticisi."""

    @classmethod
    def generate_svg(cls, bom: BOMReport, print_mode: bool = False) -> str:
        """Dolap BOM verisinden profesyonel CAD/CAM atölye montaj şeması SVG'si üretir."""
        config = bom.config
        all_modules = [config, *config.additional_modules]
        total_w = sum(m.width_mm for m in all_modules)
        max_h = max(m.height_mm for m in all_modules)
        max_d = max(m.depth_mm for m in all_modules)

        # SVG Tuval Boyutları (1600 x 1000 px - A3/Geniş Ekran Oranı)
        canvas_w = 1600
        canvas_h = 1000

        bg_color = "#FFFFFF" if print_mode else "#090D16"
        grid_color = "#E2E8F0" if print_mode else "#162032"
        border_color = "#0F172A" if print_mode else "#0284C7"
        line_color = "#1E293B" if print_mode else "#38BDF8"
        text_color = "#0F172A" if print_mode else "#F1F5F9"
        dim_color = "#2563EB" if print_mode else "#06B6D4"
        badge_bg = "#F1F5F9" if print_mode else "#1E293B"

        # Çizim Alanı Sınırları
        # Sol Taraf: Ön Görünüş (Front Elevation)
        # Sağ Taraf Üst: Yan Kesit (Side Cross-Section)
        # Sağ Taraf Alt: Antet ve Parça Listesi (Title Block & Summary)

        front_ox = 120
        front_oy = 150
        front_box_w = 880
        front_box_h = 720

        # Ölçekleme faktörü
        scale_x = front_box_w / total_w
        scale_y = front_box_h / max_h
        scale = min(scale_x, scale_y) * 0.88

        draw_w = total_w * scale
        draw_h = max_h * scale

        # Ön görünüş merkezleme
        elev_x = front_ox + (front_box_w - draw_w) / 2.0
        elev_y = front_oy + (front_box_h - draw_h) / 2.0

        svg_parts: list[str] = []
        svg_parts.append(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas_w} {canvas_h}" '
            f'width="{canvas_w}" height="{canvas_h}" style="background-color: {bg_color}; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">'
        )

        # Arka Plan Grid Ağı (Teknik Resim Milimetrik Kağıt Dokusu)
        svg_parts.append('<defs>')
        svg_parts.append(
            f'<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">'
            f'<path d="M 40 0 L 0 0 0 40" fill="none" stroke="{grid_color}" stroke-width="0.75"/>'
            f'</pattern>'
        )
        svg_parts.append('</defs>')
        svg_parts.append(f'<rect width="{canvas_w}" height="{canvas_h}" fill="url(#grid)" />')

        # Dış Çerçeve ve Başlık Bandı
        svg_parts.append(
            f'<rect x="20" y="20" width="{canvas_w - 40}" height="{canvas_h - 40}" '
            f'fill="none" stroke="{border_color}" stroke-width="2.5"/>'
        )
        svg_parts.append(
            f'<rect x="20" y="20" width="{canvas_w - 40}" height="65" '
            f'fill="{badge_bg}" stroke="{border_color}" stroke-width="1.5"/>'
        )
        svg_parts.append(
            f'<text x="45" y="58" font-size="22" font-weight="bold" fill="{text_color}">'
            f'MARANGOZ ATÖLYE İMALAT &amp; MONTAJ ŞEMASI (SHOP FLOOR BLUEPRINT)</text>'
        )
        svg_parts.append(
            f'<text x="{canvas_w - 45}" y="58" text-anchor="end" font-size="14" fill="{dim_color}">'
            f'ÖLÇEK: 1:{round(1.0 / scale, 1)} | HAT: {int(total_w)} × {int(max_h)} × {int(max_d)} mm</text>'
        )

        # -------------------------------------------------------------
        # 1. ÖN GÖRÜNÜŞ (FRONT ELEVATION)
        # -------------------------------------------------------------
        svg_parts.append(f'<!-- 1. ÖN GÖRÜNÜŞ -->')
        svg_parts.append(
            f'<text x="{front_ox}" y="{front_oy - 35}" font-size="15" font-weight="bold" fill="{dim_color}">'
            f'A. ÖN GÖRÜNÜŞ (FRONT ELEVATION &amp; PANEL ID\'LERİ)</text>'
        )

        # Dolap dış hat kutusu
        svg_parts.append(
            f'<rect x="{elev_x}" y="{elev_y}" width="{draw_w}" height="{draw_h}" '
            f'fill="none" stroke="{line_color}" stroke-width="3"/>'
        )

        # Modülleri ve bölmeleri çiz
        curr_x = elev_x
        for mod_idx, m in enumerate(all_modules, start=1):
            mod_w = m.width_mm * scale
            mod_h = m.height_mm * scale
            mod_y = elev_y + (max_h - m.height_mm) * scale
            t_mm = 18.0 * scale

            # Modül ayrımı (çoklu modül ise)
            if len(all_modules) > 1:
                svg_parts.append(
                    f'<line x1="{curr_x}" y1="{elev_y}" x2="{curr_x}" y2="{elev_y + draw_h}" '
                    f'stroke="{line_color}" stroke-dasharray="4,4" stroke-width="1.5"/>'
                )
                svg_parts.append(
                    f'<text x="{curr_x + mod_w / 2}" y="{elev_y - 12}" text-anchor="middle" font-size="11" font-weight="bold" fill="{dim_color}">'
                    f'MODÜL {mod_idx} ({int(m.width_mm)} mm)</text>'
                )

            # Yan dikmeler (Sol & Sağ)
            svg_parts.append(
                f'<rect x="{curr_x}" y="{mod_y}" width="{t_mm}" height="{mod_h}" fill="{badge_bg}" stroke="{line_color}" stroke-width="1.2"/>'
            )
            svg_parts.append(
                f'<rect x="{curr_x + mod_w - t_mm}" y="{mod_y}" width="{t_mm}" height="{mod_h}" fill="{badge_bg}" stroke="{line_color}" stroke-width="1.2"/>'
            )

            # Baza
            plinth_h = (m.plinth_height_mm if m.has_plinth else 0.0) * scale
            if plinth_h > 0:
                svg_parts.append(
                    f'<rect x="{curr_x}" y="{mod_y + mod_h - plinth_h}" width="{mod_w}" height="{plinth_h}" '
                    f'fill="{badge_bg}" stroke="{line_color}" stroke-width="1.5"/>'
                )
                svg_parts.append(
                    f'<text x="{curr_x + mod_w / 2}" y="{mod_y + mod_h - plinth_h / 2 + 4}" text-anchor="middle" font-size="10" fill="{text_color}">'
                    f'BAZA ({int(m.plinth_height_mm)} mm)</text>'
                )

            # Alt ve Üst Tabla
            svg_parts.append(
                f'<rect x="{curr_x + t_mm}" y="{mod_y}" width="{mod_w - 2 * t_mm}" height="{t_mm}" fill="{badge_bg}" stroke="{line_color}" stroke-width="1.2"/>'
            )
            svg_parts.append(
                f'<rect x="{curr_x + t_mm}" y="{mod_y + mod_h - plinth_h - t_mm}" width="{mod_w - 2 * t_mm}" height="{t_mm}" fill="{badge_bg}" stroke="{line_color}" stroke-width="1.2"/>'
            )

            # Raflar ve Bölmeler
            inner_h = mod_h - plinth_h - 2 * t_mm
            inner_y = mod_y + t_mm
            inner_w = mod_w - 2 * t_mm
            shelf_count = m.shelf_count
            if shelf_count > 0:
                shelf_gap = inner_h / (shelf_count + 1)
                for s_i in range(1, shelf_count + 1):
                    sy = inner_y + s_i * shelf_gap - t_mm / 2.0
                    svg_parts.append(
                        f'<rect x="{curr_x + t_mm}" y="{sy}" width="{inner_w}" height="{t_mm}" fill="{badge_bg}" stroke="{line_color}" stroke-width="1"/>'
                    )
                    # İç net raf açıklığı etiketi
                    clear_gap_mm = int(shelf_gap / scale)
                    svg_parts.append(
                        f'<text x="{curr_x + mod_w / 2}" y="{sy - 6}" text-anchor="middle" font-size="10" fill="{dim_color}">'
                        f'↕ {clear_gap_mm} mm</text>'
                    )

            # Çekmece Klapaları
            if m.drawer_count > 0:
                df_h = m.drawer_front_height_mm * scale
                for d_i in range(m.drawer_count):
                    dy = mod_y + mod_h - plinth_h - (d_i + 1) * df_h
                    svg_parts.append(
                        f'<rect x="{curr_x + 2}" y="{dy + 2}" width="{mod_w - 4}" height="{df_h - 4}" '
                        f'fill="none" stroke="{dim_color}" stroke-width="1.5" stroke-dasharray="3,3"/>'
                    )
                    # Kulp işareti
                    svg_parts.append(
                        f'<line x1="{curr_x + mod_w / 2 - 20}" y1="{dy + df_h / 2}" x2="{curr_x + mod_w / 2 + 20}" y2="{dy + df_h / 2}" stroke="{dim_color}" stroke-width="3"/>'
                    )
                    svg_parts.append(
                        f'<text x="{curr_x + 15}" y="{dy + 16}" font-size="9" font-weight="bold" fill="{text_color}">'
                        f'ÇEKMECE #{d_i + 1} ({int(m.drawer_front_height_mm)} mm)</text>'
                    )

            # Kapak Açılış Yönü Üçgenleri (Mimari Standart)
            if m.door_type == DoorType.SINGLE_LEFT:
                svg_parts.append(
                    f'<polygon points="{curr_x + 4},{mod_y + 4} {curr_x + mod_w - 4},{mod_y + mod_h / 2} {curr_x + 4},{mod_y + mod_h - plinth_h - 4}" '
                    f'fill="none" stroke="{dim_color}" stroke-width="1.2" stroke-dasharray="4,4" opacity="0.6"/>'
                )
            elif m.door_type == DoorType.SINGLE_RIGHT:
                svg_parts.append(
                    f'<polygon points="{curr_x + mod_w - 4},{mod_y + 4} {curr_x + 4},{mod_y + mod_h / 2} {curr_x + mod_w - 4},{mod_y + mod_h - plinth_h - 4}" '
                    f'fill="none" stroke="{dim_color}" stroke-width="1.2" stroke-dasharray="4,4" opacity="0.6"/>'
                )
            elif m.door_type == DoorType.DOUBLE:
                mid_x = curr_x + mod_w / 2.0
                svg_parts.append(
                    f'<polygon points="{curr_x + 4},{mod_y + 4} {mid_x - 2},{mod_y + mod_h / 2} {curr_x + 4},{mod_y + mod_h - plinth_h - 4}" '
                    f'fill="none" stroke="{dim_color}" stroke-width="1.2" stroke-dasharray="4,4" opacity="0.6"/>'
                )
                svg_parts.append(
                    f'<polygon points="{curr_x + mod_w - 4},{mod_y + 4} {mid_x + 2},{mod_y + mod_h / 2} {curr_x + mod_w - 4},{mod_y + mod_h - plinth_h - 4}" '
                    f'fill="none" stroke="{dim_color}" stroke-width="1.2" stroke-dasharray="4,4" opacity="0.6"/>'
                )
            elif m.door_type == DoorType.FLAP_UP:
                svg_parts.append(
                    f'<polygon points="{curr_x + 4},{mod_y + 4} {curr_x + mod_w / 2},{mod_y + mod_h - plinth_h - 4} {curr_x + mod_w - 4},{mod_y + 4}" '
                    f'fill="none" stroke="{dim_color}" stroke-width="1.2" stroke-dasharray="4,4" opacity="0.6"/>'
                )

            curr_x += mod_w

        # Ön Görünüş Dış Ölçü Çizgileri
        # 1. Toplam Genişlik (Üstte)
        dim_y = elev_y - 25
        svg_parts.append(
            f'<line x1="{elev_x}" y1="{dim_y}" x2="{elev_x + draw_w}" y2="{dim_y}" stroke="{dim_color}" stroke-width="1.5"/>'
        )
        svg_parts.append(
            f'<line x1="{elev_x}" y1="{dim_y - 6}" x2="{elev_x}" y2="{dim_y + 6}" stroke="{dim_color}" stroke-width="1.5"/>'
        )
        svg_parts.append(
            f'<line x1="{elev_x + draw_w}" y1="{dim_y - 6}" x2="{elev_x + draw_w}" y2="{dim_y + 6}" stroke="{dim_color}" stroke-width="1.5"/>'
        )
        svg_parts.append(
            f'<text x="{elev_x + draw_w / 2}" y="{dim_y - 8}" text-anchor="middle" font-size="13" font-weight="bold" fill="{dim_color}">'
            f'G: {int(total_w)} mm</text>'
        )

        # 2. Toplam Yükseklik (Solda)
        dim_x = elev_x - 30
        svg_parts.append(
            f'<line x1="{dim_x}" y1="{elev_y}" x2="{dim_x}" y2="{elev_y + draw_h}" stroke="{dim_color}" stroke-width="1.5"/>'
        )
        svg_parts.append(
            f'<line x1="{dim_x - 6}" y1="{elev_y}" x2="{dim_x + 6}" y2="{elev_y}" stroke="{dim_color}" stroke-width="1.5"/>'
        )
        svg_parts.append(
            f'<line x1="{dim_x - 6}" y1="{elev_y + draw_h}" x2="{dim_x + 6}" y2="{elev_y + draw_h}" stroke="{dim_color}" stroke-width="1.5"/>'
        )
        svg_parts.append(
            f'<text x="{dim_x - 12}" y="{elev_y + draw_h / 2}" text-anchor="middle" transform="rotate(-90 {dim_x - 12} {elev_y + draw_h / 2})" '
            f'font-size="13" font-weight="bold" fill="{dim_color}">Y: {int(max_h)} mm</text>'
        )

        # -------------------------------------------------------------
        # 2. YAN KESİT GÖRÜNÜŞÜ (SIDE CROSS-SECTION)
        # -------------------------------------------------------------
        svg_parts.append(f'<!-- 2. YAN KESİT GÖRÜNÜŞÜ -->')
        sec_ox = 1040
        sec_oy = 150
        sec_draw_w = max_d * scale
        sec_draw_h = max_h * scale

        svg_parts.append(
            f'<text x="{sec_ox}" y="{sec_oy - 35}" font-size="15" font-weight="bold" fill="{dim_color}">'
            f'B. YAN KESİT GÖRÜNÜŞÜ (SECTION PROFILE)</text>'
        )

        # Yan dikme profili
        svg_parts.append(
            f'<rect x="{sec_ox}" y="{sec_oy}" width="{sec_draw_w}" height="{sec_draw_h}" '
            f'fill="{badge_bg}" stroke="{line_color}" stroke-width="2.5"/>'
        )

        # Arkalık kanalı (Arka kenardan 20mm içeride, 8mm derinlik)
        groove_offset_x = sec_ox + (20.0 * scale)
        groove_w = 8.0 * scale
        svg_parts.append(
            f'<rect x="{groove_offset_x}" y="{sec_oy + 18.0 * scale}" width="{groove_w}" height="{sec_draw_h - 36.0 * scale}" '
            f'fill="none" stroke="#F97316" stroke-width="1.5" stroke-dasharray="3,3"/>'
        )
        svg_parts.append(
            f'<text x="{sec_ox + 5}" y="{sec_oy + sec_draw_h / 2}" font-size="9" fill="#F97316" transform="rotate(-90 {sec_ox + 5} {sec_oy + sec_draw_h / 2})">'
            f'ARKALIK KANALI (8×8.5 mm)</text>'
        )

        # Raf derinliği (Ön kenardan -20mm kapak payı düşülmüş)
        shelf_front_x = sec_ox + sec_draw_w - (20.0 * scale)
        svg_parts.append(
            f'<line x1="{shelf_front_x}" y1="{sec_oy + 18.0 * scale}" x2="{shelf_front_x}" y2="{sec_oy + sec_draw_h - 40.0 * scale}" '
            f'stroke="{dim_color}" stroke-width="1" stroke-dasharray="2,2"/>'
        )

        # Süpürgelik kertmesi (varsa)
        if config.has_baseboard_notch:
            nb_w = (config.baseboard_notch_depth_mm or 15.0) * scale
            nb_h = (config.baseboard_notch_height_mm or 80.0) * scale
            svg_parts.append(
                f'<rect x="{sec_ox}" y="{sec_oy + sec_draw_h - nb_h}" width="{nb_w}" height="{nb_h}" '
                f'fill="{bg_color}" stroke="{dim_color}" stroke-width="2"/>'
            )
            svg_parts.append(
                f'<text x="{sec_ox + nb_w + 6}" y="{sec_oy + sec_draw_h - nb_h / 2 + 4}" font-size="9" font-weight="bold" fill="{dim_color}">'
                f'SÜPÜRGELİK KERTME ({int(config.baseboard_notch_height_mm or 80)}×{int(config.baseboard_notch_depth_mm or 15)} mm)</text>'
            )

        # Yan Kesit Derinlik Ölçü Çizgisi
        dim_sec_y = sec_oy - 15
        svg_parts.append(
            f'<line x1="{sec_ox}" y1="{dim_sec_y}" x2="{sec_ox + sec_draw_w}" y2="{dim_sec_y}" stroke="{dim_color}" stroke-width="1.5"/>'
        )
        svg_parts.append(
            f'<line x1="{sec_ox}" y1="{dim_sec_y - 5}" x2="{sec_ox}" y2="{dim_sec_y + 5}" stroke="{dim_color}" stroke-width="1.5"/>'
        )
        svg_parts.append(
            f'<line x1="{sec_ox + sec_draw_w}" y1="{dim_sec_y - 5}" x2="{sec_ox + sec_draw_w}" y2="{dim_sec_y + 5}" stroke="{dim_color}" stroke-width="1.5"/>'
        )
        svg_parts.append(
            f'<text x="{sec_ox + sec_draw_w / 2}" y="{dim_sec_y - 6}" text-anchor="middle" font-size="12" font-weight="bold" fill="{dim_color}">'
            f'D: {int(max_d)} mm</text>'
        )

        # -------------------------------------------------------------
        # 3. İMALAT PARÇA LİSTESİ VE ANTET (TITLE BLOCK)
        # -------------------------------------------------------------
        svg_parts.append(f'<!-- 3. İMALAT ANTETİ VE PARÇA LİSTESİ -->')
        tbl_x = 1040
        tbl_y = 620
        tbl_w = 520
        tbl_h = 340

        svg_parts.append(
            f'<rect x="{tbl_x}" y="{tbl_y}" width="{tbl_w}" height="{tbl_h}" '
            f'fill="{badge_bg}" stroke="{border_color}" stroke-width="2"/>'
        )
        svg_parts.append(
            f'<rect x="{tbl_x}" y="{tbl_y}" width="{tbl_w}" height="32" '
            f'fill="{border_color}" />'
        )
        svg_parts.append(
            f'<text x="{tbl_x + 15}" y="{tbl_y + 21}" font-size="12" font-weight="bold" fill="#FFFFFF">'
            f'KRİTİK İMALAT &amp; MONTAJ KONTROL PARAMETRELERİ</text>'
        )

        params_list = [
            ("Gövde Plaka Malzemesi", config.body_material),
            ("Kapak Malzemesi", config.door_material or config.body_material),
            ("Bağlantı Mimarisi", "Lamello Cabineo 12 (3-Eksen)" if config.fastener_type == "cabineo_12" else "Minifiks Ø15 + Kavela Ø8"),
            ("Hırdavat Marka Tercihi", (config.hardware_brand or "Standart").upper()),
            ("Toplam Parça Sayısı", f"{len(bom.parts)} Adet Ahşap Panel"),
            ("Toplam CNC Delik / Yuva", f"{bom.total_drill_count} Adet Sistem 32 / Menteşe"),
            ("2.0mm Ön PVC Metrajı", f"{bom.total_pvc_20_meters:.1f} Metre"),
            ("Arkalık Montaj Tipi", "8 mm Kanal İçi Geçme (Grooved)" if config.back_panel_type == "grooved_8mm" else "3 mm Arkadan Çakma"),
        ]

        row_y = tbl_y + 55
        for label, val in params_list:
            svg_parts.append(
                f'<text x="{tbl_x + 15}" y="{row_y}" font-size="11" fill="{text_color}">{label}:</text>'
            )
            svg_parts.append(
                f'<text x="{tbl_x + tbl_w - 15}" y="{row_y}" text-anchor="end" font-size="11" font-weight="bold" fill="{dim_color}">{val}</text>'
            )
            svg_parts.append(
                f'<line x1="{tbl_x + 15}" y1="{row_y + 6}" x2="{tbl_x + tbl_w - 15}" y2="{row_y + 6}" stroke="{grid_color}" stroke-width="0.8"/>'
            )
            row_y += 32

        # Dipnot ve İmalatçı Onay Kutusu
        svg_parts.append(
            f'<text x="{tbl_x + 15}" y="{tbl_y + tbl_h - 15}" font-size="10" fill="{text_color}">'
            f'ATÖLYE SORUMLUSU ONAYI: _______________________    TARİH: ____/____/2026</text>'
        )

        svg_parts.append('</svg>')
        return "\n".join(svg_parts)

