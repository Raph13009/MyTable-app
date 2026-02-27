import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Génère un slug à partir du nom du chef (même logique que le formulaire admin).
 */
export function slugifyChefName(name: string): string {
  if (!name || typeof name !== 'string') return 'chef'
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return slug || 'chef'
}

/**
 * Retourne un slug unique pour un chef.
 * Si le slug existe déjà, essaie -2, -3, etc. jusqu'à trouver un slot libre.
 * @param excludeChefId - Id du chef à exclure (pour les mises à jour)
 */
export async function ensureUniqueChefSlug(
  supabase: SupabaseClient,
  baseSlug: string,
  excludeChefId?: string
): Promise<string> {
  const normalizedBase = baseSlug.trim() || 'chef'
  let candidate = normalizedBase
  let suffix = 1

  while (true) {
    let query = supabase.from('chefs').select('id').eq('slug', candidate)

    if (excludeChefId) {
      query = query.neq('id', excludeChefId)
    }

    const { data } = await query.maybeSingle()

    if (!data) {
      return candidate
    }

    suffix += 1
    candidate = `${normalizedBase}-${suffix}`
  }
}
