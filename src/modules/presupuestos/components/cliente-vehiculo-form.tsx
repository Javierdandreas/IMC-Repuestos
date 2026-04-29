"use client";
import { useMemo, useState, useEffect } from "react";
import { CarFront, Check, Lock, Search, Loader2 } from "lucide-react";
import {
  CLIENTE_STORAGE_KEY,
  isChasisValido,
  normalizarChasis,
} from "../repos/presupuestos-storage";
import { buscarClientesSupabase, type ClienteSupabase } from "../../clientes";
import { buscarMarcasSugeridas, buscarModelosSugeridos, procesarImagenCedula } from "../../vehiculos";
import { usePermissions } from "@/modules/auth/components/usePermissions";

export type ClienteVehiculoData = {
  cliente: string;
  telefono: string;
  referencia: string;
  marca: string;
  modelo: string;
  chasis: string;
  patente: string;
};

export const initialClienteVehiculoData: ClienteVehiculoData = {
  cliente: "",
  telefono: "",
  referencia: "",
  marca: "",
  modelo: "",
  chasis: "",
  patente: "",
};

type Props = {
  value?: ClienteVehiculoData;
  onChange?: (data: ClienteVehiculoData) => void;
  onPermissionDenied?: () => void;
  onSave?: () => void;
};

