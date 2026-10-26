import { NextRequest, NextResponse } from "next/server";

import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { guardarVehiculosCanonicos, normalizarAtributosVehiculo, type ValorVehiculo } from "@/lib/catalogo-vehiculos-mercadolibre";
import { withTransaction } from "@/lib/db-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseVehicles(value: unknown) {
  if (!Array.isArray(value)) throw new AppError("El lote de vehiculos no es valido.", 400);
  if (!value.length) throw new AppError("El archivo no contiene vehiculos para importar.", 400);
  if (value.length > 1_000) throw new AppError("Cada lote puede contener hasta 1.000 vehiculos.", 422);

  const unique = new Map<string, ValorVehiculo[]>();
  for (const entry of value) {
    const source = entry && typeof entry === "object" ? entry as { atributos?: unknown } : null;
    const attributes = normalizarAtributosVehiculo(source?.atributos);
    const required = ["BRAND", "MODEL", "VEHICLE_YEAR", "ENGINE"];
    if (!required.every((attribute) => attributes.some((item) => item.id === attribute))) {
      throw new AppError("Cada vehiculo debe incluir marca, modelo, año y motor.", 422);
    }
    unique.set(attributes.map((attribute) => `${attribute.id}:${attribute.valueId}`).join("|"), attributes);
  }
  return [...unique.values()];
}

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = await request.json().catch(() => ({})) as { vehicles?: unknown };
    const vehicles = parseVehicles(body.vehicles);
    const imported = await withTransaction((client) => guardarVehiculosCanonicos(client, vehicles, "IMPORTACION"));
    return NextResponse.json({ processed: vehicles.length, imported: imported.size }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudo importar el lote de vehiculos.");
  }
}
