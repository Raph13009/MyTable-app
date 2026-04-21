export type BookingAddressFields = {
  city: string
  postalCode: string
  fullAddress: string
}

/** Normalise les arrondissements FR : "Paris 15e Arrondissement" → "Paris", etc. */
function normalizeFrenchCity(city: string, postalCode: string): string {
  let next = city
    .replace(/\s+\d{1,2}(?:er|re|e|ème|eme)\s+Arrondissement/gi, '')
    .replace(/\s+Arrondissement\s*\d+/gi, '')
    .trim()

  if (/^\d{5}$/.test(postalCode)) {
    if (postalCode.startsWith('75')) next = 'Paris'
    else if (postalCode.startsWith('13')) next = 'Marseille'
    else if (postalCode.startsWith('69')) next = 'Lyon'
  }
  return next
}

/**
 * Saisie manuelle : extrait code postal français (5 chiffres) et une commune utile depuis une seule ligne.
 */
export function parseManualFrenchAddress(line: string): BookingAddressFields | null {
  const trimmed = line.trim()
  if (trimmed.length < 4) return null

  const m = trimmed.match(/\b(\d{5})\b/)
  if (!m || m.index === undefined) return null

  const postalCode = m[1]
  if (!/^\d{5}$/.test(postalCode)) return null

  const after = trimmed.slice(m.index + 5).replace(/^[,\s-]+/g, '').trim()
  const before = trimmed.slice(0, m.index).replace(/[,\s-]+$/g, '').trim()
  const cityFromComma = before.split(',').map((p) => p.trim()).filter(Boolean)
  const city = (after || cityFromComma[cityFromComma.length - 1] || before || '').trim()

  if (city.length < 2) return null

  return {
    postalCode,
    city,
    fullAddress: trimmed,
  }
}

export function resolveBookingAddress(fd: {
  eventAddress: string
  city: string
  postalCode: string
  fullAddress: string
}): BookingAddressFields | null {
  const cleanPostal = fd.postalCode.replace(/\s/g, '')
  const structuredOk =
    /^\d{5}$/.test(cleanPostal) &&
    fd.city.trim().length >= 2 &&
    fd.fullAddress.trim().length >= 4

  if (structuredOk) {
    return {
      city: normalizeFrenchCity(fd.city.trim(), cleanPostal),
      postalCode: cleanPostal,
      fullAddress: fd.fullAddress.trim(),
    }
  }

  const fallback = parseManualFrenchAddress(fd.eventAddress)
  if (!fallback) return null
  return {
    ...fallback,
    city: normalizeFrenchCity(fallback.city, fallback.postalCode),
  }
}

/**
 * Côté API : garantit ville + code postal FR valides + libellé complet pour la DB.
 * Utilise les mêmes règles que le formulaire (resolve + fallback saisie libre).
 */
export function normalizeBookingAddressForDb(input: {
  city?: unknown
  postalCode?: unknown
  fullAddress?: unknown
  eventAddress?: unknown
}): BookingAddressFields | null {
  const city = typeof input.city === 'string' ? input.city : ''
  const postalCode = typeof input.postalCode === 'string' ? input.postalCode : ''
  const fullAddress = typeof input.fullAddress === 'string' ? input.fullAddress : ''
  const eventAddress =
    typeof input.eventAddress === 'string' ? input.eventAddress : fullAddress

  const resolved = resolveBookingAddress({
    eventAddress,
    city,
    postalCode,
    fullAddress,
  })
  if (resolved) return resolved

  if (fullAddress.trim().length >= 4) {
    const fallback = parseManualFrenchAddress(fullAddress.trim())
    if (!fallback) return null
    return {
      ...fallback,
      city: normalizeFrenchCity(fallback.city, fallback.postalCode),
    }
  }
  return null
}
