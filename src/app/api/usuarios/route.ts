import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/api-auth";
import { AppError, jsonError } from "@/lib/api-errors";
import { query, withTransaction } from "@/lib/db-utils";
import { asignacionesValidas } from "@/lib/catalogo-permisos";

export const dynamic = "force-dynamic";

const permiso = z.object({ apartado: z.string().max(80), accion: z.string().max(20) });
const creacion = z.object({ nombre: z.string().trim().min(1).max(100), email: z.string().trim().email().max(254), password: z.string().min(12).max(128) });
const edicion = z.object({ usuarioId: z.number().int().positive(), activo: z.boolean().optional(), confirmarLecturaGeneral: z.boolean().optional(), permisos: z.array(permiso).max(200).optional() });

export async function GET(request: NextRequest) {
  try {
    await requireApiRole(request, ["admin"]);
    const usuarios = await query(`SELECT ua.usuario_id AS id, u.nombre_usuario AS nombre, du.email, ua.rol, ua.activo
      FROM public.usuario_auth ua JOIN public.usuario u ON u.id = ua.usuario_id
      LEFT JOIN public.detalle_usuario du ON du.id = u.id ORDER BY u.nombre_usuario, u.id`);
    const permisos = await query("SELECT usuario_id, apartado, accion FROM public.usuario_permiso ORDER BY usuario_id, apartado, accion");
    return NextResponse.json({ usuarios: usuarios.rows, permisos: permisos.rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "No se pudieron consultar los usuarios. Verifica la migracion 105."); }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiRole(request, ["admin"]);
    const body = creacion.parse(await request.json());
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) throw new AppError("Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.", 503);
    // Comprueba la base antes de crear una cuenta en Auth.
    await query("SELECT 1 FROM public.usuario_permiso LIMIT 1");
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase.auth.admin.createUser({ email: body.email.toLowerCase(), password: body.password, email_confirm: true });
    if (error || !data.user) throw new AppError(`No se pudo crear la cuenta de autenticacion: ${error?.message || "respuesta incompleta"}`, 400);
    try {
      await withTransaction(async (client) => {
        const nuevo = await client.query<{ id: number }>("INSERT INTO public.usuario (nombre_usuario) VALUES ($1) RETURNING id", [body.nombre]);
        const id = nuevo.rows[0].id;
        await client.query("INSERT INTO public.detalle_usuario (id, nombre, email) VALUES ($1, $2, $3)", [id, body.nombre, body.email.toLowerCase()]);
        await client.query("INSERT INTO public.usuario_auth (auth_user_id, usuario_id, rol, activo) VALUES ($1, $2, 'empleado', false)", [data.user!.id, id]);
      });
    } catch (error) {
      console.error("No se confirmo la vinculacion de la cuenta Auth", { authUserId: data.user.id, error });
      throw new AppError("La cuenta pudo crearse en Supabase, pero no se confirmo su vinculacion. Revisa Auth y usuarios antes de volver a intentar.", 409);
    }
    return NextResponse.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "No se pudo crear el usuario."); }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireApiRole(request, ["admin"]);
    const body = edicion.parse(await request.json());
    if (body.permisos && !asignacionesValidas(body.permisos)) throw new AppError("Los permisos son invalidos o falta lectura en un apartado.", 400);
    await withTransaction(async (client) => {
      const result = await client.query<{ rol: string }>("SELECT rol FROM public.usuario_auth WHERE usuario_id = $1 FOR UPDATE", [body.usuarioId]);
      const usuario = result.rows[0];
      if (!usuario) throw new AppError("No se encontro el usuario.", 404);
      if (usuario.rol.trim().toLowerCase() !== "empleado") throw new AppError("Solo se pueden modificar empleados desde esta pantalla.", 403);
      if (body.usuarioId === session.usuarioId) throw new AppError("No puedes modificar tu propia cuenta.", 403);
      if (body.activo === true && !body.confirmarLecturaGeneral) throw new AppError("Confirma que el empleado tendra lectura general mientras los permisos no esten activos.", 400);
      if (body.activo !== undefined) await client.query("UPDATE public.usuario_auth SET activo = $2 WHERE usuario_id = $1", [body.usuarioId, body.activo]);
      if (body.permisos) {
        await client.query("DELETE FROM public.usuario_permiso WHERE usuario_id = $1", [body.usuarioId]);
        for (const p of body.permisos) await client.query("INSERT INTO public.usuario_permiso (usuario_id, apartado, accion) VALUES ($1, $2, $3)", [body.usuarioId, p.apartado, p.accion]);
      }
    });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "No se pudo actualizar el usuario."); }
}
