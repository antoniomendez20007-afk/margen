// Margen · servidor en Google Apps Script
// Los datos viven en una Hoja de cálculo («Margen · datos») que se crea sola la
// primera vez que se ejecuta setup(). La web solo puede llamar a api(), que
// comprueba la sesión en cada petición: nadie ve las faltas de otra persona.

var MODS = ['MD', 'DEMC', 'TCIC', 'MSC', 'RPOE', 'LPS', 'IPE2', 'OGS', 'PIMP'];
var SHEETS = {
  Config: ['clave', 'valor'],
  Alumnos: ['id', 'usuario', 'nombre', 'sal', 'hash', 'fallos', 'bloqueado_hasta', 'creado', 'foto', 'compartir'],
  Sesiones: ['token_hash', 'alumno_id', 'caduca'],
  Faltas: ['id', 'alumno_id', 'modulo', 'fecha', 'hora', 'etiqueta', 'creada'],
  Tablon: ['id', 'alumno_id', 'texto', 'modulo', 'padre', 'creado'],
  Reacciones: ['post_id', 'alumno_id'],
  Chat: ['id', 'alumno_id', 'texto', 'creado'],
  Apuntes: ['id', 'alumno_id', 'titulo', 'modulo', 'file_id', 'nombre', 'tipo', 'tamano', 'url', 'creado'],
};
// admins: usuarios separados por comas que pueden borrar cualquier publicación
var DEFAULTS = [['codigo_clase', 'SALINAS2A'], ['max_alumnos', '60'], ['admins', '']];
var SCHEMA = '2';
var NOTE_TYPES = {
  'application/pdf': 1, 'image/jpeg': 1, 'image/png': 1, 'image/webp': 1, 'image/heic': 1, 'text/plain': 1,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 1,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 1,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 1,
  'application/msword': 1, 'application/vnd.ms-powerpoint': 1, 'application/vnd.ms-excel': 1,
};
var NOTE_MAX = 8 * 1024 * 1024;
var HASH_ROUNDS = 400;
var DAY = 24 * 3600 * 1000;

// ── Web ──────────────────────────────────────────────────────────────────

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Margen · Horario y faltas')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

// La app instalable (GitHub Pages) llama aquí con fetch: {action, args} en
// texto plano, para que el navegador no pida permiso previo (CORS).
function doPost(e) {
  var body = {};
  try { body = JSON.parse(e && e.postData ? e.postData.contents : '{}'); } catch (x) { /* vacío */ }
  return ContentService.createTextOutput(api(String(body.action || ''), JSON.stringify(body.args || {})))
    .setMimeType(ContentService.MimeType.JSON);
}

// Ejecútala una vez desde el editor: pide los permisos y crea la hoja de datos.
function setup() {
  var ss = db_(true);
  console.log('Hoja de datos: ' + ss.getUrl());
  return ss.getUrl();
}

function api(action, argsJson) {
  try {
    migrate_();
    var fn = ACTIONS[action];
    if (!fn) throw userError_('Petición no válida.');
    return JSON.stringify({ data: fn(JSON.parse(argsJson || '{}')) });
  } catch (e) {
    if (e && e.user) return JSON.stringify({ error: e.message, session: !!e.session });
    console.error(e && e.stack ? e.stack : e);
    return JSON.stringify({ error: 'Algo ha fallado en el servidor. Prueba otra vez.' });
  }
}

