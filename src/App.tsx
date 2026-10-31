import { MAX_PLAYERS } from './game/limits'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Beer, BookOpen, Building2, Copy, Crown, Dice5, Focus, Gavel, Gem, Handshake, HelpCircle, Landmark, Menu, RotateCcw, Settings, ShieldCheck, TrendingUp, Users, Volume2, VolumeX, Wifi, WifiOff, X } from 'lucide-react'
import type { DataConnection } from 'peerjs'
import { BOARD, CHARACTERS, EVENTS, GROUP_COLORS, MONEY, PROPERTIES, REFERENCES } from './game/content'
import { createGame, getBotIntent, hydrateGameState, netWorth, ownedProperties, ownsGroup, propertyRent, reduceGame } from './game/engine'
import { makeId, makeRoomCode, PeerSession } from './network/peer-session'
import { helloMatchesConnection, parseConnectionIdentity } from './network/protocol'
import { CashValue, MoneyFeedback } from './components/MoneyFeedback'
import { EventDraw, EventRevealSound, TurnAnnouncement } from './components/GameAnnouncements'
import { eventCashPreview, moneySentence } from './game/financial-feedback'
import { playSound } from './audio/sound'
import { checkpointSuffix, hostAuthSuffix, readJsonStorage, readStorage, writeJsonStorage, writeStorage } from './storage'
import type { CharacterId, ConnectionStatus, GameIntent, GameState, Player, WireMessage } from './types'
import { useCharacterPortrait } from './components/characterPortraitCache'

type Role = 'local' | 'host' | 'guest'
type Screen = 'home' | 'lobby' | 'game'
const Board3D = lazy(() => import('./components/Board3D').then(module => ({ default: module.Board3D })))
const CharacterPortraitRenderer = lazy(() => import('./components/CharacterPortraits').then(module => ({ default: module.CharacterPortraitRenderer })))
const uid = () => crypto.randomUUID()
const RESOLUTION_OPTIONS = [
  { value: 3, label: 'Ultra · 3×' },
  { value: 2, label: 'Alto · 2×' },
  { value: 1.5, label: 'Médio · 1,5×' },
  { value: 1, label: 'Baixo · 1×' },
  { value: .5, label: 'Ultra baixo · 0,5×' },
]


