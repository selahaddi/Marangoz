"""3D Katı Modelleme ve GLB (Binary glTF 2.0) Üretim Motoru.

Deterministik BOMEngine tarafından hesaplanan 3D parça koordinatlarını kullanarak
etkileşimli web görüntüleyici ve CAD yazılımları için GLB modeli üretir.
"""

import logging
from pathlib import Path

import numpy as np
import trimesh

from app.schemas.cabinet import BOMReport, PanelPart

logger = logging.getLogger(__name__)


class CabinetGeometryEngine:
    """Parametrik dolap parçalarından 3D sahne ve GLB ikili dosyası oluşturur."""

    @staticmethod
    def _hex_to_rgba(hex_color: str, alpha: int = 255) -> list[int]:
        """#RRGGBB formatındaki renk kodunu [R, G, B, A] listesine dönüştürür."""
        clean = hex_color.lstrip("#")
        if len(clean) != 6:
            return [240, 235, 225, alpha]
        r = int(clean[0:2], 16)
        g = int(clean[2:4], 16)
        b = int(clean[4:6], 16)
        return [r, g, b, alpha]

    @classmethod
    def _create_panel_mesh(cls, part: PanelPart) -> trimesh.Trimesh:
        """Tek bir ahşap panel için 3D kutu (box) katı modeli oluşturur (birim: metre)."""
        t3d = part.transform_3d
        # glTF standardı metre birimindedir (mm -> m dönüşümü: / 1000.0)
        extents = (
            t3d.size_x_mm / 1000.0,
            t3d.size_y_mm / 1000.0,
            t3d.size_z_mm / 1000.0,
        )
        transform = np.eye(4, dtype=np.float64)
        transform[0, 3] = t3d.center_x_mm / 1000.0
        transform[1, 3] = t3d.center_y_mm / 1000.0
        transform[2, 3] = t3d.center_z_mm / 1000.0

        mesh = trimesh.creation.box(extents=extents, transform=transform)
        rgba = cls._hex_to_rgba(t3d.color_hex)
        mesh.visual.vertex_colors = np.tile(rgba, (len(mesh.vertices), 1))
        return mesh

    @classmethod
    def generate_glb_bytes(cls, bom: BOMReport) -> bytes:
        """BOM raporundaki tüm parçaları 3D sahnede birleştirip GLB byte dizisi olarak döndürür."""
        try:
            scene = trimesh.Scene()
            for part in bom.parts:
                mesh = cls._create_panel_mesh(part)
                node_name = f"{part.part_id}_{part.code}"
                scene.add_geometry(
                    geometry=mesh,
                    node_name=node_name,
                    geom_name=node_name,
                )

            glb_data: bytes = scene.export(file_type="glb")
            return glb_data
        except Exception as exc:
            logger.exception("3D GLB model üretimi sırasında hata oluştu: %s", exc)
            raise RuntimeError(f"3D GLB model üretilemedi: {exc}") from exc

    @classmethod
    def export_glb_file(cls, bom: BOMReport, output_path: Path) -> Path:
        """3D GLB modelini belirtilen dosya yoluna kaydeder."""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        glb_bytes = cls.generate_glb_bytes(bom)
        output_path.write_bytes(glb_bytes)
        return output_path
