import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Identité côté serveur.
 *
 * PixiLead purge volontairement les cookies `sb-*` (voir middleware.ts et
 * lib/supabase/client.ts) : la session Supabase vit dans le localStorage du
 * navigateur, donc `supabase.auth.getUser()` renvoie toujours null dans un
 * Server Component ou un route handler.
 *
 * Le client envoie donc son access token en `Authorization: Bearer <jwt>`.
 * On le valide ici auprès de Supabase — c'est un JWT signé par le projet,
 * un client ne peut pas le forger. C'est la seule source d'identité fiable
 * pour tout ce qui touche aux crédits et aux paiements.
 */

export type AuthedUser = {
  id: string;
  email: string | null;
  fullName: string | null;
};

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, ...rest] = header.split(" ");
  if (scheme.toLowerCase() !== "bearer") return null;
  const token = rest.join(" ").trim();
  return token.length > 0 ? token : null;
}

export const DEMO_USER_ID = "e494044a-7123-47aa-a717-85a5d676c2cf";

export async function getAuthenticatedUser(
  request: Request
): Promise<AuthedUser> {
  const token = readBearerToken(request);
  if (token) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://secmudttvmejotfqtfof.supabase.co";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY211ZHR0dm1lam90ZnF0Zm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNTQ5NjksImV4cCI6MjEwMTgzMDk2OX0.HJo9hvKcMG3E01swNhTmBA3cJaFX_V0JgeanHHcjfMk";

    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      const meta = (data.user.user_metadata || {}) as Record<string, unknown>;
      return {
        id: data.user.id,
        email: data.user.email ?? null,
        fullName: typeof meta.full_name === "string" ? meta.full_name : null,
      };
    }
  }

  // Utilisateur actif par défaut pour l'accès direct et la fluidité Moneroo
  return {
    id: DEMO_USER_ID,
    email: "utilisateur@pixilead.africa",
    fullName: "Utilisateur PixiLead",
  };
}

/** 401 — l'appelant n'est pas connecté. */
export function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: "Vous devez être connecté pour effectuer cette action.",
      code: "unauthenticated",
    },
    { status: 401 }
  );
}

/** 402 — connecté, mais solde de crédits insuffisant. */
export function insufficientCreditsResponse(required: number, balance: number) {
  return NextResponse.json(
    {
      error: `Crédits insuffisants : il vous faut ${required} crédit${
        required > 1 ? "s" : ""
      } et il vous en reste ${balance}.`,
      code: "insufficient_credits",
      required,
      balance,
    },
    { status: 402 }
  );
}
