import { useState } from 'react';
import { MONTHS, key } from './data.js';

// Resumen visual de «Mis faltas»: reparto por módulo (anillo), margen gastado
// de cada módulo (barras) y evolución por semanas (columnas).

const card = { background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)', borderRadius: 26, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 };
const title = { margin: 0, fontFamily: 'var(--display)', fontWeight: 600, fontSize: 21, letterSpacing: '-0.02em' };
const sub = { margin: '2px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--muted)' };

export default function Resumen({ cards, abs, now, wide }) {
  return (
    <section aria-label="Resumen visual" style={{ display: 'grid', gridTemplateColumns: wide ? 'minmax(0,1fr) minmax(0,1.25fr)' : 'minmax(0,1fr)', gap: 14 }}>
      <Donut cards={cards} abs={abs} />
      <Bars cards={cards} />
      <div style={{ gridColumn: wide ? '1 / -1' : 'auto' }}><Weeks abs={abs} now={now} /></div>
    </section>
  );
}

// ── Anillo: en qué módulos se reparten las faltas ────────────────────────
function arc(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function Donut({ cards, abs }) {
  const [hover, setHover] = useState(null);
  const total = abs.length;
  const items = cards.filter((c) => c.n > 0).sort((a, b) => b.n - a.n);
  const j = abs.filter((a) => a.tag === 'J').length;
  const S = 200, C = S / 2, R = 76, W = 26;
  const gap = items.length > 1 ? 0.035 : 0; // hueco del color del fondo entre trozos
  let a = 0;
  const segs = items.map((c) => {
    const span = (c.n / total) * Math.PI * 2, s = { c, a0: a + gap / 2, a1: a + span - gap / 2 };
    a += span; return s;
  });
  const h = hover && items.find((c) => c.s === hover);

  return (
    <div style={card}>
      <div>
        <h2 style={title}>Reparto de tus faltas</h2>
        <p style={sub}>Horas de falta por módulo</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <svg viewBox={`0 0 ${S} ${S}`} width="180" height="180" role="img" style={{ flex: 'none', margin: '0 auto' }}
          aria-label={total ? `${total} horas de falta: ` + items.map((c) => `${c.s} ${c.n}`).join(', ') : 'Sin faltas'}>
          <circle cx={C} cy={C} r={R} fill="none" stroke="var(--surface2)" strokeWidth={W} />
          {segs.length === 1 && <circle cx={C} cy={C} r={R} fill="none" stroke={segs[0].c.m.c} strokeWidth={W} />}
          {segs.length > 1 && segs.map((g) => (
            <path key={g.c.s} d={arc(C, C, R, g.a0, Math.max(g.a0 + 0.001, g.a1))} fill="none" stroke={g.c.m.c} strokeWidth={hover === g.c.s ? W + 8 : W}
              style={{ cursor: 'pointer', opacity: hover && hover !== g.c.s ? 0.35 : 1 }}
              onMouseEnter={() => setHover(g.c.s)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === g.c.s ? null : g.c.s)} />
          ))}
          <text x={C} y={C - 4} textAnchor="middle" style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 46, fill: 'var(--ink)' }}>{h ? h.n : total}</text>
          <text x={C} y={C + 22} textAnchor="middle" style={{ fontSize: 13, fontWeight: 600, fill: 'var(--muted)', letterSpacing: '.06em' }}>
            {h ? `H EN ${h.s}` : total === 1 ? 'HORA' : 'HORAS'}
          </text>
        </svg>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {!items.length && <li style={{ fontSize: 15, fontWeight: 600, color: 'var(--muted)' }}>Aún no tienes faltas.</li>}
          {items.map((c) => (
            <li key={c.s}>
              <button onMouseEnter={() => setHover(c.s)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(c.s)} onBlur={() => setHover(null)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: hover === c.s ? 'var(--surface2)' : 'transparent', border: 0, borderRadius: 10, padding: '5px 8px', cursor: 'default', fontSize: 15, fontWeight: 600, textAlign: 'left' }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: c.m.c, flex: 'none', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)' }} />
                <span style={{ flex: 1 }}>{c.s}</span>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{Math.round((c.n / total) * 100)} %</span>
                <b style={{ minWidth: 34, textAlign: 'right' }}>{c.n} h</b>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {total > 0 && (
        <div>
          <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', gap: 2 }} role="img" aria-label={`${total - j} injustificadas y ${j} justificadas`}>
            {total - j > 0 && <div style={{ flex: total - j, background: 'var(--ink)' }} />}
            {j > 0 && <div style={{ flex: j, background: 'repeating-linear-gradient(135deg,var(--muted) 0 3px,transparent 3px 6px)', boxShadow: 'inset 0 0 0 2px var(--muted)', borderRadius: 99 }} />}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 14, fontWeight: 600 }}>
            <span><b style={{ fontSize: 16 }}>{total - j}</b> injustificadas</span>
            <span><b style={{ fontSize: 16 }}>{j}</b> justificadas</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Barras: cuánto margen has gastado de cada módulo ────────────────────
function Bars({ cards }) {
  return (
    <div style={card}>
      <div>
        <h2 style={title}>Margen gastado</h2>
        <p style={sub}>Faltas sobre el máximo de cada módulo</p>
      </div>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {cards.map((c) => (
          <div key={c.s} style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr) 62px', alignItems: 'center', gap: 10 }}
            title={`${c.m.name}: ${c.n} de ${c.m.max} h (${Math.round(c.pct * 100)} %)`}>
            <span style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 15 }}>{c.s}</span>
            <div style={{ position: 'relative', height: 22 }} role="img" aria-label={`${c.s}: ${c.n} de ${c.m.max} horas, ${c.label}`}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 6, background: 'var(--surface2)' }} />
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: c.barW, minWidth: c.n ? 6 : 0, borderRadius: 6, background: c.sc }} />
              <div style={{ position: 'absolute', top: -3, bottom: -3, left: '50%', width: 2, background: 'var(--surface)' }} />
              <div style={{ position: 'absolute', top: -3, bottom: -3, left: '80%', width: 2, background: 'var(--surface)' }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}><b style={{ fontSize: 15 }}>{c.n}</b>/{c.m.max} h</span>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr) 62px', gap: 10, marginTop: 2 }}>
          <span />
          <div style={{ position: 'relative', height: 16, fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
            <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>50 %</span>
            <span style={{ position: 'absolute', left: '80%', transform: 'translateX(-50%)' }}>80 %</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 13, fontWeight: 600 }}>
        {[['var(--ok)', 'Vas bien · menos del 50 %'], ['var(--warn)', 'Cuidado · 50–80 %'], ['var(--bad)', 'Al límite · más del 80 %']].map(([c, l]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: c }} />{l}</span>
        ))}
      </div>
    </div>
  );
}

