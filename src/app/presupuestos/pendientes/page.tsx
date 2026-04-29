"use client";
import { PresupuestosListPage } from "@/modules/presupuestos";

export default function PresupuestosPendientesPage() {
  return (
    <PresupuestosListPage
      title="Presupuestos Pendientes"
      status="pendientes"
    />
  );
}