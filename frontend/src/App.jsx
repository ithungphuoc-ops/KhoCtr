import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
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
import NguoiDung from './pages/NguoiDung'
import ImportData from './pages/ImportData'
import NhatKy from './pages/NhatKy'
import LichSuGiaoDich from './pages/LichSuGiaoDich'
import GhiChu from './pages/GhiChu'
import ThietLapAPI from './pages/ThietLapAPI'
import Login from './pages/Login'

// Web Con layout + pages
import CTLayout from './pages/ct/CTLayout'
import CTDashboard from './pages/ct/CTDashboard'
import CTNhapKho from './pages/ct/CTNhapKho'
import CTXuatKho from './pages/ct/CTXuatKho'
import CTTonKho from './pages/ct/CTTonKho'
import CTAIReader from './pages/ct/CTAIReader'
import CTDanhMuc from './pages/ct/CTDanhMuc'
import CTImportData from './pages/ct/CTImportData'
import CTGhiChu from './pages/ct/CTGhiChu'

// ── Guard: chuyển về /login nếu chưa đăng nhập ───────────────
function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-400">Đang tải...</p>
        </div>
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* ── Trang đăng nhập (public) ── */}
        <Route path="/login" element={<Login />} />

        {/* ── Web Tong (cần đăng nhập) ── */}
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
          <Route path="nguoi-dung"  element={<NguoiDung />} />
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
          <Route path="ghi-chu"     element={<CTGhiChu />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
