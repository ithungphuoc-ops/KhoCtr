"""
routers/files.py — API endpoint tách và lưu PDF phiếu
"""
import os, tempfile, shutil, zipfile
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from typing import Optional
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import pdf_splitter
from config import get_settings

router = APIRouter(prefix="/api/files", tags=["files"])


@router.post("/split-pdf")
async def split_pdf(
    file: UploadFile     = File(..., description="File PDF cần tách"),
    loai: str            = Form("NK",  description="NK hoặc XK"),
    so_phieu: str        = Form("",    description="Số phiếu (gợi ý, AI có thể override)"),
    ngay: str            = Form("",    description="Ngày YYYY-MM-DD (gợi ý)"),
    doi_tac: str         = Form("",    description="Tên NCC/người nhận (gợi ý)"),
    api_key: Optional[str] = Query(None, description="Claude API key — dùng khi cần AI nhận diện trang"),
):
    """
    Upload PDF → tách thành các file riêng theo phiếu → trả về:
    - 1 file PDF → trả về file trực tiếp
    - Nhiều file → zip lại → trả về ZIP
    Cleanup temp dir sau khi xong.
    """
    # Lấy API key
    resolved_key = api_key
    if not resolved_key:
        try:
            resolved_key = get_settings().CLAUDE_API_KEY
        except Exception:
            resolved_key = ""

    suffix   = os.path.splitext(file.filename or "upload.pdf")[1] or ".pdf"
    tmp_dir  = None
    src_path = None

    try:
        # Tạo thư mục temp
        tmp_dir  = tempfile.mkdtemp(prefix="khounice_split_")
        src_path = os.path.join(tmp_dir, f"input{suffix}")

        content = await file.read()
        with open(src_path, "wb") as f:
            f.write(content)

        # Thư mục output
        out_dir = os.path.join(tmp_dir, "output")
        os.makedirs(out_dir, exist_ok=True)

        # Tách PDF
        result = pdf_splitter.split_and_save(
            src_path=src_path,
            loai=loai,
            so_phieu=so_phieu,
            ngay=ngay,
            doi_tac=doi_tac,
            root=out_dir,
            api_key=resolved_key or "",
        )

        saved = result.get("saved", [])
        if not saved:
            raise HTTPException(status_code=422,
                                detail="Không tách được file PDF. Kiểm tra lại định dạng.")

        saved_paths = [s["path"] for s in saved if os.path.exists(s["path"])]

        if not saved_paths:
            raise HTTPException(status_code=500, detail="Không có file nào được tạo ra.")

        # ── 1 file → trả về trực tiếp ────────────────────────
        if len(saved_paths) == 1:
            path = saved_paths[0]
            filename = os.path.basename(path)
            # Đọc vào memory để cleanup được
            with open(path, "rb") as f:
                data = f.read()
            shutil.rmtree(tmp_dir, ignore_errors=True)
            tmp_dir = None

            import io
            from fastapi.responses import Response
            return Response(
                content=data,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "X-Split-Summary": result.get("summary", ""),
                    "X-Files-Count": "1",
                }
            )

        # ── Nhiều file → zip lại ─────────────────────────────
        zip_path = os.path.join(tmp_dir, "phieu_tach.zip")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for path in saved_paths:
                zf.write(path, os.path.basename(path))

        with open(zip_path, "rb") as f:
            zip_data = f.read()

        shutil.rmtree(tmp_dir, ignore_errors=True)
        tmp_dir = None

        from fastapi.responses import Response
        return Response(
            content=zip_data,
            media_type="application/zip",
            headers={
                "Content-Disposition": 'attachment; filename="phieu_tach.zip"',
                "X-Split-Summary": result.get("summary", ""),
                "X-Files-Count": str(len(saved_paths)),
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tách PDF: {str(e)}")
    finally:
        # Cleanup nếu chưa cleanup
        if tmp_dir and os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir, ignore_errors=True)
