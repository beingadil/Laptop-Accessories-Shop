import type {NextConfig} from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Hoist the standalone output to this project's directory.
  // (A package.json in the user home folder otherwise makes Next trace from the home dir.)
  outputFileTracingRoot: path.resolve(process.cwd()),
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // Set DISABLE_HMR=true to disable file watching during agent-driven edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
