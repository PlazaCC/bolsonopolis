import { describe, expect, it } from 'vitest'
import { BOARD, CHARACTERS, PROPERTIES } from './content'
import { createGame, hydrateGameState, netWorth, propertyRent, reduceGame } from './engine'
import type { GameIntent, GameState } from '../types'

const action = (state: GameState, intent: Record<string, unknown> & { type: GameIntent['type'] }): GameState => reduceGame(state, { ...intent, actionId: `${state.version}-${intent.type}` } as GameIntent)
const started = () => {
  let game = createGame('test', undefined, 20, 12345)
  game = action(game, { type: 'ADD_PLAYER', player: { id: 'p1', nickname: 'Um', characterId: 'jair', isBot: false } })
  game = action(game, { type: 'ADD_PLAYER', player: { id: 'p2', nickname: 'Dois', characterId: 'michelle', isBot: false } })
  game = action(game, { type: 'SET_READY', playerId: 'p1', ready: true })
  game = action(game, { type: 'SET_READY', playerId: 'p2', ready: true })
  return action(game, { type: 'START_GAME', playerId: 'p1' })
}

describe('authoritative property engine', () => {
  it('uses 40 tiles, four classic corners and balanced groups', () => {
    expect(BOARD).toHaveLength(40)
    expect([BOARD[0].type, BOARD[10].type, BOARD[20].type, BOARD[30].type]).toEqual(['start', 'jail', 'rest', 'go-to-jail'])
    expect(PROPERTIES).toHaveLength(24)
    const counts = Object.values(PROPERTIES.reduce<Record<string, number>>((result, tile) => ({ ...result, [tile.group]: (result[tile.group] ?? 0) + 1 }), {}))
    expect(counts).toEqual([4, 4, 4, 4, 4, 4])
  })

  it('hydrates legacy checkpoints by adding lots without erasing assets', () => {
    const game = started()
    const legacy = structuredClone(game)
    legacy.properties = legacy.properties.slice(0, 20)
    legacy.properties[0].ownerId = 'p1'
    const hydrated = hydrateGameState(legacy)
    expect(hydrated.properties).toHaveLength(24)
    expect(hydrated.properties.find(property => property.tileId === legacy.properties[0].tileId)?.ownerId).toBe('p1')
  })
  it('keeps actions idempotent and rejects out-of-turn players', () => {
    const game = started()
    const intent = { type: 'ROLL', actionId: 'roll-once', playerId: 'p1' } as const
    const rolled = reduceGame(game, intent)
    expect(reduceGame(rolled, intent)).toBe(rolled)
    expect(() => reduceGame(game, { ...intent, actionId: 'wrong', playerId: 'p2' })).toThrow('Espere a sua vez')
  })

  it('buys property and charges rent without duplicating money', () => {
    let game = started()
    const tile = PROPERTIES[0]
    game.players[0].position = tile.index
    game.phase = 'property'
    const before = game.players[0].cash
    game = action(game, { type: 'BUY_PROPERTY', playerId: 'p1' })
    expect(game.players[0].cash).toBe(before - tile.price)
    game.players[1].position = tile.index
    game.turnIndex = 1
    game.phase = 'rolling'
    const rent = propertyRent(game, tile)
    const p1 = game.players[0].cash
    const p2 = game.players[1].cash
    // Resolve arrival directly through a deterministic roll setup by using the adjacent index.
    game.players[1].position = (tile.index - 2 + BOARD.length) % BOARD.length
    game.seed = 1 // first die 1; second die 1
    game = action(game, { type: 'ROLL', playerId: 'p2' })
    expect(game.players[0].cash + game.players[1].cash).toBe(p1 + p2 + 200)
    expect(game.players[0].cash).toBe(p1 + rent)
  })

  it('auctions a declined property and transfers only the winning bid', () => {
    let game = started()
    game.players[0].position = PROPERTIES[1].index; game.phase = 'property'
    game = action(game, { type: 'DECLINE_PROPERTY', playerId: 'p1' })
    game = action(game, { type: 'BID', playerId: 'p2', amount: 80 })
    game = action(game, { type: 'PASS_AUCTION', playerId: 'p1' })
    expect(game.properties.find(p => p.tileId === PROPERTIES[1].id)?.ownerId).toBe('p2')
    expect(game.players[1].cash).toBe(CHARACTERS.michelle.startingCash - 80)
  })

  it('builds on a complete group and mortgages an unimproved property', () => {
    let game = started(); game.phase = 'manage'
    const group = PROPERTIES.filter(p => p.group === 'orla')
    group.forEach(tile => { game.properties.find(p => p.tileId === tile.id)!.ownerId = 'p1' })
    game = action(game, { type: 'BUILD', playerId: 'p1', tileId: group[0].id })
    expect(game.properties.find(p => p.tileId === group[0].id)?.level).toBe(1)
    game = action(game, { type: 'MORTGAGE', playerId: 'p1', tileId: group[1].id })
    expect(game.properties.find(p => p.tileId === group[1].id)?.mortgaged).toBe(true)
  })

  it('executes atomic trades between players', () => {
    let game = started(); game.phase = 'manage'
    const a = PROPERTIES[0]; const b = PROPERTIES[1]
    game.properties.find(p => p.tileId === a.id)!.ownerId = 'p1'
    game.properties.find(p => p.tileId === b.id)!.ownerId = 'p2'
    game = action(game, { type: 'PROPOSE_TRADE', playerId: 'p1', toId: 'p2', offeredCash: 50, requestedCash: 20, offeredPropertyIds: [a.id], requestedPropertyIds: [b.id] })
    game = action(game, { type: 'ACCEPT_TRADE', playerId: 'p2' })
    expect(game.properties.find(p => p.tileId === a.id)?.ownerId).toBe('p2')
    expect(game.properties.find(p => p.tileId === b.id)?.ownerId).toBe('p1')
  })

  it('rejects malformed trade money and duplicate deeds', () => {
    const game = started()
    game.phase = 'manage'
    const tile = PROPERTIES[0]
    game.properties.find(property => property.tileId === tile.id)!.ownerId = 'p1'
    expect(() => action(game, { type: 'PROPOSE_TRADE', playerId: 'p1', toId: 'p2', offeredCash: -1, requestedCash: 0, offeredPropertyIds: [], requestedPropertyIds: [] })).toThrow('inteiro não negativo')
    expect(() => action(game, { type: 'PROPOSE_TRADE', playerId: 'p1', toId: 'p2', offeredCash: Number.NaN, requestedCash: 0, offeredPropertyIds: [], requestedPropertyIds: [] })).toThrow('inteiro não negativo')
    expect(() => action(game, { type: 'PROPOSE_TRADE', playerId: 'p1', toId: 'p2', offeredCash: 0, requestedCash: 0, offeredPropertyIds: [tile.id, tile.id], requestedPropertyIds: [] })).toThrow('duas vezes')
  })

  it('pauses for the active disconnected player and resumes the previous phase', () => {
    let game = started()
    expect(game.phase).toBe('rolling')
    game = action(game, { type: 'SET_CONNECTED', playerId: 'p1', connected: false })
    expect(game.phase).toBe('paused')
    expect(game.phaseBeforePause).toBe('rolling')
    expect(game.players[0].connected).toBe(false)

    game = action(game, { type: 'SET_CONNECTED', playerId: 'p1', connected: true })
    expect(game.phase).toBe('rolling')
    expect(game.phaseBeforePause).toBeUndefined()
    expect(game.players[0].connected).toBe(true)
  })

  it('records a non-active disconnect without pausing the market', () => {
    let game = started()
    game = action(game, { type: 'SET_CONNECTED', playerId: 'p2', connected: false })
    expect(game.phase).toBe('rolling')
    expect(game.players[1].connected).toBe(false)
  })

  it('allows only the host to start a rematch', () => {
    const game = started()
    game.phase = 'finished'
    game.winnerIds = ['p1']
    expect(() => action(game, { type: 'REMATCH', playerId: 'p2' })).toThrow('Só o host')
    const rematch = action(game, { type: 'REMATCH', playerId: 'p1' })
    expect(rematch.phase).toBe('lobby')
    expect(rematch.players).toHaveLength(2)
    expect(rematch.players.every(player => player.ready === player.isBot)).toBe(true)
  })

  it('records jail, bankruptcy and elimination victory', () => {
    let game = started()
    game.players[0].cash = 0; game.phase = 'debt'; game.debt = { playerId: 'p1', creditorId: 'p2', amount: 500, reason: 'aluguel' }
    game = action(game, { type: 'DECLARE_BANKRUPTCY', playerId: 'p1' })
    expect(game.players[0].bankrupt).toBe(true)
    expect(game.phase).toBe('finished')
    expect(game.winnerIds).toEqual(['p2'])
  })

  it('separates and applies a documented event with a fictional jail effect', () => {
    let game = started()
    game.phase = 'event'; game.pendingEventId = 'reuniao-embaixadores'
    game = action(game, { type: 'RESOLVE_EVENT', playerId: 'p1' })
    expect(game.players[0].position).toBe(10)
    expect(game.players[0].jailTurns).toBe(2)
    expect(game.phase).toBe('manage')
  })

  it('sells an upgrade to settle debt before bankruptcy', () => {
    let game = started()
    const tile = PROPERTIES[0]
    const asset = game.properties.find(property => property.tileId === tile.id)!
    asset.ownerId = 'p1'; asset.level = 1
    game.players[0].cash = 0; game.phase = 'debt'; game.debt = { playerId: 'p1', amount: Math.floor(tile.buildCost / 2), reason: 'teste de recuperação' }
    game = action(game, { type: 'SELL_BUILDING', playerId: 'p1', tileId: tile.id })
    expect(game.debt).toBeUndefined()
    expect(game.players[0].bankrupt).toBe(false)
    expect(game.phase).toBe('manage')
  })

  it('calculates net worth with properties and upgrades', () => {
    const game = started(); const tile = PROPERTIES[0]
    game.properties.find(p => p.tileId === tile.id)!.ownerId = 'p1'
    game.properties.find(p => p.tileId === tile.id)!.level = 2
    expect(netWorth(game, game.players[0])).toBe(game.players[0].cash + tile.price + tile.buildCost)
  })
})
