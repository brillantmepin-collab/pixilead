import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const response = NextResponse.redirect(new URL("/app", request.url));
  // Set auth cookie flag
  response.cookies.set("pixilead_auth_session", "true", { path: "/", maxAge: 86400 * 30 });
  return response;
}
