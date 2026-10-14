import './style.css'
import { createTracking, type TrackingResult } from '../watering/tracking'

type Point = { x: number; y: number; z?: number }

type Word = {
  text: string
  x: number
  y: number
  size: number
  born: number
  rotation: number
}

type HandState = {
  x: number
  y: number
  lastMove: number
  lastSpawn: number
  pinching: boolean
  dragging?: Word
}

const PAUSE_MS = 300
const SPAWN_GAP_MS = 850
const MOVEMENT_THRESHOLD_PX = 7
const PINCH_THRESHOLD = .065
const MAX_WORDS = 100
const defaultWords = [
  'LOVE', 'HEART', 'KISS', 'TRUST', 'DESIRE', 'TOGETHER', 'FOREVER', 'TENDER',
  'DEVOTION', 'ROMANCE', 'DARLING', 'PASSION', 'HUG', 'CARE', 'BELOVED', 'SOULMATE',
  'ADMIRE', 'CHERISH', 'INTIMACY', 'WARMTH', 'PROMISE', 'SWEETHEART', 'YOURS',
  'MINE', 'US', 'ALWAYS',
]

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main class="words-scene">
    <video id="camera" autoplay playsinline muted aria-label="실시간 카메라 영상"></video>
    <canvas id="stage" aria-label="손을 멈춰 단어를 남기는 인터랙티브 화면"></canvas>
    <section class="start-screen" id="startScreen" aria-label="Words in Motion 시작 화면">
      <div class="word-cloud" aria-hidden="true">
        <span>LOVE</span><span>TRUST</span><span>DREAM</span><span>WORDS</span><span>MOTION</span><span>US</span><span>ALWAYS</span>
      </div>
    </section>

    <a class="corner-control back-link" href="../" aria-label="Go back">← BACK</a>
    <button class="corner-control camera-button" id="startCamera" type="button">CAMERA ON</button>

    <header class="mode-label" aria-hidden="true">
      <strong>WORDS IN MOTION</strong>
      <span id="visualStatus">CAMERA OFFLINE</span>
    </header>

    <div class="interaction-controls">
      <button class="reset-button" id="resetWords" type="button" aria-label="모든 단어 지우기">RESET</button>
      <button class="capture-button photo-button" id="photoCapture" type="button" aria-label="사진 저장">
        <span class="camera-icon" aria-hidden="true"></span>
      </button>
      <button class="capture-button video-button" id="videoCapture" type="button" aria-label="영상 녹화 시작">
        <span aria-hidden="true"></span>
      </button>
    </div>

    <div class="sentence-form">
      <label for="sentenceInput">화면에 띄울 문장</label>
      <textarea id="sentenceInput" rows="2" spellcheck="false" placeholder="영어 또는 한국어 문장을 입력하세요"></textarea>
      <small>영어·한국어와 문장부호를 입력할 수 있습니다</small>
    </div>

    <p class="sr-only" id="status" role="status" aria-live="polite">카메라를 켜면 예제가 시작됩니다.</p>
  </main>
`

const scene = document.querySelector<HTMLElement>('.words-scene')!
const video = document.querySelector<HTMLVideoElement>('#camera')!
const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const context = canvas.getContext('2d')!
const startScreen = document.querySelector<HTMLElement>('#startScreen')!
const startButton = document.querySelector<HTMLButtonElement>('#startCamera')!
const sentenceInput = document.querySelector<HTMLTextAreaElement>('#sentenceInput')!
const resetButton = document.querySelector<HTMLButtonElement>('#resetWords')!
const photoButton = document.querySelector<HTMLButtonElement>('#photoCapture')!
const videoButton = document.querySelector<HTMLButtonElement>('#videoCapture')!
const status = document.querySelector<HTMLParagraphElement>('#status')!
const visualStatus = document.querySelector<HTMLSpanElement>('#visualStatus')!

const placed: Word[] = []
const hands = new Map<string, HandState>()
let trackedHands: Point[][] = []
let sentenceWords = [...defaultWords]
let sentenceIndex = 0
let width = innerWidth
let height = innerHeight
let tracker: ReturnType<typeof createTracking> | undefined
let cameraStream: MediaStream | undefined
let animationFrame = 0
let resetHoverSince = 0
let resetGestureActive = false
let recorder: MediaRecorder | undefined
let recordedChunks: Blob[] = []

function resize(): void {
  const pixelRatio = Math.min(devicePixelRatio || 1, 2)
  width = innerWidth
  height = innerHeight
  canvas.width = Math.max(2, Math.round(width * pixelRatio))
  canvas.height = Math.max(2, Math.round(height * pixelRatio))
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
}

function videoCover(): { x: number; y: number; width: number; height: number } {
  const sourceWidth = video.videoWidth || width
  const sourceHeight = video.videoHeight || height
  const scale = Math.max(width / sourceWidth, height / sourceHeight)
  const renderedWidth = sourceWidth * scale
  const renderedHeight = sourceHeight * scale
  return {
    x: (width - renderedWidth) / 2,
    y: (height - renderedHeight) / 2,
    width: renderedWidth,
    height: renderedHeight,
  }
}

function drawCamera(): void {
  if (!cameraStream || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
  const cover = videoCover()
  context.save()
  context.translate(width, 0)
  context.scale(-1, 1)
  context.filter = 'saturate(.72) contrast(1.04) brightness(.88)'
  context.drawImage(video, cover.x, cover.y, cover.width, cover.height)
  context.restore()
}

function draw(now: number): void {
  context.clearRect(0, 0, width, height)
  drawCamera()
  placed.forEach((word) => {
    const entrance = Math.min(1, (now - word.born) / 420)
    context.save()
    context.translate(word.x, word.y)
    context.rotate(word.rotation)
    context.scale(.82 + entrance * .18, .82 + entrance * .18)
    context.globalAlpha = entrance
    context.font = `600 ${word.size}px Pretendard, Inter, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.shadowColor = '#ffffffaa'
    context.shadowBlur = 16
    context.fillStyle = '#fff'
    context.fillText(word.text, 0, 0)
    context.restore()
  })
  animationFrame = requestAnimationFrame(draw)
}