export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [role, setRole] = useState<Role>('local')
  const roleRef = useRef<Role>('local')
  const [game, setGame] = useState<GameState>()
  const gameRef = useRef<GameState | undefined>(undefined)
  const sessionRef = useRef<PeerSession | undefined>(undefined)
  const [nickname, setNickname] = useState(() => readStorage('nickname'))
  const [characterId, setCharacterId] = useState<CharacterId>('jair')
  const [joinCode, setJoinCode] = useState(() => new URLSearchParams(location.search).get('sala')?.toUpperCase() || '')
  const [playerId] = useState(() => readStorage('playerId', makeId()))
  const [sessionToken] = useState(() => readStorage('sessionToken', uid()))
  const hostTokensRef = useRef<Record<string, string>>({})
  const [connection, setConnection] = useState<ConnectionStatus>('offline')
  const [connectionDetail, setConnectionDetail] = useState('')
  const [error, setError] = useState('')
  const [modal, setModal] = useState<'rules' | 'settings' | 'references' | null>(null)
  const [sound, setSound] = useState(() => readStorage('sound', 'on') !== 'off')
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [quality, setQuality] = useState<'low' | 'high'>(() => innerWidth < 800 ? 'low' : 'high')
  const [renderScale, setRenderScale] = useState(() => {
    const saved = Number(readStorage('renderScale'))
    return RESOLUTION_OPTIONS.some(option => option.value === saved) ? saved : innerWidth < 800 ? 1 : 1.5
  })
  const [recenterSignal, setRecenterSignal] = useState(0)
  const checkpoint = screen === 'home' ? readJsonStorage<GameState>(checkpointSuffix()) ?? null : null

  useEffect(() => { gameRef.current = game }, [game])
  useEffect(() => { roleRef.current = role }, [role])
  useEffect(() => { writeStorage('playerId', playerId); writeStorage('sessionToken', sessionToken) }, [playerId, sessionToken])
  useEffect(() => {
    const disposeSession = () => sessionRef.current?.destroy()
    addEventListener('pagehide', disposeSession)
    return () => { removeEventListener('pagehide', disposeSession); disposeSession() }
  }, [])

  const persistIdentity = () => {
    const clean = nickname.trim().slice(0, 18)
    if (clean.length < 2) { setError('Escolha um apelido com pelo menos 2 letras.'); return false }
    setNickname(clean); writeStorage('nickname', clean); return true
  }

  const commit = useCallback((intent: GameIntent, reply?: DataConnection) => {
    const current = gameRef.current
    if (!current) return
    try {
      const next = reduceGame(current, intent)
      if (next === current) return
      gameRef.current = next; setGame(next); setError('')
      if (next.phase !== 'lobby') setScreen('game')
      if (roleRef.current === 'host') {
        writeJsonStorage(checkpointSuffix(), next)
        if (next.roomCode) writeJsonStorage(checkpointSuffix(next.roomCode), next)
        sessionRef.current?.broadcast({ type: 'state', state: next, stateVersion: next.version, actionId: intent.actionId })
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Ação recusada pelo cartório.'
      setError(message); playSound('bad', sound)
      if (reply) sessionRef.current?.send({ type: 'error', message, actionId: intent.actionId }, reply)
    }
  }, [sound])

  const sendIntent = (intent: GameIntent) => {
    playSound(intent.type === 'ROLL' ? 'roll' : 'click', sound)
    if (roleRef.current === 'guest') sessionRef.current?.send({ type: 'intent', intent, actionId: intent.actionId, playerId, stateVersion: game?.version })
    else commit(intent)
  }

  const handleEnvelope = (message: WireMessage, connectionToAnswer?: DataConnection) => {
    if (roleRef.current === 'host') {
      if (message.type === 'hello' && connectionToAnswer && message.playerId && message.nickname && message.characterId && message.sessionToken) {
        const connectionIdentity = parseConnectionIdentity(connectionToAnswer.metadata)
        if (!connectionIdentity || !helloMatchesConnection(message, connectionIdentity)) {
          sessionRef.current?.send({ type: 'error', message: 'Identidade da conexão recusada.' }, connectionToAnswer)
          return
        }
        const current = gameRef.current
        const known = current?.players.find(player => player.id === message.playerId)
        const expectedToken = hostTokensRef.current[message.playerId]
        if (expectedToken && expectedToken !== message.sessionToken) {
          sessionRef.current?.send({ type: 'error', message: 'Token de reconexão recusado.' }, connectionToAnswer)
          return
        }
        hostTokensRef.current[message.playerId] = message.sessionToken
        if (current?.roomCode) writeJsonStorage(hostAuthSuffix(current.roomCode), hostTokensRef.current)
        if (known) {
          if (!known.connected || current?.phase === 'paused') commit({ type: 'SET_CONNECTED', actionId: `presence-${known.id}-${uid()}`, playerId: known.id, connected: true }, connectionToAnswer)
          else sessionRef.current?.send({ type: 'state', state: current!, stateVersion: current!.version }, connectionToAnswer)
        } else if (current?.phase === 'lobby') {
          if (current.players.length >= MAX_PLAYERS) sessionRef.current?.send({ type: 'error', message: 'Sala lotada.' }, connectionToAnswer)
          else commit({ type: 'ADD_PLAYER', actionId: `join-${message.playerId}`, player: { id: message.playerId, nickname: message.nickname, characterId: message.characterId, isBot: false } }, connectionToAnswer)
        } else sessionRef.current?.send({ type: 'error', message: 'A partida já começou.' }, connectionToAnswer)
      } else if (message.type === 'intent' && message.intent && connectionToAnswer) {
        const identity = parseConnectionIdentity(connectionToAnswer.metadata)
        const claimed = 'playerId' in message.intent ? message.intent.playerId : message.intent.player.id
        if (message.intent.type === 'SET_CONNECTED') sessionRef.current?.send({ type: 'error', message: 'A presença só pode ser alterada pelo host.' }, connectionToAnswer)
        else if (!identity || claimed !== identity.playerId || hostTokensRef.current[claimed] !== identity.sessionToken) sessionRef.current?.send({ type: 'error', message: 'Identidade recusada.' }, connectionToAnswer)
        else commit(message.intent, connectionToAnswer)
      }
    } else if (roleRef.current === 'guest') {
      if (message.type === 'state' && message.state && (!gameRef.current || message.state.version >= gameRef.current.version)) {
        const snapshot = hydrateGameState(message.state)
        gameRef.current = snapshot; setGame(snapshot); setScreen(snapshot.phase === 'lobby' ? 'lobby' : 'game'); setError('')
      } else if (message.type === 'error') setError(message.message || 'O host recusou a ação.')
      else if (message.type === 'sync-request') sessionRef.current?.send({ type: 'hello', playerId, nickname, characterId, sessionToken })
    }
  }

  const beginNetwork = (nextRole: 'host' | 'guest', code: string) => {
    sessionRef.current?.destroy()
    const session = new PeerSession(handleEnvelope, (status, detail) => { setConnection(status); setConnectionDetail(detail || '') }, (disconnectedPlayerId, connected) => {
      if (connected || roleRef.current !== 'host' || !hostTokensRef.current[disconnectedPlayerId] || !gameRef.current?.players.some(player => player.id === disconnectedPlayerId && player.connected)) return
      commit({ type: 'SET_CONNECTED', actionId: `presence-${disconnectedPlayerId}-${uid()}`, playerId: disconnectedPlayerId, connected: false })
    })
    sessionRef.current = session
    if (nextRole === 'host') session.startHost(code); else session.startGuest(code, { playerId, nickname, characterId, sessionToken })
  }

  const openGame = (next: GameState, nextRole: Role) => { roleRef.current = nextRole; setRole(nextRole); gameRef.current = next; setGame(next); setScreen('lobby') }
  const playLocal = () => {
    if (!persistIdentity()) return
    let next = createGame(makeId('partida'))
    const picks = (Object.keys(CHARACTERS) as CharacterId[]).filter(id => id !== characterId)
    ;[{ id: playerId, nickname, characterId, isBot: false }, ...picks.slice(0, 3).map((id, index) => ({ id: `bot-${id}`, nickname: ['DataVênia', 'TioDoZap', 'CentrãoBot'][index], characterId: id, isBot: true }))].forEach(player => { next = reduceGame(next, { type: 'ADD_PLAYER', actionId: uid(), player }) })
    next = reduceGame(next, { type: 'SET_READY', actionId: uid(), playerId, ready: true }); openGame(next, 'local'); setConnection('offline')
  }
  const hostRoom = () => {
    if (!persistIdentity()) return
    const code = makeRoomCode(); let next = createGame(makeId('partida'), code)
    next = reduceGame(next, { type: 'ADD_PLAYER', actionId: uid(), player: { id: playerId, nickname, characterId, isBot: false } })
    hostTokensRef.current = { [playerId]: sessionToken }
    writeJsonStorage(hostAuthSuffix(code), hostTokensRef.current)
    openGame(next, 'host'); history.replaceState({}, '', `?sala=${code}`); writeJsonStorage(checkpointSuffix(), next); beginNetwork('host', code)
  }
  const joinRoom = () => {
    if (!persistIdentity()) return
    const code = joinCode.replace(/[^A-Z0-9]/g, '').slice(0, 6)
    if (code.length !== 6) { setError('O código da sala tem 6 caracteres.'); return }
    roleRef.current = 'guest'; setRole('guest'); setGame(undefined); gameRef.current = undefined; setScreen('lobby'); history.replaceState({}, '', `?sala=${code}`); beginNetwork('guest', code)
  }
  const resumeHost = () => {
    if (!checkpoint?.roomCode || !persistIdentity()) return
    const next = hydrateGameState(checkpoint); next.phase = next.phase === 'paused' ? next.phaseBeforePause || 'rolling' : next.phase; next.players.forEach(player => { if (!player.isBot) player.connected = player.id === playerId })
    hostTokensRef.current = { ...(readJsonStorage<Record<string, string>>(hostAuthSuffix(checkpoint.roomCode)) ?? {}), [playerId]: sessionToken }
    writeJsonStorage(hostAuthSuffix(checkpoint.roomCode), hostTokensRef.current)
    openGame(next, 'host'); setScreen(next.phase === 'lobby' ? 'lobby' : 'game'); history.replaceState({}, '', `?sala=${checkpoint.roomCode}`); beginNetwork('host', checkpoint.roomCode)
  }
  const leave = () => { sessionRef.current?.destroy(); sessionRef.current = undefined; setGame(undefined); gameRef.current = undefined; setScreen('home'); setConnection('offline'); setError(''); history.replaceState({}, '', location.pathname) }

  useEffect(() => {
    if (!game || ['lobby', 'finished', 'paused'].includes(game.phase) || role === 'guest') return
    const botIntent = getBotIntent(game, game.players[game.turnIndex])
    if (!botIntent) return
    const timer = window.setTimeout(() => commit(botIntent), game.phase === 'event' ? 2500 : reducedMotion ? 120 : 650)
    return () => clearTimeout(timer)
  }, [game, role, reducedMotion, commit])

  return <main className={`app ${reducedMotion ? 'reduce-motion' : ''}`}>
    <Suspense fallback={null}><CharacterPortraitRenderer /></Suspense>
    {screen === 'home' && <HomeScreen {...{ nickname, setNickname, characterId, setCharacterId, joinCode, setJoinCode, checkpoint }} error={error} onLocal={playLocal} onHost={hostRoom} onJoin={joinRoom} onResume={resumeHost} onRules={() => setModal('rules')} onReferences={() => setModal('references')} />}
    {screen === 'lobby' && <Lobby game={game} playerId={playerId} role={role} connection={connection} detail={connectionDetail} error={error} onIntent={sendIntent} onLeave={leave} />}
    {screen === 'game' && game && <GameScreen game={game} playerId={playerId} role={role} connection={connection} detail={connectionDetail} error={error} reducedMotion={reducedMotion} quality={quality} sound={sound} renderScale={renderScale} recenterSignal={recenterSignal} onRecenter={() => setRecenterSignal(value => value + 1)} onIntent={sendIntent} onLeave={leave} onRules={() => setModal('rules')} onSettings={() => setModal('settings')} onReferences={() => setModal('references')} />}
    {modal === 'rules' && <RulesModal onClose={() => setModal(null)} />}
    {modal === 'references' && <ReferencesModal onClose={() => setModal(null)} />}
    {modal === 'settings' && <SettingsModal {...{ sound, reducedMotion, quality, renderScale }} setSound={value => { setSound(value); writeStorage('sound', value ? 'on' : 'off') }} setReducedMotion={setReducedMotion} setQuality={setQuality} setRenderScale={value => { setRenderScale(value); writeStorage('renderScale', String(value)) }} onClose={() => setModal(null)} />}
  </main>
}

