import { createClient } from "@supabase/supabase-js";

// OJO: nunca importes este archivo en código que corre en el navegador.
// Solo se usa dentro de /pages/api, donde las variables de entorno son privadas.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
