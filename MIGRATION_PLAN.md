# Plan de migración hacia el sistema unificado

## 1. Estado actual

Actualmente existen dos proyectos:

- **Catálogo**: base principal elegida
- **Presupuestos**: proyecto a incorporar por módulos

El objetivo es fusionarlos progresivamente en un único sistema sin frenar el desarrollo diario.

---

## 2. Decisiones ya tomadas

- Productos gana Catálogo
- Proveedores gana Catálogo
- Ubicaciones gana Catálogo
- Auth gana Catálogo

---

## 3. Estrategia de migración

La migración será por fases, no por reescritura completa.

---

## Fase 0 — Preparación

### Objetivo
Dejar reglas claras antes de fusionar.

### Tareas
- Definir arquitectura objetivo
- Definir responsables por módulo
- Definir tablas canónicas
- Crear carpeta de migraciones
- Documentar decisiones base

### Criterio de cierre
- `ARCHITECTURE.md` creado
- `OWNERS.md` creado
- `MIGRATION_PLAN.md` creado
- tabla de entidades canónicas definida

---

## Fase 1 — Auth unificada

### Objetivo
Unificar autenticación y autorización en torno al modelo del proyecto Catálogo.

### Tareas
- Consolidar `usuario`, `detalle_usuario`, `usuario_auth`
- Unificar roles y activo
- Adaptar middleware y helpers de sesión
- Hacer que ambos flujos consuman la misma auth

### Criterio de cierre
- ambos sistemas pueden autenticarse con la misma estructura

---

## Fase 2 — Entidades compartidas

### Objetivo
Consolidar entidades compartidas en el sistema principal.

### Entidades
- productos
- proveedores
- ubicaciones

### Tareas
- ampliar tablas si hace falta
- migrar datos útiles del proyecto Presupuestos
- adaptar formularios y APIs

### Criterio de cierre
- existe una sola fuente de verdad por entidad

---

## Fase 3 — Clientes y Vehículos

### Objetivo
Migrar el dominio comercial del proyecto Presupuestos.

### Tareas
- migrar tablas
- migrar endpoints
- migrar formularios y listados

### Criterio de cierre
- clientes y vehículos viven en el sistema principal

---

## Fase 4 — Presupuestos

### Objetivo
Incorporar el módulo de presupuestos al sistema base.

### Tareas
- migrar `presupuestos`
- migrar `presupuesto_items`
- migrar `presupuesto_envios`
- adaptar consumo de catálogo canónico

### Criterio de cierre
- presupuestos ya no depende del catálogo viejo

---

## Fase 5 — Sync / Integraciones

### Objetivo
Incorporar la capa de staging e integración.

### Tareas
- migrar `gesu_items_raw`
- migrar `sync_runs`
- migrar `productos_fuente`
- migrar `producto_precios`
- migrar `stock_actual`

### Criterio de cierre
- la integración vive dentro del sistema unificado, pero sigue separada conceptualmente del catálogo canónico

---

## Fase 6 — Stock canónico

### Objetivo
Definir el modelo de stock definitivo.

### Tareas
- decidir relación entre:
  - `productos.stock`
  - `stock_actual`
  - `producto_serie`
  - operaciones
- documentar reglas

### Criterio de cierre
- existe una sola lógica oficial de stock

---

## Fase 7 — Retiro de legacy

### Objetivo
Apagar módulos duplicados del proyecto secundario.

### Tareas
- dejar módulos legacy solo lectura
- redirigir navegación al sistema principal
- eliminar duplicación de desarrollo

### Criterio de cierre
- el sistema secundario ya no recibe nuevas funcionalidades estructurales

---

## 4. Riesgos principales

- doble verdad para stock
- duplicación de cambios en ambos proyectos
- divergencia de modelo de productos/proveedores
- conflictos simultáneos en entidades compartidas
- migraciones SQL no coordinadas

---

## 5. Regla operativa importante

Toda funcionalidad nueva debe clasificarse como:

- **solo legado**, si el módulo todavía no migró
- **nace en el sistema unificado**, si ese módulo ya está en convergencia

Esto evita que ambos proyectos sigan creciendo en paralelo sin control.

---

## 6. Seguimiento

Este documento debe actualizarse al cerrar cada fase.