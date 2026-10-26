/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            // GTM / GA4 / Google Ads origins required for the shared GTM-W6XLJMD5 container
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.supabase.co https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com https://tagmanager.google.com https://www.googleadservices.com https://www.google.com https://googleads.g.doubleclick.net; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://tagmanager.google.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; object-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://*.mapbox.com https://www.google-analytics.com https://analytics.google.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.googletagmanager.com https://stats.g.doubleclick.net https://www.google.com https://googleads.g.doubleclick.net https://www.googleadservices.com; frame-src 'self' https://www.googletagmanager.com https://td.doubleclick.net; frame-ancestors 'self' https://guidemytable.fr https://www.guidemytable.fr; upgrade-insecure-requests;",
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
