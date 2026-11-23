/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker image (Dockerfile `run` stage).
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  // The staff portal moved from /manager to /admin; keep old links working.
  async redirects() {
    return [
      { source: "/manager", destination: "/admin/dashboard", permanent: false },
      { source: "/manager/:path*", destination: "/admin/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
