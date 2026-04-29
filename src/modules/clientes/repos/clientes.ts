import { supabaseBrowser as supabase } from "@/utils/supabase/client";
import { ClienteSupabase } from "../types/clientes";

/**
 * Busca clientes por nombre o documento (DNI/CUIT).
 */
export async function buscarClientesSupabase(query: string): Promise<ClienteSupabase[]> {
  if (!query || query.trim().length < 2) return [];

  const term = `%${query.trim()}%`;

  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .or(`nombre.ilike.${term},documento.ilike.${term}`)
    .limit(5)
    .order('nombre', { ascending: true });

  if (error) {
    console.error("Error al buscar clientes en Supabase:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    nombre: row.nombre,
    telefono: row.telefono,
    documento: row.documento, 
    observaciones: row.observaciones,
    email: row.email
  }));
}

/**
 * Obtiene un cliente por nombre exacto para evitar duplicados.
 */
export async function obtenerClientePorNombreSupabase(nombre: string): Promise<ClienteSupabase | null> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .ilike('nombre', nombre.trim())
    .maybeSingle();

  if (error) return null;
  
  return data ? {
    id: data.id,
    nombre: data.nombre,
    telefono: data.telefono,
    documento: data.documento,
    observaciones: data.observaciones,
    email: data.email
  } : null;
}

