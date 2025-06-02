/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
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
      
    ],
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.map$/,
      use: "null-loader",
    });
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
