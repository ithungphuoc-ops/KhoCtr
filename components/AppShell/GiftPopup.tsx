"use client";

// Popup "Quà của tôi" — khung điện thoại nhúng iframe, port từ bản gốc/chuẩn
// hpcons-portal/components/layout/GiftPopup.tsx (xem thêm bản phỏng theo ở
// HPCons-Receivable/components/GiftPopup.tsx). Giữ nguyên cấu trúc/logic gốc:
// - Khung điện thoại (bezel/tai thỏ) chỉ hiện ở màn hình lớn (≥1280px, breakpoint
//   xl — chuẩn desktop của hệ sinh thái); dưới ngưỡng đó (điện thoại/tablet thật)
//   phóng to hết màn hình, ẩn khung giả vì dư thừa.
// - Thanh điều hướng đáy 5 mục icon-trên-chữ-dưới (kiểu Shopee): Trang chủ, Làm
//   mới, Mở tab (nổi bật — thoát hẳn ra ngoài), Thông báo, Tôi — tất cả có chức
//   năng thật. Chỉ đóng bằng nút ✕ hoặc điều hướng có chủ đích, không đóng khi
//   bấm ra nền tối (tránh tắt nhầm khi đang thao tác trong popup).
// - Khung điện thoại + thanh chrome dùng màu trắng/xám trung tính (bg-white,
//   text-gray-500…) giống hệt bản gốc — đây là hình ảnh "màn hình điện thoại"
//   độc lập với theme dark/light của app KhoCtr, không đổi theo --color-* của
//   app. Chỉ màu "nổi bật" (nút Mở tab) đổi sang token brand thật của Khoctr
//   (--color-hp-primary, xem app/globals.css) thay vì hp-primary riêng của
//   hpcons-portal hay brand-500 của Receivable.
// - "Thông báo" trỏ vào /canh-bao (Cảnh báo tồn kho) — route thật đã có sẵn
//   trong app này (xem Header.tsx handleBellClick), không phải trang trí suông.
// - "Tôi" trỏ ra App Tổng (account.hpcore.vn/profile) — Khoctr chưa có trang hồ
//   sơ cá nhân nội bộ (xem HPCORE_PROFILE_URL dùng ở AppLauncher.tsx).
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, RotateCw, ExternalLink, Home, Bell, User, type LucideIcon } from "lucide-react";

const NHIEM_VU_URL = "https://quacuatoi.hpcore.vn/nhiem-vu";
const HO_SO_URL = "https://account.hpcore.vn/profile";

