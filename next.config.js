/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
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
