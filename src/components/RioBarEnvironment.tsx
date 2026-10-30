import { memo, useLayoutEffect, useRef } from 'react'
import { Text } from '@react-three/drei'
import { CatmullRomCurve3, Color, InstancedMesh, Object3D, PlaneGeometry, Vector3 } from 'three'

type Block = { p: [number, number, number]; s: [number, number, number]; c: string; r?: number }
const FLOOR = -15.12
const PALETTE = ['#d8ab56', '#ad6750', '#6caa9b', '#71a5bd', '#d18790', '#a5b36b', '#c1b39a', '#b77a4e']
const random = (i: number) => { const n = Math.sin(i * 127.1 + 43.7) * 43758.5453; return n - Math.floor(n) }

function Blocks({ blocks }: { blocks: Block[] }) {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!mesh.current) return
    const transform = new Object3D()
    const color = new Color()
    blocks.forEach((block, i) => {
      transform.position.set(...block.p)
      transform.scale.set(...block.s)
      transform.rotation.set(0, block.r ?? 0, 0)
      transform.updateMatrix()
      mesh.current!.setMatrixAt(i, transform.matrix)
      mesh.current!.setColorAt(i, color.set(block.c))
    })
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
    mesh.current.computeBoundingSphere()
  }, [blocks])
  return <instancedMesh ref={mesh} args={[undefined, undefined, blocks.length]} receiveShadow><boxGeometry /><meshStandardMaterial roughness={.92} /></instancedMesh>
}

function Box({ p, s, color, rotation = 0 }: { p: [number, number, number]; s: [number, number, number]; color: string; rotation?: number }) {
  return <mesh position={p} rotation-y={rotation} receiveShadow><boxGeometry args={s} /><meshStandardMaterial color={color} roughness={.85} /></mesh>
}

const paving: Block[] = []
for (let x = -17; x <= 17; x++) for (let z = -16; z <= 22; z++) {
  const i = (x + 17) * 39 + z + 16
  paving.push({ p: [x * 4.4 + (z % 2) * 2.2, FLOOR - .16 + random(i) * .08, z * 3.2], s: [4.22, .35, 3.03], c: ['#aba594', '#b6ae9b', '#a29b8b', '#c1b6a1'][i % 4], r: (random(i + 8) - .5) * .035 })
}
const houses: Block[] = []
for (let row = 0; row < 5; row++) for (let col = 0; col < 12; col++) {
  const i = row * 12 + col
  const width = 18 + random(i) * 12
  const height = 20 + random(i + 3) * 32
  const x = (col - 5.5) * 31 + (random(i + 1) - .5) * 13
  const base = FLOOR + row * 26
  const z = -135 - row * 57 - random(i + 2) * 20
  const depth = 23 + random(i + 5) * 14
  houses.push({ p: [x, base + height / 2, z], s: [width, height, depth], c: PALETTE[i % PALETTE.length] })
  houses.push({ p: [x, base + height + .6, z], s: [width + 1.8, 1.2, depth + 1.8], c: '#9b9282' })
  // Dark inset windows, pale concrete frames, and small open roof terraces.
  for (let floor = 0; floor < Math.floor(height / 13); floor++) for (const side of [-1, 1]) {
    const y = base + 7 + floor * 13
    houses.push({ p: [x + side * width * .25, y, z + depth / 2 + .2], s: [5.2, 6.8, .45], c: '#ddd6bd' })
    houses.push({ p: [x + side * width * .25, y, z + depth / 2 + .5], s: [4.1, 5.7, .3], c: i % 3 ? '#324c50' : '#52453b' })
  }
  if (i % 3 === 0) houses.push({ p: [x + width * .26, base + height + 2.7, z], s: [4.5, 4, 5], c: '#384b55' })
  if (i % 4 === 0) for (const side of [-1, 1]) houses.push({ p: [x + side * width / 2, base + height + 3, z], s: [.7, 6, depth], c: '#ac6c50' })
}

// A continuous hillside supports the stepped buildings, instead of floating blocks.
const hillside = new PlaneGeometry(470, 340, 18, 18)
hillside.rotateX(-Math.PI / 2)
const terrainPositions = hillside.attributes.position
for (let i = 0; i < terrainPositions.count; i++) {
  const x = terrainPositions.getX(i)
  const z = terrainPositions.getZ(i)
  terrainPositions.setY(i, FLOOR + (170 - z) * .4 + Math.sin(x * .018) * 7)
}
hillside.computeVertexNormals()

