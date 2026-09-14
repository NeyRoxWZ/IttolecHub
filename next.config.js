/**
 * Next.js settings. The site ran on the defaults; this file exists because the
 * Cloudflare build (OpenNext) needs one to recognise the app.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // Browser-side hardening sent with every response.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // No other site may show IttolecHub inside a frame (clickjacking).
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Files are only ever read as the type the server says.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Other sites only learn the origin, never full URLs (room codes).
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
