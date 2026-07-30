import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "KhoCtr — Quản lý kho công trình HP Cons",
  description: "Hệ thống quản lý kho vật liệu xây dựng HP Cons Việt Nam",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KhoCtr",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#096AA7",
};

// Chống nháy màn hình (FOUC): đọc localStorage TRƯỚC khi React hydrate, set thẳng
// data-theme lên <html> — script này chạy trước paint đầu tiên (giống cách
// hpcons-quatang xử lý toggle .dark, port sang cơ chế data-theme của KhoCtr).
const themeInitScript = `
try {
  var t = localStorage.getItem('hp-theme');
  document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
} catch (e) {}
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" data-theme="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
