import { BOARD, CHARACTERS, EVENTS, PROPERTIES } from '../game/content'
import type { GameIntent, GameState, WireMessage } from '../types'

const MESSAGE_TYPES = new Set<WireMessage['type']>(['hello', 'intent', 'state', 'sync-request', 'error', 'ping'])
const CHARACTER_IDS = new Set(Object.keys(CHARACTERS))
const PHASES = new Set<GameState['phase']>(['lobby', 'rolling', 'property', 'auction', 'event', 'manage', 'trade', 'debt', 'finished', 'paused'])
const PROPERTY_IDS = new Set(PROPERTIES.map(property => property.id))
const EVENT_IDS = new Set(EVENTS.map(event => event.id))
const MAX_MESSAGE_TEXT = 240

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isText(value: unknown, maxLength: number, minLength = 0): value is string {
  return typeof value === 'string' && value.length >= minLength && value.length <= maxLength
}

function isIdentifier(value: unknown): value is string {
  return isText(value, 64, 2) && /^[a-zA-Z0-9_-]+$/.test(value)
}

function isInteger(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum
}

function isActionBase(value: Record<string, unknown>) {
  return isText(value.actionId, 100, 1) && isIdentifier(value.playerId)
}

function isMoney(value: unknown) {
  return isInteger(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 24 && value.every(item => isText(item, 80, 1))
}

export function isGameIntent(value: unknown): value is GameIntent {
  if (!isRecord(value) || !isText(value.type, 40, 1) || !isText(value.actionId, 100, 1)) return false
  if (value.type === 'ADD_PLAYER') {
    if (!isRecord(value.player)) return false
    return isIdentifier(value.player.id)
      && isText(value.player.nickname, 18, 2)
      && typeof value.player.characterId === 'string'
      && CHARACTER_IDS.has(value.player.characterId)
      && typeof value.player.isBot === 'boolean'
  }
  if (!isActionBase(value)) return false
  switch (value.type) {
    case 'REMOVE_PLAYER':
    case 'START_GAME':
    case 'ROLL':
    case 'BUY_PROPERTY':
    case 'DECLINE_PROPERTY':
    case 'PASS_AUCTION':
    case 'RESOLVE_EVENT':
    case 'END_TURN':
    case 'ACCEPT_TRADE':
    case 'REJECT_TRADE':
    case 'DECLARE_BANKRUPTCY':
    case 'PAY_BAIL':
    case 'REMATCH':
      return true
    case 'CHOOSE_EVENT':
      return isInteger(value.index, 0, 2)
    case 'SET_READY':
      return typeof value.ready === 'boolean'
    case 'SET_CONNECTED':
      return typeof value.connected === 'boolean'
    case 'SET_CHARACTER':
      return typeof value.characterId === 'string' && CHARACTER_IDS.has(value.characterId)
    case 'SET_MODE':
      return (value.mode === 'elimination' || value.mode === 'timed') && (value.turnLimit === undefined || isMoney(value.turnLimit))
    case 'BID':
      return isMoney(value.amount)
    case 'BUILD':
    case 'SELL_BUILDING':
    case 'MORTGAGE':
    case 'UNMORTGAGE':
      return isText(value.tileId, 80, 1)
    case 'PROPOSE_TRADE':
      return isIdentifier(value.toId)
        && isMoney(value.offeredCash)
        && isMoney(value.requestedCash)
        && isStringArray(value.offeredPropertyIds)
        && value.offeredPropertyIds.every(id => PROPERTY_IDS.has(id))
        && isStringArray(value.requestedPropertyIds)
        && value.requestedPropertyIds.every(id => PROPERTY_IDS.has(id))
    default:
      return false
  }
}

function isPlayer(value: unknown) {
  if (!isRecord(value)) return false
  return isIdentifier(value.id)
    && isText(value.nickname, 18, 2)
    && typeof value.characterId === 'string'
    && CHARACTER_IDS.has(value.characterId)
    && isInteger(value.position, 0, BOARD.length - 1)
    && isMoney(value.cash)
    && typeof value.ready === 'boolean'
    && typeof value.isBot === 'boolean'
    && typeof value.connected === 'boolean'
    && isInteger(value.jailTurns, 0, 3)
    && isInteger(value.jailCards, 0, 10)
    && typeof value.bankrupt === 'boolean'
    && isInteger(value.doublesInRow, 0, 3)
    && typeof value.abilityUsed === 'boolean'
}

function isPropertyState(value: unknown, playerIds: Set<string>) {
  if (!isRecord(value) || !isText(value.tileId, 80, 1) || !PROPERTY_IDS.has(value.tileId)) return false
  return (value.ownerId === undefined || (isIdentifier(value.ownerId) && playerIds.has(value.ownerId)))
    && isInteger(value.level, 0, 4)
    && typeof value.mortgaged === 'boolean'
}

function isAuction(value: unknown, playerIds: Set<string>) {
  if (value === undefined) return true
  if (!isRecord(value) || !isText(value.tileId, 80, 1) || !PROPERTY_IDS.has(value.tileId)) return false
  return isMoney(value.highestBid)
    && (value.highestBidderId === undefined || (isIdentifier(value.highestBidderId) && playerIds.has(value.highestBidderId)))
    && Array.isArray(value.passedPlayerIds)
    && value.passedPlayerIds.length <= 5
    && value.passedPlayerIds.every(id => isIdentifier(id) && playerIds.has(id))
    && isIdentifier(value.initiatorId)
    && playerIds.has(value.initiatorId)
}

function isTrade(value: unknown, playerIds: Set<string>) {
  if (value === undefined) return true
  if (!isRecord(value) || !isText(value.id, 100, 1)) return false
  return isIdentifier(value.fromId)
    && playerIds.has(value.fromId)
    && isIdentifier(value.toId)
    && playerIds.has(value.toId)
    && value.fromId !== value.toId
    && isMoney(value.offeredCash)
    && isMoney(value.requestedCash)
    && isStringArray(value.offeredPropertyIds)
    && value.offeredPropertyIds.every(id => PROPERTY_IDS.has(id))
    && new Set(value.offeredPropertyIds).size === value.offeredPropertyIds.length
    && isStringArray(value.requestedPropertyIds)
    && value.requestedPropertyIds.every(id => PROPERTY_IDS.has(id))
    && new Set(value.requestedPropertyIds).size === value.requestedPropertyIds.length
    && (value.status === 'pending' || value.status === 'accepted' || value.status === 'rejected')
}

function isDebt(value: unknown, playerIds: Set<string>) {
  if (value === undefined) return true
  if (!isRecord(value)) return false
  return isIdentifier(value.playerId)
    && playerIds.has(value.playerId)
    && (value.creditorId === undefined || (isIdentifier(value.creditorId) && playerIds.has(value.creditorId)))
    && isMoney(value.amount)
    && isText(value.reason, 240, 1)
}

function isLog(value: unknown, playerIds: Set<string>) {
  if (!isRecord(value)) return false
  return isText(value.id, 100, 1)
    && isText(value.text, 500, 1)
    && (value.tone === 'good' || value.tone === 'bad' || value.tone === 'neutral')
    && (value.amount === undefined || isMoney(value.amount))
    && (value.fromId === undefined || (isIdentifier(value.fromId) && playerIds.has(value.fromId)))
    && (value.toId === undefined || (isIdentifier(value.toId) && playerIds.has(value.toId)))
}

export function isGameStateSnapshot(value: unknown): value is GameState {
  if (!isRecord(value)
    || !isText(value.id, 100, 1)
    || (value.roomCode !== undefined && (!isText(value.roomCode, 6, 6) || !/^[A-Z0-9]{6}$/.test(value.roomCode)))
    || !isInteger(value.version)
    || !isInteger(value.seed, 0, 2147483647)
    || typeof value.phase !== 'string'
    || !PHASES.has(value.phase as GameState['phase'])
    || (value.phaseBeforePause !== undefined && (typeof value.phaseBeforePause !== 'string' || !PHASES.has(value.phaseBeforePause as GameState['phase'])))
    || (value.mode !== 'elimination' && value.mode !== 'timed')
    || !isInteger(value.turnLimit, 5, 50)
    || !isInteger(value.round, 1)
    || !Array.isArray(value.players)
    || value.players.length < 1
    || value.players.length > 5
    || !value.players.every(isPlayer)) return false

  const players = value.players as Array<Record<string, unknown>>
  const playerIds = new Set(players.map(player => player.id as string))
  const characterIds = new Set(players.map(player => player.characterId as string))
  if (playerIds.size !== players.length || characterIds.size !== players.length || !isInteger(value.turnIndex, 0, players.length - 1)) return false

  if (!Array.isArray(value.properties)
    || value.properties.length !== PROPERTIES.length
    || !value.properties.every(property => isPropertyState(property, playerIds))
    || new Set(value.properties.map(property => (property as Record<string, unknown>).tileId)).size !== PROPERTIES.length
    || !isAuction(value.auction, playerIds)
    || (value.pendingEventId !== undefined && (typeof value.pendingEventId !== 'string' || !EVENT_IDS.has(value.pendingEventId)))
    || (value.pendingEventChoices !== undefined && (!Array.isArray(value.pendingEventChoices) || value.pendingEventChoices.length !== 3 || new Set(value.pendingEventChoices).size !== 3 || !value.pendingEventChoices.every(id => typeof id === 'string' && EVENT_IDS.has(id))))
    || (value.chosenEventIndex !== undefined && (!isInteger(value.chosenEventIndex, 0, 2) || !Array.isArray(value.pendingEventChoices) || value.pendingEventChoices[value.chosenEventIndex] !== value.pendingEventId))
    || !isTrade(value.trade, playerIds)
    || !isDebt(value.debt, playerIds)) return false

  if (value.lastRoll !== undefined && (!Array.isArray(value.lastRoll) || value.lastRoll.length !== 2 || !value.lastRoll.every(die => isInteger(die, 1, 6)))) return false
  if (value.lastRollActionId !== undefined && !isText(value.lastRollActionId, 100, 1)) return false
  if (value.lastActionId !== undefined && !isText(value.lastActionId, 100, 1)) return false
  if (!Array.isArray(value.processedActions) || value.processedActions.length > 150 || !value.processedActions.every(action => isText(action, 100, 1))) return false
  if (!Array.isArray(value.logs) || value.logs.length > 40 || !value.logs.every(entry => isLog(entry, playerIds))) return false
  if (!Array.isArray(value.winnerIds) || value.winnerIds.length > 5 || !value.winnerIds.every(id => isIdentifier(id) && playerIds.has(id))) return false
  return isInteger(value.createdAt)
}

export function parseWireMessage(value: unknown): WireMessage | undefined {
  if (!isRecord(value) || typeof value.type !== 'string' || !MESSAGE_TYPES.has(value.type as WireMessage['type'])) return undefined
  if (value.type === 'hello') {
    if (!isIdentifier(value.playerId) || !isText(value.nickname, 18, 2) || typeof value.characterId !== 'string' || !CHARACTER_IDS.has(value.characterId) || !isText(value.sessionToken, 100, 16)) return undefined
  } else if (value.type === 'intent') {
    if (!isGameIntent(value.intent) || value.actionId !== value.intent.actionId) return undefined
  } else if (value.type === 'state') {
    if (!isGameStateSnapshot(value.state) || value.stateVersion !== value.state.version) return undefined
  } else if (value.type === 'error' && !isText(value.message, MAX_MESSAGE_TEXT, 1)) return undefined
  return value as unknown as WireMessage
}

export interface ConnectionIdentity {
  playerId: string
  sessionToken: string
}

export function parseConnectionIdentity(value: unknown): ConnectionIdentity | undefined {
  if (!isRecord(value) || !isIdentifier(value.playerId) || !isText(value.sessionToken, 100, 16)) return undefined
  const playerId = value.playerId
  const sessionToken = value.sessionToken
  return { playerId, sessionToken }
}

export function helloMatchesConnection(message: WireMessage, identity: ConnectionIdentity) {
  return message.type === 'hello' && message.playerId === identity.playerId && message.sessionToken === identity.sessionToken
}
