import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function testSupabase() {
  try {
    const { data, error } = await supabase.from('notificaciones').select('*').limit(1);
    if (error) {
      console.error("Error Supabase:", error);
    } else {
      console.log("Data Supabase:", data);
    }
  } catch (error) {
    console.error("Catch Error:", error);
  }
}

testSupabase();
