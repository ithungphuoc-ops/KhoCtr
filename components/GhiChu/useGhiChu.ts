"use client";

/**
 * Port từ frontend/src/components/GhiChu/useGhiChu.js — hook quản lý state + API
 * cho Module Ghi chú. Dùng chung cho App Tổng (không có ctId) và App Công trình
 * (có ctId cụ thể). Khác bản gốc: gọi qua các hàm đặt tên trong lib/api-client.ts
 * (getGhiChuList/createGhiChu/...) thay vì api.get('/api/ghi-chu/...') — bản gốc
 * gọi path có tiền tố "/api/" lặp lại (baseURL đã là "/api"), có vẻ là lỗi tiềm ẩn
 * chưa bị phát hiện; sửa lại cho đúng khi port sang Next.js.
 */
import { useState, useEffect, useCallback } from "react";
import { getGhiChuList, createGhiChu, updateGhiChu, deleteGhiChu, completeGhiChu } from "@/lib/api-client";
import type { GhiChu } from "@/lib/data/ghi-chu";

export interface GhiChuFilters {
  trang_thai: string;
  uu_tien: string;
  search: string;
  deadline_from: string;
  deadline_to: string;
}

const EMPTY_FILTERS: GhiChuFilters = { trang_thai: "", uu_tien: "", search: "", deadline_from: "", deadline_to: "" };

function errDetail(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { detail?: string } } };
  return e.response?.data?.detail || fallback;
}

export function useGhiChu({ congTrinhId = null as number | null } = {}) {
  const [items, setItems] = useState<GhiChu[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<GhiChuFilters>(EMPTY_FILTERS);

  const buildParams = useCallback((): Record<string, string | number> => {
    const p: Record<string, string | number> = {};
    if (congTrinhId) p.cong_trinh_id = congTrinhId;
    if (filters.trang_thai) p.trang_thai = filters.trang_thai;
    if (filters.uu_tien) p.uu_tien = filters.uu_tien;
    if (filters.search) p.search = filters.search;
    if (filters.deadline_from) p.deadline_from = filters.deadline_from;
    if (filters.deadline_to) p.deadline_to = filters.deadline_to;
    p.limit = 200;
    return p;
  }, [congTrinhId, filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getGhiChuList(buildParams());
      setItems((res.data as { data?: GhiChu[] })?.data || []);
    } catch (e) {
      setError(errDetail(e, "Không tải được ghi chú."));
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    load();
  }, [load]);

  const createItem = async (payload: Record<string, unknown>) => {
    const res = await createGhiChu({ ...payload, cong_trinh_id: congTrinhId || payload.cong_trinh_id });
    await load();
    return (res.data as { data?: GhiChu })?.data;
  };

  const updateItem = async (id: number, payload: Record<string, unknown>) => {
    await updateGhiChu(id, payload);
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...payload } : x)));
    await load();
  };

  const deleteItem = async (id: number) => {
    await deleteGhiChu(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const completeItem = async (id: number) => {
    const res = await completeGhiChu(id);
    const updated = (res.data as { data?: GhiChu })?.data;
    setItems((prev) => prev.map((x) => (x.id === id ? updated || x : x)));
    return updated;
  };

  return { items, loading, error, filters, setFilters, load, createItem, updateItem, deleteItem, completeItem };
}
