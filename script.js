// ── FIREBASE ──────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDOe-FEKErq7F4h8PR7dxRy8Qu3gind0X0",
  authDomain: "nomen-app.firebaseapp.com",
  projectId: "nomen-app",
  storageBucket: "nomen-app.firebasestorage.app",
  messagingSenderId: "298185354477",
  appId: "1:298185354477:web:717913ab9dce10712270e4"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const sessionsCol = db.collection("hexnote").doc("mina").collection("sessions");

// ── DATA ──────────────────────────────────────────────────────────────────────
const SUBJECTS = [
  { name: 'Matemática A',      color: '#a8c8e8', goal: 10 },
  { name: 'ICB 1',             color: '#6aacb0', goal: 5  },
  { name: 'Química General 1', color: '#a8d8b8', goal: 8  },
  { name: 'Otro',              color: '#e2d9cf', goal: null },
];

const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

let sessions = [];
let timerInterval = null;
let timerStart = null;
let timerSeconds = 0;
let running = false;

// ── INIT ──────────────────────────────────────────────────────────────────────
function init() {
  const now = new Date();
  document.getElementById('datePill').textContent =
    now.toLocaleDateString('es-UY', { weekday:'long', day:'numeric', month:'long' });

  subjectSelect    = buildCustomSelect('subjectSelectWrap');
  pomSubjectSelect = buildCustomSelect('pomSubjectSelectWrap');
  pomChangerSelect = buildCustomSelect('pomChangerSelectWrap');

  pomInitPreview();
  pomBackToConfig();
  startSync();
}

// ── FIRESTORE SYNC ────────────────────────────────────────────────────────────
function setSyncStatus(status) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  if (status === 'ok') {
    el.textContent = '● sincronizado';
    el.style.color = '#6aacb0';
  } else if (status === 'saving') {
    el.textContent = '● guardando…';
    el.style.color = 'var(--text-muted)';
  } else {
    el.textContent = '● sin conexión';
    el.style.color = '#e8909e';
  }
}

function startSync() {
  sessionsCol.onSnapshot((snapshot) => {
    sessions = snapshot.docs.map(d => d.data());
    sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
    setSyncStatus('ok');
    render();
  }, (error) => {
    setSyncStatus('error');
  });
}

// ── POMODORO ──────────────────────────────────────────────────────────────────
let pomInterval = null;
let pomSecsLeft = 0;
let pomTotalSecs = 0;
let pomIsWork = true;
let pomRunning = false;
let pomCompletedCount = 0;
let pomTotalPomodoros = 0;
let pomTotalStudySecs = 0;
let pomSubject = '';

function pomCalcPlan() {
  const totalHours = parseInt(document.getElementById('pomTotalHours').value) || 0;
  const totalMins  = parseInt(document.getElementById('pomTotalMins').value)  || 0;
  const totalMin   = totalHours * 60 + totalMins;
  const workMin    = parseInt(document.getElementById('pomWorkMin').value)  || 25;
  const breakMin   = parseInt(document.getElementById('pomBreakMin').value) || 15;
  const n = Math.floor((totalMin + breakMin) / (workMin + breakMin));
  const actualStudy = n * workMin;
  const actualBreak = (n - 1) * breakMin;
  const actualTotal = actualStudy + actualBreak;
  return { n, workMin, breakMin, actualStudy, actualBreak, actualTotal };
}

function pomUpdatePreview() {
  const { n, workMin, breakMin, actualStudy, actualTotal } = pomCalcPlan();
  const el = document.getElementById('pomPlanPreview');
  if (!el) return;
  el.innerHTML = n < 1
    ? '⚠️ El tiempo es muy corto para al menos un pomodoro.'
    : `<b>${n} pomodoro${n>1?'s':''}</b> de ${workMin} min · ${n>1?`${n-1} descanso${n-1>1?'s':''} de ${breakMin} min · `:'sin descansos · '}<b>${actualStudy} min de estudio</b> · ${actualTotal} min en total`;
}

function pomInitPreview() {
  ['pomTotalHours','pomTotalMins','pomWorkMin','pomBreakMin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', pomUpdatePreview);
  });
  pomUpdatePreview();
}

function pomStartPlanned() {
  const { n, workMin, breakMin } = pomCalcPlan();
  if (n < 1) return;
  pomTotalPomodoros = n;
  pomCompletedCount = 0;
  pomTotalStudySecs = 0;
  pomSubject = pomSubjectSelect.getValue();
  pomIsWork = true;
  pomSecsLeft = workMin * 60;
  pomTotalSecs = pomSecsLeft;

  document.getElementById('pomConfig').style.display = 'none';
  document.getElementById('pomRunning').style.display = 'block';
  document.getElementById('pomSummary').style.display = 'none';

  pomUpdateRunDisplay();
  pomRunning = true;
  document.getElementById('pomStartBtn').style.display = 'none';
  document.getElementById('pomPauseBtn').style.display = '';
  pomInterval = setInterval(pomTick, 1000);
}

