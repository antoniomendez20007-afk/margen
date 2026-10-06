import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { api, isLocal, token, cache, ApiError } from './api.js';
import Resumen from './Charts.jsx';
import { SLOTS, BREAK, WEEK, MODS, ORDER, DAYS, MONTHS, WD, WDL, key, parse, wdIdx } from './data.js';

const BG = 'var(--bg)', INK = 'var(--ink)';
const ST = {
  ok: ['Vas bien', 'var(--ok)', 'var(--okSoft)'],
  warn: ['Cuidado', 'var(--warn)', 'var(--warnSoft)'],
  bad: ['Al límite', 'var(--bad)', 'var(--badSoft)'],
  lost: ['Perdida', 'var(--bad)', 'var(--badSoft)'],
};
const RING = '0 0 0 3px var(--bg), 0 0 0 6px var(--ink)';
const inv = (on) => ({ background: on ? INK : 'transparent', color: on ? BG : INK });
const minOf = (d) => d.getHours() * 60 + d.getMinutes();

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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0D0D10' : '#F3F2EE');
  }, [theme]);
  const setTheme = (t) => { setT(t); try { localStorage.setItem('margen_theme', t); } catch { /* nada */ } };
  return [theme, setTheme];
}

const Logo = ({ size = 44, radius = 14, font = 26, children = 'm' }) => (
  <div className="logo" aria-hidden="true" style={{ width: size, height: size, borderRadius: radius, fontSize: font }}>{children}</div>
);

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
        <span className="muted" style={{ fontSize: 15, fontWeight: 700, visibility: slow ? 'visible' : 'hidden' }}>Conectando con el servidor…</span>
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
    <div className="toast" role="status" style={{ bottom: wide || !app ? 28 : 170 }}>
      <span>{toast.msg}</span>
      {toast.undo && <button onClick={() => { toast.undo(); close(); }}>Deshacer</button>}
    </div>
  );
}

