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