function Brand() { return <div className="brand"><span className="brand-star">B$</span><div><strong>BOLSONÓPOLIS</strong><small>NEGÓCIOS DE FAMÍLIA</small></div></div> }

function Portrait({ id, size = 'normal' }: { id: CharacterId; size?: 'small' | 'normal' | 'large' }) {
  const image = useCharacterPortrait(id)
  return <span className={`portrait portrait-${id} ${size}`} style={{ '--char': CHARACTERS[id].color, '--accent': CHARACTERS[id].accent } as React.CSSProperties} aria-hidden="true">
    {image ? <img src={image} alt="" draggable={false} /> : <i className="portrait-placeholder" />}
  </span>
}

function HomeScreen(props: { nickname: string; setNickname: (value: string) => void; characterId: CharacterId; setCharacterId: (value: CharacterId) => void; joinCode: string; setJoinCode: (value: string) => void; checkpoint: GameState | null; error: string; onLocal: () => void; onHost: () => void; onJoin: () => void; onResume: () => void; onRules: () => void; onReferences: () => void }) {
  return <section className="home-screen estate-home"><div className="poster-noise" />
    <header className="home-nav"><Brand /><div><button className="text-button" onClick={props.onReferences}><BookOpen /> Referências</button><button className="text-button" onClick={props.onRules}><HelpCircle /> Como jogar</button></div></header>
    <div className="hero-copy"><span className="eyebrow">CAPITALISMO DE COMPADRIO · 2–{MAX_PLAYERS} JOGADORES</span><h1>Compre a cidade.<br /><em>Cobre o aluguel.</em></h1><p>Um jogo imobiliário de negociação, leilões e patrimônio. A escritura é fictícia; a sátira vem com fonte.</p><div className="hero-ledger"><span><b>40</b> CASAS</span><span><b>24</b> IMÓVEIS</span><span><b>0</b> PIEDADE</span></div></div>
    <div className="setup-card"><div className="step-line"><span>01</span><label>NOME NO CONTRATO</label></div><input className="hero-input" value={props.nickname} onChange={event => props.setNickname(event.target.value)} maxLength={18} placeholder="Digite seu apelido" />
      <div className="step-line"><span>02</span><label>ESCOLHA O SÓCIO</label></div><div className="character-grid">{Object.values(CHARACTERS).map(character => <button key={character.id} className={`character-pick ${props.characterId === character.id ? 'selected' : ''}`} onClick={() => props.setCharacterId(character.id)} style={{ '--char': character.color, '--accent': character.accent } as React.CSSProperties}><Portrait id={character.id} /><strong>{character.name}</strong><small>{character.epithet}</small></button>)}</div>
      <div className="ability-ribbon"><Crown /><div><b>{CHARACTERS[props.characterId].epithet}</b><span>{CHARACTERS[props.characterId].ability}</span></div></div>{props.error && <div className="error-banner">{props.error}</div>}
      <div className="play-actions"><button className="primary-button" onClick={props.onLocal}><Dice5 /><span><b>JOGAR COM BOTS</b><small>Partida local imediata</small></span></button><button className="secondary-button" onClick={props.onHost}><Users /><span><b>CRIAR SALA</b><small>Multiplayer P2P</small></span></button></div>
      <div className="join-row"><input value={props.joinCode} onChange={event => props.setJoinCode(event.target.value.toUpperCase())} placeholder="CÓDIGO" maxLength={6} /><button onClick={props.onJoin}>ENTRAR →</button></div>
      {props.checkpoint?.roomCode && <button className="resume-button" onClick={props.onResume}><RotateCcw /> Retomar sala {props.checkpoint.roomCode} · turno {props.checkpoint.round}</button>}
    </div><aside className="parody-seal"><strong>FATO</strong><span>COM FONTE<br />FICÇÃO MARCADA</span></aside><footer className="home-footer">Paródia não oficial. Fatos e consequências ficcionais são apresentados separadamente; fontes primárias ficam disponíveis no arquivo.</footer>
  </section>
}

function Lobby({ game, playerId, role, connection, detail, error, onIntent, onLeave }: { game?: GameState; playerId: string; role: Role; connection: ConnectionStatus; detail: string; error: string; onIntent: (intent: GameIntent) => void; onLeave: () => void }) {
  const me = game?.players.find(player => player.id === playerId); const invite = game?.roomCode ? `${location.origin}${location.pathname}?sala=${game.roomCode}` : ''
  return <section className="lobby-screen"><header className="topbar"><Brand /><div className={`connection-pill ${connection}`}><Wifi /> {role === 'local' ? 'MODO LOCAL' : connection.toUpperCase()}</div><button className="text-button" onClick={onLeave}>Sair</button></header>
    <div className="lobby-title"><span className="eyebrow">CARTÓRIO DE REGISTRO</span><h1>Assine a sociedade</h1><p>Escolham personagens diferentes e definam a condição de vitória.</p></div>
    {game?.roomCode && <div className="invite-card"><span>CÓDIGO</span><strong>{game.roomCode}</strong><button onClick={() => { void navigator.clipboard.writeText(invite) }}><Copy /> COPIAR LINK</button></div>}
    {!game && <><div className="loading-box"><div className="spinner" /><h2>Localizando o host…</h2><p>{detail || 'A conexão WebRTC pode levar alguns segundos.'}</p></div>{error && <div className="error-banner lobby-error">{error}</div>}</>}
    {game && <><div className="lobby-players">{game.players.map(player => <article key={player.id} className={`lobby-player ${player.ready ? 'ready' : ''}`} style={{ '--char': CHARACTERS[player.characterId].color } as React.CSSProperties}><span className="player-number">{player.isBot ? 'BOT' : player.id === playerId ? 'VOCÊ' : 'P2P'}</span><Portrait id={player.characterId} size="large" /><div><h3>{player.nickname}</h3><p>{CHARACTERS[player.characterId].epithet}</p></div><b>{player.ready ? 'CONTRATO ASSINADO ✓' : 'LENDO AS LETRAS MIÚDAS…'}</b></article>)}</div>
      {me && !me.ready && <div className="lobby-characters">{Object.values(CHARACTERS).map(character => <button className={me.characterId === character.id ? 'selected' : ''} onClick={() => onIntent({ type: 'SET_CHARACTER', actionId: uid(), playerId, characterId: character.id })} key={character.id}>{character.name}<small>{character.epithet}</small></button>)}</div>}
      {role !== 'guest' && <div className="mode-picker"><button className={game.mode === 'elimination' ? 'selected' : ''} onClick={() => onIntent({ type: 'SET_MODE', actionId: uid(), playerId: game.players[0].id, mode: 'elimination' })}><Gavel /><b>ATÉ A FALÊNCIA</b><small>Último investidor solvente vence</small></button><button className={game.mode === 'timed' ? 'selected' : ''} onClick={() => onIntent({ type: 'SET_MODE', actionId: uid(), playerId: game.players[0].id, mode: 'timed', turnLimit: 20 })}><TrendingUp /><b>20 RODADAS</b><small>Maior patrimônio líquido vence</small></button></div>}
      {error && <div className="error-banner lobby-error">{error}</div>}<div className="lobby-actions">{me && <button className={me.ready ? 'secondary-button' : 'primary-button'} onClick={() => onIntent({ type: 'SET_READY', actionId: uid(), playerId, ready: !me.ready })}>{me.ready ? 'REVER CONTRATO' : 'ASSINAR CONTRATO'}</button>}{role !== 'guest' && <button className="primary-button" disabled={game.players.length < 2 || game.players.some(player => !player.ready)} onClick={() => onIntent({ type: 'START_GAME', actionId: uid(), playerId: game.players[0].id })}>ABRIR O MERCADO →</button>}</div>
      {role === 'host' && <p className="host-note"><ShieldCheck /> Você é o cartório autoritativo. Mantenha esta aba aberta.</p>}</>}
  </section>
}

