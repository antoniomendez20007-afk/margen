import { MODS } from './data.js';

// Piezas visuales compartidas por todas las pantallas

export const ICONS = {
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
  clase: <><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18.5 20a6.5 6.5 0 0 0-3-5.5" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />,
  reply: <path d="M10 8 5 12.5l5 4.5M5.5 12.5H14a5 5 0 0 1 5 5v1" />,
  send: <path d="M4 12 20 4l-4 16-4-6.5zM12 13.5 20 4" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M4.5 15v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15" />,
  file: <><path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-10z" /><path d="M14 3.5v5h5" /></>,
  camera: <><path d="M4 8.5a2 2 0 0 1 2-2h2l1.5-2h5L16 6.5h2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></>,
  trash: <path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5h6V7" />,
  open: <path d="M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />,
};
export const Icon = ({ name, size = 22, stroke = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
);

// Anillo genérico: p entre 0 y 1
export function Gauge({ p, color, size = 104, stroke = 9, track = 'var(--surface2)', children, label }) {
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


export const Chip = ({ s, size = 36 }) => (
  <span className="tile" style={{ width: size, height: size, borderRadius: 999, background: MODS[s].c, color: MODS[s].fg, fontSize: Math.round(size * 0.3) }}>{s}</span>
);
export const Dot = ({ c, s = 8 }) => <span style={{ width: s, height: s, borderRadius: 99, background: c, flex: 'none' }} />;


// Foto de perfil o, si no hay, la inicial sobre el degradado champán
export const Avatar = ({ person, size = 44, onClick, label }) => {
  const st = { width: size, height: size, fontSize: Math.round(size * 0.4), cursor: onClick ? 'pointer' : 'default', padding: 0, overflow: 'hidden' };
  const inner = person?.foto
    ? <img src={person.foto} alt="" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    : ((person?.name || '?').trim()[0] || '?').toUpperCase();
  return onClick
    ? <button className="avatar" style={st} onClick={onClick} aria-label={label}>{inner}</button>
    : <span className="avatar" style={st} aria-hidden="true">{inner}</span>;
};

// Recorta al centro y reduce la foto a 192 px en JPEG (unos 10-20 KB)
export async function squarePhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const s = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement('canvas');
    c.width = c.height = 192;
    c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 192, 192);
    for (const q of [0.82, 0.7, 0.55, 0.4]) { const d = c.toDataURL('image/jpeg', q); if (d.length < 44000) return d; }
    throw new Error('big');
  } finally { URL.revokeObjectURL(url); }
}

export function timeAgo(iso) {
  const d = new Date(iso), m = Math.round((Date.now() - d) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  if (m < 24 * 60) return `hace ${Math.round(m / 60)} h`;
  if (m < 48 * 60) return 'ayer';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
