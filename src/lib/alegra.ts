import axios from 'axios';

const ALEGRA_API_URL = "https://api.alegra.com/api/v1";

export interface AlegraItemPayload {
  id?: number | string;
  name: string;
  description?: string;
  reference?: string;
  price?: { price: number; idPriceList?: number }[];
  inventory?: {
    unit?: string;
    availableQuantity?: number;
    initialQuantity?: number;
    unitCost?: number;
    negativeStock?: boolean;
  };
  tax?: { id: number }[];
  status?: 'active' | 'inactive';
}

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
    } catch (error: any) {
      const status = error.response?.status;
      const errorData = error.response?.data;
      
      if (status === 402) {
        console.error("❌ ERROR CRÍTICO ALEGRA (402): Tu plan actual de Alegra no permite crear productos vía API. Por favor, revisa tu suscripción.");
      } else if (status === 401) {
        console.error("❌ ERROR ALEGRA (401): Credenciales inválidas. Revisa ALEGRA_EMAIL y ALEGRA_TOKEN.");
      } else {
        console.warn("⚠️ Fallo sincronización Alegra (Crear):", errorData || error.message);
      }
      return null;
    }
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
    } catch (error: any) {
      console.warn(`⚠️ Fallo sincronización Alegra (Actualizar ID ${alegraId}):`, error.response?.data || error.message);
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
      const tax = taxes.find((t: any) => parseFloat(t.percentage) === percentage);
      return tax ? tax.id : null;
    } catch (error: any) {
      if (error.response?.status === 402) {
        console.error("❌ ERROR ALEGRA (402): No se pudo obtener catálogo de impuestos debido a limitaciones del plan.");
      } else {
        console.warn("⚠️ Error obteniendo catálogo de impuestos de Alegra:", error.message);
      }
      return null;
    }
  }
};