function GameScreen(props: { game: GameState; playerId: string; role: Role; connection: ConnectionStatus; detail: string; error: string; reducedMotion: boolean; quality: 'low' | 'high'; sound: boolean; renderScale: number; recenterSignal: number; onRecenter: () => void; onIntent: (intent: GameIntent) => void; onLeave: () => void; onRules: () => void; onSettings: () => void; onReferences: () => void }) {
  const { game, playerId, role, connection, error, onIntent } = props
  const active = game.players[game.turnIndex]; const me = game.players.find(player => player.id === playerId)!; const myTurn = active?.id === playerId
  const [managementOpen, setManagementOpen] = useState(false); const [tradeOpen, setTradeOpen] = useState(false)
  const hudRoot = useRef<HTMLElement>(null)
  const actionPanel = useRef<HTMLElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sheet, setSheet] = useState({ phase: game.phase, collapsed: false })
  const sheetCollapsed = sheet.phase === game.phase && sheet.collapsed
  useEffect(() => {
    const panel = actionPanel.current
    const root = hudRoot.current
    if (!panel || !root) return
    const observer = new ResizeObserver(() => root.style.setProperty('--action-height', `${panel.getBoundingClientRect().height}px`))
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])
  const [tipsy, setTipsy] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [journalOpen, setJournalOpen] = useState(false)
  const [cameraSelection, setCameraSelection] = useState({ playerId: active?.id ?? playerId, turnIndex: game.turnIndex })
  const focusedPlayerId = cameraSelection.turnIndex === game.turnIndex ? cameraSelection.playerId : active?.id ?? playerId
  if (game.phase === 'finished') return <FinalScreen game={game} playerId={playerId} role={role} onIntent={onIntent} onLeave={props.onLeave} />
  return <section ref={hudRoot} className={`game-screen estate-game game-hud phase-${game.phase}`}><header className="game-topbar"><Brand /><div className="round-counter"><small>RODADA</small><strong>{game.round}{game.mode === 'timed' && <><i>/</i>{game.turnLimit}</>}</strong></div><div className={`turn-banner ${myTurn ? 'mine' : ''}`}><Portrait id={active.characterId} size="small" /><div><small>{phaseLabel(game.phase)}</small><b>{myTurn ? 'SUA VEZ' : active.nickname}</b></div></div><div className="desktop-hud-controls"><button className="hud-toggle" aria-expanded={rosterOpen} onClick={() => setRosterOpen(!rosterOpen)}><Users /> JOGADORES</button><button className="hud-toggle" aria-expanded={journalOpen} onClick={() => setJournalOpen(!journalOpen)}><BookOpen /> HISTÓRICO</button><div className={`connection-pill ${connection}`}>{connection === 'connected' ? <Wifi /> : <WifiOff />}{role === 'local' ? 'LOCAL' : connection.toUpperCase()}</div><button className="icon-button" onClick={props.onReferences} aria-label="Abrir referências" title="Referências"><BookOpen /></button><button className="icon-button" onClick={props.onRules} aria-label="Abrir regras" title="Como jogar"><HelpCircle /></button><button className="icon-button" onClick={props.onSettings} aria-label="Abrir configurações" title="Configurações"><Settings /></button></div><button className="mobile-menu-button" aria-label="Menu da partida" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></header>
    {menuOpen && <nav className="mobile-hud-menu" aria-label="Menu da partida">
      <button onClick={() => { setRosterOpen(!rosterOpen); setJournalOpen(false); setMenuOpen(false) }}><Users /> Jogadores</button>
      <button onClick={() => { setJournalOpen(!journalOpen); setRosterOpen(false); setMenuOpen(false) }}><BookOpen /> Histórico</button>
      <button onClick={() => { props.onRules(); setMenuOpen(false) }}><HelpCircle /> Como jogar</button>
      <button onClick={() => { props.onReferences(); setMenuOpen(false) }}><BookOpen /> Referências</button>
      <button onClick={() => { props.onSettings(); setMenuOpen(false) }}><Settings /> Configurações</button>
    </nav>}
    <div className={`hud-roster ${rosterOpen ? "expanded" : ""}`}><PlayerLedger game={game} playerId={playerId} focusedPlayerId={focusedPlayerId} onFocus={focusedId => { setCameraSelection({ playerId: focusedId, turnIndex: game.turnIndex }); setRosterOpen(false) }} /></div>
    <div className="board-wrap"><Suspense fallback={<div className="board-loading"><div className="spinner" />Montando a cidade…</div>}><Board3D state={game} reducedMotion={props.reducedMotion} quality={props.quality} renderScale={props.renderScale} tipsy={tipsy} recenterSignal={props.recenterSignal} focusedPlayerId={focusedPlayerId} /></Suspense><div className="camera-tools"><button type="button" aria-label={tipsy ? "Ficar sóbrio" : "Tomar uma cervejinha"} title={tipsy ? "Ficar sóbrio" : "Tomar uma cervejinha"} className={`beer-button ${tipsy ? "active" : ""}`} aria-pressed={tipsy} onClick={() => setTipsy(!tipsy)}><Beer /><span>{tipsy ? "FICAR SÓBRIO" : "TOMAR UMA CERVEJINHA"}</span></button><button type="button" className="recenter" aria-label="Centralizar no meu personagem" title="Centralizar no meu personagem" onClick={() => { setCameraSelection({ playerId, turnIndex: game.turnIndex }); props.onRecenter() }}><Focus /><span>MEU PERSONAGEM</span></button></div><div className="camera-help"><span className="desktop-gesture-help">ARRASTE PARA GIRAR · BOTÃO DIREITO PARA DESLIZAR · SCROLL PARA APROXIMAR</span><span className="touch-gesture-help">1 DEDO MOVE · PINÇA APROXIMA · GIRE 2 DEDOS PARA GIRAR</span></div></div>
    <div className="resource-strip hud-resources"><div className="personal-cash"><b><CashValue key={game.id} amount={me.cash} /></b><small>CAIXA DISPONÍVEL</small></div><div><Landmark /><b>{netWorth(game, me)}</b><small>PATRIMÔNIO LÍQ.</small></div></div><aside ref={actionPanel} className={`action-panel ${sheetCollapsed ? 'action-collapsed' : ''}`} aria-label="Ações do turno"><button className="action-sheet-toggle" aria-expanded={!sheetCollapsed} onClick={() => setSheet({ phase: game.phase, collapsed: !sheetCollapsed })}>{sheetCollapsed ? 'MOSTRAR AÇÕES' : 'RECOLHER AÇÕES'}<span aria-hidden="true">{sheetCollapsed ? '＋' : '−'}</span></button><div className="action-sheet-body">
      {game.lastRoll && <div className={`dice-status ${game.lastRoll[0] === game.lastRoll[1] ? 'doubles' : ''}`}><span>DADOS OFICIAIS</span><b>{game.lastRoll[0]}</b><i>+</i><b>{game.lastRoll[1]}</b><strong>= {game.lastRoll[0] + game.lastRoll[1]}</strong>{game.lastRoll[0] === game.lastRoll[1] && <em>DUPLA · JOGUE NOVAMENTE</em>}</div>}
      <ActionContent game={game} me={me} myTurn={myTurn} role={role} sound={props.sound} onIntent={onIntent} onManage={() => setManagementOpen(true)} onTrade={() => setTradeOpen(true)} />
      {error && <div className="error-banner compact">{error}</div>}
    </div></aside>
    <TurnAnnouncement key={`${game.id}:${game.round}:${game.turnIndex}`} player={active} mine={myTurn} round={game.round} sound={props.sound} />
    {game.phase === 'event' && !game.pendingEventId && <EventDraw key={`${game.id}:${game.lastRollActionId}`} game={game} playerId={playerId} onIntent={onIntent} sound={props.sound} />}
    <MoneyFeedback key={game.id} game={game} playerId={playerId} sound={props.sound} />
    {journalOpen && <div className="hud-journal"><LogFeed game={game} /></div>}
    {managementOpen && <ManagementModal game={game} player={me} enabled={myTurn && game.phase === 'manage'} onIntent={onIntent} onClose={() => setManagementOpen(false)} />}
    {tradeOpen && <TradeModal game={game} player={me} enabled={myTurn && game.phase === 'manage'} onIntent={onIntent} onClose={() => setTradeOpen(false)} />}
    {role === 'guest' && connection !== 'connected' && <div className="pause-overlay"><div><WifiOff /><span className="eyebrow">PARTIDA PAUSADA</span><h2>O cartório saiu do ar.</h2><p>{props.detail || 'Nenhuma transação será executada. A reconexão e a recuperação do último checkpoint são automáticas.'}</p><div className="spinner" /><button className="text-button" onClick={props.onLeave}>Voltar ao início</button></div></div>}
  </section>
}

