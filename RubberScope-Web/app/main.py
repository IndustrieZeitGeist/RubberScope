import base64
import io
import logging
import os
import secrets
import tempfile
from pathlib import Path
from threading import Lock
from typing import Annotated, Literal
from binascii import Error as Base64Error

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from PIL import Image, UnidentifiedImageError

from .rubberscope_engine import analyze, metadata_scale

ROOT = Path(__file__).resolve().parent
PASSWORD = os.getenv("RUBBERSCOPE_PASSWORD")
if os.getenv("RUBBERSCOPE_HOSTED") == "1" and not PASSWORD:
    raise RuntimeError("RUBBERSCOPE_PASSWORD fehlt.")
basic = HTTPBasic(auto_error=False)
analysis_slot = Lock()
logger = logging.getLogger(__name__)


def authenticate(credentials: HTTPBasicCredentials | None = Depends(basic)):
    if not PASSWORD:
        return
    if (
        credentials is None
        or credentials.username != "rubberscope"
        or not secrets.compare_digest(credentials.password.encode(), PASSWORD.encode())
    ):
        raise HTTPException(401, "Anmeldung erforderlich", {"WWW-Authenticate": "Basic"})


app = FastAPI(
    dependencies=[Depends(authenticate)], docs_url=None, redoc_url=None, openapi_url=None
)


@app.get("/")
def home():
    return FileResponse(ROOT / "index.html", headers={"Cache-Control": "no-store"})


@app.get("/assets/{name}")
def asset(name: str):
    if name not in {"style.css", "web.js", "methoden.html", "quellen.html", "sources.html"}:
        raise HTTPException(404)
    return FileResponse(ROOT / name)


@app.get("/health")
def health():
    return {"status": "ok"}


ShortText = Annotated[str, Field(max_length=160)]
Coordinate = Annotated[int, Field(ge=0, le=4_000_000)]


