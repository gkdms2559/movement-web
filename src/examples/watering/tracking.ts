export type TrackingResult = {
  hands: { x: number; y: number; z?: number }[][]
  labels: string[]
  face: { x: number; y: number; z?: number }[]
  mask?: { data: Float32Array; width: number; height: number }
  timestamp?: number
}

type TrackingOptions = {
  face: boolean
  segmentation: boolean
  needsSegmentation?: () => boolean
  inputWidth?: number
  maxHands?: number
  frameIntervalMs?: number
  minHandDetectionConfidence?: number
  minHandPresenceConfidence?: number
  minTrackingConfidence?: number
}

export function createTracking(video: HTMLVideoElement, options: TrackingOptions, onResult: (result: TrackingResult) => void, onError: (error: unknown) => void) {
  // Classic worker supports the WASM loader's importScripts; no model work on UI thread.
  const worker = new Worker(new URL('./tracking.worker.ts', import.meta.url))
  let stopped = false, ready = false, busy = false, frame = 0, lastTime = -1, lastSent = -Infinity
  const fail = (error: unknown) => { if (stopped) return; stop(); onError(error) }
  worker.onerror = event => fail(new Error(`${event.message} (${event.filename}:${event.lineno})`))
  worker.onmessage = event => {
    if (stopped) return
    if (event.data.type === 'ready') { ready = true; schedule() }
    else if (event.data.type === 'result') { busy = false; onResult(event.data); schedule() }
    else if (event.data.type === 'warning') console.warn(`Watering ${event.data.feature} tracking:`, event.data.message)
    else if (event.data.type === 'error') fail(new Error(event.data.message))
  }
  function schedule() {
    if (!stopped && ready && !busy && !document.hidden && !frame) frame = requestAnimationFrame(tick)
  }
  function visibilityChanged() {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0 }
    else schedule()
  }
  async function tick(timestamp: number) {
    frame = 0
    if (stopped) return
    const frameIntervalMs = options.frameIntervalMs ?? 33
    if (document.hidden || !ready || busy || video.readyState < 2 || video.currentTime === lastTime || timestamp - lastSent < frameIntervalMs) { schedule(); return }
    busy = true; lastTime = video.currentTime; lastSent = timestamp
    try {
      const inputWidth = options.inputWidth ?? 640
      const bitmap = await createImageBitmap(video, { resizeWidth: inputWidth, resizeHeight: Math.max(1, Math.round(inputWidth * video.videoHeight / video.videoWidth)) })
      if (stopped) { bitmap.close(); return }
      worker.postMessage({ type: 'frame', bitmap, timestamp, segmentation: options.segmentation && (options.needsSegmentation?.() ?? true) }, [bitmap])
    } catch (error) { fail(error) }
  }
  function stop() { stopped = true; cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visibilityChanged); worker.terminate() }
  worker.postMessage({
    type: 'init',
    face: options.face,
    segmentation: options.segmentation,
    baseUrl: import.meta.env.BASE_URL,
    numHands: options.maxHands,
    minHandDetectionConfidence: options.minHandDetectionConfidence,
    minHandPresenceConfidence: options.minHandPresenceConfidence,
    minTrackingConfidence: options.minTrackingConfidence,
  })
  document.addEventListener('visibilitychange', visibilityChanged)
  return { stop }
}
