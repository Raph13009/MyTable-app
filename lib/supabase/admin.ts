import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

/**
 * Client Supabase Admin - Bypass RLS pour les opérations serveur
 * Utilise la service_role_key qui ignore les politiques RLS
 * ⚠️ NE JAMAIS exposer cette clé côté client !
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Please add it to your .env.local file.')
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

