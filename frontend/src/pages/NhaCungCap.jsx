import React from 'react'
import { Truck } from 'lucide-react'

export default function NhaCungCap() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-hp-text">NHA CUNG CAP</h1>
        <p className="text-hp-text-secondary mt-1 text-sm">Quan ly danh sach nha cung cap</p>
      </div>
      <div className="bg-hp-card rounded-hp-md shadow-sm border border-hp-border p-8 text-center">
        <div className="w-16 h-16 bg-hp-accent/15 rounded-full flex items-center justify-center mx-auto mb-4">
          <Truck className="w-8 h-8 text-hp-accent" />
        </div>
        <h3 className="text-lg font-semibold text-hp-text mb-2">Nha cung cap</h3>
        <p className="text-hp-text-secondary text-sm">Trang nay dang duoc phat trien. Vui long quay lai sau.</p>
      </div>
    </div>
  )
}