export function ClienteVehiculoForm({
  value,
  onChange,
  onPermissionDenied,
  onSave,
}: Props) {
  const { hasAnyPermission } = usePermissions();
  const [guardado, setGuardado] = useState(false);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [sugerencias, setSugerencias] = useState<ClienteSupabase[]>([]);
  const [buscando, setBuscando] = useState(false);

  // States para sugerencias oficiales de vehículos
  const [marcasSugeridas, setMarcasSugeridas] = useState<string[]>([]);
  const [modelosSugeridos, setModelosSugeridos] = useState<string[]>([]);
  const [mostrarMarcas, setMostrarMarcas] = useState(false);
  const [mostrarModelos, setMostrarModelos] = useState(false);
  const [buscandoMarcas, setBuscandoMarcas] = useState(false);
  const [buscandoModelos, setBuscandoModelos] = useState(false);
  const [consultandoVIN, setConsultandoVIN] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const form: ClienteVehiculoData = value ?? initialClienteVehiculoData;
  const puedeGuardarDatosClienteVehiculo = hasAnyPermission([
    "presupuestos.crear",
    "presupuestos.editar",
    "clientes.crear",
    "clientes.editar",
    "vehiculos.crear",
    "vehiculos.editar",
  ]);

  const chasisNormalizado = useMemo(() => {
    return normalizarChasis(form.chasis);
  }, [form.chasis]);

  const mostrarErrorChasis =
    chasisNormalizado.length > 0 && !isChasisValido(chasisNormalizado);

  // Efecto para buscar clientes cuando el nombre cambia
  useEffect(() => {
    const term = form.cliente.trim();
    if (term.length < 2) {
      setSugerencias([]);
      return;
    }

    const timer = setTimeout(async () => {
      setBuscando(true);
      const data = await buscarClientesSupabase(term);
      setSugerencias(data);
      setBuscando(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [form.cliente]);

  // Efecto para buscar marcas oficiales
  useEffect(() => {
    const term = form.marca.trim();
    if (term.length < 2) {
      setMarcasSugeridas([]);
      return;
    }

    const timer = setTimeout(async () => {
      setBuscandoMarcas(true);
      const data = await buscarMarcasSugeridas(term);
      setMarcasSugeridas(data);
      setBuscandoMarcas(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [form.marca]);

  // Efecto para buscar modelos oficiales de la marca seleccionada
  useEffect(() => {
    const term = form.modelo.trim();
    // Si no hay marca, no buscamos modelos
    if (!form.marca) {
      setModelosSugeridos([]);
      return;
    }

    const timer = setTimeout(async () => {
      setBuscandoModelos(true);
      const data = await buscarModelosSugeridos(form.marca, term);
      setModelosSugeridos(data);
      setBuscandoModelos(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [form.modelo, form.marca]);

  const actualizarFormulario = (next: ClienteVehiculoData) => {
    setGuardado(false);

    if (onChange) {
      onChange(next);
    }
  };

  const updateField =
    (field: keyof ClienteVehiculoData) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;

        actualizarFormulario({
          ...form,
          [field]:
            field === "telefono" || field === "chasis"
              ? raw.toUpperCase() // Chasis ya viene normalizado, pero forzamos por las dudas
              : raw.toUpperCase(), // Todo a mayúsculas como pidió el usuario
        });
      };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field?: keyof ClienteVehiculoData) => {
    if (e.key === "Enter") {
      e.preventDefault();

      // Selección rápida con Enter si hay sugerencias abiertas
      if (field === "cliente" && sugerencias.length > 0 && mostrarSugerencias) {
        seleccionarCliente(sugerencias[0]);
        return;
      }
      if (field === "marca" && marcasSugeridas.length > 0 && mostrarMarcas) {
        seleccionarMarca(marcasSugeridas[0]);
        return;
      }
      if (field === "modelo" && modelosSugeridos.length > 0 && mostrarModelos) {
        seleccionarModelo(modelosSugeridos[0]);
        return;
      }

      const formElement = e.currentTarget.closest("section");
      if (!formElement) return;

      const inputs = Array.from(formElement.querySelectorAll("input:not([disabled])")) as HTMLInputElement[];
      const index = inputs.indexOf(e.currentTarget);
      if (index > -1 && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    }
  };

  const seleccionarCliente = (c: ClienteSupabase) => {
    actualizarFormulario({
      ...form,
      cliente: c.nombre.toUpperCase(),
      telefono: (c.telefono || "").toUpperCase(),
      referencia: (c.documento || "").toUpperCase(),
    });
    setMostrarSugerencias(false);
  };

  const seleccionarMarca = (m: string) => {
    actualizarFormulario({
      ...form,
      marca: m.toUpperCase(),
      modelo: "", // Limpiamos modelo al cambiar marca para forzar nueva búsqueda
    });
    setMostrarMarcas(false);
    // Movemos el foco al siguiente campo
    setTimeout(() => {
      const el = document.querySelector('input[placeholder="Modelo"]') as HTMLInputElement;
      el?.focus();
    }, 10);
  };

  const seleccionarModelo = (m: string) => {
    actualizarFormulario({
      ...form,
      modelo: m.toUpperCase(),
    });
    setMostrarModelos(false);
    // Movemos el foco al siguiente campo (Chasis)
    setTimeout(() => {
      const el = document.querySelector('input[placeholder="17 caracteres alfanuméricos"]') as HTMLInputElement;
      el?.focus();
    }, 10);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  };

  const handleFile = async (file: File) => {
    setEscaneando(true);
    try {
      const data = await procesarImagenCedula(file);
      if (data) {
        actualizarFormulario({
          ...form,
          patente: data.patente || form.patente,
          marca: data.marca || form.marca,
          modelo: data.modelo || form.modelo,
          chasis: data.chasis || form.chasis,
        });
      }
    } catch (error) {
      console.error("Error al procesar cédula:", error);
    } finally {
      setEscaneando(false);
    }
  };

  const guardarDatos = () => {
    if (!puedeGuardarDatosClienteVehiculo) {
      if (onPermissionDenied) onPermissionDenied();
      return;
    }

    try {
      localStorage.setItem(
        CLIENTE_STORAGE_KEY,
        JSON.stringify({
          ...form,
          chasis: chasisNormalizado,
          patente: form.patente.toUpperCase(),
        })
      );

      setGuardado(true);

      if (onSave) {
        onSave();
      }

      window.setTimeout(() => {
        setGuardado(false);
      }, 2200);
    } catch (error) {
      console.error("Error al guardar datos de cliente/referencia:", error);
      window.alert("No se pudieron guardar los datos localmente.");
    }
  };

  return (
    <section
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      className={`relative rounded-2xl border transition-all duration-300 p-6 shadow-sm ${dragActive
        ? "border-[#5f89d8] bg-[#f0f7ff] ring-4 ring-[#5f89d8]/10 scale-[1.01]"
        : "border-[var(--border-light)] bg-[var(--bg-card)]"
        }`}
    >
      {/* Animación de escaneo profesional */}
      {escaneando && (
        <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden rounded-2xl" style={{ background: 'rgba(10, 20, 50, 0.82)', backdropFilter: 'blur(6px)' }}>
          {/* Grid de fondo estilo IA */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(95,137,216,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(95,137,216,0.5) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

          <div className="relative flex flex-col items-center gap-5">
            {/* Marco del documento con esquinas animadas */}
            <div className="relative" style={{ width: 220, height: 140 }}>
              {/* Esquinas animadas */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[#5f89d8] rounded-tl" style={{ animation: 'cornerPulse 1.5s ease-in-out infinite' }} />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-[#5f89d8] rounded-tr" style={{ animation: 'cornerPulse 1.5s ease-in-out infinite 0.2s' }} />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-[#5f89d8] rounded-bl" style={{ animation: 'cornerPulse 1.5s ease-in-out infinite 0.4s' }} />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[#5f89d8] rounded-br" style={{ animation: 'cornerPulse 1.5s ease-in-out infinite 0.6s' }} />

              {/* Área central simulando el documento */}
              <div className="absolute inset-3 rounded opacity-20 bg-[#5f89d8]" />

              {/* Línea de escaneo laser */}
              <div className="absolute left-3 right-3 h-[2px] rounded-full" style={{
                background: 'linear-gradient(90deg, transparent, #5f89d8, #a5c1f5, #5f89d8, transparent)',
                boxShadow: '0 0 12px 3px rgba(95,137,216,0.8)',
                animation: 'scanLine 2s ease-in-out infinite',
                top: '12px',
              }} />

              {/* Puntos de datos detectados */}
              {[{ x: '20%', y: '30%' }, { x: '60%', y: '50%' }, { x: '35%', y: '70%' }, { x: '75%', y: '25%' }].map((pos, i) => (
                <div key={i} className="absolute w-1.5 h-1.5 rounded-full bg-[#5f89d8]" style={{
                  left: pos.x, top: pos.y,
                  boxShadow: '0 0 6px 2px rgba(95,137,216,0.9)',
                  animation: `dotBlink 1s ease-in-out infinite ${i * 0.3}s`
                }} />
              ))}
            </div>

            {/* Barra de progreso indeterminada */}
            <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{
                background: 'linear-gradient(90deg, transparent, #5f89d8, #a5c1f5, transparent)',
                animation: 'progressBar 1.8s ease-in-out infinite',
                width: '60%',
              }} />
            </div>

            {/* Texto de estado */}
            <div className="text-center">
              <p className="text-[13px] font-bold tracking-widest text-[#5f89d8] uppercase" style={{ animation: 'textPulse 2s ease-in-out infinite' }}>
                ANALIZANDO...
              </p>
            </div>
          </div>

          <style>{`
            @keyframes scanLine {
              0% { top: 12px; opacity: 1; }
              48% { top: calc(100% - 12px); opacity: 1; }
              50% { top: calc(100% - 12px); opacity: 0; }
              52% { top: 12px; opacity: 0; }
              54% { top: 12px; opacity: 1; }
              100% { top: 12px; opacity: 1; }
            }
            @keyframes cornerPulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.3; }
            }
            @keyframes dotBlink {
              0%, 100% { opacity: 0; transform: scale(0.5); }
              50% { opacity: 1; transform: scale(1.2); }
            }
            @keyframes progressBar {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(280%); }
            }
            @keyframes textPulse {
              0%, 100% { opacity: 1; letter-spacing: 0.15em; }
              50% { opacity: 0.6; letter-spacing: 0.25em; }
            }
          `}</style>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#184b9b] text-white">
          <Lock className="h-4 w-4" />
        </div>

        <h2 className="text-[20px] font-bold text-[#243b63]">
          Cliente y Vehículo
        </h2>

        <div className="ml-2 h-px flex-1 bg-[#e5e7eb]" />

        <button
          type="button"
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleFile(file);
            };
            input.click();
          }}
          className="flex items-center gap-2 rounded-xl bg-[#f1f5f9] px-4 py-2 text-[13px] font-bold text-[#475569] transition hover:bg-[#e2e8f0]"
        >
          <CarFront className="h-4 w-4" />
          ESCANEAR CÉDULA
        </button>
      </div>

      <div className="mb-6 flex items-center gap-3 rounded-xl bg-[#f8fafc] p-3 text-[13px] text-[#64748b]">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#5f89d8]/10 text-[#5f89d8]">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span><strong>Tip:</strong> Puedes arrastrar la foto de la cédula directamente desde <strong>WhatsApp Web</strong> aquí para completar todo automáticamente.</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Cliente con Sugerencias */}
        <div className="relative">
          <div className="relative">
            <input
              value={form.cliente}
              onChange={updateField("cliente")}
              onKeyDown={(e) => handleKeyDown(e, "cliente")}
              onFocus={() => setMostrarSugerencias(true)}
              onBlur={() => {
                window.setTimeout(() => {
                  setMostrarSugerencias(false);
                }, 200);
              }}
              className="h-[46px] w-full rounded-2xl border border-[#d7dce5] bg-white px-4 pr-10 text-[15px] text-[#374151] outline-none focus:border-[#5f89d8]"
              placeholder="Cliente"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {buscando ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#94a3b8]" />
              ) : (
                <Search className="h-4 w-4 text-[#94a3b8]" />
              )}
            </div>
          </div>

          {mostrarSugerencias && sugerencias.length > 0 && (
            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-lg">
              {sugerencias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => seleccionarCliente(c)}
                  className="block w-full border-b border-[#f1f5f9] px-4 py-3 text-left transition last:border-b-0 hover:bg-[#f8fafc]"
                >
                  <div className="text-[14px] font-medium text-[#334155]">{c.nombre}</div>
                  {c.documento && (
                    <div className="text-[12px] text-[#64748b]">DNI/CUIT: {c.documento}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* DNI / CUIT */}
        <input
          value={form.referencia}
          onChange={updateField("referencia")}
          onKeyDown={(e) => handleKeyDown(e)}
          className="h-[46px] w-full rounded-2xl border border-[#d7dce5] bg-white px-4 text-[15px] text-[#374151] outline-none focus:border-[#5f89d8]"
          placeholder="DNI / CUIT"
        />

        {/* Teléfono */}
        <input
          value={form.telefono}
          onChange={updateField("telefono")}
          onKeyDown={(e) => handleKeyDown(e)}
          className="h-[46px] w-full rounded-2xl border border-[#d7dce5] bg-white px-4 text-[15px] text-[#374151] outline-none focus:border-[#5f89d8]"
          placeholder="Teléfono"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div>
          <label className="mb-2 block text-[15px] font-semibold text-[#374151]">
            Marca
          </label>
          <div className="relative">
            <input
              value={form.marca}
              onChange={updateField("marca")}
              onKeyDown={(e) => handleKeyDown(e, "marca")}
              onFocus={() => setMostrarMarcas(true)}
              onBlur={() => {
                setTimeout(() => setMostrarMarcas(false), 200);
              }}
              className="h-[44px] w-full rounded-2xl border border-[#d7dce5] bg-white px-4 text-[15px] text-[#374151] outline-none focus:border-[#5f89d8]"
              placeholder="Marca"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {buscandoMarcas && <Loader2 className="h-3 w-3 animate-spin text-[#94a3b8]" />}
            </div>

            {mostrarMarcas && marcasSugeridas.length > 0 && (
              <div className="absolute z-20 mt-2 w-full max-h-[200px] overflow-y-auto rounded-2xl border border-[#e5e7eb] bg-white shadow-lg">
                {marcasSugeridas.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => seleccionarMarca(m)}
                    className="block w-full border-b border-[#f1f5f9] px-4 py-2.5 text-left transition last:border-b-0 hover:bg-[#f8fafc]"
                  >
                    <div className="text-[13px] font-medium text-[#334155]">{m}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[15px] font-semibold text-[#374151]">
            Modelo
          </label>
          <div className="relative">
            <input
              value={form.modelo}
              onChange={updateField("modelo")}
              onKeyDown={(e) => handleKeyDown(e, "modelo")}
              onFocus={() => setMostrarModelos(true)}
              onBlur={() => {
                setTimeout(() => setMostrarModelos(false), 200);
              }}
              className="h-[44px] w-full rounded-2xl border border-[#d7dce5] bg-white px-4 text-[15px] text-[#374151] outline-none focus:border-[#5f89d8]"
              placeholder="Modelo"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {buscandoModelos && <Loader2 className="h-3 w-3 animate-spin text-[#94a3b8]" />}
            </div>

            {mostrarModelos && modelosSugeridos.length > 0 && (
              <div className="absolute z-20 mt-2 w-full max-h-[200px] overflow-y-auto rounded-2xl border border-[#e5e7eb] bg-white shadow-lg">
                {modelosSugeridos.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => seleccionarModelo(m)}
                    className="block w-full border-b border-[#f1f5f9] px-4 py-2.5 text-left transition last:border-b-0 hover:bg-[#f8fafc]"
                  >
                    <div className="text-[13px] font-medium text-[#334155]">{m}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[15px] font-semibold text-[#374151]">
            Chasis
          </label>
          <div className="relative">
            <input
              value={chasisNormalizado}
              onChange={updateField("chasis")}
              onKeyDown={handleKeyDown}
              className={`h-[44px] w-full rounded-2xl border px-4 pr-10 text-[15px] text-[#374151] outline-none ${mostrarErrorChasis
                ? "border-[#e66b6b] bg-[#fff7f7]"
                : "border-[#d7dce5] bg-white"
                } focus:border-[#5f89d8]`}
              placeholder="17 caracteres alfanuméricos"
              maxLength={17}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {consultandoVIN ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#184b9b]" />
              ) : (
                <div className={`h-2 w-2 rounded-full ${chasisNormalizado.length === 17 ? (mostrarErrorChasis ? 'bg-red-500' : 'bg-green-500') : 'bg-slate-200'}`} />
              )}
            </div>
          </div>
          <p className={`mt-2 text-[12px] ${mostrarErrorChasis ? "text-[#c24141]" : "text-[#64748b]"}`}>
            {mostrarErrorChasis
              ? "El chasis debe tener 17 caracteres."
              : `${chasisNormalizado.length}/17 caracteres`}
          </p>
        </div>

        <div>
          <label className="mb-2 block text-[15px] font-semibold text-[#374151]">
            Patente
          </label>
          <div className="relative">
            <input
              value={form.patente}
              onChange={updateField("patente")}
              onKeyDown={(e) => handleKeyDown(e)}
              className="h-[44px] w-full rounded-2xl border border-[#d7dce5] bg-white px-4 pr-10 text-[15px] text-[#374151] outline-none focus:border-[#5f89d8]"
              placeholder="Patente"
            />
            <CarFront className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#cbd5e1]" />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={guardarDatos}
          className="flex h-[46px] items-center justify-center rounded-2xl bg-[#5f89d8] px-6 text-[15px] font-bold text-white transition hover:bg-[#4a72bc]"
        >
          Guardar datos
        </button>

        <button
          type="button"
          onClick={() => actualizarFormulario(initialClienteVehiculoData)}
          className="flex h-[46px] items-center justify-center rounded-2xl border border-[#e2e8f0] bg-white px-4 text-[14px] font-medium text-[#64748b] transition hover:bg-[#f8fafc] hover:text-[#475569]"
          title="Limpiar datos del formulario"
        >
          Limpiar
        </button>

        {guardado && (
          <div className="inline-flex items-center gap-2 rounded-2xl bg-[#ecfdf3] px-4 py-2 text-[14px] font-medium text-[#2f855a]">
            <Check className="h-4 w-4" />
            Datos guardados
          </div>
        )}
      </div>
      <style jsx global>{`
        @keyframes scan {
          0%, 100% { top: 0; }
          50% { top: 100%; }
        }
      `}</style>
    </section>
  );
}


