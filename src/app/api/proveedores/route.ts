import { NextRequest, NextResponse } from "next/server";
import { createProveedor, getProveedores } from "@/lib/repos/catalogos";
import { requireApiSession } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    const rows = await getProveedores();
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "No se pudieron obtener los proveedores" }, { status: error.status || 400 });
  }
}

export async function POST(request: NextRequest) {
  await requireApiSession(request);
  try {
    const body = await request.json();
    const result = await createProveedor(body.descripcion);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "No se pudo crear el proveedor" }, { status: error.status || 400 });
  }
}