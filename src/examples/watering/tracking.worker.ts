(() => {
let hands: any, face: any, segmenter: any
let loading: Promise<void> | undefined
let busy = false
let lastMask = -Infinity
async function initialize(options: { face: boolean; segmentation: boolean; baseUrl: string; numHands?: number; minHandDetectionConfidence?: number; minHandPresenceConfidence?: number; minTrackingConfidence?: number }) {
  const baseUrl = options.baseUrl
  const dynamicImport = new Function('url', 'return import(url)') as (url: string) => Promise<any>
  const vision = await dynamicImport(`${baseUrl}tracking/vision_bundle.mjs`)
  const fileset = await vision.FilesetResolver.forVisionTasks(`${baseUrl}tracking`)
  async function create(Task: any, model: string, settings: object) {
    const canvas = typeof OffscreenCanvas === 'undefined' ? {} : { canvas: new OffscreenCanvas(1, 1) }
    const options = { ...settings, ...canvas, runningMode: 'VIDEO' }
    // CPU inference stays in this worker and avoids first-run GPU shader compilation
    // competing with camera compositing on the graphics thread.
    return await Task.createFromOptions(fileset, { ...options, baseOptions: { modelAssetPath: model, delegate: 'CPU' } })
  }
  hands = await create(vision.HandLandmarker, `${baseUrl}tracking/hand_landmarker.task`, {
    numHands: options.numHands ?? 2,
    minHandDetectionConfidence: options.minHandDetectionConfidence ?? .65,
    minHandPresenceConfidence: options.minHandPresenceConfidence ?? .55,
    minTrackingConfidence: options.minTrackingConfidence ?? .6,
  })

  // Hand tracking is the essential interaction. Load the heavier optional
  // models afterwards so a face/segmentation problem cannot disable hands.
  void (async () => {
    if (options.face) {
      try {
        face = await create(vision.FaceLandmarker, `${baseUrl}tracking/face_landmarker.task`, { numFaces: 1, minFaceDetectionConfidence: .6, minTrackingConfidence: .6 })
      } catch (error) {
        ;(self as any).postMessage({ type: 'warning', feature: 'face', message: String(error) })
      }
    }
    if (options.segmentation) {
      try {
        segmenter = await create(vision.ImageSegmenter, `${baseUrl}tracking/selfie_segmenter.tflite`, { outputCategoryMask: false, outputConfidenceMasks: true })
      } catch (error) {
        ;(self as any).postMessage({ type: 'warning', feature: 'segmentation', message: String(error) })
      }
    }
  })()
}
self.onmessage = async (event: MessageEvent) => {
  const data = event.data
  if (data.type === 'init') {
    if (loading) return
    loading = initialize(data)
    try { await loading; (self as any).postMessage({ type: 'ready' }) }
    catch (error) { (self as any).postMessage({ type: 'error', message: String(error) }) }
    return
  }
  if (data.type !== 'frame' || busy || !hands) { data.bitmap?.close(); return }
  busy = true
  try {
    const handResult = hands.detectForVideo(data.bitmap, data.timestamp)
    const faceResult = face?.detectForVideo(data.bitmap, data.timestamp)
    let mask: { data: Float32Array; width: number; height: number } | undefined
    if (segmenter && data.segmentation && data.timestamp - lastMask >= 120) {
      // Copy before closing the WASM-owned result, then transfer the buffer.
      const result = segmenter.segmentForVideo(data.bitmap, data.timestamp)
      try {
        const confidence = result.confidenceMasks?.[0]
        if (confidence) mask = { data: confidence.getAsFloat32Array().slice(), width: confidence.width, height: confidence.height }
      } finally { result.close() }
      lastMask = data.timestamp
    }
    ;(self as any).postMessage({ type: 'result', hands: handResult.landmarks, labels: (handResult.handedness || handResult.handednesses || []).map((items: any[]) => items[0]?.categoryName || 'Unknown'), face: faceResult?.faceLandmarks?.[0] || [], mask, timestamp: data.timestamp }, mask ? [mask.data.buffer] : [])
  } catch (error) { (self as any).postMessage({ type: 'error', message: String(error) }) }
  finally { data.bitmap.close(); busy = false }
}

})()
