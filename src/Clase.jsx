import { useEffect, useMemo, useRef, useState } from 'react';
import { api, token, ApiError } from './api.js';
import { MODS, ORDER } from './data.js';
import { Icon, Gauge, Chip, Dot, Avatar, timeAgo } from './ui.jsx';

// Pestaña «Clase»: tablón, chat de grupo, apuntes compartidos y compañeros.

const SECTIONS = [['tablon', 'Tablón'], ['chat', 'Chat'], ['apuntes', 'Apuntes'], ['gente', 'Compañeros']];

export default function Clase({ me, people, loadPeople, showToast, onSession, wide }) {
  const [sec, setSec] = useState('tablon');
  const byUser = useMemo(() => Object.fromEntries(people.map((p) => [p.user, p])), [people]);
  const person = (u) => byUser[u] || (u === me.user ? me : { user: u, name: u });

  useEffect(() => { loadPeople(); }, []);

  // Llama al servidor y avisa de los errores; null si ha fallado
  const call = async (fn) => {
    try { return await fn(token.get()); }
    catch (e) {
      if (e instanceof ApiError && e.session) onSession(e.message);
      else showToast(e.message || 'Algo ha fallado.');
      return null;
    }
  };
  const p = { me, person, call, showToast, wide };

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="chips" role="tablist" aria-label="Secciones de la clase">
        {SECTIONS.map(([id, l]) => (
          <button key={id} role="tab" className="chip" aria-selected={sec === id} onClick={() => setSec(id)}
            style={sec === id ? { background: 'var(--accent)', color: 'var(--onAccent)', borderColor: 'transparent' } : undefined}>
            {l}{id === 'gente' && people.length ? ` · ${people.length}` : ''}
          </button>
        ))}
      </div>
      {sec === 'tablon' && <Tablon {...p} />}
      {sec === 'chat' && <Chat {...p} />}
      {sec === 'apuntes' && <Apuntes {...p} />}
      {sec === 'gente' && <Gente people={people} me={me} />}
    </div>
  );
}

