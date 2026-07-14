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


# ── TẠM THỜI (nhánh migrate-firestore, xoá trước khi merge main) ──
# Self-test toàn bộ luồng nghiệp vụ chính qua firestore_client, dùng dữ liệu
# giả (prefix "___selftest___") rồi dọn sạch — không đụng dữ liệu thật.
@app.get("/api/health/firestore-integration-selftest", tags=["system"])
def health_firestore_integration_selftest():
    import firestore_client as fdb
    steps = []
    ct_id = None
    try:
        steps.append(("1. tao cong trinh", "start"))
        ct = fdb.upsert_cong_trinh(ma_ct="___selftest___", ten_ct="CT Test Migrate", dia_chi="Test")
        ct_id = ct["id"]
        steps[-1] = ("1. tao cong trinh", f"ok id={ct_id}")

        steps.append(("2. tao hang hoa", "start"))
        hh = fdb.create_hang_hoa({"ma_hang": "___SELFTEST_SP1", "ten_hang": "Xi mang test",
                                   "dvt": "bao", "nhom": "VLXD", "cong_trinh_id": ct_id})
        assert hh["ma_hang"] == "___SELFTEST_SP1"
        steps[-1] = ("2. tao hang hoa", "ok")

        steps.append(("3. tao phieu nhap + chi tiet", "start"))
        p_nk = fdb.create_phieu(cong_trinh_id=ct_id, loai="NK", so_phieu="NK-TEST-1", ngay="2026-07-14",
                                 doi_tac="NCC Test", tong_tien=1000000)
        fdb.push_chi_tiet(p_nk["id"], [{"ten_hang": "Xi mang test", "ma_hang": "___SELFTEST_SP1",
                                         "dvt": "bao", "so_luong": 100, "don_gia": 10000, "thanh_tien": 1000000}])
        steps[-1] = ("3. tao phieu nhap + chi tiet", f"ok phieu_id={p_nk['id']}")

        steps.append(("4. tao phieu xuat + chi tiet", "start"))
        p_xk = fdb.create_phieu(cong_trinh_id=ct_id, loai="XK", so_phieu="XK-TEST-1", ngay="2026-07-14",
                                 doi_tac="Cong trinh", tong_tien=300000)
        fdb.push_chi_tiet(p_xk["id"], [{"ten_hang": "Xi mang test", "ma_hang": "___SELFTEST_SP1",
                                         "dvt": "bao", "so_luong": 30, "don_gia": 10000, "thanh_tien": 300000}])
        steps[-1] = ("4. tao phieu xuat + chi tiet", f"ok phieu_id={p_xk['id']}")

        steps.append(("5. tinh ton kho (compute_ton_kho)", "start"))
        ton = fdb.compute_ton_kho(cong_trinh_id=ct_id)
        item = next((x for x in ton if x["ma_hang"] == "___SELFTEST_SP1"), None)
        assert item is not None, "khong tim thay hang trong ton kho"
        assert item["tong_nhap"] == 100 and item["tong_xuat"] == 30 and item["ton_cuoi"] == 70
        steps[-1] = ("5. tinh ton kho (compute_ton_kho)", f"ok ton_cuoi={item['ton_cuoi']} (dung: 100-30=70)")

        steps.append(("6. ghi chu (CRUD + soft-delete)", "start"))
        gc = fdb.create_ghi_chu(cong_trinh_id=ct_id, tieu_de="Test ghi chu", created_by="selftest")
        fdb.update_ghi_chu(gc["id"], {"noi_dung": "da sua"})
        ok_del = fdb.soft_delete_ghi_chu(gc["id"], deleted_by="selftest")
        assert ok_del
        still_visible = fdb.get_ghi_chu_by_id(gc["id"])
        assert still_visible is None, "soft-delete phai an khoi get_ghi_chu_by_id"
        steps[-1] = ("6. ghi chu (CRUD + soft-delete)", "ok")

        steps.append(("7. ai_config (ensure + update)", "start"))
        cfg = fdb.ensure_ai_config_exists(ct_id)
        fdb.update_ai_config_test_result(ct_id, status="ok")
        steps[-1] = ("7. ai_config (ensure + update)", "ok")

        steps.append(("8. activity_log", "start"))
        fdb.log_activity(action="selftest", entity_type="phieu", entity_id=str(p_nk["id"]), user_email="selftest")
        logs = fdb.get_activity_log(limit=5, action="selftest")
        assert len(logs) >= 1
        steps[-1] = ("8. activity_log", "ok")

        steps.append(("9. cascade delete cong trinh (giong het logic routers/cong_trinh.py)", "start"))
        phieu_list = fdb.get_phieu_list(cong_trinh_id=ct_id, limit=100000)
        phieu_ids = [p["id"] for p in phieu_list]
        for i in range(0, len(phieu_ids), 100):
            chunk = phieu_ids[i:i + 100]
            ids_str = ",".join(str(x) for x in chunk)
            fdb.delete("chi_tiet_phieu", f"phieu_id=in.({ids_str})")
        fdb.delete("phieu", f"cong_trinh_id=eq.{ct_id}")
        fdb.delete("hang_hoa", f"cong_trinh_id=eq.{ct_id}")
        fdb.delete_ai_config(ct_id)
        fdb.delete("cong_trinh", f"id=eq.{ct_id}")
        assert fdb.get_cong_trinh_by_id(ct_id) is None
        assert fdb.get_chi_tiet_phieu(p_nk["id"]) == []
        assert fdb.get_all_hang_hoa(cong_trinh_id=ct_id) == []
        steps[-1] = ("9. cascade delete cong trinh (giong het logic routers/cong_trinh.py)", "ok — khong con mo coi")

        return {"result": "PASS", "steps": steps}
    except Exception as e:
        # Dọn dẹp nếu test fail giữa chừng, tránh rác dữ liệu test
        try:
            if ct_id:
                fdb.delete("chi_tiet_phieu", f"cong_trinh_id=eq.{ct_id}")
                fdb.delete("phieu", f"cong_trinh_id=eq.{ct_id}")
                fdb.delete("hang_hoa", f"cong_trinh_id=eq.{ct_id}")
                fdb.delete_ai_config(ct_id)
                fdb.delete("cong_trinh", f"id=eq.{ct_id}")
        except Exception:
            pass
        return {"result": "FAIL", "steps": steps, "error": f"{type(e).__name__}: {e}"}


# ── Danh sách vai trò của app này (hpcore gọi để hiển thị khi phân quyền) ──
@app.get("/api/roles", tags=["system"])
def get_roles():
    return {
        "roles": [
            {"key": "admin", "label": "Admin"},
            {"key": "user", "label": "Thủ kho"},
        ]
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
