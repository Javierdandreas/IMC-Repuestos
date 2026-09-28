import { NextRequest, NextResponse } from "next/server";
import { deleteProducto, getProductoById, updateProducto } from "@/lib/repos/productos";
import { registrarProductoActividad } from "@/lib/repos/producto-actividad";
import { requireApiSession, requireApiWriteSession } from "@/lib/api-auth";
import { validateProductoPayload } from "@/lib/validators/productos";
import { parseIdParam } from "@/lib/validators/catalogos";
import { jsonError } from "@/lib/api-errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireApiSession(request);
  try {
    const { id } = await params;
    const numericId = parseIdParam(id);
    const product = await getProductoById(numericId);

    if (!product) {
      return NextResponse.json({ message: "Item no encontrado" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo obtener el item");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApiWriteSession(request);
  try {
    const { id } = await params;
    const numericId = parseIdParam(id);
    const body = await request.json();
    const payload = validateProductoPayload(body);
    const previousProduct = await getProductoById(numericId);
    if (!previousProduct) {
      return NextResponse.json({ message: "Item no encontrado" }, { status: 404 });
    }
    const product = await updateProducto(numericId, payload);

    const activities = [] as Parameters<typeof registrarProductoActividad>[0][];
    const changedFields: string[] = [];
    if (previousProduct.descripcion !== payload.descripcion) changedFields.push("descripcion");
    if (previousProduct.cod_unico !== payload.cod_unico) changedFields.push("codigo");
    if (previousProduct.cod_barra !== (payload.cod_barra || "")) changedFields.push("codigo de barras");
    if (previousProduct.id_marca !== payload.id_marca) changedFields.push("marca");
    if (previousProduct.id_subcategoria !== payload.id_subcategoria) changedFields.push("clasificacion");
    if (previousProduct.imagen_url !== (payload.imagen_url || null)) changedFields.push("foto");

    if (changedFields.length > 0) {
      activities.push({
        idProducto: numericId,
        codigoProducto: payload.cod_unico,
        tipo: "EDICION",
        titulo: "Datos del item actualizados",
        detalle: changedFields.join(", "),
        datos: { campos: changedFields },
        usuarioId: session.usuarioId,
      });
    }

    if (Number(previousProduct.stock) !== Number(payload.stock)) {
      activities.push({
        idProducto: numericId,
        codigoProducto: payload.cod_unico,
        tipo: "STOCK",
        titulo: "Stock actualizado manualmente",
        detalle: `${previousProduct.stock} a ${payload.stock}`,
        datos: { anterior: previousProduct.stock, nuevo: payload.stock },
        usuarioId: session.usuarioId,
      });
    }

    const oldPrices = new Map((previousProduct.precios || []).map((price) => [price.id_tipo_precio, price]));
    const changedPrices = (payload.precios || []).filter((price) => Number(oldPrices.get(price.id_tipo_precio)?.valor ?? 0) !== Number(price.valor));
    if (changedPrices.length > 0) {
      activities.push({
        idProducto: numericId,
        codigoProducto: payload.cod_unico,
        tipo: "PRECIO",
        titulo: "Precios actualizados",
        detalle: `${changedPrices.length} precio${changedPrices.length === 1 ? "" : "s"} modificado${changedPrices.length === 1 ? "" : "s"}`,
        datos: { tipos: changedPrices.map((price) => price.id_tipo_precio) },
        usuarioId: session.usuarioId,
      });
    }

    const oldSuppliers = new Map((previousProduct.proveedores || []).map((supplier) => [supplier.id_proveedor, supplier]));
    const changedSupplierCost = (payload.proveedores || []).some((supplier) => {
      const previous = oldSuppliers.get(supplier.id_proveedor);
      return Number(previous?.costo_actual ?? 0) !== Number(supplier.costo_actual ?? 0);
    });
    if (changedSupplierCost || previousProduct.criterio_costo !== payload.criterio_costo) {
      activities.push({
        idProducto: numericId,
        codigoProducto: payload.cod_unico,
        tipo: "COSTO",
        titulo: "Costo actualizado",
        detalle: changedSupplierCost ? "Se modifico el costo de proveedor" : "Se modifico el criterio de costo",
        usuarioId: session.usuarioId,
      });
    }

    await Promise.all(activities.map((activity) => registrarProductoActividad(activity)));
    return NextResponse.json(product);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo actualizar el item");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireApiWriteSession(request);
  try {
    const { id } = await params;
    const numericId = parseIdParam(id);
    await deleteProducto(numericId);
    return NextResponse.json({ message: "Item eliminado correctamente" });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo eliminar el item");
  }
}
