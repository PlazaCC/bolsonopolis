import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Quaternion } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

const tipsyShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, strength: { value: 0 }, motion: { value: 1 } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float strength;
    uniform float motion;
    varying vec2 vUv;
    void main() {
      vec2 p = vUv - 0.5;
      float radius = dot(p, p);
      vec2 wave = vec2(sin(p.y * 9.0 + time * 1.3), cos(p.x * 8.0 + time * 0.9));
      vec2 uv = 0.5 + p * (0.97 + radius * 0.035 * strength);
      uv += wave * 0.006 * strength * motion;
      vec2 split = vec2(0.0035 + radius * 0.007, 0.001) * strength;
      vec3 color;
      color.r = texture2D(tDiffuse, clamp(uv + split, 0.001, 0.999)).r;
      color.g = texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).g;
      color.b = texture2D(tDiffuse, clamp(uv - split, 0.001, 0.999)).b;
      vec3 ghost = texture2D(tDiffuse, clamp(uv + vec2(0.012, 0.003) * strength, 0.001, 0.999)).rgb;
      color = mix(color, ghost, 0.12 * strength);
      color *= 1.0 - smoothstep(0.12, 0.5, radius) * 0.23 * strength;
      color *= mix(vec3(1.0), vec3(1.035, 1.01, 0.96), strength);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
}

/** Local visual effect; camera pose is restored before controls and picking run. */
export function TipsyEffect({ reducedMotion }: { reducedMotion: boolean }) {
  const { gl, scene, camera } = useThree()
  const pipeline = useRef<{ composer: EffectComposer; effect: ShaderPass } | null>(null)
  const originalRotation = useRef(new Quaternion())
  const elapsed = useRef(0)
  const dimensions = useRef('')

  useEffect(() => {
    const composer = new EffectComposer(gl)
    composer.renderTarget1.samples = Math.min(4, gl.capabilities.maxSamples)
    composer.renderTarget2.samples = Math.min(4, gl.capabilities.maxSamples)
    const render = new RenderPass(scene, camera)
    const effect = new ShaderPass(tipsyShader)
    const output = new OutputPass()
    composer.addPass(render)
    composer.addPass(effect)
    composer.addPass(output)
    pipeline.current = { composer, effect }
    dimensions.current = ''
    elapsed.current = 0
    return () => {
      pipeline.current = null
      render.dispose()
      effect.dispose()
      output.dispose()
      composer.dispose()
    }
  }, [gl, scene, camera])

  useFrame(({ size, viewport }, delta) => {
    const current = pipeline.current
    if (!current) { gl.render(scene, camera); return }
    const dimensionKey = `${size.width}:${size.height}:${viewport.dpr}`
    if (dimensions.current !== dimensionKey) {
      current.composer.setPixelRatio(viewport.dpr)
      current.composer.setSize(size.width, size.height)
      dimensions.current = dimensionKey
    }
    elapsed.current += Math.min(delta, .1)
    const time = elapsed.current
    const strength = MathUtils.smoothstep(time, 0, 1.2)
    current.effect.uniforms.time.value = time
    current.effect.uniforms.strength.value = strength
    current.effect.uniforms.motion.value = reducedMotion ? 0 : 1
    originalRotation.current.copy(camera.quaternion)
    if (!reducedMotion) {
      camera.rotateZ(Math.sin(time * .85) * .028 * strength)
      camera.rotateX(Math.sin(time * 1.1) * .009 * strength)
      camera.rotateY(Math.cos(time * .7) * .012 * strength)
    }
    try { current.composer.render(delta) }
    finally { camera.quaternion.copy(originalRotation.current); camera.updateMatrixWorld() }
  }, 1)

  return null
}
