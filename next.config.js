/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Previene clickjacking (que tu app se cargue dentro de un iframe ajeno)
          { key: "X-Frame-Options", value: "DENY" },
          // Evita que el browser infiera el content-type (previene ataques MIME sniffing)
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Controla qué información del referrer se envía a otras páginas
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Fuerza HTTPS por 2 años (solo se activa sobre HTTPS)
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Controla a qué APIs del browser puede acceder la app
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mzvzinbjclndofhceaaa.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

module.exports = nextConfig;
