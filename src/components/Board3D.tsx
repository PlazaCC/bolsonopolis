import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Billboard, ContactShadows, OrbitControls, RoundedBox, Text } from '@react-three/drei'
import { Suspense, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Color, MathUtils, Quaternion, TOUCH, Vector3, type Group, type PerspectiveCamera } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { BOARD, CHARACTERS, GROUP_COLORS, MONEY, PROPERTIES } from '../game/content'
import type { BoardTile, GameState, Player, PropertyTile } from '../types'
import { CharacterModel, type CharacterAnimation } from './CharacterModel'
import { CENTER_ZONES, CITY_BOUNDS, CITY_PATH, CORNER_TILE_SIZE, SURFACE_LEVELS, TREES, cityPosition, isCompactLot, isShoulderLot, lotPosition, lotRotation, pawnSlot, tileRotation } from './cityLayout'
import { RioBarEnvironment } from './RioBarEnvironment'
import { TipsyEffect } from './TipsyEffect'
import { PatioTable } from './PatioTable'
import { PropertyInspector } from './PropertyInspector'

const CORNERS = new Set([0, 10, 20, 30])

function Box({ position, size, color, roughness = .72, castShadow = true, rotation }: { position: [number, number, number]; size: [number, number, number]; color: string; roughness?: number; castShadow?: boolean; rotation?: [number, number, number] }) {
  return <mesh position={position} rotation={rotation} castShadow={castShadow} receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={roughness} /></mesh>
}

