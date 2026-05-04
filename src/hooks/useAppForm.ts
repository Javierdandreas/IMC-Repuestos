"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface UseAppFormOptions<T> {
  url: string;
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (data: T) => void;
  onCancel?: () => void;
  refreshOnSuccess?: boolean;
  redirectTo?: string;
}

export function useAppForm<T = any>(options: UseAppFormOptions<T>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; type: any; details: any[] } | null>(null);
  const router = useRouter();

  const submit = async (payload: any) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(options.url, {
        method: options.method || "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorData = {
          message: data.message || options.errorMessage || "Ocurrió un error al procesar el formulario",
          type: data.type || "server",
          details: data.details || [],
        };
        setError(errorData);
        throw new Error(errorData.message);
      }

      toast.success(options.successMessage || "Operación realizada con éxito");
      
      if (data.warning) {
        toast.warning(data.warning);
      }

      if (options.onSuccess) {
        options.onSuccess(data);
      }

      if (options.refreshOnSuccess) {
        router.refresh();
      }

      if (options.redirectTo) {
        router.push(options.redirectTo);
      }

      return data;
    } catch (error: any) {
      const msg = error.message || options.errorMessage || "Error inesperado";
      // Si no hay un error estructurado seteado, mostramos toast como fallback
      if (!error.message) {
        toast.error(msg);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const cancel = () => {
    if (options.onCancel) {
      options.onCancel();
    }
  };

  return {
    loading,
    error,
    clearError: () => setError(null),
    submit,
    cancel,
  };
}
