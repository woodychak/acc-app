import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const createClient = async (options?: { admin?: boolean }) => {
  const cookieStore = cookies();

  // Use service role key for admin operations to bypass RLS
  const supabaseKey = options?.admin
    ? process.env.SUPABASE_SERVICE_KEY!
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map(({ name, value }) => ({
            name,
            value,
          }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );
};
