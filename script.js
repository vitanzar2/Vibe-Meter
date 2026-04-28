const meter = document.getElementById("meter");
const marker = document.getElementById("marker");
const resetButton = document.getElementById("reset");
const moverNameInput = document.getElementById("mover-name");
const moveLogElement = document.getElementById("move-log");
const STORAGE_KEY = "vibe-meter-position-v1";
const MOVE_LOG_KEY = "vibe-meter-move-log-v1";
const MOVER_NAME_KEY = "vibe-meter-mover-name-v1";
const DEFAULT_POSITION = { x: 72, y: 57 };

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function applyPosition({ x, y }) {
  marker.style.setProperty("--x", `${x}%`);
  marker.style.setProperty("--y", `${y}%`);
}

function savePosition(position) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
}

function saveMoverName(name) {
  localStorage.setItem(MOVER_NAME_KEY, name);
}

function loadMoverName() {
  return localStorage.getItem(MOVER_NAME_KEY) || "";
}

function loadPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
      return { x: clamp(saved.x, 0, 100), y: clamp(saved.y, 0, 100) };
    }
  } catch {
    // ignore corrupt value and use default
  }
  return DEFAULT_POSITION;
}

function loadMoveLog() {
  try {
    const saved = JSON.parse(localStorage.getItem(MOVE_LOG_KEY));
    if (Array.isArray(saved)) return saved;
  } catch {
    // ignore corrupt value and use empty array
  }
  return [];
}

function saveMoveLog(logEntries) {
  localStorage.setItem(MOVE_LOG_KEY, JSON.stringify(logEntries));
}

function activeMover() {
  const typedName = moverNameInput.value.trim();
  return typedName || "Anonymous";
}

function formatTime(isoTime) {
  return new Date(isoTime).toLocaleString();
}

function renderMoveLog(logEntries) {
  moveLogElement.innerHTML = "";
  if (!logEntries.length) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "No moves yet.";
    moveLogElement.appendChild(emptyItem);
    return;
  }

  logEntries.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent =
      `${entry.mover} moved marker to (${entry.x.toFixed(1)}%, ${entry.y.toFixed(1)}%) at ${formatTime(entry.time)}.`;
    moveLogElement.appendChild(item);
  });
}

function recordMove(position) {
  const currentLog = loadMoveLog();
  currentLog.unshift({
    mover: activeMover(),
    time: new Date().toISOString(),
    x: position.x,
    y: position.y
  });
  saveMoveLog(currentLog);
  renderMoveLog(currentLog);
}

function positionFromPointer(pointerEvent) {
  const rect = meter.getBoundingClientRect();
  const x = ((pointerEvent.clientX - rect.left) / rect.width) * 100;
  const y = ((pointerEvent.clientY - rect.top) / rect.height) * 100;
  return { x: clamp(x, 0, 100), y: clamp(y, 0, 100) };
}

let dragging = false;

marker.addEventListener("pointerdown", (event) => {
  dragging = true;
  marker.setPointerCapture(event.pointerId);
  marker.focus();
});

marker.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  const position = positionFromPointer(event);
  applyPosition(position);
});

function endDrag(event) {
  if (!dragging) return;
  dragging = false;
  const position = positionFromPointer(event);
  applyPosition(position);
  savePosition(position);
  recordMove(position);
}

marker.addEventListener("pointerup", endDrag);
marker.addEventListener("pointercancel", endDrag);

meter.addEventListener("pointerdown", (event) => {
  if (event.target === marker) return;
  const position = positionFromPointer(event);
  applyPosition(position);
  savePosition(position);
  recordMove(position);
});

resetButton.addEventListener("click", () => {
  applyPosition(DEFAULT_POSITION);
  savePosition(DEFAULT_POSITION);
  recordMove(DEFAULT_POSITION);
});

moverNameInput.value = loadMoverName();
moverNameInput.addEventListener("change", () => {
  saveMoverName(moverNameInput.value.trim());
});

applyPosition(loadPosition());
renderMoveLog(loadMoveLog());
