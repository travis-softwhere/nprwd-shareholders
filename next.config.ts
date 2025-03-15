/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
  // Production-specific settings
  ...(process.env.NODE_ENV === 'production' && {
    logging: {
      level: process.env.NEXT_LOG_LEVEL || 'error',
    },
  }),
}

module.exports = nextConfig