function PlayerLedger({ game, playerId, focusedPlayerId, onFocus }: { game: GameState; playerId: string; focusedPlayerId: string; onFocus: (playerId: string) => void }) {
  const ranking = [...game.players].sort((a, b) => netWorth(game, b) - netWorth(game, a))
  return <aside className="score-panel"><h2>CARTEIRA DE ATIVOS</h2><p className="score-formula">Patrimônio = caixa + imóveis + 50% das melhorias. Não é dinheiro disponível.</p>{ranking.map((player, index) => <button type="button" className={`score-player ${player.id === playerId ? 'me' : ''} ${player.id === focusedPlayerId ? 'focused' : ''} ${player.bankrupt ? 'bankrupt' : ''}`} key={player.id} onClick={() => onFocus(player.id)} aria-pressed={player.id === focusedPlayerId} aria-label={`${player.nickname} · Caixa ${MONEY(player.cash)} · Focar câmera`} title={`Focar câmera em ${player.nickname}`}><span className="rank">{index + 1}º</span><Portrait id={player.characterId} size="small" /><span className="score-identity"><b>{player.nickname} {index === 0 && !player.bankrupt && <Gem className="leader-jewel" aria-label="Líder por patrimônio líquido" />}</b><small>{player.bankrupt ? 'FALIDO' : player.jailTurns ? `PRESO · ${player.jailTurns}` : `${ownedProperties(game, player.id).length} escrituras`}</small></span><strong className="player-money"><CashValue amount={player.cash} compact /><small>MIL EM CAIXA</small><span className="player-net-worth">Patrimônio {MONEY(netWorth(game, player))}</span></strong></button>)}</aside>
}

