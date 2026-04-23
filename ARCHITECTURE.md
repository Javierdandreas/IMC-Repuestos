# Arquitectura del sistema unificado

## 1. Objetivo

Este sistema unificado nace de la convergencia de dos proyectos existentes:

- **Proyecto Catálogo**: será la base principal del sistema.
- **Proyecto Presupuestos**: sus módulos se irán incorporando progresivamente al sistema principal.

El objetivo es construir un único sistema que concentre:

- autenticación y autorización
- catálogo de productos
- piezas y referencias
- series
- proveedores e importaciones
- clientes y vehículos
- presupuestos
- integraciones/sync
- operaciones y notificaciones

---

## 2. Proyecto base

El proyecto base elegido es **Catálogo**.

### Motivos
- Tiene el modelo más rico para catálogo interno.
- Ya resuelve mejor:
  - productos
  - piezas
  - series
  - proveedores
  - importaciones de proveedor
  - auth con Supabase + `usuario_auth`

---

## 3. Entidades canónicas

Las siguientes entidades tendrán como fuente de verdad al proyecto Catálogo:

- `productos`
- `proveedores`
- `ubicaciones`
- `usuario`
- `detalle_usuario`
- `usuario_auth`
- `pieza`
- `codigo_referencia`
- `pieza_codigo_referencia`
- `producto_serie`
- `producto_serie_movimiento`
- `producto_proveedor`
- `proveedor_importacion`
- `proveedor_importacion_item`

---

## 4. Entidades a incorporar desde Proyecto Presupuestos

Las siguientes entidades/módulos provienen del proyecto Presupuestos y se migrarán al sistema base:

- `clientes`
- `vehiculos`
- `presupuestos`
- `presupuesto_items`
- `presupuesto_envios`
- `notificaciones`
- `gesu_items_raw`
- `sync_runs`
- `productos_fuente`
- `producto_precios`
- `stock_actual`

---

## 5. Módulos del sistema

El sistema se organiza por módulos de negocio:

- Auth
- Catálogo
- Piezas
- Series
- Proveedores
- Importaciones
- Clientes
- Vehículos
- Presupuestos
- Notificaciones
- Sync / Integraciones
- Operaciones

---

## 6. Principios de arquitectura

### 6.1 Fuente de verdad única
Cada entidad principal debe tener una única tabla canónica.

### 6.2 Separación por módulos
La organización del sistema se hace por dominio funcional, no por páginas aisladas ni por “cada programador tiene su zona”.

### 6.3 Backend centralizado
La lógica de negocio va por repositorios y APIs claras.

### 6.4 Auth unificada
La autenticación y autorización se resuelven con:
- Supabase Auth
- `usuario_auth`
- `rol`
- `activo`

### 6.5 Staging no es catálogo
Las tablas de sync/ingesta (`gesu_items_raw`, `productos_fuente`, etc.) alimentan al sistema, pero no reemplazan al catálogo canónico.

### 6.6 Migración progresiva
No se hará una fusión “big bang”. La integración será por etapas.

---

## 7. Organización del código

Estructura sugerida:

```txt
src/
  modules/
    auth/
    catalogo/
    piezas/
    series/
    proveedores/
    importaciones/
    clientes/
    vehiculos/
    presupuestos/
    notificaciones/
    sync/
    operaciones/
  shared/
    components/
    hooks/
    ui/
    lib/
    types/