function Wire({ points, thickness = .1 }: { points: [number, number, number][]; thickness?: number }) {
  const curve = new CatmullRomCurve3(points.map(point => new Vector3(...point)))
  return <mesh><tubeGeometry args={[curve, 30, thickness, 5, false]} /><meshStandardMaterial color="#343c39" roughness={1} /></mesh>
}

function Pole({ x, z }: { x: number; z: number }) {
  return <group position={[x, FLOOR, z]}>
    <mesh position-y={36}><cylinderGeometry args={[.7, 1.15, 72, 10]} /><meshStandardMaterial color="#aaa99b" roughness={1} /></mesh>
    <Box p={[0, 62, 0]} s={[13, .8, .9]} color="#626b63" />
    {[-5, -2, 2, 5].map(n => <mesh key={n} position={[n, 63.2, 0]}><cylinderGeometry args={[.42, .42, 1.6, 8]} /><meshStandardMaterial color="#b3c5b8" /></mesh>)}
    <Box p={[1.2, 45, 0]} s={[2.6, 4, 2.1]} color="#919a91" />
    <Wire points={[[0, 54, 0], [4, 56, 0], [9, 55, 0]]} thickness={.3} />
    <Box p={[9, 54.8, 0]} s={[3.2, .6, 1.6]} color="#c7c7b7" />
  </group>
}

function Bar() {
  return <group position={[0, FLOOR, -65]}>
    <Box p={[0, .6, 8]} s={[98, 1.2, 34]} color="#b9b4a3" />
    <Box p={[-36, 28, 0]} s={[22, 56, 26]} color="#73aaa4" />
    <Box p={[36, 28, 0]} s={[22, 56, 26]} color="#73aaa4" />
    <Box p={[0, 47, 0]} s={[50, 18, 26]} color="#dbcead" />
    <Box p={[0, 18, -12]} s={[52, 36, 1]} color="#283f3c" />
    <Box p={[0, 12, 4]} s={[39, 12, 7]} color="#ced4be" />
    <Box p={[0, 18.5, 4]} s={[41, 1.2, 8]} color="#5c665d" />
    {[-16, -10, -4, 2, 8, 14].map((x, i) => <group key={x}>
      <mesh position={[x, 21, 4]}><cylinderGeometry args={[.5, .65, 4, 8]} /><meshStandardMaterial color={i % 2 ? '#436b35' : '#75492b'} /></mesh>
      <Box p={[x, 9, 8]} s={[5.6, 6.8, .15]} color={i % 2 ? '#d7ddd0' : '#b9c7bd'} />
    </group>)}
    <Box p={[-22, 13, -2]} s={[5, 24, 6]} color="#c9d9d2" />
    <Box p={[-22, 14, 1.2]} s={[4, 17, .2]} color="#58786e" />
    <Box p={[0, 37, 14]} s={[92, 9, 1.2]} color="#236a94" />
    <Text position={[0, 37, 14.8]} fontSize={4.8} fontWeight={800} color="#fff4d3" anchorX="center">BAR DA ESQUINA</Text>
    <Text position={[0, 32, 15]} fontSize={1.25} color="#fff4d3" anchorX="center">CERVEJA GELADA · COMIDA CASEIRA · RIO DE JANEIRO</Text>
    <mesh position={[0, 29, 22]} rotation-x={.14}><boxGeometry args={[94, .6, 18]} /><meshStandardMaterial color="#2878a5" roughness={.7} /></mesh>
    <Box p={[0, 27.8, 31]} s={[94, 3, .4]} color="#236a94" />
    {Array.from({ length: 24 }, (_, i) => <mesh key={i} position={[-45 + i * 3.9, 26.7, 31]} rotation-x={Math.PI / 2}><cylinderGeometry args={[1.95, 1.95, .45, 12, 1, false, 0, Math.PI]} /><meshStandardMaterial color="#236a94" /></mesh>)}
    {[-46, 46].map(x => <Box key={x} p={[x, 14, 30]} s={[.5, 28, .5]} color="#d5d6c6" />)}
    <Box p={[0, 70, -2]} s={[94, 27, 28]} color="#b28365" />
    {[-32, -10, 12, 34].map(x => <group key={x}><Box p={[x, 70, 12.3]} s={[12, 16, .8]} color="#d7c7aa" /><Box p={[x, 70, 12.9]} s={[10, 14, .4]} color="#3b5354" /><Box p={[x, 70, 13.2]} s={[.5, 14, .3]} color="#9bada4" /></group>)}
    <Box p={[0, 84, -2]} s={[97, 1.5, 31]} color="#a4a38e" />
    <mesh position={[28, 88, -2]}><cylinderGeometry args={[4, 4.4, 6, 12]} /><meshStandardMaterial color="#49677c" /></mesh>
    <Text position={[-35, 15, 13.2]} fontSize={2.7} color="#f3dfaa" anchorX="center">GELO</Text>
    <Text position={[35, 15, 13.2]} fontSize={2.1} color="#f3dfaa" anchorX="center">BEM-VINDO</Text>
  </group>
}

