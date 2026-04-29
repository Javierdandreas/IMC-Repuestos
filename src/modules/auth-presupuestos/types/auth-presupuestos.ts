export type RolUsuarioPresupuestos = "mostrador" | "deposito" | "administrador";

export type UsuarioSistemaPresupuestos = {
  id: string;
  username: string;
  password: string;
  nombre: string;
  rol: RolUsuarioPresupuestos;
};

