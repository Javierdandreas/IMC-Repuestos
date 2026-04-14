
import axios from 'axios';
import path from 'path';
import fs from 'fs';

// Manually parse .env.local because of the spaces issue we found
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value.trim();
    }
  });
}

const ALEGRA_API_URL = "https://api.alegra.com/api/v1";

async function testAlegra() {
  const email = process.env.ALEGRA_EMAIL;
  const token = process.env.ALEGRA_TOKEN;

  console.log("Using Email:", email);
  console.log("Using Token:", token ? "HIDDEN" : "MISSING");

  if (!email || !token) {
    console.error("Missing Alegra credentials");
    return;
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

  try {
    console.log("1. Testing GET /taxes...");
    const taxesRes = await client.get('/taxes');
    console.log("Taxes found:", taxesRes.data.length);

    console.log("2. Testing POST /items (dry run/test item)...");
    const testItem = {
      name: "TEST PRODUCT " + Date.now(),
      description: "Test description from AntiGravity",
      price: [{ price: 100 }],
      inventory: {
          unit: "unit",
          availableQuantity: 5
      }
    };
    
    const itemRes = await client.post('/items', testItem);
    console.log("Item created successfully! ID:", itemRes.data.id);
    
  } catch (error: any) {
    console.error("Error calling Alegra API:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Message:", error.message);
    }
  }
}

testAlegra();
