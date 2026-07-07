/**
 * GhiChu.jsx — Trang Ghi chú công việc trên App Tổng
 * - Admin: xem ghi chú của tất cả CT, có thể lọc theo CT
 * - User: chỉ thấy ghi chú của CT mình được phân quyền
 */
import React, { useMemo } from 'react'
import { useCongTrinh } from '../context/CongTrinhContext'
import GhiChuModule from '../components/GhiChu/GhiChuModule'

export default function GhiChu() {
  const { congTrinhs, isAdmin } = useCongTrinh()

  // Admin truyền congTrinhList để hiển thị tên CT trên card và cho chọn khi tạo mới
  // User không truyền congTrinhList; server tự filter theo quyền
  const congTrinhList = useMemo(() => {
    if (isAdmin) return congTrinhs || []
    return []
  }, [isAdmin, congTrinhs])

  return (
    <GhiChuModule
      congTrinhId={null}
      congTrinhList={congTrinhList}
      title="GHI CHÚ CÔNG VIỆC"
    />
  )
}
