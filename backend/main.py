"""
main.py — KhoUNICE Backend FastAPI v2.0.0
Quản lý kho vật liệu xây dựng cho HP Cons Việt Nam
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from routers import cong_trinh, phieu, hang_hoa, ton_kho, bao_cao, ai_routes, ai_config, files, auth, import_data, nhat_ky

# ── Khởi tạo app ─────────────────────────────────────────────
app = FastAPI(
    title="KhoUNICE API",
    description="Backend API cho hệ thống quản lý kho vật liệu xây dựng KhoUNICE - HP Cons Việt Nam",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS — cho phép frontend dev (Vite :5173) và production ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Include tất cả routers ───────────────────────────────────
app.include_router(cong_trinh.router)
app.include_router(phieu.router)
app.include_router(hang_hoa.router)
app.include_router(ton_kho.router)
app.include_router(bao_cao.router)
app.include_router(ai_routes.router)
app.include_router(ai_config.router)
app.include_router(files.router)
app.include_router(auth.router)
app.include_router(import_data.router)
app.include_router(nhat_ky.router)


# ── Health check ─────────────────────────────────────────────
@app.get("/api/health", tags=["system"])
def health_check():
    """Kiểm tra trạng thái server."""
    return {
        "status": "ok",
        "version": "2.0.0",
        "app": "KhoUNICE API",
        "company": "HP Cons Việt Nam",
    }


@app.get("/api/ping", tags=["system"])
def ping():
    return {"pong": True}


# ── Test kết nối Supabase ────────────────────────────────────
@app.get("/api/health/supabase", tags=["system"])
def health_supabase():
    """Kiểm tra kết nối Supabase."""
    import supabase_client as db
    ok, msg = db.test_connection()
    return {
        "supabase": "ok" if ok else "error",
        "message": msg,
    }


# ── Serve React frontend build (nếu folder tồn tại) ─────────
frontend_build = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_build.exists():
    # Serve static assets (JS, CSS, images)
    app.mount(
        "/assets",
        StaticFiles(directory=str(frontend_build / "assets")),
        name="assets"
    )

    # Catch-all: trả về index.html cho mọi route (SPA)
    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # Nếu là file tĩnh (png, jpg, svg, ico...) thì serve trực tiếp
        static_file = frontend_build / full_path
        if static_file.exists() and static_file.is_file():
            return FileResponse(str(static_file))
        # Fallback về index.html cho SPA routing
        index = frontend_build / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return {"error": "Frontend not built. Run: npm run build"}


# ── Entry point ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(Path(__file__).parent)],
    )
