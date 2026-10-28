"""CNC Delik ve Kanal Planı (DXF R2010) Üretim Motoru.

Her bir ahşap panel için docs/02_MANUFACTURING_AND_CAD_RULES.md belgesindeki
katman (layer) standartlarına %100 uyumlu DXF R2010 dosyaları üretir.
"""

import io
import logging
from pathlib import Path

import ezdxf
from ezdxf.document import Drawing

from app.core.config import ManufacturingConstants as MC
from app.schemas.cabinet import BOMReport, PanelPart

logger = logging.getLogger(__name__)


class DXFProductionEngine:
    """ezdxf kullanarak katmanlı CNC DXF R2010 çizimleri üretir."""

    LAYER_DEFINITIONS: tuple[tuple[str, int], ...] = (
        (MC.LAYER_OUTLINE, 7),         # Beyaz: Dış kesim konturu
        (MC.LAYER_NOTCH_CUT, 40),      # Altın: Süpürgelik / kolon kertme kesimi
        (MC.LAYER_GROOVE_BACK, 3),     # Yeşil: 8 mm arkalık kanalı
        (MC.LAYER_MINIFIX_CAM, 1),     # Kırmızı: Ø15 mm Minifiks eksantrik yuvası
        (MC.LAYER_MINIFIX_BOLT, 2),    # Sarı: Ø8 mm Minifiks mil deliği
        (MC.LAYER_DOWEL, 4),           # Camgöbeği: Ø8 mm Kavela deliği
        (MC.LAYER_CABINEO_POCKET, 14), # Koyu Kırmızı: Lamello Cabineo 12 Z=10.8mm cep
        (MC.LAYER_CABINEO_SCREW, 94),  # Açık Yeşil: Ø5 mm Cabineo vida deliği
        (MC.LAYER_SHELF_PIN, 5),       # Mavi: Ø5 mm Sistem 32 raf pimi deliği
        (MC.LAYER_HINGE_CUP, 6),       # Macenta: Ø35 mm Tas menteşe yuvası
        (MC.LAYER_DRAWER_SLIDE, 30),   # Turuncu: Ø5 mm Çekmece rayı montaj deliği
        ("ANNOTATION_INFO", 8),        # Gri: Parça kimliği ve PVC etiketleri
    )

    @classmethod
    def create_part_dxf_document(cls, part: PanelPart) -> Drawing:
        """Tek bir PanelPart nesnesi için DXF R2010 Drawing nesnesi oluşturur."""
        try:
            doc = ezdxf.new(dxfversion="R2010", setup=True)
            doc.units = ezdxf.units.MM

            for layer_name, color_aci in cls.LAYER_DEFINITIONS:
                if layer_name not in doc.layers:
                    doc.layers.add(name=layer_name, color=color_aci)

            msp = doc.modelspace()
            cut_l = part.cut_length_mm
            cut_w = part.cut_width_mm

            # 1. Parça Kesim Dış Konturu (Kapalı LWPOLYLINE)
            outline_points = [
                (0.0, 0.0),
                (cut_l, 0.0),
                (cut_l, cut_w),
                (0.0, cut_w),
            ]
            msp.add_lwpolyline(
                outline_points,
                close=True,
                dxfattribs={"layer": MC.LAYER_OUTLINE},
            )

            # 2. Arkalık Kanalı Operasyonları (GROOVE_BACK_8MM)
            for groove in part.grooves:
                gx0 = groove.x_start_mm
                gy0 = groove.y_start_mm
                gx1 = round(gx0 + groove.width_mm, 2)
                gy1 = round(gy0 + groove.length_mm, 2)
                groove_rect = [
                    (gx0, gy0),
                    (gx1, gy0),
                    (gx1, gy1),
                    (gx0, gy1),
                ]
                msp.add_lwpolyline(
                    groove_rect,
                    close=True,
                    dxfattribs={"layer": groove.layer},
                )

            # 3. CNC Delik Operasyonları (CIRCLE + Merkez Artı İşareti)
            for drill in part.drills:
                radius = round(drill.diameter_mm / 2.0, 2)
                msp.add_circle(
                    center=(drill.x_mm, drill.y_mm),
                    radius=radius,
                    dxfattribs={"layer": drill.layer},
                )
                # Merkez eksen çizgileri (CAM yazılımlarında delik merkezi yakalama için)
                cross_half = min(2.5, radius * 0.6)
                msp.add_line(
                    start=(drill.x_mm - cross_half, drill.y_mm),
                    end=(drill.x_mm + cross_half, drill.y_mm),
                    dxfattribs={"layer": drill.layer},
                )
                msp.add_line(
                    start=(drill.x_mm, drill.y_mm - cross_half),
                    end=(drill.x_mm, drill.y_mm + cross_half),
                    dxfattribs={"layer": drill.layer},
                )

            # 4. Parça Etiketi ve PVC Bilgisi (ANNOTATION_INFO)
            info_text = (
                f"{part.part_id} - {part.code} ({part.name}) | "
                f"KESIM: {cut_l:.1f}x{cut_w:.1f}x{part.thickness_mm:.0f}mm | "
                f"NET: {part.net_length_mm:.1f}x{part.net_width_mm:.1f}mm | "
                f"PVC(On/Arka/Ust/Alt): {part.edge_band.length_1_mm}/"
                f"{part.edge_band.length_2_mm}/{part.edge_band.width_1_mm}/"
                f"{part.edge_band.width_2_mm}mm"
            )
            text_entity = msp.add_text(
                info_text,
                dxfattribs={
                    "layer": "ANNOTATION_INFO",
                    "height": 10.0,
                },
            )
            text_entity.dxf.insert = (15.0, -22.0)

            return doc
        except Exception as exc:
            logger.exception(
                "Parça (%s) için DXF üretilirken hata oluştu: %s", part.code, exc
            )
            raise RuntimeError(f"DXF üretim hatası ({part.code}): {exc}") from exc

    @classmethod
    def export_part_dxf_string(cls, part: PanelPart) -> str:
        """Tek bir parçanın DXF R2010 içeriğini metin (string) olarak döndürür."""
        doc = cls.create_part_dxf_document(part)
        stream = io.StringIO()
        doc.write(stream)
        return stream.getvalue()

    @classmethod
    def export_all_dxf_files(cls, bom: BOMReport, output_dir: Path) -> list[Path]:
        """BOM raporundaki tüm parçalar için ayrı DXF dosyaları üretir."""
        output_dir.mkdir(parents=True, exist_ok=True)
        saved_files: list[Path] = []

        for part in bom.parts:
            filename = f"{part.part_id}_{part.code}.dxf"
            file_path = output_dir / filename
            doc = cls.create_part_dxf_document(part)
            doc.saveas(file_path)
            saved_files.append(file_path)

        return saved_files

