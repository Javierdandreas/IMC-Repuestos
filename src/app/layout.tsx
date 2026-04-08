import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { Toaster } from "sonner";
import { MetadataProvider } from "@/context/MetadataContext";
import { getProductMeta } from "@/lib/productos-meta";
import { UserProvider } from "@/context/UserContext";
import { getServerInternalUser } from "@/lib/auth";

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
          </MetadataProvider>
        </UserProvider>
      </body>
    </html>
  );
}
