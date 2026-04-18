export type BookingAddressFields = {
  city: string
  postalCode: string
  fullAddress: string
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
      city: fd.city.trim(),
      postalCode: cleanPostal,
      fullAddress: fd.fullAddress.trim(),
    }
  }

  return parseManualFrenchAddress(fd.eventAddress)
}
