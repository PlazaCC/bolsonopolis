export type Point3 = readonly [number, number, number]

const EDGE = 9
export const CORNER_TILE_SIZE = 3.2
const REGULAR_TILE_WIDTH = 1.52
const TILE_GAP = .05
const REGULAR_EDGE = EDGE - CORNER_TILE_SIZE / 2 - REGULAR_TILE_WIDTH / 2 - TILE_GAP
const REGULAR_STEP = REGULAR_EDGE * 2 / 8
const SIDE_COORDINATES = [-EDGE, ...Array.from({ length: 9 }, (_, index) => -REGULAR_EDGE + index * REGULAR_STEP), EDGE]
export const LOT_DISTANCE = 1.95
export const CORNER_LOT_DISTANCE = 1.42
export const PAWN_RADIUS = .25

// Vertical contract for the model. Decorative surfaces never share a plane:
// each layer has an explicit base and top to prevent z-fighting.
export const SURFACE_LEVELS = {
  boardTop: .27,
  centerTop: .315,
  tileOrigin: .34,
  tileTop: .43,
  lotOrigin: .43,
  lotTop: .45,
  buildingBase: .48,
  pawnRoot: .409,
} as const

// Exclusive zones keep interactive props away from the title and each other.
export const CENTER_ZONES = {
  title: [0, .355, 0] as const,
  subtitle: [0, .355, -.66] as const,
  leftCards: [-3.1, .42, 1.9] as const,
  rightCards: [3.1, .42, 1.9] as const,
  dice: [0, .4, 2.65] as const,
} as const

// Forty positions on a classic square: corners at 0, 10, 20 and 30.
export const CITY_PATH: Point3[] = [
  ...SIDE_COORDINATES.map(x => [x, SURFACE_LEVELS.tileOrigin, EDGE] as const),
  ...SIDE_COORDINATES.slice(0, -1).reverse().map(z => [EDGE, SURFACE_LEVELS.tileOrigin, z] as const),
  ...SIDE_COORDINATES.slice(0, -1).reverse().map(x => [x, SURFACE_LEVELS.tileOrigin, -EDGE] as const),
  ...SIDE_COORDINATES.slice(1, -1).map(z => [-EDGE, SURFACE_LEVELS.tileOrigin, z] as const),
]

export const CITY_BOUNDS = { width: 22, depth: 22 }

export function cityPosition(index: number): [number, number, number] {
  const point = CITY_PATH[Math.max(0, Math.min(CITY_PATH.length - 1, index))]
  return [point[0], point[1], point[2]]
}

export function tileRotation(index: number) {
  if (index <= 10) return 0
  if (index <= 20) return -Math.PI / 2
  if (index <= 30) return Math.PI
  return Math.PI / 2
}

// Building fronts face their matching tile; tile labels face the centre.
export function lotRotation(index: number) {
  if (index <= 10) return 0
  if (index <= 20) return Math.PI / 2
  if (index <= 30) return Math.PI
  return -Math.PI / 2
}

export function inwardDirection(index: number): [number, number] {
  if (index <= 10) return [0, -1]
  if (index <= 20) return [-1, 0]
  if (index <= 30) return [0, 1]
  return [1, 0]
}

export function isCompactLot(index: number) {
  return index % 10 === 1 || index % 10 === 9
}

export function isShoulderLot(index: number) {
  return index % 10 === 2 || index % 10 === 8
}

export function lotDistance(index: number) {
  if (isCompactLot(index)) return CORNER_LOT_DISTANCE
  return LOT_DISTANCE
}

export function lotPosition(index: number, distance = lotDistance(index)): [number, number, number] {
  const point = cityPosition(index)
  const inward = inwardDirection(index)
  return [point[0] + inward[0] * distance, SURFACE_LEVELS.lotOrigin, point[2] + inward[1] * distance]
}

export function pawnSlot(index: number, count: number): [number, number] {
  const safeCount = Math.max(1, Math.min(5, count))
  const safeIndex = Math.max(0, Math.min(safeCount - 1, index))
  const columns = Math.min(3, safeCount)
  const row = Math.floor(safeIndex / columns)
  const column = safeIndex % columns
  const rows = Math.ceil(safeCount / columns)
  const rowCount = Math.min(columns, safeCount - row * columns)
  return [(column - (rowCount - 1) / 2) * .5, (row - (rows - 1) / 2) * .52]
}

export const TREES = [
  [-5.05, 1.75], [-4.8, -.9], [5.05, 1.65], [4.9, -.9],
  [-1.55, 5.05], [1.55, 5.05], [-1.65, -5.05], [1.55, -5.05],
  [-4.65, -2.05], [4.65, -2.1],
] as const
