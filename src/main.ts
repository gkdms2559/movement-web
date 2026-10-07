import './style.css'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { createClient } from '@supabase/supabase-js'

type Work = {
  id: string
  name: string
  type: 'Hand Tracking' | 'Body Tracking'
  cls: string
  x: number
  y: number
  size: number
  description: string
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
  { id: 'R-389', name: 'Opening Hours', type: 'Hand Tracking', cls: 'orb-1', x: 35, y: 0, size: 150, description: 'A responsive study of the hand as it opens and closes a digital threshold.' },
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
    <div class="tracking-status" id="trackingStatus" aria-live="polite">Mouse mode</div>
    <button class="hand-mode-button" id="handModeButton" type="button">핸드트레킹 모드</button>
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
let handLandmarker: HandLandmarker | null = null
let cameraStream: MediaStream | null = null
let handWasOpen = false
let fistLocked = false
let selectedState: WorkState | null = null
let centerLockedState: WorkState | null = null
let lastTrackingMessage = ''

function openWork(work: Work): void {
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
  element.style.left = `${work.x}%`
  element.style.top = `${work.y}px`
  element.innerHTML = `<span class="orb ${work.cls}"></span><span class="fragments" aria-hidden="true"></span><span class="label">${work.id} [${work.type}]</span>`
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
    ? handActive ? 'Selected — keep your hand open, then make a fist' : 'Selected — click to burst'
    : handActive ? 'Index finger = cursor · touch a centre to select' : 'Mouse mode'
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
    const attraction = Math.min(1, Math.hypot(item.dx, item.dy) / 55)
    const focusScale = centerLockedState === item ? 1.18 : pointer.active && selectedState === item ? 1.1 : 1
    item.element.style.transform = `translate3d(calc(-50% + ${item.dx / Math.max(scale, 0.65)}px), ${item.dy / Math.max(scale, 0.65)}px, 0)`
    item.orb.style.setProperty('--scale', ((1 + influence * 0.13) * focusScale).toFixed(3))
    item.element.classList.toggle('is-selected', pointer.active && selectedState === item)
    item.element.classList.toggle('is-center-locked', centerLockedState === item)
    item.element.style.filter = `blur(${Math.max(0, 0.9 - attraction * 0.9).toFixed(2)}px)`
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

function triggerSelectedWork(target: WorkState | null = centerLockedState): void {
  if (!target || fistLocked) return
  fistLocked = true
  target.element.classList.add('is-bursting')
  const selectedWork = target
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

async function startHandTracking(): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>('#handModeButton')!
  const status = document.querySelector<HTMLDivElement>('#trackingStatus')!
  const video = document.querySelector<HTMLVideoElement>('#cameraPreview')!
  button.disabled = true
  button.textContent = '핸드트레킹 준비 중…'
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280, height: 720 }, audio: false })
    video.srcObject = cameraStream
    await video.play()
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm')
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    })
    handActive = true
    button.textContent = '핸드트레킹 모드 켜짐'
    status.textContent = 'Index finger = cursor · open hand → fist to select'
    detectHands(video)
  } catch (error) {
    console.error(error)
    button.disabled = false
    button.textContent = '핸드트레킹 모드'
    status.textContent = 'Camera access was not available'
    cameraStream?.getTracks().forEach((track) => track.stop())
  }
}

function detectHands(video: HTMLVideoElement): void {
  if (!handLandmarker) return
  const result = handLandmarker.detectForVideo(video, performance.now())
  if (result.landmarks[0]) updateHandCursor(result.landmarks[0])
  else {
    handActive = false
    selectedState = null
    document.querySelector<HTMLElement>('#handCursor')!.classList.remove('is-visible')
  }
  requestAnimationFrame(() => detectHands(video))
}

document.querySelector<HTMLButtonElement>('#handModeButton')!.addEventListener('click', startHandTracking)

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
