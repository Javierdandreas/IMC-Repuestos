import axios from 'axios';

const ALEGRA_API_URL = "https://api.alegra.com/api/v1";

// ─── Interfaces del payload de Alegra ──────────────────────────────────────

export interface AlegraWarehouse {
  id: string;
  initialQuantity: number;
  minQuantity?: number;
  maxQuantity?: number;
}

export interface AlegraInventory {
  unit: string;
  unitCost: number;
  initialQuantity: number;
  warehouses?: AlegraWarehouse[];
}

export interface AlegraPrice {
  idPriceList?: string;
  price: number;
}

export interface AlegraCustomField {
  id: string;
  value: string;
}

export interface AlegraItemPayload {
  id?: number | string;
  name: string;
  description?: string;
  reference?: string;
  type?: 'product' | 'service' | 'variantParent' | 'kit';
  status?: 'active' | 'inactive';
  category?: { id: number };
  price?: AlegraPrice[];
  inventory?: AlegraInventory;
  tax?: { id: number }[];
  customFields?: AlegraCustomField[];
}

// ─── Helper para leer IDs fijos desde env ──────────────────────────────────

function getAlegraConfig() {
  return {
    priceListId: process.env.ALEGRA_PRICE_LIST_ID ?? null,
    warehouseId: process.env.ALEGRA_WAREHOUSE_ID ?? null,
    categoryId:  process.env.ALEGRA_CATEGORY_ID  ? Number(process.env.ALEGRA_CATEGORY_ID)  : null,
    taxId:       process.env.ALEGRA_TAX_ID        ? Number(process.env.ALEGRA_TAX_ID)        : null,
    customFieldUbicacionId: process.env.ALEGRA_CUSTOM_FIELD_UBICACION_ID ?? null,
  };
}

// ─── Parámetros de entrada para crear/actualizar desde tu app ──────────────

export interface ProductoAlegraInput {
  cod_unico: string;
  descripcion: string;
  cod_barra?: string | null;
  stock: number;
  ubicacion?: string | null;
  /** Precio de venta — por ahora 0 hasta que se agregue a la BD */
  precio_venta?: number;
  /** Costo unitario — por ahora 0 hasta que se agregue a la BD */
  costo_unitario?: number;
  /** Si tiene IVA u otro impuesto. Null = usa el ALEGRA_TAX_ID del env */
  taxId?: number | null;
}

// ─── API Client ─────────────────────────────────────────────────────────────

/**
 * Utility to interact with Mi Alegra API
 */
export const alegraApi = {
  /**
   * Helper to get axios client with basic auth
   */
  getClient() {
    const email = process.env.ALEGRA_EMAIL;
    const token = process.env.ALEGRA_TOKEN;

    if (!email || !token) {
      return null;
    }

    const auth = Buffer.from(`${email}:${token}`).toString("base64");
    return axios.create({
      baseURL: ALEGRA_API_URL,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  },

  /**
   * Construye el payload completo para POST /items a partir de un producto IMC.
   * precio_venta y costo_unitario son 0 por defecto hasta que se agreguen a la BD.
   */
  buildItemPayload(producto: ProductoAlegraInput): AlegraItemPayload {
    const cfg = getAlegraConfig();

    const price = producto.precio_venta ?? 0;
    const unitCost = producto.costo_unitario ?? 0;
    const taxIdToUse = producto.taxId !== undefined ? producto.taxId : cfg.taxId;

    const payload: AlegraItemPayload = {
      name: producto.cod_unico,
      description: producto.descripcion || undefined,
      reference: producto.cod_barra || undefined,
      type: "product",
      status: "active",

      // Categoría de Alegra (ej: "Ventas" = 5134)
      ...(cfg.categoryId && {
        category: { id: cfg.categoryId },
      }),

      // Lista de precios
      price: [
        {
          ...(cfg.priceListId && { idPriceList: cfg.priceListId }),
          price,
        },
      ],

      // Inventario con bodega
      inventory: {
        unit: "unit",
        unitCost,
        initialQuantity: producto.stock,
        ...(cfg.warehouseId && {
          warehouses: [
            {
              id: cfg.warehouseId,
              initialQuantity: producto.stock,
            },
          ],
        }),
      },

      // Impuesto (IVA 21% = id 1)
      tax: taxIdToUse ? [{ id: taxIdToUse }] : [],

      // Campo personalizado UBICACION ESTANTERIA si existe
      customFields:
        producto.ubicacion && cfg.customFieldUbicacionId
          ? [{ id: cfg.customFieldUbicacionId, value: producto.ubicacion }]
          : [],
    };

    return payload;
  },

  /**
   * Creates a new item (product) in Alegra
   */
  async createItem(payload: AlegraItemPayload) {
    const client = this.getClient();
    if (!client) {
      console.warn("ALEGRA_EMAIL or ALEGRA_TOKEN not configured. Skipping Alegra sync.");
      return null;
    }

    try {
      const response = await client.post('/items', payload);
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number; data?: unknown }; message?: string };
      const status = axiosError.response?.status;
      const errorData = axiosError.response?.data;

      if (status === 402) {
        console.error("❌ ERROR CRÍTICO ALEGRA (402): Tu plan actual no permite crear productos vía API. Revisa tu suscripción.");
      } else if (status === 401) {
        console.error("❌ ERROR ALEGRA (401): Credenciales inválidas. Revisa ALEGRA_EMAIL y ALEGRA_TOKEN.");
      } else if (status === 422) {
        console.error("❌ ERROR ALEGRA (422): Payload inválido:", JSON.stringify(errorData, null, 2));
      } else {
        console.warn("⚠️ Fallo sincronización Alegra (Crear):", errorData || axiosError.message);
      }
      return null;
    }
  },

  /**
   * Crea un item en Alegra directamente desde un ProductoAlegraInput.
   * Shortcut que combina buildItemPayload + createItem.
   */
  async createItemFromProducto(producto: ProductoAlegraInput) {
    const payload = this.buildItemPayload(producto);
    return this.createItem(payload);
  },

  /**
   * Updates an existing item in Alegra
   */
  async updateItem(alegraId: string | number, payload: AlegraItemPayload) {
    const client = this.getClient();
    if (!client) return null;

    try {
      const response = await client.put(`/items/${alegraId}`, payload);
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: unknown }; message?: string };
      console.warn(`⚠️ Fallo sincronización Alegra (Actualizar ID ${alegraId}):`, axiosError.response?.data || axiosError.message);
      return null;
    }
  },

  /**
   * Finds a tax ID by its percentage
   */
  async getTaxIdByPercentage(percentage: number): Promise<number | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      const response = await client.get('/taxes');
      const taxes = response.data;
      const tax = taxes.find((t: { percentage: string; id: number }) => parseFloat(t.percentage) === percentage);
      return tax ? tax.id : null;
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number }; message?: string };
      if (axiosError.response?.status === 402) {
        console.error("❌ ERROR ALEGRA (402): No se pudo obtener catálogo de impuestos debido a limitaciones del plan.");
      } else {
        console.warn("⚠️ Error obteniendo catálogo de impuestos de Alegra:", axiosError.message);
      }
      return null;
    }
  }
};
