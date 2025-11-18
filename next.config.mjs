import path from "path"

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.resolve.alias["isomorphic-ws$"] = path.resolve("./lib/shims/isomorphic-ws.ts")
    config.resolve.alias["@midnight-ntwrk/compact-runtime$"] = path.resolve("./node_modules/@midnight-ntwrk/compact-runtime")
    config.experiments = config.experiments || {}
    config.experiments.syncWebAssembly = true
    if ("asyncWebAssembly" in config.experiments) {
      delete config.experiments.asyncWebAssembly
    }
    return config
  },
}

export default nextConfig