// Selector de asignatura en pastillas pequeñas
function ModPicker({ value, onChange, none = 'General' }) {
  return (
    <div className="chips" style={{ gap: 6 }}>
      {['', ...ORDER].map((m) => (
        <button key={m || 'none'} type="button" className="chip" aria-pressed={value === m} onClick={() => onChange(m)}
          style={{ height: 34, padding: '0 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          {m && <Dot c={MODS[m].c} />}{m || none}
        </button>
      ))}
    </div>
  );
}

const ModTag = ({ m }) => m ? (
  <span className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--surface2)', color: 'var(--ink)', fontWeight: 500 }}><Dot c={MODS[m].c} s={7} />{m}</span>
) : null;

// ── Tablón ───────────────────────────────────────────────────────────────

function Tablon({ me, person, call, showToast }) {
  const [posts, setPosts] = useState(null);
  const [text, setText] = useState(''), [mod, setMod] = useState(''), [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null), [reply, setReply] = useState('');

  const load = async () => { const r = await call((t) => api.board(t)); if (r) setPosts(r); };
  useEffect(() => { load(); }, []);

  const publish = async (e) => {
    e.preventDefault(); if (!text.trim() || busy) return;
    setBusy(true); const r = await call((t) => api.post(t, text, mod, null)); setBusy(false);
    if (r) { setPosts(r); setText(''); setMod(''); }
  };
  const answer = async (id) => {
    if (!reply.trim() || busy) return;
    setBusy(true); const r = await call((t) => api.post(t, reply, '', id)); setBusy(false);
    if (r) { setPosts(r); setReply(''); }
  };
  const like = async (id) => {
    setPosts((ps) => ps.map((x) => (x.id === id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x)));
    const r = await call((t) => api.like(t, id)); if (r) setPosts(r); else load();
  };
  const del = async (id) => {
    if (!window.confirm('¿Borrar esta publicación? Se borrarán también sus respuestas.')) return;
    const r = await call((t) => api.delPost(t, id)); if (r) { setPosts(r); showToast('Publicación borrada'); }
  };

  const top = (posts || []).filter((x) => !x.parent).sort((a, b) => b.id - a.id);
  const replies = (id) => (posts || []).filter((x) => x.parent === id).sort((a, b) => a.id - b.id);
  const canDel = (x) => x.user === me.user || me.admin;

  return (
    <div className="col" style={{ gap: 12 }}>
      <form className="panel" onSubmit={publish} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Avatar person={me} size={38} />
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={text ? 3 : 1} aria-label="Escribe una publicación"
            placeholder="Escribe algo para la clase…" className="textin" />
        </div>
        {text && <ModPicker value={mod} onChange={setMod} />}
        {text && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="muted num" style={{ fontSize: 12 }}>{text.length}/1000</span>
            <button className="btn-main center" style={{ height: 44, padding: '0 18px', fontSize: 15 }} disabled={busy}><Icon name="send" size={18} />Publicar</button>
          </div>
        )}
      </form>

      {posts === null && <div className="panel soft-box muted">Cargando el tablón…</div>}
      {posts && !top.length && <div className="panel soft-box">Aún no hay nada. Estrena el tablón con un aviso para la clase.</div>}
      {top.map((x) => {
        const who = person(x.user), rs = replies(x.id), isOpen = open === x.id;
        return (
          <article key={x.id} className="panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar person={who} size={38} />
              <span className="col" style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{who.name}</span>
                <span className="muted" style={{ fontSize: 12 }}>{timeAgo(x.at)}</span>
              </span>
              <ModTag m={x.mod} />
            </header>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{x.text}</p>
            <footer style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="chip" aria-pressed={x.liked} onClick={() => like(x.id)} aria-label={x.liked ? 'Quitar me gusta' : 'Me gusta'}
                style={{ height: 36, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6, color: x.liked ? 'var(--badText)' : undefined }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={x.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" /></svg>
                <span className="num">{x.likes || ''}</span>
              </button>
              <button className="chip" aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? null : x.id); setReply(''); }} style={{ height: 36, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="reply" size={18} />{rs.length ? `${rs.length} ${rs.length === 1 ? 'respuesta' : 'respuestas'}` : 'Responder'}
              </button>
              {canDel(x) && <button className="round" style={{ marginLeft: 'auto', width: 36, height: 36 }} aria-label="Borrar publicación" onClick={() => del(x.id)}><Icon name="trash" size={17} /></button>}
            </footer>
            {isOpen && (
              <div className="col" style={{ gap: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                {rs.map((r) => {
                  const rw = person(r.user);
                  return (
                    <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <Avatar person={rw} size={30} />
                      <div className="col" style={{ flex: 1, minWidth: 0, gap: 2, background: 'var(--surface2)', borderRadius: 16, padding: '8px 12px' }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{rw.name} <span className="muted" style={{ fontWeight: 400 }}>· {timeAgo(r.at)}</span></span>
                        <span style={{ fontSize: 14, lineHeight: 1.4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.text}</span>
                      </div>
                      {canDel(r) && <button className="del-btn" style={{ width: 32, height: 32 }} aria-label="Borrar respuesta" onClick={() => del(r.id)}><Icon name="close" size={14} /></button>}
                    </div>
                  );
                })}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="textin" style={{ height: 42, borderRadius: 999, padding: '0 16px' }} value={reply} maxLength={1000} onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); answer(x.id); } }} placeholder="Escribe una respuesta…" aria-label="Respuesta" />
                  <button className="round accent" aria-label="Enviar respuesta" disabled={busy || !reply.trim()} onClick={() => answer(x.id)}><Icon name="send" size={18} /></button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

// ── Chat de grupo ────────────────────────────────────────────────────────

function Chat({ me, person, call, wide }) {
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState(''), [busy, setBusy] = useState(false);
  const last = useRef(0), end = useRef(null);

  const merge = (list) => {
    if (!list || list.deleted) return;
    setMsgs((old) => {
      const m = new Map((old || []).map((x) => [x.id, x]));
      list.forEach((x) => m.set(x.id, x));
      const all = [...m.values()].sort((a, b) => a.id - b.id).slice(-200);
      last.current = all.length ? all[all.length - 1].id : 0;
      return all;
    });
  };
  const poll = async () => { const r = await call((t) => api.chat(t, last.current)); if (r) merge(r); else setMsgs((m) => m || []); };

  // Mira si hay mensajes nuevos cada 12 s mientras el chat está a la vista
  useEffect(() => {
    poll();
    const iv = setInterval(() => { if (document.visibilityState === 'visible') poll(); }, 12000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs?.length]);

  const send = async (e) => {
    e.preventDefault(); if (!text.trim() || busy) return;
    setBusy(true); const r = await call((t) => api.send(t, text, last.current)); setBusy(false);
    if (r) { merge(r); setText(''); }
  };
  const del = async (id) => {
    if (!window.confirm('¿Borrar este mensaje?')) return;
    const r = await call((t) => api.delMsg(t, id)); if (r) setMsgs((m) => m.filter((x) => x.id !== id));
  };

  return (
    <div className="col" style={{ gap: 6, paddingBottom: wide ? 0 : 70 }}>
      {msgs === null && <div className="panel soft-box muted">Cargando el chat…</div>}
      {msgs && !msgs.length && <div className="panel soft-box">Aún no hay mensajes. Saluda a la clase.</div>}
      {(msgs || []).map((m, i) => {
        const mine = m.user === me.user, prev = msgs[i - 1], first = !prev || prev.user !== m.user, who = person(m.user);
        return (
          <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', justifyContent: mine ? 'flex-end' : 'flex-start', marginTop: first ? 8 : 0 }}>
            {!mine && (first ? <Avatar person={who} size={30} /> : <span style={{ width: 30, flex: 'none' }} />)}
            <div className="col" style={{ maxWidth: '76%', alignItems: mine ? 'flex-end' : 'flex-start', gap: 2 }}>
              {first && !mine && <span className="muted" style={{ fontSize: 12, fontWeight: 500, paddingLeft: 10 }}>{who.name}</span>}
              <div onDoubleClick={() => (mine || me.admin) && del(m.id)}
                style={{ padding: '9px 13px', borderRadius: 20, borderBottomRightRadius: mine ? 6 : 20, borderBottomLeftRadius: mine ? 20 : 6, fontSize: 15, lineHeight: 1.35, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                  background: mine ? 'var(--accent)' : 'var(--surface)', color: mine ? 'var(--onAccent)' : 'var(--ink)', border: mine ? 0 : '1px solid var(--line)' }}>
                {m.text}
              </div>
              <span className="muted" style={{ fontSize: 11, padding: '0 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
                {timeAgo(m.at)}
                {(mine || me.admin) && <button onClick={() => del(m.id)} style={{ background: 'none', border: 0, color: 'var(--muted)', fontSize: 11, cursor: 'pointer', padding: 0 }}>Borrar</button>}
              </span>
            </div>
          </div>
        );
      })}
      <div ref={end} />
      <form onSubmit={send} className={wide ? 'panel' : 'chatbar'} style={wide ? { padding: 8, display: 'flex', gap: 8, marginTop: 10 } : undefined}>
        <input className="textin" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="Mensaje para la clase" aria-label="Mensaje"
          style={{ height: 46, borderRadius: 999, padding: '0 18px', background: 'var(--surface)' }} />
        <button className="round accent" style={{ width: 46, height: 46 }} aria-label="Enviar mensaje" disabled={busy || !text.trim()}><Icon name="send" size={19} /></button>
      </form>
    </div>
  );
}

// ── Apuntes ──────────────────────────────────────────────────────────────

const EXT = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', doc: 'application/msword', ppt: 'application/vnd.ms-powerpoint', xls: 'application/vnd.ms-excel' };
const kind = (t) => (t.includes('pdf') ? 'PDF' : t.startsWith('image/') ? 'Foto' : t.includes('word') ? 'Word' : t.includes('presentation') || t.includes('powerpoint') ? 'PowerPoint' : t.includes('sheet') || t.includes('excel') ? 'Excel' : 'Texto');
const size = (b) => (b > 1e6 ? (b / 1e6).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');

function Apuntes({ me, person, call, showToast }) {
  const [notes, setNotes] = useState(null), [filter, setFilter] = useState('');
  const [form, setForm] = useState(null), [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { (async () => { const r = await call((t) => api.notes(t)); setNotes(r || []); })(); }, []);

  const pickFile = (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    const type = f.type || EXT[(f.name.split('.').pop() || '').toLowerCase()] || '';
    if (!Object.values(EXT).includes(type)) return showToast('Ese tipo de archivo no se puede subir.');
    if (f.size > 8 * 1024 * 1024) return showToast('El archivo pesa demasiado (máximo 8 MB).');
    setForm({ file: f, type, title: f.name.replace(/\.[^.]+$/, '').slice(0, 80), mod: filter });
  };
  const upload = async (e) => {
    e.preventDefault(); if (!form.title.trim() || busy) return;
    setBusy(true);
    const data = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = ko; r.readAsDataURL(form.file); });
    const r = await call((t) => api.upload(t, { title: form.title, mod: form.mod, name: form.file.name, type: form.type, data }));
    setBusy(false);
    if (r) { setNotes(r); setForm(null); showToast('Apuntes subidos'); }
  };
  const del = async (id) => {
    if (!window.confirm('¿Borrar estos apuntes? El archivo irá a la papelera de Drive.')) return;
    const r = await call((t) => api.delNote(t, id)); if (r) { setNotes(r); showToast('Apuntes borrados'); }
  };

  const shown = (notes || []).filter((n) => !filter || n.mod === filter);
  return (
    <div className="col" style={{ gap: 12 }}>
      <input ref={fileRef} type="file" hidden onChange={pickFile} accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*" />
      {!form && (
        <button className="btn-main" onClick={() => fileRef.current.click()}><span>Subir apuntes</span><span className="go"><Icon name="upload" size={20} /></span></button>
      )}
      {form && (
        <form className="panel" onSubmit={upload} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="round" style={{ background: 'var(--surface2)' }}><Icon name="file" size={20} /></span>
            <span className="col" style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.file.name}</span>
              <span className="muted" style={{ fontSize: 12 }}>{kind(form.type)} · {size(form.file.size)}</span>
            </span>
            <button type="button" className="round" aria-label="Cancelar" onClick={() => setForm(null)}><Icon name="close" size={16} /></button>
          </div>
          <label className="field">Título<input value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <span className="field" style={{ gap: 6 }}>Asignatura<ModPicker value={form.mod} onChange={(m) => setForm({ ...form, mod: m })} none="Varias" /></span>
          <button className="btn-main center" disabled={busy || !form.title.trim()}>{busy ? 'Subiendo…' : 'Subir a la clase'}</button>
          <span className="muted" style={{ fontSize: 12, lineHeight: 1.4 }}>Lo podrá abrir cualquiera que tenga el enlace del archivo. No subas datos personales.</span>
        </form>
      )}

      <ModPicker value={filter} onChange={setFilter} none="Todas" />
      {notes === null && <div className="panel soft-box muted">Cargando apuntes…</div>}
      {notes && !shown.length && <div className="panel soft-box">{filter ? `Aún no hay apuntes de ${filter}.` : 'Aún no hay apuntes. Sube los primeros.'}</div>}
      {shown.length > 0 && (
        <div className="panel" style={{ padding: '2px 0' }}>
          {shown.map((n, i) => {
            const who = person(n.user);
            return (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: i ? '1px solid var(--line)' : 0 }}>
                <span className="tile" style={{ width: 44, height: 44, borderRadius: 14, background: n.mod ? `color-mix(in oklab, ${MODS[n.mod].c} 22%, var(--surface2))` : 'var(--surface2)', color: 'var(--ink)' }}><Icon name="file" size={20} /></span>
                <span className="col" style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.25 }}>{n.title}</span>
                  <span className="muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {n.mod && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Dot c={MODS[n.mod].c} s={7} />{n.mod} ·</span>} {who.name} · {kind(n.type)} · {size(n.size)} · {timeAgo(n.at)}
                  </span>
                </span>
                <a className="round" href={n.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${n.title}`}><Icon name="open" size={18} /></a>
                {(n.user === me.user || me.admin) && <button className="round" aria-label={`Borrar ${n.title}`} onClick={() => del(n.id)}><Icon name="trash" size={17} /></button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Compañeros ───────────────────────────────────────────────────────────

function Gente({ people, me }) {
  const [sel, setSel] = useState(null);
  if (!people.length) return <div className="panel soft-box muted">Cargando compañeros…</div>;
  const sum = (r) => {
    const st = ORDER.map((m) => (r[m] || 0) / MODS[m].max);
    return { red: st.filter((x) => x > 0.8).length, amber: st.filter((x) => x >= 0.5 && x <= 0.8).length, total: Object.values(r).reduce((a, b) => a + b, 0) };
  };
  return (
    <>
      <div className="grid2">
        {people.map((p) => {
          const s = p.share && p.resumen ? sum(p.resumen) : null;
          return (
            <button key={p.user} className="panel" onClick={() => s && setSel(p)} disabled={!s}
              style={{ padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', color: 'var(--ink)', cursor: s ? 'pointer' : 'default' }}>
              <Avatar person={p} size={64} />
              <span className="col" style={{ gap: 1 }}>
                <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>{p.name}{p.me ? ' (tú)' : ''}</span>
                <span className="muted" style={{ fontSize: 12 }}>@{p.user}{p.admin ? ' · admin' : ''}</span>
              </span>
              {s ? (
                <span style={{ display: 'flex', gap: 10, fontSize: 12, fontWeight: 500 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Dot c="var(--bad)" />{s.red}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Dot c="var(--warn)" />{s.amber}</span>
                  <span className="muted num">{s.total} h</span>
                </span>
              ) : <span className="muted" style={{ fontSize: 12 }}>Faltas privadas</span>}
            </button>
          );
        })}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.4 }}>
        Solo ves las faltas de quien ha decidido compartirlas. {me.share ? 'Tú las estás compartiendo.' : 'Tú puedes compartir las tuyas desde tu perfil.'}
      </p>
      {sel && (
        <div className="overlay" onClick={() => setSel(null)} style={{ alignItems: 'flex-end' }}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={`Faltas de ${sel.name}`} onClick={(e) => e.stopPropagation()} style={{ borderRadius: '28px 28px 0 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar person={sel} size={48} />
              <span className="col" style={{ flex: 1 }}><span className="disp" style={{ fontSize: 20 }}>{sel.name}</span><span className="muted" style={{ fontSize: 13 }}>Faltas compartidas</span></span>
              <button className="round" aria-label="Cerrar" onClick={() => setSel(null)}><Icon name="close" size={18} /></button>
            </div>
            <div className="grid2" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
              {ORDER.map((m) => {
                const n = sel.resumen[m] || 0, pct = n / MODS[m].max;
                const c = pct > 1 || pct > 0.8 ? 'var(--bad)' : pct >= 0.5 ? 'var(--warn)' : 'var(--ok)';
                return (
                  <div key={m} className="col" style={{ alignItems: 'center', gap: 4 }}>
                    <Gauge p={pct} color={c} size={64} stroke={6} label={`${m}: ${n} de ${MODS[m].max} horas`}><Chip s={m} size={40} /></Gauge>
                    <span className="muted num" style={{ fontSize: 12 }}>{n}/{MODS[m].max} h</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