function wordAt(x: number, y: number): Word | undefined {
  for (let index = placed.length - 1; index >= 0; index -= 1) {
    const word = placed[index]
    const halfWidth = Math.max(42, word.text.length * word.size * .34)
    if (Math.abs(x - word.x) <= halfWidth && Math.abs(y - word.y) <= word.size) return word
  }
  return undefined
}

function addWord(x: number, y: number): void {
  const text = sentenceWords[sentenceIndex % sentenceWords.length]
  sentenceIndex += 1
  placed.push({ text, x: x * width, y: y * height, size: 24, born: performance.now(), rotation: 0 })
  if (placed.length > MAX_WORDS) placed.shift()
}

function processHands(result: TrackingResult): void {
  const now = performance.now()
  const visibleHands = new Set<string>()
  trackedHands = result.hands.map(landmarks => landmarks.map(point => ({ ...point, x: 1 - point.x })))

  result.hands.forEach((landmarks, index) => {
    const wrist = landmarks[0]
    const thumb = landmarks[4]
    const indexTip = landmarks[8]
    if (!wrist || !thumb || !indexTip) return

    const key = result.labels[index] || `hand-${index}`
    visibleHands.add(key)
    const x = 1 - wrist.x
    const y = wrist.y
    const pinchX = 1 - (thumb.x + indexTip.x) / 2
    const pinchY = (thumb.y + indexTip.y) / 2
    const pinching = Math.hypot(thumb.x - indexTip.x, thumb.y - indexTip.y) < PINCH_THRESHOLD
    let hand = hands.get(key)

    if (!hand) {
      hand = { x, y, lastMove: now, lastSpawn: 0, pinching: false }
      hands.set(key, hand)
    }

    if (pinching && !hand.pinching) hand.dragging = wordAt(pinchX * width, pinchY * height)
    if (pinching && hand.dragging) {
      hand.dragging.x = pinchX * width
      hand.dragging.y = pinchY * height
    }
    if (!pinching) hand.dragging = undefined
    hand.pinching = pinching

    const distance = Math.hypot((x - hand.x) * width, (y - hand.y) * height)
    if (distance > MOVEMENT_THRESHOLD_PX) {
      hand.x = x
      hand.y = y
      hand.lastMove = now
    } else if (!pinching && now - hand.lastMove >= PAUSE_MS && now - hand.lastSpawn >= SPAWN_GAP_MS) {
      addWord(x, y)
      hand.lastSpawn = now
    }
  })

  hands.forEach((_hand, key) => {
    if (!visibleHands.has(key)) hands.delete(key)
  })

  const trackingMessage = result.hands.length
    ? `${result.hands.length}개의 손 인식 중 · ${placed.length}개의 단어`
    : '손을 카메라 안으로 보여주세요.'
  status.textContent = trackingMessage
  visualStatus.textContent = result.hands.length ? 'HAND TRACKING' : 'SHOW YOUR HAND'
}

function resetWords(): void {
  placed.length = 0
  sentenceIndex = 0
  hands.forEach(hand => {
    hand.lastMove = performance.now()
    hand.lastSpawn = performance.now()
    hand.dragging = undefined
  })
  status.textContent = '단어를 모두 지웠습니다.'
}

