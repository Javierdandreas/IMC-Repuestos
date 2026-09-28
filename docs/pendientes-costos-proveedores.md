# Decisiones: costos de proveedores

## Primera etapa

1. Las listas de los proveedores iniciales estaran en pesos. No se implementa cotizacion de dolares ahora.
2. Una oferta marcada como disponible, aunque no informe cantidad, se considera disponible.
3. Para Sachs, INA, MANN, WIX y LUK, el costo de referencia inicial sera el menor costo neto entre proveedores disponibles.
4. Si ningun proveedor tiene disponibilidad confirmada, el costo de referencia sera el promedio de los costos netos informados.
5. La aprobacion automatica de cambios se medira contra el costo del producto, no contra el precio final de mostrador.
6. Las ofertas puntuales por producto y los cupos compartidos entre distribuidores quedan fuera de esta etapa.

## Reglas comerciales flexibles

1. Una regla aplica a todo el proveedor o a una marca puntual. No se aplican reglas a items puntuales por ahora.
2. Los ajustes disponibles son porcentaje, importe fijo o coeficiente.
3. Las reglas se ejecutan en el orden configurado y se pueden reordenar.
4. Varias reglas de una misma marca se acumulan en orden.
5. El precio base de esta etapa se considera neto. No se agrega ni quita IVA como capa automatica por ahora.
6. Las reglas se mantienen activas hasta que un usuario las desactive. No tienen vigencia por fecha en esta etapa.
7. Los descuentos se cargan manualmente, no desde columnas del archivo.
8. Una regla puede depender del stock informado por el proveedor: estado normalizado, cantidad o texto recibido. La condicion definira si corresponde descuento o recargo.
9. Se usaran limites de seguridad para descuentos y recargos. Falta definir el porcentaje maximo permitido.
10. El detalle visual de cada capa aplicada por item queda para diseno posterior.

## Validacion con listas reales

Cada proveedor puede entregar una lista con reglas distintas: valor neto, valor con IVA, precio de lista con descuento comercial, o combinaciones de esos datos.

La formula debe soportar, en este orden:

1. Precio recibido en la lista.
2. Coeficiente de normalizacion del proveedor, por ejemplo 0.8264 para quitar IVA o 1 si ya es neto.
3. Descuento general del proveedor.
4. Coeficiente y descuento especificos por marca, cuando existan.

Antes de activar esa formula para todos, hay que validar un ejemplo real por proveedor. Ejemplo: si una lista es precio de lista menos 15% y luego IVA, se debe confirmar si el costo comparable se guarda con IVA o sin IVA.
