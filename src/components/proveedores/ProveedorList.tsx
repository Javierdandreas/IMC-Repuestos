"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { ProveedorForm } from "@/components/proveedores/ProveedorForm";

type Proveedor = {
  id: number;
  descripcion: string;
};

type Props = {
  proveedores: Proveedor[];
};

export function ProveedorList({ proveedores }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Proveedores</h1>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Nuevo proveedor
          </button>
        </div>

        <div className="border rounded-md overflow-hidden">
          <div className="grid grid-cols-[100px_1fr] bg-slate-600 text-white font-semibold">
            <div className="p-3 border-r">ID</div>
            <div className="p-3">Descripción</div>
          </div>

          {proveedores.length === 0 ? (
            <div className="p-4 text-gray-600">No hay proveedores cargados.</div>
          ) : (
            proveedores.map((proveedor) => (
              <div
                key={proveedor.id}
                className="grid grid-cols-[100px_1fr] border-t bg-white"
              >
                <div className="p-3 border-r">{proveedor.id}</div>
                <div className="p-3">{proveedor.descripcion}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        title="Nuevo proveedor"
        open={open}
        onClose={() => setOpen(false)}
      >
        <ProveedorForm
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
