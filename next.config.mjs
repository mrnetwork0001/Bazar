/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  webpack: (config) => {
    // Optional peer deps pulled in by wagmi/walletconnect that the browser bundle never needs.
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    // The `wagmi/connectors` barrel eagerly pulls in the Base Account connector
    // (@base-org/account -> @coinbase/cdp-sdk -> @x402/*). @x402 ships as an
    // unresolvable transitive dep, which breaks the entire module graph that
    // contains app/providers.tsx. Bazar only uses the `injected` connector, so
    // these code paths are dead — stub them out rather than installing them.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@x402': false,
      // @metamask/sdk ships a React Native storage import that has no meaning on web.
      '@react-native-async-storage/async-storage': false,
    };

    return config;
  },
};
export default nextConfig;
