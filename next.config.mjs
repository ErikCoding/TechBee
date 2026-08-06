/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // `next dev` binds to 0.0.0.0 by default, so tools like VS Code's preview
  // panel can open the app via your LAN IP instead of localhost. Next.js
  // then blocks the HMR websocket for that origin (a security default),
  // which is the "Blocked cross-origin request" warning. Listing your LAN
  // IP here lets HMR work from that origin too — but see next.config.mjs
  // notes / README for the simpler fix (always open http://localhost:3000
  // in a real browser instead of the VS Code preview).
  allowedDevOrigins: ['localhost', '127.0.0.1', '192.168.1.104'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
