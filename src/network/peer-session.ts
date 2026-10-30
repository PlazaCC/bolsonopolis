import Peer, { type DataConnection, util } from 'peerjs'
import type { CharacterId, ConnectionStatus, WireMessage } from '../types'
import { parseConnectionIdentity, parseWireMessage } from './protocol'

type EnvelopeHandler = (message: WireMessage, connection?: DataConnection) => void
type StatusHandler = (status: ConnectionStatus, detail?: string) => void
type PresenceHandler = (playerId: string, connected: boolean) => void

function peerOptions() {
  const iceServers: RTCIceServer[] = [...(util.defaultConfig.iceServers ?? [])]
  if (import.meta.env.VITE_TURN_URL) {
    iceServers.push({
      urls: import.meta.env.VITE_TURN_URL,
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    })
  }
  return { debug: 1 as const, config: { ...util.defaultConfig, iceServers } }
}

export class PeerSession {
  private peer?: Peer
  private hostConnection?: DataConnection
  private guests = new Map<string, DataConnection>()
  private reconnectTimer?: number
  private destroyed = false
  private role: 'host' | 'guest' = 'guest'
  private roomCode = ''
  private identity?: { playerId: string; nickname: string; characterId: CharacterId; sessionToken: string }

  constructor(private onEnvelope: EnvelopeHandler, private onStatus: StatusHandler, private onPresence?: PresenceHandler) {}

  startHost(roomCode: string) {
    this.role = 'host'
    this.roomCode = roomCode
    this.onStatus('connecting')
    this.peer = new Peer(`bolsonopolis-${roomCode.toLowerCase()}`, peerOptions())
    this.peer.on('open', () => this.onStatus('connected'))
    this.peer.on('connection', connection => this.acceptGuest(connection))
    this.peer.on('disconnected', () => {
      this.onStatus('reconnecting', 'Sinalização interrompida; conexões abertas podem continuar.')
      if (!this.destroyed) this.peer?.reconnect()
    })
    this.peer.on('error', error => this.onStatus('error', this.describeError(error.type)))
  }

  startGuest(roomCode: string, identity: NonNullable<PeerSession['identity']>) {
    this.role = 'guest'
    this.roomCode = roomCode
    this.identity = identity
    this.onStatus('connecting')
    this.peer = new Peer(peerOptions())
    this.peer.on('open', () => this.connectToHost())
    this.peer.on('disconnected', () => {
      this.onStatus('reconnecting', 'Tentando reencontrar a sala…')
      if (!this.destroyed) this.peer?.reconnect()
    })
    this.peer.on('error', error => {
      this.onStatus('error', this.describeError(error.type))
      if (error.type === 'peer-unavailable' || error.type === 'network') this.scheduleReconnect()
    })
  }

  private acceptGuest(connection: DataConnection) {
    connection.on('open', () => {
      this.guests.set(connection.peer, connection)
      const identity = parseConnectionIdentity(connection.metadata)
      if (identity) this.onPresence?.(identity.playerId, true)
      void connection.send({ type: 'sync-request' } satisfies WireMessage)
    })
    connection.on('data', data => this.handleData(data, connection))
    connection.on('close', () => this.removeGuest(connection))
    connection.on('error', () => this.removeGuest(connection))
  }

  private connectToHost() {
    if (!this.peer || !this.identity || this.destroyed) return
    this.onStatus('connecting')
    const connection = this.peer.connect(`bolsonopolis-${this.roomCode.toLowerCase()}`, {
      reliable: true,
      serialization: 'json',
      label: 'estado-oficial',
      metadata: { playerId: this.identity.playerId, sessionToken: this.identity.sessionToken },
    })
    this.hostConnection = connection
    connection.on('open', () => {
      this.onStatus('connected')
      void connection.send({ type: 'hello', ...this.identity } satisfies WireMessage)
    })
    connection.on('data', data => this.handleData(data, connection))
    connection.on('close', () => {
      if (!this.destroyed) {
        this.onStatus('reconnecting', 'O host saiu do ar. A partida está pausada até a volta dele.')
        this.scheduleReconnect()
      }
    })
    connection.on('error', () => {
      this.onStatus('reconnecting', 'Não foi possível atravessar esta rede. Tentando novamente…')
      this.scheduleReconnect()
    })
  }

  private scheduleReconnect() {
    window.clearTimeout(this.reconnectTimer)
    this.reconnectTimer = window.setTimeout(() => this.connectToHost(), 3000)
  }

  private handleData(data: unknown, connection: DataConnection) {
    const message = parseWireMessage(data)
    if (message) this.onEnvelope(message, connection)
    else if (this.role === 'host' && connection.open) void connection.send({ type: 'error', message: 'Mensagem inválida recusada pelo host.' } satisfies WireMessage)
    else this.onStatus('error', 'O host enviou uma mensagem inválida. A partida foi protegida.')
  }

  private removeGuest(connection: DataConnection) {
    this.guests.delete(connection.peer)
    const identity = parseConnectionIdentity(connection.metadata)
    if (!identity) return
    const stillConnected = [...this.guests.values()].some(guest => guest.open && parseConnectionIdentity(guest.metadata)?.playerId === identity.playerId)
    if (!stillConnected) this.onPresence?.(identity.playerId, false)
  }

  send(message: WireMessage, connection?: DataConnection) {
    if (connection?.open) void connection.send(message)
    else if (this.role === 'guest' && this.hostConnection?.open) void this.hostConnection.send(message)
  }

  broadcast(message: WireMessage) {
    this.guests.forEach(connection => { if (connection.open) void connection.send(message) })
  }

  private describeError(type: string) {
    if (type === 'unavailable-id') return 'Este código de sala já está em uso. Crie outro.'
    if (type === 'peer-unavailable') return 'Sala não encontrada. Confira o código ou aguarde o host voltar.'
    if (type === 'network') return 'Falha de rede. Redes corporativas podem exigir um servidor TURN.'
    if (type === 'webrtc') return 'O navegador bloqueou a conexão direta. Tente outra rede ou configure TURN.'
    return `Falha de conexão (${type}).`
  }

  destroy() {
    this.destroyed = true
    window.clearTimeout(this.reconnectTimer)
    this.hostConnection?.close()
    this.guests.forEach(connection => connection.close())
    this.peer?.destroy()
  }
}

export function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, value => alphabet[value % alphabet.length]).join('')
}

export function makeId(prefix = 'jogador') {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}
