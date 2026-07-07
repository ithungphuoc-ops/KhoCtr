/**
 * CTGhiChu.jsx — Trang Ghi chú công việc trong App Công trình
 * Dùng GhiChuModule với congTrinhId cụ thể.
 */
import React from 'react'
import { useOutletContext } from 'react-router-dom'
import GhiChuModule from '../../components/GhiChu/GhiChuModule'

export default function CTGhiChu() {
  const { congTrinh, ctId } = useOutletContext()

  return (
    <GhiChuModule
      congTrinhId={Number(ctId)}
      congTrinhList={[]}
      title={`GHI CHÚ — ${congTrinh?.ten_ct || 'Công trình'}`}
    />
  )
}
