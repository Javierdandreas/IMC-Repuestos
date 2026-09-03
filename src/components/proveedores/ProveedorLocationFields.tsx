"use client";

import { useEffect, useMemo, useState } from "react";

type GeographicOption = {
  id: string;
  nombre: string;
};

type Props = {
  provincia: string;
  localidad: string;
  activo: boolean;
  onProvinciaChange: (value: string) => void;
  onLocalidadChange: (value: string) => void;
  onActivoChange: (value: boolean) => void;
  labelClass: string;
  selectClass: string;
};

export function ProveedorLocationFields({
  provincia,
  localidad,
  activo,
  onProvinciaChange,
  onLocalidadChange,
  onActivoChange,
  labelClass,
  selectClass,
}: Props) {
  const [provincias, setProvincias] = useState<GeographicOption[]>([]);
  const [localidades, setLocalidades] = useState<GeographicOption[]>([]);
  const [loadingProvincias, setLoadingProvincias] = useState(true);
  const [loadingLocalidades, setLoadingLocalidades] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalize = (value: string) => value.trim().toLocaleUpperCase("es-AR");
  const provinciaSeleccionada = useMemo(
    () => provincias.find((item) => normalize(item.nombre) === normalize(provincia)),
    [provincia, provincias]
  );
  const localidadSeleccionada = useMemo(
    () => localidades.find((item) => normalize(item.nombre) === normalize(localidad)),
    [localidad, localidades]
  );

  useEffect(() => {
    let cancelled = false;

    fetch("/api/geografia/provincias")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        return data.provincias as GeographicOption[];
      })
      .then((items) => {
        if (!cancelled) setProvincias(items);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : "No se pudieron cargar las provincias.");
      })
      .finally(() => {
        if (!cancelled) setLoadingProvincias(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!provinciaSeleccionada) {
      setLocalidades([]);
      return;
    }

    let cancelled = false;
    setLoadingLocalidades(true);
    setError(null);

    fetch(`/api/geografia/localidades?provincia=${encodeURIComponent(provinciaSeleccionada.id)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        return data.localidades as GeographicOption[];
      })
      .then((items) => {
        if (!cancelled) setLocalidades(items);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : "No se pudieron cargar las localidades.");
      })
      .finally(() => {
        if (!cancelled) setLoadingLocalidades(false);
      });

    return () => {
      cancelled = true;
    };
  }, [provinciaSeleccionada]);

  return (
    <>
      <div className="space-y-1.5">
        <label className={labelClass}>Provincia</label>
        <select
          value={provinciaSeleccionada?.nombre ?? provincia}
          onChange={(event) => {
            onProvinciaChange(event.target.value);
            onLocalidadChange("");
          }}
          className={selectClass}
          disabled={loadingProvincias}
        >
          <option value="">{loadingProvincias ? "Cargando provincias..." : "Seleccionar provincia"}</option>
          {provincias.map((item) => <option key={item.id} value={item.nombre}>{item.nombre}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}>Localidad</label>
        <select
          value={localidadSeleccionada?.nombre ?? localidad}
          onChange={(event) => onLocalidadChange(event.target.value)}
          className={selectClass}
          disabled={!provinciaSeleccionada || loadingLocalidades}
        >
          <option value="">
            {!provinciaSeleccionada
              ? "Seleccionar provincia primero"
              : loadingLocalidades
                ? "Cargando localidades..."
                : "Seleccionar localidad"}
          </option>
          {localidades.map((item) => <option key={item.id} value={item.nombre}>{item.nombre}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}>Estado del proveedor</label>
        <label className="flex h-10 cursor-pointer items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3">
          <span className="text-xs font-black text-white">{activo ? "Activo" : "Inactivo"}</span>
          <input type="checkbox" className="peer sr-only" checked={activo} onChange={(event) => onActivoChange(event.target.checked)} />
          <span className="relative h-5 w-9 rounded-full bg-slate-700 transition peer-checked:bg-emerald-500 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
        </label>
      </div>

      {error ? <p className="text-xs font-bold text-amber-400 md:col-span-3">{error}</p> : null}
    </>
  );
}
