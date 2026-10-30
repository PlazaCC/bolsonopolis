import { BOARD, EVENTS, GROUP_COLORS, PROPERTIES, CHARACTERS, MONEY } from './content'
import type { GameIntent, GameState, Player, PropertyTile } from '../types'

export const BOARD_SIZE = BOARD.length
const START_SALARY = 200
const JAIL_INDEX = 10
const BAIL = 80

export function createGame(id: string, roomCode?: string, turnLimit = 20, seed = Date.now() % 2147483647): GameState {
  return {
    id, roomCode, version: 0, seed, phase: 'lobby', mode: 'elimination', turnLimit, round: 1, turnIndex: 0,
    players: [], properties: PROPERTIES.map(tile => ({ tileId: tile.id, level: 0, mortgaged: false })),
    processedActions: [], logs: [], winnerIds: [], createdAt: Date.now(),
  }
}

// Checkpoints from before the physical-board edition had 32 tiles and 20 properties.
// Hydration preserves known cash, owners and upgrades, adds new unowned lots,
// and guarantees that resuming never breaks the host.
export function hydrateGameState(saved: GameState): GameState {
  const state = structuredClone(saved)
  const known = new Map((state.properties ?? []).map(property => [property.tileId, property]))
  state.properties = PROPERTIES.map(tile => known.get(tile.id) ?? { tileId: tile.id, level: 0, mortgaged: false })
  state.players = (state.players ?? []).map(player => ({ ...player, position: Math.max(0, Math.min(BOARD_SIZE - 1, player.position ?? 0)) }))
  state.processedActions ??= []
  state.logs ??= []
  return state
}

function random(state: GameState) {
  state.seed = (state.seed * 48271) % 2147483647
  return state.seed / 2147483647
}

function log(state: GameState, text: string, tone: 'good' | 'bad' | 'neutral' = 'neutral', details: Partial<GameState['logs'][number]> = {}) {
  state.logs = [{ id: `${state.version}-${state.logs.length}-${state.seed}`, text, tone, ...details }, ...state.logs].slice(0, 40)
}

function makePlayer(input: Extract<GameIntent, { type: 'ADD_PLAYER' }>['player']): Player {
  return { ...input, position: 0, cash: CHARACTERS[input.characterId].startingCash, ready: input.isBot, connected: true, jailTurns: 0, jailCards: input.characterId === 'michelle' ? 1 : 0, bankrupt: false, doublesInRow: 0, abilityUsed: false }
}

function validateNewPlayer(input: Extract<GameIntent, { type: 'ADD_PLAYER' }>['player']) {
  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(input.id)) throw new Error('Identificador de jogador inválido.')
  const nickname = input.nickname.trim()
  if (nickname.length < 2 || nickname.length > 18) throw new Error('O apelido deve ter entre 2 e 18 caracteres.')
  if (!(input.characterId in CHARACTERS)) throw new Error('Personagem inválido.')
  return { ...input, nickname }
}

