import { withTransaction } from "@/lib/db-utils";
import { AppError } from "@/lib/api-errors";
import { registrarProductoActividad } from "@/lib/repos/producto-actividad";

export type TipoItemMasivo = "ITEM" | "KIT";
export type CampoCambioMasivo =
  | "CLASIFICACION"
  | "MARCA"
  | "PROVEEDOR"
  | "UBICACION"
  | "STOCK_MINIMO"
  | "OBSERVACION"
  | "PALABRAS_CLAVE";

export type CambioMasivoItemsInput = {
  items: Array<{ id: number; tipo: TipoItemMasivo }>;
  campo: CampoCambioMasivo;
  idCategoria?: number;
  idSubcategoria?: number;
  idMarca?: number;
  idProveedor?: number;
  idUbicacion?: number;
  stockMinimo?: number;
  texto?: string;
  usuarioId?: number | null;
};

type ProductoActualizado = { id: number; cod_unico: string };

function idsPorTipo(items: CambioMasivoItemsInput["items"], tipo: TipoItemMasivo) {
  return [...new Set(items.filter((item) => item.tipo === tipo).map((item) => item.id))];
}

async function asegurarExiste(
  table: "categoria" | "subcategoria" | "marcas" | "proveedores" | "ubicaciones",
  id: number | undefined,
  mensaje: string,
) {
  if (!id) throw new AppError(mensaje, 400);
  return id;
}

