// Conexión con el servidor (gas/Code.js en Google Apps Script):
// - app instalable (GitHub Pages): fetch a la URL /exec de VITE_API_URL;
// - servida por Apps Script: google.script.run;
// - sin ninguna de las dos (npm run dev): modo de prueba en este navegador.
import { ORDER, WEEK, key, parse, wdIdx } from './data.js';

const API_URL = import.meta.env.VITE_API_URL;
const gas = typeof google !== 'undefined' && google.script && google.script.run;
export const isLocal = !gas && !API_URL;

export class ApiError extends Error {
  constructor(message, session = false) { super(message); this.session = session; }
}

// ── Sesión guardada ──────────────────────────────────────────────────────
const TK = 'margen_token';
export const token = {
  get() { try { return localStorage.getItem(TK) || sessionStorage.getItem(TK); } catch { return null; } },
  set(t, remember) {
    try {
      localStorage.removeItem(TK); sessionStorage.removeItem(TK);
      (remember ? localStorage : sessionStorage).setItem(TK, t);
    } catch { /* sin almacenamiento: la sesión dura lo que la pestaña */ }
  },
  clear() { try { localStorage.removeItem(TK); sessionStorage.removeItem(TK); } catch { /* nada */ } },
};

// ── Apps Script ──────────────────────────────────────────────────────────
const unwrap = (out, resolve, reject) => {
  let r; try { r = typeof out === 'string' ? JSON.parse(out) : out; } catch { return reject(new ApiError('Algo ha fallado en el servidor. Prueba otra vez.')); }
  if (r.error) reject(new ApiError(r.error, r.session)); else resolve(r.data);
};

const run = (action, args) => new Promise((resolve, reject) => {
  if (!gas) {
    // text/plain es una petición «simple»: Apps Script no responde a las previas de CORS
    fetch(API_URL, { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, args }), redirect: 'follow' })
      .then((r) => r.text())
      .then((out) => unwrap(out, resolve, reject))
      .catch(() => reject(new ApiError('Sin conexión. Revisa internet y vuelve a probar.')));
    return;
  }
  google.script.run
    .withSuccessHandler((out) => unwrap(out, resolve, reject))
    .withFailureHandler(() => reject(new ApiError('Sin conexión. Revisa internet y vuelve a probar.')))
    .api(action, JSON.stringify(args));
});

const remote = {
  login: (user, pass, remember) => run('login', { user, pass, remember }),
  register: (name, user, pass, code) => run('register', { name, user, pass, code }),
  me: (t) => run('me', { token: t }),
  logout: (t) => run('logout', { token: t }),
  add: (t, items) => run('add', { token: t, items }),
  del: (t, ids) => run('del', { token: t, ids }),
  setTag: (t, id, tag) => run('setTag', { token: t, id, tag }),
};

// ── Modo de prueba (localStorage) ────────────────────────────────────────
const LS = {
  read(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* nada */ } },
};
const DEMO = { user: 'lucia', pass: '1234', name: 'Lucía Ramírez' };
const SAMPLE = { MD: 9, DEMC: 10, TCIC: 3, MSC: 2, RPOE: 11, LPS: 4, IPE2: 7, OGS: 1, PIMP: 0 };

// Faltas de ejemplo repartidas entre el 15 de septiembre y hoy
function sample(today) {
  const end = parse(today), occ = {};
  ORDER.forEach((s) => (occ[s] = []));
  for (let d = new Date(2026, 8, 15); d < end; d.setDate(d.getDate() + 1)) {
    const w = wdIdx(d); if (w < 0) continue;
    WEEK[w].forEach((s, i) => occ[s].push({ date: key(d), slot: i + 1 }));
  }
  const out = []; let id = 1;
  ORDER.forEach((s) => {
    const L = occ[s], n = Math.min(SAMPLE[s], L.length); if (!n) return;
    const step = L.length / n;
    for (let i = 0; i < n; i++) {
      const o = L[Math.min(L.length - 1, Math.floor(i * step + ((i * 5 + s.length) % 3) * step / 3))];
      out.push({ id: id++, mod: s, date: o.date, slot: o.slot, tag: i % 3 === 1 ? 'J' : 'I' });
    }
  });
  return out;
}

const wait = () => new Promise((r) => setTimeout(r, 120));
const users = () => [DEMO, ...LS.read('margen_users', [])];
const absOf = (u) => {
  let a = LS.read('margen_abs_' + u, null);
  if (!a) { a = u === DEMO.user ? sample(key(new Date())) : []; LS.write('margen_abs_' + u, a); }
  return a;
};
const userOf = (t) => { const u = users().find((x) => x.user === t); if (!u) throw new ApiError('Tu sesión ha caducado. Vuelve a entrar.', true); return u; };
const pub = (u) => ({ user: u.user, name: u.name });

const local = {
  async login(user, pass) {
    await wait();
    const u = users().find((x) => x.user === user.trim().toLowerCase() && x.pass === pass);
    if (!u) throw new ApiError('Usuario o contraseña incorrectos.');
    return { token: u.user, user: pub(u), abs: absOf(u.user) };
  },
  async register(name, user, pass, code) {
    await wait();
    const u = user.trim().toLowerCase();
    if (!name.trim() || !u || !pass || !code.trim()) throw new ApiError('Rellena todos los campos.');
    if (/\s/.test(u)) throw new ApiError('El usuario no puede tener espacios.');
    if (!/^[a-z0-9._-]{2,30}$/.test(u)) throw new ApiError('El usuario solo puede llevar letras sin tilde, números, punto, guion o guion bajo.');
    if (pass.length < 4) throw new ApiError('La contraseña necesita al menos 4 caracteres.');
    if (code.trim().toUpperCase() !== 'SALINAS2A') throw new ApiError('Ese código de clase no es válido.');
    if (users().some((x) => x.user === u)) throw new ApiError('Ese usuario ya existe.');
    const nu = { user: u, pass, name: name.trim() };
    LS.write('margen_users', [...LS.read('margen_users', []), nu]);
    return { token: u, user: pub(nu), abs: absOf(u) };
  },
  async me(t) { await wait(); const u = userOf(t); return { user: pub(u), abs: absOf(u.user) }; },
  async logout() {},
  async add(t, items) {
    await wait();
    const u = userOf(t).user, a = absOf(u);
    let id = a.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    for (const it of items) {
      if (it.slot != null && a.some((x) => x.date === it.date && x.slot === it.slot)) continue;
      a.push({ id: id++, mod: it.mod, date: it.date, slot: it.slot ?? null, tag: it.tag || 'I' });
    }
    LS.write('margen_abs_' + u, a); return a;
  },
  async del(t, ids) {
    await wait();
    const u = userOf(t).user, a = absOf(u).filter((x) => !ids.includes(x.id));
    LS.write('margen_abs_' + u, a); return a;
  },
  async setTag(t, id, tag) {
    await wait();
    const u = userOf(t).user, a = absOf(u).map((x) => (x.id === id ? { ...x, tag } : x));
    LS.write('margen_abs_' + u, a); return a;
  },
};

export const api = isLocal ? local : remote;
