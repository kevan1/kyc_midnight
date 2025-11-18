// next.config.mjs
import path from "path"

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allows builds to pass even with TS errors. Consider removing for production quality.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Disable Next Image optimization (common for static hosting or custom CDNs)
    unoptimized: true,
  },
  experimental: {
    // Disable Turbopack across build surfaces
    turbo: false,
    // Prefer webpack worker for builds (helps avoid Turbopack default)
    webpackBuildWorker: true,
  },
  webpack: (config) => {
    // Preserve your aliases
    config.resolve.alias["isomorphic-ws$"] = path.resolve("./lib/shims/isomorphic-ws.ts")
    config.resolve.alias["@midnight-ntwrk/compact-runtime$"] = path.resolve("./node_modules/@midnight-ntwrk/compact-runtime")

    // Enable synchronous WebAssembly and explicitly disable async WASM to avoid conflicts
    config.experiments = config.experiments || {}
    config.experiments.syncWebAssembly = true
    if ("asyncWebAssembly" in config.experiments) {
      delete config.experiments.asyncWebAssembly
    }

    return config
  },
}

export default nextConfig
