const COLORS = ['#ff5e5b', '#00cec9', '#fdcb6e'];

const SHAPES = [
  { id: 'atom', name: 'ATOM', grid: [
    '........',
    '..####..',
    '.######.',
    '########',
    '########',
    '.######.',
    '..####..',
    '........',
  ]},
  { id: 'ring', name: 'RING', grid: [
    '........',
    '.######.',
    '#......#',
    '#..##..#',
    '#..##..#',
    '#......#',
    '.######.',
    '........',
  ]},
  { id: 'cross', name: 'CROSS', grid: [
    '...##...',
    '...##...',
    '########',
    '########',
    '...##...',
    '...##...',
    '........',
    '........',
  ]},
  { id: 'star', name: 'STAR', grid: [
    '...##...',
    '..####..',
    '########',
    '########',
    '..####..',
    '...##...',
    '........',
    '........',
  ]},
  { id: 'zig', name: 'ZIG', grid: [
    '##......',
    '##......',
    '..##....',
    '..##....',
    '....##..',
    '....##..',
    '......##',
    '......##',
  ]},
  { id: 'cluster', name: 'CLSTR', grid: [
    '.##..##.',
    '###..###',
    '##....##',
    '........',
    '##....##',
    '###..###',
    '.##..##.',
    '........',
  ]},
];

const STORAGE_KEY = 'iris-molecule-inn:guests';

let guests = loadGuests();
let selectedShape = SHAPES[0].id;
let selectedColor = 0;

const wall = document.getElementById('wall');
const emptyMsg = document.getElementById('emptyMsg');
const guestCount = document.getElementById('guestCount');
const msgCount = document.getElementById('msgCount');
const toast = document.getElementById('toast');

function loadGuests() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveGuests() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(guests)); } catch {}
}

function renderMolecule(canvas, shapeId, colorIdx, size = 8) {
  const ctx = canvas.getContext('2d');
  const shape = SHAPES.find(s => s.id === shapeId) || SHAPES[0];
  canvas.width = size; canvas.height = size;
  ctx.clearRect(0,0,size,size);
  ctx.fillStyle = COLORS[colorIdx ?? 0];
  for (let r = 0; r < size; r++) {
    const row = shape.grid[r] || '';
    for (let c = 0; c < size; c++) {
      if (row[c] === '#') ctx.fillRect(c, r, 1, 1);
    }
  }
}

function buildPickers() {
  const mp = document.getElementById('molPicker');
  mp.innerHTML = '';
  SHAPES.forEach(s => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mol-opt' + (s.id === selectedShape ? ' is-active' : '');
    const c = document.createElement('canvas');
    c.className = 'mol-canvas';
    renderMolecule(c, s.id, selectedColor);
    btn.appendChild(c);
    const lbl = document.createElement('div');
    lbl.style.fontSize = '9px'; lbl.style.textAlign='center'; lbl.style.marginTop='2px';
    lbl.textContent = s.name;
    btn.appendChild(lbl);
    btn.addEventListener('click', () => {
      selectedShape = s.id;
      document.querySelectorAll('.mol-opt').forEach(x=>x.classList.remove('is-active'));
      btn.classList.add('is-active');
      refreshMolCanvases();
    });
    mp.appendChild(btn);
  });

  const cp = document.getElementById('colorPicker');
  cp.innerHTML = '';
  COLORS.forEach((col, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'color-opt' + (i === selectedColor ? ' is-active' : '');
    const sw = document.createElement('div');
    sw.className = 'color-swatch';
    sw.style.background = col;
    btn.appendChild(sw);
    btn.addEventListener('click', () => {
      selectedColor = i;
      document.querySelectorAll('.color-opt').forEach(x=>x.classList.remove('is-active'));
      btn.classList.add('is-active');
      refreshMolCanvases();
    });
    cp.appendChild(btn);
  });
}

function refreshMolCanvases() {
  document.querySelectorAll('.mol-opt canvas').forEach((c, idx) => {
    renderMolecule(c, SHAPES[idx].id, selectedColor);
  });
  document.querySelectorAll('.card__mol').forEach(c => {
    const sid = c.dataset.shape;
    const ci = parseInt(c.dataset.color, 10);
    renderMolecule(c, sid, isNaN(ci) ? 0 : ci);
  });
}

