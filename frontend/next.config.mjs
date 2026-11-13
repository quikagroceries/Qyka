/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  // Marketing/HTML must never stick behind a stale browser or CDN cache —
  // this project often shares localhost:3000 with other Next apps. But this
  // previously matched EVERY path, including /_next/static and the image
  // optimizer - those are content-hashed and meant to be cached forever, so
  // forcing no-store on them made every page reload re-download the full JS,
  // CSS and image payload from scratch instead of hitting the browser cache.
  // Exclude hashed build output and optimized images; only documents (and
  // any other app route) get the no-cache treatment.
  async headers() {
    return [
      {
        source: "/:path((?!_next/static|_next/image|favicon.ico).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
