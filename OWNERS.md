# Responsables por módulo

## Objetivo

Este documento define qué programador tiene responsabilidad principal sobre cada módulo del sistema, para reducir choques de commits, duplicación de trabajo y decisiones contradictorias.

---

## Programador A

Responsable principal de:

- Auth
- Catálogo
- Piezas
- Series
- Proveedores
- Importaciones de proveedor
- Stock interno
- Operaciones

---

## Programador B

Responsable principal de:

- Clientes
- Vehículos
- Presupuestos
- Presupuesto items
- Envíos
- Notificaciones
- Sync / Integraciones
- Dashboard operativo

---

## Módulos compartidos

Los siguientes módulos requieren revisión cruzada obligatoria:

- Auth
- Catálogo
- Proveedores
- Ubicaciones
- Stock
- Migraciones SQL
- Componentes compartidos
- Layout general del sistema

---

## Reglas de trabajo

### 1. No push directo a `main`
Todo cambio va por ramas y Pull Request.

### 2. Revisión cruzada obligatoria
Cambios en:
- tablas canónicas
- auth
- migraciones
- componentes compartidos
deben ser revisados por ambos.

### 3. Ownership principal, no exclusivo
Que un módulo tenga dueño no significa que el otro no pueda tocarlo. Significa que:
- el dueño define la dirección técnica principal
- cambios grandes deben coordinarse con él

### 4. Componentes compartidos
Nadie debe duplicar componentes sin revisar antes si ya existe uno reutilizable en `shared/`.

---

## Entidades sensibles

Las siguientes entidades son sensibles y requieren coordinación:

- `productos`
- `proveedores`
- `ubicaciones`
- `usuario_auth`
- `producto_proveedor`
- `producto_serie`
- `presupuestos`
- `clientes`
- `vehiculos`

---

## Convención de ramas

Ejemplos:

- `feature/importacion-proveedores`
- `feature/modulo-clientes`
- `feature/venta-con-series`
- `fix/error-busqueda-productos`
- `refactor/product-form`

---

## Convención de Pull Request

Todo PR debe indicar:
- módulo afectado
- tablas afectadas
- riesgo de impacto
- si requiere migración SQL
- cómo probarlo