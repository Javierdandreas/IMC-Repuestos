import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { Toaster } from "sonner";
import { MetadataProvider } from "@/context/MetadataContext";
import { getProductMeta } from "@/lib/productos-meta";
import { UserProvider } from "@/context/UserContext";
import { ThemeProvider } from "@/context/ThemeContext";
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
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var supportDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (!theme && supportDarkMode) theme = 'dark';
                  if (theme === 'dark') document.documentElement.classList.add('dark');
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} bg-white dark:bg-slate-950`}>
        <ThemeProvider>
          <UserProvider initialUser={user}>
            <MetadataProvider initialMeta={meta}>
              <AppShell>{children}</AppShell>
              <Toaster richColors position="top-right" />
              <SpeedInsights />
              <Analytics />
            </MetadataProvider>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
