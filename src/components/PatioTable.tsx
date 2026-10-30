import { memo } from 'react'
import { RoundedBox } from '@react-three/drei'
import { CatmullRomCurve3, Path, Shape, Vector3 } from 'three'

const PLASTIC = '#e7e9df'
const TOP = -.63

function Bottle({ position, green = false, cooler }: { position: [number, number, number]; green?: boolean; cooler?: string }) {
  const color = green ? '#355b27' : '#633218'
  return <group position={position} scale={[1.5, 1.65, 1.5]}>
    <mesh position-y={1.05} castShadow><cylinderGeometry args={[.39, .43, 2.1, 16]} /><meshStandardMaterial color={color} roughness={.22} metalness={.12} /></mesh>
    <mesh position-y={2.27} castShadow><cylinderGeometry args={[.16, .39, .36, 16]} /><meshStandardMaterial color={color} roughness={.22} /></mesh>
    <mesh position-y={2.75} castShadow><cylinderGeometry args={[.16, .16, .62, 16]} /><meshStandardMaterial color={color} roughness={.22} /></mesh>
    <mesh position-y={3.08}><cylinderGeometry args={[.19, .19, .12, 16]} /><meshStandardMaterial color="#c8a64d" metalness={.65} roughness={.3} /></mesh>
    <mesh position-y={1.12}><cylinderGeometry args={[.397, .418, .85, 16]} /><meshStandardMaterial color={green ? '#f0e5c6' : '#c7a33c'} roughness={.8} /></mesh>
    {cooler && <group>
      <mesh position-y={.96} castShadow><cylinderGeometry args={[.51, .49, 1.92, 24]} /><meshStandardMaterial color={cooler} roughness={.28} /></mesh>
      <mesh position-y={1.94} rotation-x={Math.PI / 2}><torusGeometry args={[.47, .065, 8, 24]} /><meshStandardMaterial color={cooler} roughness={.25} /></mesh>
      <mesh position-y={1.55}><cylinderGeometry args={[.515, .515, .035, 24]} /><meshStandardMaterial color="#292b28" roughness={.55} /></mesh>
    </group>}
    {!cooler && <mesh position={[0, 1.12, .421]}><planeGeometry args={[.4, .47]} /><meshStandardMaterial color="#9b3424" /></mesh>}
  </group>
}

function Drink({ position, kind }: { position: [number, number, number]; kind: 'beer' | 'lime' | 'shot' }) {
  const shot = kind === 'shot'
  const height = shot ? .63 : kind === 'beer' ? 1.55 : 1.05
  const radius = shot ? .26 : .46
  return <group position={position}>
    <mesh position-y={height / 2} castShadow renderOrder={2}><cylinderGeometry args={[radius, radius * .78, height, 20, 1, true]} /><meshStandardMaterial color="#d6e7dd" transparent opacity={.3} roughness={.12} depthWrite={false} side={2} /></mesh>
    <mesh position-y={.06}><cylinderGeometry args={[radius * .8, radius * .8, .12, 20]} /><meshStandardMaterial color="#b6cec4" roughness={.18} transparent opacity={.65} /></mesh>
    <mesh position-y={height * .39}><cylinderGeometry args={[radius * .9, radius * .75, height * .67, 20]} /><meshStandardMaterial color={kind === 'beer' ? '#d99a22' : kind === 'lime' ? '#d4d68b' : '#eee6c5'} transparent opacity={shot ? .5 : .9} roughness={.27} /></mesh>
    <mesh position-y={height} rotation-x={Math.PI / 2}><torusGeometry args={[radius, .025, 6, 20]} /><meshStandardMaterial color="#e8f2eb" roughness={.18} /></mesh>
    {kind === 'beer' && <mesh position-y={height * .77}><cylinderGeometry args={[radius * .92, radius * .91, .17, 20]} /><meshStandardMaterial color="#fff1cd" roughness={.95} /></mesh>}
    {kind === 'lime' && <>
      {[[.12, .67, .08], [-.16, .8, -.1], [.13, .9, -.17]].map((p, i) => <RoundedBox key={i} position={p as [number, number, number]} args={[.25, .25, .25]} radius={.035} rotation={[.2 * i, .5 * i, .3]}><meshStandardMaterial color="#f2fff0" transparent opacity={.65} roughness={.15} /></RoundedBox>)}
      <mesh position={[.37, 1.03, 0]} rotation={[Math.PI / 2, .3, 0]}><cylinderGeometry args={[.29, .29, .09, 16]} /><meshStandardMaterial color="#80a83a" /></mesh>
      <mesh position={[.37, 1.03, .05]} rotation-x={Math.PI / 2}><circleGeometry args={[.23, 16]} /><meshStandardMaterial color="#d4e18a" side={2} /></mesh>
    </>}
  </group>
}

