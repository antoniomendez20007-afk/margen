import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { api, isLocal, token, cache, ApiError } from './api.js';
import Resumen from './Charts.jsx';
import { SLOTS, BREAK, WEEK, MODS, ORDER, DAYS, MONTHS, WD, WDL, key, parse, wdIdx } from './data.js';

const INK = 'var(--ink)';
const ST = {
  ok: ['Vas bien', 'var(--ok)', 'var(--okSoft)'],
  warn: ['Cuidado', 'var(--warn)', 'var(--warnSoft)'],
  bad: ['Al límite', 'var(--bad)', 'var(--badSoft)'],
  lost: ['Perdida', 'var(--bad)', 'var(--badSoft)'],
};
const RING = '0 0 0 1.5px var(--accent), 0 0 24px -6px var(--accent)';
const pick = (on) => ({ background: on ? 'var(--accent)' : 'transparent', color: on ? 'var(--onAccent)' : INK });
const tint = (c, k = 26) => `radial-gradient(130% 120% at 100% 0%, color-mix(in oklab, ${c} ${k}%, transparent), transparent 62%), var(--surface)`;
const minOf = (d) => d.getHours() * 60 + d.getMinutes();
const shortDate = (k) => { const d = parse(k); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };

// En modo de prueba, ?ahora=2026-11-23T11:05 simula otra fecha y hora
function useNow() {
  const fixed = useMemo(() => {
    if (!isLocal) return null;
    const v = new URLSearchParams(window.location.search).get('ahora');
    const d = v ? new Date(v) : null;
    return d && !isNaN(d) ? d : null;
  }, []);
  const [now, setNow] = useState(() => fixed || new Date());
  useEffect(() => {
    if (fixed) return;
    const iv = setInterval(() => setNow(new Date()), 30000);
    const vis = () => document.visibilityState === 'visible' && setNow(new Date());
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', vis); };
  }, [fixed]);
  return now;
}

function useWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return w;
}

