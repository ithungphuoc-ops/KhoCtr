"use client";

/**
 * Port từ frontend/src/api/index.js — giữ NGUYÊN tên hàm + tham số để các trang
 * port từ Vite chỉ cần đổi `import { api } from '../api'` → `import * as api from
 * '@/lib/api-client'`, JSX/logic còn lại hầu như không đổi. Gọi thẳng Route Handler
 * Next.js (cùng path REST cũ) thay vì axios tới backend Python.
 */

interface FetchOpts {
  params?: Record<string, string | number | boolean | undefined>;
}

function toQuery(params?: FetchOpts["params"]): string {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

async function request<T = unknown>(method: string, path: string, opts: FetchOpts & { body?: unknown } = {}): Promise<{ data: T }> {
  const isFormData = typeof FormData !== "undefined" && opts.body instanceof FormData;
  const res = await fetch(`/api${path}${toQuery(opts.params)}`, {
    method,
    headers: opts.body && !isFormData ? { "Content-Type": "application/json" } : undefined,
    body: isFormData ? (opts.body as FormData) : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.detail || json?.error || `Lỗi ${res.status}`) as Error & { response?: { status: number; data: unknown } };
    err.response = { status: res.status, data: json };
    throw err;
  }
  return { data: json as T };
}

/** Đối tượng kiểu axios (api.get/post/put/delete) — 1 số trang gốc gọi thẳng thay vì qua hàm đặt tên. */
export const api = {
  get: <T = unknown>(path: string, opts?: FetchOpts) => request<T>("GET", path, opts),
  post: <T = unknown>(path: string, body?: unknown, opts?: FetchOpts) => request<T>("POST", path, { ...opts, body }),
  put: <T = unknown>(path: string, body?: unknown, opts?: FetchOpts) => request<T>("PUT", path, { ...opts, body }),
  delete: <T = unknown>(path: string, opts?: FetchOpts) => request<T>("DELETE", path, opts),
};

// Cong trinh
export const getCongTrinh = () => request("GET", "/cong-trinh");
export const createCongTrinh = (data: unknown) => request("POST", "/cong-trinh/", { body: data });
export const updateCongTrinh = (id: number, data: unknown) => request("PUT", `/cong-trinh/${id}`, { body: data });
export const deleteCongTrinh = (id: number) => request("DELETE", `/cong-trinh/${id}`);
export const updateCongTrinhStatus = (id: number, trang_thai: string) =>
  request("PUT", `/cong-trinh/${id}/trang-thai`, { body: { trang_thai } });
export const getCongTrinhStats = (id: number) => request("GET", `/cong-trinh/${id}/stats`);

// Phieu
export const getPhieuList = (params?: FetchOpts["params"]) => request("GET", "/phieu/", { params });
export const getChiTietPhieu = (id: number) => request("GET", `/phieu/${id}/chi-tiet`);
export const createPhieu = (data: unknown) => request("POST", "/phieu/", { body: data });
export const deletePhieu = (id: number, userEmail = "") => request("DELETE", `/phieu/${id}`, { params: { user_email: userEmail } });
export const updatePhieu = (id: number, data: unknown) => request("PUT", `/phieu/${id}`, { body: data });
export const getLichSuGiaoDich = (params?: FetchOpts["params"]) => request("GET", "/phieu/lich-su", { params });

// Hang hoa
export const getHangHoa = (params?: FetchOpts["params"]) => request("GET", "/hang-hoa/", { params });
export const createHangHoa = (data: unknown) => request("POST", "/hang-hoa/", { body: data });
export const updateHangHoa = (ma: string, data: unknown) => request("PUT", `/hang-hoa/${ma}`, { body: data });
export const deleteHangHoa = (ma: string) => request("DELETE", `/hang-hoa/${ma}`);

// Ton kho
export const getTonKho = (params?: FetchOpts["params"]) => request("GET", "/ton-kho/", { params });
export const themHangTonKho = (data: unknown) => request("POST", "/ton-kho/them-hang", { body: data });
export const dieuChinhTonKho = (data: unknown) => request("POST", "/ton-kho/dieu-chinh", { body: data });
export const xoaHangTonKho = (params: FetchOpts["params"]) => request("DELETE", "/ton-kho/xoa-hang", { params });
export const getLichSuHang = (params?: FetchOpts["params"]) => request("GET", "/ton-kho/lich-su", { params });

// Bao cao
export const getBaoCaoTongHop = (params?: FetchOpts["params"]) => request("GET", "/bao-cao/tong-hop", { params });
export const getBieuDo = (params?: FetchOpts["params"]) => request("GET", "/bao-cao/bieu-do", { params });
export const getBaoCaoThoTang = (params?: FetchOpts["params"]) => request("GET", "/bao-cao/theo-thang", { params });

// Nhat ky hoat dong
export const getNhatKy = (params?: FetchOpts["params"]) => request("GET", "/nhat-ky/", { params });
export const logActivity = (data: unknown) => request("POST", "/nhat-ky/log", { body: data });

// Ghi chu
export const getGhiChuList = (params?: FetchOpts["params"]) => request("GET", "/ghi-chu/", { params });
export const createGhiChu = (data: unknown) => request("POST", "/ghi-chu/", { body: data });
export const updateGhiChu = (id: number, data: unknown) => request("PUT", `/ghi-chu/${id}`, { body: data });
export const deleteGhiChu = (id: number) => request("DELETE", `/ghi-chu/${id}`);
export const completeGhiChu = (id: number) => request("POST", `/ghi-chu/${id}/complete`);

// Auth / phan quyen
export const getMe = () => request("GET", "/auth/me");
export const getMyCongTrinh = () => request("GET", "/auth/my-congtrinh");
export const getPermissions = () => request("GET", "/auth/permissions");
export const savePermissions = (permissions: unknown[]) => request("POST", "/auth/permissions", { body: { permissions } });
export const getUsers = () => request("GET", "/auth/users");

// AI đọc phiếu
export const docPhieu = (formData: FormData) => request("POST", "/ai/doc-phieu", { body: formData });
export const docPhieuMulti = (formData: FormData) => request("POST", "/ai/doc-phieu-multi", { body: formData });
export const splitPdf = (formData: FormData) => request("POST", "/files/split-pdf", { body: formData });
export const matchItems = (data: unknown) => request("POST", "/ai/match-items", { body: data });
export const confirmMatch = (data: unknown) => request("POST", "/ai/confirm-match", { body: data });

// Cau hinh AI theo cong trinh (ai-config)
export const getAiProviders = () => request("GET", "/ai-config/providers");
export const getAiConfigs = () => request("GET", "/ai-config/");
export const getAiConfig = (ctId: number) => request("GET", `/ai-config/${ctId}`);
export const saveAiConfig = (ctId: number, data: unknown) => request("POST", `/ai-config/${ctId}`, { body: data });
export const testAiConnection = (ctId: number) => request("POST", `/ai-config/${ctId}/test-connection`);
export const disableAiConfig = (ctId: number) => request("POST", `/ai-config/${ctId}/disable`);
export const enableAiConfig = (ctId: number) => request("POST", `/ai-config/${ctId}/enable`);
export const deleteAiConfig = (ctId: number) => request("DELETE", `/ai-config/${ctId}`);

// Import Excel hàng loạt (sheet QLTK)
export const previewImport = (formData: FormData) => request("POST", "/import/preview", { body: formData });
export const executeImport = (formData: FormData) => request("POST", "/import/execute", { body: formData });

// Nha cung cap — chưa có bảng riêng ở bản gốc (trang tĩnh), giữ chỗ cho GĐ2 sau.
