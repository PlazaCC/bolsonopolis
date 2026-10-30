import { describe, expect, it } from 'vitest'
import { EVENTS } from './content'
import { createGame, getBotIntent, hydrateGameState, reduceGame } from './engine'
import type { GameIntent, GameState } from '../types'
import { parseWireMessage } from '../network/protocol'
import { moneySentence } from './financial-feedback'

function draw() {
  let state = createGame('draw-game', undefined, 20, 1)
  for (const [id, characterId] of [['aa', 'jair'], ['bb', 'michelle']] as const) {
    state = reduceGame(state, { type: 'ADD_PLAYER', actionId: `add-${id}`, player: { id, nickname: id, characterId, isBot: false } })
    state = reduceGame(state, { type: 'SET_READY', actionId: `ready-${id}`, playerId: id, ready: true })
  }
  state = reduceGame(state, { type: 'START_GAME', actionId: 'start', playerId: 'aa' })
  state.players[0].position = 5
  return reduceGame(state, { type: 'ROLL', actionId: 'roll', playerId: 'aa' })
}
const choose = (state: GameState, index: number, actionId = 'choose', playerId = 'aa') => reduceGame(state, { type: 'CHOOSE_EVENT', playerId, index, actionId })

describe('three-card event draw', () => {
  it('deals three distinct outcomes without changing any balance or revealing a selection', () => {
    const state = draw()
    expect(state.phase).toBe('event')
    expect(new Set(state.pendingEventChoices).size).toBe(3)
    expect(state.pendingEventId).toBeUndefined()
    expect(state.players[0].cash).toBe(1500)
  })
  it('reveals the chosen result, applies it only on confirmation, and rejects reselection', () => {
    const state = draw()
    const selected = choose(state, 1)
    expect(selected.pendingEventId).toBe(state.pendingEventChoices![1])
    expect(selected.players.map(player => player.cash)).toEqual(state.players.map(player => player.cash))
    expect(() => choose(selected, 2, 'choose-again')).toThrow('já foi escolhida')
    expect(choose(selected, 1)).toBe(selected)
    const resolved = reduceGame(selected, { type: 'RESOLVE_EVENT', actionId: 'resolve', playerId: 'aa' })
    expect(resolved.phase).not.toBe('event')
  })
  it('rejects another player, an invalid slot, and confirmation before choosing', () => {
    const state = draw()
    expect(() => choose(state, 0, 'other', 'bb')).toThrow()
    expect(() => choose(state, 3)).toThrow()
    expect(() => reduceGame(state, { type: 'RESOLVE_EVENT', actionId: 'early', playerId: 'aa' })).toThrow()
  })
  it('preserves the draw across checkpoints and lets bots choose before resolving', () => {
    const state = hydrateGameState(draw())
    expect(state.pendingEventChoices).toHaveLength(3)
    state.players[0].isBot = true
    const bot = getBotIntent(state, state.players[0])!
    expect(bot.type).toBe('CHOOSE_EVENT')
    const selected = reduceGame(state, bot)
    expect(getBotIntent(selected, selected.players[0])?.type).toBe('RESOLVE_EVENT')
  })
  it('validates indices and draw consistency over the wire', () => {
    const state = draw()
    expect(parseWireMessage({ type: 'state', stateVersion: state.version, state })).toBeDefined()
    for (const index of [-1, 3, 1.5, NaN]) {
      const intent = { type: 'CHOOSE_EVENT', actionId: 'wire', playerId: 'aa', index } as GameIntent
      expect(parseWireMessage({ type: 'intent', actionId: 'wire', intent })).toBeUndefined()
    }
    const invalid = { ...state, chosenEventIndex: 0, pendingEventId: EVENTS.find(card => !state.pendingEventChoices!.includes(card.id))!.id }
    expect(parseWireMessage({ type: 'state', stateVersion: invalid.version, state: invalid })).toBeUndefined()
  })
  it('writes gains and losses in actual reais, rather than implicit thousands', () => {
    expect(moneySentence(120)).toBe('Você recebe R$ 120.000')
    expect(moneySentence(-80)).toBe('Você perde R$ 80.000')
    expect(moneySentence(0)).toBe('Você não ganha nem perde dinheiro')
  })
})