function pomTick() {
  if (pomSecsLeft <= 0) {
    pomPhaseEnd();
    return;
  }
  if (pomIsWork) pomTotalStudySecs++;
  pomSecsLeft--;
  pomUpdateRunDisplay();
}

function pomUpdateRunDisplay() {
  const m = Math.floor(pomSecsLeft / 60);
  const s = pomSecsLeft % 60;
  document.getElementById('pomDisplay').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

  const circumference = 402;
  const offset = circumference * (1 - pomSecsLeft / pomTotalSecs);
  const ring = document.getElementById('pomRing');
  if (ring) {
    ring.style.strokeDashoffset = offset;
    ring.style.stroke = pomIsWork ? 'var(--pink-deep)' : '#6aacb0';
  }

  const phase = document.getElementById('pomPhase');
  if (phase) {
    phase.textContent = pomIsWork ? 'trabajo' : 'descanso';
    phase.style.color = pomIsWork ? 'var(--pink-deep)' : '#6aacb0';
  }

  const currentPom = pomIsWork ? pomCompletedCount + 1 : pomCompletedCount;
  document.getElementById('pomProgressLabel').textContent = `🍅 ${currentPom} / ${pomTotalPomodoros}`;
  document.getElementById('pomDoneCount').textContent = `🍅 ${pomCompletedCount}`;
  document.getElementById('pomStudiedTime').textContent = fmtTime(pomTotalStudySecs);

  const workMin = parseInt(document.getElementById('pomWorkMin').value) || 25;
  const breakMin = parseInt(document.getElementById('pomBreakMin').value) || 15;
  const remaining = pomIsWork
    ? (pomTotalPomodoros - pomCompletedCount - 1) * (workMin + breakMin) * 60 + pomSecsLeft
    : (pomTotalPomodoros - pomCompletedCount) * workMin * 60 + pomSecsLeft;
  document.getElementById('pomRemainingTime').textContent = fmtTime(remaining);

  // show subject changer only during break
  const changer = document.getElementById('pomSubjectChanger');
  if (changer) changer.style.display = pomIsWork ? 'none' : 'block';
}

function pomPhaseEnd() {
  clearInterval(pomInterval);
  pomRunning = false;
  playAlarm();

  if (pomIsWork) {
    // save this pomodoro
    addSession(pomSubject, parseInt(document.getElementById('pomWorkMin').value) * 60, '🍅 pomodoro');
    pomCompletedCount++;

    if (pomCompletedCount >= pomTotalPomodoros) {
      // all done!
      pomShowSummary();
      return;
    }

    // start break
    pomIsWork = false;
    const breakMin = parseInt(document.getElementById('pomBreakMin').value) || 15;
    pomSecsLeft = breakMin * 60;
    pomTotalSecs = pomSecsLeft;
  } else {
    // pick up subject change if made during break
    const newSubject = pomChangerSelect ? pomChangerSelect.getValue() : null;
    if (newSubject) pomSubject = newSubject;
    // start next work
    pomIsWork = true;
    const workMin = parseInt(document.getElementById('pomWorkMin').value) || 25;
    pomSecsLeft = workMin * 60;
    pomTotalSecs = pomSecsLeft;
  }

  pomUpdateRunDisplay();
  pomAnimatePhaseChange();
  pomRunning = true;
  pomInterval = setInterval(pomTick, 1000);
}

function pomShowSummary() {
  document.getElementById('pomRunning').style.display = 'none';
  document.getElementById('pomSummary').style.display = 'block';
  document.getElementById('pomPhase').textContent = '¡listo!';
  document.getElementById('pomPhase').style.color = '#6aacb0';
  const workMin = parseInt(document.getElementById('pomWorkMin').value) || 25;
  const breakMin = parseInt(document.getElementById('pomBreakMin').value) || 15;
  document.getElementById('pomSummaryText').innerHTML =
    `Materia: <b>${pomSubject}</b><br>` +
    `Pomodoros completados: <b>🍅 ${pomCompletedCount}</b><br>` +
    `Tiempo de estudio: <b>${fmtTime(pomTotalStudySecs)}</b><br>` +
    `Intervalos: ${workMin} min trabajo · ${breakMin} min descanso`;
  playAlarmEnd();
}

