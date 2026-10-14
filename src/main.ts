import './style.css'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { createClient } from '@supabase/supabase-js'
import patchworkAtlasUrl from './assets/original-patchwork-blue-atlas.png'

type Work = {
  id: string
  name: string
  type: 'Hand Tracking' | 'Body Tracking'
  cls: string
  x: number
  y: number
  size: number
  description: string
  exampleUrl?: string
  previewUrl?: string
  transitionLayout?: 'flip-grid'
}

type WorkState = Work & {
  element: HTMLButtonElement
  orb: HTMLSpanElement
  dx: number
  dy: number
  vx: number
  vy: number
}

type Point = { x: number; y: number; z?: number }

type GuestbookEntry = {
  id: string
  name: string
  message: string
  created_at: string
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabasePublishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim()
const supabase = supabaseUrl && supabasePublishableKey ? createClient(supabaseUrl, supabasePublishableKey) : null

const works: Work[] = [
  { id: 'R-389', name: 'Awakening Spring', type: 'Hand Tracking', cls: 'orb-1', x: 35, y: 0, size: 150, description: 'Pinch a watering can, pour water over your reflection, and grow a garden of pixel flowers.', exampleUrl: 'examples/watering.html', previewUrl: `${import.meta.env.BASE_URL}watering-start-blue-purple-grid-v4.png` },
  { id: 'R-112', name: 'The Mirror Board', type: 'Hand Tracking', cls: 'orb-10', x: 18, y: 275, size: 104, description: 'Sweep across a seamless camera grid and spin each panel into a shifting field of colour.', exampleUrl: 'examples/kitty-flip.html', previewUrl: patchworkAtlasUrl, transitionLayout: 'flip-grid' },
  { id: 'R-808', name: 'Words in Motion', type: 'Hand Tracking', cls: 'orb-11', x: 82, y: 58, size: 112, description: 'Pause your hand to leave a word behind, then pinch to rearrange the sentence in space.', exampleUrl: 'examples/words-in-motion.html' },
  { id: 'R-228', name: 'White Noise', type: 'Body Tracking', cls: 'orb-2', x: 57, y: 10, size: 100, description: 'A body-led image field that turns small shifts into a quiet, granular signal.' },
  { id: 'R-214', name: 'Orbit', type: 'Hand Tracking', cls: 'orb-3', x: 42, y: 140, size: 82, description: 'A constellation that gathers around the movement of fingertips.' },
  { id: 'R-901', name: 'Touch Study', type: 'Hand Tracking', cls: 'orb-4', x: 24, y: 130, size: 108, description: 'An intimate interface for tracing pressure, proximity, and touch.' },
  { id: 'R-671', name: 'Soft Form', type: 'Body Tracking', cls: 'orb-5', x: 65, y: 150, size: 118, description: 'A changing volume built from the outline of a moving body.' },
  { id: 'R-624', name: 'LiDAR Skin', type: 'Body Tracking', cls: 'orb-6', x: 52, y: 255, size: 98, description: 'A scan of the body translated into layered light and shadow.' },
  { id: 'R-347', name: 'Gesture Index', type: 'Hand Tracking', cls: 'orb-7', x: 34, y: 345, size: 90, description: 'A living index of gestures collected from the space around the screen.' },
  { id: 'R-940', name: 'Depth', type: 'Body Tracking', cls: 'orb-8', x: 63, y: 340, size: 110, description: 'A depth experiment where distance becomes a visible material.' },
  { id: 'R-441', name: 'Field Lines', type: 'Body Tracking', cls: 'orb-9', x: 78, y: 240, size: 145, description: 'Lines of force gently reorganized by the presence of a visitor.' },
]

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main class="site-shell">
    <section class="work-field" aria-label="Interactive works">
      <div class="field-hint" aria-hidden="true">move through the field</div>
      <div class="works" id="works"></div>
    </section>
    <aside class="edge-terminal edge-terminal-left" aria-label="Movement prompt">
      <span class="terminal-prefix">&gt;_</span><span class="terminal-text"></span><span class="terminal-cursor" aria-hidden="true">|</span>
    </aside>
    <aside class="edge-terminal edge-terminal-right" aria-label="Movement prompt">
      <span class="terminal-prefix">&gt;_</span><span class="terminal-text"></span><span class="terminal-cursor" aria-hidden="true">|</span>
    </aside>
    <button class="guestbook-nav-button" id="guestbookButton" type="button">방명록</button>
    <div class="tracking-status" id="trackingStatus" aria-live="polite">Mouse Mode</div>
    <div class="mode-controls" role="group" aria-label="Interaction mode">
      <button class="mode-button is-active" id="mouseModeButton" type="button" aria-pressed="true">Mouse Mode</button>
      <button class="mode-button" id="handModeButton" type="button" aria-pressed="false">Hand Tracking Mode</button>
    </div>
    <video class="camera-preview" id="cameraPreview" autoplay playsinline muted></video>
    <div class="hand-cursor" id="handCursor" aria-hidden="true"><span></span></div>
    <div class="menu-panel" id="menuPanel" aria-hidden="true">
      <button class="panel-close" id="closeMenu" type="button" aria-label="Close menu">×</button>
      <p class="panel-kicker">A moving archive</p>
      <p class="panel-copy">A small collection of experiments that look at the space between a body, a hand, and a screen.</p>
    </div>
    <div class="work-dialog" id="workDialog" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="dialogTitle">
      <button class="dialog-close" id="closeDialog" type="button" aria-label="Close work details">×</button>
      <p class="dialog-kicker">Selected work</p>
      <h2 id="dialogTitle"></h2>
      <p id="dialogDescription"></p>
      <button class="dialog-action" type="button" id="dialogAction">Enter experiment</button>
    </div>
    <section class="guestbook-view" id="guestbookView" aria-hidden="true" aria-labelledby="guestbookTitle">
      <header class="guestbook-header">
        <button class="guestbook-back" id="guestbookBack" type="button" aria-label="메인 화면으로 돌아가기">← 돌아가기</button>
        <div>
          <p class="guestbook-kicker">MOVEMENT ARCHIVE / VISITOR LOG</p>
          <h1 id="guestbookTitle">방명록</h1>
          <p class="guestbook-intro">움직임의 흔적과 떠오른 생각을 이곳에 남겨주세요.</p>
        </div>
      </header>
      <div class="guestbook-content">
        <form class="guestbook-form" id="guestbookForm">
          <div class="guestbook-field">
            <label for="guestName">이름</label>
            <input id="guestName" name="name" type="text" maxlength="30" autocomplete="name" placeholder="이름을 입력하세요" required />
          </div>
          <div class="guestbook-field">
            <label for="guestMessage">하고 싶은 말</label>
            <textarea id="guestMessage" name="message" maxlength="300" rows="5" placeholder="메시지를 남겨주세요" required></textarea>
          </div>
          <div class="guestbook-form-footer">
            <p class="guestbook-form-status" id="guestbookFormStatus" aria-live="polite"></p>
            <button class="guestbook-submit" type="submit">작성하기</button>
          </div>
        </form>
        <div class="guestbook-board-wrap">
          <div class="guestbook-board-heading">
            <p>VISITOR NOTES</p>
            <span id="guestbookCount">0 NOTES</span>
          </div>
          <div class="guestbook-list" id="guestbookList" role="list" aria-live="polite">
            <p class="guestbook-empty" id="guestbookEmpty">방명록을 불러오는 중입니다…</p>
          </div>
        </div>
      </div>
    </section>
    <div class="veil" id="veil" hidden></div>
  </main>
`

const worksElement = document.querySelector<HTMLDivElement>('#works')!
const pointer = { x: innerWidth / 2, y: innerHeight / 2, active: false }
const states: WorkState[] = []
let handActive = false
let trackingMode: 'mouse' | 'hand' = 'mouse'
let handLandmarker: HandLandmarker | null = null
let handLandmarkerPromise: Promise<HandLandmarker> | null = null
let cameraStream: MediaStream | null = null
let handWasOpen = false
let fistLocked = false
let selectedState: WorkState | null = null
let centerLockedState: WorkState | null = null
let lastTrackingMessage = ''
let dialogWork: Work | null = null
let lastHandDetectionAt = 0
let lastDetectedVideoTime = -1
let pageTransitioning = false

const trackingAssetBase = `${import.meta.env.BASE_URL}tracking`

function openWork(work: Work): void {
  dialogWork = work
  document.querySelector<HTMLHeadingElement>('#dialogTitle')!.textContent = `${work.id} — ${work.name}`
  document.querySelector<HTMLParagraphElement>('#dialogDescription')!.textContent = work.description
  toggleLayer(document.querySelector<HTMLElement>('#workDialog')!, true)
}

works.forEach((work) => {
  const element = document.createElement('button')
  element.className = 'work'
  element.type = 'button'
  element.setAttribute('aria-label', `${work.id}, ${work.name}`)
  element.style.setProperty('--orb-size', `${work.size}px`)
  if (work.previewUrl) element.style.setProperty('--orb-art', `url(${work.previewUrl})`)
  element.style.left = `${work.x}%`
  element.style.top = `${work.y}px`
  const label = work.exampleUrl
    ? `<span class="label"><strong class="work-title">${work.name}</strong></span>`
    : `<span class="label">${work.id} [${work.type}]</span>`
  element.innerHTML = `<span class="orb ${work.cls}"></span><span class="fragments" aria-hidden="true"></span>${label}`
  const orb = element.querySelector<HTMLSpanElement>('.orb')!
  const fragments = element.querySelector<HTMLSpanElement>('.fragments')!
  for (let index = 0; index < 12; index += 1) {
    const fragment = document.createElement('span')
    fragment.className = 'fragment'
    fragment.style.setProperty('--tx', `${Math.round((Math.random() - 0.5) * 190)}px`)
    fragment.style.setProperty('--ty', `${Math.round(90 + Math.random() * 170)}px`)
    fragment.style.setProperty('--delay', `${(Math.random() * 0.12).toFixed(2)}s`)
    fragment.style.setProperty('--rotation', `${Math.round(Math.random() * 300 - 150)}deg`)
    fragment.style.setProperty('--fragment-size', `${Math.round(3 + Math.random() * 7)}px`)
    fragments.append(fragment)
  }
  worksElement.append(element)
  const state: WorkState = { ...work, element, orb, dx: 0, dy: 0, vx: 0, vy: 0 }
  states.push(state)
  element.addEventListener('click', () => triggerSelectedWork(state))
})

function setPointer(event: PointerEvent): void {
  pointer.x = event.clientX
  pointer.y = event.clientY
  pointer.active = true
}

window.addEventListener('pointermove', setPointer, { passive: true })
window.addEventListener('pointerleave', () => { pointer.active = false })

function animate(): void {
  if (pageTransitioning) return
  const rect = worksElement.getBoundingClientRect()
  const scale = Math.min(innerWidth / 800, innerHeight / 650)
  if (pointer.active) {
    selectedState = states.reduce((current, candidate) => {
      const currentX = rect.left + (current.x / 100) * rect.width + current.dx / Math.max(scale, 0.65)
      const currentY = rect.top + current.y + 13 + current.size / 2 + current.dy / Math.max(scale, 0.65)
      const candidateX = rect.left + (candidate.x / 100) * rect.width + candidate.dx / Math.max(scale, 0.65)
      const candidateY = rect.top + candidate.y + 13 + candidate.size / 2 + candidate.dy / Math.max(scale, 0.65)
      return Math.hypot(pointer.x - candidateX, pointer.y - candidateY) < Math.hypot(pointer.x - currentX, pointer.y - currentY) ? candidate : current
    }, states[0])
    const selectedX = rect.left + (selectedState.x / 100) * rect.width + selectedState.dx / Math.max(scale, 0.65)
    const selectedY = rect.top + selectedState.y + 13 + selectedState.size / 2 + selectedState.dy / Math.max(scale, 0.65)
    // Camera landmark coordinates have a small amount of jitter, so the
    // center target is intentionally forgiving while still requiring the
    // finger to be clearly inside the orb.
    const centerThreshold = Math.max(72, selectedState.size * 1.05)
    centerLockedState = Math.hypot(pointer.x - selectedX, pointer.y - selectedY) <= centerThreshold ? selectedState : null
  } else {
    selectedState = null
    centerLockedState = null
  }
  const trackingMessage = centerLockedState
    ? trackingMode === 'hand' ? 'Selected — keep your hand open, then make a fist' : 'Selected — click to burst'
    : trackingMode === 'hand'
      ? handActive ? 'Index finger = cursor · touch a centre to select' : 'Hand Tracking Mode'
      : 'Mouse Mode'
  if (trackingMessage !== lastTrackingMessage) {
    document.querySelector<HTMLDivElement>('#trackingStatus')!.textContent = trackingMessage
    lastTrackingMessage = trackingMessage
  }
  states.forEach((item) => {
    const baseX = rect.left + (item.x / 100) * rect.width
    const baseY = rect.top + item.y + 13 + item.size / 2
    const distanceX = pointer.x - baseX
    const distanceY = pointer.y - baseY
    const distance = Math.hypot(distanceX, distanceY)
    const isCenterLocked = centerLockedState === item
    const influence = pointer.active && !isCenterLocked ? Math.max(0, 1 - distance / 560) : 0
    const push = influence * influence * 520
    const rawTargetX = !isCenterLocked && distance > 1 ? -distanceX / distance * push : item.dx
    const rawTargetY = !isCenterLocked && distance > 1 ? -distanceY / distance * push : item.dy
    const minX = item.size / 2 + 8
    const maxX = innerWidth - item.size / 2 - 8
    const minY = item.size / 2 + 8
    const maxY = innerHeight - item.size / 2 - 26
    const targetX = isCenterLocked ? item.dx : Math.min(maxX - baseX, Math.max(minX - baseX, rawTargetX / Math.max(scale, 0.65))) * Math.max(scale, 0.65)
    const targetY = isCenterLocked ? item.dy : Math.min(maxY - baseY, Math.max(minY - baseY, rawTargetY / Math.max(scale, 0.65))) * Math.max(scale, 0.65)
    let collisionX = 0
    let collisionY = 0
    states.forEach((other) => {
      if (other === item) return
      const otherX = rect.left + (other.x / 100) * rect.width + other.dx / Math.max(scale, 0.65)
      const otherY = rect.top + other.y + 13 + other.size / 2 + other.dy / Math.max(scale, 0.65)
      const currentX = baseX + item.dx / Math.max(scale, 0.65)
      const currentY = baseY + item.dy / Math.max(scale, 0.65)
      const distanceX = currentX - otherX
      const distanceY = currentY - otherY
      const distance = Math.hypot(distanceX, distanceY) || 0.001
      const minimumDistance = (item.size + other.size) / 2 + 12
      if (distance < minimumDistance) {
        const force = (minimumDistance - distance) / minimumDistance
        collisionX += (distanceX / distance) * force * 0.55
        collisionY += (distanceY / distance) * force * 0.55
      }
    })
    item.vx += (targetX - item.dx) * 0.038 + (isCenterLocked ? 0 : collisionX)
    item.vy += (targetY - item.dy) * 0.038 + (isCenterLocked ? 0 : collisionY)
    item.vx *= 0.79
    item.vy *= 0.79
    if (isCenterLocked) {
      item.vx = 0
      item.vy = 0
    } else {
      item.dx += item.vx
      item.dy += item.vy
    }
    const focusScale = centerLockedState === item ? 1.18 : pointer.active && selectedState === item ? 1.1 : 1
    item.element.style.transform = `translate3d(calc(-50% + ${item.dx / Math.max(scale, 0.65)}px), ${item.dy / Math.max(scale, 0.65)}px, 0)`
    item.orb.style.setProperty('--scale', ((1 + influence * 0.13) * focusScale).toFixed(3))
    item.element.classList.toggle('is-selected', pointer.active && selectedState === item)
    item.element.classList.toggle('is-center-locked', centerLockedState === item)
    // Keep the artwork and labels crisp even when the pointer is idle.
    item.element.style.filter = 'blur(0)'
  })
  requestAnimationFrame(animate)
}
animate()

function toggleLayer(layer: HTMLElement, open: boolean): void {
  layer.classList.toggle('is-open', open)
  layer.setAttribute('aria-hidden', String(!open))
  document.querySelector<HTMLDivElement>('#veil')!.hidden = !open
}

const menuPanel = document.querySelector<HTMLElement>('#menuPanel')!
const dialog = document.querySelector<HTMLElement>('#workDialog')!
document.querySelector<HTMLButtonElement>('#closeMenu')!.addEventListener('click', () => toggleLayer(menuPanel, false))
document.querySelector<HTMLButtonElement>('#closeDialog')!.addEventListener('click', () => toggleLayer(dialog, false))
document.querySelector<HTMLButtonElement>('#dialogAction')!.addEventListener('click', () => {
  if (dialogWork?.exampleUrl) window.location.assign(`${import.meta.env.BASE_URL}${dialogWork.exampleUrl}`)
})
document.querySelector<HTMLDivElement>('#veil')!.addEventListener('click', () => { toggleLayer(menuPanel, false); toggleLayer(dialog, false) })
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { toggleLayer(menuPanel, false); toggleLayer(dialog, false) } })

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0))
}

function isOpenHand(landmarks: Point[]): boolean {
  const wrist = landmarks[0]
  const fingers = [[8, 6], [12, 10], [16, 14], [20, 18]]
  const extended = fingers.filter(([tip, pip]) => distance(landmarks[tip], wrist) > distance(landmarks[pip], wrist) * 1.12).length
  return extended >= 3
}

function isFist(landmarks: Point[]): boolean {
  const wrist = landmarks[0]
  const fingers = [[8, 6], [12, 10], [16, 14], [20, 18]]
  const curled = fingers.filter(([tip, pip]) => distance(landmarks[tip], wrist) < distance(landmarks[pip], wrist) * 1.04).length
  return curled >= 3
}

function ensureLiquidTransitionFilter(): void {
  if (document.querySelector('#liquid-transition-filter')) return

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.id = 'liquid-transition-filter'
  svg.setAttribute('aria-hidden', 'true')
  svg.innerHTML = `
    <filter id="liquid-transition-warp" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="7" result="liquid-noise">
        <animate attributeName="baseFrequency" values="0.012 0.018;0.019 0.01;0.011 0.017;0.009 0.014" dur="1.55s" fill="freeze" />
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="liquid-noise" scale="20" xChannelSelector="R" yChannelSelector="B" result="liquid-shape">
        <animate attributeName="scale" values="18;34;24;6" keyTimes="0;0.2;0.52;1" dur="1.55s" fill="freeze" />
      </feDisplacementMap>
      <feGaussianBlur in="liquid-shape" stdDeviation="1.8" result="liquid-softness">
        <animate attributeName="stdDeviation" values="1.8;2.8;1.7;0.2" keyTimes="0;0.22;0.55;1" dur="1.55s" fill="freeze" />
      </feGaussianBlur>
    </filter>
  `
  document.body.append(svg)
}

const flipTransitionImage = new Image()
flipTransitionImage.decoding = 'async'
flipTransitionImage.src = patchworkAtlasUrl
void flipTransitionImage.decode().catch(() => undefined)

function paintFlipGridPreview(canvas: HTMLCanvasElement, image: HTMLImageElement): void {
  const tileTarget = innerWidth <= 640 ? 48 : 66
  const columns = Math.max(3, Math.round(innerWidth / tileTarget))
  const tileSize = innerWidth / columns
  const rows = Math.ceil(innerHeight / tileSize)
  const scale = Math.min(devicePixelRatio || 1, 1.25)
  const context = canvas.getContext('2d')!
  const sourceWidth = image.naturalWidth / 4
  const sourceHeight = image.naturalHeight / 4

  canvas.width = Math.max(1, Math.round(innerWidth * scale))
  canvas.height = Math.max(1, Math.round(innerHeight * scale))
  context.setTransform(scale, 0, 0, scale, 0, 0)
  context.imageSmoothingEnabled = true

  for (let index = 0; index < columns * rows; index += 1) {
    const artIndex = (index * 7 + Math.floor(index / 16) * 3) % 16
    const artColumn = artIndex % 4
    const artRow = Math.floor(artIndex / 4)
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = column * tileSize
    const y = row * tileSize
    context.drawImage(
      image,
      artColumn * sourceWidth,
      artRow * sourceHeight,
      sourceWidth,
      sourceHeight,
      x,
      y,
      tileSize,
      tileSize,
    )
    context.strokeStyle = 'rgba(255,255,255,.34)'
    context.lineWidth = 1
    context.strokeRect(x + .5, y + .5, tileSize - 1, tileSize - 1)
  }
}

function buildFlipGridTransition(container: HTMLDivElement, imageUrl: string): void {
  container.classList.add('is-flip-grid-transition')
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  if (flipTransitionImage.complete && flipTransitionImage.naturalWidth) {
    paintFlipGridPreview(canvas, flipTransitionImage)
  } else {
    container.style.backgroundImage = `url(${imageUrl})`
    container.style.backgroundSize = 'cover'
  }
  container.append(canvas)
}

function triggerSelectedWork(target: WorkState | null = centerLockedState): void {
  if (!target || fistLocked) return
  fistLocked = true
  const orbRect = target.orb.getBoundingClientRect()
  target.element.classList.add('is-bursting')
  const selectedWork = target

  if (selectedWork.exampleUrl) {
    const destination = `${import.meta.env.BASE_URL}${selectedWork.exampleUrl}`
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    pageTransitioning = true
    trackingMode = 'mouse'
    handActive = false
    cameraStream?.getTracks().forEach((track) => track.stop())
    cameraStream = null

    if (reducedMotion) {
      document.documentElement.classList.add('is-leaving-page')
      window.setTimeout(() => window.location.assign(destination), 180)
      return
    }

    const originX = orbRect.left + orbRect.width / 2
    const originY = orbRect.top + orbRect.height / 2
    const farthestX = Math.max(originX, innerWidth - originX)
    const farthestY = Math.max(originY, innerHeight - originY)
    const coverRadius = Math.hypot(farthestX, farthestY) + 24
    const orbStyle = getComputedStyle(selectedWork.orb)
    const transitionLayer = document.createElement('div')
    const transitionArt = document.createElement('div')
    const rippleLayer = document.createElement('div')

    ensureLiquidTransitionFilter()
    transitionLayer.className = 'orb-page-transition'
    transitionLayer.setAttribute('aria-hidden', 'true')
    transitionLayer.style.setProperty('--transition-x', `${originX}px`)
    transitionLayer.style.setProperty('--transition-y', `${originY}px`)
    transitionLayer.style.setProperty('--transition-start-radius', `${Math.max(orbRect.width / 2, 1)}px`)
    transitionLayer.style.setProperty('--transition-end-radius', `${coverRadius}px`)
    transitionArt.className = 'orb-page-transition-art'
    if (selectedWork.transitionLayout === 'flip-grid' && selectedWork.previewUrl) {
      transitionLayer.classList.add('is-lightweight-transition')
      transitionLayer.style.setProperty('--transition-start-radius', '2px')
      buildFlipGridTransition(transitionArt, selectedWork.previewUrl)
    } else {
      transitionArt.style.backgroundColor = orbStyle.backgroundColor
      transitionArt.style.backgroundImage = orbStyle.backgroundImage
      transitionArt.style.backgroundPosition = orbStyle.backgroundPosition
      transitionArt.style.backgroundSize = orbStyle.backgroundSize
      transitionArt.style.backgroundRepeat = orbStyle.backgroundRepeat
      transitionArt.style.imageRendering = orbStyle.imageRendering
      transitionArt.style.filter = orbStyle.filter
    }
    transitionLayer.append(transitionArt)
    rippleLayer.className = 'orb-water-ripples'
    rippleLayer.setAttribute('aria-hidden', 'true')
    rippleLayer.style.setProperty('--ripple-x', `${originX}px`)
    rippleLayer.style.setProperty('--ripple-y', `${originY}px`)
    rippleLayer.style.setProperty('--ripple-size', `${Math.max(orbRect.width, 1)}px`)
    rippleLayer.innerHTML = '<span></span><span></span><span></span>'
    document.body.append(transitionLayer)
    document.body.append(rippleLayer)
    document.documentElement.classList.add('is-page-transitioning')

    window.setTimeout(() => {
      transitionLayer.classList.add('is-expanding')
    }, 220)
    window.setTimeout(() => window.location.assign(destination), 1640)
    return
  }

  window.setTimeout(() => {
    selectedWork.element.classList.remove('is-bursting')
    openWork(selectedWork)
  }, 540)
  window.setTimeout(() => { fistLocked = false }, 1400)
}

function updateHandCursor(landmarks: Point[]): void {
  // A hand can leave the camera briefly. Restore the active state as soon as
  // landmarks appear again so selection works without restarting the camera.
  handActive = true
  const indexTip = landmarks[8]
  const x = (1 - indexTip.x) * innerWidth
  const y = indexTip.y * innerHeight
  pointer.x = x
  pointer.y = y
  pointer.active = true
  const cursor = document.querySelector<HTMLElement>('#handCursor')!
  cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`
  cursor.classList.add('is-visible')
  const open = isOpenHand(landmarks)
  const fist = isFist(landmarks)
  if (open && centerLockedState) handWasOpen = true
  if (handWasOpen && fist && centerLockedState) {
    triggerSelectedWork()
    handWasOpen = false
  }
}

