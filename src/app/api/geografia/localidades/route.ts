import { NextRequest, NextResponse } from "next/server";

type GeoRefLocality = {
  id: string;
  nombre: string;
};

export async function GET(request: NextRequest) {
  const provincia = request.nextUrl.searchParams.get("provincia")?.trim();
  if (!provincia) {
    return NextResponse.json({ message: "Selecciona una provincia para cargar sus localidades." }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://apis.datos.gob.ar/georef/api/localidades?provincia=${encodeURIComponent(provincia)}&campos=id,nombre&max=5000`,
      { next: { revalidate: 60 * 60 * 24 } }
    );

    if (!response.ok) {
      throw new Error("GeoRef no respondio correctamente");
    }

    const payload = await response.json() as { localidades?: GeoRefLocality[] };
    const localidades = [...(payload.localidades ?? [])].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es-AR")
    );

    return NextResponse.json({ localidades });
  } catch {
    return NextResponse.json(
      { message: "No se pudieron cargar las localidades. Intenta nuevamente." },
      { status: 502 }
    );
  }
}