const PhysicalBoard = memo(function PhysicalBoard() {
  return <group>
    <RoundedBox args={[21.4, .7, 21.4]} radius={.28} smoothness={4} position={[0, -.28, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#183f3e" roughness={.52} />
    </RoundedBox>
    <RoundedBox args={[21.2, .26, 21.2]} radius={.16} smoothness={3} position={[0, .14, 0]} receiveShadow>
      <meshStandardMaterial color="#eadfbd" roughness={.78} />
    </RoundedBox>
    <Box position={[0, .285, 0]} size={[15.4, .05, 15.4]} color="#d8cfaa" castShadow={false} />
    <Text position={CENTER_ZONES.title} rotation={[-Math.PI / 2, 0, 0]} fontSize={.92} color="#1d5250" anchorX="center" anchorY="middle" fontWeight={800}>BOLSONÓPOLIS</Text>
    <Text position={CENTER_ZONES.subtitle} rotation={[-Math.PI / 2, 0, 0]} fontSize={.19} letterSpacing={.18} color="#a04b3b" anchorX="center">NEGÓCIOS DE FAMÍLIA</Text>
    {/* Inner finishing line. */}
    {[[0, 7.78, 15.5, .045], [0, -7.78, 15.5, .045], [7.78, 0, .045, 15.5], [-7.78, 0, .045, 15.5]].map(([x, z, w, d], index) => <Box key={index} position={[x, .325, z]} size={[w, .035, d]} color="#a98d51" castShadow={false} />)}
  </group>
})

function tileIcon(tile: BoardTile) {
  if (tile.type === 'event') return '?'
  if (tile.type === 'tax') return 'R$'
  if (tile.type === 'jail') return '▦'
  if (tile.type === 'go-to-jail') return '→▦'
  if (tile.type === 'rest') return '☀'
  if (tile.type === 'start') return '→'
  return ''
}

function BoardTiles({ state, selected, onSelect }: { state: GameState; selected?: string; onSelect: (tileId?: string) => void }) {
  const active = state.players[state.turnIndex]
  return <group>
    {BOARD.map(tile => {
      const point = cityPosition(tile.index)
      const corner = CORNERS.has(tile.index)
      const property = tile.type === 'property' ? state.properties.find(value => value.tileId === tile.id) : undefined
      const owner = state.players.find(player => player.id === property?.ownerId)
      const current = active?.position === tile.index
      const isSelected = selected === tile.id
      const groupColor = tile.type === 'property' ? GROUP_COLORS[tile.group] : tile.type === 'tax' ? '#d76a54' : tile.type === 'event' ? '#e7b53c' : '#58a69a'
      return <group key={tile.id} position={point} rotation-y={tileRotation(tile.index)} onClick={event => { event.stopPropagation(); onSelect(tile.type === 'property' ? tile.id : undefined) }}>
        <RoundedBox args={[corner ? CORNER_TILE_SIZE : 1.52, .14, corner ? CORNER_TILE_SIZE : 1.8]} radius={.055} smoothness={2} position-y={.02} receiveShadow>
          <meshStandardMaterial color={current ? '#fff0b8' : '#fffaf0'} roughness={.72} emissive={current || isSelected ? new Color(current ? '#e84f3d' : groupColor) : new Color('#000')} emissiveIntensity={current ? .28 : isSelected ? .2 : 0} />
        </RoundedBox>
        {tile.type === 'property' ? <>
          <Box position={[0, .1, -.68]} size={[1.5, .08, .38]} color={groupColor} castShadow={false} />
          <Text position={[0, .16, -.68]} rotation={[-Math.PI / 2, 0, 0]} fontSize={.15} color="#fff" outlineWidth={.006} outlineColor="#17383a" anchorX="center" anchorY="middle" maxWidth={1.34} fontWeight={800}>{tile.district.toUpperCase()}</Text>
          <Text position={[0, .125, -.08]} rotation={[-Math.PI / 2, 0, 0]} fontSize={.18} lineHeight={.88} color="#102f31" outlineWidth={.007} outlineColor="#fffaf0" anchorX="center" anchorY="middle" maxWidth={1.34} textAlign="center" fontWeight={800}>{tile.name}</Text>
          <Text position={[0, .125, .67]} rotation={[-Math.PI / 2, 0, 0]} fontSize={.16} color="#842a23" outlineWidth={.006} outlineColor="#fffaf0" anchorX="center" fontWeight={800}>{MONEY(tile.price)}</Text>
          {owner && <Box position={[0, .16, .84]} size={[1.22, .07, .08]} color={CHARACTERS[owner.characterId].color} castShadow={false} />}
          {property?.mortgaged && <Text position={[0, .19, .28]} rotation={[-Math.PI / 2, 0, -.12]} fontSize={.205} color="#a82f27" outlineWidth={.008} outlineColor="#fffaf0" anchorX="center" fontWeight={800}>HIPOTECA</Text>}
        </> : <>
          <Text position={[0, .14, corner ? -.18 : -.13]} rotation={[-Math.PI / 2, 0, 0]} fontSize={corner ? .34 : .205} lineHeight={.9} maxWidth={corner ? 2.55 : 1.32} color="#102f31" outlineWidth={.008} outlineColor="#fffaf0" anchorX="center" anchorY="middle" textAlign="center" fontWeight={800}>{tile.name}</Text>
          <Text position={[0, .14, corner ? .72 : .5]} rotation={[-Math.PI / 2, 0, 0]} fontSize={corner ? .62 : .34} color={groupColor} outlineWidth={.006} outlineColor="#fffaf0" anchorX="center" anchorY="middle" fontWeight={800}>{tileIcon(tile)}</Text>
        </>}
        {(current || isSelected) && <mesh position-y={.205} rotation-x={-Math.PI / 2} renderOrder={4}><ringGeometry args={[corner ? 1.05 : .68, corner ? 1.12 : .75, 4]} /><meshBasicMaterial color={current ? '#ef513d' : groupColor} transparent opacity={.9} depthWrite={false} polygonOffset polygonOffsetFactor={-2} /></mesh>}
      </group>
    })}
  </group>
}

function Windows({ width, floors, front }: { width: number; floors: number; front: number }) {
  return <>{Array.from({ length: floors * 2 }, (_, index) => <mesh key={index} position={[(index % 2 ? .22 : -.22) * width, .38 + Math.floor(index / 2) * .32, front]}>
    <boxGeometry args={[width * .23, .16, .025]} /><meshStandardMaterial color={index % 3 === 0 ? '#ffe19a' : '#b9e1e4'} roughness={.3} />
  </mesh>)}</>
}

const PropertyBuilding = memo(function PropertyBuilding({ tile, level, mortgaged, selected, lowQuality }: { tile: PropertyTile; level: number; mortgaged: boolean; selected: boolean; lowQuality: boolean }) {
  const color = GROUP_COLORS[tile.group]
  const rotation = lotRotation(tile.index)
  const position = lotPosition(tile.index)
  const compact = isCompactLot(tile.index)
  const lotWidth = compact ? .96 : 1.48
  const lotDepth = compact ? .96 : isShoulderLot(tile.index) ? 1.62 : 1.7
  const tilePosition = cityPosition(tile.index)
  const worldDx = tilePosition[0] - position[0]
  const worldDz = tilePosition[2] - position[2]
  const localDx = Math.cos(rotation) * worldDx - Math.sin(rotation) * worldDz
  const localDz = Math.sin(rotation) * worldDx + Math.cos(rotation) * worldDz
  const accessDistance = Math.hypot(localDx, localDz)
  const accessX = localDx / accessDistance
  const accessZ = localDz / accessDistance
  const lotBoundary = 1 / Math.max(Math.abs(accessX) / (lotWidth / 2), Math.abs(accessZ) / (lotDepth / 2))
  const accessLength = Math.max(.18, accessDistance - lotBoundary - .78)
  const accessCenter = lotBoundary + accessLength / 2
  const accessRotation = Math.atan2(accessX, accessZ)
  const apartment = ['centro', 'midia'].includes(tile.group)
  const mansion = ['poder', 'zona-sul'].includes(tile.group)
  const premium = tile.price >= 420
  const modest = tile.price <= 220
  const height = level === 4 ? 2.35 : level >= 2 ? 1.08 + level * .32 + (apartment ? .15 : 0) : .62 + level * .24 + (premium ? .12 : 0)
  const width = compact ? (level === 4 ? .86 : .76) : level === 4 ? 1.16 : 1 + (premium ? .1 : modest ? -.08 : 0)
  const depth = compact ? .68 : level === 4 ? .94 : mansion ? .88 : .8
  const facade = mortgaged ? '#888b86' : ({ orla: '#e5a978', 'zona-sul': '#efd0a6', centro: '#c7d2cd', barra: '#d8ddd0', poder: '#eee6d3', midia: '#aebfc0' } as const)[tile.group]
  const roof = mortgaged ? '#777b76' : ({ orla: '#c85f45', 'zona-sul': '#a9473b', centro: '#536f73', barra: '#4da1a4', poder: '#d3b35b', midia: '#554e70' } as const)[tile.group]
  const floors = Math.max(1, level === 4 ? 6 : level + 1 + (apartment && level >= 2 ? 1 : 0))
  return <group position={position} rotation-y={rotation}>
    <RoundedBox args={[lotWidth, .12, lotDepth]} radius={.04} smoothness={2} position-y={-.04} receiveShadow onClick={event => event.stopPropagation()}>
      <meshStandardMaterial color={mortgaged ? '#a9aaa0' : selected ? '#fff4a9' : '#c8d1a9'} roughness={.92} emissive={selected ? color : '#000'} emissiveIntensity={selected ? .2 : 0} />
    </RoundedBox>
    <Box position={[0, .035, -lotDepth / 2 + .04]} size={[lotWidth - .08, .035, .035]} color={mortgaged ? '#777b76' : color} castShadow={false} />
    <Box position={[-lotWidth * .32, .035, lotDepth / 2 - .04]} size={[lotWidth * .25, .035, .035]} color={mortgaged ? '#777b76' : color} castShadow={false} />
    <Box position={[lotWidth * .32, .035, lotDepth / 2 - .04]} size={[lotWidth * .25, .035, .035]} color={mortgaged ? '#777b76' : color} castShadow={false} />
    <Box position={[-lotWidth / 2 + .04, .035, 0]} size={[.035, .035, lotDepth - .12]} color={mortgaged ? '#777b76' : color} castShadow={false} />
    <Box position={[lotWidth / 2 - .04, .035, 0]} size={[.035, .035, lotDepth - .12]} color={mortgaged ? '#777b76' : color} castShadow={false} />
    <Box position={[accessX * accessCenter, .04, accessZ * accessCenter]} rotation={[0, accessRotation, 0]} size={[compact ? .3 : .4, .04, accessLength]} color="#d9d1bf" castShadow={false} />
    {/* The base building identifies the lot; upgrades change silhouette and floors. */}
    <group position={[0, 0, -.08]}>
      <RoundedBox args={[width, height, depth]} radius={level === 4 ? .08 : .035} smoothness={2} position={[0, height / 2 + .05, 0]} castShadow>
        <meshStandardMaterial color={level === 4 && !mortgaged ? '#efe3bd' : facade} roughness={.68} />
      </RoundedBox>
      <Box position={[0, height + .115, 0]} size={[width + .08, .12, depth + .08]} color={level === 4 ? '#b94336' : roof} />
      {!lowQuality && <Windows width={width} floors={floors} front={depth / 2 + .015} />}
      <Box position={[0, .25, depth / 2 + .025]} size={[compact ? .19 : .22, .4, .04]} color="#31484a" />
      {level >= 1 && level < 4 && <Box position={[0, .62, depth / 2 + .095]} size={[width + .1, .07, .17]} color={tile.group === 'midia' ? '#f2c547' : '#fff2d5'} />}
      {level >= 2 && level < 4 && !compact && <RoundedBox args={[width * .58, .38, depth * .68]} radius={.035} smoothness={2} position={[width * .36, .24, -.18]} castShadow><meshStandardMaterial color={facade} roughness={.72} /></RoundedBox>}
      {level >= 3 && level < 4 && <Box position={[0, height + .26, 0]} size={[width * .54, .18, depth * .55]} color={roof} />}
      {tile.group === 'orla' && level < 4 && <mesh position={[0, height + .21, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[width * .68, .3, 4]} /><meshStandardMaterial color={roof} roughness={.78} /></mesh>}
      {tile.group === 'poder' && !compact && !lowQuality && <>{[-.32, 0, .32].map(x => <mesh key={x} position={[x * width, .37, depth / 2 + .06]} castShadow><cylinderGeometry args={[.035, .045, .62, 8]} /><meshStandardMaterial color="#f8f0dc" roughness={.65} /></mesh>)}</>}
      {tile.group === 'zona-sul' && level >= 1 && !compact && <Box position={[0, .9, depth / 2 + .09]} size={[width * .72, .055, .16]} color="#704d39" />}
      {tile.group === 'barra' && level >= 2 && !compact && <Box position={[-width * .34, height * .58, -.12]} size={[width * .28, height * .72, depth * .72]} color="#b6d7d2" />}
      {tile.group === 'centro' && level >= 2 && <mesh position={[0, height + .32, 0]} castShadow><cylinderGeometry args={[.14, .17, .35, 10]} /><meshStandardMaterial color="#77969a" roughness={.78} /></mesh>}
      {tile.group === 'midia' && level >= 1 && <><Box position={[0, height + .42, 0]} size={[.035, .62, .035]} color="#4a5154" /><mesh position={[0, height + .65, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[.16, .018, 6, 20]} /><meshStandardMaterial color="#e7c54e" /></mesh></>}
      {level === 4 && <>
        <Text position={[0, 1.82, depth / 2 + .04]} fontSize={compact ? .13 : .2} color="#8f2923" outlineWidth={.006} outlineColor="#fff3d6" anchorX="center" fontWeight={800}>HOTEL</Text>
        <Box position={[compact ? -.2 : -.45, 2.48, 0]} size={[.06, .35, .06]} color="#b94336" /><mesh position={[compact ? -.09 : -.29, 2.57, 0]}><planeGeometry args={[compact ? .2 : .32, .2]} /><meshStandardMaterial color="#f1c83d" side={2} /></mesh>
      </>}
    </group>
    {level > 0 && !compact && <group position={[0, .15, -.67]}>{Array.from({ length: 4 }, (_, index) => <mesh key={index} position={[-.42 + index * .28, 0, 0]}><boxGeometry args={[.2, .16, .2]} /><meshStandardMaterial color={index < level ? (level === 4 ? '#b94336' : color) : '#e8e0c9'} /></mesh>)}</group>}
    {mortgaged && <Text position={[0, .17, .18]} rotation={[-Math.PI / 2, 0, 0]} fontSize={compact ? .11 : .2} maxWidth={compact ? .76 : 1.34} color="#7b2522" outlineWidth={.006} outlineColor="#fff3d6" anchorX="center" fontWeight={800}>HIPOTECADO</Text>}
  </group>
})

const Palm = memo(function Palm({ x, z, index }: { x: number; z: number; index: number }) {
  const lean = (index % 2 ? 1 : -1) * .055
  return <group position={[x, SURFACE_LEVELS.centerTop, z]} rotation-z={lean}>
    <mesh castShadow position-y={.44}><cylinderGeometry args={[.042, .068, .88, 9]} /><meshStandardMaterial color="#8b603b" roughness={.88} /></mesh>
    <mesh castShadow position-y={.89}><sphereGeometry args={[.12, 9, 7]} /><meshStandardMaterial color="#39784c" roughness={.82} /></mesh>
    {Array.from({ length: 7 }, (_, leaf) => {
      const angle = leaf * Math.PI * 2 / 7
      return <mesh key={leaf} castShadow position={[Math.cos(angle) * .28, .89 - (leaf % 2) * .035, Math.sin(angle) * .28]} rotation={[0, Math.PI / 2 - angle, (leaf % 2 ? 1 : -1) * .1]} scale={[.8, .35, 4]}>
        <sphereGeometry args={[.075, 8, 5]} /><meshStandardMaterial color={leaf % 2 ? '#3d8d57' : '#57a868'} roughness={.86} />
      </mesh>
    })}
  </group>
})

const WindshieldPatriot = memo(function WindshieldPatriot() {
  return <group position={[5.2, SURFACE_LEVELS.centerTop + .12, 4.15]} rotation-y={-.35}>
    <Box position={[0, .22, 0]} size={[.72, .38, 1.25]} color="#d8d3c4" />
    <Box position={[0, .55, .25]} size={[.67, .44, .58]} color="#315f5d" />
    <Box position={[0, .57, .56]} size={[.55, .26, .025]} color="#9ed8de" />
    <Box position={[0, .2, .72]} size={[.76, .17, .15]} color="#c7c1b0" />
    {[-.39, .39].flatMap((x, side) => [-.35, .35].map((z, axle) => <mesh key={`${side}-${axle}`} position={[x, .13, z]} rotation-z={Math.PI / 2} castShadow><cylinderGeometry args={[.14, .14, .1, 12]} /><meshStandardMaterial color="#25292a" roughness={.9} /></mesh>))}
    <group position={[0, .58, .7]} rotation-x={-.18}>
      <Box position={[0, 0, 0]} size={[.19, .34, .1]} color="#e8cf36" />
      <mesh position={[0, .25, 0]} castShadow><sphereGeometry args={[.11, 10, 8]} /><meshStandardMaterial color="#bd8868" roughness={.8} /></mesh>
      <Box position={[-.18, .06, 0]} size={[.28, .07, .07]} color="#296b45" rotation={[0, 0, -.55]} />
      <Box position={[.18, .06, 0]} size={[.28, .07, .07]} color="#296b45" rotation={[0, 0, .55]} />
      <Box position={[-.07, -.25, 0]} size={[.07, .25, .08]} color="#2b4e7a" rotation={[0, 0, -.18]} />
      <Box position={[.07, -.25, 0]} size={[.07, .25, .08]} color="#2b4e7a" rotation={[0, 0, .18]} />
    </group>
    <Text position={[0, .02, -.74]} rotation={[-Math.PI / 2, 0, 0]} fontSize={.09} color="#17383a" anchorX="center" fontWeight={800}>PARA-BRISA PATRIÓTICO</Text>
  </group>
})

const InteriorScenery = memo(function InteriorScenery({ lowQuality }: { lowQuality: boolean }) {
  return <group>
    {/* Low miniature waterfront that does not hide board tiles. */}
    <RoundedBox args={[3.5, .1, 1.05]} radius={.18} smoothness={3} position={[-3.9, .39, 3.85]} receiveShadow><meshStandardMaterial color="#e8ce85" roughness={.9} /></RoundedBox>
    <RoundedBox args={[3.45, .12, .5]} radius={.15} smoothness={3} position={[-3.9, .42, 3.05]}><meshStandardMaterial color="#55b5c7" roughness={.3} /></RoundedBox>
    {Array.from({ length: 8 }, (_, index) => <mesh key={index} position={[-5.3 + index * .4, .49, 4.05]} rotation-y={(index % 2 ? 1 : -1) * .25}><boxGeometry args={[.24, .018, .08]} /><meshStandardMaterial color={index % 2 ? '#263d40' : '#fffaf0'} /></mesh>)}
    {!lowQuality && <><Palm x={-5.15} z={3.8} index={0} /><Palm x={-2.7} z={3.8} index={1} /></>}
    {/* Stylised Rio hills and landmarks. */}
    <group position={[-4.3, .35, -3.3]}>
      <mesh castShadow scale={[1.25, .7, .9]} position={[-.4, .35, 0]}><dodecahedronGeometry args={[.85, 1]} /><meshStandardMaterial color="#588064" roughness={1} /></mesh>
      <mesh castShadow scale={[.85, .55, .75]} position={[.55, .28, 0]}><dodecahedronGeometry args={[.72, 1]} /><meshStandardMaterial color="#709a72" roughness={1} /></mesh>
      <Box position={[0, .94, 0]} size={[.18, .55, .15]} color="#f0eadc" /><Box position={[0, 1.08, 0]} size={[.7, .1, .12]} color="#f0eadc" />
    </group>
    <group position={[4.25, .37, -3.65]}>
      {[-.65, -.32, 0, .32, .65].map(x => <Box key={x} position={[x, .35, 0]} size={[.09, .7, .24]} color="#f2ead8" />)}
      <Box position={[0, .76, 0]} size={[1.4, .12, .24]} color="#f2ead8" />
    </group>
    <WindshieldPatriot />
    {/* Card stacks remain inside their reserved centre zones. */}
    <CardStack position={[...CENTER_ZONES.leftCards]} color="#e3b83e" label="DIÁRIO\nOFICIAL" rotation={-.12} />
    <CardStack position={[...CENTER_ZONES.rightCards]} color="#d66551" label="ACONTECI-\nMENTOS" rotation={.12} />
    {TREES.slice(0, lowQuality ? 7 : TREES.length).map(([x, z], index) => <Palm key={index} x={x} z={z} index={index} />)}
  </group>
})

function CardStack({ position, color, label, rotation }: { position: [number, number, number]; color: string; label: string; rotation: number }) {
  return <group position={position} rotation-y={rotation}>
    <RoundedBox args={[1.68, .025, 2.36]} radius={.055} smoothness={2} position-y={-.088} receiveShadow><meshStandardMaterial color="#e8dfc7" roughness={.9} /></RoundedBox>
    <Box position={[0, -.064, -1.15]} size={[1.64, .018, .045]} color={color} castShadow={false} />
    <Box position={[0, -.064, 1.15]} size={[1.64, .018, .045]} color={color} castShadow={false} />
    <Box position={[-.82, -.064, 0]} size={[.045, .018, 2.26]} color={color} castShadow={false} />
    <Box position={[.82, -.064, 0]} size={[.045, .018, 2.26]} color={color} castShadow={false} />
    <RoundedBox args={[1.34, .12, 1.78]} radius={.045} smoothness={2} position-z={-.08} receiveShadow><meshStandardMaterial color="#f2ead5" roughness={.86} /></RoundedBox>
    <RoundedBox args={[1.27, .032, 1.69]} radius={.035} smoothness={2} position={[0, .084, -.08]} castShadow><meshStandardMaterial color={color} roughness={.78} /></RoundedBox>
    <RoundedBox args={[1.42, .032, .3]} radius={.025} smoothness={2} position={[0, -.042, 1.01]}><meshStandardMaterial color={color} roughness={.8} /></RoundedBox>
    <Text position={[0, -.015, 1.01]} rotation={[-Math.PI / 2, 0, 0]} fontSize={.125} maxWidth={1.3} color="#17383a" outlineWidth={.006} outlineColor="#fff8e8" anchorX="center" anchorY="middle" textAlign="center" fontWeight={800}>{label.replace('\n', ' ')}</Text>
  </group>
}

const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-.2, .2], [.2, -.2]], 3: [[-.2, .2], [0, 0], [.2, -.2]],
  4: [[-.2, .2], [.2, .2], [-.2, -.2], [.2, -.2]], 5: [[-.2, .2], [.2, .2], [0, 0], [-.2, -.2], [.2, -.2]],
  6: [[-.2, .24], [.2, .24], [-.2, 0], [.2, 0], [-.2, -.24], [.2, -.24]],
}

function Pips({ value, face }: { value: number; face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right' }) {
  return <>{PIP_LAYOUT[value].map(([x, y], index) => {
    const position: [number, number, number] = face === 'top' ? [x, .397, -y] : face === 'bottom' ? [x, -.397, y] : face === 'front' ? [x, y, .397] : face === 'back' ? [-x, y, -.397] : face === 'right' ? [.397, y, -x] : [-.397, y, x]
    const rotation: [number, number, number] = face === 'top' ? [-Math.PI / 2, 0, 0] : face === 'bottom' ? [Math.PI / 2, 0, 0] : face === 'back' ? [0, Math.PI, 0] : face === 'right' ? [0, Math.PI / 2, 0] : face === 'left' ? [0, -Math.PI / 2, 0] : [0, 0, 0]
    return <mesh key={index} position={position} rotation={rotation} renderOrder={3}><circleGeometry args={[.055, 14]} /><meshBasicMaterial color="#17383a" polygonOffset polygonOffsetFactor={-2} /></mesh>
  })}</>
}

function targetQuaternion(value: number) {
  const quaternion = new Quaternion()
  if (value === 6) quaternion.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI)
  if (value === 2) quaternion.setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2)
  if (value === 5) quaternion.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2)
  if (value === 3) quaternion.setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2)
  if (value === 4) quaternion.setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI / 2)
  return quaternion
}

