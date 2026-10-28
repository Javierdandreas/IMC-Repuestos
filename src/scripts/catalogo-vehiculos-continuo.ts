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

type ErrorConStatus = Error & { status?: number };

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
  return /connection terminated|connection error|econnreset|etimedout|fetch failed/i.test(message);
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

  // These imports happen after dotenv so the database pool receives the local environment.
  const [mercadolibreModule, databaseModule] = await Promise.all([
    import("@/lib/mercadolibre"),
    import("@/utils/database"),
  ]);
  // tsx can expose project modules through `default` when it evaluates the
  // TypeScript path aliases as CommonJS.
  const mercadolibreExports = mercadolibreModule as unknown as { default?: typeof import("@/lib/mercadolibre") };
  const databaseExports = databaseModule as unknown as { default?: typeof import("@/utils/database") };
  const { sincronizarCatalogoVehiculosMercadoLibre } = mercadolibreExports.default ?? mercadolibreModule;
  const { getPool } = databaseExports.default ?? databaseModule;

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
  console.log("Carga continua local iniciada. Ctrl+C la detiene sin perder el avance guardado.");

  try {
    while (!detener) {
      lote += 1;
      const inicio = Date.now();
      try {
        const resultado = await sincronizarCatalogoVehiculosMercadoLibre(false) as ResultadoCarga;
        reintentosConsecutivos = 0;
        console.log(
          `[${new Date().toLocaleTimeString("es-AR")}] Lote ${lote}: ${resultado.tareasProcesadas} tareas, ${resultado.vehiculosGenerados} vehiculos, ${resultado.rutasConsultadas} rutas, ${formatoDuracion(Date.now() - inicio)}. Pendientes: ${resultado.pendientes}; errores: ${resultado.errores}.`
        );

        if (resultado.completada) {
          console.log("Carga base completada.");
          break;
        }

        if (!resultado.pendientes && !resultado.procesando && resultado.errores > 0) {
          console.error(`La carga se detuvo: quedaron ${resultado.errores} tareas con error definitivo. Revisa la cola antes de reanudar.`);
          process.exitCode = 1;
          break;
        }

        await esperarDetenible(1_500);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido durante la carga.";
        if (!esErrorReintentable(error)) {
          console.error(`La carga se detuvo por un error no reintentable: ${message}`);
          process.exitCode = 1;
          break;
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
