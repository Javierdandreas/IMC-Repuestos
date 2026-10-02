# Asistente de ayuda IMC

El asistente solo responde dudas sobre el uso del sistema. No recibe ni consulta datos operativos, no ejecuta acciones y no tiene acceso a precios, stock, proveedores, clientes ni credenciales.

## Configuracion

En Vercel crear estas variables para Production:

- `OPENAI_API_KEY`: Secret con la clave de OpenAI.
- `OPENAI_HELP_MODEL`: opcional. Si se omite se usa `gpt-6-astra`.

La clave se usa exclusivamente desde `POST /api/asistente`. Nunca debe exponerse en variables `NEXT_PUBLIC_*`.

## Limites

- 20 consultas por usuario cada 10 minutos por instancia de servidor.
- Consulta de hasta 700 caracteres.
- Se envian como contexto solo la ruta actual, rol y el historial breve de la conversacion. No se envian registros del catalogo ni datos de negocio.
