export const metadata = {
  title: "Operaciones | Control de Ingresos y Egresos",
  description: "Manejo de compras y ventas de productos",
};

export default function OperacionesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col">
      {children}
    </div>
  );
}