var ACTIONS = {
  login: function (a) {
    return locked_(function () {
      var u = norm_(a.user), now = Date.now();
      var t = table_('Alumnos'), i = t.find(function (r) { return r.usuario === u; });
      if (i < 0) { hash_(String(a.pass || ''), 'x'); throw userError_('Usuario o contraseña incorrectos.'); }
      var s = t.rows[i];
      if (s.bloqueado_hasta && Number(s.bloqueado_hasta) > now) throw userError_('Demasiados intentos fallidos. Espera unos minutos.');
      if (hash_(String(a.pass || ''), s.sal) !== s.hash) {
        var f = Number(s.fallos || 0) + 1;
        t.update(i, f >= 8 ? { fallos: 0, bloqueado_hasta: now + 15 * 60000 } : { fallos: f });
        throw userError_('Usuario o contraseña incorrectos.');
      }
      if (Number(s.fallos) || s.bloqueado_hasta) t.update(i, { fallos: 0, bloqueado_hasta: '' });
      return { token: newSession_(s.id, a.remember !== false), user: pub_(s), abs: absList_(s.id) };
    });
  },

  register: function (a) {
    return locked_(function () {
      var n = String(a.name || '').trim(), u = norm_(a.user), p = String(a.pass || ''), c = String(a.code || '').trim();
      if (!n || !u || !p || !c) throw userError_('Rellena todos los campos.');
      if (/\s/.test(u)) throw userError_('El usuario no puede tener espacios.');
      if (!/^[a-z0-9._-]{2,30}$/.test(u)) throw userError_('El usuario solo puede llevar letras sin tilde, números, punto, guion o guion bajo.');
      if (n.length > 60) throw userError_('El nombre es demasiado largo.');
      if (p.length < 4) throw userError_('La contraseña necesita al menos 4 caracteres.');
      if (p.length > 72) throw userError_('La contraseña es demasiado larga.');
      if (c.toUpperCase() !== String(config_('codigo_clase')).trim().toUpperCase()) throw userError_('Ese código de clase no es válido.');
      var t = table_('Alumnos');
      if (t.rows.length >= Number(config_('max_alumnos') || 60)) throw userError_('La clase ya está completa. Habla con quien gestiona la app.');
      if (t.find(function (r) { return r.usuario === u; }) >= 0) throw userError_('Ese usuario ya existe.');
      var salt = randomHex_(), s = { id: Utilities.getUuid(), usuario: u, nombre: n, sal: salt, hash: hash_(p, salt), fallos: 0, bloqueado_hasta: '', creado: new Date().toISOString() };
      t.append([s]);
      return { token: newSession_(s.id, true), user: pub_(s), abs: [] };
    });
  },

  me: function (a) {
    var sid = sid_(a.token), t = table_('Alumnos'), i = t.find(function (r) { return r.id === sid; });
    if (i < 0) throw userError_('Tu sesión ha caducado. Vuelve a entrar.', true);
    return { user: pub_(t.rows[i]), abs: absList_(sid) };
  },

  // ── Perfil ──
  setPhoto: function (a) {
    var foto = String(a.foto || '');
    if (foto && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(foto) || foto.length > 45000)) throw userError_('La foto no es válida.');
    return locked_(function () { var m = me_(a.token); m.t.update(m.i, { foto: foto }); return pub_(m.t.rows[m.i]); });
  },
  setShare: function (a) {
    return locked_(function () { var m = me_(a.token); m.t.update(m.i, { compartir: a.share ? '1' : '' }); return pub_(m.t.rows[m.i]); });
  },

  // ── Compañeros ──
  people: function (a) {
    var m = me_(a.token), faltas = table_('Faltas').rows;
    return m.t.rows.map(function (r) {
      var share = r.compartir === '1', res = null;
      if (share) { res = {}; faltas.forEach(function (f) { if (f.alumno_id === r.id) res[f.modulo] = (res[f.modulo] || 0) + 1; }); }
      return { user: r.usuario, name: r.nombre, foto: r.foto || '', share: share, resumen: res, me: r.id === m.sid, admin: isAdmin_(r.usuario) };
    }).sort(function (x, y) { return x.name.localeCompare(y.name, 'es'); });
  },

  // ── Tablón ──
  board: function (a) {
    var m = me_(a.token), who = names_(), likes = {}, mine = {};
    table_('Reacciones').rows.forEach(function (r) { likes[r.post_id] = (likes[r.post_id] || 0) + 1; if (r.alumno_id === m.sid) mine[r.post_id] = true; });
    var rows = table_('Tablon').rows.slice(-300);
    return rows.map(function (r) {
      return { id: Number(r.id), user: who[r.alumno_id] || '?', text: r.texto, mod: r.modulo, parent: r.padre ? Number(r.padre) : null, at: r.creado, likes: likes[r.id] || 0, liked: !!mine[r.id] };
    });
  },
  post: function (a) {
    var m = me_(a.token), text = cleanText_(a.text, 1000), mod = MODS.indexOf(a.mod) >= 0 ? a.mod : '';
    throttle_('post', m.sid, 5);
    return locked_(function () {
      var t = table_('Tablon'), parent = '';
      if (a.parent) {
        var pi = t.find(function (r) { return String(r.id) === String(a.parent) && !r.padre; });
        if (pi < 0) throw userError_('Esa publicación ya no existe.');
        parent = t.rows[pi].id;
      }
      t.append([{ id: nextId_(t), alumno_id: m.sid, texto: text, modulo: mod, padre: parent, creado: new Date().toISOString() }]);
      return ACTIONS.board(a);
    });
  },
  like: function (a) {
    var m = me_(a.token);
    return locked_(function () {
      var t = table_('Reacciones'), id = String(a.id), had = false;
      t.removeWhere(function (r) { if (r.post_id === id && r.alumno_id === m.sid) { had = true; return true; } return false; });
      if (!had) t.append([{ post_id: id, alumno_id: m.sid }]);
      return ACTIONS.board(a);
    });
  },
  delPost: function (a) {
    var m = me_(a.token), id = String(a.id);
    return locked_(function () {
      var t = table_('Tablon'), i = t.find(function (r) { return String(r.id) === id; });
      if (i >= 0) {
        if (t.rows[i].alumno_id !== m.sid && !m.admin) throw userError_('Solo puedes borrar lo que has publicado tú.');
        var gone = {}; gone[id] = true;
        t.removeWhere(function (r) { if (String(r.id) === id || r.padre === id) { gone[r.id] = true; return true; } return false; });
        table_('Reacciones').removeWhere(function (r) { return gone[r.post_id]; });
      }
      return ACTIONS.board(a);
    });
  },

  // ── Chat ──
  chat: function (a) {
    me_(a.token);
    var who = names_(), since = Number(a.since) || 0;
    return table_('Chat').rows.slice(-200)
      .filter(function (r) { return Number(r.id) > since; })
      .map(function (r) { return { id: Number(r.id), user: who[r.alumno_id] || '?', text: r.texto, at: r.creado }; });
  },
  send: function (a) {
    var m = me_(a.token), text = cleanText_(a.text, 500);
    throttle_('chat', m.sid, 1);
    return locked_(function () {
      var t = table_('Chat');
      t.append([{ id: nextId_(t), alumno_id: m.sid, texto: text, creado: new Date().toISOString() }]);
      return ACTIONS.chat(a);
    });
  },
  delMsg: function (a) {
    var m = me_(a.token), id = String(a.id);
    return locked_(function () {
      var t = table_('Chat'), i = t.find(function (r) { return String(r.id) === id; });
      if (i >= 0 && t.rows[i].alumno_id !== m.sid && !m.admin) throw userError_('Solo puedes borrar tus mensajes.');
      t.removeWhere(function (r) { return String(r.id) === id; });
      return { deleted: Number(id) };
    });
  },

  // ── Apuntes ──
  notes: function (a) {
    me_(a.token);
    var who = names_();
    return table_('Apuntes').rows.map(function (r) {
      return { id: Number(r.id), user: who[r.alumno_id] || '?', title: r.titulo, mod: r.modulo, name: r.nombre, type: r.tipo, size: Number(r.tamano) || 0, url: r.url, at: r.creado };
    }).reverse();
  },
  upload: function (a) {
    var m = me_(a.token), title = cleanText_(a.title, 80), mod = MODS.indexOf(a.mod) >= 0 ? a.mod : '';
    var type = String(a.type || ''), name = String(a.name || 'archivo').slice(0, 120);
    if (!NOTE_TYPES[type]) throw userError_('Ese tipo de archivo no se puede subir. Usa PDF, foto, Word, PowerPoint o Excel.');
    var bytes = Utilities.base64Decode(String(a.data || ''));
    if (!bytes.length) throw userError_('El archivo está vacío.');
    if (bytes.length > NOTE_MAX) throw userError_('El archivo pesa demasiado (máximo 8 MB).');
    throttle_('upload', m.sid, 10);
    var file = notesFolder_().createFile(Utilities.newBlob(bytes, type, name));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return locked_(function () {
      var t = table_('Apuntes');
      t.append([{ id: nextId_(t), alumno_id: m.sid, titulo: title, modulo: mod, file_id: file.getId(), nombre: name, tipo: type, tamano: bytes.length, url: file.getUrl(), creado: new Date().toISOString() }]);
      return ACTIONS.notes(a);
    });
  },
  delNote: function (a) {
    var m = me_(a.token), id = String(a.id);
    return locked_(function () {
      var t = table_('Apuntes'), i = t.find(function (r) { return String(r.id) === id; });
      if (i >= 0) {
        if (t.rows[i].alumno_id !== m.sid && !m.admin) throw userError_('Solo puedes borrar los apuntes que has subido tú.');
        try { DriveApp.getFileById(t.rows[i].file_id).setTrashed(true); } catch (e) { /* ya no estaba */ }
        t.removeWhere(function (r) { return String(r.id) === id; });
      }
      return ACTIONS.notes(a);
    });
  },

  logout: function (a) {
    return locked_(function () {
      var t = table_('Sesiones'), h = tokenHash_(a.token);
      t.removeWhere(function (r) { return r.token_hash === h; });
      return null;
    });
  },

  // items: [{mod, date: 'YYYY-MM-DD', slot: 1..6 | null, tag: 'I' | 'J'}]
  add: function (a) {
    var sid = sid_(a.token), items = a.items;
    if (!Array.isArray(items) || items.length < 1 || items.length > 6) throw userError_('Petición no válida.');
    return locked_(function () {
      var t = table_('Faltas'), mine = t.rows.filter(function (r) { return r.alumno_id === sid; });
      if (mine.length + items.length > 600) throw userError_('Has llegado al máximo de faltas que se pueden guardar.');
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var nextId = t.rows.reduce(function (m, r) { return Math.max(m, Number(r.id) || 0); }, 0) + 1;
      var add = [], taken = {};
      mine.forEach(function (r) { if (r.hora !== '') taken[r.fecha + '#' + r.hora] = true; });
      items.forEach(function (it) {
        if (MODS.indexOf(it.mod) < 0) throw userError_('Módulo no válido.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(it.date)) throw userError_('Fecha no válida.');
        var d = new Date(it.date + 'T00:00:00'), diff = (d - today) / DAY;
        if (isNaN(diff) || diff < -400 || diff > 60) throw userError_('Fecha no válida.');
        var slot = it.slot == null || it.slot === '' ? '' : Number(it.slot);
        if (slot !== '' && !(slot >= 1 && slot <= 6 && slot % 1 === 0)) throw userError_('Hora no válida.');
        var tag = it.tag === 'J' ? 'J' : 'I';
        if (slot !== '' && taken[it.date + '#' + slot]) return; // ya estaba apuntada
        if (slot !== '') taken[it.date + '#' + slot] = true;
        add.push({ id: nextId++, alumno_id: sid, modulo: it.mod, fecha: it.date, hora: slot, etiqueta: tag, creada: new Date().toISOString() });
      });
      if (add.length) t.append(add);
      return absList_(sid);
    });
  },

  del: function (a) {
    var sid = sid_(a.token), ids = (a.ids || []).map(String);
    return locked_(function () {
      table_('Faltas').removeWhere(function (r) { return r.alumno_id === sid && ids.indexOf(String(r.id)) >= 0; });
      return absList_(sid);
    });
  },

  setTag: function (a) {
    var sid = sid_(a.token);
    if (a.tag !== 'I' && a.tag !== 'J') throw userError_('Etiqueta no válida.');
    return locked_(function () {
      var t = table_('Faltas'), i = t.find(function (r) { return r.alumno_id === sid && String(r.id) === String(a.id); });
      if (i >= 0) t.update(i, { etiqueta: a.tag });
      return absList_(sid);
    });
  },
};

