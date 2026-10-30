import { describe, expect, it } from 'vitest'
import { EVENTS } from './content'
import { createGame, reduceGame } from './engine'
import { cashChanges, eventCashPreview } from './financial-feedback'

function fixture() {
  let state = createGame('feedback', undefined, 20, 123)
  for (const [id, characterId] of [['one', 'jair'], ['two', 'michelle'], ['three', 'flavio']] as const) {
    state = reduceGame(state, { type: 'ADD_PLAYER', actionId: id, player: { id, nickname: id, characterId, isBot: false } })
  }
  return state
}

describe('financial feedback', () => {
  it('reports both sides of a transfer and ignores newly joined players', () => {
    const state = fixture()
    const before = structuredClone(state.players)
    state.players[0].cash -= 60
    state.players[1].cash += 60
    expect(cashChanges(before, state.players).map(value => value.amount)).toEqual([-60, 60])
    expect(cashChanges([], state.players)).toEqual([])
  })
  it('caps collection by rival cash and excludes bankrupt rivals', () => {
    const state = fixture()
    state.players[1].cash = 7
    state.players[2].bankrupt = true
    const card = EVENTS.find(value => value.collectFromEach)!
    expect(eventCashPreview(card, state, state.players[0]).fromRivals).toBe(7)
  })
  it('shows a cash shortfall without pretending the payment already happened', () => {
    const state = fixture()
    state.players[0].cash = 10
    const card = EVENTS.find(value => value.cash < 0)!
    expect(eventCashPreview(card, state, state.players[0])).toMatchObject({ needsCash: true, balance: 10, tone: 'loss' })
  })
  it('distinguishes a nonfinancial setback from a zero-impact card', () => {
    const state = fixture()
    const card = EVENTS.find(value => value.jail)!
    expect(eventCashPreview(card, state, state.players[0])).toMatchObject({ amount: 0, tone: 'loss' })
  })
  it('includes the start bonus when movement crosses the start space', () => {
    const state = fixture()
    state.players[0].position = 35
    const card = EVENTS.find(value => value.moveTo !== undefined)!
    expect(eventCashPreview(card, state, state.players[0]).amount).toBe(card.cash + 200)
  })
})
