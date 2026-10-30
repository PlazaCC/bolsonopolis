import { useEffect, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { MONEY } from '../game/content'
import { cashChanges, moneySentence } from '../game/financial-feedback'
import { playSound } from '../audio/sound'
import type { GameState } from '../types'

export function CashValue({ amount, compact = false }: { amount: number; compact?: boolean }) {
  const [change, setChange] = useState({ amount, delta: 0, serial: 0 })
  if (amount !== change.amount) setChange({ amount, delta: amount - change.amount, serial: change.serial + 1 })
  useEffect(() => {
    if (!change.delta) return
    const timer = setTimeout(() => setChange(value => ({ ...value, delta: 0 })), 3500)
    return () => clearTimeout(timer)
  }, [change.amount, change.delta])
  return <span className="cash-value"><span>{compact ? amount.toLocaleString('pt-BR') : MONEY(amount)}</span>{change.delta !== 0 && <span key={change.serial} className={`cash-delta ${change.delta > 0 ? 'gain' : 'loss'}`}>{change.delta > 0 ? '+' : '−'}{MONEY(Math.abs(change.delta))}</span>}</span>
}

export function MoneyFeedback({ game, playerId, sound }: { game: GameState; playerId: string; sound: boolean }) {
  const [snapshot, setSnapshot] = useState({ gameId: game.id, players: game.players, batch: 0, changes: [] as ReturnType<typeof cashChanges> })
  if (snapshot.players !== game.players || snapshot.gameId !== game.id) {
    const changes = snapshot.gameId === game.id ? cashChanges(snapshot.players, game.players) : []
    setSnapshot({ gameId: game.id, players: game.players, batch: changes.length ? snapshot.batch + 1 : snapshot.batch, changes: changes.length ? changes : snapshot.gameId !== game.id ? [] : snapshot.changes })
  }
  useEffect(() => {
    const batch = snapshot.batch
    if (!snapshot.changes.length) return
    const timer = setTimeout(() => setSnapshot(value => value.batch === batch ? { ...value, changes: [] } : value), 6000)
    return () => clearTimeout(timer)
  }, [snapshot.batch, snapshot.changes])
  const played = useRef(0)
  useEffect(() => {
    if (played.current === snapshot.batch) return
    played.current = snapshot.batch
    const mine = snapshot.changes.find(change => change.playerId === playerId)
    if (mine) playSound(mine.amount > 0 ? 'money-in' : 'money-out', sound)
  }, [snapshot.batch, snapshot.changes, playerId, sound])
  return <div className="money-feedback" role="status" aria-live="polite" aria-atomic="true" key={snapshot.batch}>
    {snapshot.changes.map(change => <div className={`money-notice ${change.amount > 0 ? 'gain' : 'loss'}`} key={change.playerId}>
      {change.amount > 0 ? <ArrowDownLeft /> : <ArrowUpRight />}
      <div><b>{change.playerId === playerId ? 'Você' : change.nickname}</b><span><strong>{moneySentence(change.amount, change.playerId === playerId ? 'Você' : change.nickname)}</strong></span><small>Caixa: {MONEY(change.balance)}</small></div>
    </div>)}
  </div>
}
