// ── DATA ──────────────────────────────────────────────────────────────────────
const SUBJECTS = [
  { name: 'Matemática A',      color: '#f4b8c1' },
  { name: 'ICB 1',             color: '#c9b8e8' },
  { name: 'Química General 1', color: '#b8ddd0' },
  { name: 'Otro',              color: '#e2d9cf' },
];

const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

let sessions = JSON.parse(localStorage.getItem('hexnote_sessions') || '[]');
let timerInterval = null;
let timerStart = null;
let timerSeconds = 0;
let running = false;

// ── INIT ──────────────────────────────────────────────────────────────────────
function init() {
  const now = new Date();
  document.getElementById('datePill').textContent =
    now.toLocaleDateString('es-UY', { weekday:'long', day:'numeric', month:'long' });

  const sel = document.getElementById('subjectSelect');
  SUBJECTS.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name;
    sel.appendChild(opt);
  });

  render();
}

// ── TIMER ─────────────────────────────────────────────────────────────────────
function startTimer() {
  if (running) return;
  running = true;
  timerStart = Date.now() - timerSeconds * 1000;
  timerInterval = setInterval(tick, 1000);
  document.getElementById('startBtn').disabled = true;
  document.getElementById('stopBtn').disabled = false;
  document.getElementById('logBtn').disabled = false;
  document.getElementById('timerDisplay').classList.add('running');
}

function stopTimer() {
  if (!running) return;
  clearInterval(timerInterval);
  running = false;
  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled = true;
  document.getElementById('timerDisplay').classList.remove('running');
}

