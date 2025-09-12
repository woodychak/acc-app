import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirect_to = requestUrl.searchParams.get("redirect_to");
  const error = requestUrl.searchParams.get("error");
  const error_description = requestUrl.searchParams.get("error_description");

  // Handle auth errors
  if (error) {
    console.error("Auth callback error:", error, error_description);
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(error_description || error)}`, requestUrl.origin)
    );
  }

  if (code) {
    const cookieStore = cookies();

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
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    try {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      
      if (exchangeError) {
        console.error("Error exchanging code for session:", exchangeError);
        return NextResponse.redirect(
          new URL(`/sign-in?error=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin)
        );
      }

      if (data.user) {
        console.log("User confirmed and logged in:", data.user.email);
        
        // Check if user record exists in public.users table
        const { data: existingUser, error: userError } = await supabase
          .from("users")
          .select("id")
          .eq("id", data.user.id)
          .single();

        // If user doesn't exist in public.users, create it
        if (!existingUser && !userError) {
          const { error: insertError } = await supabase.from("users").insert({
            id: data.user.id,
            name: data.user.user_metadata?.full_name || "",
            full_name: data.user.user_metadata?.full_name || "",
            email: data.user.email || "",
            user_id: data.user.id,
            token_identifier: data.user.id,
          });

          if (insertError) {
            console.error("Error creating user record:", insertError);
          }
        }

        // Check if company profile exists
        const { data: companyProfile, error: companyError } = await supabase
          .from("company_profile")
          .select("id, is_complete")
          .eq("user_id", data.user.id)
          .single();

        // If no company profile exists, create one
        if (!companyProfile && companyError) {
          const companyName = data.user.user_metadata?.company_name || 
                             data.user.user_metadata?.full_name + "'s Company" || 
                             "My Company";

          const { error: createCompanyError } = await supabase
            .from("company_profile")
            .insert({
              name: companyName,
              prefix: "INV-",
              default_currency: "HKD",
              user_id: data.user.id,
              created_at: new Date().toISOString(),
              is_complete: false,
            });

          if (createCompanyError) {
            console.error("Error creating company profile:", createCompanyError);
          }
        }
      }
    } catch (error) {
      console.error("Unexpected error in auth callback:", error);
      return NextResponse.redirect(
        new URL(`/sign-in?error=${encodeURIComponent("Authentication failed")}`, requestUrl.origin)
      );
    }
  }

  const redirectTo = redirect_to || "/dashboard";
  return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
}