function Die({ value, index, rollKey, reducedMotion }: { value: number; index: number; rollKey: string; reducedMotion: boolean }) {
  const group = useRef<Group>(null)
  const elapsed = useRef(2)
  const final = useMemo(() => targetQuaternion(value), [value])
  const baseX = index ? .56 : -.56
  useEffect(() => {
    elapsed.current = reducedMotion ? 2 : 0
    if (!group.current) return
    group.current.position.set(baseX, .45, index ? .12 : -.12)
    if (reducedMotion) group.current.quaternion.copy(final)
    else group.current.rotation.set(index ? 1.7 : -1.2, index ? -1.1 : 2.2, index ? .8 : -1.5)
  }, [rollKey, reducedMotion, final, baseX, index])
  useFrame((_, delta) => {
    if (!group.current || elapsed.current >= 1.45) return
    elapsed.current += delta
    const t = Math.min(1, elapsed.current / 1.45)
    const energy = 1 - t
    group.current.position.x = baseX + Math.sin(t * 13 + index * 2) * energy * .52
    group.current.position.z = (index ? .12 : -.12) + Math.sin(t * 9 + index) * energy * .38
    group.current.position.y = .45 + Math.abs(Math.sin(t * Math.PI * 5.4)) * energy * 1.25
    group.current.rotateX(delta * (11 * energy + 1)); group.current.rotateZ(delta * (14 * energy + 1))
    if (t > .72) group.current.quaternion.slerp(final, Math.min(1, delta * 11))
    if (t === 1) { group.current.position.set(baseX, .45, index ? .12 : -.12); group.current.quaternion.copy(final) }
  })
  return <group ref={group}>
    <RoundedBox args={[.76, .76, .76]} radius={.14} smoothness={4} castShadow><meshStandardMaterial color="#fffaf0" roughness={.3} /></RoundedBox>
    <Pips value={1} face="top" /><Pips value={6} face="bottom" /><Pips value={2} face="front" /><Pips value={5} face="back" /><Pips value={3} face="right" /><Pips value={4} face="left" />
  </group>
}