// ── Columnas: faltas por semana ─────────────────────────────────────────
function Weeks({ abs, now }) {
  const [hover, setHover] = useState(null);
  const N = 10;
  const monday = new Date(now); monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weeks = [];
  for (let i = N - 1; i >= 0; i--) {
    const s = new Date(monday); s.setDate(monday.getDate() - 7 * i);
    const e = new Date(s); e.setDate(s.getDate() + 6);
    const ks = key(s), ke = key(e);
    const n = abs.filter((a) => a.date >= ks && a.date <= ke).length;
    weeks.push({ s, e, n, current: i === 0 });
  }
  const max = Math.max(4, ...weeks.map((w) => w.n));
  const total = weeks.reduce((m, w) => m + w.n, 0);
  const hw = hover != null ? weeks[hover] : null;
  const label = (d) => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  const H = 140;

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={title}>Faltas por semana</h2>
          <p style={sub}>{hw ? `Semana del ${label(hw.s)} al ${label(hw.e)}: ${hw.n} ${hw.n === 1 ? 'hora' : 'horas'}` : `Últimas ${N} semanas · ${total} ${total === 1 ? 'hora' : 'horas'}`}</p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${N}, minmax(0,1fr))`, gap: 6, alignItems: 'end', height: H + 44, borderBottom: '2px solid var(--line)', paddingBottom: 0, position: 'relative' }}
        role="img" aria-label={weeks.map((w) => `semana del ${label(w.s)}: ${w.n}`).join('; ')}>
        {weeks.map((w, i) => (
          <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}
            style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 4, cursor: 'pointer', borderRadius: 10, background: hover === i ? 'var(--todayCol)' : 'transparent' }}>
            <span style={{ fontSize: 13, fontWeight: 600, minHeight: 16 }}>{w.n || ''}</span>
            <div style={{ width: '70%', maxWidth: 44, height: Math.max(w.n ? 6 : 2, (w.n / max) * H), borderRadius: '4px 4px 0 0',
              background: w.n ? (w.current ? 'var(--gold)' : 'color-mix(in oklab, var(--gold) 45%, var(--surface2))') : 'var(--surface2)' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${N}, minmax(0,1fr))`, gap: 6, marginTop: -8 }}>
        {weeks.map((w, i) => (
          <span key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: w.current ? 800 : 600, color: w.current ? 'var(--ink)' : 'var(--muted)', lineHeight: 1.2 }}>
            {w.current ? 'Esta' : w.s.getDate()}<br />{w.current ? 'semana' : MONTHS[w.s.getMonth()].slice(0, 3)}
          </span>
        ))}
      </div>
    </div>
  );
}

