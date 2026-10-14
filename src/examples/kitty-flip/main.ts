import './style.css'
import patchworkAtlasUrl from '../../assets/original-patchwork-blue-atlas.png'
import { createTracking, type TrackingResult } from '../watering/tracking'

type Point = { x: number; y: number; z?: number }
type Direction = { x: number; y: number }
type FingertipHistory = { point: Point; direction: Direction; frame: number; time: number }

const ART_COLUMNS = 4
const ART_ROWS = 4
const FINGERTIP_INDEXES = [4, 8, 12, 16, 20]
const INITIAL_CAMERA_RATIO = .7
const DESKTOP_TILE_TARGET = 66
const MOBILE_TILE_TARGET = 48

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main class="flip-scene">
    <video id="camera" autoplay playsinline muted aria-label="실시간 카메라 영상"></video>
    <div class="tile-grid" id="tileGrid" aria-label="손으로 뒤집을 수 있는 같은 크기의 정사각형 패치워크와 카메라 패널"></div>
    <canvas class="start-preview" id="startPreview" aria-hidden="true"></canvas>
    <div class="fingertip-layer" id="fingertipLayer" aria-hidden="true"></div>
    <a class="corner-control back-link" href="../" aria-label="Go back">← BACK</a>
    <button class="corner-control camera-button" id="startCamera" type="button">CAMERA ON</button>
    <p class="sr-only" id="liveStatus" role="status" aria-live="polite">CAMERA OFF</p>
  </main>
