export type CharacterId = 'jair' | 'michelle' | 'flavio' | 'eduardo' | 'renan'
export type GamePhase = 'lobby' | 'rolling' | 'property' | 'auction' | 'event' | 'manage' | 'trade' | 'debt' | 'finished' | 'paused'
export type ConnectionStatus = 'offline' | 'connecting' | 'connected' | 'reconnecting' | 'error'
export type GameMode = 'elimination' | 'timed'
export type PropertyGroup = 'orla' | 'zona-sul' | 'centro' | 'barra' | 'poder' | 'midia'

export interface Character {
  id: CharacterId
  name: string
  epithet: string
  ability: string
  color: string
  accent: string
  startingCash: number
}

export interface Player {
  id: string
  nickname: string
  characterId: CharacterId
  position: number
  cash: number
  ready: boolean
  isBot: boolean
  connected: boolean
  jailTurns: number
  jailCards: number
  bankrupt: boolean
  doublesInRow: number
  abilityUsed: boolean
}

export interface PropertyState {
  tileId: string
  ownerId?: string
  level: number
  mortgaged: boolean
}

export interface PropertyTile {
  id: string
  index: number
  type: 'property'
  name: string
  district: string
  group: PropertyGroup
  price: number
  rents: readonly [number, number, number, number, number]
  buildCost: number
  mortgage: number
}

export interface SpecialTile {
  id: string
  index: number
  type: 'start' | 'event' | 'tax' | 'jail' | 'go-to-jail' | 'rest'
  name: string
  amount?: number
}
export type BoardTile = PropertyTile | SpecialTile

export interface ReferenceSource {
  id: string
  title: string
  institution: string
  kind: 'decision' | 'report' | 'official-clarification'
  url: string
  accessedAt: string
  context: string
}

export interface EventCard {
  id: string
  title: string
  satire: string
  fact: string
  fictionalEffect: string
  sourceIds: string[]
  cash: number
  moveTo?: number
  jail?: boolean
  collectFromEach?: number
}

export interface AuctionState {
  tileId: string
  highestBid: number
  highestBidderId?: string
  passedPlayerIds: string[]
  initiatorId: string
}

export interface TradeOffer {
  id: string
  fromId: string
  toId: string
  offeredCash: number
  requestedCash: number
  offeredPropertyIds: string[]
  requestedPropertyIds: string[]
  status: 'pending' | 'accepted' | 'rejected'
}

export interface DebtState {
  playerId: string
  creditorId?: string
  amount: number
  reason: string
}

export interface GameLog {
  id: string
  text: string
  tone: 'good' | 'bad' | 'neutral'
  amount?: number
  fromId?: string
  toId?: string
}

export interface GameState {
  id: string
  roomCode?: string
  version: number
  seed: number
  phase: GamePhase
  phaseBeforePause?: GamePhase
  mode: GameMode
  turnLimit: number
  round: number
  turnIndex: number
  players: Player[]
  properties: PropertyState[]
  auction?: AuctionState
  pendingEventId?: string
  pendingEventChoices?: string[]
  chosenEventIndex?: number
  trade?: TradeOffer
  debt?: DebtState
  lastRoll?: [number, number]
  lastRollActionId?: string
  lastActionId?: string
  processedActions: string[]
  logs: GameLog[]
  winnerIds: string[]
  createdAt: number
}

type PlayerAction = { actionId: string; playerId: string }
export type GameIntent =
  | { type: 'ADD_PLAYER'; actionId: string; player: Pick<Player, 'id' | 'nickname' | 'characterId' | 'isBot'> }
  | ({ type: 'REMOVE_PLAYER' } & PlayerAction)
  | ({ type: 'SET_READY'; ready: boolean } & PlayerAction)
  | ({ type: 'SET_CHARACTER'; characterId: CharacterId } & PlayerAction)
  | ({ type: 'SET_MODE'; mode: GameMode; turnLimit?: number } & PlayerAction)
  | ({ type: 'START_GAME' } & PlayerAction)
  | ({ type: 'ROLL' } & PlayerAction)
  | ({ type: 'BUY_PROPERTY' } & PlayerAction)
  | ({ type: 'DECLINE_PROPERTY' } & PlayerAction)
  | ({ type: 'BID'; amount: number } & PlayerAction)
  | ({ type: 'PASS_AUCTION' } & PlayerAction)
  | ({ type: 'CHOOSE_EVENT'; index: number } & PlayerAction)
  | ({ type: 'RESOLVE_EVENT' } & PlayerAction)
  | ({ type: 'END_TURN' } & PlayerAction)
  | ({ type: 'BUILD'; tileId: string } & PlayerAction)
  | ({ type: 'SELL_BUILDING'; tileId: string } & PlayerAction)
  | ({ type: 'MORTGAGE'; tileId: string } & PlayerAction)
  | ({ type: 'UNMORTGAGE'; tileId: string } & PlayerAction)
  | ({ type: 'PROPOSE_TRADE'; toId: string; offeredCash: number; requestedCash: number; offeredPropertyIds: string[]; requestedPropertyIds: string[] } & PlayerAction)
  | ({ type: 'ACCEPT_TRADE' } & PlayerAction)
  | ({ type: 'REJECT_TRADE' } & PlayerAction)
  | ({ type: 'DECLARE_BANKRUPTCY' } & PlayerAction)
  | ({ type: 'PAY_BAIL' } & PlayerAction)
  | ({ type: 'REMATCH' } & PlayerAction)
  | ({ type: 'SET_CONNECTED'; connected: boolean } & PlayerAction)

export interface WireMessage {
  type: 'hello' | 'intent' | 'state' | 'sync-request' | 'error' | 'ping'
  actionId?: string
  playerId?: string
  nickname?: string
  characterId?: CharacterId
  stateVersion?: number
  intent?: GameIntent
  state?: GameState
  message?: string
  sessionToken?: string
}
