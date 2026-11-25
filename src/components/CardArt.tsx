import type { ReactNode } from 'react'
import type { CardRef } from '../types.ts'
import { IMAGE_BY_ID } from '../lib/images.ts'
import { rng } from '../lib/random.ts'
import { categoryOf } from '../lib/topics.ts'

/**
 * The picture area of a card. Shows the card's image when one exists in
 * src/assets/cards, otherwise line art generated from the card's id: each
 * topic names a motif in content/topics.json, and the id varies it so no two
 * cards look the same. Needs only the id and topic, so it draws before the
 * card's text has loaded.
 *
 * Motifs draw on a 400x400 canvas. FRAMES says which part of it to show:
 * patterns that work at any crop fill the whole area, while drawings that
 * must stay whole (a bridge, a chamber of seats) are fitted inside it.
 */
export function CardArt({ card }: { card: CardRef }) {
  const image = IMAGE_BY_ID.get(card.id)
  if (image) {
    return (
      <div className="art art--image">
        <img src={image} alt="" loading="lazy" decoding="async" />
      </div>
    )
  }
  const motif = categoryOf(card.category).motif
  const frame = FRAMES[motif] ?? FRAMES.tiles
  return (
    <div className={frame.fill ? 'art art--fill' : 'art'}>
      <svg viewBox={frame.box} preserveAspectRatio={frame.fill ? 'xMidYMid slice' : 'xMidYMid meet'} aria-hidden="true">
        {(MOTIFS[motif] ?? MOTIFS.tiles)(rng(card.id))}
      </svg>
    </div>
  )
}

/** Keep these names in step with MOTIFS in scripts/lib/deck.mjs. */
const FRAMES: Record<string, { box: string; fill?: boolean }> = {
  steps: { box: '30 55 340 265' },
  contours: { box: '0 0 400 400', fill: true },
  orbits: { box: '25 35 350 330' },
  planet: { box: '0 0 400 400', fill: true },
  chamber: { box: '-12 88 424 232' },
  circuit: { box: '0 0 400 400', fill: true },
  tiles: { box: '0 0 400 400', fill: true },
  arches: { box: '10 68 380 258' },
  network: { box: '22 76 356 248' },
  spiro: { box: '25 35 350 330' },
  bridge: { box: '0 92 400 262' },
  bars: { box: '20 62 360 252' },
}

type Rand = () => number
const between = (r: Rand, lo: number, hi: number) => lo + r() * (hi - lo)
const int = (r: Rand, lo: number, hi: number) => Math.floor(between(r, lo, hi + 1))
const f = (n: number) => n.toFixed(1)

