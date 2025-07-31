/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "static.wixstatic.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "assets-cdn.watchdisneyfe.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i.pinimg.com",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "kz-studio.hk",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "seibushoko.com",
        pathname: "/**"
      },
      
    ],
  },
  webpack(config) {
    config.module.rules.push(
      {
        test: /\.map$/,
        use: "null-loader",
      },
      {
        test: /pdf\.worker\.mjs$/, // ✅ MUST match `.mjs` not `.js`
        type: "asset/resource",
      },
      {
        test: /\.mjs$/, // ✅ ESM modules from node_modules
        include: /node_modules/,
        type: "javascript/auto",
      }
    );
    return config;
  },
};

// Conditionally add Tempo plugin if enabled
if (process.env.NEXT_PUBLIC_TEMPO) {
  nextConfig.experimental = {
    swcPlugins: [[require.resolve("tempo-devtools/swc/0.90"), {}]],
  };
}

module.exports = nextConfig;

