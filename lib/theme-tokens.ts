// Port từ frontend/src/theme/tokens.js — HPCons Design System V1.1. Token JS cho
// thư viện không dùng class Tailwind (Chart.js...).
export const HP = {
  primary: "#096AA7",
  success: "#60BB46",
  accent: "#096AA7",
  nav: "#4B4F55",
  danger: "#E53935",
  warning: "#FFA726",
  muted: "#9E9E9E",
  background: "#0F1923",
  surface: "#121C26",
  card: "#182531",
  elevated: "#1E2B36",
  border: "rgba(255,255,255,0.08)",
  textPrimary: "#F5F7FA",
  textSecondary: "#B8C0C8",
  textMuted: "#8F9AA5",
} as const;

export const HP_CHART_COLORS = [HP.primary, HP.success, HP.warning, HP.danger, HP.muted];
