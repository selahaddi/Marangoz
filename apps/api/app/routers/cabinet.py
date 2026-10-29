"""Dolap tasarımı, BOM, 3D GLB, CNC DXF ve Nesting API uç noktaları."""

import base64
import csv
import io
import json
import logging
import uuid
import zipfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.core.config import get_settings
from app.engines.bom_engine import BOMEngine
from app.engines.cnc_post_engine import CNCPostProcessorEngine
from app.engines.dxf_engine import DXFProductionEngine
from app.engines.geometry_engine import CabinetGeometryEngine
from app.engines.nesting_engine import NestingEngine
from app.engines.parser_engine import SemanticParserEngine
from app.engines.revision_engine import RevisionEngine
from app.schemas.cabinet import (
    ApiResponse,
    BOMReport,
    CabinetConfig,
    ParsePromptRequest,
    ParseSketchRequest,
    ProductionPackageResponse,
)
from app.schemas.revision import (
    RevisionRequest,
    RevisionResponse,
    RevisionResponseData,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["cabinet-engineering"])


def _build_bom_csv_string(bom: BOMReport) -> str:
    """BOM raporunu fabrikada doğrudan Excel'de açılabilecek UTF-8 CSV metnine dönüştürür."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "Parca_ID",
            "Kod",
            "Parca_Adi",
            "Malzeme",
            "Kalinlik_mm",
            "Adet",
            "Net_Boy_mm",
            "Net_En_mm",
            "Kesim_Boy_mm",
            "Kesim_En_mm",
            "PVC_Boy_Dusum_mm",
            "PVC_En_Dusum_mm",
            "PVC_On_mm",
            "PVC_Arka_mm",
            "PVC_Ust_mm",
            "PVC_Alt_mm",
            "Alan_m2",
            "CNC_Delik_Sayisi",
        ]
    )
    for part in bom.parts:
        writer.writerow(
            [
                part.part_id,
                part.code,
                part.name,
                part.material,
                part.thickness_mm,
                part.quantity,
                part.net_length_mm,
                part.net_width_mm,
                part.cut_length_mm,
                part.cut_width_mm,
                part.pvc_deduction_length_mm,
                part.pvc_deduction_width_mm,
                part.edge_band.length_1_mm,
                part.edge_band.length_2_mm,
                part.edge_band.width_1_mm,
                part.edge_band.width_2_mm,
                part.area_m2,
                len(part.drills),
            ]
        )
    return output.getvalue()


@router.get("/healthz", response_model=ApiResponse[dict[str, str]])
async def health_check() -> ApiResponse[dict[str, str]]:
    """Servis sağlık durumunu ve aktif mühendislik motorlarını kontrol eder."""
    settings = get_settings()
    parser_mode = (
        "gemini_api_enabled"
        if settings.gemini_api_key.strip()
        else "deterministic_local_parser"
    )
    return ApiResponse(
        success=True,
        data={
            "status": "healthy",
            "service": "marangoz-cad-cam-api",
            "parser_mode": parser_mode,
            "cad_engine": "trimesh-gltf2-glb",
            "dxf_engine": "ezdxf-R2010",
            "nesting_engine": "rectpack-guillotine",
        },
        error=None,
    )


@router.post("/parse", response_model=ApiResponse[CabinetConfig])
async def parse_natural_language_prompt(
    payload: ParsePromptRequest,
) -> ApiResponse[CabinetConfig]:
    """Doğal dil istemini doğrulanmış bir CabinetConfig JSON şemasına ayrıştırır."""
    try:
        config = SemanticParserEngine.parse_prompt(payload.prompt)
        return ApiResponse(success=True, data=config, error=None)
    except Exception as exc:
        logger.exception("Doğal dil ayrıştırma hatası: %s", exc)
        return ApiResponse(
            success=False,
            data=None,
            error=f"Doğal dil istemi ayrıştırılamadı: {exc}",
        )


@router.post("/parse_sketch", response_model=ApiResponse[CabinetConfig])
async def parse_sketch_image(
    payload: ParseSketchRequest,
) -> ApiResponse[CabinetConfig]:
    """Eskiz veya rölöve fotoğrafını Gemini Vision ile CabinetConfig şemasına ayrıştırır."""
    try:
        raw_b64 = payload.image_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        image_bytes = base64.b64decode(raw_b64)
        config = SemanticParserEngine.parse_sketch(
            image_bytes=image_bytes,
            mime_type=payload.mime_type,
            prompt=payload.prompt,
        )
        return ApiResponse(success=True, data=config, error=None)
    except Exception as exc:
        logger.exception("Eskiz ayrıştırma hatası: %s", exc)
        return ApiResponse(
            success=False,
            data=None,
            error=f"Eskiz görseli ayrıştırılamadı: {exc}",
        )


@router.post("/revise", response_model=RevisionResponse)
async def revise_cabinet(payload: RevisionRequest) -> RevisionResponse:
    """Mevcut dolap parametrelerini doğal dilde konuşarak iteratif olarak günceller."""
    try:
        updated_cfg, assistant_msg, diffs = RevisionEngine.revise_config(
            current_config=payload.current_config,
            instruction=payload.instruction,
            history=payload.history,
        )
        return RevisionResponse(
            success=True,
            message="Tasarım başarıyla revize edildi",
            data=RevisionResponseData(
                updated_config=updated_cfg,
                assistant_message=assistant_msg,
                diff_summary=diffs,
            ),
        )
    except Exception as exc:
        logger.exception("Dolap revizyon hatası: %s", exc)
        return RevisionResponse(
            success=False,
            message=f"Revizyon uygulanamadı: {exc}",
            data=RevisionResponseData(
                updated_config=payload.current_config,
                assistant_message=f"İşlem sırasında hata oluştu: {exc}",
                diff_summary=[],
            ),
        )


@router.post("/generate", response_model=ApiResponse[ProductionPackageResponse])
async def generate_production_package(
    config: CabinetConfig,
) -> ApiResponse[ProductionPackageResponse]:
    """CabinetConfig üzerinden BOM, 3D GLB, CNC DXF R2010, Nesting SVG ve ZIP üretim paketi üretir."""
    try:
        job_id = uuid.uuid4().hex[:12]
        settings = get_settings()
        job_dir = Path(settings.artifacts_dir) / job_id
        dxf_dir = job_dir / "dxf"
        job_dir.mkdir(parents=True, exist_ok=True)

        # 1. Deterministik BOM ve CNC Delik Hesaplaması
        bom = BOMEngine.generate_bom(config)

        # 2. 3D Katı Model (GLB) Üretimi
        glb_path = job_dir / "cabinet_model.glb"
        glb_bytes = CabinetGeometryEngine.generate_glb_bytes(bom)
        glb_path.write_bytes(glb_bytes)
        glb_base64 = base64.b64encode(glb_bytes).decode("ascii")

        # 3. CNC Katmanlı DXF R2010, ISO G-Code (.nc), WoodWOP (.mpr) ve Biesse (.cix) Dosyaları Üretimi
        dxf_paths = DXFProductionEngine.export_all_dxf_files(bom, dxf_dir)
        dxf_filenames = [p.name for p in dxf_paths]
        gcode_dir = job_dir / "gcode"
        mpr_dir = job_dir / "mpr"
        cix_dir = job_dir / "cix"
        gcode_paths, mpr_paths, cix_paths = CNCPostProcessorEngine.export_all_cnc_programs(
            bom, gcode_dir, mpr_dir, cix_dir
        )
        cix_filenames = [p.name for p in cix_paths]

        # 4. 2D Giyotin Plaka Kesim Optimizasyonu (Nesting)
        nesting = NestingEngine.run_nesting(bom)

        # 5. Dosyaları Kaydet ve Üretim Paketi ZIP Arşivini Oluştur
        bom_csv_str = _build_bom_csv_string(bom)
        bom_csv_path = job_dir / "kesim_ve_malzeme_listesi.csv"
        bom_csv_path.write_text(bom_csv_str, encoding="utf-8-sig")

        bom_json_path = job_dir / "bom_report.json"
        bom_json_path.write_text(
            json.dumps(bom.model_dump(mode="json"), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        zip_path = job_dir / f"marangoz_uretim_paketi_{job_id}.zip"
        with zipfile.ZipFile(zip_path, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.write(glb_path, arcname="3d_model/cabinet_model.glb")
            zf.write(bom_csv_path, arcname="bom/kesim_ve_malzeme_listesi.csv")
            zf.write(bom_json_path, arcname="bom/bom_report.json")
            for sheet in nesting.sheets:
                zf.writestr(
                    f"nesting/plaka_{sheet.sheet_index:02d}_kesim_semasi.svg",
                    sheet.svg_content,
                )
            for dxf_file in dxf_paths:
                zf.write(dxf_file, arcname=f"cnc_dxf/{dxf_file.name}")
            for nc_file in gcode_paths:
                zf.write(nc_file, arcname=f"cnc_gcode/{nc_file.name}")
            for mpr_file in mpr_paths:
                zf.write(mpr_file, arcname=f"cnc_mpr/{mpr_file.name}")
            for cix_file in cix_paths:
                zf.write(cix_file, arcname=f"cnc_cix/{cix_file.name}")

        package_response = ProductionPackageResponse(
            job_id=job_id,
            config=config,
            bom=bom,
            nesting=nesting,
            glb_base64=glb_base64,
            dxf_filenames=dxf_filenames,
            cix_filenames=cix_filenames,
            zip_download_url=f"/api/v1/jobs/{job_id}/download-zip",
        )
        return ApiResponse(success=True, data=package_response, error=None)
    except Exception as exc:
        logger.exception("Üretim paketi oluşturulurken hata: %s", exc)
        return ApiResponse(
            success=False,
            data=None,
            error=f"Üretim paketi oluşturulamadı: {exc}",
        )


@router.get("/jobs/{job_id}/download-zip")
async def download_production_zip(job_id: str) -> FileResponse:
    """Üretilen tam fabrika üretim paketini (.zip) indirir."""
    if not job_id.isalnum():
        raise HTTPException(status_code=400, detail="Geçersiz iş kimliği (job_id).")

    settings = get_settings()
    zip_path = (
        Path(settings.artifacts_dir)
        / job_id
        / f"marangoz_uretim_paketi_{job_id}.zip"
    )
    if not zip_path.is_file():
        raise HTTPException(status_code=404, detail="Üretim paketi ZIP dosyası bulunamadı.")

    return FileResponse(
        path=zip_path,
        media_type="application/zip",
        filename=f"marangoz_uretim_paketi_{job_id}.zip",
    )


@router.get("/jobs/{job_id}/dxf/{filename}")
async def download_single_dxf(job_id: str, filename: str) -> FileResponse:
    """Tek bir parçaya ait CNC DXF R2010 dosyasını indirir."""
    if not job_id.isalnum() or "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Geçersiz dosya isteği.")

    settings = get_settings()
    dxf_path = Path(settings.artifacts_dir) / job_id / "dxf" / filename
    if not dxf_path.is_file():
        raise HTTPException(status_code=404, detail="DXF dosyası bulunamadı.")

    return FileResponse(
        path=dxf_path,
        media_type="application/dxf",
        filename=filename,
    )


@router.get("/jobs/{job_id}/gcode/{filename}")
async def download_single_gcode(job_id: str, filename: str) -> FileResponse:
    """Tek bir parçaya ait ISO G-Code (.nc) dosyasını indirir."""
    if not job_id.isalnum() or "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Geçersiz dosya isteği.")

    settings = get_settings()
    nc_path = Path(settings.artifacts_dir) / job_id / "gcode" / filename
    if not nc_path.is_file():
        raise HTTPException(status_code=404, detail="G-Code (.nc) dosyası bulunamadı.")

    return FileResponse(
        path=nc_path,
        media_type="text/plain",
        filename=filename,
    )


@router.get("/jobs/{job_id}/mpr/{filename}")
async def download_single_mpr(job_id: str, filename: str) -> FileResponse:
    """Tek bir parçaya ait Homag WoodWOP (.mpr) dosyasını indirir."""
    if not job_id.isalnum() or "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Geçersiz dosya isteği.")

    settings = get_settings()
    mpr_path = Path(settings.artifacts_dir) / job_id / "mpr" / filename
    if not mpr_path.is_file():
        raise HTTPException(status_code=404, detail="WoodWOP (.mpr) dosyası bulunamadı.")

    return FileResponse(
        path=mpr_path,
        media_type="text/plain",
        filename=filename,
    )


@router.get("/jobs/{job_id}/cix/{filename}")
async def download_single_cix(job_id: str, filename: str) -> FileResponse:
    """Tek bir parçaya ait Biesse bSolid / BiesseWorks (.cix) dosyasını indirir."""
    if not job_id.isalnum() or "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Geçersiz dosya isteği.")

    settings = get_settings()
    cix_path = Path(settings.artifacts_dir) / job_id / "cix" / filename
    if not cix_path.is_file():
        raise HTTPException(status_code=404, detail="Biesse (.cix) dosyası bulunamadı.")

    return FileResponse(
        path=cix_path,
        media_type="text/plain",
        filename=filename,
    )