function getHandLandmarker(): Promise<HandLandmarker> {
  if (!handLandmarkerPromise) {
    handLandmarkerPromise = FilesetResolver.forVisionTasks(trackingAssetBase)
      .then((vision) => HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `${trackingAssetBase}/hand_landmarker.task`,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      }))
      .catch((error) => {
        handLandmarkerPromise = null
        throw error
      })
  }
  return handLandmarkerPromise
}

function warmHandTrackingModel(): void {
  void getHandLandmarker().catch((error) => {
    // A button click will retry initialization. Keep the warm-up failure quiet
    // because some browsers delay GPU setup until the page is interacted with.
    console.warn('Hand tracking warm-up was deferred.', error)
  })
}

async function startHandTracking(): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>('#handModeButton')!
  const mouseButton = document.querySelector<HTMLButtonElement>('#mouseModeButton')!
  const status = document.querySelector<HTMLDivElement>('#trackingStatus')!
  const video = document.querySelector<HTMLVideoElement>('#cameraPreview')!
  trackingMode = 'hand'
  handActive = false
  mouseButton.classList.remove('is-active')
  mouseButton.setAttribute('aria-pressed', 'false')
  button.classList.add('is-active')
  button.setAttribute('aria-pressed', 'true')
  button.disabled = true
  button.textContent = 'Hand Tracking Mode…'
  status.textContent = 'Hand Tracking Mode'
  try {
    // Request the camera and prepare the model at the same time so model
    // loading does not hold up camera startup.
    const cameraPromise = navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 960 },
        height: { ideal: 540 },
        frameRate: { ideal: 30, max: 30 },
      },
      audio: false,
    })
    const modelPromise = getHandLandmarker()
    cameraStream = await cameraPromise
    video.srcObject = cameraStream
    await video.play()
    video.classList.add('is-active')
    status.textContent = 'Camera on · preparing hand tracking…'
    handLandmarker = await modelPromise
    if (trackingMode !== 'hand') {
      cameraStream?.getTracks().forEach((track) => track.stop())
      return
    }
    handActive = true
    button.textContent = 'Hand Tracking Mode'
    status.textContent = 'Index finger = cursor · open hand → fist to select'
    detectHands(video)
  } catch (error) {
    console.error(error)
    button.disabled = false
    button.textContent = 'Hand Tracking Mode'
    button.classList.remove('is-active')
    button.setAttribute('aria-pressed', 'false')
    trackingMode = 'mouse'
    status.textContent = 'Camera access was not available'
    cameraStream?.getTracks().forEach((track) => track.stop())
    video.classList.remove('is-active')
  }
}

