import { supabaseBrowser as supabase } from "@/utils/supabase/client";

export async function dispararSincronizacionGesu() {
  try {
    const response = await fetch("/api/gesu/importar", {
      method: "GET",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error en la sincronización: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error disparando sincronización GESU:", error);
    throw error;
  }
}

export async function obtenerEstadoSincronizacion() {
  const { data, error } = await supabase
    .from("sync_runs")
    .select("*")
    .eq("source", "GESU")
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error obteniendo estado de sincronización:", error);
  }

  return data;
}