`

const video = document.querySelector<HTMLVideoElement>('#camera')!
const grid = document.querySelector<HTMLDivElement>('#tileGrid')!
const startPreview = document.querySelector<HTMLCanvasElement>('#startPreview')!
const fingertipLayer = document.querySelector<HTMLDivElement>('#fingertipLayer')!
const startButton = document.querySelector<HTMLButtonElement>('#startCamera')!
const liveStatus = document.querySelector<HTMLParagraphElement>('#liveStatus')!

const panels: HTMLDivElement[] = []
const rotors: HTMLDivElement[] = []
const fingertipMarkers: HTMLSpanElement[] = []
const fingertipHistory = new Map<string, FingertipHistory>()
let tracker: ReturnType<typeof createTracking> | undefined
let cameraStream: MediaStream | undefined
let previousTouchedTiles = new Set<number>()
let trackingFrame = 0
let viewWidth = innerWidth
let viewHeight = innerHeight
let columnCount = 0
let rowCount = 0
let tileSize = 0
let cameraStarted = false
const previewImage = new Image()
previewImage.decoding = 'async'
previewImage.src = patchworkAtlasUrl

function drawStartPreview(): void {
  if (!previewImage.complete || !previewImage.naturalWidth) return
  const scale = Math.min(devicePixelRatio || 1, 1.25)
  const context = startPreview.getContext('2d')!
  const sourceWidth = previewImage.naturalWidth / ART_COLUMNS
  const sourceHeight = previewImage.naturalHeight / ART_ROWS
  startPreview.width = Math.max(1, Math.round(viewWidth * scale))
  startPreview.height = Math.max(1, Math.round(viewHeight * scale))
  context.setTransform(scale, 0, 0, scale, 0, 0)
  context.imageSmoothingEnabled = true

  for (let index = 0; index < columnCount * rowCount; index += 1) {
    const artIndex = (index * 7 + Math.floor(index / (ART_COLUMNS * ART_ROWS)) * 3) % (ART_COLUMNS * ART_ROWS)
    const artColumn = artIndex % ART_COLUMNS
    const artRow = Math.floor(artIndex / ART_COLUMNS)
    const column = index % columnCount
    const row = Math.floor(index / columnCount)
    const x = column * tileSize
    const y = row * tileSize
    context.drawImage(previewImage, artColumn * sourceWidth, artRow * sourceHeight, sourceWidth, sourceHeight, x, y, tileSize, tileSize)
    context.strokeStyle = 'rgba(255,255,255,.34)'
    context.lineWidth = 1
    context.strokeRect(x + .5, y + .5, tileSize - 1, tileSize - 1)
  }
}

function createTile(index: number): void {
  const cell = document.createElement('div')
  cell.className = 'tile-cell'
  cell.setAttribute('aria-hidden', 'true')

  const panel = document.createElement('div')
  panel.className = 'tile-panel'

  const rotor = document.createElement('div')
  rotor.className = 'tile-rotor'

  const front = document.createElement('div')
  front.className = 'tile-face tile-front'
  const art = document.createElement('div')
  art.className = 'patchwork-art'
  const artIndex = (index * 7 + Math.floor(index / (ART_COLUMNS * ART_ROWS)) * 3) % (ART_COLUMNS * ART_ROWS)
  const artColumn = artIndex % ART_COLUMNS
  const artRow = Math.floor(artIndex / ART_COLUMNS)
  art.style.backgroundImage = `url(${patchworkAtlasUrl})`
  art.style.backgroundPosition = `${artColumn / (ART_COLUMNS - 1) * 100}% ${artRow / (ART_ROWS - 1) * 100}%`
  front.append(art)

  const back = document.createElement('div')
  back.className = 'tile-face tile-back'

  const edgeClasses = ['top', 'right', 'bottom', 'left']
  const edges = edgeClasses.map((side) => {
    const edge = document.createElement('div')
    edge.className = `tile-edge tile-edge--${side}`
    return edge
  })

  rotor.append(front, back, ...edges)
  panel.append(rotor)
  cell.append(panel)
  grid.append(cell)
  panels.push(panel)
  rotors.push(rotor)
}

for (let index = 0; index < FINGERTIP_INDEXES.length * 2; index += 1) {
  const marker = document.createElement('span')
  fingertipLayer.append(marker)
  fingertipMarkers.push(marker)
}

function resizeGrid(): void {
  const scene = app.querySelector<HTMLElement>('.flip-scene')!
  viewWidth = scene.clientWidth
  viewHeight = scene.clientHeight
  const tileTarget = viewWidth <= 640 ? MOBILE_TILE_TARGET : DESKTOP_TILE_TARGET
  const nextColumns = Math.max(3, Math.round(viewWidth / tileTarget))
  const nextTileSize = viewWidth / nextColumns
  const nextRows = Math.ceil(viewHeight / nextTileSize)
  const layoutChanged = nextColumns !== columnCount || nextRows !== rowCount
  columnCount = nextColumns
  rowCount = nextRows
  tileSize = nextTileSize

  grid.style.width = `${viewWidth}px`
  grid.style.height = `${rowCount * tileSize}px`
  grid.style.gridTemplateColumns = `repeat(${columnCount}, ${tileSize}px)`
  grid.style.gridTemplateRows = `repeat(${rowCount}, ${tileSize}px)`

  if (!cameraStarted) {
    drawStartPreview()
    return
  }

  if (layoutChanged || panels.length === 0) {
    grid.replaceChildren()
    panels.length = 0
    rotors.length = 0
    previousTouchedTiles.clear()
    fingertipHistory.clear()
    for (let index = 0; index < columnCount * rowCount; index += 1) createTile(index)
    if (cameraStarted) applyInitialFaceMix()
  }

}

function videoCoverMetrics(): { scale: number; offsetX: number; offsetY: number } {
  const videoWidth = video.videoWidth || viewWidth
  const videoHeight = video.videoHeight || viewHeight
  const scale = Math.max(viewWidth / videoWidth, viewHeight / videoHeight)
  return {
    scale,
    offsetX: (viewWidth - videoWidth * scale) / 2,
    offsetY: (viewHeight - videoHeight * scale) / 2,
  }
}

function projectPoint(point: Point): Point {
  const { scale, offsetX, offsetY } = videoCoverMetrics()
  const renderedWidth = (video.videoWidth || viewWidth) * scale
  const renderedHeight = (video.videoHeight || viewHeight) * scale
  return {
    ...point,
    x: offsetX + (1 - point.x) * renderedWidth,
    y: offsetY + point.y * renderedHeight,
  }
}

function tileAt(point: Point): number | null {
  if (point.x < 0 || point.x >= viewWidth || point.y < 0 || point.y >= viewHeight) return null
  const column = Math.floor(point.x / tileSize)
  const row = Math.floor(point.y / tileSize)
  const index = row * columnCount + column
  return index >= 0 && index < panels.length ? index : null
}

function tilesAlongPath(from: Point, to: Point): number[] {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const sampleSpacing = Math.max(8, tileSize * .35)
  const steps = Math.max(1, Math.ceil(distance / sampleSpacing))
  const tiles: number[] = []
  let lastTile: number | null = null

  for (let step = 0; step <= steps; step += 1) {
    const amount = step / steps
    const tile = tileAt({
      x: from.x + (to.x - from.x) * amount,
      y: from.y + (to.y - from.y) * amount,
    })
    if (tile !== null && tile !== lastTile) {
      tiles.push(tile)
      lastTile = tile
    }
  }

  return tiles
}

function normalizedDirection(vector: Direction, fallback: Direction): Direction {
  const length = Math.hypot(vector.x, vector.y)
  if (length < .001) return fallback
  return { x: vector.x / length, y: vector.y / length }
}

function applyInitialFaceMix(): void {
  const shuffledIndexes = Array.from({ length: panels.length }, (_, index) => index)
  for (let index = shuffledIndexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffledIndexes[index], shuffledIndexes[swapIndex]] = [shuffledIndexes[swapIndex], shuffledIndexes[index]]
  }

  const cameraTileCount = Math.round(panels.length * INITIAL_CAMERA_RATIO)
  const cameraTiles = new Set(shuffledIndexes.slice(0, cameraTileCount))
  panels.forEach((panel, index) => panel.classList.toggle('is-camera-base', cameraTiles.has(index)))
}

function flipTile(index: number, direction: Direction): void {
  const panel = panels[index]
  const rotor = rotors[index]
  const cell = panel?.parentElement
  if (!panel || !rotor || rotor.classList.contains('is-active')) return
  // A panel turns around the axis perpendicular to the hand's travel. Reversing
  // the gesture reverses the axis, so every cardinal and diagonal direction
  // has a visibly matching rotation.
  rotor.style.setProperty('--axis-x', (-direction.y).toFixed(4))
  rotor.style.setProperty('--axis-y', direction.x.toFixed(4))
  rotor.style.setProperty('--spin-angle', '720deg')
  rotor.style.setProperty('--spin-duration', '860ms')
  rotor.classList.add('is-active', 'is-flipping')
  panel.classList.add('is-active')
  cell?.classList.add('is-active')

  const finishSpin = (event: AnimationEvent): void => {
    if (event.target !== rotor || event.animationName !== 'panel-spin') return
    rotor.removeEventListener('animationend', finishSpin)
    rotor.classList.remove('is-flipping', 'is-active')
    panel.classList.remove('is-active')
    cell?.classList.remove('is-active')
  }
  rotor.addEventListener('animationend', finishSpin)
}

function handleTracking(result: TrackingResult): void {
  trackingFrame += 1
  const receivedAt = performance.now()
  const sampleTime = result.timestamp ?? receivedAt
  const processingLag = Math.max(0, receivedAt - sampleTime)
  const touchedTiles = new Set<number>()
  const tileDirections = new Map<number, Direction>()
  let markerIndex = 0

  result.hands.forEach((hand, handIndex) => {
    const label = result.labels[handIndex]
    const handKey = label && label !== 'Unknown' ? label : String(handIndex)

    FINGERTIP_INDEXES.forEach((tipIndex) => {
      const point = hand[tipIndex]
      if (!point) return
      const observedPoint = projectPoint(point)
      const historyKey = `${handKey}:${tipIndex}`
      const previous = fingertipHistory.get(historyKey)
      const canConnect = previous
        && trackingFrame - previous.frame <= 2
        && Math.hypot(observedPoint.x - previous.point.x, observedPoint.y - previous.point.y) < Math.hypot(viewWidth, viewHeight) * .75

      const rawDirection = canConnect
        ? { x: observedPoint.x - previous.point.x, y: observedPoint.y - previous.point.y }
        : previous?.direction ?? { x: 1, y: 0 }
      const elapsedMs = canConnect ? Math.min(140, Math.max(16, sampleTime - previous.time)) : 33
      const rawDistance = Math.hypot(rawDirection.x, rawDirection.y)
      const predictionDistance = canConnect
        ? Math.min(rawDistance * Math.min(1.35, processingLag / elapsedMs), tileSize * 2.5)
        : 0
      const predictionDirection = normalizedDirection(rawDirection, previous?.direction ?? { x: 1, y: 0 })
      const projected = {
        ...observedPoint,
        x: Math.min(viewWidth - 1, Math.max(0, observedPoint.x + predictionDirection.x * predictionDistance)),
        y: Math.min(viewHeight - 1, Math.max(0, observedPoint.y + predictionDirection.y * predictionDistance)),
      }
      const currentDirection = normalizedDirection(rawDirection, previous?.direction ?? { x: 1, y: 0 })
      const smoothedDirection = previous && canConnect
        ? normalizedDirection({
            x: previous.direction.x * .15 + currentDirection.x * .85,
            y: previous.direction.y * .15 + currentDirection.y * .85,
          }, currentDirection)
        : currentDirection

      const pathTiles = canConnect ? tilesAlongPath(previous.point, projected) : [tileAt(projected)]
      pathTiles.forEach((tileIndex) => {
        if (tileIndex === null) return
        touchedTiles.add(tileIndex)
        if (!tileDirections.has(tileIndex)) tileDirections.set(tileIndex, smoothedDirection)
      })
      fingertipHistory.set(historyKey, { point: observedPoint, direction: smoothedDirection, frame: trackingFrame, time: sampleTime })

      const marker = fingertipMarkers[markerIndex]
      if (marker) {
        marker.style.transform = `translate3d(${projected.x}px, ${projected.y}px, 0)`
        marker.classList.add('is-visible')
      }
      markerIndex += 1
    })
  })

  fingertipMarkers.forEach((marker, index) => marker.classList.toggle('is-visible', index < markerIndex))
  touchedTiles.forEach((index) => {
    if (previousTouchedTiles.has(index)) return
    flipTile(index, tileDirections.get(index) ?? { x: 1, y: 0 })
  })
  previousTouchedTiles = touchedTiles
  fingertipHistory.forEach((history, key) => {
    if (trackingFrame - history.frame > 2) fingertipHistory.delete(key)
  })
  liveStatus.textContent = result.hands.length
    ? `LIVE / ${result.hands.length} HAND${result.hands.length > 1 ? 'S' : ''} / ${touchedTiles.size} TOUCH`
    : 'LIVE / SHOW YOUR HAND'
}

async function startCamera(): Promise<void> {
  startButton.disabled = true
  startButton.setAttribute('aria-label', 'Camera is starting')
  startButton.classList.add('is-loading')
  liveStatus.textContent = 'LOADING CAMERA…'

  try {
    if (!cameraStream) {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      video.srcObject = cameraStream
      await video.play()
      cameraStarted = true
      resizeGrid()
      app.querySelector<HTMLElement>('.flip-scene')!.classList.add('is-running')
    }

    tracker?.stop()
    tracker = createTracking(
      video,
      {
        face: false,
        segmentation: false,
        inputWidth: 256,
        maxHands: 1,
        frameIntervalMs: 0,
        minHandDetectionConfidence: .4,
        minHandPresenceConfidence: .35,
        minTrackingConfidence: .35,
      },
      handleTracking,
      (error) => {
        console.error(error)
        tracker = undefined
        liveStatus.textContent = 'TRACKING ERROR / RETRY'
        startButton.disabled = false
        startButton.classList.remove('is-loading', 'is-on')
        startButton.setAttribute('aria-label', 'Restart camera tracking')
      },
    )

    startButton.classList.remove('is-loading')
    startButton.classList.add('is-on')
    startButton.setAttribute('aria-label', 'Camera is on')
    liveStatus.textContent = 'LIVE / SHOW YOUR HAND'
  } catch (error) {
    console.error(error)
    startButton.disabled = false
    startButton.classList.remove('is-loading', 'is-on')
    startButton.setAttribute('aria-label', 'Camera permission required. Try again')
    liveStatus.textContent = 'CAMERA PERMISSION REQUIRED'
  }
}

function stop(): void {
  tracker?.stop()
  cameraStream?.getTracks().forEach((track) => track.stop())
}

startButton.addEventListener('click', () => void startCamera())
addEventListener('resize', resizeGrid)
addEventListener('pagehide', stop, { once: true })
previewImage.addEventListener('load', drawStartPreview, { once: true })
resizeGrid()
