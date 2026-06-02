import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "s3.amazonaws.com" },
      { protocol: "https", hostname: "cdn.myanimelist.net" },
      // Add your custom streaming provider hostname here
      // { protocol: "https", hostname: "your-provider.com" },
      { protocol: "https", hostname: "artworks.thetvdb.com" },
      { protocol: "https", hostname: "img1.ak.crunchyroll.com" },
    ],
  },
};

export default nextConfig;
