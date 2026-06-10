/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
    reactStrictMode: true,
    output: 'export',
    // Served at the custom domain root (kittle.temrevil.com) — no base path.
    basePath: '',
    assetPrefix: '',
    images: {
        unoptimized: true,
    },
    // في إصدارات Next.js الحديثة، يتم وضع إعدادات Turbopack هنا
    turbopack: {
        resolveAlias: {
            canvas: './empty-module.js',
        },
    },
    webpack: (config) => {
        config.resolve.alias.canvas = false;
        return config;
    },
};

export default nextConfig;