function ActionContent({ game, me, myTurn, role, sound, onIntent, onManage, onTrade }: { game: GameState; me: Player; myTurn: boolean; role: Role; sound: boolean; onIntent: (intent: GameIntent) => void; onManage: () => void; onTrade: () => void }) {
  const active = game.players[game.turnIndex]; const tile = BOARD[active.position]; const property = tile.type === 'property' ? game.properties.find(value => value.tileId === tile.id) : undefined
  const send = (intent: Record<string, unknown>, id = me.id) => onIntent({ ...intent, actionId: uid(), playerId: id } as GameIntent)
  if (game.phase === 'paused') return <div className="action-content"><span className="phase-kicker">MERCADO SUSPENSO</span><h2>Aguardando reconexão.</h2><p>Nenhuma compra, cobrança ou negociação será processada até o jogador da vez retornar.</p></div>
  if (game.phase === 'rolling') return <div className="action-content"><span className="phase-kicker">01 · LANÇAR DADOS</span><h2>{active.jailTurns ? 'Tente uma dupla ou pague fiança.' : myTurn ? 'A cidade está esperando.' : `${active.nickname} prepara os dados.`}</h2><DiceReadout roll={game.lastRoll} /><button className="roll-button" disabled={!myTurn || active.isBot} onClick={() => send({ type: 'ROLL' })}><Dice5 /> ROLAR DOIS DADOS</button>{myTurn && active.jailTurns > 0 && <button className="panel-link" onClick={() => send({ type: 'PAY_BAIL' })}>Pagar fiança de {MONEY(80)} {active.jailCards ? '(usar carta)' : ''}</button>}</div>
  if (game.phase === 'property' && tile.type === 'property') return <div className="property-decision" style={{ '--group': GROUP_COLORS[tile.group] } as React.CSSProperties}><span className="phase-kicker">02 · IMÓVEL DISPONÍVEL</span><div className="deed"><span>{tile.district}</span><h2>{tile.name}</h2><div className="price">{MONEY(tile.price)}</div><dl><div><dt>Aluguel</dt><dd>{MONEY(tile.rents[0])}</dd></div><div><dt>Com bairro completo</dt><dd>{MONEY(tile.rents[0] * 2)}</dd></div><div><dt>Melhoria</dt><dd>{MONEY(tile.buildCost)}</dd></div><div><dt>Hipoteca</dt><dd>{MONEY(tile.mortgage)}</dd></div></dl></div><button className="buy-button" disabled={!myTurn || me.cash < tile.price || active.isBot} onClick={() => send({ type: 'BUY_PROPERTY' })}>COMPRAR · SOBRAM {MONEY(me.cash - tile.price)}</button><button className="auction-button" disabled={!myTurn || active.isBot} onClick={() => send({ type: 'DECLINE_PROPERTY' })}><Gavel /> RECUSAR E LEILOAR</button></div>
  if (game.phase === 'auction' && game.auction) {
    const auctionTile = PROPERTIES.find(value => value.id === game.auction!.tileId)!
    const passed = game.auction.passedPlayerIds.includes(me.id); const canAct = !me.bankrupt && !passed && !me.isBot
    return <div className="auction-panel"><span className="phase-kicker">LEILÃO AO VIVO</span><Gavel className="auction-hammer" /><h2>{auctionTile.name}</h2><div className="current-bid"><small>MAIOR LANCE</small><b>{MONEY(game.auction.highestBid)}</b><span>{game.players.find(player => player.id === game.auction?.highestBidderId)?.nickname || 'Nenhum lance'}</span></div><div className="bid-grid">{[10, 50, 100].map(increment => <button key={increment} disabled={!canAct || game.auction!.highestBid + increment > me.cash} onClick={() => send({ type: 'BID', amount: game.auction!.highestBid + increment })}>+ {MONEY(increment)}</button>)}</div><button className="panel-link danger" disabled={!canAct} onClick={() => send({ type: 'PASS_AUCTION' })}>{passed ? 'VOCÊ PASSOU' : 'SAIR DO LEILÃO'}</button><p>Transação única validada pelo host. O lance vencedor é debitado uma só vez.</p></div>
  }
  if (game.phase === 'event' && !game.pendingEventId) return <div className="action-content"><h2>{myTurn ? 'Escolha uma das três cartas.' : `${active.nickname} está escolhendo uma carta.`}</h2></div>
  if (game.phase === 'event' && game.pendingEventId) {
    const card = EVENTS.find(value => value.id === game.pendingEventId)!
    const preview = eventCashPreview(card, game, active)
    return <div key={`${game.lastRollActionId}:${card.id}`} className={`event-card event-${preview.tone}`}><EventRevealSound tone={preview.tone} sound={sound} /><div className={`event-outcome ${preview.tone}`}><b>{preview.tone === 'gain' ? 'SORTE' : preview.tone === 'loss' ? 'REVÉS' : 'ACONTECIMENTO'}</b><strong>{moneySentence(preview.amount, myTurn ? 'Você' : active.nickname)}</strong><small>{active.nickname}{preview.needsCash ? ` precisa levantar ${MONEY(-card.cash - active.cash)} para pagar` : ` · Caixa após a carta: ${MONEY(preview.balance)}`}</small></div><div className="event-breakdown">{card.cash !== 0 && <span>{card.cash > 0 ? 'Recebimento' : 'Pagamento'}: {MONEY(Math.abs(card.cash))}</span>}{card.collectFromEach && <span>Receba até {MONEY(card.collectFromEach)} de cada rival solvente · total agora: {MONEY(preview.fromRivals)}</span>}{preview.passingStart > 0 && <span>Passagem pelo início: +{MONEY(preview.passingStart)}</span>}{card.jail && <span>Vai para a prisão · sem cobrança imediata</span>}{card.moveTo !== undefined && <span>Avance para {BOARD[card.moveTo].name}</span>}</div><div className="card-stamp fact">FATO + FICÇÃO</div><span className="phase-kicker">ACONTECIMENTO</span><h2>{card.title}</h2><p className="satire">{card.satire}</p><div className="effect-box"><b>CONSEQUÊNCIA FICCIONAL</b><span>{card.fictionalEffect}</span></div><details><summary>Entenda a referência</summary><p><b>Fato documentado:</b> {card.fact}</p>{card.sourceIds.map(id => { const source = REFERENCES.find(value => value.id === id)!; return <a key={id} href={source.url} target="_blank" rel="noreferrer">{source.institution}: {source.title} ↗</a> })}</details><button className="roll-button" disabled={!myTurn || active.isBot} onClick={() => send({ type: 'RESOLVE_EVENT' })}>{preview.needsCash ? 'RESOLVER COBRANÇA' : card.jail ? 'IR PARA A PRISÃO' : preview.amount > 0 ? 'RECEBER E CONTINUAR' : preview.amount < 0 ? 'PAGAR E CONTINUAR' : 'CONTINUAR'}</button></div>
  }
  if (game.phase === 'trade' && game.trade) {
    const from = game.players.find(player => player.id === game.trade?.fromId)!; const to = game.players.find(player => player.id === game.trade?.toId)!
    return <div className="trade-review"><Handshake /><span className="phase-kicker">PROPOSTA EM CARTÓRIO</span><h2>{from.nickname} ↔ {to.nickname}</h2><TradeSide title={`${from.nickname} oferece`} cash={game.trade.offeredCash} ids={game.trade.offeredPropertyIds} /><TradeSide title={`${from.nickname} pede`} cash={game.trade.requestedCash} ids={game.trade.requestedPropertyIds} />{me.id === to.id && <div className="split-actions"><button onClick={() => send({ type: 'ACCEPT_TRADE' })}>ACEITAR</button><button onClick={() => send({ type: 'REJECT_TRADE' })}>RECUSAR</button></div>} {me.id === from.id && <button className="panel-link danger" onClick={() => send({ type: 'REJECT_TRADE' })}>CANCELAR PROPOSTA</button>} {role === 'local' && to.isBot && <p>O bot responderá automaticamente.</p>}</div>
  }
  if (game.phase === 'debt' && game.debt) {
    const debtor = game.players.find(player => player.id === game.debt?.playerId)!
    return <div className="debt-panel"><AlertTriangle /><span className="phase-kicker">CAIXA NEGATIVO IMINENTE</span><h2>{debtor.nickname} deve {MONEY(game.debt.amount)}</h2><p>{game.debt.reason}. Hipoteque ativos livres para cobrir a dívida ou declare falência.</p><button className="secondary-button" disabled={me.id !== debtor.id || debtor.isBot} onClick={onManage}><Landmark /> GERIR HIPOTECAS</button><button className="bankruptcy-button" disabled={me.id !== debtor.id || debtor.isBot} onClick={() => send({ type: 'DECLARE_BANKRUPTCY' })}>DECLARAR FALÊNCIA</button></div>
  }
  return <div className="manage-panel"><span className="phase-kicker">04 · ADMINISTRAR</span><h2>{tile.name}</h2>{tile.type === 'property' && property?.ownerId && <div className="rent-receipt"><span>{property.ownerId === active.id ? 'IMÓVEL PRÓPRIO' : 'ALUGUEL PROCESSADO'}</span><b>{property.mortgaged ? 'HIPOTECADO' : `${MONEY(propertyRent(game, tile))} de aluguel`}</b></div>}<p>Construa em bairros completos, negocie escrituras ou ajuste suas hipotecas antes de encerrar.</p><div className="manage-actions"><button disabled={!myTurn || active.isBot} onClick={onManage}><Building2 /> PROPRIEDADES</button><button disabled={!myTurn || active.isBot} onClick={onTrade}><Handshake /> NEGOCIAR</button></div><button className="end-turn" disabled={!myTurn || active.isBot} onClick={() => send({ type: 'END_TURN' })}>ENCERRAR TURNO →</button></div>
}

