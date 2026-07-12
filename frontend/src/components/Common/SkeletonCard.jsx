import React from 'react'

/* Pulse animation dùng chung */
const Pulse = ({ className }) => (
  <div className={`animate-pulse rounded bg-hp-elevated ${className}`} />
)

/**
 * HPCons Design System V1.1 — Skeleton Loading
 * Dùng thay cho khoảng trắng khi đang tải dữ liệu.
 */

/** KPI Card skeleton */
export function SkeletonKPI() {
  return (
    <div className="bg-hp-card border border-hp-border rounded-hp-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Pulse className="h-3 w-24" />
        <Pulse className="h-8 w-8 rounded-hp-md" />
      </div>
      <Pulse className="h-7 w-32" />
      <Pulse className="h-3 w-20" />
    </div>
  )
}

/** Table row skeleton */
export function SkeletonRow({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Pulse className={`h-4 ${i === 0 ? 'w-20' : i === cols - 1 ? 'w-12' : 'w-full'}`} />
        </td>
      ))}
    </tr>
  )
}

/** Generic card skeleton */
export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="bg-hp-card border border-hp-border rounded-hp-lg p-4 space-y-3">
      <Pulse className="h-4 w-1/2" />
      {Array.from({ length: lines }).map((_, i) => (
        <Pulse key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  )
}

/** Default export: dàn grid KPI */
export default function SkeletonDashboard({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonKPI key={i} />
      ))}
    </div>
  )
}