// ── Acceso ───────────────────────────────────────────────────────────────

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
      <form className="auth-box" onSubmit={submit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo />
          <div className="disp" style={{ fontSize: 24, letterSpacing: '-0.02em' }}>Margen</div>
        </div>
        <div className="col" style={{ gap: 10 }}>
          <h1 className="h1" style={{ fontSize: 44, textWrap: 'balance' }}>Tu horario y tus faltas, sin sustos.</h1>
          <p style={{ margin: 0, fontSize: 17 }} className="muted">2º Marketing y Publicidad A · IES Las Salinas</p>
        </div>
        <div className="col" style={{ gap: 16 }}>
          <label className="field">Usuario
            <input value={u} onChange={(e) => { setU(e.target.value); setErr(''); }} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="tu usuario" />
          </label>
          <label className="field">Contraseña
            <input type="password" value={p} onChange={(e) => { setP(e.target.value); setErr(''); }} autoComplete="current-password" placeholder="••••" />
          </label>
          <button type="button" className="check" role="checkbox" aria-checked={remember} onClick={() => setRemember(!remember)}>
            <span className="box" style={{ background: remember ? INK : 'transparent' }}>{remember ? '✓' : ''}</span>
            Recordarme
          </button>
          {err && <div className="err" role="alert">{err}</div>}
          <button className="btn-main" disabled={busy} style={{ marginTop: 4 }}>{busy ? 'Entrando…' : 'Entrar'}</button>
        </div>
        <div className="col" style={{ gap: 14 }}>
          <p style={{ margin: 0, fontSize: 16 }}>¿Aún no tienes cuenta? <a href="#" onClick={(e) => { e.preventDefault(); goRegister(); }} style={{ fontWeight: 800 }}>Crear cuenta</a></p>
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
      <form className="auth-box" style={{ gap: 28 }} onSubmit={submit}>
        <button type="button" className="back" onClick={goLogin}>← Volver</button>
        <div className="col" style={{ gap: 10 }}>
          <h1 className="h1" style={{ fontSize: 42 }}>Crear cuenta</h1>
          <p style={{ margin: 0, fontSize: 17, textWrap: 'pretty' }} className="muted">Solo para la clase de 2º MyP A. Necesitas el código de clase.</p>
        </div>
        <div className="col" style={{ gap: 16 }}>
          <label className="field">Nombre<input value={f.n} onChange={set('n')} autoComplete="name" placeholder="Nombre y apellido" maxLength={60} /></label>
          <label className="field">Usuario<input value={f.u} onChange={set('u')} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="sin espacios" maxLength={30} /></label>
          <label className="field">Contraseña<input type="password" value={f.p} onChange={set('p')} autoComplete="new-password" placeholder="mínimo 4 caracteres" /></label>
          <label className="field">Código de clase<input className="code" value={f.c} onChange={set('c')} autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="Te lo pasan en clase" /></label>
          {err && <div className="err" role="alert">{err}</div>}
          <button className="btn-main" disabled={busy} style={{ marginTop: 4 }}>{busy ? 'Creando…' : 'Crear cuenta'}</button>
        </div>
        {isLocal && <p className="mono">Modo de prueba · código SALINAS2A</p>}
      </form>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────

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
      s, m, n, pct, left, lost, st, label: x[0], sc: x[1], soft: x[2],
      barW: Math.min(100, pct * 100) + '%', hWord: left === 1 ? 'hora' : 'horas', leftWord: lost ? 'perdida' : left === 1 ? 'hora' : 'horas', over: n - m.max,
      cardBg: lost ? 'var(--badSoft)' : 'var(--surface)', border: st === 'bad' || lost ? 'var(--bad)' : 'transparent',
    };
  };
  const cards = ORDER.map(stat).sort((a, b) => b.pct - a.pct || a.left - b.left);
  const alerts = cards.filter((c) => c.st !== 'ok');
  const redCount = alerts.filter((a) => a.st !== 'warn').length;

  const tabs = [['hoy', 'Hoy'], ['horario', 'Horario'], ['faltas', 'Faltas'], ['perfil', 'Perfil']];
  const first = user.name.split(' ')[0];
  const openSheet = () => setSheet({ date: tk, sel: [], tag: 'I' });

  const p = { abs, now, wd, min, tk, wide, stat, openDetail };
  return (
    <div className="shell">
      {wide && (
        <aside className="aside">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 8px 6px' }}>
            <Logo size={40} radius={13} font={24} />
            <div className="col">
              <span className="disp" style={{ fontSize: 21, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Margen</span>
              <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>2º MyP A · Aula 221</span>
            </div>
          </div>
          <div style={{ height: 18 }} />
          {tabs.map(([id, label]) => (
            <button key={id} className="side-btn" aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)} style={inv(tab === id)}>
              <span>{label}</span>
              {id === 'faltas' && redCount > 0 && <span className="badge" aria-label={`${redCount} en rojo`}>{redCount}</span>}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="btn-main" style={{ height: 58, fontSize: 17 }} onClick={openSheet}>+ Apuntar faltas</button>
          <button className="ghost-btn" style={{ height: 48, borderRadius: 16, fontSize: 15, background: 'transparent', marginTop: 6 }} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
        </aside>
      )}

      <main style={{ padding: wide ? '40px 48px 64px' : '16px 18px 180px' }}>
        <div className="wrap">
          {!wide && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Logo size={36} radius={11} font={21} />
                <span className="disp" style={{ fontSize: 19, letterSpacing: '-0.02em' }}>Margen</span>
              </div>
              <button className="ghost-btn" aria-label="Cambiar tema" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Claro' : 'Oscuro'}</button>
            </div>
          )}
          {tab === 'hoy' && <Hoy {...p} first={first} alerts={alerts} openSheet={openSheet} goFaltas={() => go('faltas')} />}
          {tab === 'horario' && <Horario {...p} day={day} setDay={setDay} />}
          {tab === 'faltas' && !detail && <Faltas cards={cards} abs={abs} now={now} wide={wide} openDetail={openDetail} plus={plus} minus={minus} busy={busy} />}
          {tab === 'faltas' && detail && <Detalle st={stat(detail)} abs={abs} w={w} back={() => setDetail(null)} plus={plus} minus={minus} remove={remove} toggleTag={toggleTag} busy={busy} />}
          {tab === 'perfil' && <Perfil user={user} theme={theme} setTheme={setTheme} logout={logout} />}
        </div>
      </main>

      {!wide && tab !== 'perfil' && !sheet && <button className="fab" aria-label="Apuntar faltas" onClick={openSheet}>+ Falta</button>}
      {!wide && (
        <nav className="tabbar" aria-label="Secciones">
          {tabs.map(([id, label]) => (
            <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)} style={{ background: tab === id ? BG : 'transparent', color: tab === id ? INK : BG }}>
              {label}
              {id === 'faltas' && redCount > 0 && <span className="badge" aria-label={`${redCount} en rojo`}>{redCount}</span>}
            </button>
          ))}
        </nav>
      )}
      {sheet && <Sheet sheet={sheet} setSheet={setSheet} abs={abs} tk={tk} wide={wide} save={saveSheet} busy={busy} />}
    </div>
  );
}

