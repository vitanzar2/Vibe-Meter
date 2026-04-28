import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
import {
  getDatabase,
  onValue,
  push,
  ref,
  set
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-database.js";

const meter = document.getElementById("meter");
const marker = document.getElementById("marker");
const resetButton = document.getElementById("reset");
const moverNameInput = document.getElementById("mover-name");
const moveLogElement = document.getElementById("move-log");
const syncStatusElement = document.getElementById("sync-status");
const cells = Array.from(meter.querySelectorAll(".cell"));
const STORAGE_KEY = "vibe-meter-position-v1";
const MOVE_LOG_KEY = "vibe-meter-move-log-v1";
const MOVER_NAME_KEY = "vibe-meter-mover-name-v1";
const DEFAULT_POSITION = { x: 72, y: 57 };
const CELL_LABELS = {
  c1: "Fuck it we ball",
  c2: "LETS FUCKING GOOOOOO",
  c3: "It is what it is",
  c4: "it's so over",
  c5: "It is what it is",
  c6: "We vibing"
};

const firebaseConfig = window.VIBE_METER_FIREBASE_CONFIG || null;
const hasFirebaseConfig =
  !!firebaseConfig &&
  typeof firebaseConfig === "object" &&
  ["apiKey", "authDomain", "databaseURL", "projectId", "appId"].every((key) =>
    Boolean(firebaseConfig[key])
  );

let db = null;
let stateRef = null;
let logRef = null;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function applyPosition({ x, y }) {
  marker.style.setProperty("--x", `${x}%`);
  marker.style.setProperty("--y", `${y}%`);
}

function saveMoverName(name) {
  localStorage.setItem(MOVER_NAME_KEY, name);
}

function loadMoverName() {
  return localStorage.getItem(MOVER_NAME_KEY) || "";
}

function loadLocalPosition() {
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

function saveLocalPosition(position) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
}

function loadLocalMoveLog() {
  try {
    const saved = JSON.parse(localStorage.getItem(MOVE_LOG_KEY));
    if (Array.isArray(saved)) return saved;
  } catch {
    // ignore corrupt value and use empty array
  }
  return [];
}

function saveLocalMoveLog(logEntries) {
  localStorage.setItem(MOVE_LOG_KEY, JSON.stringify(logEntries));
}

function activeMover() {
  return moverNameInput.value.trim();
}

function hasMoverName() {
  return activeMover().length > 0;
}

function requireMoverName() {
  if (hasMoverName()) return true;
  moverNameInput.focus();
  alert("Please enter your name before moving the marker.");
  return false;
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

async function persistPosition(position) {
  if (stateRef) {
    await set(stateRef, {
      x: position.x,
      y: position.y,
      updatedBy: activeMover(),
      updatedAt: new Date().toISOString()
    });
    return;
  }

  saveLocalPosition(position);
}

async function persistMove(position) {
  const entry = {
    mover: activeMover(),
    time: new Date().toISOString(),
    destination: labelFromPosition(position),
    x: position.x,
    y: position.y
  };

  if (logRef) {
    await push(logRef, entry);
    return;
  }

  const currentLog = loadLocalMoveLog();
  currentLog.unshift(entry);
  saveLocalMoveLog(currentLog);
  renderMoveLog(currentLog);
}

function positionFromPointer(pointerEvent) {
  const rect = meter.getBoundingClientRect();
  const x = ((pointerEvent.clientX - rect.left) / rect.width) * 100;
  const y = ((pointerEvent.clientY - rect.top) / rect.height) * 100;
  return { x: clamp(x, 0, 100), y: clamp(y, 0, 100) };
}

async function saveAndRecord(position) {
  applyPosition(position);
  try {
    await persistPosition(position);
    await persistMove(position);
  } catch (error) {
    console.error(error);
    syncStatusElement.textContent = "Could not sync this move. Check Firebase setup.";
  }
}

function connectFirebase() {
  if (!hasFirebaseConfig) {
    syncStatusElement.textContent =
      "Local mode: add firebase-config.js values to enable shared sync for everyone.";
    applyPosition(loadLocalPosition());
    renderMoveLog(loadLocalMoveLog());
    return;
  }

  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  stateRef = ref(db, "vibe-meter/state");
  logRef = ref(db, "vibe-meter/moveLog");

  onValue(
    stateRef,
    (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data.x !== "number" || typeof data.y !== "number") {
        applyPosition(DEFAULT_POSITION);
        return;
      }
      applyPosition({ x: clamp(data.x, 0, 100), y: clamp(data.y, 0, 100) });
      syncStatusElement.textContent = "Shared mode: everyone sees live updates.";
    },
    () => {
      syncStatusElement.textContent = "Unable to read shared state. Check Firebase rules.";
    }
  );

  onValue(
    logRef,
    (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== "object") {
        renderMoveLog([]);
        return;
      }

      const entries = Object.values(data)
        .filter((entry) => entry && typeof entry === "object")
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, 150);

      renderMoveLog(entries);
    },
    () => {
      syncStatusElement.textContent = "Unable to read movement log. Check Firebase rules.";
    }
  );
}

let dragging = false;

marker.addEventListener("pointerdown", (event) => {
  if (!requireMoverName()) return;
  dragging = true;
  marker.setPointerCapture(event.pointerId);
  marker.focus();
});

marker.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  const position = positionFromPointer(event);
  applyPosition(position);
});

async function endDrag(event) {
  if (!dragging) return;
  dragging = false;
  const position = positionFromPointer(event);
  await saveAndRecord(position);
}

marker.addEventListener("pointerup", endDrag);
marker.addEventListener("pointercancel", endDrag);

meter.addEventListener("pointerdown", async (event) => {
  if (event.target === marker) return;
  if (!requireMoverName()) return;
  const position = positionFromPointer(event);
  await saveAndRecord(position);
});

resetButton.addEventListener("click", async () => {
  if (!requireMoverName()) return;
  await saveAndRecord(DEFAULT_POSITION);
});

moverNameInput.value = loadMoverName();
moverNameInput.addEventListener("change", () => {
  saveMoverName(moverNameInput.value.trim());
});

connectFirebase();
