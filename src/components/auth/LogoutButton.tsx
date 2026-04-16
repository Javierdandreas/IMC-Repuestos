"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { HiOutlineLogout } from "react-icons/hi";

interface LogoutButtonProps {
  className?: string;
  showIcon?: boolean;
}

export default function LogoutButton({ className, showIcon = true }: LogoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={`flex items-center gap-2 w-full px-3 py-2 text-sm font-medium transition-colors ${className}`}
    >
      {showIcon && <HiOutlineLogout className="h-4 w-4" />}
      {loading ? "Cerrando..." : "Cerrar sesión"}
    </button>
  );
}