// ── Sesiones y contraseñas ───────────────────────────────────────────────

function sid_(token) {
  var h = tokenHash_(token), now = Date.now();
  var r = table_('Sesiones').rows.filter(function (s) { return s.token_hash === h && Number(s.caduca) > now; })[0];
  if (!r) throw userError_('Tu sesión ha caducado. Vuelve a entrar.', true);
  return r.alumno_id;
}

function newSession_(alumnoId, remember) {
  var token = randomHex_() + randomHex_(), now = Date.now();
  var t = table_('Sesiones');
  t.removeWhere(function (s) { return Number(s.caduca) < now; });
  t.append([{ token_hash: tokenHash_(token), alumno_id: alumnoId, caduca: now + (remember ? 180 * DAY : 12 * 3600 * 1000) }]);
  return token;
}

function tokenHash_(token) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token || ''), Utilities.Charset.UTF_8));
}

// HMAC-SHA256 iterado con sal propia por usuario
function hash_(pass, salt) {
  var key = Utilities.newBlob(salt).getBytes();
  var h = Utilities.computeHmacSha256Signature(Utilities.newBlob(pass).getBytes(), key);
  for (var i = 0; i < HASH_ROUNDS; i++) h = Utilities.computeHmacSha256Signature(h, key);
  return Utilities.base64Encode(h);
}

