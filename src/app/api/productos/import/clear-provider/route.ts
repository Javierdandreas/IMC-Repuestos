import { NextRequest, NextResponse } from "next/server";
import { clearProviderProducts } from "@/lib/repos/productos";
import { getServerInternalUser } from "@/lib/auth";
import { canManageContent } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerInternalUser();
    if (!canManageContent(session?.rol)) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }

    const { id_proveedor } = await req.json();
    if (!id_proveedor) {
      return NextResponse.json({ message: "ID de proveedor es requerido" }, { status: 400 });
    }

    await clearProviderProducts(Number(id_proveedor));
    
    return NextResponse.json({ message: "Catálogo del proveedor limpiado con éxito" });
  } catch (error: any) {
    console.error("❌ Error al limpiar proveedor:", error);
    return NextResponse.json(
      { message: "Error al limpiar el catálogo del proveedor", error: error.message },
      { status: 500 }
    );
  }
}