function pomPause() {
  if (!pomRunning) return;
  clearInterval(pomInterval);
  pomRunning = false;
  document.getElementById('pomStartBtn').style.display = '';
  document.getElementById('pomPauseBtn').style.display = 'none';
}

function pomResume() {
  if (pomRunning) return;
  pomRunning = true;
  document.getElementById('pomStartBtn').style.display = 'none';
  document.getElementById('pomPauseBtn').style.display = '';
  pomInterval = setInterval(pomTick, 1000);
}

function pomAbort() {
  clearInterval(pomInterval);
  pomRunning = false;
  if (pomTotalStudySecs > 10) pomShowSummary();
  else pomBackToConfig();
}

function pomBackToConfig() {
  document.getElementById('pomConfig').style.display = 'block';
  document.getElementById('pomRunning').style.display = 'none';
  document.getElementById('pomSummary').style.display = 'none';
  document.getElementById('pomPhase').textContent = 'configurar';
  document.getElementById('pomPhase').style.color = 'var(--pink-deep)';
  pomUpdatePreview();
}

function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.3);
      osc.start(ctx.currentTime + i * 0.25);
      osc.stop(ctx.currentTime + i * 0.25 + 0.3);
    });
  } catch(e) {}
}

function playAlarmEnd() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [440, 554, 659, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.5);
      osc.start(ctx.currentTime + i * 0.2);
      osc.stop(ctx.currentTime + i * 0.2 + 0.5);
    });
  } catch(e) {}
}

// ── CUSTOM SELECT ─────────────────────────────────────────────────────────────
function buildCustomSelect(containerId, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return { getValue: () => SUBJECTS[0].name, setValue: () => {} };

  let currentValue = SUBJECTS[0].name;
  let isOpen = false;

  container.innerHTML = `
    <div class="cs-selected" id="${containerId}-sel">
      <span class="cs-dot" id="${containerId}-dot" style="background:${SUBJECTS[0].color}"></span>
      <span class="cs-text" id="${containerId}-text">${SUBJECTS[0].name}</span>
      <span class="cs-arrow">▼</span>
    </div>
    <div class="cs-dropdown" id="${containerId}-drop">
      ${SUBJECTS.map(s => `
        <div class="cs-option${s.name === currentValue ? ' selected' : ''}" data-value="${s.name}" data-color="${s.color}">
          <span class="cs-dot" style="background:${s.color}"></span>
          <span>${s.name}</span>
        </div>
      `).join('')}
    </div>
  `;

  const sel = container.querySelector('.cs-selected');
  const drop = container.querySelector('.cs-dropdown');

  function open() {
    isOpen = true;
    sel.classList.add('open');
    drop.classList.add('open');
  }
  function close() {
    isOpen = false;
    sel.classList.remove('open');
    drop.classList.remove('open');
  }

  sel.addEventListener('click', e => { e.stopPropagation(); isOpen ? close() : open(); });
  drop.querySelectorAll('.cs-option').forEach(opt => {
    opt.addEventListener('click', () => {
      currentValue = opt.dataset.value;
      document.getElementById(`${containerId}-dot`).style.background = opt.dataset.color;
      document.getElementById(`${containerId}-text`).textContent = currentValue;
      drop.querySelectorAll('.cs-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      close();
      if (onChange) onChange(currentValue);
    });
  });
  document.addEventListener('click', close);

  return {
    getValue: () => currentValue,
    setValue: (val) => {
      const opt = drop.querySelector(`[data-value="${val}"]`);
      if (opt) opt.dispatchEvent(new Event('click'));
    }
  };
}

let subjectSelect, pomSubjectSelect, pomChangerSelect;

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
  const subject = subjectSelect.getValue();
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
  const subject = subjectSelect.getValue();
  addSession(subject, secs, '(manual)');
  document.getElementById('manHours').value = '';
  document.getElementById('manMins').value = '';
}

// ── DATA OPS ──────────────────────────────────────────────────────────────────
function addSession(subject, secs, note) {
  const id = Date.now();
  const session = { id, subject, secs, note, date: new Date().toISOString() };
  setSyncStatus('saving');
  sessionsCol.doc(String(id)).set(session);
  showToast(`✓ ${fmtTime(secs)} guardado · ${subject}`);
}

function deleteSession(id) {
  sessionsCol.doc(String(id)).delete();
}

