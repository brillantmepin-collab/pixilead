import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.delete(cookie.name);
    }
  }
  return response;
}

export const config = {
  matcher: [
    // `api/webhooks` est exclu : les appels serveur-à-serveur de Moneroo n'ont
    // pas de cookie à purger, et on ne veut rien interposer sur la vérification
    // de signature.
    "/((?!api/webhooks|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
