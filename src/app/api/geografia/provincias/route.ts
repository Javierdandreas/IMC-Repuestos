import { NextResponse } from "next/server";

type GeoRefProvince = {
  id: string;
  nombre: string;
};

export async function GET() {
  try {
    const response = await fetch(
      "https://apis.datos.gob.ar/georef/api/provincias?campos=id,nombre&max=100",
      { next: { revalidate: 60 * 60 * 24 } }
    );

    if (!response.ok) {
      throw new Error("GeoRef no respondio correctamente");
    }

    const payload = await response.json() as { provincias?: GeoRefProvince[] };
    const provincias = [...(payload.provincias ?? [])].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es-AR")
    );

    return NextResponse.json({ provincias });
  } catch {
    return NextResponse.json(
      { message: "No se pudieron cargar las provincias. Intenta nuevamente." },
      { status: 502 }
    );
  }
}
