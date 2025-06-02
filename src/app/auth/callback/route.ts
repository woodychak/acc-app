import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirect_to = requestUrl.searchParams.get("redirect_to");

  if (code) {
    const cookieStore = cookies(); // 👈 來自 next/headers

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () =>
            cookieStore.getAll().map(({ name, value }) => ({
              name,
              value,
            })),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options); // ✅ 合法使用
            });
          },
        },
      }
    );

    await supabase.auth.exchangeCodeForSession(code);
  }

  const redirectTo = redirect_to || "/dashboard";
  return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
}