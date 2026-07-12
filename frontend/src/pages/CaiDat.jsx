import React from 'react'
import { Settings } from 'lucide-react'

export default function CaiDat() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-hp-text">CAU HINH HE THONG</h1>
        <p className="text-hp-text-secondary mt-1 text-sm">Cai dat va cau hinh he thong</p>
      </div>
      <div className="bg-hp-card rounded-hp-md shadow-sm border border-hp-border p-8 text-center">
        <div className="w-16 h-16 bg-hp-elevated rounded-full flex items-center justify-center mx-auto mb-4">
          <Settings className="w-8 h-8 text-hp-text-secondary" />
        </div>
        <h3 className="text-lg font-semibold text-hp-text mb-2">Cau hinh</h3>
        <p className="text-hp-text-secondary text-sm">Trang nay dang duoc phat trien. Vui long quay lai sau.</p>
      </div>
    </div>
  )
}
