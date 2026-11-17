import { NextRequest,NextResponse } from "next/server";
import { requireApiReadSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { consultaEstadisticasMostradorSchema,getEstadisticasMostrador,getVentasMostrador } from "@/lib/estadisticas-mostrador";

export const dynamic="force-dynamic";
export async function GET(request:NextRequest) {
  try {
    await requireApiReadSession(request);
    const input=consultaEstadisticasMostradorSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const data=input.vista==="ventas" ? await getVentasMostrador(input) : await getEstadisticasMostrador(input);
    return NextResponse.json(data,{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) {return jsonError(error,"No se pudieron obtener las estadisticas de mostrador.");}
}
