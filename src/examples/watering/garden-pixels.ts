// Original pixel drawings inspired by the references in public; no photo sampling.
function makeSun() {
  const sprite = document.createElement('canvas')
  sprite.width = sprite.height = 49
  const ctx = sprite.getContext('2d')!
  const dot = (x: number, y: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(x + 24, y + 24, 1, 1) }
  for (let ray = 0; ray < 12; ray++) {
    const angle = ray * Math.PI / 6
    for (let y = -24; y <= 24; y++) for (let x = -24; x <= 24; x++) {
      const along = x * Math.cos(angle) + y * Math.sin(angle)
      const across = -x * Math.sin(angle) + y * Math.cos(angle)
      if (Math.abs(along - 21) / 3.3 + Math.abs(across) / 2.5 <= 1.25) {
        dot(x, y, Math.abs(across) < .8 ? '#fff8a0' : ray % 2 ? '#ffd675' : '#fbd546')
      }
    }
  }
  for (let y = -15; y <= 15; y++) for (let x = -15; x <= 15; x++) {
    const distance = Math.hypot(x, y)
    if (distance > 15.6) continue
    const color = distance > 14.2 ? '#edc13c' : distance > 12.8 && x + y > 0 ? '#f9d94c' : x + y < -14 ? '#fff9b0' : '#fff184'
    dot(x, y, color)
  }
  // Turn just the features down-left toward the flowers, retaining square pixels.
  const facePixel = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color
    const angle = Math.PI / 8, c = Math.cos(angle), s = Math.sin(angle)
    for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
      const dx = px - 24, dy = py - 25
      ctx.fillRect(Math.round(21 + dx * c - dy * s), Math.round(27 + dx * s + dy * c), 1, 1)
    }
  }
  facePixel(17, 22, 3, 4, '#765325'); facePixel(29, 22, 3, 4, '#765325')
  facePixel(18, 22, 1, 1, '#fffdf0'); facePixel(30, 22, 1, 1, '#fffdf0')
  facePixel(15, 27, 4, 2, '#f3a2a5'); facePixel(30, 27, 4, 2, '#f3a2a5')
  facePixel(21, 27, 1, 2, '#9e742c'); facePixel(27, 27, 1, 2, '#9e742c')
  facePixel(22, 29, 5, 1, '#9e742c')
  return sprite
}

