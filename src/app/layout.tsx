import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { Toaster } from "sonner";
import { MetadataProvider } from "@/context/MetadataContext";
import { getProductMeta } from "@/lib/productos-meta";
import { UserProvider } from "@/context/UserContext";
import { getServerInternalUser } from "@/lib/auth";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IMC Repuestos",
  description: "Panel interno de productos, piezas y catálogos",
  icons: {
    icon: "/icon.ico",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [meta, user] = await Promise.all([
    getProductMeta(),
    getServerInternalUser()
  ]);

  return (
    <html lang="es">
      <body className={inter.className}>
        <UserProvider initialUser={user}>
          <MetadataProvider initialMeta={meta}>
            <AppShell>{children}</AppShell>
            <Toaster richColors position="top-right" />
            <SpeedInsights />
            <Analytics />
          </MetadataProvider>
        </UserProvider>
      </body>
    </html>
  );
}
