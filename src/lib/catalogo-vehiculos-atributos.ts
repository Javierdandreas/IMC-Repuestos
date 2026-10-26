export const DOMINIO_VEHICULOS_ML = "MLA-CARS_AND_VANS";

export const ATRIBUTOS_VEHICULO_ML = [
  { id: "BRAND", nombre: "Marca", grupo: "Principal" },
  { id: "MODEL", nombre: "Modelo", grupo: "Principal" },
  { id: "VEHICLE_YEAR", nombre: "Año", grupo: "Principal" },
  { id: "SHORT_VERSION", nombre: "Version", grupo: "Principal" },
  { id: "ENGINE", nombre: "Motor", grupo: "Principal" },
  { id: "FUEL_TYPE", nombre: "Combustible", grupo: "Secundario" },
  { id: "POWER", nombre: "Potencia", grupo: "Secundario" },
  { id: "VEHICLE_BODY_TYPE", nombre: "Carroceria", grupo: "Secundario" },
  { id: "TRANSMISSION_CONTROL_TYPE", nombre: "Tipo de transmision", grupo: "Secundario" },
  { id: "GEAR_NUMBER", nombre: "Marchas", grupo: "Opcional" },
  { id: "DOORS", nombre: "Puertas", grupo: "Opcional" },
  { id: "STEERING", nombre: "Direccion", grupo: "Opcional" },
  { id: "TRACTION_CONTROL", nombre: "Traccion", grupo: "Opcional" },
  { id: "VALVES_PER_CYLINDER", nombre: "Valvulas por cilindro", grupo: "Opcional" },
] as const;

export type AtributoVehiculoId = (typeof ATRIBUTOS_VEHICULO_ML)[number]["id"];

export type ValorVehiculo = {
  id: AtributoVehiculoId;
  valueId: string;
  valueName: string;
};

export type CompatibilidadPieza = {
  id?: number;
  atributos: ValorVehiculo[];
};

const attributeIds = new Set<string>(ATRIBUTOS_VEHICULO_ML.map((attribute) => attribute.id));

export function esAtributoVehiculo(value: unknown): value is AtributoVehiculoId {
  return typeof value === "string" && attributeIds.has(value);
}

export function normalizarAtributosVehiculo(value: unknown): ValorVehiculo[] {
  if (!Array.isArray(value)) return [];
  const uniques = new Map<AtributoVehiculoId, ValorVehiculo>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Record<string, unknown>;
    if (!esAtributoVehiculo(candidate.id)) continue;
    const valueId = String(candidate.valueId ?? candidate.value_id ?? "").trim();
    const valueName = String(candidate.valueName ?? candidate.value_name ?? "").trim();
    if (!valueId || !valueName) continue;
    uniques.set(candidate.id, { id: candidate.id, valueId, valueName: valueName.slice(0, 200) });
  }
  return [...uniques.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function firmaCompatibilidadVehiculo(attributes: ValorVehiculo[]) {
  return normalizarAtributosVehiculo(attributes).map((attribute) => `${attribute.id}:${attribute.valueId}`).join("|");
}

export function contextoVehiculo(attributes: ValorVehiculo[]) {
  return firmaCompatibilidadVehiculo(attributes);
}
