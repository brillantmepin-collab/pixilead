import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://secmudttvmejotfqtfof.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY211ZHR0dm1lam90ZnF0Zm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNTQ5NjksImV4cCI6MjEwMTgzMDk2OX0.HJo9hvKcMG3E01swNhTmBA3cJaFX_V0JgeanHHcjfMk";

function cleanEnvKey(val: string | undefined, fallback: string): string {
  if (!val) return fallback;
  const cleaned = val.replace(/^["']|["']$/g, "").trim();
  return cleaned.length > 20 && !cleaned.includes("placeholder") ? cleaned : fallback;
}

let clientInstance: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  const supabaseUrl = cleanEnvKey(process.env.NEXT_PUBLIC_SUPABASE_URL, DEFAULT_SUPABASE_URL);
  const supabaseAnonKey = cleanEnvKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, DEFAULT_SUPABASE_ANON_KEY);

  if (typeof window !== "undefined") {
    try {
      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
        if (name.startsWith("sb-")) {
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
          document.cookie = `${name}=; path=/; domain=${window.location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        }
      }
    } catch {}
  }

  if (!clientInstance) {
    clientInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "pixilead_supabase_auth",
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    });
  }

  return clientInstance;
}
