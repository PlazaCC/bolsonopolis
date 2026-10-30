import { useEffect, useState } from 'react'
import type { CharacterId } from '../types'

const portraits = new Map<CharacterId, string>()
const listeners = new Set<() => void>()
const cacheKey = (id: CharacterId) => `bolsonopolis:portrait-3d:v5:${id}`

export function readCharacterPortrait(id: CharacterId) {
  if (portraits.has(id)) return portraits.get(id)
  try {
    const cached = sessionStorage.getItem(cacheKey(id))
    if (cached) portraits.set(id, cached)
    return cached || undefined
  } catch { return undefined }
}

export function storeCharacterPortrait(id: CharacterId, image: string) {
  portraits.set(id, image)
  try { sessionStorage.setItem(cacheKey(id), image) } catch { /* The in-memory cache remains available. */ }
  listeners.forEach(listener => listener())
}

export function useCharacterPortrait(id: CharacterId) {
  const [image, setImage] = useState(() => readCharacterPortrait(id))
  useEffect(() => {
    const update = () => setImage(readCharacterPortrait(id))
    listeners.add(update); update()
    return () => { listeners.delete(update) }
  }, [id])
  return image
}
