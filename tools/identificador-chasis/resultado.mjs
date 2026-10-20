export async function esperarResultado(page, vin, timeout = 30000) {
  const handle = await page.waitForFunction((chasis) => {
    const visible = (element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
    const text = (document.body?.innerText || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const security = Array.from(document.querySelectorAll('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], input[type="password"]')).some(visible);
    if (security || /captcha|acceso bloqueado|cuenta bloqueada|sesion (?:ha )?(?:expirado|caducado)/.test(text)) return "BLOQUEADO";
    if (Array.from(document.querySelectorAll("h4")).some((element) => element.textContent?.trim().toUpperCase() === chasis)) return "ENCONTRADO";
    if (/el numero de bastidor no pudo ser asignado correctamente/.test(text)) return "NO_ASIGNADO";
    const noEncontrado = /(?:no se (?:ha |han )?(?:encontrad[oa]s?|reconocid[oa]s?|identificad[oa]s?|encontraron|identificaron|reconocieron)|no (?:se )?(?:encontro|reconoce|identifica)|no existen|sin)\s+(?:(?:ningun|ninguna|el|la|un|una)\s+)?(?:resultado|vehiculo|chasis|vin|numero de chasis)/;
    const noValido = /(?:chasis|vin|numero de chasis)\s+(?:no (?:encontrado|reconocido|valido|existe)|desconocido)/;
    return noEncontrado.test(text) || noValido.test(text) ? "NO_ENCONTRADO" : false;
  }, vin, { timeout });
  try { return await handle.jsonValue(); }
  finally { await handle.dispose(); }
}
