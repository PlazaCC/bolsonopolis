let context: AudioContext | undefined

export function playSound(kind: 'click' | 'roll' | 'good' | 'bad' | 'money-in' | 'money-out' | 'turn-mine' | 'turn-other' | 'luck' | 'setback' | 'card-pick', enabled = true) {
  if (!enabled) return
  try { context ??= new AudioContext() } catch { return }
  if (context.state === 'suspended') void context.resume().catch(() => {})
  const now = context.currentTime
  const notes = kind === 'turn-mine' ? [523, 659, 784, 1047] : kind === 'turn-other' ? [330, 392] : kind === 'luck' ? [659, 880, 1047, 1320] : kind === 'setback' ? [294, 247, 175] : kind === 'card-pick' ? [440, 660] : kind === 'money-in' ? [660, 880, 1320] : kind === 'money-out' ? [440, 330, 220] : kind === 'roll' ? [180, 240, 320, 420] : kind === 'good' ? [392, 523, 659] : kind === 'bad' ? [180, 145] : [300]
  notes.forEach((frequency, index) => {
    const oscillator = context!.createOscillator()
    const gain = context!.createGain()
    oscillator.type = kind === 'bad' ? 'sawtooth' : 'triangle'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0, now + index * 0.055)
    gain.gain.linearRampToValueAtTime(0.055, now + index * 0.055 + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.055 + 0.12)
    oscillator.connect(gain).connect(context!.destination)
    oscillator.start(now + index * 0.055)
    oscillator.stop(now + index * 0.055 + 0.14)
  })
}
