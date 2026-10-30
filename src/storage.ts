const CURRENT_PREFIX = 'bolsonopolis'
const LEGACY_PREFIX = 'bolsonapolis'

function key(prefix: string, suffix: string) {
  return `${prefix}:${suffix}`
}

export function readStorage(suffix: string, fallback = '') {
  try {
    const current = localStorage.getItem(key(CURRENT_PREFIX, suffix))
    if (current !== null) return current
    const legacy = localStorage.getItem(key(LEGACY_PREFIX, suffix))
    if (legacy !== null) {
      localStorage.setItem(key(CURRENT_PREFIX, suffix), legacy)
      return legacy
    }
  } catch { /* Storage can be unavailable in private or restricted contexts. */ }
  return fallback
}

export function writeStorage(suffix: string, value: string) {
  try { localStorage.setItem(key(CURRENT_PREFIX, suffix), value) } catch { /* Runtime state remains authoritative. */ }
}

export function readJsonStorage<T>(suffix: string): T | undefined {
  const value = readStorage(suffix)
  if (!value) return undefined
  try { return JSON.parse(value) as T } catch { return undefined }
}

export function writeJsonStorage(suffix: string, value: unknown) {
  writeStorage(suffix, JSON.stringify(value))
}

export function checkpointSuffix(roomCode?: string) {
  return roomCode ? `checkpoint:${roomCode}` : 'lastCheckpoint'
}

export function hostAuthSuffix(roomCode: string) {
  return `host-auth:${roomCode}`
}
