import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

type ResultadoCarga = {
  completada: boolean;
  rutasConsultadas: number;
  tareasProcesadas: number;
  vehiculosGenerados: number;
  pendientes: number;
  procesando: number;
  errores: number;
};

type EstadoCatalogo = {
  tareas_pendientes: number;
  tareas_procesando: number;
  tareas_error: number;
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

function mostrarAyuda() {
  console.log("Uso: npm run catalogo:continuo");
  console.log("Procesa la carga base de vehiculos hasta terminar, detenerse con Ctrl+C o encontrar errores definitivos.");
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    mostrarAyuda();
    return;
  }

  instalarTiempoMaximoFetch();

  // These imports happen after dotenv so the database pool receives the local environment.
  const [mercadolibreModule, databaseModule, catalogoModule] = await Promise.all([
    import("@/lib/mercadolibre"),
    import("@/utils/database"),
    import("@/lib/catalogo-vehiculos-mercadolibre"),
  ]);
  // tsx can expose project modules through `default` or `module.exports`
  // when it evaluates the TypeScript path aliases as CommonJS.
  const sincronizarCatalogoVehiculosMercadoLibre = obtenerFuncionExportada<(reiniciar?: boolean) => Promise<ResultadoCarga>>(
    mercadolibreModule,
    "sincronizarCatalogoVehiculosMercadoLibre"
  );
  const getPool = obtenerFuncionExportada<() => { end: () => Promise<void> }>(databaseModule, "getPool");
  const estadoCatalogoVehiculosMercadoLibre = obtenerFuncionExportada<() => Promise<EstadoCatalogo>>(
    catalogoModule,
    "estadoCatalogoVehiculosMercadoLibre"
  );
  if (!sincronizarCatalogoVehiculosMercadoLibre || !getPool || !estadoCatalogoVehiculosMercadoLibre) {
    throw new Error("No se pudieron cargar las dependencias locales de la carga continua.");
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
  console.log("Carga continua local iniciada. Permanecera activa y Ctrl+C la detiene sin perder el avance guardado.");

  try {
    while (!detener) {
      if (enEspera) {
        const estado = await estadoCatalogoVehiculosMercadoLibre();
        if (!estado.tareas_pendientes && !estado.tareas_procesando) {
          if (Date.now() - ultimoAvisoEspera >= 5 * 60_000) {
            const detalleError = estado.tareas_error ? ` Hay ${estado.tareas_error} tareas con error definitivo.` : "";
            console.log(`[${new Date().toLocaleTimeString("es-AR")}] Sin tareas pendientes. Sigue activo y revisara de nuevo en un minuto.${detalleError}`);
            ultimoAvisoEspera = Date.now();
          }
          await esperarDetenible(60_000);
          continue;
        }
        enEspera = false;
        console.log(`[${new Date().toLocaleTimeString("es-AR")}] Detectadas ${estado.tareas_pendientes} tareas pendientes. Reanudando carga.`);
      }

      lote += 1;
      const inicio = Date.now();
      console.log(`[${new Date().toLocaleTimeString("es-AR")}] Lote ${lote}: iniciando.`);
      try {
        const resultado = await sincronizarCatalogoVehiculosMercadoLibre(false) as ResultadoCarga;
        reintentosConsecutivos = 0;
        console.log(
          `[${new Date().toLocaleTimeString("es-AR")}] Lote ${lote}: ${resultado.tareasProcesadas} tareas, ${resultado.vehiculosGenerados} vehiculos, ${resultado.rutasConsultadas} rutas, ${formatoDuracion(Date.now() - inicio)}. Pendientes: ${resultado.pendientes}; errores: ${resultado.errores}.`
        );

        if (resultado.completada) {
          console.log("Carga base completada. Queda activo a la espera de tareas nuevas.");
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
        const message = error instanceof Error ? error.message : "Error desconocido durante la carga.";
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

  if (detener) console.log("Carga continua detenida. El avance ya procesado quedo guardado.");
}

void main().catch((error) => {
  console.error("No se pudo iniciar la carga continua:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
