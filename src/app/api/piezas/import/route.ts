import { NextResponse } from "next/server";
import { importPiezas } from "@/modules/piezas/repos/piezas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, mappings, fileName } = body;

    const result = await importPiezas(items, "SISTEMA", fileName, mappings);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error en importación de piezas:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
