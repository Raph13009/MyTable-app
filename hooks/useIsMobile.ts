'use client'

import { useSyncExternalStore } from 'react'

const MOBILE_BREAKPOINT = 1024

function subscribe(callback: () => void) {
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}

function getSnapshot() {
  return typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
}

function getServerSnapshot() {
  return false
}

/**
 * Returns whether the viewport is mobile-sized (< 1024px).
 * Uses useSyncExternalStore to avoid hydration mismatch and the desktop→mobile flip
 * that would cause ExploreMap to mount twice on real mobile devices.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
