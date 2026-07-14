"""
main.py — KhoUNICE Backend FastAPI v2.0.0
Quản lý kho vật liệu xây dựng cho HP Cons Việt Nam
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from routers import cong_trinh, phieu, hang_hoa, ton_kho, bao_cao, ai_routes, ai_config, files, auth, import_data, nhat_ky, ghi_chu

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
app.include_router(ghi_chu.router)


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


# ── Test kết nối hpcore (SSO) ─────────────────────────────────
@app.get("/api/health/hpcore", tags=["system"])
def health_hpcore():
    """Kiểm tra Firebase Admin SDK khởi tạo được + đọc được Firestore app_permissions của hpcore."""
    import hpcore_auth
    try:
        app_ref = hpcore_auth._get_hpcore_app()
        from firebase_admin import firestore
        db = firestore.client(app=app_ref)
        # Đọc thử 1 doc bất kỳ để xác nhận kết nối Firestore thật (không cần tồn tại)
        list(db.collection("app_permissions").limit(1).stream())
        return {"hpcore": "ok", "firebase_project": app_ref.project_id}
    except Exception as e:
        return {"hpcore": "error", "message": str(e)}


# ── Danh sách vai trò của app này (hpcore gọi để hiển thị khi phân quyền) ──
@app.get("/api/roles", tags=["system"])
def get_roles():
    return {
        "roles": [
            {"key": "admin", "label": "Admin"},
            {"key": "user", "label": "Thủ kho"},
        ]
    }


# ── TẠM THỜI (nhánh migrate-firestore, xoá trước khi merge main) ──
# Self-test firestore_client.py: insert/select/update/delete + counter,
# chỉ đụng vào collection rác "_migration_selftest*", không đụng dữ liệu thật.
@app.get("/api/health/firestore-selftest", tags=["system"])
def health_firestore_selftest():
    import firestore_client as fdb
    steps = []
    try:
        steps.append(("connect", "start"))
        app_ref = fdb._get_app()
        steps[-1] = ("connect", f"ok project={app_ref.project_id}")

        steps.append(("insert (counter table sim)", "start"))
        fdb.COUNTER_TABLES.add("_migration_selftest")
        row = fdb.insert("_migration_selftest", {"note": "hello"})[0]
        assert isinstance(row["id"], int) and row["id"] >= 1
        steps[-1] = ("insert (counter table sim)", f"ok id={row['id']}")

        steps.append(("select eq", "start"))
        found = fdb.select("_migration_selftest", filters=f"id=eq.{row['id']}")
        assert len(found) == 1 and found[0]["note"] == "hello"
        steps[-1] = ("select eq", "ok")

        steps.append(("update", "start"))
        updated = fdb.update("_migration_selftest", {"note": "world"}, filters=f"id=eq.{row['id']}")
        assert updated[0]["note"] == "world"
        steps[-1] = ("update", "ok")

        steps.append(("insert second + gte/order", "start"))
        row2 = fdb.insert("_migration_selftest", {"note": "second"})[0]
        assert row2["id"] == row["id"] + 1
        ordered = fdb.select("_migration_selftest", filters="id=gte.0", order="id.desc")
        assert ordered[0]["id"] == row2["id"]
        steps[-1] = ("insert second + gte/order", f"ok id2={row2['id']}")

        steps.append(("cleanup (delete all via id=gte.0)", "start"))
        deleted = fdb.delete("_migration_selftest", filters="id=gte.0")
        assert len(deleted) == 2
        remaining = fdb.select("_migration_selftest")
        assert len(remaining) == 0
        steps[-1] = ("cleanup (delete all via id=gte.0)", "ok")

        steps.append(("business fn smoke (get_all_cong_trinh trên collection rỗng)", "start"))
        cts = fdb.get_all_cong_trinh()
        assert cts == []
        steps[-1] = ("business fn smoke (get_all_cong_trinh trên collection rỗng)", "ok (rỗng, đúng vì chưa migrate dữ liệu thật)")

        return {"result": "PASS", "steps": steps}
    except Exception as e:
        return {"result": "FAIL", "steps": steps, "error": f"{type(e).__name__}: {e}"}


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
