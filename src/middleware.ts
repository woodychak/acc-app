import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll().map(({ name, value }) => ({
            name,
            value,
          }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Refresh session if expired - required for Server Components
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("Auth session error:", error);
  }

  // If user is logged in and trying to access a protected route, check if profile is complete
  if (
    session &&
    pathname.startsWith("/dashboard") &&
    pathname !== "/dashboard/company-profile" &&
    !pathname.includes("/_next") &&
    !pathname.includes("/api") &&
    !pathname.includes("/auth")
  ) {
    try {
      // Check if user has completed their company profile
      const { data: profile, error: profileError } = await supabase
        .from("company_profile")
        .select("is_complete")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching company profile:", profileError);
      }

      if (profileError) {
        console.error("Error fetching company profile:", profileError);
      }

      // If profile doesn't exist or is not complete, redirect to company profile page
      if (!profile || profile.is_complete === false) {
        const url = new URL("/dashboard/company-profile", req.url);
        url.searchParams.set("setup", "required");
        return NextResponse.redirect(url);
      }
    } catch (error) {
      console.error("Error in middleware profile check:", error);
      // If there's an error, still allow access to avoid blocking users
    }
  }

  return res;
}

// Ensure the middleware is only called for relevant paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api).*)",
  ],
};