function DiceTray({ state, reducedMotion }: { state: GameState; reducedMotion: boolean }) {
  const values = state.lastRoll ?? [1, 1]
  const key = state.lastRollActionId ?? `legacy-${values.join('-')}-${state.players[state.turnIndex]?.position ?? 0}`
  return <group position={[...CENTER_ZONES.dice]}>
    <RoundedBox args={[3.25, .13, 2.35]} radius={.22} smoothness={4} receiveShadow><meshStandardMaterial color="#1a4544" roughness={.78} /></RoundedBox>
    <mesh position-y={.085} rotation-x={-Math.PI / 2} renderOrder={2}><ringGeometry args={[1.12, 1.25, 32]} /><meshStandardMaterial color="#d1ae52" polygonOffset polygonOffsetFactor={-2} /></mesh>
    <Die value={values[0]} index={0} rollKey={key} reducedMotion={reducedMotion} /><Die value={values[1]} index={1} rollKey={key} reducedMotion={reducedMotion} />
    <Text position={[0, .12, -.86]} rotation={[-Math.PI / 2, 0, 0]} fontSize={.16} letterSpacing={.1} color="#f5d26c" anchorX="center" fontWeight={800}>ÁREA DE LANÇAMENTO</Text>
  </group>
}

function MovingPawn({ player, occupantIndex, occupantCount, active, focused, reducedMotion, phase, cameraFocus, showLabel }: { player: Player; occupantIndex: number; occupantCount: number; active: boolean; focused: boolean; reducedMotion: boolean; phase: GameState['phase']; cameraFocus: { current: Vector3 }; showLabel: boolean }) {
  const base = cityPosition(player.position)
  const baseX = base[0]
  const baseZ = base[2]
  const [offsetX, offsetZ] = pawnSlot(occupantIndex, occupantCount)
  const target = useMemo(() => new Vector3(baseX + offsetX, SURFACE_LEVELS.pawnRoot, baseZ + offsetZ), [baseX, baseZ, offsetX, offsetZ])
  const group = useRef<Group>(null)
  const [moving, setMoving] = useState(false)
  const initialised = useRef(false)
  const previousIndex = useRef(player.position)
  const waypoints = useRef<Vector3[]>([])
  const speed = useRef(0)
  useEffect(() => {
    if (!group.current) return
    if (!initialised.current || reducedMotion) { group.current.position.copy(target); initialised.current = true; setMoving(false) }
    else {
      const path: Vector3[] = []; let cursor = previousIndex.current
      while (cursor !== player.position && path.length < CITY_PATH.length) {
        cursor = (cursor + 1) % CITY_PATH.length
        const point = cityPosition(cursor); path.push(new Vector3(point[0] + offsetX, SURFACE_LEVELS.pawnRoot, point[2] + offsetZ))
      }
      waypoints.current = path.length ? path : [target]; speed.current = 0; setMoving(true)
    }
    previousIndex.current = player.position
  }, [target, reducedMotion, player.position, offsetX, offsetZ])
  useFrame((_, delta) => {
    if (!group.current) return
    if (focused) cameraFocus.current.copy(group.current.position).setY(.72)
    if (!moving) return
    const waypoint = waypoints.current[0] ?? target
    const dx = waypoint.x - group.current.position.x; const dz = waypoint.z - group.current.position.z
    const distanceToWaypoint = Math.hypot(dx, dz)
    const remaining = distanceToWaypoint + waypoints.current.slice(1).reduce((total, point, index, list) => total + point.distanceTo(index ? list[index - 1] : waypoint), 0)
    const maxSpeed = 2.7; const acceleration = 7.5
    const desiredSpeed = Math.min(maxSpeed, Math.sqrt(Math.max(0, 2 * acceleration * remaining)))
    speed.current = MathUtils.damp(speed.current, desiredSpeed, desiredSpeed < speed.current ? 9 : 5, delta)
    group.current.rotation.y = MathUtils.damp(group.current.rotation.y, Math.atan2(dx, dz), 13, delta)
    const step = Math.min(distanceToWaypoint, Math.max(.01, speed.current) * delta)
    if (distanceToWaypoint > .0001) {
      group.current.position.x += dx / distanceToWaypoint * step
      group.current.position.z += dz / distanceToWaypoint * step
      group.current.position.y = MathUtils.damp(group.current.position.y, waypoint.y, 12, delta)
    }
    if (distanceToWaypoint <= .025) {
      group.current.position.copy(waypoint); waypoints.current.shift()
      if (!waypoints.current.length) { speed.current = 0; setMoving(false) }
    }
  })
  // Animated pawns keep their contact rings, rather than leaving a baked silhouette behind.
  useLayoutEffect(() => {
    group.current?.traverse(object => { object.castShadow = false })
  }, [])
  const animation: CharacterAnimation = moving ? 'walk' : active && (phase === 'property' || phase === 'event') ? 'celebrate' : player.jailTurns || player.bankrupt ? 'frustrated' : phase === 'trade' ? 'negotiate' : 'idle'
  return <group ref={group}>
    <mesh position-y={.025} rotation-x={-Math.PI / 2} renderOrder={5}><ringGeometry args={[.3, .36, 24]} /><meshBasicMaterial color={CHARACTERS[player.characterId].accent} transparent opacity={active ? .95 : .5} depthWrite={false} polygonOffset polygonOffsetFactor={-2} /></mesh>
    <CharacterModel characterId={player.characterId} active={active} reducedMotion={reducedMotion} scale={.48} animation={animation} />
    {showLabel && <Billboard position={[0, 1.18 + occupantIndex * .24, 0]}><mesh position-z={-.01}><planeGeometry args={[1.02, .27]} /><meshBasicMaterial color={CHARACTERS[player.characterId].color} transparent opacity={.96} depthWrite={false} /></mesh><Text position-z={.01} fontSize={.14} color="#fff" outlineWidth={.004} outlineColor="#17383a" anchorX="center" maxWidth={.92} fontWeight={800}>{player.nickname}</Text></Billboard>}
  </group>
}

