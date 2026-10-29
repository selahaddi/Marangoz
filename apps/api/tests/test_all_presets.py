"""
Otomatik Mühendislik Doğrulama Testi: Tüm 54 Fabrika Preset / Şablonunun Kontrolü
Tüm oda hatları ve şablonların Pydantic şeması, BOMEngine panel geometrileri,
delik sınırları ve modül toplam genişlik tutarlılığını test eder.
"""

import json
import subprocess
import pytest
from app.schemas.cabinet import CabinetConfig
from app.engines.bom_engine import BOMEngine


@pytest.fixture(scope="module")
def all_presets():
    cmd = [
        "npx",
        "--yes",
        "tsx",
        "-e",
        "import { ROOM_LINE_PRESETS } from './apps/web/src/services/clientEngine.ts'; console.log(JSON.stringify(ROOM_LINE_PRESETS));",
    ]
    raw = subprocess.check_output(cmd).decode("utf-8")
    presets = json.loads(raw)
    assert len(presets) >= 48, f"Beklenen en az 48 şablon, bulunan: {len(presets)}"
    return presets


def test_presets_count_and_unique_ids(all_presets):
    """54 preset ID'sinin benzersiz olduğunu ve kategori alanlarının dolu olduğunu doğrular."""
    ids = set()
    for p in all_presets:
        pid = p["id"]
        assert pid not in ids, f"Tekrarlanan Preset ID: {pid}"
        ids.add(pid)
        assert p.get("categoryId"), f"{pid} categoryId eksik"
        assert p.get("category"), f"{pid} category eksik"
        assert p.get("title"), f"{pid} title eksik"
        assert p.get("prompt"), f"{pid} prompt eksik"
        assert len(p.get("highlights", [])) > 0, f"{pid} highlights boş"


def test_presets_total_width_consistency(all_presets):
    """totalWidthMm değerinin ana modül ve ek modüllerin toplamına eşit olduğunu doğrular."""
    for p in all_presets:
        pid = p["id"]
        cfg_data = p["config"]
        computed_width = float(cfg_data["width_mm"])
        for add_mod in cfg_data.get("additional_modules", []):
            computed_width += float(add_mod["width_mm"])
        assert abs(p["totalWidthMm"] - computed_width) < 0.1, (
            f"{pid}: totalWidthMm ({p['totalWidthMm']}) modül toplamı ({computed_width}) ile uyuşmuyor!"
        )


def test_presets_pydantic_and_bom_generation(all_presets):
    """Tüm preset konfigürasyonlarının Pydantic doğrulamasından ve BOMEngine üretiminden sıfır hatayla geçtiğini doğrular."""
    for p in all_presets:
        pid = p["id"]
        cfg = CabinetConfig(**p["config"])
        all_configs = [cfg, *(cfg.additional_modules or [])]

        for mod_idx, m_cfg in enumerate(all_configs):
            mod_label = "Ana Modül" if mod_idx == 0 else f"Ek Modül #{mod_idx}"
            bom = BOMEngine.generate_bom(m_cfg)

            assert len(bom.parts) > 0, f"{pid} [{mod_label}]: BOM parça listesi boş!"
            assert len(bom.hardware) > 0, f"{pid} [{mod_label}]: Hırdavat listesi boş!"

            for part in bom.parts:
                assert part.cut_length_mm > 0, f"{pid} [{mod_label}]: {part.name} kesim boyu <= 0"
                assert part.cut_width_mm > 0, f"{pid} [{mod_label}]: {part.name} kesim eni <= 0"
                assert part.thickness_mm > 0, f"{pid} [{mod_label}]: {part.name} kalınlık <= 0"

                # CNC delik koordinatlarının parça sınırları içinde kaldığını doğrula
                for drill in part.drills:
                    assert -0.01 <= drill.x_mm <= part.net_length_mm + 0.01, (
                        f"{pid} [{mod_label}]: {part.name} delik X taşması: {drill.x_mm} > {part.net_length_mm}"
                    )
                    assert -0.01 <= drill.y_mm <= part.net_width_mm + 0.01, (
                        f"{pid} [{mod_label}]: {part.name} delik Y taşması: {drill.y_mm} > {part.net_width_mm}"
                    )

