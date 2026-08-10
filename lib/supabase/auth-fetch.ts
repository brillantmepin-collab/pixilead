"use client";

import { createClient } from "./client";

/**
 * `fetch` qui joint l'access token Supabase.
 *
 * La session de PixiLead vit dans le localStorage (les cookies `sb-*` sont
 * purgés côté serveur ET côté client). Les routes API ne peuvent donc pas lire
 * de cookie de session : elles attendent un `Authorization: Bearer <jwt>`,
 * qu'elles valident auprès de Supabase. Voir lib/auth.ts.
 */

export async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function authFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = await getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

/**
 * Message d'erreur exploitable à partir d'une réponse API.
 * Distingue le 401 (non connecté) et le 402 (crédits insuffisants), qui
 * appellent des actions différentes dans l'interface.
 */
export type ApiError = {
  message: string;
  code?: string;
  needsLogin: boolean;
  needsCredits: boolean;
  balance?: number;
  required?: number;
};

export async function readApiError(res: Response): Promise<ApiError> {
  const data = await res.json().catch(() => ({}) as Record<string, unknown>);
  const message =
    typeof data.error === "string" ? data.error : `Erreur ${res.status}`;
  return {
    message,
    code: typeof data.code === "string" ? data.code : undefined,
    needsLogin: res.status === 401,
    needsCredits: res.status === 402,
    balance: typeof data.balance === "number" ? data.balance : undefined,
    required: typeof data.required === "number" ? data.required : undefined,
  };
}