function randomHex_() { return Utilities.getUuid().replace(/-/g, ''); }
function norm_(u) { return String(u || '').trim().toLowerCase(); }
function pub_(s) { return { user: s.usuario, name: s.nombre, foto: s.foto || '', share: s.compartir === '1', admin: isAdmin_(s.usuario) }; }
// Administradores fijos (el dueño de la app) más los que se añadan en Config → admins
var OWNERS = ['antoniom'];
function isAdmin_(u) { return OWNERS.concat(String(config_('admins') || '').split(',')).map(norm_).indexOf(norm_(u)) >= 0; }

// Añade tablas y columnas nuevas a una hoja ya existente, sin tocar los datos
function migrate_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('SCHEMA') === SCHEMA) return;
  locked_(function () { db_(true); props.setProperty('SCHEMA', SCHEMA); });
}

// Evita ráfagas: una acción de este tipo cada «s» segundos por alumno
function throttle_(kind, sid, s) {
  var c = CacheService.getScriptCache(), k = kind + '_' + sid;
  if (c.get(k)) throw userError_('Vas muy rápido. Espera un momento.');
  c.put(k, '1', s);
}

function me_(token) {
  var sid = sid_(token), t = table_('Alumnos'), i = t.find(function (r) { return r.id === sid; });
  if (i < 0) throw userError_('Tu sesión ha caducado. Vuelve a entrar.', true);
  return { sid: sid, t: t, i: i, row: t.rows[i], admin: isAdmin_(t.rows[i].usuario) };
}