function CameraRig({ recenterSignal, focusedPlayerId, cameraFocus, reducedMotion }: { recenterSignal: number; focusedPlayerId: string; cameraFocus: { current: Vector3 }; reducedMotion: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, size } = useThree()
  const perspective = camera as PerspectiveCamera
  // One finger pans; pinch zoom uses OrbitControls while finger twist rotates the map.
  useEffect(() => {
    const element = controls.current?.domElement
    if (!element) return
    const pointers = new Map<number, { x: number; y: number }>()
    let previousAngle: number | undefined
    const angle = () => {
      const [a, b] = [...pointers.values()]
      return a && b ? Math.atan2(b.y - a.y, b.x - a.x) : undefined
    }
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      previousAngle = angle()
    }
    const move = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      const next = angle()
      if (next !== undefined && previousAngle !== undefined && controls.current) {
        const delta = Math.atan2(Math.sin(next - previousAngle), Math.cos(next - previousAngle))
        controls.current.setAzimuthalAngle(controls.current.getAzimuthalAngle() - delta)
      }
      previousAngle = next
    }
    const end = (event: PointerEvent) => { pointers.delete(event.pointerId); previousAngle = angle() }
    element.addEventListener('pointerdown', down)
    element.addEventListener('pointermove', move)
    element.addEventListener('pointerup', end)
    element.addEventListener('pointercancel', end)
    element.addEventListener('lostpointercapture', end)
    return () => {
      element.removeEventListener('pointerdown', down)
      element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerup', end)
      element.removeEventListener('pointercancel', end)
      element.removeEventListener('lostpointercapture', end)
    }
  }, [])
  const manualUntil = useRef(0)
  const initialised = useRef(false)
  const framedFocus = useRef(new Vector3())
  const isCompactViewport = size.height < 500
  // Keep the familiar framing while giving nearby buildings natural perspective depth.
  const fitZoom = Math.max(14, Math.min(40, size.width / (CITY_BOUNDS.width + 8), size.height / (CITY_BOUNDS.depth + 4.5)))
  const defaultZoom = Math.min(78, Math.max(isCompactViewport ? 32 : 56, fitZoom * 2.08))
  const defaultDistance = Math.max(12, size.height * 1.3 / (2 * defaultZoom * Math.tan(MathUtils.degToRad(perspective.fov / 2))))
  const cameraOffset = useRef(new Vector3())
  useEffect(() => {
    if (!initialised.current) {
      const focus = cameraFocus.current
      perspective.position.copy(focus).add(new Vector3(-10.5, 12, 10.5).setLength(defaultDistance))
      controls.current?.target.copy(focus); controls.current?.update(); initialised.current = true
    } else if (manualUntil.current === 0) {
      perspective.position.sub(controls.current?.target ?? cameraFocus.current).setLength(defaultDistance).add(controls.current?.target ?? cameraFocus.current)
    }
  }, [perspective, cameraFocus, defaultDistance])
  useEffect(() => {
    if (!controls.current || !initialised.current) return
    manualUntil.current = 0
    const focus = cameraFocus.current.clone().setY(.72)
    controls.current.target.copy(focus)
    perspective.position.copy(focus).add(new Vector3(-10.5, 12, 10.5).setLength(defaultDistance))
    controls.current.update()
  }, [recenterSignal, focusedPlayerId, cameraFocus, defaultDistance, perspective])
  useFrame((_, delta) => {
    if (!controls.current || performance.now() < manualUntil.current) return
    const desired = framedFocus.current.copy(cameraFocus.current).setY(.72)
    const previous = controls.current.target.clone()
    const smoothing = reducedMotion ? 1 : 1 - Math.exp(-delta * 3.8)
    controls.current.target.lerp(desired, smoothing)
    // Move camera and target by the same delta to preserve orbit and distance.
    camera.position.add(controls.current.target.clone().sub(previous))
    const offset = cameraOffset.current.copy(camera.position).sub(controls.current.target)
    const distance = reducedMotion ? defaultDistance : MathUtils.damp(offset.length(), defaultDistance, 3.2, delta)
    camera.position.copy(controls.current.target).add(offset.setLength(distance))
    controls.current.update()
  })
  return <OrbitControls ref={controls} makeDefault touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }} screenSpacePanning={false} enablePan enableRotate enableZoom enableDamping dampingFactor={.075} rotateSpeed={.58} zoomSpeed={.82} panSpeed={.62} minDistance={Math.max(4, defaultDistance * .45)} maxDistance={120} minPolarAngle={.52} maxPolarAngle={1.5} target={[0, .35, 0]} onStart={() => { manualUntil.current = Number.POSITIVE_INFINITY }} onEnd={() => { manualUntil.current = Number.POSITIVE_INFINITY }} />
}

