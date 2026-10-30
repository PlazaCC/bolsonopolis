import { describe, expect, it } from 'vitest'
import { EVENTS, REFERENCES } from './content'

describe('editorial source archive', () => {
  it('links every factual card to a classified primary official source', () => {
    const references = new Map(REFERENCES.map(source => [source.id, source]))
    expect(REFERENCES.length).toBeGreaterThan(0)

    EVENTS.forEach(card => {
      expect(card.sourceIds.length).toBeGreaterThan(0)
      expect(card.fact).not.toContain('No jogo')
      expect(card.fictionalEffect).toMatch(/^No jogo,/)
      card.sourceIds.forEach(sourceId => {
        const source = references.get(sourceId)
        expect(source, `Missing source ${sourceId} for ${card.id}`).toBeDefined()
        expect(source?.url).toMatch(/^https:\/\/(?:[^/]+\.)?(?:tse\.jus\.br|tcu\.gov\.br|stf\.jus\.br|senado\.leg\.br)\//)
        expect(['decision', 'report', 'official-clarification']).toContain(source?.kind)
      })
    })
  })

  it('keeps source identifiers unique and contexts explicit', () => {
    expect(new Set(REFERENCES.map(source => source.id)).size).toBe(REFERENCES.length)
    REFERENCES.forEach(source => {
      expect(source.context.length).toBeGreaterThan(40)
      expect(source.accessedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
})
