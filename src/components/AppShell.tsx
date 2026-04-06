"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";

type Props = {
  children: React.ReactNode;
};

export default function AppShell({ children }: Props) {
  const pathname = usePathname();
  const hideNavbar = pathname === "/login";

  return (
    <>
      {!hideNavbar && <Navbar />}
      <main>{children}</main>
    </>
  );
}
