
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Parse .env.local
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const processEnv: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length > 0) processEnv[key.trim()] = rest.join('=').trim();
});

const ALEGRA_API_URL = "https://api.alegra.com/api/v1";

async function debugAlegra() {
  const email = processEnv.ALEGRA_EMAIL;
  const token = processEnv.ALEGRA_TOKEN;

  if (!email || !token) {
    console.error("Faltan credenciales de Alegra en .env.local");
    return;
  }

  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  const client = axios.create({
    baseURL: ALEGRA_API_URL,
    headers: { Authorization: `Basic ${auth}` }
  });

  console.log("--- DEBUG ALEGRA PLAN ---");
  console.log("Email:", email);
  
  try {
    console.log("Consultando información de la empresa...");
    const companyRes = await client.get('/company');
    console.log("✅ Conexión exitosa!");
    console.log("Nombre Empresa:", companyRes.data.name);
    console.log("Identificación:", companyRes.data.identification);
    console.log("Plan detectado por API:", companyRes.data.planName || "No especificado");
    
    console.log("\nIntentando obtener catálogo de impuestos (donde falló antes)...");
    const taxesRes = await client.get('/taxes');
    console.log("✅ Impuestos obtenidos:", taxesRes.data.length);

  } catch (error: any) {
    console.error("\n❌ ERROR DETECTADO:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Mensaje Alegra:", JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 402) {
        console.error("\n💡 NOTA: Aunque tengas el plan Pro, Alegra devuelve este error si el Token no tiene permisos de escritura o si la cuenta está en 'modo lectura' por falta de algún pago administrativo pendiente.");
      }
    } else {
      console.error("Error de Red:", error.message);
    }
  }
}

debugAlegra();
