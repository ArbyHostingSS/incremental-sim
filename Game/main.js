const STORAGE_KEY = "incremental_sim_save_v1";

const CONFIG = {
  maxDpr: 2,
  maxDt: 0.05,
  baseTapPower: 1,
  baseAutoPerSec: 1,
  powerBaseCost: 10,
  autoBaseCost: 25,
  costScale: 1.35,
  saveInterval: 5,
};

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const ui = {
  energy: document.getElementById("energyText"),
  rate: document.getElementById("rateText"),
  powerLv: document.getElementById("powerLv"),
  powerCost: document.getElementById("powerCost"),
  autoLv: document.getElementById("autoLv"),
  autoCost: document.getElementById("autoCost"),
  btnPower: document.getElementById("btnPower"),
  btnAuto: document.getElementById("btnAuto"),
};

const state = {
  width: 0,
  height: 0,
  energy: 0,
  powerLv: 1,
  autoLv: 0,
  pulse: 1,
  saveTimer: 0,
  floatingTexts: [],
};

function getTapGain() {
  return Math.floor(CONFIG.baseTapPower * Math.pow(1.25, state.powerLv - 1));
}

function getAutoPerSec() {
  return Math.floor(state.autoLv * CONFIG.baseAutoPerSec * Math.pow(1.15, Math.max(0, state.autoLv - 1)));
}

function getPowerCost() {
  return Math.floor(CONFIG.powerBaseCost * Math.pow(CONFIG.costScale, state.powerLv - 1));
}

function getAutoCost() {
  return Math.floor(CONFIG.autoBaseCost * Math.pow(CONFIG.costScale, state.autoLv));
}

function saveGame() {
  try {
    const payload = JSON.stringify({
      energy: state.energy,
      powerLv: state.powerLv,
      autoLv: state.autoLv,
    });
    localStorage.setItem(STORAGE_KEY, payload);
  } catch (err) {
    console.warn("Save gagal:", err);
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.energy === "number" && Number.isFinite(data.energy) && data.energy >= 0) {
      state.energy = Math.floor(data.energy);
    }
    if (typeof data.powerLv === "number" && data.powerLv >= 1) {
      state.powerLv = Math.floor(data.powerLv);
    }
    if (typeof data.autoLv === "number" && data.autoLv >= 0) {
      state.autoLv = Math.floor(data.autoLv);
    }
  } catch (err) {
    console.warn("Load gagal, pakai data default:", err);
  }
}

function spawnFloatingText(x, y, label) {
  if (state.floatingTexts.length > 24) return; // jaga jumlah objek di HP
  state.floatingTexts.push({ x, y, label, age: 0, duration: 0.65 });
}

function handleCoreTap(clientX, clientY) {
  const cx = state.width * 0.5;
  const cy = state.height * 0.44;
  const radius = Math.min(state.width, state.height) * 0.16;
  const dist = Math.hypot(clientX - cx, clientY - cy);

  if (dist <= radius * 1.35) {
    const gain = getTapGain();
    state.energy += gain;
    state.pulse = 1.14;
    spawnFloatingText(clientX, clientY - 12, `+${gain}`);
    syncHud();
  }
}

function buyPower() {
  const cost = getPowerCost();
  if (state.energy < cost) return;
  state.energy -= cost;
  state.powerLv += 1;
  syncHud();
  saveGame();
}

function buyAuto() {
  const cost = getAutoCost();
  if (state.energy < cost) return;
  state.energy -= cost;
  state.autoLv += 1;
  syncHud();
  saveGame();
}

function syncHud() {
  const pCost = getPowerCost();
  const aCost = getAutoCost();

  ui.energy.textContent = `Energy: ${state.energy.toLocaleString("id-ID")}`;
  ui.rate.textContent = `+${getAutoPerSec().toLocaleString("id-ID")} / det`;

  ui.powerLv.textContent = String(state.powerLv);
  ui.powerCost.textContent = `Cost: ${pCost.toLocaleString("id-ID")}`;
  ui.btnPower.disabled = state.energy < pCost;

  ui.autoLv.textContent = String(state.autoLv);
  ui.autoCost.textContent = `Cost: ${aCost.toLocaleString("id-ID")}`;
  ui.btnAuto.disabled = state.energy < aCost;
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  canvas.width = Math.floor(state.width * dpr);
  canvas.height = Math.floor(state.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function bindEvents() {
  canvas.addEventListener("pointerdown", (e) => {
    handleCoreTap(e.clientX, e.clientY);
  });
  ui.btnPower.addEventListener("click", buyPower);
  ui.btnAuto.addEventListener("click", buyAuto);
  window.addEventListener("resize", resize);
  window.addEventListener("pagehide", saveGame);
}

function update(dt) {
  const autoGain = getAutoPerSec() * dt;
  if (autoGain > 0) {
    state.energy += autoGain;
    syncHud();
  }

  state.pulse += (1 - state.pulse) * Math.min(1, dt * 14);

  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const item = state.floatingTexts[i];
    item.age += dt;
    item.y -= 48 * dt;
    if (item.age >= item.duration) {
      state.floatingTexts.splice(i, 1);
    }
  }

  state.saveTimer += dt;
  if (state.saveTimer >= CONFIG.saveInterval) {
    state.saveTimer = 0;
    saveGame();
  }
}

function render() {
  ctx.fillStyle = "#0d1320";
  ctx.fillRect(0, 0, state.width, state.height);

  const cx = state.width * 0.5;
  const cy = state.height * 0.44;
  const baseRadius = Math.min(state.width, state.height) * 0.16;
  const r = baseRadius * state.pulse;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#0284c7";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#7dd3fc";
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TAP CORE", cx, cy);

  for (const item of state.floatingTexts) {
    const alpha = Math.max(0, 1 - item.age / item.duration);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#38bdf8";
    ctx.font = "800 16px system-ui, sans-serif";
    ctx.fillText(item.label, item.x, item.y);
  }
  ctx.globalAlpha = 1;
}

let lastTime = performance.now();
function loop(now) {
  const rawDt = (now - lastTime) / 1000;
  lastTime = now;
  const dt = Math.min(Math.max(rawDt, 0), CONFIG.maxDt);

  update(dt);
  render();
  requestAnimationFrame(loop);
}

loadGame();
resize();
bindEvents();
syncHud();
requestAnimationFrame(loop);
