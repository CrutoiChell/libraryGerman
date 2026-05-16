/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // The catalog is admin-curated and low-traffic, so we trade
    // Next.js image optimization for "any external URL just works".
    // With `unoptimized = true`, every `next/image` becomes a plain
    // `<img>` and Google Books / Supabase Storage thumbnails render
    // without per-host whitelisting headaches.
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
