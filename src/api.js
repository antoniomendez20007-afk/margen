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
  clear() { try { localStorage.removeItem(TK); sessionStorage.removeItem(TK); localStorage.removeItem(CK); sessionStorage.removeItem(CK); } catch { /* nada */ } },
};

// Últimos datos recibidos, en el mismo sitio que el token: la app abre al
// instante con ellos mientras el servidor (que puede tardar en despertar) contesta.
const CK = 'margen_cache';
const store = () => { try { return localStorage.getItem(TK) ? localStorage : sessionStorage.getItem(TK) ? sessionStorage : null; } catch { return null; } };
export const cache = {
  get() { try { const s = store(); return s ? JSON.parse(s.getItem(CK)) : null; } catch { return null; } },
  set(data) { try { store()?.setItem(CK, JSON.stringify(data)); } catch { /* nada */ } },
};

// ── Apps Script ──────────────────────────────────────────────────────────
const unwrap = (out, resolve, reject) => {
  let r; try { r = typeof out === 'string' ? JSON.parse(out) : out; } catch { return reject(new ApiError('Algo ha fallado en el servidor. Prueba otra vez.')); }
  if (r.error) reject(new ApiError(r.error, r.session)); else resolve(r.data);
};

// Google a veces tarda en despertar o contesta con una página de error
// («No se puede abrir el archivo»): en ese caso el script no llegó a ejecutarse
// y se puede repetir sin riesgo. Las lecturas se repiten también si se corta la red.
const READS = new Set(['me', 'login']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(action, args) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch(API_URL, { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, args }), redirect: 'follow', signal: ctrl.signal });
    const text = await r.text();
    try { return { json: JSON.parse(text) }; } catch { return { googleError: true }; }
  } catch { return { network: true }; }
  finally { clearTimeout(timer); }
}

const run = async (action, args) => {
  if (gas) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((out) => unwrap(out, resolve, reject))
        .withFailureHandler(() => reject(new ApiError('Sin conexión. Revisa internet y vuelve a probar.')))
        .api(action, JSON.stringify(args));
    });
  }
  for (let i = 0; i < 3; i++) {
    const r = await post(action, args);
    if (r.json) return new Promise((resolve, reject) => unwrap(r.json, resolve, reject));
    const retry = r.googleError || READS.has(action);
    if (!retry || i === 2) break;
    await sleep(1200 * (i + 1));
  }
  throw new ApiError('No se ha podido conectar con el servidor. Prueba otra vez en un momento.');
};