function DiceReadout({ roll }: { roll?: [number, number] }) { return <div className="dice-readout"><span>{roll?.[0] ?? '?'}</span><b>+</b><span>{roll?.[1] ?? '?'}</span><strong>{roll ? roll[0] + roll[1] : ''}</strong></div> }
function TradeSide({ title, cash, ids }: { title: string; cash: number; ids: string[] }) { return <div className="trade-side"><b>{title}</b><span>{MONEY(cash)}{ids.length ? ` + ${ids.map(id => PROPERTIES.find(property => property.id === id)?.name).join(', ')}` : ''}</span></div> }

function LogFeed({ game }: { game: GameState }) { return <div className="log-feed"><span>REGISTRO DO CARTÓRIO</span>{game.logs.slice(0, 5).map((entry, index) => <p key={entry.id} className={`${entry.tone} ${index === 0 ? 'latest' : ''}`}>{entry.text}</p>)}</div> }

function ManagementModal({ game, player, enabled, onIntent, onClose }: { game: GameState; player: Player; enabled: boolean; onIntent: (intent: GameIntent) => void; onClose: () => void }) {
  const assets = ownedProperties(game, player.id)
  return <ModalShell onClose={onClose} wide>
    <span className="eyebrow">CARTEIRA DE ESCRITURAS</span><h2>Administrar patrimônio</h2>
    <div className="management-summary"><span>Caixa <b>{MONEY(player.cash)}</b></span><span>Patrimônio líquido <b>{MONEY(netWorth(game, player))}</b></span><span>Imóveis <b>{assets.length}</b></span></div>
    <div className="asset-list">{assets.length === 0 && <div className="empty-state">Nenhuma escritura. Ainda dá para vencer no leilão.</div>}{assets.map(asset => {
      const tile = PROPERTIES.find(value => value.id === asset.tileId)!
      const complete = ownsGroup(game, player.id, tile.group)
      return <article key={asset.tileId} style={{ '--group': GROUP_COLORS[tile.group] } as React.CSSProperties}>
        <div><small>{tile.district} · {complete ? 'BAIRRO COMPLETO' : tile.group}</small><h3>{tile.name}</h3><span>{asset.mortgaged ? 'HIPOTECADO · SEM ALUGUEL' : `Aluguel atual: ${MONEY(propertyRent(game, tile))}`}</span></div>
        <div className="building-level"><span>{'▰'.repeat(asset.level)}{'▱'.repeat(4 - asset.level)}</span><small>NÍVEL {asset.level}/4</small></div>
        <div className="asset-actions">
          <button disabled={!enabled || !complete || asset.mortgaged || asset.level >= 4} onClick={() => onIntent({ type: 'BUILD', actionId: uid(), playerId: player.id, tileId: tile.id })}>Construir · {MONEY(tile.buildCost)}</button>
          {asset.level > 0 && <button disabled={!enabled} onClick={() => onIntent({ type: 'SELL_BUILDING', actionId: uid(), playerId: player.id, tileId: tile.id })}>Vender melhoria · +{MONEY(Math.floor(tile.buildCost / 2))}</button>}
          {asset.mortgaged
            ? <button disabled={!enabled || player.cash < Math.ceil(tile.mortgage * 1.1)} onClick={() => onIntent({ type: 'UNMORTGAGE', actionId: uid(), playerId: player.id, tileId: tile.id })}>Quitar · {MONEY(Math.ceil(tile.mortgage * 1.1))}</button>
            : <button disabled={!enabled || asset.level > 0} onClick={() => onIntent({ type: 'MORTGAGE', actionId: uid(), playerId: player.id, tileId: tile.id })}>Hipotecar · +{MONEY(tile.mortgage)}</button>}
        </div>
      </article>
    })}</div><button className="primary-button" onClick={onClose}>VOLTAR AO TABULEIRO</button>
  </ModalShell>
}

