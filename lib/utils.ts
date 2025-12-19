import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Génère un token sécurisé pour les décisions (accept/refuse)
 */
export function generateDecisionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Hash un token pour le stockage en DB
 */
export async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10)
}

/**
 * Vérifie un token contre son hash
 */
export async function verifyToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash)
}

/**
 * Sanitize message content by masking sensitive contact information
 * 
 * Masks:
 * - Email addresses → *****@*****.***
 * - Phone numbers (FR + international formats) → **********
 * 
 * @param content - The message content to sanitize
 * @returns Sanitized content with masked sensitive information
 */
export function sanitizeMessage(content: string): string {
  if (!content || typeof content !== 'string') {
    return content
  }

  let sanitized = content

  // Mask email addresses
  // Matches: user@domain.com, user.name@sub.domain.co.uk, etc.
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi
  sanitized = sanitized.replace(emailRegex, '*****@*****.***')

  // Mask phone numbers
  // French formats: 06 12 34 56 78, 0612345678, +33 6 12 34 56 78, +33612345678
  // International: +1-555-123-4567, (555) 123-4567, 555.123.4567, etc.
  // Matches numbers with optional spaces, dots, dashes, parentheses, plus signs
  const phoneRegex = /(?:\+?\d{1,4}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,9}[\s.-]?\d{1,9}/g
  sanitized = sanitized.replace(phoneRegex, (match) => {
    // Only mask if it looks like a phone number (has at least 8 digits)
    const digitsOnly = match.replace(/\D/g, '')
    if (digitsOnly.length >= 8) {
      return '**********'
    }
    return match // Keep if too short (might be a date or other number)
  })

  return sanitized
}

/**
 * Get the base URL for the application, forcing HTTPS in production
 * This ensures all URLs use HTTPS to avoid "not secure" warnings
 * 
 * @param providedUrl - Optional URL to use instead of NEXT_PUBLIC_APP_URL
 * @returns The base URL with HTTPS enforced in production
 */
export function getBaseUrl(providedUrl?: string): string {
  // Use provided URL, then NEXT_PUBLIC_APP_URL, then fallback to localhost
  let baseUrl = providedUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  
  // Force HTTPS in production (not localhost)
  const isProduction = process.env.NODE_ENV === 'production'
  const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')
  
  if (isProduction && !isLocalhost && baseUrl.startsWith('http://')) {
    baseUrl = baseUrl.replace('http://', 'https://')
  }
  
  return baseUrl
}

