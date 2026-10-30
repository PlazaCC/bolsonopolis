let context: AudioContext | undefined

export function playSound(kind: 'click' | 'roll' | 'good' | 'bad', enabled = true) {
  if (!enabled) return
  context ??= new AudioContext()
  const now = context.currentTime
  const notes = kind === 'roll' ? [180, 240, 320, 420] : kind === 'good' ? [392, 523, 659] : kind === 'bad' ? [180, 145] : [300]
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
