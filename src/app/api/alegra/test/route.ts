import { NextResponse } from "next/server";
import axios from "axios";

const ALEGRA_API_URL = "https://api.alegra.com/api/v1";

/**
 * GET /api/alegra/test
 * Endpoint de diagnóstico — NO usar en producción.
 * Prueba las credenciales y envía un payload mínimo para ver el error exacto de Alegra.
 */
export async function GET() {
  const email = process.env.ALEGRA_EMAIL;
  const token = process.env.ALEGRA_TOKEN;

  if (!email || !token) {
    return NextResponse.json({ error: "ALEGRA_EMAIL o ALEGRA_TOKEN no configurados en .env.local" }, { status: 500 });
  }

  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  const client = axios.create({
    baseURL: ALEGRA_API_URL,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  const results: Record<string, unknown> = {
    credentials_used: { email, token_preview: `${token.slice(0, 4)}...${token.slice(-4)}` },
  };

  // ── 1. Prueba de autenticación: GET /items (solo lectura) ─────────────────
  try {
    const res = await client.get("/items?limit=1");
    results.auth_test = { status: "✅ OK", http_status: res.status, sample: res.data };
  } catch (err: unknown) {
    const e = err as { response?: { status: number; data: unknown; headers: unknown }; message: string };
    results.auth_test = {
      status: "❌ FAILED",
      http_status: e.response?.status,
      error_body: e.response?.data,
      error_headers: e.response?.headers,
      message: e.message,
    };
  }

  // ── 2. Prueba POST mínimo — solo name (obligatorio) ───────────────────────
  try {
    const minimalPayload = { name: "TEST_IMC_DELETE_ME" };
    const res = await client.post("/items", minimalPayload);
    results.post_minimal = { status: "✅ OK", http_status: res.status, created_id: res.data?.id, raw: res.data };
  } catch (err: unknown) {
    const e = err as { response?: { status: number; data: unknown }; message: string };
    results.post_minimal = {
      status: "❌ FAILED",
      http_status: e.response?.status,
      error_body: e.response?.data,
      message: e.message,
    };
  }

  // ── 3. Prueba POST con payload completo (como lo enviaría tu app) ─────────
  try {
    const fullPayload = {
      name: "TEST_IMC_FULL_DELETE_ME",
      description: "Producto de prueba diagnóstico",
      reference: "TST-001",
      type: "product",
      status: "active",
      category: { id: Number(process.env.ALEGRA_CATEGORY_ID ?? 5134) },
      price: [{ idPriceList: process.env.ALEGRA_PRICE_LIST_ID, price: 0 }],
      inventory: {
        unit: "unit",
        unitCost: 0,
        initialQuantity: 0,
        warehouses: [{ id: process.env.ALEGRA_WAREHOUSE_ID, initialQuantity: 0 }],
      },
      tax: [{ id: Number(process.env.ALEGRA_TAX_ID ?? 1) }],
      customFields: [],
    };
    const res = await client.post("/items", fullPayload);
    results.post_full = { status: "✅ OK", http_status: res.status, created_id: res.data?.id, raw: res.data };
  } catch (err: unknown) {
    const e = err as { response?: { status: number; data: unknown }; message: string };
    results.post_full = {
      status: "❌ FAILED",
      http_status: e.response?.status,
      error_body: e.response?.data,
      message: e.message,
    };
  }

  return NextResponse.json(results, { status: 200 });
}
