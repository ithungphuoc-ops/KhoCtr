import React, { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { CongTrinhProvider } from './context/CongTrinhContext'
import { AuthProvider, useAuth } from './context/AuthContext'

// Web Tong layout + pages
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import PhieuNhap from './pages/PhieuNhap'
import PhieuXuat from './pages/PhieuXuat'
import TonKho from './pages/TonKho'
import DanhMuc from './pages/DanhMuc'
import BaoCao from './pages/BaoCao'
import CongTrinh from './pages/CongTrinh'
import NhaCungCap from './pages/NhaCungCap'
import AIReader from './pages/AIReader'
import CaiDat from './pages/CaiDat'
import CanhBao from './pages/CanhBao'
import PhanQuyen from './pages/PhanQuyen'
import ImportData from './pages/ImportData'
import NhatKy from './pages/NhatKy'
import LichSuGiaoDich from './pages/LichSuGiaoDich'
import GhiChu from './pages/GhiChu'
import ThietLapAPI from './pages/ThietLapAPI'

// Web Con layout + pages
import CTLayout from './pages/ct/CTLayout'
import CTDashboard from './pages/ct/CTDashboard'
import CTNhapKho from './pages/ct/CTNhapKho'
import CTXuatKho from './pages/ct/CTXuatKho'
import CTTonKho from './pages/ct/CTTonKho'
import CTAIReader from './pages/ct/CTAIReader'
import CTDanhMuc from './pages/ct/CTDanhMuc'
import CTImportData from './pages/ct/CTImportData'

// ── Guard: đăng nhập qua SSO hpcore, chặn nếu chưa được cấp quyền ──
function PrivateRoute({ children }) {
  const { user, loading, denied, redirectToHpcoreLogin } = useAuth()

  useEffect(() => {
    if (!loading && !user && !denied) redirectToHpcoreLogin()
  }, [loading, user, denied])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hp-bg">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-hp-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-hp-text-muted">Đang tải...</p>
        </div>
      </div>
    )
  }

  if (denied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hp-bg p-4">
        <div className="text-center max-w-sm">
          <p className="text-hp-text font-semibold text-lg mb-2">Chưa được cấp quyền truy cập</p>
          <p className="text-sm text-hp-text-muted">
            Tài khoản của bạn đã đăng nhập hpcore nhưng chưa được cấp quyền vào KhoUNICE Web.
            Liên hệ quản trị viên để được cấp quyền trong mục "Cài đặt" của hpcore.
          </p>
        </div>
      </div>
    )
  }

  if (!user) return null // đang redirect sang hpcore

  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* ── Web Tong (cần đăng nhập qua SSO hpcore) ── */}
        <Route path="/" element={
          <PrivateRoute>
            <CongTrinhProvider>
              <Layout />
            </CongTrinhProvider>
          </PrivateRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="phieu-nhap"  element={<PhieuNhap />} />
          <Route path="phieu-xuat"  element={<PhieuXuat />} />
          <Route path="ton-kho"     element={<TonKho />} />
          <Route path="danh-muc"    element={<DanhMuc />} />
          <Route path="bao-cao"     element={<BaoCao />} />
          <Route path="cong-trinh"  element={<CongTrinh />} />
          <Route path="nha-cung-cap" element={<NhaCungCap />} />
          <Route path="ai-reader"   element={<AIReader />} />
          <Route path="cai-dat"     element={<CaiDat />} />
          <Route path="canh-bao"    element={<CanhBao />} />
          <Route path="phan-quyen"  element={<PhanQuyen />} />
          <Route path="input-data"  element={<ImportData />} />
          <Route path="nhat-ky"    element={<NhatKy />} />
          <Route path="lich-su"    element={<LichSuGiaoDich />} />
          <Route path="ghi-chu"      element={<GhiChu />} />
          <Route path="thiet-lap-api" element={<ThietLapAPI />} />
        </Route>

        {/* ── Web Con (theo id cong trinh) ── */}
        <Route path="/ct/:id" element={
          <PrivateRoute>
            <CTLayout />
          </PrivateRoute>
        }>
          <Route index element={<CTDashboard />} />
          <Route path="nhap-kho"  element={<CTNhapKho />} />
          <Route path="xuat-kho"  element={<CTXuatKho />} />
          <Route path="ton-kho"   element={<CTTonKho />} />
          <Route path="danh-muc"    element={<CTDanhMuc />} />
          <Route path="ai-reader"   element={<CTAIReader />} />
          <Route path="import-data" element={<CTImportData />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
