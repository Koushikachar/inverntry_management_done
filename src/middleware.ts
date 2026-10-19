import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: any };

/** Refreshes the Supabase session cookie on every request so users aren't logged out when the access token expires. */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (l: CookieToSet[]) => {
        l.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        l.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, { ...options, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" })
        );
      },
    },
  });
  await sb.auth.getUser();
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };