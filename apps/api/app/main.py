"""Marangoz FastAPI Ana Uygulama Girişi."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.routers.cabinet import router as cabinet_router


def create_app() -> FastAPI:
    """FastAPI uygulamasını yapılandırır ve döndürür."""
    settings = get_settings()

    application = FastAPI(
        title="Marangoz CAD/CAM & Nesting Mühendislik API",
        description=(
            "Doğal dilden parametrik dolap tasarımı, deterministik BOM, "
            "3D GLB modelleme, ezdxf R2010 CNC delik planı ve rectpack kesim optimizasyonu."
        ),
        version="0.1.0",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.exception_handler(Exception)
    async def global_exception_handler(
        _request: Request, exc: Exception
    ) -> JSONResponse:
        """Beklenmeyen hataları standart JSON zarfında döndürür."""
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "data": None,
                "error": f"Sunucu içi işlem hatası: {exc}",
            },
        )

    application.include_router(cabinet_router)
    return application


app = create_app()

