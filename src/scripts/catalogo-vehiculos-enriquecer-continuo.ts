import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

type ResultadoEnriquecimiento = {
  completada: boolean;
  rutasConsultadas: number;
  tareasProcesadas: number;
  vehiculosGenerados: number;
  pendientes: number;
  procesando: number;
  errores: number;
};

type EstadoCatalogo = {
  tareas_enriquecimiento_pendientes: number;
  tareas_enriquecimiento_procesando: number;
  tareas_enriquecimiento_error: number;
};

type ErrorConStatus = Error & { status?: number };

const TIEMPO_MAXIMO_SOLICITUD_ML_MS = 75_000;
let detener = false;

function formatoDuracion(milisegundos: number) {
  const segundos = Math.max(0, Math.round(milisegundos / 1_000));
  return `${Math.floor(segundos / 60)}m ${segundos % 60}s`;
}

function esperar(milisegundos: number) {
  return new Promise((resolve) => setTimeout(resolve, milisegundos));
}

async function esperarDetenible(milisegundos: number) {
  const fin = Date.now() + milisegundos;
  while (!detener && Date.now() < fin) {
    await esperar(Math.min(1_000, fin - Date.now()));
  }
}

function esErrorReintentable(error: unknown) {
  const status = Number((error as ErrorConStatus)?.status ?? 0);
  if ([429, 500, 502, 503, 504].includes(status)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /connection terminated|connection error|econnreset|etimedout|fetch failed|solicitud.*supero|abort/i.test(message);
}

function instalarTiempoMaximoFetch() {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const controller = new AbortController();
    const requestSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const abortarSolicitudOriginal = () => controller.abort(requestSignal?.reason);
    if (requestSignal?.aborted) abortarSolicitudOriginal();
    else requestSignal?.addEventListener("abort", abortarSolicitudOriginal, { once: true });

    const timer = setTimeout(() => {
      controller.abort(new Error(`La solicitud a Mercado Libre supero ${TIEMPO_MAXIMO_SOLICITUD_ML_MS / 1_000} segundos.`));
    }, TIEMPO_MAXIMO_SOLICITUD_ML_MS);

    try {
      return await fetchOriginal(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      requestSignal?.removeEventListener("abort", abortarSolicitudOriginal);
    }
  };
}

function obtenerFuncionExportada<T extends (...args: never[]) => unknown>(modulo: unknown, nombre: string): T | null {
  const base = modulo as Record<string, unknown>;
  const candidatos = [base, base.default, base["module.exports"]]
    .filter((candidate): candidate is Record<string, unknown> => Boolean(candidate) && typeof candidate === "object");
  for (const candidato of candidatos) {
    const funcion = candidato[nombre];
    if (typeof funcion === "function") return funcion as T;
  }
  return null;
}

async function main() {
  instalarTiempoMaximoFetch();

  // Import after dotenv so the database pool uses the local environment.
  const [mercadolibreModule, databaseModule, catalogoModule] = await Promise.all([
    import("@/lib/mercadolibre"),
    import("@/utils/database"),
    import("@/lib/catalogo-vehiculos-mercadolibre"),
  ]);
  const enriquecer = obtenerFuncionExportada<() => Promise<ResultadoEnriquecimiento>>(
    mercadolibreModule,
    "enriquecerCatalogoVehiculosMercadoLibre"
  );
  const getPool = obtenerFuncionExportada<() => { end: () => Promise<void> }>(databaseModule, "getPool");
  const obtenerEstado = obtenerFuncionExportada<() => Promise<EstadoCatalogo>>(
    catalogoModule,
    "estadoCatalogoVehiculosMercadoLibre"
  );
  if (!enriquecer || !getPool || !obtenerEstado) {
    throw new Error("No se pudieron cargar las dependencias locales del enriquecimiento continuo.");
  }

  const solicitarDetencion = (signal: string) => {
    if (detener) {
      console.log(`\n${signal}: cierre forzado.`);
      process.exit(130);
    }
    detener = true;
    console.log(`\n${signal}: se detendra al finalizar el lote actual.`);
  };
  process.on("SIGINT", () => solicitarDetencion("Ctrl+C"));
  process.on("SIGTERM", () => solicitarDetencion("SIGTERM"));

  let lote = 0;
  let reintentosConsecutivos = 0;
  let enEspera = false;
  let ultimoAvisoEspera = 0;
  console.log("Enriquecimiento continuo local iniciado. Permanecera activo y Ctrl+C lo detiene sin perder el avance guardado.");

  try {
    while (!detener) {
      if (enEspera) {
        const estado = await obtenerEstado();
        const pendientes = estado.tareas_enriquecimiento_pendientes;
        const procesando = estado.tareas_enriquecimiento_procesando;
        if (!pendientes && !procesando) {
          if (Date.now() - ultimoAvisoEspera >= 5 * 60_000) {
            const detalleError = estado.tareas_enriquecimiento_error ? ` Hay ${estado.tareas_enriquecimiento_error} tareas con error definitivo.` : "";
            console.log(`[${new Date().toLocaleTimeString("es-AR")}] Sin tareas de enriquecimiento pendientes. Sigue activo y revisara de nuevo en un minuto.${detalleError}`);
            ultimoAvisoEspera = Date.now();
          }
          await esperarDetenible(60_000);
          continue;
        }
        enEspera = false;
        console.log(`[${new Date().toLocaleTimeString("es-AR")}] Detectadas ${pendientes} tareas de enriquecimiento pendientes. Reanudando carga.`);
      }

      lote += 1;
      const inicio = Date.now();
      console.log(`[${new Date().toLocaleTimeString("es-AR")}] Lote ${lote}: iniciando.`);
      try {
        const resultado = await enriquecer();
        reintentosConsecutivos = 0;
        console.log(
          `[${new Date().toLocaleTimeString("es-AR")}] Lote ${lote}: ${resultado.tareasProcesadas} tareas, ${resultado.vehiculosGenerados} vehiculos detallados, ${resultado.rutasConsultadas} rutas, ${formatoDuracion(Date.now() - inicio)}. Pendientes: ${resultado.pendientes}; errores: ${resultado.errores}.`
        );

        if (resultado.completada) {
          console.log("Enriquecimiento completado. Queda activo a la espera de tareas nuevas.");
          enEspera = true;
          continue;
        }

        if (!resultado.pendientes && !resultado.procesando && resultado.errores > 0) {
          console.error(`Quedaron ${resultado.errores} tareas con error definitivo. Sigue activo y reanudara si se agregan o reinician tareas.`);
          enEspera = true;
          continue;
        }

        await esperarDetenible(1_500);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido durante el enriquecimiento.";
        if (!esErrorReintentable(error)) {
          console.error(`Error no reintentable: ${message}. El proceso sigue activo y volvera a probar en cinco minutos.`);
          await esperarDetenible(5 * 60_000);
          continue;
        }

        reintentosConsecutivos += 1;
        const status = Number((error as ErrorConStatus)?.status ?? 0);
        const esperaMs = status === 429 ? 60_000 : Math.min(60_000, 5_000 * 2 ** Math.min(reintentosConsecutivos - 1, 3));
        console.warn(`Lote ${lote}: ${message}. Reintento en ${formatoDuracion(esperaMs)}.`);
        await esperarDetenible(esperaMs);
      }
    }
  } finally {
    await getPool().end();
  }

  console.log("Enriquecimiento continuo detenido. El avance ya procesado quedo guardado.");
}

void main().catch((error) => {
  console.error("No se pudo iniciar el enriquecimiento continuo:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
