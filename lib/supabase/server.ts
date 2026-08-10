import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const DEFAULT_SUPABASE_URL = "https://secmudttvmejotfqtfof.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY211ZHR0dm1lam90ZnF0Zm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNTQ5NjksImV4cCI6MjEwMTgzMDk2OX0.HJo9hvKcMG3E01swNhTmBA3cJaFX_V0JgeanHHcjfMk";
const DEFAULT_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY211ZHR0dm1lam90ZnF0Zm9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjI1NDk2OSwiZXhwIjoyMTAxODMwOTY5fQ.nGbPS7Qe_jQ1OWJSJgd7By4ylyn3qZsGsVZt7qHW9SI";

function cleanEnvKey(val: string | undefined, fallback: string): string {
  if (!val) return fallback;
  const cleaned = val.replace(/^["']|["']$/g, "").trim();
  return cleaned.length > 20 && !cleaned.includes("placeholder") ? cleaned : fallback;
}

export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = cleanEnvKey(process.env.NEXT_PUBLIC_SUPABASE_URL, DEFAULT_SUPABASE_URL);
  const supabaseAnonKey = cleanEnvKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, DEFAULT_SUPABASE_ANON_KEY);

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Survolé si appelé depuis un Server Component
        }
      },
    },
  });
}

export function createAdminClient() {
  const supabaseUrl = cleanEnvKey(process.env.NEXT_PUBLIC_SUPABASE_URL, DEFAULT_SUPABASE_URL);
  const serviceKey = cleanEnvKey(process.env.SUPABASE_SERVICE_ROLE_KEY, DEFAULT_SERVICE_ROLE_KEY);

  return createSupabaseClient(supabaseUrl, serviceKey);
}

