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

export async function getAuthenticatedUser(
  request: Request
): Promise<AuthedUser | null> {
  const token = readBearerToken(request);
  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("placeholder")) {
    return null;
  }

  const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const meta = (data.user.user_metadata || {}) as Record<string, unknown>;
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    fullName: typeof meta.full_name === "string" ? meta.full_name : null,
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
