import { describe, expect, it } from 'vitest'
import { createGame, reduceGame } from './engine'
import { CHARACTERS, PROPERTIES } from './content'
import { MAX_PLAYERS } from './limits'
import { parseWireMessage } from '../network/protocol'
import type { GameIntent } from '../types'

function fullLobby() {
  let state = createGame('eight-player-game', 'ABC234')
  for (let index = 0; index < 8; index += 1) {
    state = reduceGame(state, {
      type: 'ADD_PLAYER', actionId: `add-${index}`,
      player: { id: `player-${index}`, nickname: `Player ${index}`, characterId: 'jair', isBot: false },
    })
  }
  return state
}

describe('eight-player rooms', () => {
  it('admits eight independent players even when they share a character', () => {
    const state = fullLobby()
    expect(MAX_PLAYERS).toBe(8)
    expect(state.players).toHaveLength(8)
    expect(new Set(state.players.map(player => player.id)).size).toBe(8)
    expect(state.players.every(player => player.cash === CHARACTERS.jair.startingCash)).toBe(true)
    expect(state.properties.every(property => !property.ownerId)).toBe(true)
    const changed = reduceGame(state, { type: 'SET_CHARACTER', actionId: 'same-character', playerId: 'player-7', characterId: 'jair' })
    expect(changed.players[7].characterId).toBe('jair')
    expect(changed.players.slice(0, 7)).toEqual(state.players.slice(0, 7))
  })

  it('rejects a ninth player without mutating the room and keeps joins idempotent', () => {
    const state = fullLobby()
    const before = structuredClone(state)
    const intent: GameIntent = { type: 'ADD_PLAYER', actionId: 'add-ninth', player: { id: 'player-8', nickname: 'Ninth', characterId: 'michelle', isBot: false } }
    expect(() => reduceGame(state, intent)).toThrow('8 investidores')
    expect(state).toEqual(before)
    expect(reduceGame(state, { ...intent, actionId: 'add-7' })).toBe(state)
    expect(reduceGame(state, { ...intent, player: { ...intent.player, id: 'player-7' } })).toBe(state)
  })

  it('starts only after all eight players are ready and advances through every seat', () => {
    let state = fullLobby()
    for (let index = 0; index < 7; index += 1) {
      state = reduceGame(state, { type: 'SET_READY', actionId: `ready-${index}`, playerId: `player-${index}`, ready: true })
    }
    expect(() => reduceGame(state, { type: 'START_GAME', actionId: 'early-start', playerId: 'player-0' })).toThrow('prontos')
    state = reduceGame(state, { type: 'SET_READY', actionId: 'ready-7', playerId: 'player-7', ready: true })
    state = reduceGame(state, { type: 'START_GAME', actionId: 'start', playerId: 'player-0' })
    expect(state.phase).toBe('rolling')
    const balances = state.players.map(player => player.cash)
    for (let index = 0; index < 8; index += 1) {
      expect(state.turnIndex).toBe(index)
      state.phase = 'manage'
      state = reduceGame(state, { type: 'END_TURN', actionId: `end-${index}`, playerId: `player-${index}` })
    }
    expect(state.turnIndex).toBe(0)
    expect(state.round).toBe(2)
    expect(state.players.map(player => player.cash)).toEqual(balances)
  })

  it('accepts eight-player snapshots and tied winners while rejecting overflow and duplicate identities', () => {
    const state = fullLobby()
    const parse = (snapshot: typeof state) => parseWireMessage({ type: 'state', stateVersion: snapshot.version, state: snapshot })
    expect(parse(state)).toBeDefined()
    const auction = structuredClone(state)
    auction.phase = 'auction'
    auction.auction = { tileId: PROPERTIES[0].id, highestBid: 0, initiatorId: 'player-0', passedPlayerIds: state.players.slice(0, 7).map(player => player.id) }
    expect(parse(auction)).toBeDefined()
    const finished = structuredClone(state)
    finished.phase = 'finished'
    finished.winnerIds = finished.players.map(player => player.id)
    expect(parse(finished)).toBeDefined()
    const overflow = structuredClone(state)
    overflow.players.push({ ...overflow.players[0], id: 'player-8' })
    expect(parse(overflow)).toBeUndefined()
    const duplicate = structuredClone(state)
    duplicate.players[7].id = duplicate.players[0].id
    expect(parse(duplicate)).toBeUndefined()
  })
})
