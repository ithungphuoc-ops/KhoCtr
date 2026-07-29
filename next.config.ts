import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin -> jwks-rsa -> jose (ESM-only) bị webpack bundle sai cách
  // trên Vercel serverless, gây lỗi "require() of ES Module ... jose ...".
  // Đánh dấu external để Node.js runtime tự resolve, không qua webpack.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
