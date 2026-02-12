import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export function generateIdempotencyToken(): string {
  const timestamp = Date.now().toString(36)
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)

  return `${timestamp}-${randomPart}`
}

export function generateDecisionToken(length = 48): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const chars: string[] = []

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    for (let i = 0; i < length; i += 1) {
      chars.push(alphabet[bytes[i] % alphabet.length])
    }
    return chars.join("")
  }

  for (let i = 0; i < length; i += 1) {
    chars.push(alphabet[Math.floor(Math.random() * alphabet.length)])
  }
  return chars.join("")
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", data)
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  }

  const { createHash } = await import("crypto")
  return createHash("sha256").update(token).digest("hex")
}

export function getBaseUrl(override?: string): string {
  if (override && override.trim().length > 0) {
    return override.replace(/\/$/, "")
  }

  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL

  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.replace(/\/$/, "")
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`
  }

  return "http://localhost:3000"
}

export function sanitizeMessage(value: string): string {
  const input = String(value ?? "")

  // Basic escaping to avoid HTML/script injection in message rendering contexts.
  const escaped = input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

  // Mask personal contact data.
  const maskedEmails = escaped.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    "[email masqué]"
  )

  const maskedPhones = maskedEmails.replace(
    /(?:\+?\d[\d\s().-]{7,}\d)/g,
    "[numéro masqué]"
  )

  // Keep the message size bounded for DB / UI stability.
  return maskedPhones.trim().slice(0, 4000)
}

export async function verifyToken(rawToken: string, expectedHash: string): Promise<boolean> {
  if (!rawToken || !expectedHash) return false

  const computedHash = await hashToken(rawToken)

  // Constant-time comparison when Node crypto is available.
  try {
    const { timingSafeEqual } = await import("crypto")
    const a = Buffer.from(computedHash, "hex")
    const b = Buffer.from(expectedHash, "hex")
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return computedHash === expectedHash
  }
}
