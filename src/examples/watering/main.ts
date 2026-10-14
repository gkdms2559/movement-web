import './style.css'
import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  getFirstEncodableVideoCodec,
} from 'mediabunny'
import { createTracking, type TrackingResult } from './tracking'
import { createWatering } from './watering'

type Point = { x: number; y: number; z?: number }
type TrackedHand = { points: Point[]; label: string; pinching: boolean }

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main class="watering-scene">
    <video id="camera" autoplay playsinline muted aria-label="카메라 영상"></video>
    <canvas id="stage" aria-label="손으로 물을 주는 인터랙티브 정원"></canvas>
    <a class="corner-control back-link" href="../" aria-label="Go back">← BACK</a>
    <section class="start-screen" id="startScreen" aria-label="Watering Garden 시작 화면">
      <img src="${import.meta.env.BASE_URL}watering-start-blue-purple-grid-v4.png" alt="" aria-hidden="true" />
    </section>
    <button class="corner-control camera-button" id="startCamera" type="button">CAMERA ON</button>
    <button class="record-button" id="recordButton" type="button" aria-label="녹화 시작" hidden>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7.5h3l1.3-2h7.4l1.3 2h3a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
      <span class="record-dot"></span>
    </button>
    <p class="counter" id="counter" hidden>FLOWERS / 00</p>
    <p class="usage-guide" id="usageGuide" hidden>엄지와 검지를 붙여 물뿌리개를 잡고 기울여보세요 · 머리 위에 물을 주고 새싹을 틔운 후 입을 벌려 꽃을 피워보세요</p>
    <p class="sr-only" id="status" role="status" aria-live="polite">카메라를 켜면 예제가 시작됩니다.</p>
  </main>