// Layered, opened rose petals, pale tips, and two angular green leaves.
const rose = [
  '.........ooooooo.........',
  '.......oohhhhhhoo........',
  '.....oohhllllllhhoo......',
  '....ohhlllppplllhhoo.....',
  '...ohhllppoooppllhhho....',
  '..ohhllpoohhhoopllhhho...',
  '.ohhllpohhlllhhopllhhho..',
  'ohhlllpohllpllhoplllhhho.',
  'ohllllpohllpllhopllllhho.',
  'ohllllppoohhhooplllllhho.',
  '.ohllllpppooopplllllho...',
  '.ohhllllpppppplllllhho...',
  '..ohhllllpppplllllhho....',
  '..ohhhllllllpllllhhho....',
  '...ohheellllplleehho.....',
  '....oheeeelllleeeho......',
  '.....ohheeeeeehhho.......',
  '......oohhhhhhoo.........',
  '........oooooo..........',
  '...........gs...........',
  '...gggg....gs......gg...',
  '...gmmgg...gs....ggmg...',
  '....gmvmg..gs...gmmvg...',
  '.....gmvmg.gs..gmmvg....',
  '......gmvmggsggmmvg.....',
  '.......ggmmgsgmmvg......',
  '.........gggsgggg.......',
  '...........gs...........',
]
function makeRose(colors: string[]) {
  const sprite = document.createElement('canvas')
  sprite.width = 25; sprite.height = rose.length
  const ctx = sprite.getContext('2d')!
  const palette: Record<string, string> = { o: colors[0], h: colors[1], l: colors[2], p: colors[3], e: '#fff4b3', g: '#349c75', s: '#28675e', m: '#8dd957', v: '#b8f080' }
  rose.forEach((row, y) => [...row].forEach((cell, x) => { if (palette[cell]) { ctx.fillStyle = palette[cell]; ctx.fillRect(x, y, 1, 1) } }))
  return sprite
}
export const sunPixelSprite = makeSun()
type FlowerStyle = { name: string; color: string; light: string; center: string; petals?: number; length?: number; width?: number; shape?: 'tulip' | 'lavender' | 'bell' }
const flowerStyles: FlowerStyle[] = [
  { name: '해바라기', color: '#ffc52e', light: '#fff08c', center: '#754728', petals: 12, length: 5, width: 1.8 },
  { name: '데이지', color: '#e4eef7', light: '#ffffff', center: '#f6c63b', petals: 10, length: 5.5, width: 1.5 },
  { name: '코스모스', color: '#e63387', light: '#ff8ec9', center: '#ffd766', petals: 8, length: 4.8, width: 2.9 },
  { name: '벚꽃', color: '#f3b3c7', light: '#ffe3eb', center: '#c9688b', petals: 5, length: 5, width: 3.5 },
  { name: '아네모네', color: '#6354d4', light: '#a59bff', center: '#28284c', petals: 7, length: 4.5, width: 3 },
  { name: '백합', color: '#f07c37', light: '#ffd48b', center: '#9b4f29', petals: 6, length: 6, width: 2 },
  { name: '튤립', color: '#ee444f', light: '#ff9892', center: '#ffdc7e', shape: 'tulip' },
  { name: '라벤더', color: '#ac69cf', light: '#e6b7ff', center: '#713f9e', shape: 'lavender' },
  { name: '초롱꽃', color: '#419bd7', light: '#9ee9ff', center: '#f9f2b4', shape: 'bell' },
]
function makeFlower(style: FlowerStyle) {
  const sprite = document.createElement('canvas'); sprite.width = 25; sprite.height = 28
  const ctx = sprite.getContext('2d')!
  const ellipse = (cx: number, cy: number, rx: number, ry: number, color: string, angle = 0) => {
    ctx.fillStyle = color
    for (let y = 0; y < 28; y++) for (let x = 0; x < 25; x++) {
      const dx = x - cx, dy = y - cy, u = dx * Math.cos(angle) + dy * Math.sin(angle), v = -dx * Math.sin(angle) + dy * Math.cos(angle)
      if ((u / rx) ** 2 + (v / ry) ** 2 <= 1) ctx.fillRect(x, y, 1, 1)
    }
  }
  ctx.fillStyle = '#35845c'; ctx.fillRect(12, 12, 2, 16)
  ellipse(8, 22, 5, 2, '#68b959', .65); ellipse(17, 24, 5, 2, '#92d565', -.6)
  if (style.shape === 'tulip') {
    ellipse(12, 11, 8, 8, style.color)
    ellipse(7, 7, 3, 6, style.color, -.25); ellipse(17, 7, 3, 6, style.color, .25)
    ellipse(12, 7, 3, 7, style.light)
    ellipse(9, 13, 2, 4, style.light, -.3)
  } else if (style.shape === 'lavender') {
    for (let row = 0; row < 7; row++) {
      const spread = 1 + row * .55
      ellipse(12 - spread, 2 + row * 2.5, 2.5, 1.8, style.color, -.5)
      ellipse(12 + spread, 3 + row * 2.5, 2.5, 1.8, style.light, .5)
    }
  } else if (style.shape === 'bell') {
    ellipse(12, 7, 6, 6, style.color)
    for (let y = 7; y <= 16; y++) {
      const half = 4 + Math.floor((y - 7) / 2)
      ctx.fillStyle = style.color; ctx.fillRect(12 - half, y, half * 2 + 1, 1)
      ctx.fillStyle = style.light; ctx.fillRect(10 - Math.floor((y - 7) / 3), y, 3, 1)
    }
    for (const x of [5, 12, 19]) ellipse(x, 16, 2, 2, style.light)
    ctx.fillStyle = style.center; ctx.fillRect(11, 17, 3, 3)
  } else {
    for (let i = 0; i < style.petals!; i++) {
      const angle = i / style.petals! * Math.PI * 2 - Math.PI / 2
      const cx = 12 + Math.cos(angle) * 5, cy = 10 + Math.sin(angle) * 5
      ellipse(cx, cy, style.length!, style.width!, style.color, angle)
      ellipse(cx - .5, cy - .5, style.length! * .72, style.width! * .48, style.light, angle)
    }
    ellipse(12, 10, style.name === '해바라기' ? 4 : 2.5, style.name === '해바라기' ? 4 : 2.5, style.center)
    ctx.fillStyle = style.light; ctx.fillRect(11, 9, 1, 1); ctx.fillRect(13, 11, 1, 1)
  }
  return sprite
}
export const flowerPixelSprites = [makeRose(['#b84b78', '#ed6fa7', '#ffa6cc', '#f685ba']), ...flowerStyles.map(makeFlower)]
