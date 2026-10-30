import { memo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { CHARACTERS } from '../game/content'
import type { CharacterId } from '../types'

export type CharacterAnimation = 'idle' | 'walk' | 'negotiate' | 'celebrate' | 'frustrated'
interface Props { characterId: CharacterId; active?: boolean; reducedMotion?: boolean; scale?: number; animation?: CharacterAnimation }

const skinColors: Record<CharacterId, string> = { jair: '#ddb083', michelle: '#edbd96', flavio: '#ddb087', eduardo: '#d9aa80', renan: '#cc936d' }
const hairColors: Record<CharacterId, string> = { jair: '#786a58', michelle: '#33201d', flavio: '#49372e', eduardo: '#3c2c25', renan: '#171819' }

function Cuboid({ position, size, color, rotation = [0, 0, 0], roughness = .7 }: { position: [number, number, number]; size: [number, number, number]; color: string; rotation?: [number, number, number]; roughness?: number }) {
  return <mesh castShadow position={position} rotation={rotation}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={roughness} /></mesh>
}

export const CharacterModel = memo(function CharacterModel({ characterId, active = false, reducedMotion = false, scale = 1, animation = 'idle' }: Props) {
  const root = useRef<Group>(null)
  const leftArm = useRef<Group>(null); const rightArm = useRef<Group>(null)
  const leftLeg = useRef<Group>(null); const rightLeg = useRef<Group>(null)
  const head = useRef<Group>(null)
  const character = CHARACTERS[characterId]
  const skin = skinColors[characterId]; const hair = hairColors[characterId]

  useFrame(({ clock }, delta) => {
    if (!root.current || reducedMotion) return
    const time = clock.elapsedTime
    const walking = animation === 'walk'
    const swing = walking ? Math.sin(time * 13.5) * .58 : 0
    if (leftArm.current && rightArm.current && leftLeg.current && rightLeg.current) {
      leftArm.current.rotation.x = MathUtilsDamp(leftArm.current.rotation.x, walking ? swing : animation === 'celebrate' ? -2.35 : animation === 'negotiate' ? -.55 : animation === 'frustrated' ? .18 : 0, delta)
      rightArm.current.rotation.x = MathUtilsDamp(rightArm.current.rotation.x, walking ? -swing : animation === 'celebrate' ? -2.35 : animation === 'negotiate' ? -1.15 : animation === 'frustrated' ? .18 : 0, delta)
      leftArm.current.rotation.z = animation === 'celebrate' ? -.24 : animation === 'frustrated' ? -.18 : 0
      rightArm.current.rotation.z = animation === 'celebrate' ? .24 : animation === 'frustrated' ? .18 : 0
      leftLeg.current.rotation.x = walking ? -swing * .58 : 0
      rightLeg.current.rotation.x = walking ? swing * .58 : 0
    }
    if (head.current) head.current.rotation.y = animation === 'negotiate' ? Math.sin(time * 2.4) * .18 : 0
    root.current.position.y = walking ? Math.abs(Math.sin(time * 13.5)) * .028 : 0
    root.current.rotation.z = animation === 'frustrated' ? Math.sin(time * 6.5) * .035 : 0
    root.current.rotation.y = MathUtilsDamp(root.current.rotation.y, animation === 'celebrate' ? Math.sin(time * 2.8) * .35 : 0, delta)
  })

  const faceWidth = characterId === 'jair' ? .58 : characterId === 'michelle' ? .55 : characterId === 'flavio' ? .6 : characterId === 'eduardo' ? .57 : .56
  const browAngle = characterId === 'eduardo' ? .12 : characterId === 'jair' ? -.06 : 0
  const suit = characterId === 'michelle' ? '#2d8a67' : characterId === 'renan' ? '#23282b' : character.color
  return <group ref={root} scale={scale * (active ? 1.04 : 1)}>
    {/* Articulated legs pivot at the hip. */}
    <group ref={leftLeg} position={[-.17, .69, 0]}>
      <Cuboid position={[0, -.27, 0]} size={[.21, .55, .25]} color={characterId === 'michelle' ? '#e6d4b6' : '#29383b'} />
      <Cuboid position={[0, -.58, .055]} size={[.24, .13, .38]} color="#202729" />
    </group>
    <group ref={rightLeg} position={[.17, .69, 0]}>
      <Cuboid position={[0, -.27, 0]} size={[.21, .55, .25]} color={characterId === 'michelle' ? '#e6d4b6' : '#29383b'} />
      <Cuboid position={[0, -.58, .055]} size={[.24, .13, .38]} color="#202729" />
    </group>
    {/* Torso with shirt, lapels and tie or sash. */}
    <Cuboid position={[0, .91, 0]} size={[.61, .67, .38]} color={suit} />
    <Cuboid position={[-.13, 1.04, .207]} size={[.21, .36, .018]} color="#f4efe2" rotation={[0, 0, -.32]} />
    <Cuboid position={[.13, 1.04, .207]} size={[.21, .36, .018]} color="#f4efe2" rotation={[0, 0, .32]} />
    {characterId === 'michelle'
      ? <><mesh position={[0, 1.08, .225]}><torusGeometry args={[.095, .016, 7, 18]} /><meshStandardMaterial color="#fff3cf" /></mesh><Cuboid position={[0, .86, .215]} size={[.4, .07, .025]} color="#f2d243" rotation={[0, 0, -.16]} /></>
      : <mesh position={[0, 1.02, .222]}><coneGeometry args={[.08, .36, 4]} /><meshStandardMaterial color={character.accent} /></mesh>}
    {characterId === 'jair' && <Cuboid position={[0, .87, .214]} size={[.47, .09, .018]} color="#f1d13d" rotation={[0, 0, -.12]} />}
    {/* Arms pivot at the shoulders; hands remain separate. */}
    <group ref={leftArm} position={[-.42, 1.16, 0]}><Cuboid position={[0, -.28, 0]} size={[.18, .56, .21]} color={suit} /><Cuboid position={[0, -.595, .02]} size={[.18, .15, .19]} color={skin} /></group>
    <group ref={rightArm} position={[.42, 1.16, 0]}><Cuboid position={[0, -.28, 0]} size={[.18, .56, .21]} color={suit} /><Cuboid position={[0, -.595, .02]} size={[.18, .15, .19]} color={skin} /></group>
    {/* Neck and caricatured head. */}
    <Cuboid position={[0, 1.39, 0]} size={[.2, .2, .2]} color={skin} />
    <group ref={head} position={[0, 1.68, 0]}>
      <Cuboid position={[0, 0, 0]} size={[faceWidth, .55, .52]} color={skin} roughness={.76} />
      {/* Ears, nose, eyes and eyebrows define the facial silhouette. */}
      <Cuboid position={[-faceWidth / 2 - .035, -.01, 0]} size={[.08, .17, .12]} color={skin} />
      <Cuboid position={[faceWidth / 2 + .035, -.01, 0]} size={[.08, .17, .12]} color={skin} />
      <Cuboid position={[0, -.03, .292]} size={[characterId === 'jair' ? .11 : .09, .16, .1]} color={skin} />
      <Cuboid position={[-.14, .055, .282]} size={[.07, .075, .035]} color="#172729" />
      <Cuboid position={[.14, .055, .282]} size={[.07, .075, .035]} color="#172729" />
      <Cuboid position={[-.14, .15, .293]} size={[.19, .035, .025]} color={hair} rotation={[0, 0, browAngle]} />
      <Cuboid position={[.14, .15, .293]} size={[.19, .035, .025]} color={hair} rotation={[0, 0, -browAngle]} />
      <Cuboid position={[0, -.18, .292]} size={[animation === 'frustrated' ? .18 : .23, .045, .025]} color={animation === 'celebrate' ? '#f8eee0' : '#813d34'} />
      {characterId === 'flavio' && <Cuboid position={[0, -.25, .286]} size={[.34, .08, .035]} color="#4a3329" />}
      {/* Character-specific hair. */}
      {characterId === 'michelle' ? <>
        <Cuboid position={[0, .3, -.02]} size={[.62, .18, .56]} color={hair} rotation={[0, 0, -.03]} />
        <Cuboid position={[-.29, .02, -.12]} size={[.13, .56, .34]} color={hair} /><Cuboid position={[.29, .02, -.12]} size={[.13, .56, .34]} color={hair} />
      </> : characterId === 'jair' ? <>
        <Cuboid position={[-.08, .32, -.02]} size={[.54, .16, .56]} color={hair} rotation={[0, 0, -.1]} />
        <Cuboid position={[.18, .38, .01]} size={[.34, .1, .55]} color={hair} rotation={[0, 0, -.2]} />
      </> : characterId === 'renan' ? <>
        <Cuboid position={[0, .33, -.01]} size={[.65, .13, .58]} color={hair} rotation={[0, 0, -.08]} />
        <Cuboid position={[-.2, .4, 0]} size={[.28, .12, .55]} color={hair} rotation={[0, 0, .18]} />
      </> : <>
        <Cuboid position={[0, .31, -.02]} size={[.6, characterId === 'eduardo' ? .13 : .18, .56]} color={hair} />
        {characterId === 'eduardo' && <Cuboid position={[-.22, .37, 0]} size={[.22, .1, .55]} color={hair} rotation={[0, 0, .16]} />}
      </>}
    </group>
  </group>
})

function MathUtilsDamp(current: number, target: number, delta: number) {
  return current + (target - current) * (1 - Math.exp(-delta * 12))
}
