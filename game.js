const ROUNDS = 5;
const MIN_DELAY = 1500;
const MAX_DELAY = 4000;

const RATINGS = [
  { max: 150,      key: 'lightning', text: '믿을 수 없는 반응속도!' },
  { max: 220,      key: 'fast', text: '프로 게이머 수준!' },
  { max: 300,      key: 'normal', text: '일반인 평균 수준이에요.' },
  { max: 400,      key: 'slow', text: '조금 더 집중해 보세요.' },
  { max: Infinity, key: 'veryslow', text: '계속 연습하면 나아져요!' },
];

let gameState = 'idle';
let currentRound = 0;
let rounds = [];
let goTimer = null;
let startTime = 0;
let allHistory = [];
let sessionAttempts = 0;
let chartData = [];

const arena        = document.getElementById('arena');
const screens      = {
  idle:   document.getElementById('screen-idle'),
  wait:   document.getElementById('screen-wait'),
  go:     document.getElementById('screen-go'),
  early:  document.getElementById('screen-early'),
  result: document.getElementById('screen-result'),
  final:  document.getElementById('screen-final'),
};
const roundDotsEl     = document.getElementById('round-dots');
const resultRoundDots = document.getElementById('result-round-dots');
const resultTimeEl    = document.getElementById('result-time');
const resultRatingEl  = document.getElementById('result-rating');
const resultHintEl    = document.getElementById('result-hint');
const finalAvgEl      = document.getElementById('final-avg');
const finalRatingBox  = document.getElementById('final-rating-box');
const roundListEl     = document.getElementById('round-list');
const historyLogEl    = document.getElementById('history-log');
const chartWrap       = document.getElementById('chart-wrap');
const histCanvas      = document.getElementById('history-chart');
const progressBar     = document.getElementById('progress-bar');
const globalBestEl    = document.getElementById('global-best');
const statAttempts    = document.getElementById('stat-attempts');
const statAvg         = document.getElementById('stat-avg');
const statBest        = document.getElementById('stat-best');
const statWorst       = document.getElementById('stat-worst');

document.getElementById('retry-btn').addEventListener('click', e => {
  e.stopPropagation();
  startGame();
});


const storedBest = parseInt(localStorage.getItem('reflex_best') || '0');
if (storedBest) globalBestEl.textContent = storedBest + 'ms';

function getRating(ms) { return RATINGS.find(r => ms < r.max); }

function buildDots(container, total, done, current) {
  container.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const d = document.createElement('div');
    d.className = 'dot';
    if (i < done) d.classList.add('done');
    else if (i === current) d.classList.add('current');
    container.appendChild(d);
  }
}

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function setArenaState(s) { arena.className = `arena state-${s}`; }

function setProgress(pct) { progressBar.style.width = pct + '%'; }

function handleArenaClick() {
  if (gameState === 'idle')    return startGame();
  if (gameState === 'waiting') return earlyClick();
  if (gameState === 'go')      return registerClick();
  if (gameState === 'early')   return startRound();
  if (gameState === 'result')  return nextRound();
}

arena.addEventListener('click', handleArenaClick);
arena.addEventListener('touchend', e => { e.preventDefault(); handleArenaClick(); });

function startGame() {
  currentRound = 0;
  rounds = [];
  startRound();
}

function startRound() {
  gameState = 'waiting';
  setArenaState('wait');
  setProgress(0);
  buildDots(roundDotsEl, ROUNDS, currentRound, currentRound);
  showScreen('wait');

  const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
  let elapsed = 0;
  const tick = setInterval(() => {
    elapsed += 50;
    setProgress((elapsed / delay) * 100);
    if (elapsed >= delay) clearInterval(tick);
  }, 50);

  goTimer = setTimeout(() => {
    clearInterval(tick);
    setProgress(0);
    gameState = 'go';
    setArenaState('go');
    showScreen('go');
    startTime = performance.now();
  }, delay);
}

function earlyClick() {
  clearTimeout(goTimer);
  gameState = 'early';
  setArenaState('early');
  setProgress(0);
  showScreen('early');
}

