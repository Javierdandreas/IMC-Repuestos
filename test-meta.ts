import { getProductMeta } from './src/modules/productos/repos/productos-meta';

getProductMeta().then(meta => {
  console.log("Keys:", Object.keys(meta));
  console.log("Marcas length:", meta.marcas?.length);
  console.log("Categorias length:", meta.categorias?.length);
  process.exit(0);
}).catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