function MucDieuHuong({
  icon: Icon,
  label,
  title,
  onClick,
  noiBat,
}: {
  icon: LucideIcon;
  label: string;
  title?: string;
  onClick: () => void;
  noiBat?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors active:scale-95 ${
        noiBat ? "text-hp-primary" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );
}

export default function GiftPopup({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Focus vào khung dialog (không phải 1 nút ✕ cụ thể) — vì có 2 nút đóng khác
  // nhau tuỳ breakpoint (khung điện thoại desktop / thanh trên cùng di động),
  // nút bị ẩn bằng `hidden` không nhận được focus.
  const dialogRef = useRef<HTMLDivElement>(null);

  const veTrangChu = () => {
    onClose();
    router.push("/");
  };

  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      // CHỈ nút ✕ (hoặc các nút điều hướng có chủ đích như "Trang chủ") mới đóng
      // được popup — không đóng khi bấm ra vùng nền tối, tránh tắt nhầm lúc đang
      // thao tác trong popup.
      className="fixed inset-0 z-[60] flex items-center justify-center xl:p-4"
      style={{ background: "rgba(10, 14, 22, 0.6)", backdropFilter: "blur(3px)" }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quà của tôi"
        tabIndex={-1}
        className="relative shadow-2xl w-full h-full rounded-none p-0 outline-none xl:rounded-[3rem] xl:p-3.5 xl:w-[380px] xl:h-[min(800px,88vh)]"
        style={{ background: "linear-gradient(155deg, #2a3040, #12151c)" }}
      >
        {/* Nút đóng nổi ngoài khung — chỉ hợp lý khi có khung (desktop) */}
        <button
          onClick={onClose}
          aria-label="Đóng"
          className="hidden xl:flex absolute -top-3.5 -right-3.5 w-10 h-10 rounded-full bg-white text-gray-700 border border-gray-200 shadow-lg items-center justify-center hover:scale-105 transition-transform"
        >
          <X size={18} />
        </button>

        <div className="relative w-full h-full bg-white overflow-hidden flex flex-col rounded-none xl:rounded-[2.25rem]">
          {/* Thanh trên cùng — chỉ hiện ở chế độ toàn màn hình (điện thoại/tablet
              thật): thay cho tai thỏ trang trí, có tên popup + nút đóng thật sự
              dùng được. */}
          <div className="flex xl:hidden shrink-0 items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-white">
            <span className="text-sm font-bold text-gray-800">🎁 Quà của tôi</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tai thỏ — chỉ hiện ở khung điện thoại giả (desktop), nằm trong dải
              riêng phía trên, không đè lên iframe */}
          <div className="relative h-11 shrink-0 bg-white hidden xl:block">
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[118px] h-[26px] rounded-full bg-[#12151c] flex items-center justify-end pr-2.5">
              <span className="w-2 h-2 rounded-full bg-[#2a3040]" />
            </div>
          </div>

          <iframe
            ref={iframeRef}
            src={NHIEM_VU_URL}
            title="Quà của tôi — nhiệm vụ đổi điểm"
            className="flex-1 w-full border-0"
            loading="lazy"
            // Giới hạn tối thiểu quyền của iframe (CodeRabbit khuyến nghị 25/08/2026, PR #5
            // base-request-app): allow-same-origin để đọc được cookie phiên .hpcore.vn (bắt
            // buộc, không thì mất đăng nhập SSO), allow-scripts để chạy app React, allow-popups
            // (+ allow-popups-to-escape-sandbox) vì bấm nhiệm vụ mở tab mới, allow-forms cho màn
            // đăng nhập lúc chưa có phiên. CỐ Ý bỏ allow-top-navigation — không cho iframe điều
            // hướng cả trang cha.
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          />

          {/* Thanh điều hướng đáy — 5 mục icon-trên-chữ-dưới, dàn đều, CÓ CHỨC
              NĂNG THẬT (không trang trí suông), dùng chung cho cả khung điện
              thoại giả (desktop) lẫn toàn màn hình (di động). "Mở tab" tô màu
              primary vì là hành động "thoát hẳn ra ngoài" — nổi bật hơn 4 mục
              còn lại. */}
          <div className="grid grid-cols-5 shrink-0 border-t border-gray-100 bg-white">
            <MucDieuHuong icon={Home} label="Trang chủ" onClick={veTrangChu} />
            <MucDieuHuong
              icon={RotateCw}
              label="Làm mới"
              onClick={() => {
                if (iframeRef.current) iframeRef.current.src = NHIEM_VU_URL;
              }}
            />
            <MucDieuHuong
              icon={ExternalLink}
              label="Mở tab"
              title="Mở tab đầy đủ"
              noiBat
              onClick={() => window.open(NHIEM_VU_URL, "_blank", "noopener,noreferrer")}
            />
            <MucDieuHuong
              icon={Bell}
              label="Thông báo"
              onClick={() => {
                onClose();
                router.push("/canh-bao");
              }}
            />
            <MucDieuHuong
              icon={User}
              label="Tôi"
              title="Tài khoản App Tổng"
              onClick={() => {
                onClose();
                window.location.href = HO_SO_URL;
              }}
            />
          </div>

          {/* Home indicator — trang trí, chỉ có ý nghĩa ở khung điện thoại giả
              (desktop) */}
          <div className="relative h-5 shrink-0 bg-white hidden xl:block">
            <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[120px] h-1 rounded-full bg-gray-900/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