function registerClick() {
  const ms = Math.round(performance.now() - startTime);
  rounds.push(ms);
  sessionAttempts++;
  const rating = getRating(ms);

  allHistory.unshift({ ms, rating, time: new Date() });
  chartData.push(ms);

  // Update localStorage best
  const prev = parseInt(localStorage.getItem('reflex_best') || '99999');
  if (ms < prev) {
    localStorage.setItem('reflex_best', ms);
    globalBestEl.textContent = ms + 'ms';
  } else if (prev < 99999) {
    globalBestEl.textContent = prev + 'ms';
  }

  updateSessionStats();
  addHistoryEntry({ ms, rating, n: sessionAttempts });
  if (chartData.length > 1) { chartWrap.style.display = ''; drawChart(); }

  gameState = 'result';
  setArenaState('result');
  buildDots(resultRoundDots, ROUNDS, currentRound, currentRound);
  resultTimeEl.textContent = ms;
  resultRatingEl.textContent = rating.label;
  resultRatingEl.className = `result-rating r-${rating.key}`;
  const remaining = ROUNDS - (currentRound + 1);
  resultHintEl.textContent = remaining > 0
    ? `클릭해서 계속 (${remaining}번 남음)`
    : '클릭해서 최종 결과 보기';
  showScreen('result');
  currentRound++;
}

function nextRound() {
  if (currentRound < ROUNDS) { startRound(); } else { showFinal(); }
}

function showFinal() {
  gameState = 'final';
  setArenaState('final');

  const avg  = Math.round(rounds.reduce((a, b) => a + b, 0) / rounds.length);
  const best = Math.min(...rounds);
  const rating = getRating(avg);

  finalAvgEl.textContent = avg;
  finalRatingBox.textContent = `${rating.label} — ${rating.text}`;
  finalRatingBox.className = `final-rating-box final-${rating.key}`;

  roundListEl.innerHTML = '';
  rounds.forEach((ms, i) => {
    const chip = document.createElement('div');
    chip.className = 'round-chip' + (ms === best ? ' best-chip' : '');
    chip.innerHTML = `<span class="rn">R${i + 1}</span>${ms}<span style="font-size:10px;opacity:.6">ms</span>${ms === best ? ' ★' : ''}`;
    roundListEl.appendChild(chip);
  });

  showScreen('final');
}

function updateSessionStats() {
  const all = allHistory.map(h => h.ms);
  const avg = Math.round(all.reduce((a, b) => a + b, 0) / all.length);
  statAttempts.textContent = sessionAttempts;
  statAvg.textContent      = avg + 'ms';
  statBest.textContent     = Math.min(...all) + 'ms';
  statWorst.textContent    = Math.max(...all) + 'ms';
}

function addHistoryEntry({ ms, rating, n }) {
  const allMs  = allHistory.map(h => h.ms);
  const worst  = Math.max(...allMs, 600);
  const pct    = Math.max(10, Math.round((1 - ms / worst) * 100));
  const labels = { lightning:'⚡', fast:'빠름', normal:'보통', slow:'느림', veryslow:'매우느림' };

  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `
    <div class="log-left">
      <div class="log-num">#${n}</div>
      <div class="log-badge badge-${rating.key}">${labels[rating.key]}</div>
    </div>
    <div class="log-bar-wrap"><div class="log-bar bar-${rating.key}" style="width:${pct}%"></div></div>
    <div class="log-ms">${ms}<span>ms</span></div>
    <div class="log-time">${new Date().toTimeString().slice(0, 8)}</div>`;

  historyLogEl.insertBefore(entry, historyLogEl.firstChild);
  while (historyLogEl.children.length > 30) historyLogEl.removeChild(historyLogEl.lastChild);
}

function drawChart() {
  const ctx  = histCanvas.getContext('2d');
  const w    = histCanvas.offsetWidth || 560;
  const h    = 80;
  histCanvas.width  = w;
  histCanvas.height = h;

  const data  = chartData.slice(-30);
  const min   = Math.min(...data) - 20;
  const max   = Math.max(...data) + 20;
  const range = max - min || 1;

  ctx.clearRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach(p => {
    ctx.beginPath(); ctx.moveTo(0, p * h); ctx.lineTo(w, p * h); ctx.stroke();
  });

  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1 || 1)) * (w - 20) + 10,
    y: h - ((v - min) / range) * (h - 16) - 8,
  }));

  // Fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(0,255,136,0.2)');
  grad.addColorStop(1, 'rgba(0,255,136,0)');
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, h);
  ctx.lineTo(pts[0].x, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Dots
  pts.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, i === pts.length - 1 ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = i === pts.length - 1 ? '#00ff88' : 'rgba(0,255,136,0.5)';
    ctx.fill();
  });
}