function BoardScene({ state, reducedMotion, recenterSignal, focusedPlayerId, quality, selected, onSelect }: { state: GameState; reducedMotion: boolean; recenterSignal: number; focusedPlayerId: string; quality: 'low' | 'high'; selected?: string; onSelect: (tileId?: string) => void }) {
  const active = state.players[state.turnIndex]
  const focusedPlayer = state.players.find(player => player.id === focusedPlayerId) ?? active
  const initialFocus = cityPosition(focusedPlayer?.position ?? 0)
  const cameraFocus = useRef(new Vector3(initialFocus[0], .72, initialFocus[2]))
  const focusedPosition = cityPosition(focusedPlayer?.position ?? 0)
  const focusedX = focusedPosition[0]
  const focusedZ = focusedPosition[2]
  useEffect(() => { cameraFocus.current.set(focusedX, .72, focusedZ) }, [focusedX, focusedZ])
  return <>
    <hemisphereLight intensity={1.55} color="#fff7df" groundColor="#526e66" />
    {/* Bake the fixed light once; camera movement reuses the same soft shadow map. */}
    <directionalLight key={quality} castShadow position={[18, 32, 18]} intensity={2.1} color="#fff2d2" shadow-autoUpdate={false} shadow-needsUpdate={true} shadow-mapSize={[quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024]} shadow-camera-left={-36} shadow-camera-right={36} shadow-camera-top={36} shadow-camera-bottom={-36} shadow-camera-near={1} shadow-camera-far={110} shadow-radius={5} shadow-blurSamples={12} shadow-bias={-.00005} shadow-normalBias={.05} />
    <RioBarEnvironment />
    <PatioTable />

    <group onPointerMissed={() => onSelect(undefined)}>
      <PhysicalBoard />
      <BoardTiles state={state} selected={selected} onSelect={onSelect} />
      {PROPERTIES.map(tile => {
        const property = state.properties.find(value => value.tileId === tile.id)!
        return <group key={tile.id} onClick={event => { event.stopPropagation(); onSelect(tile.id) }}><PropertyBuilding tile={tile} level={property.level} mortgaged={property.mortgaged} selected={selected === tile.id} lowQuality={quality === 'low'} /></group>
      })}
      <InteriorScenery lowQuality={quality === 'low'} />
      <DiceTray state={state} reducedMotion={reducedMotion} />
      {state.players.map(player => {
        const occupants = state.players.filter(candidate => candidate.position === player.position && !candidate.bankrupt)
        return <MovingPawn key={player.id} player={player} occupantIndex={Math.max(0, occupants.findIndex(candidate => candidate.id === player.id))} occupantCount={Math.max(1, occupants.length)} active={active?.id === player.id} focused={focusedPlayer?.id === player.id} cameraFocus={cameraFocus} reducedMotion={reducedMotion} phase={state.phase} showLabel={quality === 'high' || active?.id === player.id || focusedPlayer?.id === player.id} />
      })}
    </group>
    <ContactShadows position={[0, -.685, 0]} opacity={quality === 'high' ? .34 : .2} scale={30} blur={1.8} far={12} resolution={quality === 'high' ? 512 : 256} frames={1} />
    <CameraRig recenterSignal={recenterSignal} focusedPlayerId={focusedPlayerId} cameraFocus={cameraFocus} reducedMotion={reducedMotion} />
  </>
}

export function Board3D({ state, reducedMotion, quality, renderScale, tipsy, recenterSignal, focusedPlayerId }: { state: GameState; reducedMotion: boolean; quality: 'low' | 'high'; renderScale: number; tipsy: boolean; recenterSignal: number; focusedPlayerId: string }) {
  const [selected, setSelected] = useState<string>()
  return <><Canvas shadows="variance" dpr={renderScale} camera={{ position: [-10.5, 12, 10.5], fov: 45, near: .1, far: 1000 }} performance={{ min: .55, debounce: 250 }} gl={{ antialias: quality === 'high', powerPreference: 'high-performance', alpha: false }}>
    <color attach="background" args={['#b8d6d2']} />
    <fog attach="fog" args={['#b8d6d2', 900, 2800]} />
    <Suspense fallback={null}><BoardScene state={state} reducedMotion={reducedMotion} recenterSignal={recenterSignal} focusedPlayerId={focusedPlayerId} quality={quality} selected={selected} onSelect={setSelected} /></Suspense>
    {tipsy && <TipsyEffect reducedMotion={reducedMotion} />}
  </Canvas><PropertyInspector state={state} tileId={selected} onSelect={setSelected} /></>
}
