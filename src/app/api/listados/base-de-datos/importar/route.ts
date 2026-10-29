import { NextRequest, NextResponse } from "next/server";
import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { importarCatalogoMaestro, type CatalogoMaestroTipo } from "@/lib/repos/catalogos";

const TIPOS = new Set<CatalogoMaestroTipo>(["marcas", "categorias", "ubicaciones"]);

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const tipo = new URL(request.url).searchParams.get("tipo") as CatalogoMaestroTipo;
    if (!TIPOS.has(tipo)) throw new AppError("Catalogo maestro invalido.", 400);

    const body = await request.json();
    if (!Array.isArray(body?.filas) || body.filas.length === 0) throw new AppError("El archivo no contiene filas para importar.", 400);
    if (body.filas.length > 5000) throw new AppError("Cada importacion admite hasta 5.000 filas.", 400);

    return NextResponse.json(await importarCatalogoMaestro(tipo, body.filas));
  } catch (error) {
    return jsonError(error, "No se pudo importar el catalogo maestro.");
  }
}