export async function aplicarCambioMasivoItems(input: CambioMasivoItemsInput) {
  const itemIds = idsPorTipo(input.items, "ITEM");
  const kitIds = idsPorTipo(input.items, "KIT");

  if (itemIds.length + kitIds.length === 0) {
    throw new AppError("Selecciona al menos un item o kit", 400);
  }

  return withTransaction(async (client) => {
    let productosActualizados: ProductoActualizado[] = [];
    let kitsActualizados = 0;

    const actualizarProductos = async (sql: string, params: unknown[], titulo: string, detalle: string) => {
      if (itemIds.length === 0) return;
      const result = await client.query<ProductoActualizado>(sql, params);
      productosActualizados = result.rows;
      await Promise.all(result.rows.map((producto) => registrarProductoActividad({
        idProducto: producto.id,
        codigoProducto: producto.cod_unico,
        tipo: "EDICION",
        titulo,
        detalle,
        usuarioId: input.usuarioId,
      }, client)));
    };

    if (input.campo === "CLASIFICACION") {
      const idCategoria = await asegurarExiste("categoria", input.idCategoria, "Selecciona una categoria");
      const idSubcategoria = await asegurarExiste("subcategoria", input.idSubcategoria, "Selecciona una subcategoria");
      const subcategoria = await client.query<{ id: number }>(
        "SELECT id FROM public.subcategoria WHERE id = $1 AND id_categoria = $2",
        [idSubcategoria, idCategoria],
      );
      if (subcategoria.rowCount === 0) throw new AppError("La subcategoria no pertenece a la categoria seleccionada", 400);

      await actualizarProductos(
        "UPDATE public.productos SET id_subcategoria = $1 WHERE id = ANY($2::int[]) RETURNING id, cod_unico",
        [idSubcategoria, itemIds],
        "Clasificacion actualizada masivamente",
        "Categoria y subcategoria actualizadas desde el listado general",
      );
      if (kitIds.length > 0) {
        const result = await client.query(
          "UPDATE public.kits SET id_categoria = $1, id_subcategoria = $2 WHERE id = ANY($3::int[])",
          [idCategoria, idSubcategoria, kitIds],
        );
        kitsActualizados = result.rowCount || 0;
      }
    }

    if (input.campo === "MARCA") {
      const idMarca = await asegurarExiste("marcas", input.idMarca, "Selecciona una marca");
      await actualizarProductos(
        "UPDATE public.productos SET id_marca = $1 WHERE id = ANY($2::int[]) RETURNING id, cod_unico",
        [idMarca, itemIds],
        "Marca actualizada masivamente",
        "Marca actualizada desde el listado general",
      );
      if (kitIds.length > 0) {
        const result = await client.query("UPDATE public.kits SET id_marca = $1 WHERE id = ANY($2::int[])", [idMarca, kitIds]);
        kitsActualizados = result.rowCount || 0;
      }
    }

    if (input.campo === "PROVEEDOR") {
      const idProveedor = await asegurarExiste("proveedores", input.idProveedor, "Selecciona un proveedor");
      if (itemIds.length > 0) {
        const result = await client.query<ProductoActualizado>(
          `WITH actualizados AS (
             INSERT INTO public.producto_proveedor (id_producto, id_proveedor, codigo_proveedor)
             SELECT id, $1, NULL FROM public.productos WHERE id = ANY($2::int[])
             ON CONFLICT (id_producto, id_proveedor) DO NOTHING
             RETURNING id_producto
           )
           SELECT p.id, p.cod_unico
           FROM public.productos p
           JOIN actualizados a ON a.id_producto = p.id`,
          [idProveedor, itemIds],
        );
        productosActualizados = result.rows;
        await Promise.all(result.rows.map((producto) => registrarProductoActividad({
          idProducto: producto.id,
          codigoProducto: producto.cod_unico,
          tipo: "EDICION",
          titulo: "Proveedor asociado masivamente",
          detalle: "Proveedor asociado desde el listado general",
          usuarioId: input.usuarioId,
        }, client)));
      }
    }

    if (input.campo === "UBICACION") {
      const idUbicacion = await asegurarExiste("ubicaciones", input.idUbicacion, "Selecciona una ubicacion");
      await actualizarProductos(
        "UPDATE public.productos SET id_ubicacion = $1 WHERE id = ANY($2::int[]) RETURNING id, cod_unico",
        [idUbicacion, itemIds],
        "Ubicacion actualizada masivamente",
        "Ubicacion actualizada desde el listado general",
      );
    }

    if (input.campo === "STOCK_MINIMO") {
      if (!Number.isInteger(input.stockMinimo) || Number(input.stockMinimo) < 0) {
        throw new AppError("Ingresa un stock minimo valido", 400);
      }
      const stockMinimo = Number(input.stockMinimo);
      await actualizarProductos(
        "UPDATE public.productos SET stock_minimo = $1 WHERE id = ANY($2::int[]) RETURNING id, cod_unico",
        [stockMinimo, itemIds],
        "Stock minimo actualizado masivamente",
        `Stock minimo establecido en ${stockMinimo} desde el listado general`,
      );
      if (kitIds.length > 0) {
        const result = await client.query("UPDATE public.kits SET stock_minimo = $1 WHERE id = ANY($2::int[])", [stockMinimo, kitIds]);
        kitsActualizados = result.rowCount || 0;
      }
    }

    if (input.campo === "OBSERVACION") {
      const texto = String(input.texto || "").trim() || null;
      await actualizarProductos(
        "UPDATE public.productos SET observacion = $1 WHERE id = ANY($2::int[]) RETURNING id, cod_unico",
        [texto, itemIds],
        "Observacion actualizada masivamente",
        "Observacion actualizada desde el listado general",
      );
      if (kitIds.length > 0) {
        const result = await client.query("UPDATE public.kits SET observacion = $1 WHERE id = ANY($2::int[])", [texto, kitIds]);
        kitsActualizados = result.rowCount || 0;
      }
    }

    if (input.campo === "PALABRAS_CLAVE") {
      const texto = String(input.texto || "").trim() || null;
      await actualizarProductos(
        "UPDATE public.productos SET palabra_clave = $1 WHERE id = ANY($2::int[]) RETURNING id, cod_unico",
        [texto, itemIds],
        "Palabras clave actualizadas masivamente",
        "Palabras clave actualizadas desde el listado general",
      );
    }

    return {
      itemsActualizados: productosActualizados.length,
      kitsActualizados,
      kitsOmitidos: ["PROVEEDOR", "UBICACION", "PALABRAS_CLAVE"].includes(input.campo) ? kitIds.length : 0,
    };
  });
}
