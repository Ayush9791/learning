import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // Use browser-session cookies instead of long-lived persistent cookies.
      // Supabase SSR otherwise configures a persistent cookie lifetime by default.
      cookieOptions: { maxAge: undefined },
    },
  )
}
