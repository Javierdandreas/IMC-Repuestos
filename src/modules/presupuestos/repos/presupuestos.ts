import { supabaseBrowser as supabase } from "@/utils/supabase/client";
import type { GuardarPresupuestoPayload, PresupuestoCompleto, EstadoPresupuesto } from "../types/presupuesto";

export async function guardarPresupuestoSupabase(payload: GuardarPresupuestoPayload) {
  // Función para guardar o actualizar presupuestos preservando el orden de los ítems
  // 1. Buscar o Crear Cliente
  let clienteId: number;
  const nombreFiltro = payload.cliente || 'Consumidor Final';

  // Intentamos buscar por nombre exacto primero
  const { data: existingCliente } = await supabase
    .from('clientes')
    .select('id')
    .ilike('nombre', nombreFiltro.trim())
    .maybeSingle();

  if (existingCliente) {
    clienteId = existingCliente.id;
    // Opcional: Actualizar datos del cliente existente si cambiaron
    await supabase
      .from('clientes')
      .update({
        telefono: payload.telefono || null,
        documento: payload.referencia || null, // Mapeamos referencia a documento
      })
      .eq('id', clienteId);
  } else {
    const { data: newCliente, error: cliErr } = await supabase
      .from('clientes')
      .insert({
        nombre: nombreFiltro,
        telefono: payload.telefono || null,
        documento: payload.referencia || null,
        observaciones: payload.observaciones || null
      })
      .select('id')
      .single();

    if (cliErr) throw new Error("Error al crear cliente: " + cliErr.message);
    clienteId = newCliente.id;
  }

  // 2. Crear o Actualizar Vehículo
  let vehiculoId = null;
  if (payload.marca || payload.modelo || payload.patente || payload.chasis || payload.referencia) {
    const { data: vehiculo, error: vehErr } = await supabase
      .from('vehiculos')
      .insert({
        cliente_id: clienteId,
        marca: payload.marca || null,
        modelo: payload.modelo || null,
        patente: payload.patente || null,
        chasis: payload.chasis || null,
        observaciones: payload.referencia || null
      })
      .select('id')
      .single();

    if (vehErr) throw new Error("Error al crear vehículo: " + vehErr.message);
    vehiculoId = vehiculo.id;
  }

  // 3. Crear Presupuesto (Si no tiene un ID de edición)
  let presupuestoActivoId = payload.presupuestoId;
  let codigoAUsar = payload.codigoOriginal || `PRE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  if (!presupuestoActivoId) {
    const estadoFinal = payload.estado || 'pendiente';
    const { data: presInfo, error: presErr } = await supabase
      .from('presupuestos')
      .insert({
        codigo_interno: codigoAUsar,
        cliente_id: clienteId,
        vehiculo_id: vehiculoId,
        estado: estadoFinal,
        moneda: 'ARS',
        total: payload.total,
        subtotal: payload.total,
        observaciones: payload.observaciones || null,
        estado_deposito: 'sin_revisar',
        // Grabar fecha de confirmación si se crea directamente como confirmado
        confirmado_en: estadoFinal === 'confirmado' ? new Date().toISOString() : null,
        vendedor_nombre: payload.vendedorNombre || null,
      })
      .select('id, codigo_interno')
      .single();

    if (presErr) throw new Error("Error al crear presupuesto: " + presErr.message);
    presupuestoActivoId = presInfo.id;
    codigoAUsar = presInfo.codigo_interno;
  } else {
    // Si se está editando, necesitamos saber si se est pasando a confirmado para grabar la fecha
    const estadoFinalUpdate = payload.estado || 'pendiente';
    const patchUpdate: any = {
      cliente_id: clienteId,
      vehiculo_id: vehiculoId,
      estado: estadoFinalUpdate,
      total: payload.total,
      subtotal: payload.total,
      observaciones: payload.observaciones || null
    };

    if (estadoFinalUpdate === 'confirmado') {
      patchUpdate.confirmado_en = new Date().toISOString();
    } else if (estadoFinalUpdate === 'pendiente') {
      // Si vuelve a pendiente, limpiamos todo rastro de depsito y confirmacin
      patchUpdate.estado_deposito = 'sin_revisar';
      patchUpdate.confirmado_en = null;
    }

    const { error: updErr } = await supabase
      .from('presupuestos')
      .update(patchUpdate)
      .eq('id', isNaN(Number(presupuestoActivoId)) ? presupuestoActivoId : Number(presupuestoActivoId));

    if (updErr) throw new Error("Error al actualizar presupuesto: " + updErr.message);
  }

  // 4. Mapear códigos de los ítems a IDs reales de la tabla 'productos'
  // Si es NUEVO (o duplicado), procesamos TODOS los ítems (reseteando su estado a pendiente).
  // Si es EDICIÓN, solo procesamos los pendientes (los confirmados ya están en la DB y no se tocan).
  const esNuevo = !payload.presupuestoId;
  const itemsAProcesar = esNuevo
    ? payload.items  // Nuevo/duplicado: todos los ítems
    : payload.items.filter(i => (i as any).estadoItem !== 'confirmado'); // Edición: solo pendientes

  const codigos = itemsAProcesar.map((i: any) => i.codigo);
  let mapCodigos = new Map<string, number>();

  if (codigos.length > 0) {
    const { data: productos, error: prodErr } = await supabase
      .from('productos')
      .select('id, cod_unico')
      .in('cod_unico', codigos);

    if (!prodErr && productos) {
      mapCodigos = new Map(productos.map((p: any) => [p.cod_unico, p.id]));
    }
  }

  // 4b. Si el estado es 'confirmado', necesitamos crear un envío para estos ítems
  let nuevoEnvioId: string | null = null;
  if (payload.estado === 'confirmado' && codigos.length > 0) {
    const { data: enviosPrevios } = await supabase
      .from('presupuesto_envios')
      .select('numero_envio')
      .eq('presupuesto_id', presupuestoActivoId);

    const nextNum = (enviosPrevios?.length || 0) + 1;
    const codigoEnvio = `${codigoAUsar} / ENV-${String(nextNum).padStart(2, '0')}`;

    const { data: newEnvio, error: envErr } = await supabase
      .from('presupuesto_envios')
      .insert({
        presupuesto_id: presupuestoActivoId,
        numero_envio: nextNum,
        codigo_envio: codigoEnvio,
        usuario_nombre: payload.vendedorNombre || null
      })
      .select('id')
      .single();

    if (!envErr && newEnvio) {
      nuevoEnvioId = newEnvio.id;
    }
  }

  // 5. Guardar ítems pendientes (separando existentes de nuevos para evitar error de ID null)
  const itemsExistentes: any[] = []; // Tienen ID → update
  const itemsNuevos: any[] = [];     // No tienen ID → insert

  itemsAProcesar.forEach((item: any) => {
    const row: any = {
      presupuesto_id: presupuestoActivoId,
      producto_id: mapCodigos.get(item.codigo) || null,
      codigo: item.codigo,
      descripcion: item.descripcion,
      cantidad: Number(item.cantidad),
      precio_unitario: Number(item.precio),
      total_linea: Number(item.cantidad) * Number(item.precio),
      estado_item: payload.estado === 'confirmado' ? 'confirmado' : 'pendiente',
      envio_id: nuevoEnvioId
    };

    // Si estamos confirmando, resetear el estado de depósito para que depósito lo vea
    if (payload.estado === 'confirmado') {
      row.estado_deposito = 'pendiente';
    }

    // Solo reutilizar el ID si estamos editando un presupuesto existente
    if (!esNuevo && item.id) {
      row.id = isNaN(Number(item.id)) ? item.id : Number(item.id);
      itemsExistentes.push(row);
    } else {
      itemsNuevos.push(row);
    }
  });

  // 5a. Actualizar ítems existentes (preserva sus IDs y orden)
  if (itemsExistentes.length > 0) {
    const { error: updErr } = await supabase
      .from('presupuesto_items')
      .upsert(itemsExistentes);

    if (updErr) throw new Error("Error al actualizar ítems: " + updErr.message);
  }

  // 6. Eliminar ítems que fueron borrados en el editor (solo los pendientes y solo si es edición)
  // IMPORTANTE: Esto se ejecuta ANTES de insertar nuevos para no borrar los recién agregados
  if (payload.presupuestoId) {
    const idsAMantener = itemsExistentes.map(i => i.id);
    let queryDelete = supabase
      .from('presupuesto_items')
      .delete()
      .eq('presupuesto_id', isNaN(Number(presupuestoActivoId)) ? presupuestoActivoId : Number(presupuestoActivoId))
      .eq('estado_item', 'pendiente');

    if (idsAMantener.length > 0) {
      queryDelete = queryDelete.not('id', 'in', `(${idsAMantener.join(',')})`);
    }

    const { error: delErr } = await queryDelete;
    if (delErr) console.error("Error al limpiar ítems borrados:", delErr);
  }

  // 7. Insertar ítems nuevos DESPUÉS de la limpieza (Supabase genera el ID automáticamente)
  if (itemsNuevos.length > 0) {
    const { error: insErr } = await supabase
      .from('presupuesto_items')
      .insert(itemsNuevos);

    if (insErr) throw new Error("Error al insertar ítems nuevos: " + insErr.message);
  }

  return { ok: true, presupuestoId: presupuestoActivoId, codigoInterno: codigoAUsar };
}

export async function getPresupuestosSupabase(viewStatus?: string): Promise<PresupuestoCompleto[]> {
  let query = supabase
    .from('presupuestos')
    .select(`
      id,
      codigo_interno,
      created_at,
      estado,
      estado_deposito,
      total,
      observaciones,
      confirmado_en,
      vendedor_nombre,
      separador_nombre,
      clientes (
        nombre,
        telefono
      ),
      vehiculos (
        marca,
        modelo,
        chasis,
        patente,
        observaciones
      ),
      presupuesto_items (
        id,
        codigo,
        descripcion,
        cantidad,
        precio_unitario,
        estado_deposito,
        estado_item,
        envio_id,
        presupuesto_envios (
          codigo_envio,
          created_at
        ),
        productos (
          marcas (descripcion),
          stock,
          ubicaciones (descripcion)
        )
      )
    `);

  // Si estamos en la vista de confirmados, ordenamos primero por la fecha de confirmación.
  if (viewStatus === "confirmados") {
    query = query
      .order('confirmado_en', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error al obtener presupuestos de Supabase:", error);
    return [];
  }

  return data.map((row: any) => {
    return {
      id: String(row.id),
      codigo: row.codigo_interno,
      fecha: row.created_at,
      cliente: row.clientes?.nombre || "Sin Cliente",
      telefono: row.clientes?.telefono || "",
      referencia: row.vehiculos?.observaciones || "",
      marca: row.vehiculos?.marca || "",
      modelo: row.vehiculos?.modelo || "",
      chasis: row.vehiculos?.chasis || "",
      patente: row.vehiculos?.patente || "",
      total: Number(row.total),
      estado: row.estado as EstadoPresupuesto,
      estadoDeposito: row.estado_deposito || "sin_revisar",
      observaciones: row.observaciones || "",
      confirmadoAt: row.confirmado_en || undefined,
      vendedorNombre: row.vendedor_nombre,
      separadorNombre: row.separador_nombre,
      items: (row.presupuesto_items || [])
        .sort((a: any, b: any) => Number(a.id || 0) - Number(b.id || 0))
        .map((item: any) => {
          const prod = Array.isArray(item.productos) ? item.productos[0] : item.productos;
          const envio = Array.isArray(item.presupuesto_envios) ? item.presupuesto_envios[0] : item.presupuesto_envios;

          let ubicacionDesc = "-";
          let stockVal = 0;

          if (prod) {
            stockVal = Number(prod.stock) || 0;
            ubicacionDesc = prod.ubicaciones?.descripcion || "Sin Ubicación";
          }

          return {
            id: String(item.id),
            codigo: item.codigo,
            descripcion: item.descripcion,
            marca: prod?.marcas?.descripcion || "",
            cantidad: Number(item.cantidad),
            precio: Number(item.precio_unitario),
            stock: stockVal,
            ubicacion: ubicacionDesc,
            estadoDepositoItem: item.estado_deposito || "pendiente",
            estadoItem: item.estado_item || "pendiente",
            envioId: item.envio_id,
            codigoEnvio: envio?.codigo_envio || null,
            confirmadoAt: envio?.created_at || null
          };
        })
    } as PresupuestoCompleto;
  });
}

export async function actualizarEstadoPresupuestoSupabase(id: string, nuevoEstado: EstadoPresupuesto) {
  const patch: any = { estado: nuevoEstado };
  const safeId = isNaN(Number(id)) ? id : Number(id);

  if (nuevoEstado === 'confirmado') {
    patch.confirmado_en = new Date().toISOString();
  } else if (nuevoEstado === 'pendiente') {
    // REINICIO LIMPIO: Si vuelve a pendiente, se borran los estados de depósito
    patch.estado_deposito = 'sin_revisar';
    patch.confirmado_en = null;

    // Actualizar también los items vinculados de forma atómica
    const { error: itemsErr } = await supabase
      .from('presupuesto_items')
      .update({ estado_deposito: 'pendiente' })
      .eq('presupuesto_id', safeId);

    if (itemsErr) console.error("Error reseteando items:", itemsErr);
  }

  const { error } = await supabase
    .from('presupuestos')
    .update(patch)
    .eq('id', safeId);

  if (error) throw new Error("No se pudo actualizar el estado: " + error.message);
  return true;
}

export async function eliminarPresupuestoSupabase(id: string) {
  const safeId = isNaN(Number(id)) ? id : Number(id);
  const { error } = await supabase
    .from('presupuestos')
    .delete()
    .eq('id', safeId);

  if (error) throw new Error("No se pudo eliminar el presupuesto: " + error.message);
  return true;
}

export async function guardarRevisionDepositoSupabase(
  presupuestoId: string,
  idsShipment: string[],
  idsSeparados: string[],
  operarioNombre: string
) {
  const safeId = isNaN(Number(presupuestoId)) ? presupuestoId : Number(presupuestoId);

  // 1. Marcar los ítems del envío actual como 'no_encontrado' inicialmente
  await supabase
    .from('presupuesto_items')
    .update({ estado_deposito: 'no_encontrado' })
    .eq('presupuesto_id', safeId)
    .in('id', idsShipment.map(id => isNaN(Number(id)) ? id : Number(id)));

  // 2. Marcar los que sí se separaron dentro de este envío
  if (idsSeparados.length > 0) {
    await supabase.from('presupuesto_items')
      .update({ estado_deposito: 'separado' })
      .eq('presupuesto_id', safeId)
      .in('id', idsSeparados.map(id => isNaN(Number(id)) ? id : Number(id)));
  }

  // 3. Recalcular estado global del presupuesto (se mantiene igual, basándose en todos los items)
  const { data: currentItems } = await supabase.from('presupuesto_items').select('estado_deposito').eq('presupuesto_id', safeId);
  const estados = currentItems?.map((i: any) => i.estado_deposito) || [];

  let nuevoEstadoDeposito = 'sin_revisar';
  if (estados.length > 0 && estados.every((e: any) => e === 'separado')) nuevoEstadoDeposito = 'separado';
  else if (estados.some((e: any) => e === 'separado' || e === 'no_encontrado')) nuevoEstadoDeposito = 'con_faltante';

  const { error } = await supabase.from('presupuestos').update({
    estado_deposito: nuevoEstadoDeposito,
    separador_nombre: (nuevoEstadoDeposito === 'separado' || nuevoEstadoDeposito === 'con_faltante') ? operarioNombre : null
  }).eq('id', safeId);

  if (error) throw new Error("No se pudo guardar la revisión en la nube: " + error.message);

  return true;
}

export async function marcarTodoSeparadoDepositoSupabase(
  presupuestoId: string,
  operarioNombre: string,
  idsAMarcar?: string[]
) {
  const safeId = isNaN(Number(presupuestoId)) ? presupuestoId : Number(presupuestoId);

  let query = supabase
    .from('presupuesto_items')
    .update({ estado_deposito: 'separado' })
    .eq('presupuesto_id', safeId);

  if (idsAMarcar && idsAMarcar.length > 0) {
    query = query.in('id', idsAMarcar.map(id => isNaN(Number(id)) ? id : Number(id)));
  }

  const { error: err1 } = await query;
  if (err1) throw new Error("Error al marcar ítems: " + err1.message);

  // Verificamos si quedaron ítems sin separar para el estado general del presupuesto
  const { data: restantes } = await supabase
    .from('presupuesto_items')
    .select('id')
    .eq('presupuesto_id', safeId)
    .eq('estado_item', 'confirmado')
    .neq('estado_deposito', 'separado');

  const nuevoEstadoGral = (restantes?.length || 0) === 0 ? 'separado' : 'con_faltante';

  const { error: err2 } = await supabase.from('presupuestos').update({
    estado_deposito: nuevoEstadoGral,
    separador_nombre: operarioNombre
  }).eq('id', safeId);

  if (err2) throw new Error("Error al marcar presupuesto: " + err2.message);

  return true;
}

export async function representarPresupuestoEnPreparacionSupabase(id: string, operarioNombre: string, codigoEnvio?: string) {
  const safeId = isNaN(Number(id)) ? id : Number(id);

  let newSeparador = operarioNombre;

  if (codigoEnvio) {
    const { data } = await supabase.from('presupuestos').select('separador_nombre').eq('id', safeId).single();
    let currentEnvios: string[] = [];
    if (data?.separador_nombre && data.separador_nombre.includes('||')) {
      const parts = data.separador_nombre.split('||');
      newSeparador = parts[0];
      currentEnvios = parts[1].split(',').filter(Boolean);
    } else if (data?.separador_nombre) {
      newSeparador = data.separador_nombre;
    }

    if (!currentEnvios.includes(codigoEnvio)) {
      currentEnvios.push(codigoEnvio);
    }
    newSeparador = `${newSeparador}||${currentEnvios.join(',')}`;
  }

  const { error } = await supabase
    .from('presupuestos')
    .update({
      estado_deposito: 'en_preparacion',
      separador_nombre: newSeparador
    })
    .eq('id', safeId);

  if (error) {
    console.error("Error al iniciar preparación de depósito en Supabase:", error);
    return false;
  }
  return true;
}

/**
 * Confirma una selección parcial de ítems de un presupuesto.
 * Genera un registro de envío (envio_id) y actualiza el estado de los ítems.
 * También recalcula el estado general del presupuesto.
 */
export async function confirmarItemsParcialesSupabase(
  presupuestoId: string,
  idsItems: string[],
  usuarioNombre?: string
) {
  const pId = isNaN(Number(presupuestoId)) ? presupuestoId : Number(presupuestoId);

  // 1. Obtener datos básicos del presupuesto
  const { data: pres, error: presErr } = await supabase
    .from('presupuestos')
    .select('codigo_interno')
    .eq('id', pId)
    .single();

  if (presErr || !pres) throw new Error("No se encontró el presupuesto.");

  // 2. Determinar el siguiente número de envío
  const { data: enviosPrevios } = await supabase
    .from('presupuesto_envios')
    .select('numero_envio')
    .eq('presupuesto_id', pId);

  const nextNum = (enviosPrevios?.length || 0) + 1;
  const codigoEnvio = `${pres.codigo_interno} / ENV-${String(nextNum).padStart(2, '0')}`;

  // 3. Crear el registro de envío
  const { data: newEnvio, error: envErr } = await supabase
    .from('presupuesto_envios')
    .insert({
      presupuesto_id: pId,
      numero_envio: nextNum,
      codigo_envio: codigoEnvio,
      usuario_nombre: usuarioNombre || null
    })
    .select('id')
    .single();

  if (envErr) throw new Error("Error al crear registro de envío: " + envErr.message);
  // 4. Actualizar los ítems: marcarlos como confirmados, asignarles el envío
  // y resetear el estado de depósito a pendiente para que depósito los vea.
  const { error: itemsErr } = await supabase
    .from('presupuesto_items')
    .update({
      estado_item: 'confirmado',
      envio_id: newEnvio.id,
      estado_deposito: 'pendiente' // Reset para depósito
    })
    .eq('presupuesto_id', pId)
    .in('id', idsItems.map(id => isNaN(Number(id)) ? id : Number(id)));

  if (itemsErr) throw new Error("Error al confirmar ítems: " + itemsErr.message);

  // 5. Verificar si quedan ítems pendientes para actualizar el estado general
  const { data: itemsRestantes } = await supabase
    .from('presupuesto_items')
    .select('id')
    .eq('presupuesto_id', pId)
    .eq('estado_item', 'pendiente');

  const nuevoEstado = (itemsRestantes?.length || 0) === 0 ? 'cerrado' : 'pendiente';

  // Solo actualizamos confirmación y estado general, no reseteamos depósito para no perder prep en curso
  const { error: presUpdateErr } = await supabase
    .from('presupuestos')
    .update({
      estado: nuevoEstado,
      confirmado_en: new Date().toISOString()
    })
    .eq('id', pId);

  if (presUpdateErr) throw new Error("Error al actualizar presupuesto: " + presUpdateErr.message);

  return { ok: true, codigoEnvio };
}
