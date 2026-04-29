"use client";
import { PresupuestosListPage } from "@/modules/presupuestos";

export default function PresupuestosConfirmadosPage() {
  return (
    <PresupuestosListPage
      title="Presupuestos Confirmados"
      status="confirmados"
    />
  );
}