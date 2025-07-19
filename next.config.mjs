/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    ULTRAVOX_API_KEY: process.env.ULTRAVOX_API_KEY,
  },
  images: {
    domains: ['localhost'],
  },
  // Optimizaciones de performance
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
