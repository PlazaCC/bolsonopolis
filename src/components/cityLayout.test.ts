import { describe, expect, it } from 'vitest'
import { BOARD, PROPERTIES } from '../game/content'
import { CENTER_ZONES, CITY_BOUNDS, CITY_PATH, CORNER_LOT_DISTANCE, CORNER_TILE_SIZE, LOT_DISTANCE, PAWN_RADIUS, SURFACE_LEVELS, cityPosition, isCompactLot, isShoulderLot, lotDistance, lotPosition, lotRotation, pawnSlot } from './cityLayout'

describe('city layout', () => {
  it('keeps all 40 tiles inside the model without duplicate positions', () => {
    expect(CITY_PATH).toHaveLength(40)
    expect(new Set(CITY_PATH.map(point => `${point[0]}:${point[2]}`)).size).toBe(40)
    CITY_PATH.forEach(point => {
      expect(Number.isFinite(point[0]) && Number.isFinite(point[2])).toBe(true)
      expect(Math.abs(point[0])).toBeLessThan(CITY_BOUNDS.width / 2)
      expect(Math.abs(point[2])).toBeLessThan(CITY_BOUNDS.depth / 2)
    })
  })

  it('forms a continuous path that pawns can traverse', () => {
    CITY_PATH.slice(1).forEach((point, index) => {
      const previous = CITY_PATH[index]
      expect(Math.hypot(point[0] - previous[0], point[2] - previous[2])).toBeLessThanOrEqual(2.42)
    })
  })

  it('clamps invalid positions to path endpoints', () => {
    expect(cityPosition(-10)).toEqual([...CITY_PATH[0]])
    expect(cityPosition(999)).toEqual([...CITY_PATH[39]])
  })

  it('keeps vertical layers separated to prevent coplanar surfaces', () => {
    expect(SURFACE_LEVELS.boardTop).toBeLessThan(SURFACE_LEVELS.centerTop)
    expect(SURFACE_LEVELS.centerTop).toBeLessThan(SURFACE_LEVELS.tileOrigin)
    expect(SURFACE_LEVELS.tileTop).toBeLessThan(SURFACE_LEVELS.lotTop)
    expect(SURFACE_LEVELS.lotTop).toBeLessThan(SURFACE_LEVELS.buildingBase)
    expect(lotPosition(1)[1]).toBe(SURFACE_LEVELS.lotOrigin)
    expect(CENTER_ZONES.title[1]).toBeGreaterThan(SURFACE_LEVELS.centerTop)
  })

  it('places up to eight pawns without intersections and inside a regular tile', () => {
    for (let count = 1; count <= 8; count += 1) {
      const slots = Array.from({ length: count }, (_, index) => pawnSlot(index, count))
      slots.forEach(([x, z]) => {
        expect(Math.abs(x) + PAWN_RADIUS).toBeLessThanOrEqual(.76)
        expect(Math.abs(z) + PAWN_RADIUS).toBeLessThanOrEqual(1.04)
      })
      slots.forEach((slot, index) => slots.slice(index + 1).forEach(other => {
        expect(Math.hypot(slot[0] - other[0], slot[1] - other[1])).toBeGreaterThanOrEqual(PAWN_RADIUS * 2 - .001)
      }))
    }
    expect(LOT_DISTANCE - .47 - .26 - PAWN_RADIUS).toBeGreaterThan(.9)
    expect(lotDistance(1)).toBe(CORNER_LOT_DISTANCE)
    expect(lotDistance(9)).toBe(CORNER_LOT_DISTANCE)
    expect(lotDistance(8)).toBe(LOT_DISTANCE)
    expect(lotDistance(7)).toBe(LOT_DISTANCE)
    expect(Math.hypot(lotPosition(9)[0] - lotPosition(11)[0], lotPosition(9)[2] - lotPosition(11)[2])).toBeGreaterThan(1)
    expect([lotRotation(1), lotRotation(11), lotRotation(21), lotRotation(31)]).toEqual([0, Math.PI / 2, Math.PI, -Math.PI / 2])
  })

  it('prevents overlap between path tiles and property lots', () => {
    const overlaps = (a: { x: number; z: number; hx: number; hz: number }, b: { x: number; z: number; hx: number; hz: number }) =>
      Math.abs(a.x - b.x) < a.hx + b.hx - .001 && Math.abs(a.z - b.z) < a.hz + b.hz - .001
    const tiles = BOARD.map(tile => {
      const [x, , z] = cityPosition(tile.index)
      const corner = tile.index % 10 === 0
      const vertical = tile.index > 10 && tile.index < 20 || tile.index > 30
      return { x, z, hx: corner ? CORNER_TILE_SIZE / 2 : vertical ? .9 : .76, hz: corner ? CORNER_TILE_SIZE / 2 : vertical ? .76 : .9 }
    })
    tiles.forEach((tile, index) => tiles.slice(index + 1).forEach((other, offset) => expect(overlaps(tile, other), `tiles ${index} and ${index + offset + 1}`).toBe(false)))

    const lots = PROPERTIES.map(tile => {
      const [x, , z] = lotPosition(tile.index)
      const vertical = Math.abs(lotRotation(tile.index)) === Math.PI / 2
      const compact = isCompactLot(tile.index)
      const depth = isShoulderLot(tile.index) ? .81 : .85
      return { x, z, hx: compact ? .48 : vertical ? depth : .74, hz: compact ? .48 : vertical ? .74 : depth }
    })
    lots.forEach((lot, index) => lots.slice(index + 1).forEach((other, offset) => expect(overlaps(lot, other), `lots ${PROPERTIES[index].index} and ${PROPERTIES[index + offset + 1].index}`).toBe(false)))
    lots.forEach((lot, lotIndex) => tiles.forEach((tile, tileIndex) => expect(overlaps(lot, tile), `lot ${PROPERTIES[lotIndex].index} and tile ${tileIndex}`).toBe(false)))
  })

  it('reserves separate centre zones for title, cards and dice', () => {
    const distance = (a: readonly [number, number, number], b: readonly [number, number, number]) => Math.hypot(a[0] - b[0], a[2] - b[2])
    expect(distance(CENTER_ZONES.title, CENTER_ZONES.leftCards)).toBeGreaterThan(3)
    expect(distance(CENTER_ZONES.title, CENTER_ZONES.rightCards)).toBeGreaterThan(3)
    expect(distance(CENTER_ZONES.title, CENTER_ZONES.dice)).toBeGreaterThan(2.5)
    expect(distance(CENTER_ZONES.leftCards, CENTER_ZONES.rightCards)).toBeGreaterThan(3)
  })

  it('keeps each compact corner lot on the axis of its own deed', () => {
    for (const index of [1, 9, 11, 19, 21, 29, 31, 39]) {
      const lot = lotPosition(index)
      const ownTile = cityPosition(index)
      const horizontalSide = index <= 10 || index > 20 && index <= 30
      expect(horizontalSide ? lot[0] : lot[2], `compact lot ${index}`).toBeCloseTo(horizontalSide ? ownTile[0] : ownTile[2])
    }
  })
})