function useTheme() {
  const [theme, setT] = useState(() => {
    try { const t = localStorage.getItem('margen_theme'); if (t) return t; } catch { /* nada */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0E0C0B' : '#EFEAE3');
  }, [theme]);
  const setTheme = (t) => { setT(t); try { localStorage.setItem('margen_theme', t); } catch { /* nada */ } };
  return [theme, setTheme];
}

// ── Piezas ───────────────────────────────────────────────────────────────

const ICONS = {
  hoy: <path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z" />,
  horario: <><rect x="3.5" y="4.5" width="17" height="16" rx="3.5" /><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4" /></>,
  faltas: <><path d="M20.5 13A8.5 8.5 0 1 1 11 3.5V13z" /><path d="M14.5 3.7A8.5 8.5 0 0 1 20.3 9.5h-5.8z" /></>,
  perfil: <><circle cx="12" cy="8" r="4" /><path d="M4 20.5a8 8 0 0 1 16 0" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  diag: <path d="M7 17 17 7M9 7h8v8" />,
  back: <path d="M15 6l-6 6 6 6" />,
  next: <path d="M9 6l6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  check: <path d="M5 12.5 10 17l9-10" />,
};
const Icon = ({ name, size = 22, stroke = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
);

// Anillo genérico: p entre 0 y 1
function Gauge({ p, color, size = 104, stroke = 9, track = 'var(--surface2)', children, label }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, h = size / 2, q = Math.max(0, Math.min(1, p));
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={h} cy={h} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {q > 0 && <circle cx={h} cy={h} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * q} ${c}`} transform={`rotate(-90 ${h} ${h})`} />}
      </svg>
      <div className="col" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>{children}</div>
    </div>
  );
}

const Logo = ({ size = 44, radius = 14, font = 26, children = 'm' }) => (
  <div className="logo" aria-hidden="true" style={{ width: size, height: size, borderRadius: radius, fontSize: font }}>{children}</div>
);
const Chip = ({ s, size = 36 }) => (
  <span className="tile" style={{ width: size, height: size, borderRadius: 999, background: MODS[s].c, color: MODS[s].fg, fontSize: Math.round(size * 0.3) }}>{s}</span>
);
const Dot = ({ c, s = 8 }) => <span style={{ width: s, height: s, borderRadius: 99, background: c, flex: 'none' }} />;

// ── App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [theme, setTheme] = useTheme();
  const [cached] = useState(() => (token.get() ? cache.get() : null));
  const [boot, setBoot] = useState(() => !!token.get() && !cached);
  const [slow, setSlow] = useState(false);
  const [user, setUser] = useState(() => cached?.user ?? null);
  const [abs, setAbs] = useState(() => cached?.abs ?? []);
  const [screen, setScreen] = useState(() => (cached ? 'app' : 'login'));
  const [toast, setToast] = useState(null);
  const tt = useRef();

  const showToast = (msg, undo) => {
    setToast({ msg, undo }); clearTimeout(tt.current);
    tt.current = setTimeout(() => setToast(null), undo ? 4500 : 3800);
  };

  const enter = (res) => { setUser(res.user); setAbs(res.abs || []); setScreen('app'); };
  const leave = () => { token.clear(); setUser(null); setAbs([]); setScreen('login'); setToast(null); };

  // Guarda lo último que se ha visto para abrir al instante la próxima vez
  useEffect(() => { if (user && screen === 'app') cache.set({ user, abs }); }, [user, abs, screen]);

  useEffect(() => {
    const t = token.get();
    if (!t) return;
    const sl = setTimeout(() => setSlow(true), 3000);
    api.me(t).then(enter)
      .catch((e) => {
        if (e.session) { leave(); if (cached) showToast(e.message); }
        else showToast(cached ? 'Sin conexión: estás viendo tus últimos datos.' : e.message);
      })
      .finally(() => { clearTimeout(sl); setBoot(false); });
  }, []);

  // Llama al servidor y deja las faltas tal y como las tiene él
  const call = async (fn) => {
    try { const list = await fn(token.get()); setAbs(list); return list; }
    catch (e) {
      if (e instanceof ApiError && e.session) { leave(); showToast(e.message); }
      else showToast(e.message || 'Algo ha fallado.');
      return null;
    }
  };

  if (boot) return (
    <div className="splash">
      <div className="col" style={{ alignItems: 'center', gap: 18 }}>
        <Logo />
        <span className="muted" style={{ fontSize: 15, fontWeight: 500, visibility: slow ? 'visible' : 'hidden' }}>Conectando con el servidor…</span>
      </div>
    </div>
  );

  const logout = () => { const t = token.get(); if (t) api.logout(t).catch(() => {}); leave(); };

  return (
    <>
      {screen === 'login' && <Login onDone={enter} goRegister={() => setScreen('register')} />}
      {screen === 'register' && <Register onDone={enter} goLogin={() => setScreen('login')} />}
      {screen === 'app' && user && (
        <Main user={user} abs={abs} call={call} showToast={showToast} theme={theme} setTheme={setTheme} logout={logout} />
      )}
      {toast && <Toast toast={toast} close={() => setToast(null)} wide={window.innerWidth >= 900} app={screen === 'app'} />}
    </>
  );
}

function Toast({ toast, close, wide, app }) {
  return (
    <div className="toast" role="status" style={{ bottom: wide || !app ? 28 : 104 }}>
      <span>{toast.msg}</span>
      {toast.undo && <button onClick={() => { toast.undo(); close(); }}>Deshacer</button>}
    </div>
  );
}

// ── Acceso ───────────────────────────────────────────────────────────────

// Ilustración de la portada: anillos de margen con etiquetas flotantes
function Hero() {
  const rings = [['MD', 0.35, 150], ['LPS', 0.3, 118], ['TCIC', 0.23, 86]];
  return (
    <div aria-hidden="true" style={{ position: 'relative', height: 250, display: 'grid', placeItems: 'center', marginBottom: -8 }}>
      <div style={{ position: 'absolute', width: 260, height: 260, borderRadius: 999, background: 'radial-gradient(circle, var(--glow), transparent 65%)' }} />
      {rings.map(([s, p, r]) => (
        <div key={s} style={{ position: 'absolute' }}><Gauge p={p} color={MODS[s].c} size={r * 1.4} stroke={8} track="var(--line)" /></div>
      ))}
      <Logo size={56} radius={18} font={30} />
      <span className="chipfloat" style={{ top: 22, left: 6 }}><Dot c={MODS.MD.c} />MD · 17 h libres</span>
      <span className="chipfloat" style={{ top: 112, right: 0 }}><Dot c={MODS.LPS.c} />LPS · 9 h</span>
      <span className="chipfloat" style={{ bottom: 18, left: 26 }}><Dot c="var(--ok)" />Vas bien</span>
    </div>
  );
}

function Login({ onDone, goRegister }) {
  const [u, setU] = useState(''), [p, setP] = useState(''), [remember, setRemember] = useState(true);
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!u.trim() || !p) return setErr('Escribe tu usuario y tu contraseña.');
    setBusy(true);
    try { const r = await api.login(u, p, remember); token.set(r.token, remember); onDone(r); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="auth">
      <form className="auth-box" style={{ gap: 26 }} onSubmit={submit}>
        <Hero />
        <div className="col" style={{ gap: 10 }}>
          <h1 className="h1" style={{ fontSize: 34, textWrap: 'balance' }}>Tu horario y tus faltas, sin sustos.</h1>
          <p style={{ margin: 0, fontSize: 16 }} className="muted">2º Marketing y Publicidad A · IES Las Salinas</p>
        </div>
        <div className="col" style={{ gap: 14 }}>
          <label className="field">Usuario
            <input value={u} onChange={(e) => { setU(e.target.value); setErr(''); }} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="tu usuario" />
          </label>
          <label className="field">Contraseña
            <input type="password" value={p} onChange={(e) => { setP(e.target.value); setErr(''); }} autoComplete="current-password" placeholder="••••" />
          </label>
          <button type="button" className="check" role="checkbox" aria-checked={remember} onClick={() => setRemember(!remember)}>
            <span className="box" style={{ background: remember ? 'var(--accent)' : 'transparent', borderColor: remember ? 'var(--accent)' : undefined }}>{remember ? <Icon name="check" size={16} stroke={2.4} /> : ''}</span>
            Recordarme
          </button>
          {err && <div className="err" role="alert">{err}</div>}
          <button className="btn-main" disabled={busy} style={{ marginTop: 4 }}><span>{busy ? 'Entrando…' : 'Entrar'}</span><span className="go"><Icon name="arrow" size={20} /></span></button>
        </div>
        <div className="col" style={{ gap: 14, alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: 15 }} className="muted">¿Aún no tienes cuenta? <a href="#" onClick={(e) => { e.preventDefault(); goRegister(); }} style={{ fontWeight: 600, color: 'var(--ink)' }}>Crear cuenta</a></p>
          {isLocal && <p className="mono">Modo de prueba · usuario lucia · contraseña 1234</p>}
        </div>
      </form>
    </div>
  );
}

function Register({ onDone, goLogin }) {
  const [f, setF] = useState({ n: '', u: '', p: '', c: '' });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErr(''); };
  const submit = async (e) => {
    e.preventDefault();
    if (!f.n.trim() || !f.u.trim() || !f.p || !f.c.trim()) return setErr('Rellena todos los campos.');
    if (/\s/.test(f.u.trim())) return setErr('El usuario no puede tener espacios.');
    if (f.p.length < 4) return setErr('La contraseña necesita al menos 4 caracteres.');
    setBusy(true);
    try { const r = await api.register(f.n, f.u, f.p, f.c); token.set(r.token, true); onDone(r); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="auth">
      <form className="auth-box" style={{ gap: 26 }} onSubmit={submit}>
        <div className="topbar">
          <button type="button" className="round" aria-label="Volver" onClick={goLogin}><Icon name="back" size={20} /></button>
          <h1>Crear cuenta</h1><span />
        </div>
        <div className="col" style={{ gap: 8 }}>
          <h2 className="h1" style={{ fontSize: 30 }}>Únete a tu clase</h2>
          <p style={{ margin: 0, fontSize: 16, textWrap: 'pretty' }} className="muted">Solo para 2º MyP A. Necesitas el código de clase.</p>
        </div>
        <div className="col" style={{ gap: 14 }}>
          <label className="field">Nombre<input value={f.n} onChange={set('n')} autoComplete="name" placeholder="Nombre y apellido" maxLength={60} /></label>
          <label className="field">Usuario<input value={f.u} onChange={set('u')} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="sin espacios" maxLength={30} /></label>
          <label className="field">Contraseña<input type="password" value={f.p} onChange={set('p')} autoComplete="new-password" placeholder="mínimo 4 caracteres" /></label>
          <label className="field">Código de clase<input className="code" value={f.c} onChange={set('c')} autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="Te lo pasan en clase" /></label>
          {err && <div className="err" role="alert">{err}</div>}
          <button className="btn-main" disabled={busy} style={{ marginTop: 4 }}><span>{busy ? 'Creando…' : 'Crear cuenta'}</span><span className="go"><Icon name="arrow" size={20} /></span></button>
        </div>
        {isLocal && <p className="mono">Modo de prueba · código SALINAS2A</p>}
      </form>
    </div>
  );
}

// ── Contenedor ───────────────────────────────────────────────────────────

const TABS = [['hoy', 'Hoy'], ['horario', 'Horario'], ['faltas', 'Faltas'], ['perfil', 'Perfil']];

function Main({ user, abs, call, showToast, theme, setTheme, logout }) {
  const now = useNow(), w = useWidth(), wide = w >= 900;
  const [tab, setTab] = useState('hoy');
  const [detail, setDetail] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [day, setDay] = useState(null);
  const [busy, setBusy] = useState(false);

  const tk = key(now), wd = wdIdx(now), min = minOf(now);
  const openDetail = (s) => () => { setTab('faltas'); setDetail(s); setSheet(null); window.scrollTo(0, 0); };
  const go = (t) => { setTab(t); setDetail(null); window.scrollTo(0, 0); };

  // Ids que ha creado una operación: sirven para deshacerla
  const added = (before, after) => after.filter((a) => !before.some((b) => b.id === a.id)).map((a) => a.id);
  const strip = (a) => ({ mod: a.mod, date: a.date, slot: a.slot, tag: a.tag });
  const run = async (fn) => { if (busy) return null; setBusy(true); try { return await call(fn); } finally { setBusy(false); } };

  const plus = async (s) => {
    let slot = null;
    if (wd >= 0) {
      const taken = new Set(abs.filter((a) => a.date === tk).map((a) => a.slot));
      const free = WEEK[wd].map((x, i) => (x === s ? i + 1 : 0)).filter((n) => n && !taken.has(n));
      slot = free.filter((n) => SLOTS[n - 1].s <= min).pop() ?? free[0] ?? null;
    }
    const before = abs, after = await run((t) => api.add(t, [{ mod: s, date: tk, slot, tag: 'I' }]));
    if (after) { const ids = added(before, after); showToast(`+1 h en ${s}`, ids.length ? () => call((t) => api.del(t, ids)) : null); }
  };
  const minus = async (s) => {
    const l = abs.filter((a) => a.mod === s); if (!l.length) return;
    const last = l.reduce((m, a) => (a.id > m.id ? a : m));
    if (await run((t) => api.del(t, [last.id]))) showToast(`−1 h en ${s}`, () => call((t) => api.add(t, [strip(last)])));
  };
  const remove = async (a) => {
    if (await run((t) => api.del(t, [a.id]))) showToast('Falta borrada', () => call((t) => api.add(t, [strip(a)])));
  };
  const toggleTag = (a) => call((t) => api.setTag(t, a.id, a.tag === 'J' ? 'I' : 'J'));
  const saveSheet = async () => {
    const d = wdIdx(parse(sheet.date)); if (!sheet.sel.length || d < 0) return;
    const items = [...sheet.sel].sort((a, b) => a - b).map((n) => ({ mod: WEEK[d][n - 1], date: sheet.date, slot: n, tag: sheet.tag }));
    const before = abs, after = await run((t) => api.add(t, items));
    if (after) {
      const ids = added(before, after); setSheet(null);
      showToast(`${ids.length} ${ids.length === 1 ? 'hora apuntada' : 'horas apuntadas'}`, ids.length ? () => call((t) => api.del(t, ids)) : null);
    }
  };

  const stat = (s) => {
    const m = MODS[s], n = abs.filter((a) => a.mod === s).length, pct = n / m.max, left = Math.max(0, m.max - n), lost = n > m.max;
    const st = lost ? 'lost' : pct > 0.8 ? 'bad' : pct >= 0.5 ? 'warn' : 'ok', x = ST[st];
    return {
      s, m, n, pct, left, lost, st, label: x[0], sc: x[1], soft: x[2], over: n - m.max,
      barW: Math.min(100, pct * 100) + '%', hWord: left === 1 ? 'hora' : 'horas', leftWord: lost ? 'perdida' : left === 1 ? 'hora' : 'horas',
    };
  };
  const cards = ORDER.map(stat).sort((a, b) => b.pct - a.pct || a.left - b.left);
  const alerts = cards.filter((c) => c.st !== 'ok');
  const redCount = alerts.filter((a) => a.st !== 'warn').length;
  const first = user.name.split(' ')[0];
  const openSheet = () => setSheet({ date: tk, sel: [], tag: 'I' });
  const title = detail ? detail : TABS.find(([id]) => id === tab)[1];
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const p = { abs, now, wd, min, tk, wide, stat, openDetail, cards };
  return (
    <div className="shell">
      {wide && (
        <aside className="aside">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 8px 6px' }}>
            <Logo size={40} radius={13} font={22} />
            <div className="col">
              <span className="disp" style={{ fontSize: 19, lineHeight: 1.1 }}>Margen</span>
              <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>2º MyP A · Aula 221</span>
            </div>
          </div>
          <div style={{ height: 18 }} />
          {TABS.map(([id, label]) => (
            <button key={id} className="side-btn" aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}
              style={{ background: tab === id ? 'var(--surface2)' : 'transparent', color: tab === id ? INK : 'var(--muted)' }}>
              <Icon name={id} size={20} /><span>{label}</span>
              {id === 'faltas' && redCount > 0 && <span className="badge" aria-label={`${redCount} en rojo`}>{redCount}</span>}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="btn-main" onClick={openSheet}><span>Apuntar faltas</span><span className="go"><Icon name="plus" size={20} /></span></button>
          <button className="side-btn" style={{ background: 'transparent', color: 'var(--muted)', marginTop: 6 }} onClick={toggleTheme}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
        </aside>
      )}

      <main style={{ padding: wide ? '32px 44px 64px' : '12px 18px 130px' }}>
        <div className="wrap">
          <div className="topbar">
            {detail
              ? <button className="round" aria-label="Volver a mis faltas" onClick={() => setDetail(null)}><Icon name="back" size={20} /></button>
              : <button className="avatar" aria-label="Perfil" onClick={() => go('perfil')}>{(first[0] || '?').toUpperCase()}</button>}
            <h1>{title}</h1>
            <button className="round" aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} onClick={toggleTheme}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} /></button>
          </div>
          {tab === 'hoy' && <Hoy {...p} first={first} alerts={alerts} goFaltas={() => go('faltas')} />}
          {tab === 'horario' && <Horario {...p} day={day} setDay={setDay} />}
          {tab === 'faltas' && !detail && <Faltas {...p} plus={plus} minus={minus} busy={busy} />}
          {tab === 'faltas' && detail && <Detalle st={stat(detail)} abs={abs} tk={tk} w={w} plus={plus} minus={minus} remove={remove} toggleTag={toggleTag} busy={busy} />}
          {tab === 'perfil' && <Perfil user={user} theme={theme} setTheme={setTheme} logout={logout} />}
        </div>
      </main>

      {!wide && (
        <div className="dock">
          <nav className="tabbar" aria-label="Secciones">
            {TABS.map(([id, label]) => (
              <button key={id} aria-current={tab === id ? 'page' : undefined} aria-label={label} onClick={() => go(id)}>
                <Icon name={id} size={21} />{tab === id && <span>{label}</span>}
                {id === 'faltas' && redCount > 0 && <span className="badge" aria-label={`${redCount} en rojo`}>{redCount}</span>}
              </button>
            ))}
          </nav>
          <button className="add" aria-label="Apuntar faltas" onClick={openSheet}><Icon name="plus" size={26} stroke={2} /></button>
        </div>
      )}
      {sheet && <Sheet sheet={sheet} setSheet={setSheet} abs={abs} tk={tk} wide={wide} save={saveSheet} busy={busy} />}
    </div>
  );
}

// ── Línea de tiempo de un día ────────────────────────────────────────────

function rowsFor(d, dk, isToday, min, abs) {
  if (d < 0) return [];
  const r = [];
  WEEK[d].forEach((s, i) => {
    const sl = SLOTS[i], m = MODS[s], isNow = isToday && min >= sl.s && min < sl.e, past = isToday && min >= sl.e;
    r.push({ k: i, s, sl, m, isNow, past, missed: abs.some((a) => a.date === dk && a.slot === i + 1) });
    if (i === BREAK.after) r.push({ k: 'r', isBreak: true, now: isToday && min >= BREAK.s && min < BREAK.e });
  });
  return r;
}

function Timeline({ rows, openDetail, full }) {
  return (
    <div className="tl">
      {rows.map((r) => r.isBreak ? (
        <div key={r.k} className="tl-break">
          <span className="num" style={{ paddingLeft: 2 }}>{BREAK.a}</span>
          <span className="tl-rail" style={{ height: 30 }} />
          <span className="stripes" style={{ height: 26, borderRadius: 999 }}>Recreo{r.now ? ' · ahora' : ''}</span>
        </div>
      ) : (
        <div key={r.k} className="tl-row" style={{ opacity: r.past ? 0.55 : 1 }}>
          <div className="tl-time"><span>{r.sl.a}</span><small>{r.sl.b}</small></div>
          <div className="tl-rail"><span className="tl-dot" style={{ background: r.m.c, width: r.isNow ? 14 : 10, height: r.isNow ? 14 : 10, marginTop: r.isNow ? 17 : 19 }} /></div>
          <button className="tl-card" onClick={openDetail(r.s)} style={{ boxShadow: r.isNow ? RING : 'none', background: r.isNow ? tint(r.m.c, 30) : undefined }}>
            <Chip s={r.s} size={40} />
            <span className="col" style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>{r.m.short}</span>
              <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>{full ? r.m.prof : r.m.ps}</span>
            </span>
            {r.isNow && <span className="tag" style={{ background: 'var(--accent)', color: 'var(--onAccent)' }}>Ahora</span>}
            {r.missed && <span className="tag" style={{ background: 'var(--badSoft)', color: 'var(--badText)' }}>Falta</span>}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Hoy ──────────────────────────────────────────────────────────────────

function nextClasses(now, wd, min) {
  // Devuelve la clase destacada (ahora o la siguiente) y la que viene después
  const list = [];
  for (let k = 0; k <= 7 && list.length < 2; k++) {
    const d = new Date(now); d.setDate(d.getDate() + k); const w = wdIdx(d);
    if (w < 0) continue;
    SLOTS.forEach((sl, i) => {
      if (list.length >= 2) return;
      if (k === 0 && sl.e <= min) return;
      const isNow = k === 0 && min >= sl.s && min < sl.e;
      list.push({ d: w, i, k, isNow, s: WEEK[w][i], sl, when: k === 0 ? (isNow ? 'Ahora' : 'Hoy') : k === 1 ? 'Mañana' : DAYS[w] });
    });
  }
  return list;
}

function Hoy({ abs, now, wd, min, tk, wide, stat, openDetail, cards, first, alerts, goFaltas }) {
  const [a, b] = nextClasses(now, wd, min);
  const rows = rowsFor(wd, tk, true, min, abs);
  const am = MODS[a.s], ast = stat(a.s);
  const hint = a.isNow ? `Quedan ${a.sl.e - min} min` : a.k === 0 ? `Empieza en ${(() => { const d = a.sl.s - min; return d >= 60 ? Math.floor(d / 60) + ' h ' + (d % 60) + ' min' : d + ' min'; })()}` : 'Primera clase';

  return (
    <div className="col" style={{ gap: 24 }}>
      <div className="col" style={{ gap: 2 }}>
        <span className="eyebrow">{WDL[now.getDay()]}, {now.getDate()} de {MONTHS[now.getMonth()]}</span>
        <span className="disp" style={{ fontSize: 28 }}>Hola, {first}</span>
      </div>

      {/* Destacada + siguiente, como «My Project» de la referencia */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 10 }}>
        <button onClick={openDetail(a.s)} className="panel" style={{ textAlign: 'left', cursor: 'pointer', color: INK, padding: 16, minHeight: 196, display: 'flex', flexDirection: 'column', gap: 10, background: tint(am.c, 55) }}>
          <span className="muted num" style={{ fontSize: 13, fontWeight: 500 }}>{a.when} · {a.sl.a}–{a.sl.b}</span>
          <span className="col" style={{ gap: 2 }}>
            <span className="disp" style={{ fontSize: 34, lineHeight: 1 }}>{a.s}</span>
            <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.25 }}>{am.short}</span>
          </span>
          {a.isNow && <span style={{ height: 4, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: Math.round(((min - a.sl.s) / 60) * 100) + '%', background: 'var(--accent)' }} /></span>}
          <span style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span className="col" style={{ gap: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{hint}</span>
              <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>{ast.lost ? 'Evaluación perdida' : `${ast.left} h libres`}</span>
            </span>
            <span className="round accent" style={{ width: 38, height: 38 }}><Icon name="diag" size={18} /></span>
          </span>
        </button>
        {b && (
          <button onClick={openDetail(b.s)} className="panel" style={{ textAlign: 'left', cursor: 'pointer', color: INK, padding: 14, minHeight: 196, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
            <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>Después</span>
            <Chip s={b.s} size={52} />
            <span className="col" style={{ gap: 1, marginTop: 'auto' }}>
              <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>{MODS[b.s].short}</span>
              <span className="muted num" style={{ fontSize: 12, fontWeight: 500 }}>{b.when === 'Hoy' || b.when === 'Ahora' ? '' : b.when + ' · '}{b.sl.a}</span>
            </span>
          </button>
        )}
      </div>

      {/* Tus módulos: fila deslizable, como «My Spaces» */}
      <section className="col" style={{ gap: 10 }}>
        <div className="sec"><h2>Tus módulos</h2><button onClick={goFaltas}>Ver todo</button></div>
        <div className="hscroll">
          {cards.map((c) => (
            <button key={c.s} className="tilebtn panel" onClick={openDetail(c.s)} aria-label={`${c.s}: ${c.lost ? 'evaluación perdida' : c.left + ' horas libres'}`}>
              <Gauge p={c.pct} color={c.sc} size={56} stroke={5}>
                <span className="tile" style={{ width: 38, height: 38, borderRadius: 999, background: c.m.c, color: c.m.fg, fontSize: 11 }}>{c.s}</span>
              </Gauge>
              <span className="col" style={{ alignItems: 'center', gap: 0 }}>
                <span className="disp num" style={{ fontSize: 17 }}>{c.lost ? '—' : `${c.left} h`}</span>
                <span className="muted" style={{ fontSize: 11, fontWeight: 500 }}>{c.lost ? 'perdida' : 'libres'}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: wide ? 'minmax(0,1.3fr) minmax(0,1fr)' : 'minmax(0,1fr)', gap: 24, alignItems: 'start' }}>
        <section className="col" style={{ gap: 6 }}>
          <div className="sec"><h2>Hoy en clase</h2><span className="muted" style={{ fontSize: 13 }}>{rows.length ? 'Aula 221' : ''}</span></div>
          {!rows.length && <div className="panel soft-box">Hoy no hay clase. Disfruta del día.</div>}
          <Timeline rows={rows} openDetail={openDetail} />
        </section>

        {/* Atención: rejilla de 2, como «Smart Automations» */}
        {alerts.length > 0 && (
          <section className="col" style={{ gap: 10 }}>
            <div className="sec"><h2>Atención</h2><button onClick={goFaltas}>Ver todo</button></div>
            <div className="grid2">
              {alerts.map((c) => (
                <button key={c.s} className="panel" onClick={openDetail(c.s)} style={{ textAlign: 'left', cursor: 'pointer', color: INK, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Chip s={c.s} size={36} />
                    <span className="status" style={{ '--dot': c.sc, padding: '4px 9px 4px 7px', fontSize: 11 }}>{c.label}</span>
                  </span>
                  <span className="col">
                    <span className="disp num" style={{ fontSize: 26, lineHeight: 1.05 }}>{c.lost ? 'Perdida' : `${c.left} h`}</span>
                    <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>{c.lost ? `${c.over} h de más` : 'te quedan'}</span>
                  </span>
                  <span className="bar" style={{ height: 6 }}><span style={{ display: 'block', height: '100%', width: c.barW, background: c.sc, borderRadius: 99 }} /></span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ── Horario ──────────────────────────────────────────────────────────────

function Horario({ abs, now, wd, min, wide, day, setDay, openDetail }) {
  const monday = new Date(now);
  monday.setDate(now.getDate() - (wd >= 0 ? wd : now.getDay() === 6 ? -2 : -1));
  const sel = day ?? (wd >= 0 ? wd : 0);
  const selDate = new Date(monday); selDate.setDate(monday.getDate() + sel);
  const tx = useRef(0);
  const colBg = (d) => (d === wd ? 'var(--todayCol)' : 'transparent');
  const rows = rowsFor(sel, key(selDate), sel === wd, min, abs);

  return (
    <div className="col" style={{ gap: 18 }}>
      {!wide && (
        <>
          <div className="chips" role="tablist" aria-label="Día">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map((l, i) => {
              const d = new Date(monday); d.setDate(monday.getDate() + i);
              return (
                <button key={l} role="tab" className="chip" aria-selected={i === sel} onClick={() => setDay(i)}
                  style={i === sel ? { background: 'var(--accent)', color: 'var(--onAccent)' } : undefined}>
                  {l} {d.getDate()}{i === wd ? ' · hoy' : ''}
                </button>
              );
            })}
          </div>
          <div className="panel" style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="col" style={{ gap: 1 }}>
              <span className="disp" style={{ fontSize: 20 }}>{DAYS[sel]} {selDate.getDate()}</span>
              <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>6 clases · 8:10 – 14:40 · Aula 221</span>
            </span>
            <span style={{ display: 'flex', gap: 6 }}>
              <button className="round" aria-label="Día anterior" disabled={sel === 0} onClick={() => setDay(Math.max(0, sel - 1))} style={{ opacity: sel === 0 ? 0.4 : 1 }}><Icon name="back" size={18} /></button>
              <button className="round" aria-label="Día siguiente" disabled={sel === 4} onClick={() => setDay(Math.min(4, sel + 1))} style={{ opacity: sel === 4 ? 0.4 : 1 }}><Icon name="next" size={18} /></button>
            </span>
          </div>
          <div style={{ touchAction: 'pan-y' }}
            onTouchStart={(e) => { tx.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - tx.current; if (Math.abs(dx) < 50) return; setDay(Math.max(0, Math.min(4, sel + (dx < 0 ? 1 : -1)))); }}>
            <Timeline rows={rows} openDetail={openDetail} full />
          </div>
        </>
      )}

      {wide && (
        <div style={{ display: 'grid', gridTemplateColumns: '72px repeat(5,minmax(0,1fr))' }}>
          <div />
          {DAYS.map((n, d) => (
            <div key={n} style={{ background: colBg(d), borderRadius: '18px 18px 0 0', padding: '10px 5px 8px', display: 'flex', justifyContent: 'center' }}>
              <span style={{ ...pick(d === wd), borderRadius: 999, padding: '7px 14px', fontWeight: 600, fontSize: 14 }}>{d === wd ? n + ' · hoy' : n}</span>
            </div>
          ))}
          {SLOTS.map((sl, i) => (
            <Fragment key={i}>
              <div className="time" style={{ width: 'auto', padding: '12px 8px 0 0', fontSize: 15 }}><span>{sl.a}</span><small style={{ fontSize: 12 }}>{sl.b}</small></div>
              {[0, 1, 2, 3, 4].map((d) => {
                const s = WEEK[d][i], m = MODS[s], isNow = d === wd && min >= sl.s && min < sl.e;
                return (
                  <div key={d} style={{ background: colBg(d), padding: 5, borderRadius: i === 5 ? '0 0 18px 18px' : 0 }}>
                    <button onClick={openDetail(s)} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: tint(m.c), border: '1px solid var(--line)', color: INK, borderRadius: 16, padding: '11px 12px', minHeight: 104, height: '100%', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: isNow ? RING : 'none' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Dot c={m.c} s={9} /><span className="disp" style={{ fontSize: 18, lineHeight: 1 }}>{s}</span>{isNow && <span className="tag" style={{ marginLeft: 'auto', background: 'var(--accent)', color: 'var(--onAccent)', fontSize: 10, padding: '3px 7px' }}>Ahora</span>}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.2 }}>{m.short}</span>
                      <span className="muted" style={{ fontSize: 12, fontWeight: 500, marginTop: 'auto', lineHeight: 1.25 }}>{m.prof}</span>
                    </button>
                  </div>
                );
              })}
              {i === BREAK.after && (
                <>
                  <div className="time" style={{ width: 'auto', padding: '8px 8px 0 0', fontSize: 15 }}><span>{BREAK.a}</span><small style={{ fontSize: 12 }}>{BREAK.b}</small></div>
                  {[0, 1, 2, 3, 4].map((d) => (
                    <div key={d} style={{ background: colBg(d), padding: 5 }}>
                      <div className="stripes" style={{ height: 30, borderRadius: 999 }}>{d === wd && min >= BREAK.s && min < BREAK.e ? 'Recreo · ahora' : 'Recreo'}</div>
                    </div>
                  ))}
                </>
              )}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mis faltas ───────────────────────────────────────────────────────────

function Faltas({ cards, abs, now, wide, openDetail, plus, minus, busy }) {
  const [filter, setFilter] = useState('todos');
  const used = cards.reduce((m, c) => m + c.n, 0), max = cards.reduce((m, c) => m + c.m.max, 0);
  const free = cards.reduce((m, c) => m + c.left, 0), risky = cards.filter((c) => c.st !== 'ok').length;
  const worst = cards[0];
  const shown = cards.filter((c) => filter === 'todos' || (filter === 'riesgo' ? c.st !== 'ok' : c.st === 'ok'));

  return (
    <div className="col" style={{ gap: 22 }}>
      {/* Panel principal con anillo y tres cifras, como el «LTV» de la referencia */}
      <section className="panel" style={{ padding: '22px 18px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, background: tint(worst.sc, 18) }}>
        <Gauge p={used / max} color="var(--accent)" size={196} stroke={14} label={`Has gastado el ${Math.round((used / max) * 100)} % de tu margen total`}>
          <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>Margen usado</span>
          <span className="disp num" style={{ fontSize: 46, lineHeight: 1.05 }}>{Math.round((used / max) * 100)} %</span>
          <span className="muted num" style={{ fontSize: 13, fontWeight: 500 }}>{used} de {max} h</span>
        </Gauge>
        <div className="stat3" style={{ width: '100%', textAlign: 'center' }}>
          <div><small>Gastadas</small><b>{used} h</b></div>
          <div><small>Libres</small><b>{free} h</b></div>
          <div><small>En riesgo</small><b style={{ color: risky ? 'var(--warn)' : undefined }}>{risky}</b></div>
        </div>
      </section>

      <section className="col" style={{ gap: 12 }}>
        <div className="chips" role="group" aria-label="Filtrar módulos">
          {[['todos', 'Todos'], ['riesgo', `En riesgo · ${risky}`], ['bien', `Vas bien · ${cards.length - risky}`]].map(([id, l]) => (
            <button key={id} className="chip" aria-pressed={filter === id} onClick={() => setFilter(id)}>{l}</button>
          ))}
        </div>
        {!shown.length && <div className="panel soft-box">Ningún módulo en esta categoría.</div>}
        <div className="grid2">
          {shown.map((c) => (
            <div key={c.s} className="panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, borderColor: c.lost || c.st === 'bad' ? 'color-mix(in oklab, var(--bad) 55%, transparent)' : undefined }}>
              <button onClick={openDetail(c.s)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }} aria-label={`Ver historial de ${c.m.name}`}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <Chip s={c.s} size={38} />
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}><Dot c={c.sc} />{c.label}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Gauge p={c.pct} color={c.sc} size={58} stroke={6}>
                    <span className="num" style={{ fontSize: 13, fontWeight: 600 }}>{Math.min(999, Math.round(c.pct * 100))}%</span>
                  </Gauge>
                  <span className="col" style={{ minWidth: 0 }}>
                    <span className="disp num" style={{ fontSize: 24, lineHeight: 1.05 }}>{c.lost ? '0 h' : `${c.left} h`}</span>
                    <span className="muted num" style={{ fontSize: 12, fontWeight: 500 }}>{c.lost ? 'perdida' : 'libres'} · {c.n}/{c.m.max}</span>
                  </span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.25, minHeight: 32 }}>{c.m.short}</span>
              </button>
              <span style={{ display: 'flex', gap: 8 }}>
                <button className="round" aria-label={`Quitar la última falta de ${c.s}`} disabled={!c.n || busy} onClick={() => minus(c.s)} style={{ opacity: !c.n ? 0.4 : 1 }}><Icon name="minus" size={20} /></button>
                <button className="round accent" aria-label={`Sumar una falta hoy en ${c.s}`} disabled={busy} onClick={() => plus(c.s)}><Icon name="plus" size={20} /></button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="col" style={{ gap: 12 }}>
        <div className="sec"><h2>Análisis</h2></div>
        <Resumen cards={cards} abs={abs} now={now} wide={wide} />
      </section>
    </div>
  );
}

// ── Detalle de un módulo ─────────────────────────────────────────────────

function Detalle({ st, abs, w, plus, minus, remove, toggleTag, busy }) {
  const [filter, setFilter] = useState('todas');
  const all = abs.filter((a) => a.mod === st.s).sort((a, b) => b.date.localeCompare(a.date) || (b.slot || 0) - (a.slot || 0));
  const j = all.filter((a) => a.tag === 'J').length, i = all.length - j;
  const list = all.filter((a) => filter === 'todas' || (filter === 'J' ? a.tag === 'J' : a.tag !== 'J'));
  const wideD = w >= 1100;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: wideD ? 'minmax(0,0.9fr) minmax(0,1.2fr)' : 'minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
      <div className="col" style={{ gap: 14 }}>
        <section className="panel" style={{ padding: '22px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, background: tint(st.m.c, 45) }}>
          <Gauge p={st.pct} color={st.sc} size={176} stroke={13} label={`${st.n} de ${st.m.max} horas gastadas`}>
            <span className="disp num" style={{ fontSize: 52, lineHeight: 1 }}>{st.lost ? 0 : st.left}</span>
            <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>{st.lost ? 'evaluación perdida' : `${st.hWord} libres`}</span>
          </Gauge>
          <span className="col" style={{ alignItems: 'center', gap: 2, textAlign: 'center' }}>
            <span style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.25, textWrap: 'balance' }}>{st.m.name}</span>
            <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>{st.m.prof}</span>
          </span>
          <span className="status" style={{ '--dot': st.sc }}>{st.label}</span>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button className="btn-main center" style={{ background: 'var(--surface2)', color: INK, height: 52 }} disabled={!st.n || busy} onClick={() => minus(st.s)}><Icon name="minus" size={18} />Quitar una</button>
          <button className="btn-main center" style={{ height: 52 }} disabled={busy} onClick={() => plus(st.s)}><Icon name="plus" size={18} />Falta hoy</button>
        </div>

        {/* Como el «Schedule From / Until» de la referencia */}
        <section className="panel" style={{ padding: 16 }}>
          <div className="stat3" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
            <div style={{ paddingLeft: 0 }}><small>Primera falta</small><b style={{ fontSize: 18 }}>{all.length ? shortDate(all[all.length - 1].date) : '—'}</b></div>
            <div style={{ paddingLeft: 14 }}><small>Última falta</small><b style={{ fontSize: 18 }}>{all.length ? shortDate(all[0].date) : '—'}</b></div>
          </div>
          <div style={{ height: 1, background: 'var(--line)', margin: '14px 0' }} />
          <div className="stat3">
            <div style={{ paddingLeft: 0 }}><small>Gastadas</small><b style={{ fontSize: 18 }}>{st.n}/{st.m.max} h</b></div>
            <div><small>Injustif.</small><b style={{ fontSize: 18 }}>{i}</b></div>
            <div><small>Justif.</small><b style={{ fontSize: 18 }}>{j}</b></div>
          </div>
        </section>
      </div>

      <section className="col" style={{ gap: 12, minWidth: 0 }}>
        <div className="sec"><h2>Historial</h2><span className="muted" style={{ fontSize: 13 }}>{all.length} {all.length === 1 ? 'falta' : 'faltas'}</span></div>
        <div className="chips" role="group" aria-label="Filtrar historial">
          {[['todas', 'Todas'], ['I', `Injustificadas · ${i}`], ['J', `Justificadas · ${j}`]].map(([id, l]) => (
            <button key={id} className="chip" aria-pressed={filter === id} onClick={() => setFilter(id)}>{l}</button>
          ))}
        </div>
        {!all.length && <div className="panel soft-box" style={{ background: 'var(--okSoft)' }}>Ninguna falta en este módulo. Así se hace.</div>}
        <div className="panel" style={{ padding: '4px 0', display: list.length ? 'block' : 'none' }}>
          {list.map((a, n) => {
            const d = parse(a.date), J = a.tag === 'J';
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px 10px 14px', borderTop: n ? '1px solid var(--line)' : 0 }}>
                <span className="col" style={{ width: 44, flex: 'none', alignItems: 'center' }}>
                  <span className="disp num" style={{ fontSize: 22, lineHeight: 1 }}>{d.getDate()}</span>
                  <span className="muted" style={{ fontSize: 11, fontWeight: 500 }}>{WD[d.getDay()]} {MONTHS[d.getMonth()].slice(0, 3)}</span>
                </span>
                <span className="col" style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap' }}>{a.slot ? `${a.slot}ª hora` : 'Sin hora'}</span>
                  <span className="muted num" style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>{a.slot ? `${SLOTS[a.slot - 1].a}–${SLOTS[a.slot - 1].b}` : 'asignada'}</span>
                </span>
                <button onClick={() => toggleTag(a)} aria-label={`${J ? 'Justificada' : 'Injustificada'}. Toca para cambiar`} className="chip" aria-pressed={J}
                  style={{ height: 36, padding: '0 12px', fontSize: 13, ...(J ? { background: 'var(--okSoft)', color: INK, borderColor: 'transparent' } : {}) }}>
                  {J ? 'Justificada' : 'Injustificada'}
                </button>
                <button className="del-btn" aria-label="Borrar falta" disabled={busy} onClick={() => remove(a)}><Icon name="close" size={16} /></button>
              </div>
            );
          })}
        </div>
        {all.length > 0 && <p className="muted" style={{ margin: 0, fontSize: 13, fontWeight: 500, textWrap: 'pretty' }}>Toca la etiqueta para cambiarla. Las justificadas cuentan igual para el límite.</p>}
      </section>
    </div>
  );
}

// ── Perfil ───────────────────────────────────────────────────────────────

function Perfil({ user, theme, setTheme, logout }) {
  const first = user.name.split(' ')[0];
  const Row = ({ label, children, last }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: last ? 0 : '1px solid var(--line)', fontSize: 15 }}>
      <span style={{ fontWeight: 500 }}>{label}</span>{children}
    </div>
  );
  return (
    <div className="col" style={{ gap: 18, maxWidth: 560, width: '100%', margin: '0 auto' }}>
      <section className="col" style={{ alignItems: 'center', gap: 10, padding: '8px 0 4px' }}>
        <span className="avatar" style={{ width: 88, height: 88, fontSize: 36, cursor: 'default' }}>{(first[0] || '?').toUpperCase()}</span>
        <span className="col" style={{ alignItems: 'center', gap: 2 }}>
          <span className="disp" style={{ fontSize: 22 }}>{user.name}</span>
          <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>@{user.user} · 2º MyP A</span>
        </span>
      </section>
      <section className="panel" style={{ padding: '2px 16px' }}>
        <Row label="Tema">
          <span className="seg" style={{ gridTemplateColumns: 'auto auto' }}>
            {[['light', 'Claro'], ['dark', 'Oscuro']].map(([t, l]) => (
              <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)} style={{ height: 36, padding: '0 14px', ...pick(theme === t) }}>{l}</button>
            ))}
          </span>
        </Row>
        <Row label="Centro"><span className="muted" style={{ textAlign: 'right' }}>IES Las Salinas</span></Row>
        <Row label="Aula"><span className="muted">221</span></Row>
        <Row label="Tutora" last><span className="muted" style={{ textAlign: 'right' }}>Natalia Salcedo López</span></Row>
      </section>
      <button onClick={logout} className="panel" style={{ height: 54, color: 'var(--badText)', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Cerrar sesión</button>
    </div>
  );
}

// ── Hoja para apuntar faltas ─────────────────────────────────────────────

function Sheet({ sheet, setSheet, abs, tk, wide, save, busy }) {
  const d = parse(sheet.date), w = wdIdx(d);
  const taken = new Set(abs.filter((a) => a.date === sheet.date).map((a) => a.slot));
  const avail = w < 0 ? [] : WEEK[w].map((s, i) => i + 1).filter((n) => !taken.has(n));
  const all = avail.length > 0 && avail.every((n) => sheet.sel.includes(n));
  const upd = (p) => setSheet((s) => ({ ...s, ...p }));
  const close = () => setSheet(null);
  useEffect(() => { const f = (e) => e.key === 'Escape' && close(); window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, []);
  const n = sheet.sel.length;

  return (
    <div className="overlay" onClick={close} style={{ alignItems: wide ? 'center' : 'flex-end' }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Apuntar faltas" onClick={(e) => e.stopPropagation()} style={{ borderRadius: wide ? 28 : '28px 28px 0 0' }}>
        {!wide && <span aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 99, background: 'var(--line)', justifySelf: 'center', marginTop: -8 }} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="h2">Apuntar faltas</h2>
          <button className="round" aria-label="Cerrar" onClick={close}><Icon name="close" size={18} /></button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" aria-label="Fecha" value={sheet.date} onChange={(e) => e.target.value && upd({ date: e.target.value, sel: [] })}
            style={{ flex: 1, minWidth: 0, height: 50, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--surface)', color: INK, padding: '0 18px', fontSize: 16, fontWeight: 500, outline: 'none' }} />
          <button className="chip" aria-pressed={sheet.date === tk} onClick={() => upd({ date: tk, sel: [] })} style={{ height: 50 }}>Hoy</button>
        </div>
        <div className="muted" style={{ fontSize: 15, fontWeight: 500 }}>{WDL[d.getDay()]}, {d.getDate()} de {MONTHS[d.getMonth()]}</div>
        {w < 0 && <div className="panel soft-box">Ese día no hay clase.</div>}
        {w >= 0 && (
          <>
            <button className="chip" aria-pressed={all} onClick={() => upd({ sel: all ? [] : avail })} disabled={!avail.length} style={{ height: 46, justifySelf: 'start', display: 'flex', alignItems: 'center', gap: 8, opacity: avail.length ? 1 : 0.5 }}>
              {all && <Icon name="check" size={16} stroke={2.2} />}Todo el día
            </button>
            <div className="panel" style={{ padding: '2px 0' }}>
              {WEEK[w].map((s, i) => {
                const k = i + 1, t = taken.has(k), on = sheet.sel.includes(k), m = MODS[s];
                return (
                  <button key={k} role="checkbox" aria-checked={on || t} aria-disabled={t} onClick={() => { if (!t) upd({ sel: on ? sheet.sel.filter((x) => x !== k) : [...sheet.sel, k] }); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, border: 0, borderTop: i ? '1px solid var(--line)' : 0, background: 'transparent', color: INK, padding: '8px 14px', textAlign: 'left', cursor: t ? 'default' : 'pointer', opacity: t ? 0.5 : 1 }}>
                    <span className="num" style={{ width: 42, flex: 'none', fontWeight: 600, fontSize: 14 }}>{SLOTS[i].a}</span>
                    <Chip s={s} size={36} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500, lineHeight: 1.2 }}>{m.short}</span>
                    {t ? <span className="muted" style={{ fontSize: 12 }}>Ya apuntada</span>
                      : <span className="box" style={{ borderRadius: 999, background: on ? 'var(--accent)' : 'transparent', borderColor: on ? 'var(--accent)' : undefined }}>{on && <Icon name="check" size={15} stroke={2.4} />}</span>}
                  </button>
                );
              })}
            </div>
            <div className="seg" role="radiogroup" aria-label="Etiqueta">
              {[['I', 'Injustificada'], ['J', 'Justificada']].map(([v, l]) => (
                <button key={v} role="radio" aria-checked={sheet.tag === v} onClick={() => upd({ tag: v })} style={pick(sheet.tag === v)}>{l}</button>
              ))}
            </div>
            <button className="btn-main center" disabled={!n || busy} onClick={save}>
              {busy ? 'Guardando…' : n ? `Guardar ${n} ${n === 1 ? 'hora' : 'horas'}` : 'Marca las horas'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