function tick() {
  timerSeconds = Math.floor((Date.now() - timerStart) / 1000);
  const h = Math.floor(timerSeconds / 3600);
  const m = Math.floor((timerSeconds % 3600) / 60);
  const s = timerSeconds % 60;
  document.getElementById('timerDisplay').textContent =
    `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function pad(n) { return String(n).padStart(2,'0'); }

function logSession() {
  if (timerSeconds < 10) return;
  const subject = document.getElementById('subjectSelect').value;
  const note = document.getElementById('noteInput').value.trim();
  addSession(subject, timerSeconds, note);
  stopTimer();
  timerSeconds = 0;
  document.getElementById('timerDisplay').textContent = '00:00:00';
  document.getElementById('logBtn').disabled = true;
  document.getElementById('noteInput').value = '';
}

function logManual() {
  const h = parseInt(document.getElementById('manHours').value) || 0;
  const m = parseInt(document.getElementById('manMins').value) || 0;
  const secs = h * 3600 + m * 60;
  if (secs <= 0) return;
  const subject = document.getElementById('subjectSelect').value;
  addSession(subject, secs, '(manual)');
  document.getElementById('manHours').value = '';
  document.getElementById('manMins').value = '';
}

// ── DATA OPS ──────────────────────────────────────────────────────────────────
function addSession(subject, secs, note) {
  sessions.unshift({
    id: Date.now(),
    subject,
    secs,
    note,
    date: new Date().toISOString()
  });
  save();
  render();
}

function deleteSession(id) {
  sessions = sessions.filter(s => s.id !== id);
  save();
  render();
}

function clearAll() {
  if (!confirm('¿Limpiar todo el historial?')) return;
  sessions = [];
  save();
  render();
}

function save() {
  localStorage.setItem('hexnote_sessions', JSON.stringify(sessions));
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function fmtTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function subjectColor(name) {
  return (SUBJECTS.find(s => s.name === name) || SUBJECTS.at(-1)).color;
}

function sameDay(a, b) {
  return a.getFullYear()===b.getFullYear() &&
         a.getMonth()===b.getMonth() &&
         a.getDate()===b.getDate();
}

function getWeekDates() {
  const now = new Date();
  const day = now.getDay();
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - day + i);
    dates.push(d);
  }
  return dates;
}

function render() {
  const now = new Date();

  // STATS
  const todaySessions = sessions.filter(s => sameDay(new Date(s.date), now));
  const todaySecs = todaySessions.reduce((a,s) => a+s.secs, 0);
  document.getElementById('statToday').textContent = fmtTime(todaySecs);
  document.getElementById('statTodaySessions').textContent = `${todaySessions.length} sesión${todaySessions.length!==1?'es':''}`;

  const weekDates = getWeekDates();
  const weekSessions = sessions.filter(s => {
    const d = new Date(s.date);
    return d >= weekDates[0] && d <= weekDates[6];
  });
  const weekSecs = weekSessions.reduce((a,s) => a+s.secs, 0);
  const weekActiveDays = new Set(weekSessions.map(s => new Date(s.date).toDateString())).size;
  document.getElementById('statWeek').textContent = fmtTime(weekSecs);
  document.getElementById('statWeekDays').textContent = `${weekActiveDays} día${weekActiveDays!==1?'s':''} activo${weekActiveDays!==1?'s':''}`;

  const totalSecs = sessions.reduce((a,s) => a+s.secs, 0);
  document.getElementById('statTotal').textContent = fmtTime(totalSecs);
  document.getElementById('statTotalSessions').textContent = `${sessions.length} sesión${sessions.length!==1?'es':''}`;

  // HEX WEEK
  const hexWrap = document.getElementById('hexWeek');
  hexWrap.innerHTML = '';
  const palette = ['#f4b8c1','#c9b8e8','#b8ddd0','#f7ccb0','#b8d4e8','#f0dfa0','#d4b8e8'];
  weekDates.forEach((d, i) => {
    const daySecs = sessions
      .filter(s => sameDay(new Date(s.date), d))
      .reduce((a,s) => a+s.secs, 0);
    const h = Math.floor(daySecs / 3600);
    const m = Math.floor((daySecs % 3600) / 60);
    const intensity = Math.min(daySecs / (6*3600), 1);
    const isToday = sameDay(d, now);

    const wrapper = document.createElement('div');
    wrapper.className = 'hex-day';

    const baseColor = palette[i];
    const fillColor = daySecs === 0
      ? 'var(--surface2)'
      : blendHex(baseColor, intensity);

    wrapper.innerHTML = `
      <div class="hex-shape ${isToday ? 'hex-today' : ''}">
        <div class="hex-border"></div>
        <div class="hex-inner" style="background:${fillColor}">
          <span class="hex-hours">${daySecs>0 ? (h>0?h+'h':m+'m') : '—'}</span>
        </div>
      </div>
      <span class="hex-day-label">${DAYS[d.getDay()]}</span>
    `;
    hexWrap.appendChild(wrapper);
  });

  // LOG LIST
  const logList = document.getElementById('logList');
  logList.innerHTML = '';
  if (sessions.length === 0) {
    logList.innerHTML = '<div class="empty-state">sin sesiones aún · inicia el timer ↑</div>';
  } else {
    sessions.slice(0, 30).forEach(s => {
      const el = document.createElement('div');
      el.className = 'log-entry';
      const d = new Date(s.date);
      const timeStr = d.toLocaleTimeString('es-UY', {hour:'2-digit',minute:'2-digit'});
      const dateStr = sameDay(d, now) ? 'hoy ' + timeStr : d.toLocaleDateString('es-UY',{day:'numeric',month:'short'}) + ' ' + timeStr;
      el.innerHTML = `
        <span class="entry-dot" style="background:${subjectColor(s.subject)}"></span>
        <div>
          <div class="entry-subject">${s.subject}</div>
          <div class="entry-note">${s.note || dateStr}</div>
        </div>
        <span class="entry-duration">${fmtTime(s.secs)}</span>
        <button class="entry-delete" onclick="deleteSession(${s.id})">✕</button>
      `;
      logList.appendChild(el);
    });
  }

  // BREAKDOWN
  const breakdown = document.getElementById('breakdownList');
  breakdown.innerHTML = '';
  const bySubject = {};
  sessions.forEach(s => {
    bySubject[s.subject] = (bySubject[s.subject] || 0) + s.secs;
  });
  const maxSecs = Math.max(...Object.values(bySubject), 1);
  const sorted = Object.entries(bySubject).sort((a,b) => b[1]-a[1]);
  if (sorted.length === 0) {
    breakdown.innerHTML = '<div class="empty-state">sin datos aún</div>';
  } else {
    sorted.forEach(([name, secs]) => {
      const pct = (secs / maxSecs * 100).toFixed(1);
      const color = subjectColor(name);
      const el = document.createElement('div');
      el.className = 'breakdown-row';
      el.innerHTML = `
        <span class="brow-dot" style="background:${color}"></span>
        <div class="brow-bar-wrap">
          <span class="brow-label">${name}</span>
          <div class="brow-bar-bg">
            <div class="brow-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
        </div>
        <span class="brow-time">${fmtTime(secs)}</span>
      `;
      breakdown.appendChild(el);
    });
  }
}

function blendHex(hex, t) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  const bg = 0xf0;
  const rr = Math.round(bg + (r-bg)*t*(0.4+0.6*t));
  const gg = Math.round(bg + (g-bg)*t*(0.4+0.6*t));
  const bb = Math.round(bg + (b-bg)*t*(0.4+0.6*t));
  return `rgb(${rr},${gg},${bb})`;
}

init();