`

const scene = document.querySelector<HTMLElement>('.watering-scene')!
const video = document.querySelector<HTMLVideoElement>('#camera')!
const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const context = canvas.getContext('2d')!
const startScreen = document.querySelector<HTMLElement>('#startScreen')!
const startButton = document.querySelector<HTMLButtonElement>('#startCamera')!
const recordButton = document.querySelector<HTMLButtonElement>('#recordButton')!
const usageGuide = document.querySelector<HTMLParagraphElement>('#usageGuide')!
const status = document.querySelector<HTMLParagraphElement>('#status')!
const counter = document.querySelector<HTMLParagraphElement>('#counter')!
const watering = createWatering()
const recordingCanvas = document.createElement('canvas')
const recordingContext = recordingCanvas.getContext('2d', { alpha: false })!

let tracker: ReturnType<typeof createTracking> | undefined
let cameraStream: MediaStream | undefined
let face: Point[] = []
let hands: TrackedHand[] = []
let stageWidth = innerWidth
let stageHeight = innerHeight
let animationFrame = 0
let recordingOutput: Output | undefined
let recordingTarget: BufferTarget | undefined
let recordingSource: CanvasSource | undefined
let recordingFramePending: Promise<void> | undefined
let recordingStartedAt = 0
let nextRecordingFrame = 0
let isRecording = false

const RECORDING_FRAME_RATE = 30

function projectToScreen(points: Point[]): Point[] {
  const videoWidth = video.videoWidth || stageWidth
  const videoHeight = video.videoHeight || stageHeight
  const scale = Math.max(stageWidth / videoWidth, stageHeight / videoHeight)
  const renderedWidth = videoWidth * scale
  const renderedHeight = videoHeight * scale
  const offsetX = (stageWidth - renderedWidth) / 2
  const offsetY = (stageHeight - renderedHeight) / 2

  return points.map(point => ({
    ...point,
    x: (offsetX + (1 - point.x) * renderedWidth) / stageWidth,
    y: (offsetY + point.y * renderedHeight) / stageHeight,
  }))
}

function isPinching(points: Point[]): boolean {
  if (points.length < 9) return false
  return Math.hypot(points[4].x - points[8].x, points[4].y - points[8].y) < .09
}

function resize(): void {
  const dpr = Math.min(devicePixelRatio || 1, 2)
  stageWidth = innerWidth
  stageHeight = innerHeight
  canvas.width = Math.max(2, Math.round(stageWidth * dpr / 2) * 2)
  canvas.height = Math.max(2, Math.round(stageHeight * dpr / 2) * 2)
  context.setTransform(canvas.width / stageWidth, 0, 0, canvas.height / stageHeight, 0, 0)
}

function handleTracking(result: TrackingResult): void {
  face = projectToScreen(result.face)
  hands = result.hands.map((points, index) => {
    const projected = projectToScreen(points)
    return {
      points: projected,
      label: result.labels[index] ?? `Hand ${index + 1}`,
      pinching: isPinching(points),
    }
  })
  if (result.mask) watering.setPersonMask(result.mask)

  const pinching = hands.filter(hand => hand.pinching).length
  status.textContent = hands.length
    ? pinching ? '물뿌리개를 기울여 물을 주세요.' : `${hands.length}개의 손 인식 중 · 엄지와 검지를 붙여보세요.`
    : '손을 카메라 안으로 보여주세요.'
}

function drawCameraFrame(): void {
  if (!cameraStream || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
  const videoWidth = video.videoWidth || stageWidth
  const videoHeight = video.videoHeight || stageHeight
  const scale = Math.max(stageWidth / videoWidth, stageHeight / videoHeight)
  const width = videoWidth * scale
  const height = videoHeight * scale
  const x = (stageWidth - width) / 2
  const y = (stageHeight - height) / 2

  context.save()
  context.translate(stageWidth, 0)
  context.scale(-1, 1)
  context.globalAlpha = .82
  context.filter = 'saturate(.82) contrast(.94) brightness(1.08)'
  context.drawImage(video, x, y, width, height)
  context.restore()
}

function captureRecordingFrame(now: number): void {
  if (!isRecording || !recordingSource || recordingFramePending) return
  const elapsed = (now - recordingStartedAt) / 1000
  if (elapsed + .001 < nextRecordingFrame) return

  recordingContext.drawImage(canvas, 0, 0, recordingCanvas.width, recordingCanvas.height)
  const timestamp = nextRecordingFrame
  nextRecordingFrame += 1 / RECORDING_FRAME_RATE
  recordingFramePending = recordingSource
    .add(timestamp, 1 / RECORDING_FRAME_RATE)
    .catch(error => {
      console.error(error)
      status.textContent = 'MP4 녹화 중 오류가 발생했습니다.'
      status.classList.add('is-error')
    })
    .finally(() => { recordingFramePending = undefined })
}

function render(now: number): void {
  context.clearRect(0, 0, stageWidth, stageHeight)
  drawCameraFrame()
  watering.render(context, stageWidth, stageHeight, now, face, hands)
  counter.textContent = `FLOWERS / ${String(watering.sproutCount).padStart(2, '0')}`
  captureRecordingFrame(now)
  animationFrame = requestAnimationFrame(render)
}

function prepareRecordingCanvas(): void {
  const maxEdge = 1280
  const scale = Math.min(1, maxEdge / Math.max(canvas.width, canvas.height))
  recordingCanvas.width = Math.max(2, Math.round(canvas.width * scale / 2) * 2)
  recordingCanvas.height = Math.max(2, Math.round(canvas.height * scale / 2) * 2)
  recordingContext.fillStyle = '#000'
  recordingContext.fillRect(0, 0, recordingCanvas.width, recordingCanvas.height)
}

function recordingFileName(): string {
  const now = new Date()
  const two = (value: number) => String(value).padStart(2, '0')
  return `watering-garden-${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}.mp4`
}

function downloadRecording(buffer: ArrayBuffer): void {
  const url = URL.createObjectURL(new Blob([buffer], { type: 'video/mp4' }))
  const link = document.createElement('a')
  link.href = url
  link.download = recordingFileName()
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function startRecording(): Promise<void> {
  if (isRecording || !cameraStream) return
  recordButton.disabled = true
  status.classList.remove('is-error')
  status.textContent = 'MP4 녹화를 준비하고 있습니다.'

  try {
    prepareRecordingCanvas()
    const format = new Mp4OutputFormat({ fastStart: 'in-memory' })
    const quality = new Quality({ bitrate: 5_000_000 })
    const codec = await getFirstEncodableVideoCodec(['avc'], {
      width: recordingCanvas.width,
      height: recordingCanvas.height,
      quality,
    })
    if (!codec) throw new Error('AVC/H.264 encoding is not supported')

    recordingTarget = new BufferTarget()
    recordingOutput = new Output({ format, target: recordingTarget })
    recordingSource = new CanvasSource(recordingCanvas, {
      codec,
      quality,
      keyFrameInterval: 2,
    })
    recordingOutput.addVideoTrack(recordingSource, { frameRate: RECORDING_FRAME_RATE })
    await recordingOutput.start()

    isRecording = true
    recordingStartedAt = performance.now()
    nextRecordingFrame = 0
    recordButton.disabled = false
    recordButton.classList.add('is-recording')
    recordButton.setAttribute('aria-label', '녹화 중지 및 MP4 저장')
    usageGuide.textContent = '녹화 중 · 카메라 버튼을 다시 누르면 MP4 파일로 자동 저장됩니다'
    status.textContent = '녹화 중입니다.'
  } catch (error) {
    console.error(error)
    recordingOutput = undefined
    recordingTarget = undefined
    recordingSource = undefined
    recordButton.disabled = false
    status.textContent = '이 브라우저에서는 MP4 녹화를 시작할 수 없습니다.'
    status.classList.add('is-error')
  }
}

async function stopRecording(save = true): Promise<void> {
  if (!recordingOutput) return
  isRecording = false
  recordButton.disabled = true
  recordButton.classList.remove('is-recording')
  recordButton.setAttribute('aria-label', '녹화 시작')
  usageGuide.textContent = 'MP4 파일을 저장하고 있습니다…'

  try {
    await recordingFramePending
    if (save) {
      await recordingOutput.finalize()
      if (!recordingTarget?.buffer) throw new Error('Recording buffer was empty')
      downloadRecording(recordingTarget.buffer)
      status.textContent = 'MP4 녹화 파일을 저장했습니다.'
    } else {
      await recordingOutput.cancel()
    }
  } catch (error) {
    console.error(error)
    status.textContent = 'MP4 파일을 저장하지 못했습니다.'
    status.classList.add('is-error')
  } finally {
    recordingOutput = undefined
    recordingTarget = undefined
    recordingSource = undefined
    recordingFramePending = undefined
    recordButton.disabled = false
    usageGuide.textContent = '엄지와 검지를 붙여 물뿌리개를 잡고 기울여보세요 · 머리 위에 물을 주고 새싹을 틔운 후 입을 벌려 꽃을 피워보세요'
  }
}

async function startCamera(): Promise<void> {
  startButton.disabled = true
  startButton.setAttribute('aria-label', 'Camera is starting')
  startButton.classList.add('is-loading')
  status.classList.remove('is-error')

  try {
    if (!cameraStream) {
      status.textContent = '카메라 권한을 확인하고 있습니다.'
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      video.srcObject = cameraStream
      await video.play()
      video.classList.add('is-active')
    }

    status.textContent = '손 추적 모델을 준비하고 있습니다.'
    tracker?.stop()
    tracker = createTracking(
      video,
      { face: true, segmentation: true, needsSegmentation: () => watering.needsPersonMask },
      handleTracking,
      error => {
        console.error(error)
        tracker = undefined
        const detail = error instanceof Error ? error.message : String(error)
        status.textContent = `손 추적 초기화 실패: ${detail}`
        status.classList.add('is-error')
        startButton.hidden = false
        startButton.disabled = false
        startButton.classList.remove('is-loading')
        startButton.setAttribute('aria-label', 'Restart camera tracking')
      },
    )
    startButton.hidden = true
    startButton.classList.remove('is-loading')
    startScreen.classList.add('is-hidden')
    startScreen.setAttribute('aria-hidden', 'true')
    scene.classList.add('is-running')
    recordButton.hidden = false
    counter.hidden = false
    usageGuide.hidden = false
    status.textContent = '손을 카메라 안으로 보여주세요.'
  } catch (error) {
    console.error(error)
    startButton.disabled = false
    startButton.classList.remove('is-loading')
    startButton.setAttribute('aria-label', 'Camera permission required. Try again')
    status.textContent = '카메라 권한이 필요합니다. HTTPS 또는 localhost에서 열어주세요.'
    status.classList.add('is-error')
  }
}

function stop(): void {
  cancelAnimationFrame(animationFrame)
  tracker?.stop()
  cameraStream?.getTracks().forEach(track => track.stop())
  if (recordingOutput) void stopRecording(false)
}

addEventListener('resize', resize)
addEventListener('pagehide', stop, { once: true })
startButton.addEventListener('click', () => void startCamera())
recordButton.addEventListener('click', () => {
  if (isRecording) void stopRecording()
  else void startRecording()
})
resize()
animationFrame = requestAnimationFrame(render)