// Filas de un día con el recreo en medio
function rowsFor(d, dk, isToday, min, abs) {
  if (d < 0) return [];
  const r = [];
  WEEK[d].forEach((s, i) => {
    const sl = SLOTS[i], m = MODS[s], isNow = isToday && min >= sl.s && min < sl.e, past = isToday && min >= sl.e;
    r.push({ k: i, s, sl, m, isNow, missed: abs.some((a) => a.date === dk && a.slot === i + 1), timeColor: past ? 'var(--muted)' : INK });
    if (i === BREAK.after) r.push({ k: 'r', isBreak: true, now: isToday && min >= BREAK.s && min < BREAK.e });
  });
  return r;
}

function Hoy({ abs, now, wd, min, tk, wide, stat, openDetail, first, alerts, openSheet, goFaltas }) {
  let feat = null;
  if (wd >= 0) {
    const i = SLOTS.findIndex((sl) => min >= sl.s && min < sl.e);
    if (i >= 0) feat = { d: wd, i, badge: 'Ahora', isNow: true, prog: Math.round(((min - SLOTS[i].s) / 60) * 100) + '%', hint: `Quedan ${SLOTS[i].e - min} min` };
    else {
      const j = SLOTS.findIndex((sl) => sl.s > min);
      if (j >= 0) { const d = SLOTS[j].s - min; feat = { d: wd, i: j, badge: j === 2 && min >= BREAK.s ? 'Después del recreo' : 'Siguiente', hint: `Empieza en ${d >= 60 ? Math.floor(d / 60) + ' h ' + (d % 60) + ' min' : d + ' min'}` }; }
    }
  }
  if (!feat) {
    for (let k = 1; k <= 7; k++) {
      const d = new Date(now); d.setDate(d.getDate() + k);
      if (wdIdx(d) >= 0) { feat = { d: wdIdx(d), i: 0, badge: k === 1 ? 'Mañana' : 'El ' + DAYS[wdIdx(d)].toLowerCase(), hint: 'Primera clase del día' }; break; }
    }
  }
  const fs = WEEK[feat.d][feat.i], fm = MODS[fs], fst = stat(fs);
  const rows = rowsFor(wd, tk, true, min, abs);

  return (
    <div className="col" style={{ gap: 26 }}>
      <header className="col" style={{ gap: 6 }}>
        <div className="muted caps" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.06em' }}>{WDL[now.getDay()]}, {now.getDate()} de {MONTHS[now.getMonth()]}</div>
        <h1 className="h1">Hola, {first}</h1>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: wide ? 'minmax(0,1.35fr) minmax(0,1fr)' : 'minmax(0,1fr)', gap: 26, alignItems: 'start' }}>
        <div className="col" style={{ gap: 26, minWidth: 0 }}>
          <button onClick={openDetail(fs)} style={{ textAlign: 'left', border: 0, cursor: 'pointer', background: fm.c, color: fm.fg, borderRadius: 30, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span className="caps" style={{ background: fm.fg, color: fm.c, borderRadius: 999, padding: '7px 14px', fontSize: 13, letterSpacing: '.08em' }}>{feat.badge}</span>
              <span className="disp" style={{ fontSize: 22, fontWeight: 700 }}>{SLOTS[feat.i].a} – {SLOTS[feat.i].b}</span>
            </div>
            <div className="col" style={{ gap: 4 }}>
              <div className="disp" style={{ fontSize: 76, lineHeight: 0.9, letterSpacing: '-0.04em' }}>{fs}</div>
              <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, textWrap: 'balance' }}>{fm.name}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', fontSize: 16, fontWeight: 600 }}>
              <span>{fm.prof}</span><span>Aula 221</span>
            </div>
            {feat.isNow && (
              <div style={{ height: 8, borderRadius: 99, background: `color-mix(in oklch, ${fm.fg} 25%, transparent)`, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: feat.prog, background: fm.fg, borderRadius: 99 }} />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 15, fontWeight: 700 }}>
              <span>{feat.hint}</span>
              <span style={{ background: fst.sc, color: '#111', borderRadius: 999, padding: '7px 14px', fontWeight: 800 }}>{fst.lost ? 'Evaluación perdida' : `Te quedan ${fst.left} h`}</span>
            </div>
          </button>

          <section className="col" style={{ gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2 className="h2">Clases de hoy</h2>
              {rows.length > 0 && <button className="chip-btn" onClick={openSheet}>Apuntar faltas</button>}
            </div>
            {!rows.length && <div className="soft-box" style={{ background: 'var(--surface)' }}>Hoy no hay clase. Disfruta del día.</div>}
            <div className="col" style={{ gap: 8 }}>
              {rows.map((r) => r.isBreak ? (
                <div key={r.k} className="break-line">
                  <span style={{ width: 52 }}>{BREAK.a}</span>
                  <span style={{ flex: 1, height: 2, background: 'repeating-linear-gradient(90deg,var(--line) 0 6px,transparent 6px 12px)' }} />
                  <span>Recreo{r.now ? ' · ahora' : ''}</span>
                </div>
              ) : (
                <button key={r.k} className="row" onClick={openDetail(r.s)} style={{ boxShadow: r.isNow ? RING : 'none' }}>
                  <div className="time" style={{ color: r.timeColor }}><span>{r.sl.a}</span><small>{r.sl.b}</small></div>
                  <div className="tile" style={{ width: 54, height: 48, borderRadius: 14, background: r.m.c, color: r.m.fg, fontSize: 15 }}>{r.s}</div>
                  <div className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{r.m.short}</span>
                    <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>{r.m.ps}</span>
                  </div>
                  {r.isNow && <span className="tag" style={{ background: INK, color: BG }}>Ahora</span>}
                  {r.missed && <span className="tag" style={{ background: 'var(--badSoft)', color: 'var(--badText)' }}>Falta</span>}
                </button>
              ))}
            </div>
          </section>
        </div>

        <section className="col" style={{ gap: 12, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h2 className="h2">Alertas</h2>
            <button className="link-btn" onClick={goFaltas}>Ver todas</button>
          </div>
          {!alerts.length && (
            <div className="soft-box" style={{ background: 'var(--okSoft)', display: 'flex', alignItems: 'center', gap: 14, fontWeight: 700 }}>
              <span style={{ width: 16, height: 16, borderRadius: 99, background: 'var(--ok)', flex: 'none' }} />Todo en verde. Sigue así.
            </div>
          )}
          {alerts.map((a) => (
            <button key={a.s} onClick={openDetail(a.s)} style={{ display: 'flex', alignItems: 'center', gap: 14, background: a.soft, border: 0, borderRadius: 22, padding: '14px 18px', textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ width: 14, height: 14, borderRadius: 99, background: a.sc, flex: 'none' }} />
              <div className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <span className="disp" style={{ fontSize: 20 }}>{a.s}</span>
                <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25 }}>{a.m.short} · {a.label}</span>
              </div>
              <div className="col" style={{ alignItems: 'flex-end' }}>
                <span className="disp" style={{ fontSize: 40, lineHeight: 1, letterSpacing: '-0.03em' }}>{a.left}</span>
                <span className="caps" style={{ fontSize: 12, letterSpacing: '.05em' }}>{a.leftWord}</span>
              </div>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}

function Horario({ abs, now, wd, min, wide, day, setDay }) {
  const monday = new Date(now);
  monday.setDate(now.getDate() - (wd >= 0 ? wd : now.getDay() === 6 ? -2 : -1));
  const sel = day ?? (wd >= 0 ? wd : 0);
  const selDate = new Date(monday); selDate.setDate(monday.getDate() + sel);
  const tx = useRef(0);
  const colBg = (d) => (d === wd ? 'var(--todayCol)' : 'transparent');

  return (
    <div className="col" style={{ gap: 20 }}>
      <header className="col" style={{ gap: 6 }}>
        <h1 className="h1">Horario</h1>
        <p className="muted" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Todas las clases en el aula 221</p>
      </header>

      {!wide && (
        <>
          <div role="tablist" aria-label="Día" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, background: 'var(--surface)', borderRadius: 20, padding: 6 }}>
            {['L', 'M', 'X', 'J', 'V'].map((l, i) => {
              const d = new Date(monday); d.setDate(monday.getDate() + i); const act = i === sel;
              return (
                <button key={l} role="tab" aria-selected={act} aria-label={DAYS[i]} onClick={() => setDay(i)}
                  style={{ height: 60, borderRadius: 15, border: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, background: act ? INK : i === wd ? 'var(--surface2)' : 'transparent', color: act ? BG : INK }}>
                  <span className="disp" style={{ fontSize: 20, lineHeight: 1 }}>{l}</span>
                  <span className="caps" style={{ fontSize: 11, letterSpacing: '.06em' }}>{i === wd ? 'Hoy' : d.getDate()}</span>
                </button>
              );
            })}
          </div>
          <div className="col" style={{ gap: 10, touchAction: 'pan-y' }}
            onTouchStart={(e) => { tx.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - tx.current; if (Math.abs(dx) < 50) return; setDay(Math.max(0, Math.min(4, sel + (dx < 0 ? 1 : -1)))); }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 className="h2" style={{ fontSize: 28 }}>{DAYS[sel]} {selDate.getDate()}</h2>
              <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Desliza ← →</span>
            </div>
            {rowsFor(sel, key(selDate), sel === wd, min, abs).map((r) => r.isBreak ? (
              <div key={r.k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 4px', color: 'var(--muted)', fontSize: 14, fontWeight: 700 }}>
                <span style={{ width: 50 }}>{BREAK.a}</span>
                <span className="stripes" style={{ flex: 1, height: 30, borderRadius: 12, fontSize: 13 }}>Recreo{r.now ? ' · ahora' : ''}</span>
              </div>
            ) : (
              <div key={r.k} style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                <div className="time" style={{ width: 50, paddingTop: 12, color: r.timeColor }}><span>{r.sl.a}</span><small>{r.sl.b}</small></div>
                <div style={{ flex: 1, minWidth: 0, background: r.m.c, color: r.m.fg, borderRadius: 20, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: r.isNow ? RING : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span className="disp" style={{ fontSize: 28, lineHeight: 1, letterSpacing: '-0.02em' }}>{r.s}</span>
                    {r.isNow && <span className="caps" style={{ background: r.m.fg, color: r.m.c, borderRadius: 999, padding: '4px 10px', fontSize: 11, letterSpacing: '.08em' }}>Ahora</span>}
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{r.m.short}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{r.m.prof}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {wide && (
        <div style={{ display: 'grid', gridTemplateColumns: '72px repeat(5,minmax(0,1fr))' }}>
          <div />
          {DAYS.map((n, d) => (
            <div key={n} style={{ background: colBg(d), borderRadius: '18px 18px 0 0', padding: '10px 5px 8px', display: 'flex', justifyContent: 'center' }}>
              <span style={{ ...inv(d === wd), borderRadius: 999, padding: '8px 14px', fontWeight: 800, fontSize: 15 }}>{d === wd ? n + ' · hoy' : n}</span>
            </div>
          ))}
          {SLOTS.map((sl, i) => (
            <Fragment key={i}>
              <div className="time" style={{ width: 'auto', padding: '12px 8px 0 0', fontSize: 15 }}><span>{sl.a}</span><small style={{ fontSize: 12 }}>{sl.b}</small></div>
              {[0, 1, 2, 3, 4].map((d) => {
                const s = WEEK[d][i], m = MODS[s], isNow = d === wd && min >= sl.s && min < sl.e;
                return (
                  <div key={d} style={{ background: colBg(d), padding: 5, borderRadius: i === 5 ? '0 0 18px 18px' : 0 }}>
                    <div style={{ background: m.c, color: m.fg, borderRadius: 16, padding: '11px 12px', minHeight: 104, height: '100%', display: 'flex', flexDirection: 'column', gap: 3, boxShadow: isNow ? RING : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                        <span className="disp" style={{ fontSize: 21, lineHeight: 1 }}>{s}</span>
                        {isNow && <span className="caps" style={{ background: m.fg, color: m.c, borderRadius: 999, padding: '3px 7px', fontSize: 10, letterSpacing: '.06em' }}>Ahora</span>}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{m.short}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, marginTop: 'auto', lineHeight: 1.25 }}>{m.prof}</span>
                    </div>
                  </div>
                );
              })}
              {i === BREAK.after && (
                <>
                  <div className="time" style={{ width: 'auto', padding: '8px 8px 0 0', fontSize: 15 }}><span>{BREAK.a}</span><small style={{ fontSize: 12 }}>{BREAK.b}</small></div>
                  {[0, 1, 2, 3, 4].map((d) => (
                    <div key={d} style={{ background: colBg(d), padding: 5 }}>
                      <div className="stripes" style={{ height: 34, borderRadius: 12 }}>{d === wd && min >= BREAK.s && min < BREAK.e ? 'Recreo · ahora' : 'Recreo'}</div>
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

function Bar({ st, bg }) {
  return (
    <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={st.m.max} aria-valuenow={st.n} aria-label={`${st.n} de ${st.m.max} horas`}>
      <div style={{ width: st.barW, background: st.sc }} />
      <div className="mark" style={{ left: '50%', background: bg }} />
      <div className="mark" style={{ left: '80%', background: bg }} />
    </div>
  );
}

function Left({ st, size }) {
  return (
    <div className="col">
      <span className="muted caps" style={{ fontSize: 13, letterSpacing: '.07em' }}>Te quedan</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="disp" style={{ fontSize: size, lineHeight: 0.9, letterSpacing: '-0.05em' }}>{st.left}</span>
        <span className="disp" style={{ fontWeight: 700, fontSize: size > 90 ? 26 : 24 }}>{st.hWord}</span>
      </span>
    </div>
  );
}

function Faltas({ cards, abs, now, wide, openDetail, plus, minus, busy }) {
  const cnt = (k) => cards.filter((c) => k.includes(c.st)).length;
  const counters = [['en rojo', cnt(['bad', 'lost']), 'var(--bad)'], ['en ámbar', cnt(['warn']), 'var(--warn)'], ['en verde', cnt(['ok']), 'var(--ok)']];
  return (
    <div className="col" style={{ gap: 22 }}>
      <header className="col" style={{ gap: 14 }}>
        <h1 className="h1">Mis faltas</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {counters.map(([label, n, c]) => (
            <span key={label} className="counter"><span style={{ width: 12, height: 12, borderRadius: 99, background: c }} /><b style={{ fontSize: 17 }}>{n}</b> {label}</span>
          ))}
        </div>
      </header>
      <Resumen cards={cards} abs={abs} now={now} wide={wide} />
      <h2 className="h2" style={{ marginTop: 6 }}>Tus módulos</h2>
      <div className="cards">
        {cards.map((c) => (
          <div key={c.s} className="card" style={{ background: c.cardBg, borderColor: c.border }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <button onClick={openDetail(c.s)} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', minWidth: 0 }}>
                <span className="tile" style={{ width: 56, height: 56, borderRadius: 17, background: c.m.c, color: c.m.fg, fontSize: 16 }}>{c.s}</span>
                <span className="col" style={{ gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2, textWrap: 'pretty' }}>{c.m.name}</span>
                  <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{c.m.prof}</span>
                </span>
              </button>
              <span className="status" style={{ background: c.sc }}>{c.label}</span>
            </div>
            {!c.lost ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
                <Left st={c} size={80} />
                <span style={{ fontSize: 16, fontWeight: 600, paddingBottom: 6 }}><b style={{ fontSize: 20 }}>{c.n}</b> / {c.m.max} h</span>
              </div>
            ) : (
              <div className="col" style={{ gap: 6 }}>
                <span className="disp" style={{ fontSize: 32, lineHeight: 1, letterSpacing: '-0.03em', color: 'var(--badText)' }}>Evaluación continua perdida</span>
                <span style={{ fontSize: 15, fontWeight: 600 }}><b>{c.n}</b> / {c.m.max} h · {c.over} h por encima del máximo</span>
              </div>
            )}
            <Bar st={c} bg={c.cardBg} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr', gap: 8 }}>
              <button className="big-btn" aria-label={`Quitar la última falta de ${c.s}`} disabled={!c.n || busy} onClick={() => minus(c.s)} style={{ background: 'var(--surface2)' }}>−1</button>
              <button className="big-btn" aria-label={`Sumar una falta hoy en ${c.s}`} disabled={busy} onClick={() => plus(c.s)} style={{ background: INK, color: BG }}>+1</button>
              <button onClick={openDetail(c.s)} style={{ height: 52, borderRadius: 16, border: '2px solid var(--line)', background: 'transparent', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>Historial →</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Detalle({ st, abs, w, back, plus, minus, remove, toggleTag, busy }) {
  const list = abs.filter((a) => a.mod === st.s).sort((a, b) => b.date.localeCompare(a.date) || (b.slot || 0) - (a.slot || 0));
  const j = list.filter((a) => a.tag === 'J').length, i = list.length - j;
  return (
    <div className="col" style={{ gap: 18 }}>
      <button className="back" onClick={back}>← Mis faltas</button>
      <div style={{ display: 'grid', gridTemplateColumns: w >= 1200 ? 'minmax(0,0.85fr) minmax(0,1.3fr)' : 'minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
        <div className="col" style={{ gap: 14, minWidth: 0 }}>
          <div style={{ background: st.m.c, color: st.m.fg, borderRadius: 30, padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h1 className="disp" style={{ margin: 0, fontSize: 64, lineHeight: 0.9, letterSpacing: '-0.04em' }}>{st.s}</h1>
            <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, textWrap: 'balance' }}>{st.m.name}</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{st.m.prof}</span>
          </div>
          <div className="card" style={{ background: st.cardBg, borderColor: st.border }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <span className="status" style={{ background: st.sc, padding: '6px 12px' }}>{st.label}</span>
              <span style={{ fontSize: 16, fontWeight: 600 }}><b style={{ fontSize: 20 }}>{st.n}</b> / {st.m.max} h</span>
            </div>
            {!st.lost ? <Left st={st} size={96} /> : <span className="disp" style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-0.03em', color: 'var(--badText)' }}>Evaluación continua perdida</span>}
            <Bar st={st} bg={st.cardBg} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="big-btn" style={{ height: 54, background: 'var(--surface2)' }} aria-label="Quitar la última falta" disabled={!st.n || busy} onClick={() => minus(st.s)}>−1</button>
              <button className="big-btn" style={{ height: 54, background: INK, color: BG }} disabled={busy} onClick={() => plus(st.s)}>+1 hoy</button>
            </div>
          </div>
        </div>

        <section className="col" style={{ gap: 10, minWidth: 0 }}>
          <div className="col" style={{ gap: 4 }}>
            <h2 className="h2" style={{ fontSize: 28 }}>Historial</h2>
            <span className="muted" style={{ fontSize: 15, fontWeight: 600 }}>
              {list.length} {list.length === 1 ? 'falta' : 'faltas'} · {j} justificada{j === 1 ? '' : 's'} · {i} injustificada{i === 1 ? '' : 's'}
            </span>
          </div>
          {!list.length && <div className="soft-box" style={{ background: 'var(--okSoft)', fontWeight: 700 }}>Ninguna falta en este módulo. Así se hace.</div>}
          {list.map((a) => {
            const d = parse(a.date), J = a.tag === 'J';
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', borderRadius: 20, padding: '12px 12px 12px 14px' }}>
                <div className="col" style={{ width: 52, flex: 'none', alignItems: 'center' }}>
                  <span className="disp" style={{ fontSize: 28, lineHeight: 1 }}>{d.getDate()}</span>
                  <span className="muted caps" style={{ fontSize: 12, fontWeight: 700 }}>{WD[d.getDay()]} · {MONTHS[d.getMonth()].slice(0, 3)}</span>
                </div>
                <div className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap' }}>{a.slot ? `${a.slot}ª hora` : 'Sin hora'}</span>
                  <span className="muted" style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{a.slot ? `${SLOTS[a.slot - 1].a}–${SLOTS[a.slot - 1].b}` : 'asignada'}</span>
                </div>
                <button onClick={() => toggleTag(a)} aria-label={`${J ? 'Justificada' : 'Injustificada'}. Toca para cambiar`}
                  style={{ height: 40, borderRadius: 999, border: '2px solid var(--ink)', ...inv(J), padding: '0 12px', fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {J ? 'Justificada' : 'Injustificada'}
                </button>
                <button className="del-btn" aria-label="Borrar falta" disabled={busy} onClick={() => remove(a)}>×</button>
              </div>
            );
          })}
          {list.length > 0 && <p className="muted" style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 500, textWrap: 'pretty' }}>Toca la etiqueta para cambiarla. Las justificadas cuentan igual para el límite.</p>}
        </section>
      </div>
    </div>
  );
}

function Perfil({ user, theme, setTheme, logout }) {
  const first = user.name.split(' ')[0];
  return (
    <div className="col" style={{ gap: 20, maxWidth: 560 }}>
      <h1 className="h1">Perfil</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--surface)', borderRadius: 26, padding: 20 }}>
        <Logo size={68} radius={22} font={32}>{(first[0] || '?').toUpperCase()}</Logo>
        <div className="col" style={{ gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 21, fontWeight: 800 }}>{user.name}</span>
          <span className="muted" style={{ fontSize: 15, fontWeight: 600 }}>@{user.user} · 2º MyP A</span>
        </div>
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 26, padding: '8px 20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Tema</span>
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', borderRadius: 999, padding: 4 }}>
            {[['light', 'Claro'], ['dark', 'Oscuro']].map(([t, l]) => (
              <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)} style={{ height: 40, borderRadius: 999, border: 0, padding: '0 16px', fontWeight: 800, fontSize: 14, cursor: 'pointer', ...inv(theme === t) }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--line)', fontSize: 16 }}><span style={{ fontWeight: 700 }}>Centro</span><span className="muted" style={{ fontWeight: 600, textAlign: 'right' }}>IES Las Salinas · San Fernando</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '14px 0', fontSize: 16 }}><span style={{ fontWeight: 700 }}>Tutora</span><span className="muted" style={{ fontWeight: 600, textAlign: 'right' }}>Natalia Salcedo López</span></div>
      </div>
      <button onClick={logout} style={{ height: 58, borderRadius: 18, border: '2px solid var(--bad)', background: 'transparent', color: 'var(--badText)', fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>Cerrar sesión</button>
    </div>
  );
}

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="h2" style={{ fontSize: 30 }}>Apuntar faltas</h2>
          <button className="del-btn" aria-label="Cerrar" onClick={close} style={{ fontSize: 22 }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" aria-label="Fecha" value={sheet.date} onChange={(e) => e.target.value && upd({ date: e.target.value, sel: [] })}
            style={{ flex: 1, minWidth: 0, height: 54, borderRadius: 16, border: '2px solid var(--line)', background: 'var(--surface)', color: INK, padding: '0 14px', fontSize: 17, fontWeight: 700, outline: 'none' }} />
          <button onClick={() => upd({ date: tk, sel: [] })} style={{ height: 54, borderRadius: 16, border: 0, padding: '0 18px', fontWeight: 800, fontSize: 15, cursor: 'pointer', background: sheet.date === tk ? INK : 'var(--surface2)', color: sheet.date === tk ? BG : INK }}>Hoy</button>
        </div>
        <div className="muted" style={{ fontSize: 16, fontWeight: 700 }}>{WDL[d.getDay()]}, {d.getDate()} de {MONTHS[d.getMonth()]}</div>
        {w < 0 && <div className="soft-box" style={{ background: 'var(--surface)', fontSize: 16, borderRadius: 20, padding: 20 }}>Ese día no hay clase.</div>}
        {w >= 0 && (
          <>
            <button onClick={() => upd({ sel: all ? [] : avail })} disabled={!avail.length} role="checkbox" aria-checked={all}
              style={{ display: 'flex', alignItems: 'center', gap: 12, height: 56, borderRadius: 18, border: '2px solid var(--ink)', ...inv(all), padding: '0 16px', fontSize: 17, fontWeight: 800, cursor: 'pointer', opacity: avail.length ? 1 : 0.5 }}>
              <span className="box" style={{ borderColor: 'currentColor', color: 'inherit', fontSize: 15 }}>{all ? '✓' : ''}</span>Todo el día
            </button>
            <div className="col" style={{ gap: 8 }}>
              {WEEK[w].map((s, i) => {
                const k = i + 1, t = taken.has(k), on = sheet.sel.includes(k), m = MODS[s];
                return (
                  <button key={k} role="checkbox" aria-checked={on || t} aria-disabled={t} onClick={() => { if (!t) upd({ sel: on ? sheet.sel.filter((x) => x !== k) : [...sheet.sel, k] }); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, borderRadius: 18, border: `2px solid ${on ? INK : 'transparent'}`, background: 'var(--surface)', padding: '8px 12px', textAlign: 'left', cursor: t ? 'default' : 'pointer', opacity: t ? 0.55 : 1 }}>
                    <span className="box" style={{ background: on ? INK : t ? 'var(--muted)' : 'transparent', fontSize: 15 }}>{on || t ? '✓' : ''}</span>
                    <span style={{ width: 46, flex: 'none', fontWeight: 800, fontSize: 15 }}>{SLOTS[i].a}</span>
                    <span className="tile" style={{ width: 50, height: 40, borderRadius: 12, background: m.c, color: m.fg, fontSize: 14 }}>{s}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>{m.short}</span>
                    {t && <span className="muted caps" style={{ fontSize: 12 }}>Ya apuntada</span>}
                  </button>
                );
              })}
            </div>
            <div className="seg" role="radiogroup" aria-label="Etiqueta">
              {[['I', 'Injustificada'], ['J', 'Justificada']].map(([v, l]) => (
                <button key={v} role="radio" aria-checked={sheet.tag === v} onClick={() => upd({ tag: v })} style={inv(sheet.tag === v)}>{l}</button>
              ))}
            </div>
            <button className="btn-main" style={{ height: 60, fontSize: 18 }} disabled={!n || busy} onClick={save}>
              {busy ? 'Guardando…' : n ? `Guardar ${n} ${n === 1 ? 'hora' : 'horas'}` : 'Marca las horas'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
