import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Sparkles, Layers } from 'lucide-react'
import { playSound } from '../audio/sound'
import type { GameIntent, GameState, Player } from '../types'

export function TurnAnnouncement({ player, mine, round, sound }: { player: Player; mine: boolean; round: number; sound: boolean }) {
  const [visible, setVisible] = useState(true)
  const played = useRef(false)
  useEffect(() => {
    if (!played.current) { played.current = true; playSound(mine ? 'turn-mine' : 'turn-other', sound) }
    const timer = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(timer)
  }, [mine, sound])
  return visible ? <div className={`turn-announcement ${mine ? 'my-turn' : ''}`} role="status"><ArrowRight /><div><small>RODADA {round}</small><strong>{mine ? 'Chegou a sua vez!' : `É a vez de ${player.nickname}`}</strong><span>{mine ? 'Role os dados para jogar.' : 'Acompanhe a jogada.'}</span></div></div> : null
}

export function EventRevealSound({ tone, sound }: { tone: string; sound: boolean }) {
  const played = useRef(false)
  useEffect(() => {
    if (!played.current) { played.current = true; playSound(tone === 'gain' ? 'luck' : tone === 'loss' ? 'setback' : 'card-pick', sound) }
  }, [tone, sound])
  return null
}

export function EventDraw({ game, playerId, onIntent, sound }: { game: GameState; playerId: string; onIntent: (intent: GameIntent) => void; sound: boolean }) {
  const active = game.players[game.turnIndex]
  const canChoose = game.pendingEventChoices?.length === 3 && active.id === playerId && !active.isBot
  const [submitted, setSubmitted] = useState(false)
  useEffect(() => {
    if (!submitted) return
    const retry = setTimeout(() => setSubmitted(false), 2000)
    return () => clearTimeout(retry)
  }, [submitted])
  return <div className="event-draw-overlay" role="dialog" aria-modal="true" aria-labelledby="event-draw-title"><section className="event-draw">
    <span className="draw-symbol"><Layers /></span><h2 id="event-draw-title">Sorte ou revés?</h2><p>{canChoose ? 'Escolha uma carta para descobrir o que acontece.' : `${active.nickname} está escolhendo uma carta.`}</p>
    <div className="face-down-cards">{[0, 1, 2].map(index => <button key={index} autoFocus={canChoose && index === 0} disabled={!canChoose || submitted} aria-label={`Escolher carta ${index + 1}`} onClick={() => {
      if (submitted) return
      setSubmitted(true)
      playSound('card-pick', sound)
      onIntent({ type: 'CHOOSE_EVENT', actionId: crypto.randomUUID(), playerId, index })
    }}><span className="card-back-border"><Sparkles /><b>?</b><span>SORTE OU REVÉS</span></span><small>CARTA {index + 1}</small></button>)}</div>
    <small className="draw-hint">O efeito só será aplicado depois da revelação e da confirmação.</small>
  </section></div>
}