function activateMouseMode(): void {
  trackingMode = 'mouse'
  handActive = false
  handWasOpen = false
  fistLocked = false
  cameraStream?.getTracks().forEach((track) => track.stop())
  cameraStream = null
  handLandmarker = null
  lastHandDetectionAt = 0
  lastDetectedVideoTime = -1
  const video = document.querySelector<HTMLVideoElement>('#cameraPreview')!
  video.srcObject = null
  video.classList.remove('is-active')
  document.querySelector<HTMLElement>('#handCursor')!.classList.remove('is-visible')
  const mouseButton = document.querySelector<HTMLButtonElement>('#mouseModeButton')!
  const handButton = document.querySelector<HTMLButtonElement>('#handModeButton')!
  mouseButton.classList.add('is-active')
  mouseButton.setAttribute('aria-pressed', 'true')
  handButton.classList.remove('is-active')
  handButton.setAttribute('aria-pressed', 'false')
  handButton.disabled = false
  handButton.textContent = 'Hand Tracking Mode'
}

function detectHands(video: HTMLVideoElement): void {
  if (trackingMode !== 'hand' || !handLandmarker) return
  const now = performance.now()
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    && video.currentTime !== lastDetectedVideoTime
    && now - lastHandDetectionAt >= 33) {
    lastHandDetectionAt = now
    lastDetectedVideoTime = video.currentTime
    const result = handLandmarker.detectForVideo(video, now)
    if (result.landmarks[0]) updateHandCursor(result.landmarks[0])
    else {
      handActive = false
      selectedState = null
      document.querySelector<HTMLElement>('#handCursor')!.classList.remove('is-visible')
    }
  }
  requestAnimationFrame(() => detectHands(video))
}

