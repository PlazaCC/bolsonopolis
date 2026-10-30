import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import type { CharacterId } from '../types'
import { CharacterModel } from './CharacterModel'
import { readCharacterPortrait, storeCharacterPortrait } from './characterPortraitCache'

const IDS: CharacterId[] = ['jair', 'michelle', 'flavio', 'eduardo', 'renan']
function Capture({ id, onCapture }: { id: CharacterId; onCapture: (image: string) => void }) {
  const { gl, camera, scene } = useThree()
  const frames = useRef(0)
  const captured = useRef(false)
  useEffect(() => {
    gl.setClearColor(0x000000, 0)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [gl, camera, id])
  useFrame(() => {
    if (captured.current) return
    frames.current += 1
    if (frames.current < 4) return
    captured.current = true
    gl.render(scene, camera)
    onCapture(gl.domElement.toDataURL('image/png'))
  })
  return <>
    <ambientLight intensity={1.35} />
    <hemisphereLight intensity={1.8} color="#fff7e7" groundColor="#65807b" />
    <directionalLight position={[3.5, 5.5, 5]} intensity={2.25} color="#fff1d2" />
    <directionalLight position={[-4, 2, 2]} intensity={.8} color="#b9dce2" />
    <group position={[0, -1.34, 0]}>
      <CharacterModel characterId={id} reducedMotion animation="idle" />
    </group>
  </>
}

/**
 * One transient scene generates all five portraits. The Canvas is unmounted
 * after capture; every subsequent use reads a transparent cached image.
 */
export function CharacterPortraitRenderer() {
  const [pending] = useState(() => IDS.filter(id => !readCharacterPortrait(id)))
  const [index, setIndex] = useState(0)
  const id = pending[index]
  if (!id) return null
  return <div aria-hidden="true" style={{ position: 'fixed', width: 192, height: 216, left: '-300px', top: 0, pointerEvents: 'none', opacity: 0, zIndex: -1 }}>
    <Canvas key={id} orthographic dpr={2} camera={{ position: [3.1, 1.35, 6], zoom: 165, near: .1, far: 20 }} gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}>
      <Capture id={id} onCapture={image => { storeCharacterPortrait(id, image); setIndex(value => value + 1) }} />
    </Canvas>
  </div>
}
