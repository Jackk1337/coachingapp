import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize for production
  reactStrictMode: true,
  
  // Ensure proper handling of environment variables
  env: {
    // These are already handled via NEXT_PUBLIC_ prefix
    // Server-side env vars are automatically available
  },
  
  // Optimize images if needed in the future
  images: {
    // Add any image optimization config here if needed
  },
};

export default nextConfig;
