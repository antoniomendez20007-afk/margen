// Horario de 2º Marketing y Publicidad A · IES Las Salinas.
// Cuando cambie el horario, solo hay que tocar WEEK (y MODS si cambia un profesor).

// s / e = minuto del día en que empieza / acaba cada tramo
export const SLOTS = [
  { a: '8:10', b: '9:10', s: 490, e: 550 },
  { a: '9:10', b: '10:10', s: 550, e: 610 },
  { a: '10:40', b: '11:40', s: 640, e: 700 },
  { a: '11:40', b: '12:40', s: 700, e: 760 },
  { a: '12:40', b: '13:40', s: 760, e: 820 },
  { a: '13:40', b: '14:40', s: 820, e: 880 },
];
export const BREAK = { a: '10:10', b: '10:40', s: 610, e: 640, after: 1 };

// Una fila por día (lunes → viernes), una columna por tramo
export const WEEK = [
  ['MD', 'MD', 'TCIC', 'TCIC', 'OGS', 'RPOE'],
  ['MD', 'PIMP', 'PIMP', 'OGS', 'IPE2', 'IPE2'],
  ['TCIC', 'OGS', 'DEMC', 'DEMC', 'LPS', 'LPS'],
  ['MD', 'MD', 'MSC', 'MSC', 'DEMC', 'LPS'],
  ['MD', 'MSC', 'RPOE', 'RPOE', 'DEMC', 'IPE2'],
];

// Colores validados con la skill dataviz: distinguibles con daltonismo (protanopia y deuteranopia)
// y con contraste suficiente en modo claro y oscuro. El texto encima (fg) es el de más contraste.
export const MODS = {
  MD: { name: 'Marketing digital', short: 'Marketing digital', prof: 'José Manuel Oneto Mariscal', ps: 'J. M. Oneto', max: 26, c: '#c77f0c', fg: '#15110E' },
  DEMC: { name: 'Diseño y elaboración de material de comunicación', short: 'Diseño mat. comunicación', prof: 'Aroa Fernández Jaén', ps: 'A. Fernández', max: 17, c: '#ae414b', fg: '#fff' },
  TCIC: { name: 'Trabajo de campo en investigación comercial', short: 'Trabajo de campo', prof: 'María Mercedes Lobo López', ps: 'M. M. Lobo', max: 13, c: '#0590da', fg: '#15110E' },
  MSC: { name: 'Medios y soportes de comunicación', short: 'Medios y soportes', prof: 'Natalia Salcedo López (tutora)', ps: 'N. Salcedo', max: 13, c: '#1d845b', fg: '#fff' },
  RPOE: { name: 'Relaciones públicas y organización de eventos', short: 'RR. PP. y eventos', prof: 'Juana María Partal Pancorbo', ps: 'J. M. Partal', max: 13, c: '#8f59ab', fg: '#fff' },
  LPS: { name: 'Lanzamiento de productos y servicios', short: 'Lanzamiento productos', prof: 'Juana María Partal Pancorbo', ps: 'J. M. Partal', max: 13, c: '#888322', fg: '#15110E' },
  IPE2: { name: 'Itinerario personal para la empleabilidad II', short: 'Empleabilidad II', prof: 'Inmaculada García Ortega', ps: 'I. García', max: 13, c: '#0da1b1', fg: '#15110E' },
  OGS: { name: 'Optativa', short: 'Optativa', prof: 'Natalia Salcedo López (tutora)', ps: 'N. Salcedo', max: 13, c: '#ae517b', fg: '#fff' },
  PIMP: { name: 'Proyecto intermodular', short: 'Proyecto intermodular', prof: 'Aroa Fernández Jaén', ps: 'A. Fernández', max: 8, c: '#6378c5', fg: '#15110E' },
};
export const ORDER = ['MD', 'DEMC', 'TCIC', 'MSC', 'RPOE', 'LPS', 'IPE2', 'OGS', 'PIMP'];

export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const WD = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const WDL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const pad = (n) => String(n).padStart(2, '0');
export const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
// 0 = lunes … 4 = viernes; -1 = fin de semana
export const wdIdx = (d) => { const w = d.getDay(); return w === 0 || w === 6 ? -1 : w - 1; };