function checkResetGesture(): void {
  if (!cameraStream) return
  const rect = resetButton.getBoundingClientRect()
  const hovering = trackedHands.some((hand) => {
    const thumb = hand[4]
    return thumb && thumb.x * width >= rect.left && thumb.x * width <= rect.right
      && thumb.y * height >= rect.top && thumb.y * height <= rect.bottom
  })

  if (!hovering) {
    resetHoverSince = 0
    resetGestureActive = false
    resetButton.classList.remove('is-hovered')
    return
  }

  resetButton.classList.add('is-hovered')
  if (!resetHoverSince) resetHoverSince = performance.now()
  if (!resetGestureActive && performance.now() - resetHoverSince >= PAUSE_MS) {
    resetWords()
    resetGestureActive = true
  }
}

function download(blob: Blob, extension: string): void {
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = `stop-thinking-${Date.now()}.${extension}`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function capturePhoto(): void {
  if (!cameraStream) {
    status.textContent = '먼저 카메라를 켜주세요.'
    return
  }
  canvas.toBlob((blob) => {
    if (blob) download(blob, 'png')
  }, 'image/png')
}

function recordingOptions(): MediaRecorderOptions | undefined {
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) return { mimeType: 'video/webm;codecs=vp9' }
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) return { mimeType: 'video/webm;codecs=vp8' }
  if (MediaRecorder.isTypeSupported('video/webm')) return { mimeType: 'video/webm' }
  return undefined
}

function finishRecording(): void {
  if (!recordedChunks.length) return
  const type = recorder?.mimeType || 'video/webm'
  download(new Blob(recordedChunks, { type }), 'webm')
  recordedChunks = []
}

function toggleRecording(): void {
  if (!cameraStream) {
    status.textContent = '먼저 카메라를 켜주세요.'
    return
  }
  if (!('MediaRecorder' in window) || !canvas.captureStream) {
    status.textContent = '이 브라우저에서는 영상 녹화를 지원하지 않습니다.'
    return
  }
  if (recorder?.state === 'recording') {
    recorder.stop()
    videoButton.classList.remove('is-recording')
    videoButton.setAttribute('aria-label', '영상 녹화 시작')
    status.textContent = '녹화를 저장하고 있습니다.'
    return
  }

  recordedChunks = []
  recorder = new MediaRecorder(canvas.captureStream(30), recordingOptions())
  recorder.addEventListener('dataavailable', event => {
    if (event.data.size) recordedChunks.push(event.data)
  })
  recorder.addEventListener('stop', finishRecording, { once: true })
  recorder.start(250)
  videoButton.classList.add('is-recording')
  videoButton.setAttribute('aria-label', '영상 녹화 중지')
  status.textContent = '영상을 녹화하고 있습니다.'
}

async function startCamera(): Promise<void> {
  startButton.disabled = true
  startButton.classList.add('is-loading')
  status.textContent = '카메라 권한을 확인하고 있습니다.'

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 30, max: 30 } },
      audio: false,
    })
    video.srcObject = cameraStream
    await video.play()
    tracker = createTracking(
      video,
      { face: false, segmentation: false, inputWidth: 320, maxHands: 2, frameIntervalMs: 33 },
      processHands,
      (error) => {
        console.error(error)
        status.textContent = '손 추적을 시작하지 못했습니다.'
        visualStatus.textContent = 'TRACKING ERROR'
      },
    )
    startScreen.classList.add('is-hidden')
    scene.classList.add('is-running')
    startButton.hidden = true
    status.textContent = '손목을 움직이다 0.3초 동안 멈춰보세요.'
    visualStatus.textContent = 'SHOW YOUR HAND'
  } catch (error) {
    console.error(error)
    startButton.disabled = false
    startButton.classList.remove('is-loading')
    status.textContent = '카메라 권한이 필요합니다. HTTPS 또는 localhost에서 열어주세요.'
    visualStatus.textContent = 'CAMERA ERROR'
  }
}

function updateSentence(): void {
  const clean = sentenceInput.value.replace(/\s+/g, ' ')
  if (clean !== sentenceInput.value) {
    sentenceInput.value = clean
    sentenceInput.setSelectionRange(clean.length, clean.length)
  }
  sentenceWords = clean.trim() ? clean.trim().split(' ') : [...defaultWords]
  sentenceIndex = 0
  placed.length = 0
}

function stop(): void {
  cancelAnimationFrame(animationFrame)
  tracker?.stop()
  trackedHands = []
  if (recorder?.state === 'recording') recorder.stop()
  cameraStream?.getTracks().forEach(track => track.stop())
}

sentenceInput.addEventListener('input', updateSentence)
resetButton.addEventListener('click', resetWords)
photoButton.addEventListener('click', capturePhoto)
videoButton.addEventListener('click', toggleRecording)
startButton.addEventListener('click', () => void startCamera())
addEventListener('resize', resize)
addEventListener('pagehide', stop, { once: true })
setInterval(checkResetGesture, 50)
resize()
animationFrame = requestAnimationFrame(draw)
