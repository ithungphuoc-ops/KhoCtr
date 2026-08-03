"use client";

// Port từ frontend/src/pages/ct/CTXuatKho.jsx (gồm cả phần "AI đọc PDF hàng loạt" —
// nay đã port đầy đủ, xem app/ct/[id]/nhap-kho/page.tsx cho bản NK tương ứng).
import { useState, useEffect, useRef } from "react";
import { Search, RefreshCw, Eye, Plus, X, Trash2, FileDown, Bot, Loader } from "lucide-react";
import { getPhieuList, getChiTietPhieu, createPhieu, getHangHoa, getTonKho, docPhieu, docPhieuMulti, matchItems } from "@/lib/api-client";
import HangHoaInput from "@/components/HangHoaInput";
import HangHoaItemCards from "@/components/HangHoaItemCards";
import { BatchPhieuPopup, type BatchPhieuInput, type SavedBatchPhieu, type MatchResult } from "@/components/BatchPhieuPopup";
import { exportPhieuList } from "@/lib/export-excel";
import { useAuth } from "@/components/SessionProvider";
import { useCT } from "@/components/ct/CTProvider";
import { CardList, CardListItem, CardListRow } from "@/components/ui/CardListItem";
import type { Phieu, ChiTietPhieu } from "@/lib/data/phieu";
import type { HangHoa } from "@/lib/data/hang-hoa";
import type { TonKhoRow } from "@/lib/data/ton-kho";
import type { PhieuData } from "@/lib/ai/reader";

const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString("vi-VN");
function formatVND(n: number | undefined | null) {
  const num = n ?? 0;
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + " tỷ";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(0) + " tr";
  return num.toLocaleString("vi-VN");
}
const today = () => new Date().toISOString().slice(0, 10);

const normalize = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

interface ItemRow {
  ma_hang?: string;
  ten_hang: string;
  dvt: string;
  so_luong: string;
  don_gia: string;
  thanh_tien: string | number;
  selected: boolean;
}
const emptyItem = (): ItemRow => ({ ma_hang: "", ten_hang: "", dvt: "cái", so_luong: "", don_gia: "", thanh_tien: "", selected: false });

function errDetail(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { detail?: string } } };
  return e.response?.data?.detail || fallback;
}

