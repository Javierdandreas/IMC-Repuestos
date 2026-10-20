# Identificador de chasis

Herramienta local experimental. Usa Microsoft Edge, requiere inicio de sesion manual y no guarda contrasenas ni cookies de sesion en el proyecto. No modifica IMC ni sube resultados automaticamente.

Usar solo si la autorizacion de Partslink cubre consultas automatizadas y almacenamiento de resultados. No elude CAPTCHA ni bloqueos. Si Partslink informa que un chasis no fue encontrado o que el bastidor no pudo asignarse al catalogo, lo anota y continua con el siguiente. Ante un resultado ambiguo pide confirmacion; ante bloqueos o errores detiene el lote.

## Preparacion

Abrir PowerShell en esta carpeta y ejecutar:

```powershell
npm install
```

Preparar un Excel cuya primera hoja tenga una columna `CHASIS` o `VIN`. El Excel exportado desde el catalogo de IMC cumple ese formato.

## Ejecucion

```powershell
npm run iniciar -- "C:\ruta\entrada.xlsx" "C:\ruta\resultado.xlsx"
```

Iniciar sesion manualmente en la ventana de Edge, abrir la pagina de inicio con el buscador de chasis y presionar Enter en PowerShell. Consulta hasta 10 VIN distintos por ejecucion, de manera secuencial y con 15 segundos entre intentos. Estos valores son limites locales, no garantizan que el proveedor permita el uso ni evitan bloqueos.

El archivo de salida se crea antes de consultar y se actualiza luego de cada resultado. Un archivo existente no se sobrescribe. Las filas restantes quedan como `PENDIENTE`. No se completan los campos faltantes mediante suposiciones y no se confirma compatibilidad de repuestos.

Esta version se desarrollo usando HTML guardado de un Audi; las consultas reales, otras marcas, errores y bloqueos requieren validacion con una sesion autorizada antes de usarse en lotes.

Para revisar la extraccion de una pagina guardada sin conectarse al sitio:

```powershell
npm run verificar-html -- "C:\ruta\resultado.html"
```