document.querySelector<HTMLButtonElement>('#mouseModeButton')!.addEventListener('click', activateMouseMode)
document.querySelector<HTMLButtonElement>('#handModeButton')!.addEventListener('click', startHandTracking)

if (document.readyState === 'complete') window.setTimeout(warmHandTrackingModel, 250)
else window.addEventListener('load', () => window.setTimeout(warmHandTrackingModel, 250), { once: true })

const movementPrompts = [
  'Move. Observe. Discover.',
  'Move and see what happens.',
  'Every movement creates a response.',
  'Your movement begins the experiment.',
  'A laboratory for bodies, motion, and interaction.',
  'Exploring how movement changes space.',
  'Small movements, unexpected reactions.',
  'Nothing happens until you move.',
  'Movement is the trigger.',
  'Your body becomes the interface.',
]

type TerminalChannel = {
  element: HTMLElement
  text: HTMLElement
  cursor: HTMLElement
  lastPrompt: string
}

const terminalChannels: TerminalChannel[] = Array.from(document.querySelectorAll<HTMLElement>('.edge-terminal')).map((element) => ({
  element,
  text: element.querySelector<HTMLElement>('.terminal-text')!,
  cursor: element.querySelector<HTMLElement>('.terminal-cursor')!,
  lastPrompt: '',
}))