export default function CTXuatKhoPage() {
  const { ctId } = useCT();
  const { user } = useAuth();

  const [phieuList, setPhieuList] = useState<Phieu[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPhieu, setSelectedPhieu] = useState<Phieu | null>(null);
  const [chiTiet, setChiTiet] = useState<ChiTietPhieu[]>([]);
  const [loadingCT, setLoadingCT] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ so_phieu: "", ngay: today(), doi_tac: "", ghi_chu: "" });
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [hangHoaList, setHangHoaList] = useState<HangHoa[]>([]);

  const loadData = () => {
    setLoading(true);
    getPhieuList({ loai: "XK", cong_trinh_id: ctId, limit: 500 })
      .then((res) => setPhieuList((res.data as { data?: Phieu[] })?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadHangHoa = () =>
    getTonKho({ cong_trinh_id: parseInt(ctId) })
      .then((res) => {
        const rows = ((res.data as { data?: TonKhoRow[] })?.data || [])
          .filter((tk) => (tk.ton_cuoi ?? 0) > 0)
          .map((tk) => ({ ten_hang: tk.ten_hang, dvt: tk.dvt || "cái", ma_hang: "" }) as HangHoa);
        setHangHoaList(rows);
      })
      .catch(() =>
        getHangHoa({ limit: 2000, cong_trinh_id: parseInt(ctId) })
          .then((res) => setHangHoaList((res.data as { data?: HangHoa[] })?.data || []))
          .catch(() => {}),
      );

  // AI đọc PDF hàng loạt
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProvider, setAiProvider] = useState("gemini");
  const [aiProgress, setAiProgress] = useState("");
  const [batchPhieus, setBatchPhieus] = useState<BatchPhieuInput[]>([]);
  const [showBatchPopup, setShowBatchPopup] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const [batchMsg, setBatchMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const aiFileRef = useRef<HTMLInputElement>(null);

  const handleAiReadBatch = async (files: FileList | null) => {
    if (!files?.length) return;
    setAiLoading(true);
    setAiProgress("");
    const collected: BatchPhieuInput[] = [];
    const t0 = Date.now();
    try {
      let fileCount = 0;
      for (const file of Array.from(files)) {
        fileCount++;
        setAiProgress(`Đang đọc file ${fileCount}/${files.length}: ${file.name}`);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("loai", "XK");
        fd.append("provider", aiProvider);
        if (ctId) fd.append("cong_trinh_id", ctId);

        const isPdf = file.name.toLowerCase().endsWith(".pdf");
        let phieuList: PhieuData[] = [];
        if (isPdf) {
          const res = await docPhieuMulti(fd);
          phieuList = ((res.data as { phieu_list?: PhieuData[] })?.phieu_list) || [];
          if (phieuList.length === 0) phieuList = [(res.data as PhieuData) || ({} as PhieuData)];
        } else {
          const res = await docPhieu(fd);
          phieuList = [(res.data as PhieuData) || ({} as PhieuData)];
        }

        let phieuCount = 0;
        for (const data of phieuList) {
          phieuCount++;
          if (phieuList.length > 1) setAiProgress(`File ${fileCount}/${files.length} — phiếu ${phieuCount}/${phieuList.length}`);
          const rawItems = (data.items || []).map((it) => ({
            ten_hang: it.ten_hang || "",
            dvt: it.dvt || "cái",
            so_luong: it.so_luong || 0,
            don_gia: it.don_gia || 0,
            thanh_tien: (it.so_luong || 0) * (it.don_gia || 0),
          }));
          const processingMs = Date.now() - t0;
          const matchRes = await matchItems({
            cong_trinh_id: parseInt(ctId),
            loai_phieu: "xuat",
            file_name: file.name,
            items: rawItems,
            ai_provider: aiProvider,
            processing_time_ms: processingMs,
          });
          collected.push({
            header: {
              so_phieu: data.so_phieu || "",
              ngay: data.ngay || today(),
              doi_tac: data.doi_tac || "",
              ghi_chu: data.ghi_chu || "",
            },
            matchResult: matchRes.data as MatchResult,
          });
        }
      }
      setBatchPhieus(collected);
      setShowBatchPopup(true);
      if (hangHoaList.length === 0) loadHangHoa();
    } catch (e) {
      alert(errDetail(e, "Lỗi AI đọc phiếu. Vui lòng thử lại."));
    } finally {
      setAiLoading(false);
      setAiProgress("");
      if (aiFileRef.current) aiFileRef.current.value = "";
    }
  };

  const handleSaveBatch = async (localPhieus: SavedBatchPhieu[]) => {
    setSavingBatch(true);
    setBatchMsg(null);
    let savedCount = 0;
    const errors: string[] = [];
    for (const p of localPhieus) {
      if (!p.header.so_phieu || !p.header.ngay) {
        errors.push(`Thiếu số phiếu: ${p.header.so_phieu || "(trống)"}`);
        continue;
      }
      const validItems = p.items.filter((it) => it.ten_hang && it.so_luong > 0);
      if (validItems.length === 0) {
        errors.push(`Phiếu ${p.header.so_phieu}: không có dòng hợp lệ`);
        continue;
      }
      try {
        await createPhieu({
          cong_trinh_id: parseInt(ctId),
          loai: "XK",
          so_phieu: p.header.so_phieu,
          ngay: p.header.ngay,
          doi_tac: p.header.doi_tac,
          ghi_chu: p.header.ghi_chu,
          tong_tien: validItems.reduce((s, it) => s + (it.thanh_tien || 0), 0),
          user_email: user?.email || "",
          items: validItems.map((it) => ({ ten_hang: it.ten_hang, dvt: it.dvt || "cái", so_luong: it.so_luong, don_gia: it.don_gia, thanh_tien: it.thanh_tien })),
        });
        savedCount++;
      } catch (e) {
        errors.push(`${p.header.so_phieu}: ${errDetail(e, "Lỗi không xác định")}`);
      }
    }
    setSavingBatch(false);
    if (errors.length > 0) {
      setBatchMsg({ type: "err", text: `Lưu ${savedCount}/${localPhieus.length} phiếu. Lỗi: ${errors.join(" | ")}` });
    } else {
      setShowBatchPopup(false);
      setBatchPhieus([]);
      setSaveMsg({ type: "ok", text: `Đã lưu ${savedCount} phiếu xuất kho!` });
      loadData();
    }
  };

  useEffect(() => {
    loadData();
    loadHangHoa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctId]);

  const openChiTiet = (phieu: Phieu) => {
    setSelectedPhieu(phieu);
    setLoadingCT(true);
    getChiTietPhieu(phieu.id)
      .then((res) => setChiTiet((res.data as { items?: ChiTietPhieu[] })?.items || []))
      .catch(() => setChiTiet([]))
      .finally(() => setLoadingCT(false));
  };

  const filtered = phieuList.filter((p) => !search || (p.so_phieu || "").toLowerCase().includes(search.toLowerCase()) || (p.doi_tac || "").toLowerCase().includes(search.toLowerCase()));

  const updateItem = (i: number, field: keyof ItemRow, val: string) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: val };
    if (field === "ten_hang") next[i].selected = false;
    if (field === "so_luong" || field === "don_gia") {
      const sl = field === "so_luong" ? parseFloat(val) : parseFloat(next[i].so_luong);
      const dg = field === "don_gia" ? parseFloat(val) : parseFloat(next[i].don_gia);
      next[i].thanh_tien = !isNaN(sl) && !isNaN(dg) ? sl * dg : "";
    }
    setItems(next);
  };

  const tongTien = items.reduce((s, it) => s + (parseFloat(String(it.thanh_tien)) || 0), 0);

  const handleSave = async () => {
    if (!form.so_phieu || !form.ngay) {
      setSaveMsg({ type: "err", text: "Vui lòng nhập số phiếu và ngày" });
      return;
    }
    const validItems = items.filter((it) => it.ten_hang && parseFloat(it.so_luong) > 0);
    if (validItems.length === 0) {
      setSaveMsg({ type: "err", text: "Cần ít nhất 1 dòng hàng hợp lệ" });
      return;
    }
    if (hangHoaList.length > 0) {
      const invalid = validItems.find((it) => !hangHoaList.some((h) => normalize(h.ten_hang) === normalize(it.ten_hang)));
      if (invalid) {
        setSaveMsg({ type: "err", text: `"${invalid.ten_hang}" không có trong kho. Vui lòng chọn từ danh sách gợi ý.` });
        return;
      }
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      await createPhieu({
        cong_trinh_id: parseInt(ctId),
        loai: "XK",
        so_phieu: form.so_phieu,
        ngay: form.ngay,
        doi_tac: form.doi_tac,
        ghi_chu: form.ghi_chu,
        tong_tien: tongTien,
        user_email: user?.email || "",
        items: validItems.map((it) => ({ ten_hang: it.ten_hang, dvt: it.dvt || "cái", so_luong: parseFloat(it.so_luong) || 0, don_gia: parseFloat(it.don_gia) || 0, thanh_tien: parseFloat(String(it.thanh_tien)) || 0 })),
      });
      setSaveMsg({ type: "ok", text: "Lưu phiếu xuất thành công!" });
      setForm({ so_phieu: "", ngay: today(), doi_tac: "", ghi_chu: "" });
      setItems([emptyItem()]);
      setShowForm(false);
      loadData();
    } catch (e) {
      setSaveMsg({ type: "err", text: errDetail(e, "Lỗi khi lưu phiếu") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-hp-text">PHIẾU XUẤT KHO</h1>
          <p className="text-hp-text-secondary mt-1 text-sm">{phieuList.length} phiếu xuất</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} disabled={loading} className="flex items-center gap-2 px-3 min-h-10 bg-hp-surface hover:bg-hp-elevated text-hp-text-secondary rounded-hp-lg text-sm disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={async () => {
              setExporting(true);
              try {
                await exportPhieuList({ phieuList: filtered, loai: "XK" });
              } catch (e) {
                alert((e as Error).message);
              } finally {
                setExporting(false);
              }
            }}
            disabled={exporting || filtered.length === 0}
            className="flex items-center gap-2 px-3 min-h-10 bg-hp-primary/15 hover:bg-hp-primary/25 text-hp-primary rounded-hp-lg text-sm disabled:opacity-50"
          >
            <FileDown className={`w-4 h-4 ${exporting ? "animate-bounce" : ""}`} />
            {exporting ? "..." : "Excel"}
          </button>
          <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)} className="px-2 py-2 border border-hp-border rounded-hp-lg text-xs text-hp-text-secondary bg-hp-card focus:outline-none">
            <option value="gemini">🆓 Gemini</option>
            <option value="openai">🤖 ChatGPT</option>
            <option value="claude">⚡ Claude</option>
          </select>
          <button
            onClick={() => aiFileRef.current?.click()}
            disabled={aiLoading}
            className="flex items-center gap-2 px-4 min-h-10 bg-hp-accent hover:bg-hp-accent/90 text-white rounded-hp-lg text-sm font-medium disabled:opacity-50"
          >
            {aiLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" /> {aiProgress || "AI đang đọc..."}
              </>
            ) : (
              <>
                <Bot className="w-4 h-4" /> AI đọc PDF
              </>
            )}
          </button>
          <input ref={aiFileRef} type="file" multiple accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={(e) => handleAiReadBatch(e.target.files)} />
          <button
            onClick={() => {
              if (hangHoaList.length === 0) loadHangHoa();
              setShowForm(true);
              setSaveMsg(null);
            }}
            className="flex items-center gap-2 px-4 min-h-10 bg-hp-warning hover:bg-hp-warning/90 text-white rounded-hp-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Tạo phiếu XK
          </button>
        </div>
      </div>

      {saveMsg && !showForm && <div className={`p-3 rounded-hp-xl text-sm font-medium ${saveMsg.type === "ok" ? "bg-hp-success/15 text-hp-success" : "bg-hp-danger/15 text-hp-danger"}`}>{saveMsg.text}</div>}

      <div className="bg-hp-card rounded-hp-xl border border-hp-border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hp-text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm số phiếu, người nhận..." className="w-full pl-9 pr-4 py-2 border border-hp-border rounded-hp-lg text-sm bg-hp-card text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
        </div>
      </div>

      <div className="hidden md:block bg-hp-card rounded-hp-xl border border-hp-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-hp-surface border-b border-hp-border">
            <tr>
              <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">#</th>
              <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Số phiếu</th>
              <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Ngày</th>
              <th className="text-left px-4 py-3 text-hp-text-secondary font-medium">Người nhận</th>
              <th className="text-right px-4 py-3 text-hp-text-secondary font-medium">Tổng tiền</th>
              <th className="text-center px-4 py-3 text-hp-text-secondary font-medium">CT</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-hp-text-muted">
                  Đang tải...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-hp-text-muted">
                  Chưa có phiếu xuất kho
                </td>
              </tr>
            ) : (
              filtered.map((p, i) => (
                <tr key={p.id} className="border-b border-hp-border hover:bg-hp-elevated">
                  <td className="px-4 py-3 text-hp-text-muted text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-hp-warning">{p.so_phieu}</td>
                  <td className="px-4 py-3 text-hp-text-secondary text-xs">{p.ngay}</td>
                  <td className="px-4 py-3 text-hp-text-secondary text-xs truncate max-w-[120px]">{p.doi_tac || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-hp-warning">{formatVND(p.tong_tien)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => openChiTiet(p)} className="p-1.5 hover:bg-hp-warning/10 text-hp-text-muted hover:text-hp-warning rounded-hp-lg">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {!loading && filtered.length > 0 && (
            <tfoot className="bg-hp-warning/10 border-t-2 border-hp-border">
              <tr>
                <td colSpan={4} className="px-4 py-2 font-bold text-hp-text text-sm">
                  Tổng ({filtered.length} phiếu)
                </td>
                <td className="px-4 py-2 text-right font-bold text-hp-warning">{formatVND(filtered.reduce((s, p) => s + (p.tong_tien || 0), 0))}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="md:hidden">
        <CardList loading={loading} empty={filtered.length === 0} emptyMessage="Chưa có phiếu xuất kho">
          {filtered.map((p) => (
            <CardListItem key={p.id} onClick={() => openChiTiet(p)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-hp-warning font-mono font-semibold">{p.so_phieu}</div>
                  <div className="text-hp-text-secondary text-xs">{p.ngay}</div>
                </div>
                <div className="text-hp-warning font-semibold flex-shrink-0">{formatVND(p.tong_tien)}</div>
              </div>
              <CardListRow label="Người nhận" value={p.doi_tac || "—"} />
            </CardListItem>
          ))}
        </CardList>
        {!loading && filtered.length > 0 && (
          <div className="mt-3 bg-hp-warning/10 border border-hp-border rounded-hp-xl px-4 py-3 flex justify-between items-center text-sm">
            <span className="font-bold text-hp-text">Tổng ({filtered.length} phiếu)</span>
            <span className="font-bold text-hp-warning">{formatVND(filtered.reduce((s, p) => s + (p.tong_tien || 0), 0))}</span>
          </div>
        )}
      </div>

      {selectedPhieu && (
        <div
          className="fixed inset-0 bg-hp-overlay flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPhieu(null);
          }}
        >
          <div className="bg-hp-elevated rounded-hp-xl shadow-md w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-hp-border">
              <div>
                <h3 className="font-bold text-hp-warning">{selectedPhieu.so_phieu}</h3>
                <p className="text-xs text-hp-text-secondary">
                  {selectedPhieu.ngay}
                  {selectedPhieu.doi_tac ? ` · ${selectedPhieu.doi_tac}` : ""}
                </p>
              </div>
              <button onClick={() => setSelectedPhieu(null)} className="p-1 hover:bg-hp-elevated rounded-hp-lg">
                <X className="w-5 h-5 text-hp-text-muted" />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-5">
              {loadingCT ? (
                <div className="text-center py-8 text-hp-text-muted">Đang tải...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-hp-surface">
                    <tr>
                      <th className="text-left p-2 text-hp-text-secondary">#</th>
                      <th className="text-left p-2 text-hp-text-secondary">Tên hàng</th>
                      <th className="text-right p-2 text-hp-text-secondary">SL</th>
                      <th className="text-left p-2 text-hp-text-secondary">ĐVT</th>
                      <th className="text-right p-2 text-hp-text-secondary">Đơn giá</th>
                      <th className="text-right p-2 text-hp-text-secondary">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chiTiet.map((it, i) => (
                      <tr key={i} className="border-b border-hp-border">
                        <td className="p-2 text-hp-text-muted">{i + 1}</td>
                        <td className="p-2 text-hp-text">{it.ten_hang}</td>
                        <td className="p-2 text-right">{fmt(it.so_luong)}</td>
                        <td className="p-2 text-hp-text-secondary text-xs">{it.dvt}</td>
                        <td className="p-2 text-right text-hp-text-secondary">{formatVND(it.don_gia)}</td>
                        <td className="p-2 text-right font-medium">{formatVND(it.thanh_tien)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-4 border-t border-hp-border bg-hp-surface flex justify-between text-sm">
              <span className="text-hp-text-secondary">{chiTiet.length} dòng</span>
              <span className="font-bold text-hp-warning">Tổng: {formatVND(selectedPhieu.tong_tien)}</span>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-hp-overlay flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-hp-elevated rounded-hp-xl shadow-md w-full max-w-4xl my-4">
            <div className="flex items-center justify-between p-5 border-b border-hp-border bg-hp-surface rounded-t-xl">
              <div>
                <h3 className="font-bold text-hp-text text-lg">Tạo phiếu xuất kho mới</h3>
                <p className="text-xs text-hp-text-secondary mt-0.5">{hangHoaList.length > 0 ? `${hangHoaList.length} mặt hàng đang có trong kho` : "Chưa có hàng trong kho"}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-hp-card rounded-hp-lg">
                <X className="w-5 h-5 text-hp-text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-hp-text-secondary font-medium">Số phiếu *</label>
                  <input value={form.so_phieu} onChange={(e) => setForm({ ...form, so_phieu: e.target.value })} placeholder="VD: XK-001" className="mt-1 w-full border border-hp-border rounded-hp-lg px-3 py-2 text-sm bg-hp-card text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                </div>
                <div>
                  <label className="text-xs text-hp-text-secondary font-medium">Ngày *</label>
                  <input type="date" value={form.ngay} onChange={(e) => setForm({ ...form, ngay: e.target.value })} className="mt-1 w-full border border-hp-border rounded-hp-lg px-3 py-2 text-sm bg-hp-card text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                </div>
                <div>
                  <label className="text-xs text-hp-text-secondary font-medium">Người nhận / Đối tác</label>
                  <input value={form.doi_tac} onChange={(e) => setForm({ ...form, doi_tac: e.target.value })} placeholder="Tên người nhận" className="mt-1 w-full border border-hp-border rounded-hp-lg px-3 py-2 text-sm bg-hp-card text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                </div>
                <div>
                  <label className="text-xs text-hp-text-secondary font-medium">Ghi chú</label>
                  <input value={form.ghi_chu} onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })} className="mt-1 w-full border border-hp-border rounded-hp-lg px-3 py-2 text-sm bg-hp-card text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                </div>
              </div>

              <div className="border border-hp-border rounded-hp-xl overflow-hidden">
                <div className="hidden md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-hp-surface">
                      <tr>
                        <th className="text-left px-3 py-2 text-hp-text-secondary font-medium w-8">#</th>
                        <th className="text-left px-3 py-2 text-hp-text-secondary font-medium">Tên hàng hóa</th>
                        <th className="text-left px-3 py-2 text-hp-text-secondary font-medium w-20">ĐVT</th>
                        <th className="text-right px-3 py-2 text-hp-text-secondary font-medium w-24">Số lượng</th>
                        <th className="text-right px-3 py-2 text-hp-text-secondary font-medium w-28">Đơn giá</th>
                        <th className="text-right px-3 py-2 text-hp-text-secondary font-medium w-28">Thành tiền</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => (
                        <tr key={i} className="border-t border-hp-border hover:bg-hp-elevated">
                          <td className="px-3 py-1.5 text-hp-text-muted text-xs">{i + 1}</td>
                          <td className="px-3 py-1.5">
                            <HangHoaInput
                              value={it.ten_hang}
                              onChange={(val) => updateItem(i, "ten_hang", val)}
                              onSelect={(hh) => {
                                const next = [...items];
                                next[i] = { ...next[i], ma_hang: hh.ma_hang || "", ten_hang: hh.ten_hang, dvt: hh.dvt || "cái", selected: true };
                                setItems(next);
                              }}
                              hangHoaList={hangHoaList}
                              theme="orange"
                              placeholder="Tên hàng..."
                              isAdmin={user?.role === "admin"}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              value={it.dvt}
                              onChange={(e) => updateItem(i, "dvt", e.target.value)}
                              readOnly={!!it.selected}
                              className={`w-full border border-hp-border rounded px-2 py-1 text-xs bg-hp-card text-hp-text focus:outline-none ${it.selected ? "bg-hp-surface text-hp-text-secondary cursor-default" : "focus:ring-2 focus:ring-hp-accent"}`}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="number" value={it.so_luong} onChange={(e) => updateItem(i, "so_luong", e.target.value)} placeholder="0" className="w-full border border-hp-border rounded px-2 py-1 text-xs text-right bg-hp-card text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="number" value={it.don_gia} onChange={(e) => updateItem(i, "don_gia", e.target.value)} placeholder="0" className="w-full border border-hp-border rounded px-2 py-1 text-xs text-right bg-hp-card text-hp-text focus:outline-none focus:ring-2 focus:ring-hp-accent" />
                          </td>
                          <td className="px-3 py-1.5 text-right text-xs font-medium text-hp-text">{it.thanh_tien ? formatVND(parseFloat(String(it.thanh_tien))) : "—"}</td>
                          <td className="px-2">
                            <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} disabled={items.length === 1} className="p-1 hover:bg-hp-danger/10 text-hp-text-disabled hover:text-hp-danger rounded disabled:opacity-30">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden p-2">
                  <HangHoaItemCards
                    items={items}
                    hangHoaList={hangHoaList}
                    isAdmin={user?.role === "admin"}
                    theme="orange"
                    totalTextClass="text-hp-warning"
                    formatVND={(n) => formatVND(typeof n === "string" ? parseFloat(n) || 0 : n)}
                    onFieldChange={(i, field, val) => updateItem(i, field, val)}
                    onSelectHangHoa={(i, hh) => {
                      const next = [...items];
                      next[i] = { ...next[i], ma_hang: hh.ma_hang || "", ten_hang: hh.ten_hang, dvt: hh.dvt || "cái", selected: true };
                      setItems(next);
                    }}
                    onRemove={(i) => setItems(items.filter((_, idx) => idx !== i))}
                  />
                </div>
                <div className="px-3 py-2 border-t border-hp-border flex justify-between items-center bg-hp-surface">
                  <button onClick={() => setItems([...items, emptyItem()])} className="text-xs text-hp-accent hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Thêm dòng
                  </button>
                  <span className="text-sm font-bold text-hp-text">Tổng: {formatVND(tongTien)}</span>
                </div>
              </div>

              {saveMsg && <div className={`p-3 rounded-hp-xl text-sm ${saveMsg.type === "ok" ? "bg-hp-success/15 text-hp-success" : "bg-hp-danger/15 text-hp-danger"}`}>{saveMsg.text}</div>}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="px-5 min-h-10 border border-hp-border rounded-hp-lg text-sm text-hp-text-secondary hover:bg-hp-elevated">
                  Hủy
                </button>
                <button onClick={handleSave} disabled={saving} className="px-6 min-h-10 bg-hp-warning hover:bg-hp-warning/90 text-white rounded-hp-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Đang lưu...
                    </>
                  ) : (
                    "Lưu phiếu XK"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BatchPhieuPopup
        isOpen={showBatchPopup}
        onClose={() => {
          setShowBatchPopup(false);
          setBatchMsg(null);
        }}
        phieus={batchPhieus}
        saving={savingBatch}
        onSaveAll={handleSaveBatch}
      />
      {batchMsg && (
        <div className={`fixed bottom-4 right-4 z-50 max-w-md p-4 rounded-hp-lg shadow-md text-sm font-medium ${batchMsg.type === "ok" ? "bg-hp-success text-white" : "bg-hp-danger text-white"}`}>
          {batchMsg.text}
          <button onClick={() => setBatchMsg(null)} className="ml-3 underline text-white/80">
            Đóng
          </button>
        </div>
      )}
    </div>
  );
}
