import { useEffect, useMemo, useState } from 'react'
import { BufferGeometry, CanvasTexture, Float32BufferAttribute, SRGBColorSpace } from 'three'
import { nacelleOuterRadius } from '../data/flowpath'
import { useView } from '../store'

/**
 * Scritte sulla gondola: una fascia sottile che segue il profilo esterno della gondola (stessi punti del
 * corpo di rivoluzione), con una texture disegnata su canvas. Le scritte sono decorative, non fanno
 * parte della ricostruzione tecnica.
 */
interface Patch {
  /** Estensione assiale [m]. */
  z0: number
  z1: number
  /** Angolo centrale e ampiezza angolare [rad]; φ misurato da +Y verso +Z. */
  phi: number
  span: number
}

const LIFT = 0.004 // distanza dalla superficie, per evitare sovrapposizioni con la gondola

function patchGeometry({ z0, z1, phi, span }: Patch, nz = 48, nphi = 24): BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let j = 0; j <= nphi; j++) {
    const v = j / nphi
    // v = 1 in alto (φ minore = y maggiore sul lato visibile)
    const a = phi + (0.5 - v) * span
    for (let i = 0; i <= nz; i++) {
      const u = i / nz
      const z = z0 + (z1 - z0) * u
      const r = nacelleOuterRadius(z) + LIFT
      pos.push(z, r * Math.cos(a), r * Math.sin(a))
      uv.push(u, v)
    }
  }
  const W = nz + 1
  for (let j = 0; j < nphi; j++)
    for (let i = 0; i < nz; i++) {
      const a = j * W + i
      idx.push(a, a + 1, a + W, a + 1, a + W + 1, a + W)
    }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Proporzione larghezza/altezza reale della fascia, perché il testo non risulti deformato. */
function aspect(p: Patch): number {
  const zm = (p.z0 + p.z1) / 2
  return (p.z1 - p.z0) / (nacelleOuterRadius(zm) * p.span)
}

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

function useCanvasTexture(p: Patch, draw: Draw, fontsReady: boolean) {
  return useMemo(() => {
    const h = 256
    const w = Math.round(h * aspect(p))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    draw(c.getContext('2d')!, w, h)
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    return t
    // fontsReady: ridisegna quando il font Inter è disponibile
  }, [p, fontsReady])
}

const FONT = "'Inter', system-ui, sans-serif"
const INK = '#20252d'
const ACCENT = '#e8641c'

/** Nome del progetto: lato visibile nella vista d'insieme, parte anteriore della gondola. */
const BRAND: Patch = { z0: -0.62, z1: 1.18, phi: (122 * Math.PI) / 180, span: 0.4 }
/** Nome del motore: parte posteriore, stesso lato. */
const ENGINE: Patch = { z0: 1.6, z1: 3.05, phi: (150 * Math.PI) / 180, span: 0.26 }

const drawBrand: Draw = (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h)
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${h * 0.62}px ${FONT}`
  const parts: [string, string][] = [
    ['Turb', INK],
    ['(OF)', ACCENT],
    ['an', INK],
  ]
  const total = parts.reduce((s, [t]) => s + ctx.measureText(t).width, 0)
  let x = (w - total) / 2
  for (const [t, col] of parts) {
    ctx.fillStyle = col
    ctx.fillText(t, x, h * 0.52)
    x += ctx.measureText(t).width
  }
}

const drawEngine: Draw = (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h)
  ctx.textBaseline = 'middle'
  ctx.fillStyle = ACCENT
  ctx.fillRect(0, h * 0.1, h * 0.08, h * 0.8)
  ctx.fillStyle = INK
  ctx.font = `700 ${h * 0.36}px ${FONT}`
  ctx.fillText('NASA/GE E³', h * 0.22, h * 0.32)
  ctx.font = `600 ${h * 0.24}px ${FONT}`
  ctx.fillText('ENERGY EFFICIENT ENGINE', h * 0.22, h * 0.72)
}

function Label({ patch, draw, fontsReady }: { patch: Patch; draw: Draw; fontsReady: boolean }) {
  const geometry = useMemo(() => patchGeometry(patch), [patch])
  const map = useCanvasTexture(patch, draw, fontsReady)
  return (
    <mesh geometry={geometry} raycast={() => null}>
      <meshStandardMaterial map={map} transparent metalness={0.2} roughness={0.6} depthWrite={false} />
    </mesh>
  )
}

export function Livery() {
  const hidden = useView((s) => s.hidden.fan_casing)
  const focus = useView((s) => s.focusIds)
  const exploded = useView((s) => s.explode > 0.01)
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => {
    document.fonts
      .load(`800 40px Inter`)
      .then(() => setFontsReady(true))
      .catch(() => setFontsReady(true))
  }, [])
  // Le scritte seguono la gondola: spariscono se la gondola è nascosta o in trasparenza.
  if (hidden || exploded || (focus && !focus.includes('fan_casing'))) return null
  return (
    <>
      <Label patch={BRAND} draw={drawBrand} fontsReady={fontsReady} />
      <Label patch={ENGINE} draw={drawEngine} fontsReady={fontsReady} />
    </>
  )
}
