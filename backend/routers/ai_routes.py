"""
routers/ai_routes.py — API endpoints cho AI đọc phiếu
"""
import os, tempfile, shutil
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Header, Query
from typing import Optional
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import ai_reader
from config import get_settings

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _resolve_api_key(provider: str,
                     api_key_query: Optional[str],
                     x_api_key: Optional[str]) -> str:
    """Lấy API key theo thứ tự ưu tiên: query param → header → config."""
    key = api_key_query or x_api_key
    source = "query/header"
    if not key:
        settings = get_settings()
        if provider == "gemini":
            key = settings.GEMINI_API_KEY
        elif provider == "openai":
            key = settings.OPENAI_API_KEY
        else:
            key = settings.CLAUDE_API_KEY
        source = ".env"
    masked = (key[:6] + "..." + key[-4:]) if key and len(key) > 10 else ("SET" if key else "EMPTY")
    print(f"[ai_routes] provider={provider} | key_source={source} | key={masked}")
    if not key:
        raise HTTPException(
            status_code=400,
            detail=f"Thiếu API key cho provider '{provider}' — GEMINI_API_KEY chưa được set trong .env"
        )
    return key


@router.get("/test-gemini")
async def test_gemini_connection(
    api_key: Optional[str] = Query(None),
    x_api_key: Optional[str] = Header(None),
):
    """Test kết nối Gemini API với model nhẹ nhất. Trả về status và response."""
    import urllib.request, urllib.error, json
    key = _resolve_api_key("gemini", api_key, x_api_key)
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={key}"
    body = json.dumps({
        "contents": [{"parts": [{"text": "Trả lời đúng 1 từ: OK"}]}],
        "generationConfig": {"maxOutputTokens": 10}
    }).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            result = json.loads(r.read())
        text = result["candidates"][0]["content"]["parts"][0]["text"]
        return {"status": "ok", "gemini_reply": text, "key_prefix": key[:6] + "..."}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            detail = json.loads(raw)
        except Exception:
            detail = raw
        return {"status": "error", "http_code": e.code, "response": detail, "key_prefix": key[:6] + "..."}


@router.post("/doc-phieu")
async def doc_phieu(
    file: UploadFile = File(..., description="File ảnh hoặc PDF phiếu"),
    loai: str        = Form("NK",   description="NK hoặc XK"),
    provider: str    = Form("claude", description="claude hoặc gemini"),
    date_mode: str   = Form("auto",  description="auto | signature | signature_priority"),
    api_key: Optional[str] = Query(None, description="API key (tùy chọn)"),
    x_api_key: Optional[str] = Header(None, description="API key qua header"),
):
    """
    Upload 1 file ảnh hoặc PDF, AI đọc và trả về thông tin phiếu.
    Response: {so_phieu, ngay, doi_tac, ghi_chu, items[]}
    """
    key = _resolve_api_key(provider, api_key, x_api_key)

    # Lưu file tạm
    suffix = os.path.splitext(file.filename or "upload.pdf")[1] or ".pdf"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        settings = get_settings()
        model = settings.OPENAI_MODEL if provider == "openai" else settings.GEMINI_MODEL
        result = ai_reader.doc_phieu(
            file_path=tmp_path,
            loai=loai,
            api_key=key,
            provider=provider,
            date_mode=date_mode,
            model=model,
        )
        return result

    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi đọc phiếu: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/doc-phieu-multi")
async def doc_phieu_multi(
    file: UploadFile = File(..., description="PDF chứa nhiều phiếu"),
    loai: str        = Form("NK",    description="NK hoặc XK"),
    provider: str    = Form("claude", description="claude hoặc gemini"),
    date_mode: str   = Form("auto",   description="auto | signature | signature_priority"),
    api_key: Optional[str] = Query(None),
    x_api_key: Optional[str] = Header(None),
):
    """
    Upload PDF nhiều phiếu, AI nhận diện và trả về list phiếu.
    Response: [{so_phieu, ngay, doi_tac, ghi_chu, items[]}]
    """
    key = _resolve_api_key(provider, api_key, x_api_key)

    suffix = os.path.splitext(file.filename or "upload.pdf")[1] or ".pdf"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        settings = get_settings()
        model = settings.OPENAI_MODEL if provider == "openai" else settings.GEMINI_MODEL
        results = ai_reader.doc_phieu_multi(
            file_path=tmp_path,
            loai=loai,
            api_key=key,
            provider=provider,
            date_mode=date_mode,
            model=model,
        )
        return {"count": len(results), "phieu_list": results}

    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi đọc nhiều phiếu: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.get("/models")
async def get_models():
    """Trả về model AI hiện đang được cấu hình."""
    settings = get_settings()
    return {
        "gemini_model":  settings.GEMINI_MODEL,
        "claude_model":  "claude-sonnet-4-6",
        "openai_model":  settings.OPENAI_MODEL,
        "gemini_key_set": bool(settings.GEMINI_API_KEY),
        "claude_key_set": bool(settings.CLAUDE_API_KEY),
        "openai_key_set": bool(settings.OPENAI_API_KEY),
    }


@router.get("/health")
async def health_gemini():
    """Kiểm tra kết nối Gemini với model hiện tại trong .env."""
    import urllib.request, urllib.error, json as _json
    settings = get_settings()
    key = settings.GEMINI_API_KEY
    model = settings.GEMINI_MODEL
    if not key:
        return {"status": "error", "message": "GEMINI_API_KEY chưa được set trong .env"}
    url = f"https://generativelanguage.googleapis.com/v1/models/{model}:generateContent?key={key}"
    body = _json.dumps({
        "contents": [{"parts": [{"text": "Trả lời đúng 1 từ: OK"}]}],
        "generationConfig": {"maxOutputTokens": 10}
    }).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            result = _json.loads(r.read())
        text = result["candidates"][0]["content"]["parts"][0]["text"]
        return {"status": "ok", "model": model, "gemini_reply": text.strip()}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            err_detail = _json.loads(raw).get("error", {})
            msg = err_detail.get("message", raw)
            status_str = err_detail.get("status", "")
        except Exception:
            msg = raw[:300]
            status_str = ""
        if e.code == 429:
            return {"status": "quota_exceeded", "model": model,
                    "message": f"Hết quota Gemini ({model}). Đổi GEMINI_MODEL trong .env hoặc chờ reset."}
        return {"status": "error", "model": model, "http_code": e.code,
                "error_status": status_str, "message": msg}
    except Exception as ex:
        return {"status": "error", "model": model, "message": str(ex)}
