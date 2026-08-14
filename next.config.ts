import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // Polyfill 'global' for @netless/fastboard-react which expects a Node-like env
      config.resolve.fallback = {
        ...config.resolve.fallback,
        global: false,
      };
      config.plugins.push(
        new webpack.DefinePlugin({
          global: "globalThis",
        })
      );
    }
    return config;
  },
};

export default nextConfig;
