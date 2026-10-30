import { reduceGame } from './engine'
import type { EventCard, GameState, Player } from '../types'

export function cashChanges(previous: Pick<Player, 'id' | 'cash'>[], next: Player[]) {
  return next.flatMap(player => {
    const before = previous.find(value => value.id === player.id)
    const amount = before ? player.cash - before.cash : 0
    return amount ? [{ playerId: player.id, nickname: player.nickname, amount, balance: player.cash }] : []
  })
}

export function eventCashPreview(card: EventCard, state: GameState, player: Player) {
  // Preview the authoritative reducer, so the UI cannot invent a different financial rule.
  const result = reduceGame({ ...state, phase: 'event', pendingEventId: card.id, turnIndex: state.players.findIndex(value => value.id === player.id) }, {
    type: 'RESOLVE_EVENT', playerId: player.id, actionId: `cash-preview:${state.version}:${card.id}`,
  })
  const after = result.players.find(value => value.id === player.id)!
  const needsCash = result.phase === 'debt'
  const fromRivals = card.collectFromEach && !needsCash
    ? state.players.filter(rival => rival.id !== player.id).reduce((sum, rival) => sum + Math.max(0, rival.cash - result.players.find(value => value.id === rival.id)!.cash), 0)
    : 0
  const amount = needsCash ? card.cash : after.cash - player.cash
  const passingStart = !needsCash && card.moveTo !== undefined ? Math.max(0, amount - card.cash - fromRivals) : 0
  const tone = needsCash || card.jail || amount < 0 ? 'loss' : amount > 0 ? 'gain' : 'neutral'
  return { amount, fromRivals, passingStart, needsCash, tone, balance: after.cash }
}

export function moneySentence(amount: number, subject = 'Você') {
  const value = `R$ ${(Math.abs(amount) * 1000).toLocaleString('pt-BR')}`
  return amount > 0 ? `${subject} recebe ${value}` : amount < 0 ? `${subject} perde ${value}` : `${subject} não ganha nem perde dinheiro`
}