function TradeModal({ game, player, enabled, onIntent, onClose }: { game: GameState; player: Player; enabled: boolean; onIntent: (intent: GameIntent) => void; onClose: () => void }) {
  const rivals = game.players.filter(value => value.id !== player.id && !value.bankrupt); const [targetId, setTargetId] = useState(rivals[0]?.id || '')
  const [offeredCash, setOfferedCash] = useState(0); const [requestedCash, setRequestedCash] = useState(0); const [offered, setOffered] = useState<string[]>([]); const [requested, setRequested] = useState<string[]>([])
  const target = game.players.find(value => value.id === targetId)
  const toggle = (list: string[], set: (value: string[]) => void, id: string) => set(list.includes(id) ? list.filter(value => value !== id) : [...list, id])
  return <ModalShell onClose={onClose} wide><span className="eyebrow">MESA DE NEGOCIAÇÃO</span><h2>Trocar dinheiro e escrituras</h2><label className="form-label">NEGOCIAR COM<select value={targetId} onChange={event => { setTargetId(event.target.value); setRequested([]) }}>{rivals.map(rival => <option key={rival.id} value={rival.id}>{rival.nickname} · caixa {MONEY(rival.cash)}</option>)}</select></label><div className="trade-builder"><section><h3>VOCÊ OFERECE</h3><MoneyInput value={offeredCash} max={player.cash} onChange={setOfferedCash} />{ownedProperties(game, player.id).map(asset => <PropertyCheck key={asset.tileId} assetId={asset.tileId} checked={offered.includes(asset.tileId)} disabled={game.properties.find(value => value.tileId === asset.tileId)!.level > 0} onChange={() => toggle(offered, setOffered, asset.tileId)} />)}</section><section><h3>VOCÊ PEDE</h3><MoneyInput value={requestedCash} max={target?.cash ?? 0} onChange={setRequestedCash} />{target && ownedProperties(game, target.id).map(asset => <PropertyCheck key={asset.tileId} assetId={asset.tileId} checked={requested.includes(asset.tileId)} disabled={game.properties.find(value => value.tileId === asset.tileId)!.level > 0} onChange={() => toggle(requested, setRequested, asset.tileId)} />)}</section></div><div className="trade-impact"><b>IMPACTO PREVISTO NO SEU CAIXA</b><span>{MONEY(player.cash)} → {MONEY(player.cash - offeredCash + requestedCash)}</span></div><button className="primary-button" disabled={!enabled || !targetId || (offeredCash === 0 && requestedCash === 0 && !offered.length && !requested.length)} onClick={() => { onIntent({ type: 'PROPOSE_TRADE', actionId: uid(), playerId: player.id, toId: targetId, offeredCash, requestedCash, offeredPropertyIds: offered, requestedPropertyIds: requested }); onClose() }}>ENVIAR PROPOSTA</button></ModalShell>
}
function MoneyInput({ value, max, onChange }: { value: number; max: number; onChange: (value: number) => void }) { return <label className="money-input">DINHEIRO<input type="number" min="0" max={max} step="10" value={value} onChange={event => onChange(Math.max(0, Math.min(max, Number(event.target.value))))} /><span>máx. {MONEY(max)}</span></label> }
function PropertyCheck({ assetId, checked, disabled, onChange }: { assetId: string; checked: boolean; disabled: boolean; onChange: () => void }) { const tile = PROPERTIES.find(value => value.id === assetId)!; return <label className={`property-check ${disabled ? 'disabled' : ''}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} /><i style={{ background: GROUP_COLORS[tile.group] }} /><span><b>{tile.name}</b><small>{disabled ? 'possui melhorias' : `${MONEY(tile.price)} · ${tile.district}`}</small></span></label> }

function FinalScreen({ game, playerId, role, onIntent, onLeave }: { game: GameState; playerId: string; role: Role; onIntent: (intent: GameIntent) => void; onLeave: () => void }) {
  const ranking = [...game.players].sort((a, b) => netWorth(game, b) - netWorth(game, a)); const winner = ranking[0]
  return <section className="final-screen"><span className="eyebrow">BALANÇO ENCERRADO</span><Crown className="winner-crown" /><h1>{winner.nickname}<br /><em>é dono da cidade.</em></h1><p>{game.mode === 'elimination' ? 'Os adversários quebraram. O monopólio venceu.' : 'O relógio zerou e o maior patrimônio líquido venceu.'}</p><div className="final-ranking">{ranking.map((player, index) => <article key={player.id} className={index === 0 ? 'winner' : ''}><span>{index + 1}º</span><Portrait id={player.characterId} /><div><b>{player.nickname}</b><small>{player.cash} mil em caixa · {ownedProperties(game, player.id).length} imóveis {player.bankrupt && '· FALIDO'}</small></div><strong>{netWorth(game, player)}<small> MIL</small></strong></article>)}</div><div className="final-actions">{role !== 'guest' && <button className="primary-button" onClick={() => onIntent({ type: 'REMATCH', actionId: uid(), playerId })}><RotateCcw /> NOVA SOCIEDADE</button>}<button className="secondary-button" onClick={onLeave}>SAIR DO MERCADO</button></div></section>
}

function ModalShell({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) { return <div className="modal-backdrop" onMouseDown={onClose}><div className={`modal ${wide ? 'wide' : ''}`} onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={onClose}><X /></button>{children}</div></div> }
function RulesModal({ onClose }: { onClose: () => void }) { return <ModalShell onClose={onClose}><span className="eyebrow">MANUAL DO ESPECULADOR</span><h2>Como dominar Bolsonópolis</h2><div className="rules-grid"><article><b>1</b><h3>Role e compre</h3><p>Dois dados movem seu personagem. Imóveis recusados vão obrigatoriamente a leilão.</p></article><article><b>2</b><h3>Cobre aluguel</h3><p>Complete grupos para dobrar o aluguel básico e liberar até quatro melhorias.</p></article><article><b>3</b><h3>Negocie e respire</h3><p>Troque dinheiro e escrituras. Hipotecas não cobram aluguel, mas evitam falências.</p></article><article><b>4</b><h3>Quebre os rivais</h3><p>Vença por eliminação ou, no modo limitado, pelo maior patrimônio líquido.</p></article></div><div className="formula">PATRIMÔNIO = CAIXA + IMÓVEIS + 50% DAS MELHORIAS · CAIXA É O DINHEIRO DISPONÍVEL</div><h3>Fatos não são efeitos</h3><p>Cartas separam o acontecimento documentado da consequência inventada. “Entenda a referência” abre a fonte primária oficial em outra aba.</p><button className="primary-button" onClick={onClose}>ENTENDI AS LETRAS MIÚDAS</button></ModalShell> }
function ReferencesModal({ onClose }: { onClose: () => void }) { return <ModalShell onClose={onClose} wide><span className="eyebrow">ARQUIVO DE REFERÊNCIAS</span><h2>Fato, contexto e fonte</h2><p className="reference-intro">Este arquivo não afirma além do documento vinculado. Alegações, relatórios, investigações e decisões são descritos conforme a natureza registrada pela instituição de origem. Efeitos do jogo são ficção satírica.</p><div className="reference-list">{REFERENCES.map(source => <article key={source.id}><span>{source.institution} · {referenceKind(source.kind)}</span><h3>{source.title}</h3><p>{source.context}</p><small>Consultado em {source.accessedAt.split('-').reverse().join('/')}</small><a href={source.url} target="_blank" rel="noreferrer">ABRIR FONTE OFICIAL ↗</a></article>)}</div><button className="primary-button" onClick={onClose}>VOLTAR</button></ModalShell> }
function SettingsModal({ sound, setSound, reducedMotion, setReducedMotion, quality, setQuality, renderScale, setRenderScale, onClose }: { sound: boolean; setSound: (value: boolean) => void; reducedMotion: boolean; setReducedMotion: (value: boolean) => void; quality: 'low' | 'high'; setQuality: (value: 'low' | 'high') => void; renderScale: number; setRenderScale: (value: number) => void; onClose: () => void }) { return <ModalShell onClose={onClose}><span className="eyebrow">CONFORTO E DESEMPENHO</span><h2>Ajustes da maquete</h2><Setting icon={sound ? <Volume2 /> : <VolumeX />} title="Sons" detail="Dados, caixa, aluguel e alertas" value={sound ? 'LIGADO' : 'MUDO'} onClick={() => setSound(!sound)} /><Setting icon={<Landmark />} title="Qualidade 3D" detail="Sombras e detalhes da cena" value={quality === 'high' ? 'ALTA' : 'ECONÔMICA'} onClick={() => setQuality(quality === 'high' ? 'low' : 'high')} /><div className="setting-row resolution-setting"><label htmlFor="render-scale"><b>Resolução 3D</b><small>Mais nitidez exige mais da placa de vídeo.</small></label><select id="render-scale" value={renderScale} onChange={event => setRenderScale(Number(event.target.value))}>{RESOLUTION_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><Setting icon={<RotateCcw />} title="Reduzir movimentos" detail="Acelera transições e remove balanços" value={reducedMotion ? 'ATIVO' : 'NORMAL'} onClick={() => setReducedMotion(!reducedMotion)} /><button className="primary-button" onClick={onClose}>SALVAR</button></ModalShell> }
function Setting({ icon, title, detail, value, onClick }: { icon: React.ReactNode; title: string; detail: string; value: string; onClick: () => void }) { return <div className="setting-row"><div>{icon}<span><b>{title}</b><small>{detail}</small></span></div><button onClick={onClick}>{value}</button></div> }
function phaseLabel(phase: GameState['phase']) { return ({ rolling: '01 · LANÇAR', property: '02 · COMPRAR', auction: 'LEILÃO', event: '03 · RESOLVER', manage: '04 · ADMINISTRAR', trade: 'NEGOCIAÇÃO', debt: 'DÍVIDA', lobby: 'LOBBY', finished: 'FIM', paused: 'PAUSADO' } as Record<string, string>)[phase] }
function referenceKind(kind: (typeof REFERENCES)[number]['kind']) { return ({ decision: 'DECISÃO', report: 'RELATÓRIO', 'official-clarification': 'ESCLARECIMENTO OFICIAL' } as const)[kind] }
