import { describe, expect, it } from 'vitest'
import { createGame, reduceGame } from '../game/engine'
import { helloMatchesConnection, parseConnectionIdentity, parseWireMessage } from './protocol'

describe('P2P wire protocol', () => {
  const identity = { playerId: 'jogador-12345678', sessionToken: '12345678-1234-1234-1234-123456789012' }

  it('accepts a bounded hello that matches connection metadata', () => {
    const message = parseWireMessage({ type: 'hello', ...identity, nickname: 'Carioca', characterId: 'jair' })
    const metadata = parseConnectionIdentity(identity)
    expect(message).toBeDefined()
    expect(metadata).toBeDefined()
    expect(helloMatchesConnection(message!, metadata!)).toBe(true)
  })

  it('rejects malformed messages and forged connection identity', () => {
    expect(parseWireMessage('hello')).toBeUndefined()
    expect(parseWireMessage({ type: 'intent', actionId: 'different', intent: { type: 'ROLL', actionId: 'roll', playerId: identity.playerId } })).toBeUndefined()
    const message = parseWireMessage({ type: 'hello', ...identity, nickname: 'Carioca', characterId: 'jair' })!
    expect(helloMatchesConnection(message, { ...identity, sessionToken: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })).toBe(false)
  })

  it('rejects invalid financial values before they reach the host reducer', () => {
    expect(parseWireMessage({ type: 'intent', actionId: 'trade', intent: { type: 'PROPOSE_TRADE', actionId: 'trade', playerId: identity.playerId, toId: 'jogador-87654321', offeredCash: -10, requestedCash: 0, offeredPropertyIds: [], requestedPropertyIds: [] } })).toBeUndefined()
    expect(parseWireMessage({ type: 'intent', actionId: 'bid', intent: { type: 'BID', actionId: 'bid', playerId: identity.playerId, amount: Number.NaN } })).toBeUndefined()
  })

  it('never accepts host-only connection transitions from the wire without a boolean', () => {
    expect(parseWireMessage({ type: 'intent', actionId: 'presence', intent: { type: 'SET_CONNECTED', actionId: 'presence', playerId: identity.playerId } })).toBeUndefined()
  })

  it('accepts complete snapshots and rejects malformed nested state', () => {
    const state = reduceGame(createGame('partida-segura', 'ABC234'), {
      type: 'ADD_PLAYER',
      actionId: 'add-player',
      player: { id: identity.playerId, nickname: 'Carioca', characterId: 'jair', isBot: false },
    })
    expect(parseWireMessage({ type: 'state', stateVersion: state.version, state })).toBeDefined()

    const malformed = structuredClone(state) as unknown as { players: Array<{ cash: number }> }
    malformed.players[0].cash = Number.NaN
    expect(parseWireMessage({ type: 'state', stateVersion: state.version, state: malformed })).toBeUndefined()
  })
})