function names_() {
  var m = {};
  table_('Alumnos').rows.forEach(function (r) { m[r.id] = r.usuario; });
  return m;
}

function cleanText_(s, max) {
  var x = String(s || '').replace(/\r/g, '').replace(/[\u0000-\u0008\u000B-\u001F]/g, '').trim();
  if (!x) throw userError_('Escribe algo antes de enviar.');
  if (x.length > max) throw userError_('El texto es demasiado largo (máximo ' + max + ' caracteres).');
  return x;
}

function nextId_(t) { return t.rows.reduce(function (m, r) { return Math.max(m, Number(r.id) || 0); }, 0) + 1; }

function notesFolder_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('NOTES_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* se borró: se crea otra */ } }
  var f = DriveApp.createFolder('Margen · apuntes de la clase');
  props.setProperty('NOTES_FOLDER', f.getId());
  return f;
}
function userError_(msg, session) { var e = new Error(msg); e.user = true; e.session = !!session; return e; }

function absList_(sid) {
  return table_('Faltas').rows
    .filter(function (r) { return r.alumno_id === sid; })
    .map(function (r) { return { id: Number(r.id), mod: r.modulo, date: r.fecha, slot: r.hora === '' ? null : Number(r.hora), tag: r.etiqueta === 'J' ? 'J' : 'I' }; })
    .sort(function (a, b) { return a.id - b.id; });
}

