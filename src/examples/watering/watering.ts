import { sunPixelSprite, flowerPixelSprites } from './garden-pixels'

type Point = { x: number; y: number }
type Drop = { x: number; y: number; vx: number; vy: number; born: number; updatedAt: number }
type Sprout = { x: number; y: number; localX: number; localY: number; type: 'head'; born: number; seed: number; flower: number; sunlitAt: number; bloomDelay: number; bloomDuration: number }
type WetSpot = { localX: number; localY: number; type: 'head'; count: number; grown: boolean; planted?: boolean }

function loadPixelSprite(src: string, crop = false, singleSprout = false) {
  const image = new Image(), sprite = document.createElement('canvas')
  image.onload = () => {
    sprite.width = image.naturalWidth; sprite.height = image.naturalHeight
    const c = sprite.getContext('2d', { willReadFrequently: true })!
    if (singleSprout) {
      // The reference is a three-sprout sheet: isolate the large upper sprout.
      const scale = sprite.width / 320
      c.save(); c.beginPath()
      c.rect(48 * scale, 24 * scale, 192 * scale, 124 * scale)
      c.rect(117 * scale, 148 * scale, 23 * scale, 68 * scale)
      c.clip(); c.drawImage(image, 0, 0); c.restore()
    } else c.drawImage(image, 0, 0)
    const frame = c.getImageData(0, 0, sprite.width, sprite.height), pixels = frame.data, queue: number[] = []
    // Remove the uploaded white canvas with a flood fill, preserving enclosed highlights.
    const enqueue = (x: number, y: number) => { const i = (y * sprite.width + x) * 4; if (pixels[i + 3] && pixels[i] > 225 && pixels[i + 1] > 225 && pixels[i + 2] > 225) { pixels[i + 3] = 0; queue.push(y * sprite.width + x) } }
    for (let x = 0; x < sprite.width; x++) { enqueue(x, 0); enqueue(x, sprite.height - 1) }
    for (let y = 1; y < sprite.height - 1; y++) { enqueue(0, y); enqueue(sprite.width - 1, y) }
    if (singleSprout) {
      for (let y = 1; y < sprite.height - 1; y++) for (let x = 1; x < sprite.width - 1; x++) {
        const i = (y * sprite.width + x) * 4
        if (!pixels[i - 4 + 3] || !pixels[i + 4 + 3] || !pixels[i - sprite.width * 4 + 3] || !pixels[i + sprite.width * 4 + 3]) enqueue(x, y)
      }
    }
    for (let head = 0; head < queue.length; head++) { const n = queue[head], x = n % sprite.width, y = Math.floor(n / sprite.width); if (x) enqueue(x - 1, y); if (x + 1 < sprite.width) enqueue(x + 1, y); if (y) enqueue(x, y - 1); if (y + 1 < sprite.height) enqueue(x, y + 1) }
    c.putImageData(frame, 0, 0)
    if (crop) {
      let minX = sprite.width, minY = sprite.height, maxX = -1, maxY = -1
      for (let y = 0; y < sprite.height; y++) for (let x = 0; x < sprite.width; x++) if (pixels[(y * sprite.width + x) * 4 + 3]) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y) }
      if (maxX >= minX) { const clipped = document.createElement('canvas'); clipped.width = maxX - minX + 1; clipped.height = maxY - minY + 1; clipped.getContext('2d')!.drawImage(sprite, minX, minY, clipped.width, clipped.height, 0, 0, clipped.width, clipped.height); sprite.width = clipped.width; sprite.height = clipped.height; sprite.getContext('2d')!.drawImage(clipped, 0, 0) }
    }
  }
  image.src = src
  return sprite
}

