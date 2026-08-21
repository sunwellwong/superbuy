/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  webpack: (config, { isServer }) => {
    // transformers.js is only used in the browser (CLIP embedding). Exclude the
    // native Node ONNX runtime so it is never bundled into the client/edge build.
    config.resolve.alias = {
      ...config.resolve.alias,
      "onnxruntime-node": false,
    };
    return config;
  },
};

export default nextConfig;