function validateMoney(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} precisa ser um valor inteiro não negativo.`)
}

export function ownedProperties(state: GameState, playerId: string) {
  return state.properties.filter(property => property.ownerId === playerId)
}

export function ownsGroup(state: GameState, playerId: string, group: PropertyTile['group']) {
  const groupTiles = PROPERTIES.filter(tile => tile.group === group)
  return groupTiles.every(tile => state.properties.find(property => property.tileId === tile.id)?.ownerId === playerId)
}

export function propertyRent(state: GameState, tile: PropertyTile) {
  const property = state.properties.find(value => value.tileId === tile.id)!
  if (property.mortgaged) return 0
  const owner = state.players.find(player => player.id === property.ownerId)
  if (!owner || owner.bankrupt) return 0
  return property.level === 0 && ownsGroup(state, owner.id, tile.group) ? tile.rents[0] * 2 : tile.rents[property.level]
}

export function netWorth(state: GameState, player: Player) {
  return player.cash + ownedProperties(state, player.id).reduce((sum, property) => {
    const tile = PROPERTIES.find(value => value.id === property.tileId)!
    return sum + (property.mortgaged ? tile.mortgage : tile.price) + property.level * Math.floor(tile.buildCost / 2)
  }, 0)
}

export const scorePlayer = (player: Player, state?: GameState) => state ? netWorth(state, player) : player.cash

function activePlayers(state: GameState) { return state.players.filter(player => !player.bankrupt) }

function finishIfNeeded(state: GameState) {
  const alive = activePlayers(state)
  if (alive.length === 1 && state.players.length > 1) {
    state.phase = 'finished'; state.winnerIds = [alive[0].id]
    log(state, `${alive[0].nickname} monopolizou Bolsonópolis. Os demais quebraram.`, 'good')
    return true
  }
  if (state.mode === 'timed' && state.round > state.turnLimit) {
    const high = Math.max(...alive.map(player => netWorth(state, player)))
    state.winnerIds = alive.filter(player => netWorth(state, player) === high).map(player => player.id)
    state.phase = 'finished'
    log(state, 'O relógio fiscal zerou. Vence o maior patrimônio líquido.', 'good')
    return true
  }
  return false
}

function advanceTurn(state: GameState) {
  state.pendingEventId = undefined; state.pendingEventChoices = undefined; state.chosenEventIndex = undefined; state.auction = undefined; state.trade = undefined; state.debt = undefined; state.lastRoll = undefined; state.lastRollActionId = undefined
  let loops = 0
  do {
    state.turnIndex = (state.turnIndex + 1) % state.players.length
    if (state.turnIndex === 0) {
      state.round += 1
      state.players.forEach(player => { player.abilityUsed = false })
      if (finishIfNeeded(state)) return
    }
    loops += 1
  } while (state.players[state.turnIndex]?.bankrupt && loops <= state.players.length)
  state.phase = 'rolling'
}

function beginDebt(state: GameState, player: Player, amount: number, reason: string, creditorId?: string) {
  state.debt = { playerId: player.id, creditorId, amount, reason }
  state.phase = 'debt'
  log(state, `${player.nickname} deve ${MONEY(amount)} por ${reason} e precisa levantar caixa.`, 'bad', { amount, fromId: player.id, toId: creditorId })
}

function charge(state: GameState, player: Player, amount: number, reason: string, creditorId?: string) {
  if (amount <= 0) return true
  if (player.cash < amount) { beginDebt(state, player, amount, reason, creditorId); return false }
  player.cash -= amount
  if (creditorId) state.players.find(value => value.id === creditorId)!.cash += amount
  log(state, creditorId ? `${player.nickname} pagou ${MONEY(amount)} a ${state.players.find(value => value.id === creditorId)?.nickname}: ${reason}.` : `${player.nickname} pagou ${MONEY(amount)}: ${reason}.`, 'bad', { amount, fromId: player.id, toId: creditorId })
  return true
}

function settleDebtIfPossible(state: GameState) {
  const debt = state.debt
  if (!debt) return
  const player = state.players.find(value => value.id === debt.playerId)!
  if (player.cash < debt.amount) return
  player.cash -= debt.amount
  if (debt.creditorId) state.players.find(value => value.id === debt.creditorId)!.cash += debt.amount
  log(state, `${player.nickname} liquidou ${MONEY(debt.amount)} da dívida (${debt.reason}).`, 'good', { amount: debt.amount, fromId: player.id, toId: debt.creditorId })
  state.debt = undefined
  state.phase = 'manage'
}

function applyEvent(state: GameState, player: Player) {
  const card = EVENTS.find(value => value.id === state.pendingEventId)
  if (!card) throw new Error('Acontecimento inválido.')
  if (card.cash > 0) player.cash += card.cash
  if (card.cash < 0 && !charge(state, player, -card.cash, card.title)) return
  if (card.collectFromEach) {
    state.players.filter(rival => rival.id !== player.id && !rival.bankrupt).forEach(rival => {
      const paid = Math.min(rival.cash, card.collectFromEach!)
      rival.cash -= paid; player.cash += paid
    })
  }
  if (card.moveTo !== undefined) {
    if (card.moveTo < player.position) player.cash += START_SALARY
    player.position = card.moveTo
  }
  if (card.jail) { player.position = JAIL_INDEX; player.jailTurns = 2 }
  log(state, `${player.nickname}: ${card.fictionalEffect}`, card.cash < 0 || card.jail ? 'bad' : 'good', { amount: Math.abs(card.cash), toId: card.cash > 0 ? player.id : undefined, fromId: card.cash < 0 ? player.id : undefined })
  state.pendingEventId = undefined
  state.pendingEventChoices = undefined
  state.chosenEventIndex = undefined
  state.phase = 'manage'
}

function resolveTile(state: GameState, player: Player) {
  const tile = BOARD[player.position]
  if (tile.type === 'property') {
    const property = state.properties.find(value => value.tileId === tile.id)!
    if (!property.ownerId) { state.phase = 'property'; return }
    if (property.ownerId === player.id || property.mortgaged) { state.phase = 'manage'; return }
    const rent = propertyRent(state, tile)
    if (charge(state, player, rent, `aluguel de ${tile.name}`, property.ownerId)) state.phase = 'manage'
  } else if (tile.type === 'event') {
    const deck = [...EVENTS]
    state.pendingEventChoices = []
    for (let index = 0; index < 3; index++) {
      const pick = Math.floor(random(state) * deck.length)
      state.pendingEventChoices.push(deck.splice(pick, 1)[0].id)
    }
    state.pendingEventId = undefined
    state.chosenEventIndex = undefined
    state.phase = 'event'
    log(state, `${player.nickname} vai escolher uma carta de sorte ou revés.`)
  } else if (tile.type === 'tax') {
    let amount = tile.amount ?? 0
    if (player.characterId === 'jair' && !player.abilityUsed) { amount = Math.ceil(amount * .8); player.abilityUsed = true }
    if (charge(state, player, amount, tile.name)) state.phase = 'manage'
  } else if (tile.type === 'go-to-jail') {
    player.position = JAIL_INDEX; player.jailTurns = 2; state.phase = 'manage'
    log(state, `${player.nickname} foi direto para a Papuda cenográfica.`, 'bad')
  } else state.phase = 'manage'
}

function validateOwner(state: GameState, playerId: string, tileId: string) {
  const tile = PROPERTIES.find(value => value.id === tileId)
  const property = state.properties.find(value => value.tileId === tileId)
  if (!tile || !property || property.ownerId !== playerId) throw new Error('Este imóvel não pertence a você.')
  return { tile, property }
}

function bankrupt(state: GameState, player: Player) {
  const creditor = state.debt?.creditorId ? state.players.find(value => value.id === state.debt?.creditorId) : undefined
  ownedProperties(state, player.id).forEach(property => {
    property.ownerId = creditor?.id
    if (!creditor) { property.level = 0; property.mortgaged = false }
  })
  player.cash = 0; player.bankrupt = true; player.jailTurns = 0
  log(state, `${player.nickname} declarou falência${creditor ? `; os ativos passaram para ${creditor.nickname}` : ''}.`, 'bad')
  state.debt = undefined
  if (!finishIfNeeded(state)) advanceTurn(state)
}

export function reduceGame(previous: GameState, intent: GameIntent): GameState {
  if (previous.processedActions.includes(intent.actionId)) return previous
  const state = structuredClone(previous)
  state.version += 1; state.lastActionId = intent.actionId
  state.processedActions = [...state.processedActions.slice(-149), intent.actionId]
  const actor = 'playerId' in intent ? state.players.find(player => player.id === intent.playerId) : undefined
  const current = state.players[state.turnIndex]

  if (intent.type === 'ADD_PLAYER' && state.phase === 'lobby') {
    const player = validateNewPlayer(intent.player)
    if (state.players.some(player => player.id === intent.player.id)) return previous
    if (state.players.length >= 5) throw new Error('A sala já tem cinco investidores.')
    if (state.players.some(existing => existing.characterId === player.characterId)) throw new Error('Esse personagem já foi escolhido.')
    state.players.push(makePlayer(player)); log(state, `${player.nickname} entrou no consórcio.`)
  } else if (intent.type === 'REMOVE_PLAYER' && state.phase === 'lobby') state.players = state.players.filter(player => player.id !== intent.playerId)
  else if (intent.type === 'SET_READY' && state.phase === 'lobby' && actor) actor.ready = intent.ready
  else if (intent.type === 'SET_CHARACTER' && state.phase === 'lobby' && actor) {
    if (state.players.some(player => player.id !== actor.id && player.characterId === intent.characterId)) throw new Error('Esse personagem já foi escolhido.')
    Object.assign(actor, makePlayer({ id: actor.id, nickname: actor.nickname, characterId: intent.characterId, isBot: actor.isBot }), { ready: actor.isBot })
  } else if (intent.type === 'SET_MODE' && state.phase === 'lobby') {
    if (state.players[0]?.id !== intent.playerId) throw new Error('Só o host escolhe a modalidade.')
    if (intent.mode !== 'elimination' && intent.mode !== 'timed') throw new Error('Modalidade inválida.')
    const turnLimit = intent.turnLimit ?? 20
    if (!Number.isSafeInteger(turnLimit)) throw new Error('O limite de rodadas precisa ser inteiro.')
    state.mode = intent.mode; state.turnLimit = Math.max(5, Math.min(50, turnLimit))
  } else if (intent.type === 'START_GAME' && state.phase === 'lobby') {
    if (state.players[0]?.id !== intent.playerId) throw new Error('Só o host inicia a partida.')
    if (state.players.length < 2 || state.players.some(player => !player.ready)) throw new Error('São necessários dois jogadores prontos.')
    state.phase = 'rolling'; log(state, 'O cartório abriu: comprem barato, cobrem caro e não quebrem.', 'good')
  } else if (intent.type === 'PAY_BAIL' && state.phase === 'rolling') {
    if (!actor || actor.id !== current.id || actor.jailTurns <= 0) throw new Error('Não há fiança a pagar.')
    if (actor.jailCards > 0) { actor.jailCards -= 1; actor.jailTurns = 0; log(state, `${actor.nickname} usou o habeas corpus de bolso.`, 'good') }
    else if (actor.cash >= BAIL) { actor.cash -= BAIL; actor.jailTurns = 0; log(state, `${actor.nickname} pagou ${MONEY(BAIL)} de fiança.`, 'bad') }
    else throw new Error('Caixa insuficiente para a fiança.')
  } else if (intent.type === 'ROLL' && state.phase === 'rolling') {
    if (!actor || actor.id !== current.id) throw new Error('Espere a sua vez.')
    const dice: [number, number] = [1 + Math.floor(random(state) * 6), 1 + Math.floor(random(state) * 6)]
    state.lastRoll = dice
    state.lastRollActionId = intent.actionId
    const doubles = dice[0] === dice[1]
    if (actor.jailTurns > 0 && !doubles) {
      actor.jailTurns -= 1; log(state, `${actor.nickname} não tirou dupla e continua na prisão (${dice[0]} + ${dice[1]}).`, 'bad'); advanceTurn(state)
    } else {
      if (actor.jailTurns > 0) { actor.jailTurns = 0; log(state, `${actor.nickname} tirou dupla e saiu da prisão.`, 'good') }
      actor.doublesInRow = doubles ? actor.doublesInRow + 1 : 0
      if (actor.doublesInRow >= 3) { actor.position = JAIL_INDEX; actor.jailTurns = 2; actor.doublesInRow = 0; state.phase = 'manage'; log(state, 'Três duplas: excesso de entusiasmo imobiliário. Direto para a prisão.', 'bad') }
      else {
        const old = actor.position; const movement = dice[0] + dice[1]
        actor.position = (actor.position + movement) % BOARD_SIZE
        if (actor.position < old) { const bonus = START_SALARY + (actor.characterId === 'renan' ? 30 : 0); actor.cash += bonus; log(state, `${actor.nickname} completou a volta e recebeu ${MONEY(bonus)}.`, 'good', { amount: bonus, toId: actor.id }) }
        log(state, `${actor.nickname} tirou ${dice[0]} + ${dice[1]} e chegou a “${BOARD[actor.position].name}”.`)
        resolveTile(state, actor)
      }
    }
  } else if (intent.type === 'BUY_PROPERTY' && state.phase === 'property') {
    if (!actor || actor.id !== current.id) throw new Error('A compra pertence ao jogador da vez.')
    const tile = BOARD[actor.position]
    if (tile.type !== 'property') throw new Error('Não há imóvel nesta casa.')
    const property = state.properties.find(value => value.tileId === tile.id)!
    if (property.ownerId || actor.cash < tile.price) throw new Error('Imóvel indisponível ou caixa insuficiente.')
    actor.cash -= tile.price; property.ownerId = actor.id; state.phase = 'manage'
    log(state, `${actor.nickname} comprou ${tile.name} por ${MONEY(tile.price)}.`, 'good', { amount: tile.price, fromId: actor.id })
  } else if (intent.type === 'DECLINE_PROPERTY' && state.phase === 'property') {
    if (!actor || actor.id !== current.id) throw new Error('Só o jogador da vez pode recusar.')
    const tile = BOARD[actor.position]
    if (tile.type !== 'property') throw new Error('Não há imóvel para leiloar.')
    state.auction = { tileId: tile.id, highestBid: 0, passedPlayerIds: [], initiatorId: actor.id }; state.phase = 'auction'
    log(state, `${actor.nickname} recusou ${tile.name}. O leilão está aberto.`)
  } else if (intent.type === 'BID' && state.phase === 'auction' && state.auction) {
    if (!actor || actor.bankrupt || state.auction.passedPlayerIds.includes(actor.id)) throw new Error('Você não participa mais deste leilão.')
    const minimum = state.auction.highestBid + 10
    if (!Number.isInteger(intent.amount) || intent.amount < minimum || intent.amount > actor.cash) throw new Error(`O lance mínimo é ${MONEY(minimum)} e precisa caber no caixa.`)
    state.auction.highestBid = intent.amount; state.auction.highestBidderId = actor.id
    log(state, `${actor.nickname} ofereceu ${MONEY(intent.amount)} no leilão.`)
  } else if (intent.type === 'PASS_AUCTION' && state.phase === 'auction' && state.auction) {
    if (!actor || actor.bankrupt) throw new Error('Participante inválido.')
    if (!state.auction.passedPlayerIds.includes(actor.id)) state.auction.passedPlayerIds.push(actor.id)
    const eligible = activePlayers(state)
    const remaining = eligible.filter(player => !state.auction!.passedPlayerIds.includes(player.id))
    if ((!state.auction.highestBidderId && remaining.length === 0) || (state.auction.highestBidderId && remaining.every(player => player.id === state.auction!.highestBidderId))) {
      const winner = state.players.find(player => player.id === state.auction!.highestBidderId)
      if (winner) {
        winner.cash -= state.auction.highestBid
        state.properties.find(value => value.tileId === state.auction!.tileId)!.ownerId = winner.id
        log(state, `${winner.nickname} arrematou ${PROPERTIES.find(value => value.id === state.auction!.tileId)?.name} por ${MONEY(state.auction.highestBid)}.`, 'good', { amount: state.auction.highestBid, fromId: winner.id })
      } else log(state, 'O leilão terminou sem proposta. O imóvel volta ao banco.')
      state.auction = undefined; state.phase = 'manage'
    }
  } else if (intent.type === 'CHOOSE_EVENT' && state.phase === 'event') {
    if (!actor || actor.id !== current.id) throw new Error('Só o jogador da vez escolhe a carta.')
    if (state.pendingEventId) throw new Error('A carta já foi escolhida.')
    if (!Number.isInteger(intent.index) || intent.index < 0 || intent.index > 2 || !state.pendingEventChoices?.[intent.index]) throw new Error('Carta inválida.')
    state.chosenEventIndex = intent.index
    state.pendingEventId = state.pendingEventChoices[intent.index]
    log(state, `${actor.nickname} revelou a carta ${intent.index + 1}.`)
  } else if (intent.type === 'RESOLVE_EVENT' && state.phase === 'event') {
    if (!actor || actor.id !== current.id) throw new Error('Este acontecimento pertence a outro jogador.')
    applyEvent(state, actor)
  } else if (intent.type === 'BUILD' && (state.phase === 'manage' || state.phase === 'debt')) {
    if (!actor || actor.id !== current.id || state.phase === 'debt') throw new Error('Não é possível construir agora.')
    const { tile, property } = validateOwner(state, actor.id, intent.tileId)
    if (!ownsGroup(state, actor.id, tile.group) || property.mortgaged || property.level >= 4) throw new Error('Complete o bairro, deshipoteque e respeite o limite de quatro melhorias.')
    const groupLevels = state.properties.filter(value => PROPERTIES.find(tileValue => tileValue.id === value.tileId)?.group === tile.group).map(value => value.level)
    if (property.level > Math.min(...groupLevels)) throw new Error('Construa de forma equilibrada no bairro.')
    const cost = actor.characterId === 'eduardo' && property.level === 0 ? Math.ceil(tile.buildCost * .9) : tile.buildCost
    if (actor.cash < cost) throw new Error('Caixa insuficiente para a melhoria.')
    actor.cash -= cost; property.level += 1; log(state, `${actor.nickname} construiu nível ${property.level} em ${tile.name} por ${MONEY(cost)}.`, 'good', { amount: cost, fromId: actor.id })
  } else if (intent.type === 'SELL_BUILDING' && (state.phase === 'manage' || state.phase === 'debt')) {
    if (!actor || actor.id !== current.id) throw new Error('Só o jogador da vez administra seus ativos.')
    const { tile, property } = validateOwner(state, actor.id, intent.tileId)
    if (property.level <= 0) throw new Error('Este imóvel não possui melhoria para vender.')
    const groupLevels = state.properties.filter(value => PROPERTIES.find(tileValue => tileValue.id === value.tileId)?.group === tile.group).map(value => value.level)
    if (property.level < Math.max(...groupLevels)) throw new Error('Venda melhorias de forma equilibrada no bairro.')
    const refund = Math.floor(tile.buildCost / 2)
    property.level -= 1; actor.cash += refund
    log(state, `${actor.nickname} vendeu uma melhoria de ${tile.name} por ${MONEY(refund)}.`, 'neutral', { amount: refund, toId: actor.id }); settleDebtIfPossible(state)
  } else if (intent.type === 'MORTGAGE' && (state.phase === 'manage' || state.phase === 'debt')) {
    if (!actor || actor.id !== current.id) throw new Error('Só o jogador da vez administra seus ativos.')
    const { tile, property } = validateOwner(state, actor.id, intent.tileId)
    if (property.mortgaged || property.level > 0) throw new Error('Venda melhorias antes de hipotecar.')
    const amount = actor.characterId === 'flavio' ? Math.ceil(tile.mortgage * 1.1) : tile.mortgage
    property.mortgaged = true; actor.cash += amount; log(state, `${actor.nickname} hipotecou ${tile.name} por ${MONEY(amount)}.`, 'neutral', { amount, toId: actor.id }); settleDebtIfPossible(state)
  } else if (intent.type === 'UNMORTGAGE' && state.phase === 'manage') {
    if (!actor || actor.id !== current.id) throw new Error('Só o jogador da vez administra seus ativos.')
    const { tile, property } = validateOwner(state, actor.id, intent.tileId)
    const cost = Math.ceil(tile.mortgage * 1.1)
    if (!property.mortgaged || actor.cash < cost) throw new Error('Hipoteca inexistente ou caixa insuficiente.')
    actor.cash -= cost; property.mortgaged = false; log(state, `${actor.nickname} quitou a hipoteca de ${tile.name} por ${MONEY(cost)}.`, 'good', { amount: cost, fromId: actor.id })
  } else if (intent.type === 'PROPOSE_TRADE' && state.phase === 'manage') {
    if (!actor || actor.id !== current.id) throw new Error('Negocie apenas no seu turno.')
    validateMoney(intent.offeredCash, 'O dinheiro oferecido')
    validateMoney(intent.requestedCash, 'O dinheiro solicitado')
    if (new Set(intent.offeredPropertyIds).size !== intent.offeredPropertyIds.length || new Set(intent.requestedPropertyIds).size !== intent.requestedPropertyIds.length) throw new Error('Uma escritura não pode aparecer duas vezes na proposta.')
    const target = state.players.find(player => player.id === intent.toId && !player.bankrupt)
    if (!target || target.id === actor.id || intent.offeredCash > actor.cash || intent.requestedCash > target.cash) throw new Error('Proposta financeira inválida.')
    intent.offeredPropertyIds.forEach(id => validateOwner(state, actor.id, id)); intent.requestedPropertyIds.forEach(id => validateOwner(state, target.id, id))
    if ([...intent.offeredPropertyIds, ...intent.requestedPropertyIds].some(id => state.properties.find(value => value.tileId === id)!.level > 0)) throw new Error('Venda melhorias antes de negociar um imóvel.')
    state.trade = { id: intent.actionId, fromId: actor.id, toId: target.id, offeredCash: intent.offeredCash, requestedCash: intent.requestedCash, offeredPropertyIds: intent.offeredPropertyIds, requestedPropertyIds: intent.requestedPropertyIds, status: 'pending' }
    state.phase = 'trade'; log(state, `${actor.nickname} enviou uma proposta a ${target.nickname}.`)
  } else if (intent.type === 'ACCEPT_TRADE' && state.phase === 'trade' && state.trade) {
    if (!actor || actor.id !== state.trade.toId) throw new Error('Só o destinatário aceita a proposta.')
    const from = state.players.find(player => player.id === state.trade!.fromId)!
    if (from.cash < state.trade.offeredCash || actor.cash < state.trade.requestedCash) throw new Error('O caixa mudou e a proposta não pode mais ser executada.')
    from.cash += state.trade.requestedCash - state.trade.offeredCash; actor.cash += state.trade.offeredCash - state.trade.requestedCash
    state.trade.offeredPropertyIds.forEach(id => { state.properties.find(value => value.tileId === id)!.ownerId = actor.id })
    state.trade.requestedPropertyIds.forEach(id => { state.properties.find(value => value.tileId === id)!.ownerId = from.id })
    state.trade.status = 'accepted'; log(state, `${actor.nickname} aceitou a proposta de ${from.nickname}; dinheiro e escrituras foram trocados.`, 'good'); state.trade = undefined; state.phase = 'manage'
  } else if (intent.type === 'REJECT_TRADE' && state.phase === 'trade' && state.trade) {
    if (!actor || ![state.trade.toId, state.trade.fromId].includes(actor.id)) throw new Error('Você não participa desta proposta.')
    log(state, `${actor.nickname} recusou a negociação.`); state.trade = undefined; state.phase = 'manage'
  } else if (intent.type === 'DECLARE_BANKRUPTCY' && state.phase === 'debt') {
    if (!actor || actor.id !== state.debt?.playerId) throw new Error('Esta dívida pertence a outro jogador.')
    bankrupt(state, actor)
  } else if (intent.type === 'END_TURN' && state.phase === 'manage') {
    if (!actor || actor.id !== current.id) throw new Error('Só o jogador da vez encerra o turno.')
    if (actor.doublesInRow > 0 && state.lastRoll?.[0] === state.lastRoll?.[1] && actor.jailTurns === 0) { state.phase = 'rolling'; state.lastRoll = undefined; log(state, `${actor.nickname} tirou dupla e joga novamente.`, 'good') }
    else advanceTurn(state)
  } else if (intent.type === 'REMATCH' && state.phase === 'finished') {
    if (state.players[0]?.id !== intent.playerId) throw new Error('Só o host inicia uma nova sociedade.')
    const fresh = createGame(state.id, state.roomCode, state.turnLimit, state.seed)
    fresh.mode = state.mode; fresh.version = state.version; fresh.processedActions = state.processedActions
    fresh.players = state.players.map(player => makePlayer({ id: player.id, nickname: player.nickname, characterId: player.characterId, isBot: player.isBot }))
    return fresh
  } else if (intent.type === 'SET_CONNECTED' && actor && !actor.isBot) {
    actor.connected = intent.connected
    if (!intent.connected && state.phase !== 'lobby' && state.phase !== 'finished' && state.phase !== 'paused' && current?.id === actor.id) {
      state.phaseBeforePause = state.phase
      state.phase = 'paused'
      log(state, `${actor.nickname} perdeu a conexão. O mercado aguarda a reconexão.`, 'bad')
    } else if (intent.connected && state.phase === 'paused' && current?.id === actor.id) {
      state.phase = state.phaseBeforePause ?? 'rolling'
      state.phaseBeforePause = undefined
      log(state, `${actor.nickname} voltou. O mercado reabriu.`, 'good')
    }
  } else return previous
  return state
}

export function getBotIntent(state: GameState, requestedBot?: Player): GameIntent | null {
  let player = requestedBot
  if (state.phase === 'auction') player = state.players.find(value => value.isBot && !value.bankrupt && !state.auction?.passedPlayerIds.includes(value.id) && value.id !== state.auction?.highestBidderId)
  if (state.phase === 'trade' && state.trade) player = state.players.find(value => value.id === state.trade?.toId && value.isBot)
  if (!player?.isBot) return null
  const actionId = `bot-${player.id}-${state.version}-${state.seed}`
  const current = state.players[state.turnIndex]
  if (state.phase === 'rolling' && player.id === current.id) return { type: 'ROLL', actionId, playerId: player.id }
  if (state.phase === 'property' && player.id === current.id) {
    const tile = BOARD[player.position]
    return tile.type === 'property' && player.cash > tile.price + 250 ? { type: 'BUY_PROPERTY', actionId, playerId: player.id } : { type: 'DECLINE_PROPERTY', actionId, playerId: player.id }
  }
  if (state.phase === 'event' && player.id === current.id) return state.pendingEventId ? { type: 'RESOLVE_EVENT', actionId, playerId: player.id } : { type: 'CHOOSE_EVENT', actionId, playerId: player.id, index: 0 }
  if (state.phase === 'auction' && state.auction) {
    const tile = PROPERTIES.find(value => value.id === state.auction?.tileId)!
    const next = state.auction.highestBid + (state.auction.highestBid === 0 ? 50 : 40)
    return next <= Math.min(player.cash - 200, Math.floor(tile.price * .8)) ? { type: 'BID', actionId, playerId: player.id, amount: next } : { type: 'PASS_AUCTION', actionId, playerId: player.id }
  }
  if (state.phase === 'trade' && state.trade?.toId === player.id) return { type: 'REJECT_TRADE', actionId, playerId: player.id }
  if (state.phase === 'debt' && state.debt?.playerId === player.id) {
    const building = ownedProperties(state, player.id).find(property => property.level > 0)
    if (building) return { type: 'SELL_BUILDING', actionId, playerId: player.id, tileId: building.tileId }
    const candidate = ownedProperties(state, player.id).find(property => !property.mortgaged && property.level === 0)
    return candidate ? { type: 'MORTGAGE', actionId, playerId: player.id, tileId: candidate.tileId } : { type: 'DECLARE_BANKRUPTCY', actionId, playerId: player.id }
  }
  if (state.phase === 'manage' && player.id === current.id) return { type: 'END_TURN', actionId, playerId: player.id }
  return null
}

export { GROUP_COLORS }
