/**
 * Synchronous in-flight guard for preventing double form submissions.
 * React `loading` state alone is too late for rapid mobile taps.
 */
export function createInFlightGuard() {
  let inFlight = false

  return {
    /** @returns true if this caller should proceed; false if already in flight */
    tryStart(): boolean {
      if (inFlight) return false
      inFlight = true
      return true
    },
    finish(): void {
      inFlight = false
    },
    get pending(): boolean {
      return inFlight
    },
  }
}