/** Pinch-operated watering can and persistent sprouts for the Water Garden example. */
export function createWatering() {
  const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`
  const canSprite = loadPixelSprite(asset('watering-can.png'))
  const sproutSprite = loadPixelSprite(asset('sprout.png'), true, true)
  const dropSprite = loadPixelSprite(asset('water-drop.png'), true)
  const drops: Drop[] = []
  const sprouts: Sprout[] = []
  const flowerPoints: { x: number; y: number; rootY: number; bloom: number; flower: number; size: number }[] = []
  const wetSpots: WetSpot[] = []
  const lastEmit: Record<string, number> = {}
  const personMask = document.createElement('canvas')
  const lightLayer = document.createElement('canvas')
  const glowLayer = document.createElement('canvas')
  let hasPersonMask = false
  let maskImage: ImageData | undefined
  let lightDirty = true
  let lightKey = ''
  function setPersonMask(mask: { data: Float32Array; width: number; height: number }) {
    const resized = personMask.width !== mask.width || personMask.height !== mask.height
    if (resized) { personMask.width = mask.width; personMask.height = mask.height }
    const maskContext = personMask.getContext('2d')!
    const image = maskImage?.width === mask.width && maskImage.height === mask.height ? maskImage : (maskImage = maskContext.createImageData(mask.width, mask.height))
    let changed = !hasPersonMask || resized
    for (let i = 0; i < mask.data.length; i++) {
      const alpha = Math.max(0, Math.min(255, Math.round(mask.data[i] * 255)))
      if (image.data[i * 4 + 3] !== alpha) { image.data[i * 4 + 3] = alpha; changed = true }
    }
    if (changed) { maskContext.putImageData(image, 0, 0); lightDirty = true }
    hasPersonMask = true
  }
  let lastSproutAt = 0
  let sun: { started: number; fromX: number; fromY: number; mouthSize: number } | undefined

  function canPose(hand: Point[], w: number, h: number, label: string) {
    const pinchX = (hand[4].x + hand[8].x) / 2, pinchY = (hand[4].y + hand[8].y) / 2
    const dx = (pinchX - hand[0].x) * w, dy = (pinchY - hand[0].y) * h
    // The spout follows the lean, including when either hand pours outward.
    const direction = Math.abs(dx) > 8 ? Math.sign(dx) : label === 'Left' ? 1 : -1
    const tilt = Math.min(1.25, Math.atan2(Math.abs(dx), -dy))
    const angle = direction * tilt
    const pouring = Math.abs(angle) + 1e-10 >= Math.PI / 4
    // Sprite nozzle at (20, 90) in the 220px reference, rendered at 120px.
    const nozzleX = direction * (106 - 20 / 220 * 120), nozzleY = -59 + 90 / 220 * 120
    return {
      x: pinchX * w, y: pinchY * h, angle, direction, pouring,
      spoutX: pinchX * w + nozzleX * Math.cos(angle) - nozzleY * Math.sin(angle),
      spoutY: pinchY * h + nozzleX * Math.sin(angle) + nozzleY * Math.cos(angle),
    }
  }

  function spray(hand: Point[], label: string, pinching: boolean, now: number, w: number, h: number) {
    if (!pinching) { delete lastEmit[label]; return }
    const pose = canPose(hand, w, h, label)
    if (!pose.pouring) { delete lastEmit[label]; return }
    // Emit on elapsed time, independently of the hand model's result rate.
    let next = lastEmit[label] === undefined ? now : lastEmit[label] + 130
    if (now - next > 260) next = now
    for (; next <= now; next += 130) {
      drops.push({ x: pose.spoutX / w + (Math.random() - .5) * 3 / w, y: pose.spoutY / h, vx: 0, vy: 560 / h, born: next, updatedAt: next })
      lastEmit[label] = next
    }
    while (drops.length > 500) drops.shift()
  }

  function render(ctx: CanvasRenderingContext2D, w: number, h: number, now: number, face: Point[], hands: { points: Point[]; label: string; pinching: boolean }[]) {
    const sunAge = sun ? now - sun.started : 0
    // Hold inside the live mouth, then rise out before travelling to the corner.
    if (sun && sunAge < 450 && face.length >= 468) {
      sun.fromX = (face[13].x + face[14].x) / 2
      sun.fromY = (face[13].y + face[14].y) / 2
    }
    const emergence = smooth((sunAge - 450) / 650)
    const flight = smooth((sunAge - 1100) / 1700)
    const sunlight = sun ? smooth((sunAge - 2600) / 2000) : 0
    const sunPosition = sun ? {
      x: (sun.fromX + (.86 - sun.fromX) * flight) * w,
      y: (sun.fromY + (.19 - sun.fromY) * flight) * h - Math.sin(Math.PI * flight) * h * .12 - (1 - flight) * emergence * sun.mouthSize * 1.8,
    } : undefined
    if (sunPosition) drawSunlight(ctx, w, h, now, sunPosition.x, sunPosition.y, sunlight)
    for (const label of Object.keys(lastEmit)) if (!hands.some(hand => hand.label === label)) delete lastEmit[label]
    hands.forEach(hand => {
      spray(hand.points, hand.label, hand.pinching, now, w, h)
      if (!hand.pinching) return
      const pose = canPose(hand.points, w, h, hand.label)
      ctx.save(); ctx.translate(pose.x, pose.y); ctx.rotate(pose.angle); ctx.globalAlpha = .94
      if (pose.direction > 0) ctx.scale(-1, 1)
      if (canSprite.width) { ctx.imageSmoothingEnabled = false; ctx.drawImage(canSprite, -106, -59, 120, 120) }
      else {
        ctx.fillStyle = '#f2b84b'; ctx.strokeStyle = '#fff1c4'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.roundRect(-48, -19, 34, 38, 7); ctx.fill(); ctx.stroke()
        ctx.beginPath(); ctx.ellipse(-30, -20, 13, 5, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(-48, -5); ctx.lineTo(-77, -14); ctx.lineTo(-80, -10); ctx.lineTo(-51, 2); ctx.stroke()
        ctx.beginPath(); ctx.arc(-14, -1, 9, -Math.PI / 2, Math.PI / 2); ctx.stroke()
      }
      ctx.restore()
    })

    // Water is drawn as separated falling drops without the former blue line.

    let faceFrame: { x: number; y: number; scale: number; angle: number; headX: number; headY: number } | undefined
    if (face.length >= 468) {
      const top = face[10], chin = face[152], left = face[234], right = face[454]
      const lx = left.x * w, ly = left.y * h, rx = right.x * w, ry = right.y * h
      faceFrame = { x: (lx + rx) / 2, y: (top.y * h + chin.y * h) / 2, scale: Math.hypot(rx - lx, ry - ly), angle: Math.atan2(ry - ly, rx - lx), headX: top.x * w, headY: top.y * h }
      const mouthGap = Math.abs(face[13].y - face[14].y) * h
      if (!sun && mouthGap > faceFrame.scale * .055) {
        sun = { started: now, fromX: (face[13].x + face[14].x) * .5, fromY: (face[13].y + face[14].y) * .5, mouthSize: Math.max(5, mouthGap * .65) }
      }
    }
    const faceCos = faceFrame ? Math.cos(faceFrame.angle) : 1, faceSin = faceFrame ? Math.sin(faceFrame.angle) : 0
    const toLocal = (x: number, y: number) => {
      if (!faceFrame) return undefined
      const dx = x * w - faceFrame.x, dy = y * h - faceFrame.y, c = faceCos, s = faceSin
      return { x: (dx * c + dy * s) / faceFrame.scale, y: (-dx * s + dy * c) / faceFrame.scale }
    }
    const fromLocal = (x: number, y: number) => {
      if (!faceFrame) return undefined
      const c = faceCos, s = faceSin
      return { x: (faceFrame.x + (x * c - y * s) * faceFrame.scale) / w, y: (faceFrame.y + (x * s + y * c) * faceFrame.scale) / h }
    }
    const headLocal = faceFrame ? toLocal(faceFrame.headX / w, faceFrame.headY / h) : undefined
    drops.forEach(drop => {
      const age = (now - drop.born) / 1000
      const elapsed = Math.max(0, Math.min(.25, (now - drop.updatedAt) / 1000))
      drop.updatedAt = now
      const steps = Math.max(1, Math.ceil(elapsed / .016))
      for (let step = 0; step < steps; step++) {
        drop.x += drop.vx * elapsed / steps; drop.y += drop.vy * elapsed / steps
        const local = toLocal(drop.x, drop.y)
        if (local && headLocal) {
          const headDx = local.x - headLocal.x, headDy = local.y - (headLocal.y - .18)
          const hitType: Sprout['type'] | undefined = (headDx / .62) ** 2 + (headDy / .3) ** 2 <= 1 ? 'head' : undefined
          if (hitType) {
            let spot = wetSpots.find(s => s.type === hitType && Math.hypot(s.localX - local.x, s.localY - local.y) < .075)
            if (!spot && wetSpots.length < 300) { spot = { type: hitType, localX: local.x, localY: local.y, count: 0, grown: false }; wetSpots.push(spot) }
            if (spot && !spot.grown && ++spot.count >= 5) {
              spot.grown = true
            }
            drop.born = now - 2200
            break
          }
        }
      }
      if (age > 3.5 || drop.x < -.05 || drop.x > 1.05 || drop.y < -.05 || drop.y > 1.2) drop.born = now - 2200
      const fade = Math.max(0, 1 - (now - drop.born) / 1800)
      if (!fade) return
      ctx.save(); ctx.globalAlpha = fade; ctx.imageSmoothingEnabled = false
      const px = Math.max(9, Math.round(Math.min(w, h) * .012)), dx = Math.round(drop.x * w), dy = Math.round(drop.y * h)
      if (dropSprite.width) { ctx.translate(dx, dy); ctx.rotate(Math.atan2(drop.vy * h, drop.vx * w) + Math.PI / 2); ctx.drawImage(dropSprite, -px / 2, -px, px, px * 1.45) }
      else { ctx.fillStyle = '#a8edff'; ctx.fillRect(dx, dy, 4, 6) }
      ctx.restore()
    })
    for (let i = drops.length - 1; i >= 0; i--) if (now - drops[i].born > 2000) drops.splice(i, 1)
    const readySpot = wetSpots.find(spot => spot.grown && !spot.planted)
    if (readySpot && now - lastSproutAt >= 850 && sprouts.length < 100) {
      sprouts.push({ x: 0, y: 0, localX: readySpot.localX, localY: readySpot.localY, type: 'head', born: now, seed: Math.random(), flower: Math.floor(Math.random() * flowerPixelSprites.length), sunlitAt: 0, bloomDelay: Math.random() * 2400, bloomDuration: 1100 + Math.random() * 1700 })
      readySpot.planted = true
      lastSproutAt = now
    }
    sprouts.forEach((s, index) => {
      const anchor = fromLocal(s.localX, s.localY)
      if (anchor) { s.x = anchor.x; s.y = anchor.y }
      const age = Math.min(1, (now - s.born) / 520), x = s.x * w, y = s.y * h, size = Math.max(33, Math.min(76, Math.min(w, h) * .10)) * age
      if (sun && sunlight > .42 && !s.sunlitAt) s.sunlitAt = now || 1
      const bloom = s.sunlitAt ? smooth((now - s.sunlitAt - s.bloomDelay) / s.bloomDuration) : 0
      const point = flowerPoints[index] || (flowerPoints[index] = { x: 0, y: 0, rootY: 0, bloom: 0, flower: 0, size: 0 })
      point.x = x; point.y = y - size * .78; point.rootY = y; point.bloom = bloom; point.flower = s.flower; point.size = size

    })
    if (sunPosition && sun) {
      const fullSize = sunPixelSprite.width * Math.max(3, Math.round(Math.min(w, h) * .006))
      const growth = smooth((sunAge - 450) / 2350)
      const size = sun.mouthSize + (fullSize - sun.mouthSize) * growth
      const reveal = smooth(sunAge / 250)
      if (emergence < 1 && face.length >= 468) {
        // Inner-lip clipping keeps the first tiny sun behind the lips.
        const lips = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]
        ctx.save(); ctx.beginPath()
        lips.forEach((index, i) => { const point = face[index]; if (i === 0) ctx.moveTo(point.x * w, point.y * h); else ctx.lineTo(point.x * w, point.y * h) })
        ctx.closePath(); ctx.clip(); ctx.globalAlpha = reveal * (1 - emergence)
        drawPixelSun(ctx, sunPosition.x, sunPosition.y, now, size, 0)
        ctx.restore()
      }
      ctx.save(); ctx.globalAlpha = reveal * emergence
      drawPixelSun(ctx, sunPosition.x, sunPosition.y, now, size, flight)
      ctx.restore()
    }
    // Draw every sprout first so the blossom can bloom visibly in front of it.
    flowerPoints.forEach(({ x, rootY: y, size }) => {
      ctx.save(); ctx.imageSmoothingEnabled = false
      if (sproutSprite.width) ctx.drawImage(sproutSprite, x - size * .41, y - size, size, size)
      else { ctx.fillStyle = '#7bd458'; ctx.fillRect(x - 3, y - size, 6, size); ctx.fillRect(x - 14, y - size * .8, 13, 6); ctx.fillRect(x + 2, y - size, 13, 6) }
      ctx.restore()
    })
    flowerPoints.forEach(f => {
      if (f.bloom <= 0) return
      const stemWidth = Math.max(2, Math.round(f.size * .055))
      ctx.save(); ctx.fillStyle = '#59a600'
      ctx.fillRect(Math.round(f.x - stemWidth / 2), Math.round(f.y), stemWidth, Math.ceil(f.size * .35))
      ctx.restore()
      drawPixelFlower(ctx, f.x, f.y, f.flower, f.bloom, f.size)
    })
  }

  function drawSunlight(ctx: CanvasRenderingContext2D, w: number, h: number, now: number, sx: number, sy: number, reach: number) {
    if (reach <= 0) return
    // The same expanding light front reveals the rays and the golden background.
    const radius = Math.hypot(w, h) * 1.25 * reach
    if (lightLayer.width !== Math.round(w) || lightLayer.height !== Math.round(h)) {
      lightLayer.width = glowLayer.width = Math.round(w); lightLayer.height = glowLayer.height = Math.round(h)
      lightKey = ''
    }
    const light = lightLayer.getContext('2d')!
    const key = `${w},${h},${sx},${sy},${reach}`
    if (key !== lightKey) {
      const glowContext = glowLayer.getContext('2d')!
      glowContext.clearRect(0, 0, w, h)
      const glow = glowContext.createRadialGradient(sx, sy, 0, sx, sy, radius)
      glow.addColorStop(0, 'rgba(255, 239, 132, .94)')
      glow.addColorStop(.6, 'rgba(255, 215, 65, .88)')
      glow.addColorStop(.84, 'rgba(255, 221, 85, .7)')
      glow.addColorStop(1, 'rgba(255, 225, 100, 0)')
      glowContext.fillStyle = glow; glowContext.fillRect(0, 0, w, h)
      lightDirty = true
    }
    if (lightDirty) {
      light.clearRect(0, 0, w, h)
      light.drawImage(glowLayer, 0, 0)
      if (hasPersonMask) {
        light.save(); light.globalCompositeOperation = 'destination-out'
        light.translate(w, 0); light.scale(-1, 1)
        light.drawImage(personMask, 0, 0, w, h); light.restore()
      }
      lightDirty = false; lightKey = key
    }
    ctx.save(); ctx.drawImage(lightLayer, 0, 0, w, h)
    ctx.globalCompositeOperation = 'screen'
    // A subtle wash on the subject connects the person with the illuminated room.
    ctx.fillStyle = `rgba(255, 220, 105, ${reach * .16})`; ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 19; i++) {
      const angle = .22 + i / 18 * Math.PI * 1.05 + Math.sin(now / 4800 + i) * .018
      const length = radius * (.86 + .12 * Math.sin(i * 2.4))
      const directionX = Math.cos(angle), directionY = Math.sin(angle)
      const pixel = Math.max(3, Math.round(Math.min(w, h) * .006))
      const spacing = pixel * 3.5
      const start = Math.min(w, h) * .125
      for (let distance = start; distance < length; distance += spacing) {
        const px = Math.round((sx + directionX * distance) / pixel) * pixel
        const py = Math.round((sy + directionY * distance) / pixel) * pixel
        if (px + pixel < 0 || py + pixel < 0 || px > w || py > h) continue
        const fade = smooth((length - distance) / (spacing * 5))
        const shimmer = .66 + .2 * Math.sin(now / 550 - distance / 90 + i)
        ctx.globalAlpha = fade * shimmer
        ctx.fillStyle = Math.round(distance / spacing) % 3 === 0 ? '#fff8cc' : '#ffdc58'
        ctx.fillRect(px, py, pixel, pixel)
      }
    }
    ctx.restore()
  }

  function clear() { drops.length = 0; sprouts.length = 0; flowerPoints.length = 0; wetSpots.length = 0; lastSproutAt = 0; sun = undefined; hasPersonMask = false; lightDirty = true; for (const label of Object.keys(lastEmit)) delete lastEmit[label] }
  return { spray, render, clear, setPersonMask, get sproutCount() { return sprouts.length }, get needsPersonMask() { return !!sun } }
}

function smooth(value: number) { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t) }

function drawPixelSun(ctx: CanvasRenderingContext2D, x: number, y: number, now: number, size: number, settled: number) {
  ctx.save(); ctx.imageSmoothingEnabled = false
  const bob = Math.round(Math.sin(now / 1300) * size / 49 * settled)
  ctx.drawImage(sunPixelSprite, Math.round(x - size / 2), Math.round(y - size / 2) + bob, size, size)
  ctx.restore()
}

function drawPixelFlower(ctx: CanvasRenderingContext2D, x: number, y: number, kind: number, bloom: number, sproutSize: number) {
  const sprite = flowerPixelSprites[kind % flowerPixelSprites.length]
  const width = Math.round(sproutSize * 1.45 * (.2 + .8 * bloom))
  // Draw only the blossom; the original sprout supplies its stem and leaves.
  const blossomHeight = 19
  const height = Math.round(width * blossomHeight / sprite.width)
  ctx.save(); ctx.imageSmoothingEnabled = false
  ctx.drawImage(sprite, 0, 0, sprite.width, blossomHeight, Math.round(x - width / 2), Math.round(y - height), width, height)
  ctx.restore()
}
