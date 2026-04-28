const meter = document.getElementById("meter");
const marker = document.getElementById("marker");
const resetButton = document.getElementById("reset");
const moverNameInput = document.getElementById("mover-name");
const moveLogElement = document.getElementById("move-log");
const cells = Array.from(meter.querySelectorAll(".cell"));
const STORAGE_KEY = "vibe-meter-position-v1";
const MOVE_LOG_KEY = "vibe-meter-move-log-v1";
const MOVER_NAME_KEY = "vibe-meter-mover-name-v1";
const DEFAULT_POSITION = { x: 72, y: 57 };
const CELL_LABELS = {
  c1: "Fuck it we ball",
  c2: "We are so fucking back",
  c3: "It is what it is",
  c4: "it's so over",
  c5: "It is what it is",
  c6: "We vibing"
};

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

function labelFromPosition(position) {
  const rect = meter.getBoundingClientRect();
  const clientX = rect.left + (position.x / 100) * rect.width;
  const clientY = rect.top + (position.y / 100) * rect.height;

  let containingCell = null;
  for (const cell of cells) {
    const cellRect = cell.getBoundingClientRect();
    const insideX = clientX >= cellRect.left && clientX <= cellRect.right;
    const insideY = clientY >= cellRect.top && clientY <= cellRect.bottom;
    if (insideX && insideY) {
      containingCell = cell;
      break;
    }
  }

  const className = containingCell
    ? Array.from(containingCell.classList).find((name) => CELL_LABELS[name])
    : null;
  if (className) return CELL_LABELS[className];

  const closestCell = cells.reduce((best, cell) => {
    const cellRect = cell.getBoundingClientRect();
    const centerX = (cellRect.left + cellRect.right) / 2;
    const centerY = (cellRect.top + cellRect.bottom) / 2;
    const distance = Math.hypot(centerX - clientX, centerY - clientY);
    return distance < best.distance ? { cell, distance } : best;
  }, { cell: null, distance: Number.POSITIVE_INFINITY }).cell;

  const closestClassName = closestCell
    ? Array.from(closestCell.classList).find((name) => CELL_LABELS[name])
    : null;
  return closestClassName ? CELL_LABELS[closestClassName] : "Unknown area";
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
    const destination = entry.destination || labelFromPosition(entry);
    const item = document.createElement("li");
    item.textContent =
      `${entry.mover} moved marker to ${destination} at ${formatTime(entry.time)}.`;
    moveLogElement.appendChild(item);
  });
}

function recordMove(position) {
  const currentLog = loadMoveLog();
  currentLog.unshift({
    mover: activeMover(),
    time: new Date().toISOString(),
    destination: labelFromPosition(position),
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
