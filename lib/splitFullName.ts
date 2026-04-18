/** Découpe un nom complet saisi par l'utilisateur pour remplir `first_name` / `last_name` en base. */
export function splitFullNameForBooking(fullName: string): { firstName: string; lastName: string } {
  const t = fullName.trim().replace(/\s+/g, ' ')
  if (!t) return { firstName: '', lastName: '' }
  const i = t.indexOf(' ')
  if (i === -1) return { firstName: t, lastName: '' }
  return { firstName: t.slice(0, i), lastName: t.slice(i + 1).trim() }
}
