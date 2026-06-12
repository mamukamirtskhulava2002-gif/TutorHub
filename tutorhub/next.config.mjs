/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co", // Supabase-ის სურათებისთვის
      },
    ],
  },

  // თუ გინდა IP-ზე გახსნა (მობილურით ტესტირება)
  // allowedDevOrigins: ["192.168.100.4"],
};

export default nextConfig;