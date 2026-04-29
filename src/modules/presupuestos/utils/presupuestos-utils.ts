import type { PresupuestoCompleto, EstadoPresupuesto } from "../types/presupuesto";

export function getTheme(status: "confirmados" | "pendientes" | "general") {
  if (status === "confirmados") {
    return {
      titleIconBg: "bg-[var(--color-success-bg)]",
      titleIconText: "text-[var(--color-success)]",
      newButtonBg: "bg-[var(--color-success)] hover:opacity-90",
      filterActive: "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]",
      estadoBadge: "bg-[#e8f7ec] text-[#22814a]",
      pageActive: "bg-[var(--color-success)] text-white",
    };
  }

  if (status === "pendientes") {
    return {
      titleIconBg: "bg-[var(--color-warning-bg)]",
      titleIconText: "text-[var(--color-warning)]",
      newButtonBg: "bg-[var(--color-warning)] hover:opacity-90",
      filterActive: "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning)]",
      estadoBadge: "bg-[#fff2cc] text-[#9a6b00]",
      pageActive: "bg-[var(--color-warning)] text-white",
    };
  }

  return {
    titleIconBg: "bg-[var(--color-info-bg)]",
    titleIconText: "text-[var(--color-info)]",
    newButtonBg: "bg-[var(--color-info)] hover:opacity-90",
    filterActive: "bg-[var(--color-info-bg)] text-[var(--color-info)] border border-[var(--color-info)]",
    estadoBadge: "bg-[#e8f0ff] text-[#3f62a8]",
    pageActive: "bg-[var(--color-info)] text-white",
  };
}

export function formatearFecha(fechaISO: string) {
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return fechaISO;
  return fecha.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatearMoneda(valor: number) {
  return `$${valor.toLocaleString("es-AR")}`;
}

export function splitUbicacionParts(value: string) {
  return value
    .toUpperCase()
    .replace(/\./g, "-")
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .map((part) => {
      const num = Number(part);
      return Number.isFinite(num) && part !== "" ? num : part;
    });
}

export function compareUbicacionesAsc(a: string, b: string) {
  const partsA = splitUbicacionParts(a || "");
  const partsB = splitUbicacionParts(b || "");
  const max = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < max; i += 1) {
    const valueA = partsA[i];
    const valueB = partsB[i];
    if (valueA === undefined) return -1;
    if (valueB === undefined) return 1;
    if (typeof valueA === "string" && typeof valueB === "string") {
      const result = valueA.localeCompare(valueB, "es", { numeric: true });
      if (result !== 0) return result;
      continue;
    }
    if (typeof valueA === "number" && typeof valueB === "number") {
      if (valueA !== valueB) return valueA - valueB;
      continue;
    }
    if (typeof valueA === "string" && typeof valueB === "number") return -1;
    if (typeof valueA === "number" && typeof valueB === "string") return 1;
  }
  return 0;
}

export function estadoTextoDesdeRaw(estado: EstadoPresupuesto, items?: { estadoItem?: string }[]) {
  if (estado === "cerrado") return "Cerrado";
  if (estado === "confirmado") return "Confirmado";
  if (estado === "pendiente" && items && items.some(i => i.estadoItem === "confirmado")) {
    return "Parcial";
  }
  return "Pendiente";
}

export function estadoDepositoTexto(
  estadoDeposito?: "sin_revisar" | "en_preparacion" | "separado" | "con_faltante"
) {
  if (estadoDeposito === "en_preparacion") return "En preparación";
  if (estadoDeposito === "separado") return "Separado";
  if (estadoDeposito === "con_faltante") return "Con faltantes";
  return "—";
}

