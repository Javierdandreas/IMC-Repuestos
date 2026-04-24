export type CategoriaOption = {
  id: number;
  descripcion: string;
};

export type CategoriaTreeNode = {
  id: number;
  descripcion: string;
  subcategorias: { id: number; descripcion: string }[];
};