function clearAll() {
  if (!confirm('¿Limpiar todo el historial?')) return;
  sessions.forEach(s => sessionsCol.doc(String(s.id)).delete());
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

  const todaySessions = sessions.filter(s => sameDay(new Date(s.date), now));
  const todaySecs = todaySessions.reduce((a,s) => a+s.secs, 0);
  document.getElementById('statToday').textContent = fmtTime(todaySecs);
  document.getElementById('statToday').classList.remove('stat-pulse');
  void document.getElementById('statToday').offsetWidth;
  document.getElementById('statToday').classList.add('stat-pulse');
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

  const hexWrap = document.getElementById('hexWeek');
  hexWrap.innerHTML = '';
  const palette = ['#a8c8e8','#c9b8e8','#a8d8b8','#f7ccb0','#6aacb0','#f0dfa0','#d4b8e8'];
  weekDates.forEach((d, i) => {
    const daySecs = sessions.filter(s => sameDay(new Date(s.date), d)).reduce((a,s) => a+s.secs, 0);
    const h = Math.floor(daySecs / 3600);
    const m = Math.floor((daySecs % 3600) / 60);
    const intensity = Math.min(daySecs / (6*3600), 1);
    const isToday = sameDay(d, now);
    const wrapper = document.createElement('div');
    wrapper.className = 'hex-day';
    const fillColor = daySecs === 0 ? 'var(--surface2)' : blendHex(palette[i], intensity);
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

  const breakdown = document.getElementById('breakdownList');
  breakdown.innerHTML = '';
  const bySubjectWeek = {};
  const bySubjectTotal = {};
  sessions.forEach(s => {
    bySubjectTotal[s.subject] = (bySubjectTotal[s.subject] || 0) + s.secs;
    const d = new Date(s.date);
    if (d >= weekDates[0] && d <= weekDates[6]) {
      bySubjectWeek[s.subject] = (bySubjectWeek[s.subject] || 0) + s.secs;
    }
  });

  const hasData = Object.keys(bySubjectTotal).length > 0;
  if (!hasData) {
    breakdown.innerHTML = '<div class="empty-state">sin datos aún</div>';
  } else {
    const allNames = [...new Set([
      ...SUBJECTS.filter(s => s.goal).map(s => s.name),
      ...Object.keys(bySubjectTotal)
    ])];
    allNames.forEach(name => {
      const totalSecs = bySubjectTotal[name] || 0;
      const weekSecs2 = bySubjectWeek[name] || 0;
      if (totalSecs === 0 && weekSecs2 === 0) return;
      const subj = SUBJECTS.find(s => s.name === name);
      const color = subj ? subj.color : '#e2d9cf';
      const goal = subj ? subj.goal : null;
      const goalSecs = goal ? goal * 3600 : null;
      const weekPct = goalSecs ? Math.min(weekSecs2 / goalSecs * 100, 100).toFixed(1) : null;
      const reached = goalSecs && weekSecs2 >= goalSecs;
      const el = document.createElement('div');
      el.className = 'breakdown-row';
      el.innerHTML = `
        <span class="brow-dot" style="background:${color}"></span>
        <div class="brow-bar-wrap">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="brow-label">${name}</span>
            ${goal ? `<span style="font-size:0.68rem;color:${reached ? color : 'var(--text-muted)'};font-weight:${reached?'600':'400'}">${reached ? '✓ meta!' : `meta: ${goal}h`}</span>` : ''}
          </div>
          ${goalSecs ? `
          <div class="brow-bar-bg">
            <div class="brow-bar-fill" style="width:${weekPct}%;background:${color}"></div>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="font-size:0.65rem;color:var(--text-muted)">esta semana: ${fmtTime(weekSecs2)}</span>
            <span style="font-size:0.65rem;color:var(--text-muted)">total: ${fmtTime(totalSecs)}</span>
          </div>` : `
          <div class="brow-bar-bg">
            <div class="brow-bar-fill" style="width:100%;background:${color}"></div>
          </div>`}
        </div>
        <span class="brow-time">${fmtTime(weekSecs2)}</span>
      `;
      breakdown.appendChild(el);
    });
  }
}

function showToast(msg) {
  const t = document.getElementById('saveToast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  t.className = 'in';
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => {
    t.className = 'out';
    setTimeout(() => { t.style.display = 'none'; }, 400);
  }, 2200);
}

function pomAnimatePhaseChange() {
  const display = document.getElementById('pomDisplay');
  const svg = document.getElementById('pomodoroCard')?.querySelector('svg');
  if (display) display.classList.add('phase-transition');
  if (svg) {
    svg.classList.toggle('is-break', !pomIsWork);
  }
  setTimeout(() => display?.classList.remove('phase-transition'), 800);
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

document.addEventListener('DOMContentLoaded', init);