export const expandirPorEnvios = (
  presupuestos: PresupuestoCompleto[],
  incluirPadres = false
): PresupuestoCompleto[] => {
  const expanded: PresupuestoCompleto[] = [];
  presupuestos.forEach((p) => {
    if (incluirPadres) expanded.push(p);
    const codigosEnvio = Array.from(new Set(
      p.items
        .filter(item => item.estadoItem === "confirmado" && item.codigoEnvio)
        .map(item => item.codigoEnvio as string)
    )).sort();
    const itemsSinEnvio = p.items.filter(item => item.estadoItem === "confirmado" && !item.codigoEnvio);
    if (codigosEnvio.length > 0) {
      codigosEnvio.forEach((codEnvio) => {
        const itemsDelEnvio = p.items.filter(i => i.codigoEnvio === codEnvio);
        const itemsSeparados = itemsDelEnvio.filter(i => i.estadoDepositoItem === 'separado').length;
        const itemsNoEncontrados = itemsDelEnvio.filter(i => i.estadoDepositoItem === 'no_encontrado').length;
        const totalItemsEnvio = itemsDelEnvio.length;
        const virtualTotal = itemsDelEnvio.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
        let virtualEstadoDeposito = "sin_revisar";
        if (totalItemsEnvio > 0) {
          if (itemsSeparados === totalItemsEnvio) virtualEstadoDeposito = 'separado';
          else if (itemsSeparados + itemsNoEncontrados === totalItemsEnvio) virtualEstadoDeposito = 'con_faltante';
          else if (itemsSeparados > 0 || itemsNoEncontrados > 0) virtualEstadoDeposito = 'en_preparacion';
          else if (p.estadoDeposito === 'en_preparacion') {
            const nombre = p.separadorNombre || "";
            if (nombre.includes('||')) {
              const enviosEnPrep = nombre.split('||')[1].split(',');
              if (enviosEnPrep.includes(codEnvio)) virtualEstadoDeposito = 'en_preparacion';
            } else {
              virtualEstadoDeposito = 'en_preparacion';
            }
          }
        }
        const cleanSeparadorNombre = p.separadorNombre?.includes('||') ? p.separadorNombre.split('||')[0] : p.separadorNombre;
        expanded.push({
          ...p,
          id: `${p.id}-${codEnvio}`,
          codigo: codEnvio,
          total: virtualTotal,
          items: itemsDelEnvio,
          estadoDeposito: virtualEstadoDeposito as any,
          confirmadoAt: itemsDelEnvio[0]?.confirmadoAt || p.confirmadoAt,
          separadorNombre: cleanSeparadorNombre,
          _originalId: p.id
        } as any);
      });
    }
    if (!incluirPadres) {
      const tieneItemsConfirmadosSinEnvio = itemsSinEnvio.length > 0;
      const esConfirmadoSinEnvios = (p.estado === "confirmado" || p.estado === "cerrado") && codigosEnvio.length === 0;
      if (tieneItemsConfirmadosSinEnvio || esConfirmadoSinEnvios) {
        const itemsAMostrar = tieneItemsConfirmadosSinEnvio ? itemsSinEnvio : (p.items.filter(i => i.estadoItem === "confirmado").length > 0 ? p.items.filter(i => i.estadoItem === "confirmado") : p.items);
        const virtualTotal = itemsAMostrar.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
        expanded.push({
          ...p,
          id: `${p.id}-CONF-BASE`,
          total: tieneItemsConfirmadosSinEnvio ? virtualTotal : p.total,
          items: itemsAMostrar,
          separadorNombre: p.separadorNombre?.includes('||') ? p.separadorNombre.split('||')[0] : p.separadorNombre,
          _originalId: p.id
        } as any);
      }
    }
  });
  return expanded.sort((a, b) => {
    const timeA = a.confirmadoAt ? new Date(a.confirmadoAt).getTime() : 0;
    const timeB = b.confirmadoAt ? new Date(b.confirmadoAt).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;
    return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
  });
};

export function filtrarPorStatus(
  presupuestos: PresupuestoCompleto[],
  status: "confirmados" | "pendientes" | "general"
): PresupuestoCompleto[] {
  if (status === "confirmados") {
    const conConfirmados = presupuestos.filter((p) =>
      p.estado === "confirmado" || p.estado === "cerrado" || p.items.some(item => item.estadoItem === "confirmado")
    );
    return expandirPorEnvios(conConfirmados);
  }
  if (status === "pendientes") return presupuestos.filter((p) => p.estado === "pendiente");
  return presupuestos;
}
export function getDetalleRowBackground(itemId: string, status: string, checkedItems: string[], estadoDepositoItem?: string) {
  const checked = checkedItems.includes(itemId);

  // Prioridad 1: Si está seleccionado por el usuario
  if (checked) return "bg-[#e0f2fe]";

  // Prioridad 2: Si ya está en la base de datos con un estado final
  if (status === "confirmados") {
    if (estadoDepositoItem === "separado") return "bg-[#f0fdf4]";
    if (estadoDepositoItem === "no_encontrado") return "bg-[#fff1f2]";
  }

  return "";
}