class AnalysisSettings(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    mode: Literal["riss"] = "riss"
    algorithm: Literal["rissoptimiert", "erweitert"] = "rissoptimiert"
    polarity: Literal["dunkel", "hell"] = "dunkel"
    sensitivity: float = Field(default=1, ge=0.1, le=5)
    min_area: int = Field(default=16, ge=1, le=1_000_000)
    scale_um: float | None = Field(default=None, ge=0.00001, le=100000)
    prefer_metadata: bool = False
    scale_uncertainty_pct: float | None = Field(default=None, ge=0, le=50)
    strain_direction_deg: float | None = Field(default=None, ge=0, lt=180)
    roi: tuple[Coordinate, Coordinate, Coordinate, Coordinate] | None = None
    bright_features: bool = False
    surface_features: bool = False
    exclude_edge_objects: bool = False
    robustness: bool = False
    sample_state: Literal["Unbekannt", "Ungealtert (Referenz)", "Gealtert"] = "Unbekannt"
    sample_id: ShortText = ""
    comparison_group: ShortText = ""
    operator: ShortText = ""
    test_context: ShortText = ""
    manual_rating: ShortText = ""
    controlled_acquisition: bool = False
    edge_cracks: bool = False

    @model_validator(mode="after")
    def check_roi(self):
        if self.roi:
            x0, y0, x1, y1 = self.roi
            if x0 >= x1 or y0 >= y1:
                raise ValueError("ROI: Ende muss rechts und unter dem Anfang liegen.")
        return self


def read_settings(request, polarity, scale, sensitivity, min_area):
    raw = request.headers.get("x-rubberscope-settings")
    try:
        if raw is not None:
            return AnalysisSettings.model_validate_json(base64.b64decode(raw, validate=True))
        return AnalysisSettings(polarity=polarity, scale_um=scale,
                                sensitivity=sensitivity, min_area=min_area)
    except Base64Error as exc:
        raise HTTPException(422, "Die Kodierung der Einstellungen ist ungültig.") from exc
    except ValidationError as exc:
        issues = []
        for error in exc.errors():
            field = ".".join(map(str, error["loc"])) or "Einstellungen"
            issues.append(f"{field} – {error['msg']}")
        raise HTTPException(422, " ".join(issues)) from exc

@app.post("/api/analyze")
async def analyze_image(
    request: Request,
    polarity: str = "dunkel",
    scale: float | None = None,
    sensitivity: float = 1.0,
    min_area: int = 16,
):
    from starlette.concurrency import run_in_threadpool

    if request.headers.get("content-type") != "application/octet-stream":
        raise HTTPException(415, "Bitte ein Bild über das Formular hochladen.")
    settings = read_settings(request, polarity, scale, sensitivity, min_area)
    if not analysis_slot.acquire(blocking=False):
        raise HTTPException(503, "Eine Analyse läuft bereits. Bitte erneut versuchen.")
    try:
        with tempfile.TemporaryDirectory(prefix="rubberscope-") as directory:
            path = Path(directory) / "probe"
            size = 0
            with path.open("wb") as target:
                async for chunk in request.stream():
                    size += len(chunk)
                    if size > 16 * 1024 * 1024:
                        raise HTTPException(413, "Maximal 16 MiB pro Bild.")
                    target.write(chunk)
            return await run_in_threadpool(process_image, path, settings)
    finally:
        analysis_slot.release()


def process_image(path, settings):
    try:
        with Image.open(path, formats=["PNG", "JPEG", "TIFF", "BMP"]) as img:
            if img.width * img.height > 4_000_000 or getattr(img, "n_frames", 1) != 1:
                raise HTTPException(422, "Bitte ein Einzelbild mit höchstens 4 Millionen Pixeln verwenden.")
            suffix = {"PNG": ".png", "JPEG": ".jpg", "TIFF": ".tif", "BMP": ".bmp"}[img.format]
            if min(img.size) < 30 and settings.algorithm == "erweitert":
                raise HTTPException(422, "Für Weber-Kontrast muss das Bild mindestens 30 × 30 Pixel groß sein.")
            if settings.roi and (settings.roi[2] > img.width or settings.roi[3] > img.height):
                raise HTTPException(422, "Der Bildausschnitt liegt außerhalb des Bildes.")
            img.load()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(422, "Das Bild konnte nicht gelesen werden.") from exc
    image_path = path.rename(path.with_suffix(suffix))
    try:
        options = settings.model_dump(exclude={"prefer_metadata"})
        if settings.prefer_metadata and metadata_scale(image_path)[0] is not None:
            options["scale_um"] = None
        result = analyze(image_path, **options)
        overlay = Image.fromarray(result["overlay"])
        overlay.thumbnail((1400, 1400))
        buffer = io.BytesIO()
        overlay.save(buffer, format="PNG")
    except Exception as exc:
        logger.exception("RubberScope-Analyse fehlgeschlagen")
        raise HTTPException(500, "Die Bildanalyse ist fehlgeschlagen.") from exc
    summary = result["summary"]
    return {
        "configuration": settings.model_dump(),
        "robustness": summary.get("robustness"),
        "image": {key: summary[key] for key in (
            "analysis_version", "sha256", "width_px", "height_px", "source_dtype",
            "intensity_conversion", "image_note", "normative_status",
        )},
        "overlay": base64.b64encode(buffer.getvalue()).decode("ascii"),
        "metrics": {key: summary.get(key) for key in (
            "object_count", "feature_area_fraction_pct", "crack_total_length_px",
            "crack_mean_width_px", "scale_um_per_px", "scale_source",
            "crack_length_density_mm_per_mm2", "crack_mean_width_um",
            "raw_object_count", "edge_object_count", "effective_evaluated_area_px2",
            "effective_evaluated_area_mm2", "feature_density_mm2", "crack_total_length_mm",
            "crack_perpendicular_length_fraction_pct", "crack_perp_count",
            "uncertainty_length_density_rel_pct", "uncertainty_area_rel_pct",
            "bright_feature_count", "bright_feature_area_fraction_pct",
            "highlight_object_count", "highlight_area_fraction_pct",
            "image_median_gray", "image_p95_gray", "image_p99_gray", "surface_texture_rms_gray",
        )},
    }


