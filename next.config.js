/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // If you have specific webpack configurations for shaders (e.g., raw-loader or glslify-loader)
    // you might need to add them here. For example:
    // webpack: (config, { isServer }) => {
    //   config.module.rules.push({
    //     test: /\.(glsl|vs|fs|vert|frag)$/,
    //     exclude: /node_modules/,
    //     use: ['raw-loader', 'glslify-loader']
    //   });
    //   return config;
    // },
};

module.exports = nextConfig; 