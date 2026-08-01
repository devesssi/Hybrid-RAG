/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep PDF parsing in the Node runtime. Bundling pdf-parse into a Turbopack
  // route evaluates PDF.js before its Node polyfills are available on Vercel.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