const remote = {
  login: (user, pass, remember) => run('login', { user, pass, remember }),
  register: (name, user, pass, code) => run('register', { name, user, pass, code }),
  me: (t) => run('me', { token: t }),
  logout: (t) => run('logout', { token: t }),
  add: (t, items) => run('add', { token: t, items }),
  del: (t, ids) => run('del', { token: t, ids }),
  setTag: (t, id, tag) => run('setTag', { token: t, id, tag }),
  setPhoto: (t, foto) => run('setPhoto', { token: t, foto }),
  setShare: (t, share) => run('setShare', { token: t, share }),
  people: (t) => run('people', { token: t }),
  board: (t) => run('board', { token: t }),
  post: (t, text, mod, parent) => run('post', { token: t, text, mod, parent }),
  like: (t, id) => run('like', { token: t, id }),
  delPost: (t, id) => run('delPost', { token: t, id }),
  chat: (t, since) => run('chat', { token: t, since }),
  send: (t, text, since) => run('send', { token: t, text, since }),
  delMsg: (t, id) => run('delMsg', { token: t, id }),
  notes: (t) => run('notes', { token: t }),
  upload: (t, f) => run('upload', { token: t, ...f }),
  delNote: (t, id) => run('delNote', { token: t, id }),
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
const prof = (u) => LS.read('margen_profile_' + u, {});
const pub = (u) => ({ user: u.user, name: u.name, foto: prof(u.user).foto || '', share: !!prof(u.user).share, admin: u.user === DEMO.user });

// Compañeros, tablón, chat y apuntes de ejemplo para el modo de prueba
const MATES = [
  { user: 'pablo', name: 'Pablo Gómez', share: true, res: { MD: 4, LPS: 2, RPOE: 1 } },
  { user: 'marta', name: 'Marta Ruiz', share: false },
  { user: 'ivan', name: 'Iván Sánchez', share: true, res: { DEMC: 9, TCIC: 3 } },
  { user: 'sara', name: 'Sara Domínguez', share: false },
];
const ago = (m) => new Date(Date.now() - m * 60000).toISOString();
const seed = (k, v) => { const x = LS.read(k, null); if (x) return x; LS.write(k, v); return v; };
const boardOf = () => seed('margen_board', [
  { id: 1, user: 'pablo', text: 'Recordad que el jueves hay que entregar la campaña de LPS. ¿Alguien sabe si es en papel o por Classroom?', mod: 'LPS', parent: null, at: ago(190), likes: ['marta', 'ivan'] },
  { id: 2, user: 'marta', text: 'Por Classroom, lo dijo Juana el lunes.', mod: '', parent: 1, at: ago(160), likes: ['pablo'] },
  { id: 3, user: 'ivan', text: 'Mañana no hay MD a primera, el profe avisó por correo.', mod: 'MD', parent: null, at: ago(45), likes: [] },
]);
const chatOf = () => seed('margen_chat', [
  { id: 1, user: 'sara', text: '¿Alguien va al recreo a la cafetería?', at: ago(30) },
  { id: 2, user: 'pablo', text: 'Yo voy', at: ago(28) },
]);
const notesOf = () => seed('margen_notes', [
  { id: 1, user: 'marta', title: 'Resumen tema 2 · Medios', mod: 'MSC', name: 'tema2-medios.pdf', type: 'application/pdf', size: 482000, url: '#', at: ago(2000) },
]);
const boardView = (me) => boardOf().map((p) => ({ ...p, likes: p.likes.length, liked: p.likes.includes(me) }));
const chatView = (since) => chatOf().filter((m) => m.id > (since || 0));

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
  async setPhoto(t, foto) { await wait(); const u = userOf(t); LS.write('margen_profile_' + u.user, { ...prof(u.user), foto }); return pub(u); },
  async setShare(t, share) { await wait(); const u = userOf(t); LS.write('margen_profile_' + u.user, { ...prof(u.user), share }); return pub(u); },
  async people(t) {
    await wait(); const me = userOf(t);
    const count = (a) => a.reduce((m, x) => ({ ...m, [x.mod]: (m[x.mod] || 0) + 1 }), {});
    const list = [...users().map((u) => ({ ...pub(u), me: u.user === me.user, resumen: prof(u.user).share ? count(absOf(u.user)) : null })),
      ...MATES.map((m) => ({ user: m.user, name: m.name, foto: '', share: m.share, resumen: m.share ? m.res : null, me: false, admin: false }))];
    return list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  },
  async board(t) { await wait(); return boardView(userOf(t).user); },
  async post(t, text, mod, parent) {
    await wait(); const me = userOf(t).user, b = boardOf(), x = String(text || '').trim();
    if (!x) throw new ApiError('Escribe algo antes de enviar.');
    if (x.length > 1000) throw new ApiError('El texto es demasiado largo (máximo 1000 caracteres).');
    b.push({ id: b.reduce((m, p) => Math.max(m, p.id), 0) + 1, user: me, text: x, mod: mod || '', parent: parent || null, at: new Date().toISOString(), likes: [] });
    LS.write('margen_board', b); return boardView(me);
  },
  async like(t, id) {
    await wait(); const me = userOf(t).user;
    LS.write('margen_board', boardOf().map((p) => (p.id === id ? { ...p, likes: p.likes.includes(me) ? p.likes.filter((u) => u !== me) : [...p.likes, me] } : p)));
    return boardView(me);
  },
  async delPost(t, id) {
    await wait(); const me = userOf(t), p = boardOf().find((x) => x.id === id);
    if (p && p.user !== me.user && !pub(me).admin) throw new ApiError('Solo puedes borrar lo que has publicado tú.');
    LS.write('margen_board', boardOf().filter((x) => x.id !== id && x.parent !== id)); return boardView(me.user);
  },
  async chat(t, since) { await wait(); userOf(t); return chatView(since); },
  async send(t, text, since) {
    await wait(); const me = userOf(t).user, c = chatOf(), x = String(text || '').trim();
    if (!x) throw new ApiError('Escribe algo antes de enviar.');
    c.push({ id: c.reduce((m, p) => Math.max(m, p.id), 0) + 1, user: me, text: x.slice(0, 500), at: new Date().toISOString() });
    LS.write('margen_chat', c); return chatView(since);
  },
  async delMsg(t, id) { await wait(); userOf(t); LS.write('margen_chat', chatOf().filter((m) => m.id !== id)); return { deleted: id }; },
  async notes(t) { await wait(); userOf(t); return [...notesOf()].reverse(); },
  async upload(t, f) {
    await wait(); const me = userOf(t).user, n = notesOf();
    n.push({ id: n.reduce((m, p) => Math.max(m, p.id), 0) + 1, user: me, title: f.title, mod: f.mod, name: f.name, type: f.type, size: Math.round((f.data || '').length * 0.75), url: '#', at: new Date().toISOString() });
    LS.write('margen_notes', n); return [...n].reverse();
  },
  async delNote(t, id) { await wait(); userOf(t); LS.write('margen_notes', notesOf().filter((x) => x.id !== id)); return [...notesOf()].reverse(); },
};

export const api = isLocal ? local : remote;
