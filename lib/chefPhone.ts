/**
 * Normalize and validate chef phone numbers for storage (E.164 with leading "+").
 * Accepts common French input formats.
 */
export interface ChefPhoneNormalizationResult {
  valid: boolean
  normalized?: string
  error?: string
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Normalize a chef phone number for database storage.
 * Examples:
 * - 06 12 34 56 78 -> +33612345678
 * - +33 6 12 34 56 78 -> +33612345678
 * - 0033 6 12 34 56 78 -> +33612345678
 */
export function normalizeChefPhoneForStorage(input: string): ChefPhoneNormalizationResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { valid: false, error: 'Le numéro de téléphone est requis' }
  }

  let digits = digitsOnly(trimmed)

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  if (digits.startsWith('0') && digits.length === 10) {
    digits = `33${digits.slice(1)}`
  }

  if (!digits.startsWith('33') && trimmed.startsWith('+')) {
    const withoutPlus = trimmed.slice(1).replace(/\D/g, '')
    digits = withoutPlus
  }

  const normalized = `+${digits}`

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    return {
      valid: false,
      error:
        'Numéro invalide. Utilisez un format international, par ex. +33 6 12 34 56 78 ou 06 12 34 56 78.',
    }
  }

  return { valid: true, normalized }
}

export function maskChefPhone(phone: string): string {
  const digits = digitsOnly(phone)
  if (digits.length <= 4) return '****'
  return `+${digits.slice(0, 2)}******${digits.slice(-2)}`
}