function choosePrompt(lastPrompt: string): string {
  const available = movementPrompts.filter((prompt) => prompt !== lastPrompt)
  return available[Math.floor(Math.random() * available.length)]
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

async function typeTerminalPrompt(channel: TerminalChannel, delay: number): Promise<void> {
  await wait(delay)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  while (true) {
    const prompt = choosePrompt(channel.lastPrompt)
    channel.lastPrompt = prompt
    channel.element.classList.add('is-typing')
    channel.text.textContent = ''

    if (reducedMotion) {
      channel.text.textContent = prompt
    } else {
      for (const character of prompt) {
        channel.text.textContent += character
        await wait(character === ' ' ? 42 : 58 + Math.random() * 42)
      }
    }

    channel.element.classList.remove('is-typing')
    await wait(reducedMotion ? 2600 : 2200 + Math.random() * 1800)
  }
}

terminalChannels.forEach((channel, index) => { void typeTerminalPrompt(channel, index * 1250 + 700) })

const siteShell = document.querySelector<HTMLElement>('.site-shell')!
const guestbookView = document.querySelector<HTMLElement>('#guestbookView')!
const guestbookForm = document.querySelector<HTMLFormElement>('#guestbookForm')!
const guestbookList = document.querySelector<HTMLDivElement>('#guestbookList')!
const guestbookEmpty = document.querySelector<HTMLParagraphElement>('#guestbookEmpty')!
const guestbookCount = document.querySelector<HTMLSpanElement>('#guestbookCount')!
const guestbookFormStatus = document.querySelector<HTMLParagraphElement>('#guestbookFormStatus')!
const guestbookSubmit = guestbookForm.querySelector<HTMLButtonElement>('.guestbook-submit')!
const renderedEntryIds = new Set<string>()
let guestbookLoaded = false
let guestbookSubscriptionStarted = false

function noteVariant(id: string): number {
  return Array.from(id).reduce((total, character) => total + character.charCodeAt(0), 0) % 5
}

function formatGuestbookDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function updateGuestbookCount(): void {
  const count = renderedEntryIds.size
  guestbookCount.textContent = `${count} NOTE${count === 1 ? '' : 'S'}`
}

function addGuestbookEntry(entry: GuestbookEntry, newest = false): void {
  if (renderedEntryIds.has(entry.id)) return
  renderedEntryIds.add(entry.id)
  guestbookEmpty.hidden = true

  const note = document.createElement('article')
  note.className = `guestbook-note note-${noteVariant(entry.id)}${newest ? ' is-new' : ''}`
  note.setAttribute('role', 'listitem')
  note.dataset.entryId = entry.id

  const message = document.createElement('p')
  message.className = 'guestbook-note-message'
  message.textContent = entry.message

  const footer = document.createElement('footer')
  const name = document.createElement('strong')
  name.textContent = entry.name
  const date = document.createElement('time')
  date.dateTime = entry.created_at
  date.textContent = formatGuestbookDate(entry.created_at)
  footer.append(name, date)
  note.append(message, footer)

  guestbookList.prepend(note)
  updateGuestbookCount()
}

function showGuestbookEmpty(message: string): void {
  guestbookEmpty.textContent = message
  guestbookEmpty.hidden = false
}

async function loadGuestbookEntries(): Promise<void> {
  if (guestbookLoaded) return
  guestbookLoaded = true

  if (!supabase) {
    showGuestbookEmpty('Supabase 환경변수를 설정하면 방명록이 표시됩니다.')
    guestbookFormStatus.textContent = 'Supabase 연결 설정이 필요합니다.'
    guestbookSubmit.disabled = true
    return
  }

  const { data, error } = await supabase
    .from('guestbook_entries')
    .select('id, name, message, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error(error)
    guestbookLoaded = false
    showGuestbookEmpty('방명록을 불러오지 못했습니다. Supabase 설정을 확인해주세요.')
    return
  }

  if (!data.length) showGuestbookEmpty('첫 번째 방명록을 남겨주세요.')
  else data.reverse().forEach((entry) => addGuestbookEntry(entry as GuestbookEntry))

  if (!guestbookSubscriptionStarted) {
    guestbookSubscriptionStarted = true
    supabase
      .channel('guestbook-live-notes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'guestbook_entries' },
        (payload) => addGuestbookEntry(payload.new as GuestbookEntry, true),
      )
      .subscribe()
  }
}

function updateGuestbookRoute(): void {
  const isGuestbook = window.location.hash === '#guestbook'
  siteShell.classList.toggle('is-guestbook', isGuestbook)
  guestbookView.classList.toggle('is-visible', isGuestbook)
  guestbookView.setAttribute('aria-hidden', String(!isGuestbook))

  if (isGuestbook) {
    void loadGuestbookEntries()
    window.setTimeout(() => document.querySelector<HTMLInputElement>('#guestName')?.focus(), 120)
  }
}

document.querySelector<HTMLButtonElement>('#guestbookButton')!.addEventListener('click', () => {
  window.location.hash = 'guestbook'
})
document.querySelector<HTMLButtonElement>('#guestbookBack')!.addEventListener('click', () => {
  history.replaceState('', document.title, window.location.pathname + window.location.search)
  updateGuestbookRoute()
})
window.addEventListener('hashchange', updateGuestbookRoute)
updateGuestbookRoute()

guestbookForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!supabase) return

  const nameInput = document.querySelector<HTMLInputElement>('#guestName')!
  const messageInput = document.querySelector<HTMLTextAreaElement>('#guestMessage')!
  const name = nameInput.value.trim()
  const message = messageInput.value.trim()

  if (!name || !message) {
    guestbookFormStatus.textContent = '이름과 메시지를 모두 입력해주세요.'
    return
  }

  guestbookSubmit.disabled = true
  guestbookSubmit.textContent = '저장 중…'
  guestbookFormStatus.textContent = ''

  const { data, error } = await supabase
    .from('guestbook_entries')
    .insert({ name, message })
    .select('id, name, message, created_at')
    .single()

  guestbookSubmit.disabled = false
  guestbookSubmit.textContent = '작성하기'

  if (error) {
    console.error(error)
    guestbookFormStatus.textContent = '저장하지 못했습니다. 잠시 후 다시 시도해주세요.'
    return
  }

  addGuestbookEntry(data as GuestbookEntry, true)
  guestbookForm.reset()
  guestbookFormStatus.textContent = '방명록이 저장되었습니다.'
  window.setTimeout(() => { guestbookFormStatus.textContent = '' }, 3000)
})
