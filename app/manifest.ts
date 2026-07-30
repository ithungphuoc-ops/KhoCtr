import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KhoCtr — Quản lý kho công trình HP Cons",
    short_name: "KhoCtr",
    description: "Hệ thống quản lý kho vật liệu xây dựng HP Cons Việt Nam",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0F1923",
    theme_color: "#096AA7",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