function config_(k) {
  var r = table_('Config').rows.filter(function (x) { return x.clave === k; })[0];
  return r ? r.valor : '';
}

function locked_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw userError_('Hay mucha gente usando la app. Prueba en unos segundos.');
  try { return fn(); } finally { lock.releaseLock(); }
}

// ── Hoja de cálculo como tabla ───────────────────────────────────────────

var DB_CACHE = null;
function db_(ensure) {
  if (DB_CACHE && !ensure) return DB_CACHE;
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('DB_ID'), ss;
  if (id) ss = SpreadsheetApp.openById(id);
  else { ss = SpreadsheetApp.create('Margen · datos'); props.setProperty('DB_ID', ss.getId()); ensure = true; }
  if (ensure) {
    Object.keys(SHEETS).forEach(function (name) {
      var sh = ss.getSheetByName(name), cols = SHEETS[name].length;
      if (!sh) sh = ss.insertSheet(name);
      sh.getRange(1, 1, sh.getMaxRows(), cols).setNumberFormat('@'); // todo como texto
      sh.getRange(1, 1, 1, cols).setValues([SHEETS[name]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    });
    ss.getSheets().forEach(function (sh) { if (!SHEETS[sh.getName()] && ss.getSheets().length > 1) ss.deleteSheet(sh); });
    var cfg = table_('Config', ss);
    DEFAULTS.forEach(function (d) {
      if (cfg.find(function (r) { return r.clave === d[0]; }) < 0) cfg.append([{ clave: d[0], valor: d[1] }]);
    });
  }
  DB_CACHE = ss;
  return ss;
}

function table_(name, ss) {
  var sh = (ss || db_()).getSheetByName(name);
  if (!sh) { db_(true); sh = db_().getSheetByName(name); }
  var head = SHEETS[name], cols = head.length;
  var last = sh.getLastRow();
  var values = last > 1 ? sh.getRange(2, 1, last - 1, cols).getValues() : [];
  var rows = values.map(function (v) {
    var o = {};
    head.forEach(function (h, j) {
      var x = v[j];
      o[h] = x instanceof Date ? Utilities.formatDate(x, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(x);
    });
    return o;
  });
  var toRow = function (o) { return head.map(function (h) { return o[h] == null ? '' : String(o[h]); }); };
  return {
    rows: rows,
    find: function (fn) { for (var i = 0; i < rows.length; i++) if (fn(rows[i])) return i; return -1; },
    append: function (objs) {
      var start = sh.getLastRow() + 1;
      var r = sh.getRange(start, 1, objs.length, cols);
      r.setNumberFormat('@');
      r.setValues(objs.map(toRow));
      objs.forEach(function (o) { rows.push(JSON.parse(JSON.stringify(toRow(o).reduce(function (m, v, j) { m[head[j]] = v; return m; }, {})))); });
    },
    update: function (i, patch) {
      Object.keys(patch).forEach(function (k) { rows[i][k] = patch[k] == null ? '' : String(patch[k]); });
      sh.getRange(i + 2, 1, 1, cols).setValues([toRow(rows[i])]);
    },
    removeWhere: function (fn) {
      for (var i = rows.length - 1; i >= 0; i--) if (fn(rows[i])) { sh.deleteRow(i + 2); rows.splice(i, 1); }
    },
  };
}