function ChristOnTheHorizon() {
  return <group position={[-290, FLOOR, -340]}>
    <mesh position-y={85}><coneGeometry args={[116, 180, 9]} /><meshStandardMaterial color="#66816a" roughness={1} flatShading /></mesh>
    <mesh position={[9, 64, 8]} scale={[1, 1.65, .8]}><dodecahedronGeometry args={[62, 0]} /><meshStandardMaterial color="#7b8778" roughness={1} flatShading /></mesh>
    <group position={[0, 173, 0]} rotation-y={.15}>
      <Box p={[0, 2, 0]} s={[10, 4, 8]} color="#bcbba5" />
      <mesh position-y={16}><cylinderGeometry args={[2.6, 4.1, 25, 6]} /><meshStandardMaterial color="#dfdfcd" roughness={.9} /></mesh>
      <Box p={[0, 27, 0]} s={[7, 6, 4]} color="#e6e4d1" />
      <mesh position={[0, 33, 0]}><sphereGeometry args={[2.6, 10, 8]} /><meshStandardMaterial color="#e6e4d1" roughness={.9} /></mesh>
      {[-1, 1].map(side => <group key={side}>
        <Box p={[side * 11, 27.5, 0]} s={[17, 3.6, 3.4]} color="#e6e4d1" />
        <Box p={[side * 20.5, 27.7, 0]} s={[3.2, 1.7, 2.2]} color="#e6e4d1" />
      </group>)}
    </group>
  </group>
}

export const RioBarEnvironment = memo(function RioBarEnvironment() {
  return <group>
    <mesh position={[0, FLOOR - .4, -120]} rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[1000, 1000]} /><meshStandardMaterial color="#aaab95" roughness={1} /></mesh>
    <Blocks blocks={paving} />
    <Box p={[0, FLOOR - .25, 91]} s={[250, .5, 34]} color="#6b7270" />
    <Box p={[0, FLOOR + .25, 73]} s={[250, .8, 1.4]} color="#d1c6ac" />
    <Bar />
    <mesh geometry={hillside} position={[0, 0, -280]}><meshStandardMaterial color="#8b9474" roughness={1} flatShading /></mesh>
    <Blocks blocks={houses} />
    {[-1, 1].map(side => <group key={side} position={[side * 114, FLOOR, 10]} rotation-y={side * -Math.PI / 2}>
      <Box p={[0, 35, 0]} s={[62, 70, 32]} color={side < 0 ? '#d7b146' : '#d27b83'} />
      <Box p={[0, 14, 16.2]} s={[43, 27, .5]} color="#446b72" />
      {Array.from({ length: 12 }, (_, i) => <Box key={i} p={[0, 2 + i * 2, 16.7]} s={[43, .25, .2]} color="#708e8c" />)}
      {[-17, 8].map(x => <group key={x}><Box p={[x, 48, 16.5]} s={[14, 19, .8]} color="#ddd0aa" /><Box p={[x, 48, 17]} s={[11, 16, .4]} color="#385659" /></group>)}
      <Box p={[0, 71, 0]} s={[65, 1.6, 35]} color="#a9a591" />
    </group>)}
    <Pole x={-67} z={-35} /><Pole x={76} z={48} />
    {[-5, -2, 2, 5].map((n, i) => <Wire key={n} points={[[-67 + n, FLOOR + 63, -35], [4, FLOOR + 51 - i, 7], [76 + n, FLOOR + 63, 48]]} thickness={.09} />)}
    <Wire points={[[-67, FLOOR + 51, -35], [0, FLOOR + 40, -49], [68, FLOOR + 46, -63], [120, FLOOR + 51, -35]]} thickness={.16} />
    <ChristOnTheHorizon />
  </group>
})