// Open slats and curved arms keep the silhouette of molded patio chairs.
const chairBack = new Shape()
chairBack.moveTo(-3.7, 0)
chairBack.lineTo(-4.2, 6.4)
chairBack.quadraticCurveTo(-4.4, 8.2, 0, 8.4)
chairBack.quadraticCurveTo(4.4, 8.2, 4.2, 6.4)
chairBack.lineTo(3.7, 0)
chairBack.closePath()
for (const x of [-2.7, -1.35, 0, 1.35, 2.7]) {
  const slot = new Path()
  slot.moveTo(x - .28, 1.3)
  slot.lineTo(x - .35, 6.5)
  slot.quadraticCurveTo(x, 7.1, x + .35, 6.5)
  slot.lineTo(x + .28, 1.3)
  slot.quadraticCurveTo(x, .9, x - .28, 1.3)
  chairBack.holes.push(slot)
}
const chairArms = [-1, 1].map(side => new CatmullRomCurve3([
  new Vector3(side * 3.8, -1, -3.6),
  new Vector3(side * 4.3, -2.6, -1.4),
  new Vector3(side * 4.4, -2.8, 3.2),
  new Vector3(side * 4.1, -4.2, 3.8),
  new Vector3(side * 3.9, -6.4, 3.8),
]))

function PatioChair({ position, rotation, color }: { position: [number, number, number]; rotation: number; color: string }) {
  return <group position={position} rotation-y={rotation}>
    <RoundedBox position={[0, -6.6, 0]} args={[8.5, .65, 8.4]} radius={.3} smoothness={3} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.38} /></RoundedBox>
    <mesh position={[0, -6.5, -3.9]} rotation-x={-.1} castShadow receiveShadow><extrudeGeometry args={[chairBack, { depth: .45, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .15, bevelThickness: .12, curveSegments: 12 }]} /><meshStandardMaterial color={color} roughness={.38} /></mesh>
    {[-1, 1].flatMap(x => [-1, 1].map(z => <mesh key={`${x}:${z}`} position={[x * 3.7, -10.8, z * 3.4]} rotation={[z * .06, Math.PI / 4, -x * .06]} castShadow receiveShadow><cylinderGeometry args={[.65, .36, 8.5, 4]} /><meshStandardMaterial color={color} roughness={.42} /></mesh>))}
    {chairArms.map((curve, index) => <mesh key={index} castShadow><tubeGeometry args={[curve, 20, .35, 8, false]} /><meshStandardMaterial color={color} roughness={.35} /></mesh>)}
    {[-2.4, -1.2, 0, 1.2, 2.4].map(x => <mesh key={x} position={[x, -6.25, .2]}><boxGeometry args={[.045, .025, 5.4]} /><meshStandardMaterial color={color} roughness={.55} /></mesh>)}
  </group>
}

export const PatioTable = memo(function PatioTable() {
  return <group>
    <RoundedBox position={[0, TOP - .28, 0]} args={[30, .56, 30]} radius={.22} smoothness={3} castShadow receiveShadow><meshStandardMaterial color={PLASTIC} roughness={.48} /></RoundedBox>
    {[-1, 1].flatMap(x => [-1, 1].map(z => <group key={`${x}:${z}`}>
      <mesh position={[x * 13.7, -7.75, z * 13.7]} rotation-y={Math.PI / 4} castShadow receiveShadow><cylinderGeometry args={[1.1, .57, 14.5, 4]} /><meshStandardMaterial color={PLASTIC} roughness={.55} /></mesh>
      <RoundedBox position={[x * 14.4, TOP + .08, z * 14.4]} args={[1.2, .3, 1.2]} radius={.08} castShadow><meshStandardMaterial color={PLASTIC} roughness={.48} /></RoundedBox>
    </group>))}
    {[-1, 1].map(sign => <group key={sign}>
      <RoundedBox position={[0, -1.35, sign * 14.3]} args={[28.2, 1.2, .38]} radius={.1} castShadow><meshStandardMaterial color={PLASTIC} roughness={.55} /></RoundedBox>
      <RoundedBox position={[sign * 14.3, -1.35, 0]} args={[.38, 1.2, 28.2]} radius={.1} castShadow><meshStandardMaterial color={PLASTIC} roughness={.55} /></RoundedBox>
    </group>)}
    <Bottle position={[-12.5, TOP, 9.5]} cooler="#b82d21" />
    <Bottle position={[12.6, TOP, -9.7]} green cooler="#213c86" />
    <Bottle position={[-12.5, TOP, -8.8]} green cooler="#252827" />
    <Drink position={[-12.5, TOP, 11.4]} kind="beer" />
    <Drink position={[11.9, TOP, 11.7]} kind="lime" />
    <Drink position={[13.2, TOP, 10.6]} kind="shot" />
    <Drink position={[11.6, TOP, -12.1]} kind="beer" />
    <Drink position={[-11.5, TOP, -12.6]} kind="shot" />
    <PatioChair position={[-7.5, 0, 21]} rotation={Math.PI + .08} color="#c52e23" />
    <PatioChair position={[7.5, 0, 21.6]} rotation={Math.PI - .13} color="#edc436" />
    <PatioChair position={[21.5, 0, 0]} rotation={-Math.PI / 2 + .06} color={PLASTIC} />
    <PatioChair position={[7.5, 0, -21]} rotation={.1} color="#c52e23" />
    <PatioChair position={[-7.5, 0, -21.6]} rotation={-.08} color={PLASTIC} />
    <PatioChair position={[-21.5, 0, 0]} rotation={Math.PI / 2 - .1} color="#edc436" />
  </group>
})
