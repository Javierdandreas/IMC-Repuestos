"use client";

/**
 * BRIDGE TEMPORAL
 * Presupuestos debe leer la sesion real via `/api/auth/me` y usar este archivo
 * solo como compatibilidad durante la transicion.
 * TODO: retirar este bridge cuando toda la UI de Presupuestos consuma auth canonica.
 */

export * from "@/modules/auth-presupuestos";