const MOTIFS: Record<string, (r: Rand) => ReactNode> = {
  // Steps that start small and grow: compounding effort.
  steps(r) {
    const n = int(r, 6, 9)
    const growth = between(r, 1.25, 1.45)
    const weights = Array.from({ length: n }, (_, i) => growth ** i)
    const total = weights.reduce((a, b) => a + b, 0)
    const w = 290 / n
    let x = 55
    let y = 305
    let d = `M${x} ${y}`
    for (const weight of weights) {
      y -= (205 * weight) / total
      d += ` V${f(y)}`
      x += w
      d += ` H${f(x)}`
    }
    return (
      <>
        <path className="m-soft" d={`${d} V305 Z`} />
        <path className="m-line" d={d} />
        <circle className="m-fill" cx={x - w / 2} cy={y - 22} r="7" />
        <circle className="m-faint" cx={x - w / 2} cy={y - 22} r="18" />
        <circle className="m-faint" cx={x - w / 2} cy={y - 22} r="32" />
        <path className="m-faint" d="M30 305 H370" />
      </>
    )
  },

  // Contour lines, as on a topographic map.
  contours(r) {
    const cx = between(r, 170, 230)
    const cy = between(r, 185, 215)
    const waves = [0, 1, 2].map((i) => ({ k: i + 2, phase: between(r, 0, 6.28), amp: between(r, 0.04, 0.1) }))
    const rings = Array.from({ length: 8 }, (_, ring) => {
      const base = 16 + ring * 24
      const pts = Array.from({ length: 72 }, (_, i) => {
        const a = (i / 72) * Math.PI * 2
        const wobble = waves.reduce((sum, w) => sum + Math.sin(a * w.k + w.phase) * w.amp, 0)
        const radius = base * (1 + wobble * (0.6 + ring * 0.12))
        return `${f(cx + Math.cos(a) * radius * 1.25)} ${f(cy + Math.sin(a) * radius * 0.8)}`
      })
      return <path key={ring} className={ring % 3 === 0 ? 'm-line' : 'm-faint'} d={`M${pts.join(' L')} Z`} />
    })
    return (
      <>
        {rings}
        <circle className="m-fill" cx={cx} cy={cy} r="4" />
      </>
    )
  },

  // Orbits around a nucleus.
  orbits(r) {
    const spin = between(r, 0, 60)
    const count = int(r, 3, 4)
    const orbits = Array.from({ length: count }, (_, i) => {
      const angle = spin + (i * 180) / count
      const t = between(r, 0, Math.PI * 2)
      const rad = (angle * Math.PI) / 180
      const ex = Math.cos(t) * 150
      const ey = Math.sin(t) * 52
      return (
        <g key={i}>
          <ellipse className="m-line" cx="200" cy="200" rx="150" ry="52" transform={`rotate(${f(angle)} 200 200)`} />
          <circle
            className="m-fill"
            cx={200 + ex * Math.cos(rad) - ey * Math.sin(rad)}
            cy={200 + ex * Math.sin(rad) + ey * Math.cos(rad)}
            r="6"
          />
        </g>
      )
    })
    return (
      <>
        <circle className="m-soft" cx="200" cy="200" r="46" />
        {orbits}
        <circle className="m-fill" cx="200" cy="200" r="13" />
      </>
    )
  },

  // A ringed planet in a field of stars.
  planet(r) {
    const stars = Array.from({ length: 54 }, (_, i) => (
      <circle
        key={i}
        className="m-fill"
        cx={between(r, 0, 400)}
        cy={between(r, 40, 360)}
        r={between(r, 0.6, 2.1)}
        opacity={between(r, 0.35, 1)}
      />
    ))
    const radius = between(r, 52, 76)
    const tilt = between(r, -28, -8)
    const moon = between(r, 0, Math.PI * 2)
    return (
      <>
        {stars}
        <circle className="m-soft" cx="200" cy="200" r={radius} />
        <circle className="m-line" cx="200" cy="200" r={radius} />
        <path className="m-faint" d={`M${200 - radius} 200 A${radius} ${radius * 0.32} 0 0 0 ${200 + radius} 200`} />
        <ellipse className="m-line" cx="200" cy="200" rx={radius * 1.9} ry={radius * 0.42} transform={`rotate(${f(tilt)} 200 200)`} />
        <circle className="m-fill" cx={200 + Math.cos(moon) * 165} cy={200 + Math.sin(moon) * 85} r="5" />
      </>
    )
  },

  // Seats in a chamber, split between two sides.
  chamber(r) {
    const split = between(r, 0.32, 0.68)
    const seats: ReactNode[] = []
    for (let row = 0; row < 5; row++) {
      const radius = 62 + row * 33
      const count = 8 + row * 5
      for (let i = 0; i < count; i++) {
        const a = Math.PI + (i / (count - 1)) * Math.PI
        seats.push(
          <circle
            key={`${row}-${i}`}
            className={i / (count - 1) < split ? 'm-fill' : 'm-line'}
            cx={200 + Math.cos(a) * radius}
            cy={300 + Math.sin(a) * radius}
            r="7.5"
          />,
        )
      }
    }
    return (
      <>
        {seats}
        <rect className="m-soft" x="182" y="282" width="36" height="22" rx="3" />
        <rect className="m-line" x="182" y="282" width="36" height="22" rx="3" />
      </>
    )
  },

  // Traces on a circuit board around a chip.
  circuit(r) {
    const traces = Array.from({ length: 11 }, (_, i) => {
      let x = int(r, 1, 9) * 40
      let y = int(r, 2, 8) * 40
      const start = { x, y }
      let d = `M${x} ${y}`
      let horizontal = r() > 0.5
      for (let s = 0, n = int(r, 3, 5); s < n; s++) {
        const step = int(r, 1, 3) * 40 * (r() > 0.5 ? 1 : -1)
        if (horizontal) x = Math.min(380, Math.max(20, x + step))
        else y = Math.min(340, Math.max(60, y + step))
        d += ` L${x} ${y}`
        horizontal = !horizontal
      }
      return (
        <g key={i}>
          <path className={i % 3 === 0 ? 'm-line' : 'm-faint'} d={d} />
          <circle className="m-fill" cx={start.x} cy={start.y} r="4" />
          <circle className="m-ring" cx={x} cy={y} r="5" />
        </g>
      )
    })
    const pins = [168, 184, 200, 216, 232].flatMap((p) => [
      <path key={`t${p}`} className="m-line" d={`M${p} 160 V146 M${p} 240 V254 M160 ${p} H146 M240 ${p} H254`} />,
    ])
    return (
      <>
        {traces}
        <rect className="m-chip" x="160" y="160" width="80" height="80" rx="8" />
        {pins}
        <circle className="m-fill" cx="200" cy="200" r="9" />
      </>
    )
  },

  // Truchet tiles: one simple tile, endless patterns.
  tiles(r) {
    const tiles: string[] = []
    const dots: ReactNode[] = []
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const x = col * 50
        const y = row * 50
        tiles.push(
          r() > 0.5
            ? `M${x + 25} ${y} A25 25 0 0 1 ${x} ${y + 25} M${x + 50} ${y + 25} A25 25 0 0 0 ${x + 25} ${y + 50}`
            : `M${x + 25} ${y} A25 25 0 0 0 ${x + 50} ${y + 25} M${x} ${y + 25} A25 25 0 0 1 ${x + 25} ${y + 50}`,
        )
        if (r() > 0.9) dots.push(<circle key={`${row}-${col}`} className="m-fill" cx={x + 25} cy={y + 25} r="6" />)
      }
    }
    return (
      <>
        <path className="m-line" d={tiles.join(' ')} />
        {dots}
      </>
    )
  },

  // Tiers of arches, as on an aqueduct.
  arches(r) {
    const spans = int(r, 3, 5)
    const tiers = [
      { base: 312, height: 96, count: spans },
      { base: 206, height: 74, count: spans },
      { base: 124, height: 34, count: spans * 3 },
    ]
    const left = 40
    const width = 320
    return (
      <>
        {tiers.map((tier, t) => {
          const w = width / tier.count
          const pier = w * 0.16
          const arch = (w - pier) / 2
          let d = ''
          for (let i = 0; i < tier.count; i++) {
            const x = left + i * w + pier / 2
            const top = tier.base - tier.height + arch
            d += `M${f(x)} ${tier.base} V${f(top)} A${f(arch)} ${f(arch)} 0 0 1 ${f(x + arch * 2)} ${f(top)} V${tier.base} `
          }
          const deck = tier.base - tier.height - 8
          return (
            <g key={t}>
              <path className="m-soft" d={`M${left} ${deck} H${left + width} V${tier.base} H${left} Z ${d}`} fillRule="evenodd" />
              <path className="m-line" d={d} />
              <path className="m-line" d={`M${left - 12} ${deck} H${left + width + 12}`} />
            </g>
          )
        })}
        <path className="m-faint" d="M10 312 H390" />
      </>
    )
  },

  // People and the ties between them.
  network(r) {
    const nodes: { x: number; y: number; size: number }[] = []
    for (let tries = 0; nodes.length < 17 && tries < 400; tries++) {
      const x = between(r, 45, 355)
      const y = between(r, 95, 305)
      if (nodes.every((n) => Math.hypot(n.x - x, n.y - y) > 48)) nodes.push({ x, y, size: between(r, 4, 9) })
    }
    const hub = nodes.reduce((best, n) => (Math.hypot(n.x - 200, n.y - 200) < Math.hypot(best.x - 200, best.y - 200) ? n : best))
    hub.size = 15
    const links = nodes.flatMap((n, i) =>
      nodes
        .map((m, j) => ({ j, dist: Math.hypot(n.x - m.x, n.y - m.y) }))
        .filter((m) => m.j !== i)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2)
        .map((m) => (
          <path key={`${i}-${m.j}`} className="m-faint" d={`M${f(n.x)} ${f(n.y)} L${f(nodes[m.j].x)} ${f(nodes[m.j].y)}`} />
        )),
    )
    const spokes = nodes
      .filter((n) => n !== hub && Math.hypot(n.x - hub.x, n.y - hub.y) < 130)
      .map((n, i) => <path key={i} className="m-line" d={`M${f(hub.x)} ${f(hub.y)} L${f(n.x)} ${f(n.y)}`} />)
    return (
      <>
        {links}
        {spokes}
        {nodes.map((n, i) => (
          <circle key={i} className={n === hub || i % 4 === 0 ? 'm-fill' : 'm-node'} cx={n.x} cy={n.y} r={n.size} />
        ))}
      </>
    )
  },

  // A spirograph curve: simple rule, intricate result.
  spiro(r) {
    const [big, small] = [[5, 3], [7, 3], [8, 3], [7, 2], [9, 4], [11, 4]][int(r, 0, 5)]
    const reach = between(r, 0.7, 1.25)
    const d = small * reach
    const scale = 125 / (big - small + d)
    const pts = Array.from({ length: 721 }, (_, i) => {
      const t = (i / 720) * Math.PI * 2 * small
      const x = (big - small) * Math.cos(t) + d * Math.cos(((big - small) / small) * t)
      const y = (big - small) * Math.sin(t) - d * Math.sin(((big - small) / small) * t)
      return `${f(200 + x * scale)} ${f(200 + y * scale)}`
    })
    return (
      <>
        <circle className="m-faint" cx="200" cy="200" r="132" />
        <path className="m-faint" d="M40 200 H360 M200 60 V340" />
        <path className="m-line" d={`M${pts.join(' L')}`} />
        <circle className="m-fill" cx="200" cy="200" r="4" />
      </>
    )
  },

  // An arched truss bridge.
  bridge(r) {
    const panels = int(r, 4, 6) * 2
    const rise = between(r, 95, 130)
    const left = 45
    const width = 310
    const deck = 262
    const top = (i: number) => deck - 26 - rise * Math.sin((i / panels) * Math.PI)
    const x = (i: number) => left + (i / panels) * width
    let arch = `M${left} ${deck}`
    let web = ''
    for (let i = 0; i <= panels; i++) {
      arch += ` L${f(x(i))} ${f(top(i))}`
      web += `M${f(x(i))} ${deck} V${f(top(i))} `
      if (i < panels) {
        web += i < panels / 2
          ? `M${f(x(i))} ${deck} L${f(x(i + 1))} ${f(top(i + 1))} `
          : `M${f(x(i + 1))} ${deck} L${f(x(i))} ${f(top(i))} `
      }
    }
    arch += ` L${left + width} ${deck}`
    return (
      <>
        <path className="m-soft" d={`${arch} Z`} />
        <path className="m-faint" d={web} />
        <path className="m-line" d={arch} />
        <path className="m-line" d={`M10 ${deck} H390`} strokeWidth="3" />
        <path className="m-line" d={`M${left} ${deck} V318 M${left + width} ${deck} V318`} strokeWidth="5" />
        <path className="m-faint" d="M0 318 H400 M30 330 H150 M210 334 H370 M90 344 H260" />
      </>
    )
  },

  // Bars and a trend line.
  bars(r) {
    const n = int(r, 8, 11)
    const w = 300 / n
    let level = between(r, 40, 70)
    const values = Array.from({ length: n }, () => {
      level = Math.max(24, level + between(r, -16, 34))
      return level
    })
    const scale = 190 / Math.max(...values)
    const line = values.map((v, i) => ({ x: 50 + i * w + w * 0.4, y: 300 - v * scale - between(r, 10, 26) }))
    return (
      <>
        {values.map((v, i) => (
          <rect key={i} className="m-bar" x={50 + i * w} y={300 - v * scale} width={w * 0.8} height={v * scale} rx="2" />
        ))}
        <path className="m-line" d={`M${line.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L')}`} strokeWidth="2.4" />
        {line.map((p, i) => (
          <circle key={i} className={i === line.length - 1 ? 'm-fill' : 'm-node'} cx={p.x} cy={p.y} r={i === line.length - 1 ? 7 : 3.5} />
        ))}
        <path className="m-faint" d="M30 300 H370" />
      </>
    )
  },
}