function createCard(g) {
  const card = document.createElement('article');
  card.className = 'card';
  const head = document.createElement('div');
  head.className = 'card__head';
  const canvas = document.createElement('canvas');
  canvas.className = 'card__mol';
  canvas.dataset.shape = g.shape;
  canvas.dataset.color = g.color;
  renderMolecule(canvas, g.shape, g.color);
  const info = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'card__name';
  name.textContent = g.name;
  const time = document.createElement('div');
  time.className = 'card__time';
  time.textContent = new Date(g.ts).toLocaleString();
  info.appendChild(name);
  info.appendChild(time);
  head.appendChild(canvas);
  head.appendChild(info);
  const note = document.createElement('div');
  note.className = 'card__note';
  note.textContent = g.note;
  card.appendChild(head);
  card.appendChild(note);
  const del = document.createElement('button');
  del.className = 'card__del';
  del.textContent = '×';
  del.title = 'remove';
  del.addEventListener('click', () => {
    guests = guests.filter(x => x.id !== g.id);
    saveGuests();
    renderWall();
    toastMsg('removed');
  });
  card.appendChild(del);
  return card;
}

function renderWall() {
  wall.innerHTML = '';
  guests.forEach(g => wall.appendChild(createCard(g)));
  emptyMsg.classList.toggle('hidden', guests.length > 0);
  guestCount.textContent = guests.length;
  msgCount.textContent = guests.length;
}

function toastMsg(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 1600);
}

document.getElementById('checkinForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('nameInput').value.trim();
  const note = document.getElementById('noteInput').value.trim();
  if (!name || !note) { toastMsg('fill all fields'); return; }
  const g = {
    id: 'g_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
    name, note,
    shape: selectedShape,
    color: selectedColor,
    ts: Date.now(),
  };
  guests.unshift(g);
  saveGuests();
  renderWall();
  e.target.reset();
  // re-select defaults after reset? keep selections
  toastMsg('checked in!');
});

document.getElementById('clearBtn').addEventListener('click', () => {
  if (!guests.length) return;
  if (!confirm('clear all guests?')) return;
  guests = [];
  saveGuests();
  renderWall();
  toastMsg('cleared');
});

document.getElementById('exportBtn').addEventListener('click', exportPNG);

function exportPNG() {
  const scale = 4;
  const cardW = 260, cardH = 110, gap = 16, cols = 3;
  const rows = Math.ceil(guests.length / cols) || 1;
  const w = cols * cardW + (cols+1)*gap;
  const h = 80 + rows * (cardH + gap) + gap;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale; canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0,0,w,h);
  ctx.fillStyle = '#ff5e5b';
  ctx.font = 'bold 24px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('IRIS MOLECULE INN', w/2, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '10px "Courier New", monospace';
  ctx.fillText(guests.length + ' guests', w/2, 58);

  guests.forEach((g, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gap + col * (cardW + gap);
    const y = 70 + row * (cardH + gap);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, cardW, cardH);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x+1, y+1, cardW-2, cardH-2);
    const shape = SHAPES.find(s=>s.id===g.shape) || SHAPES[0];
    const ms = 8;
    const mx = x + 12, my = y + 12;
    ctx.fillStyle = COLORS[g.color ?? 0];
    for (let r=0;r<ms;r++){
      const rowstr = shape.grid[r]||'';
      for(let c=0;c<ms;c++){
        if(rowstr[c]==='#') ctx.fillRect(mx+c*4, my+r*4, 4, 4);
      }
    }
    ctx.fillStyle = '#fdcb6e';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(String(g.name).slice(0,18), x+52, y+26);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '9px "Courier New", monospace';
    ctx.fillText(new Date(g.ts).toLocaleDateString(), x+52, y+42);
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px "Courier New", monospace';
    wrapText(ctx, g.note, x+12, y+62, cardW-24, 14, 4);
  });

  const link = document.createElement('a');
  link.download = 'iris-molecule-inn.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  toastMsg('exported');
}

function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = String(text).split(' ');
  let line = '';
  let yy = y;
  let lines = 0;
  for (let i=0;i<words.length;i++){
    const test = line + (line?' ':'') + words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = words[i]; yy += lineH; lines++;
      if (lines >= maxLines) { ctx.fillText(line + '…', x, yy); return; }
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

document.getElementById('shareBtn').addEventListener('click', () => {
  try {
    const data = btoa(unescape(encodeURIComponent(JSON.stringify(guests))));
    const base = location.href.split('#')[0];
    const url = base + '#data=' + data;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => toastMsg('link copied')).catch(()=> {
        prompt('copy this link:', url);
      });
    } else {
      prompt('copy this link:', url);
    }
  } catch (e) {
    toastMsg('share failed');
  }
});

(function importHash() {
  const m = location.hash.match(/data=([^&]+)/);
  if (!m) return;
  try {
    const json = decodeURIComponent(escape(atob(m[1])));
    const arr = JSON.parse(json);
    if (Array.isArray(arr) && arr.length) {
      const ids = new Set(guests.map(g=>g.id));
      let added = 0;
      arr.forEach(g => { if (!ids.has(g.id)) { guests.push(g); ids.add(g.id); added++; } });
      guests.sort((a,b)=> (b.ts||0)-(a.ts||0));
      saveGuests();
      if (added) toastMsg('imported ' + added);
    }
  } catch {}
})();

buildPickers();
renderWall();
