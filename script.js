let notes = [];
let activeId = null;
const STORAGE_KEY = "sticky_notes_v4";

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const nowISO = () => new Date().toISOString();

function loadStorage() {
  notes = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}
function saveStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

const reminderTimers = new Map();

function playDing() {
  const a = $("#dingAudio");
  if (a) {
    a.currentTime = 0;
    a.play().catch(()=>{  });
  }
}


function createStickyElement(n) {
  const el = document.createElement("div");
  el.className = "sticky" + (n.pinned ? " pinned" : "");
  el.style.background = n.color || "#fff3b0";
  el.dataset.id = n.id;
  el.draggable = true;

  if (n.w) el.style.width = n.w + "px";
  if (n.h) el.style.height = n.h + "px";

  const title = document.createElement("div");
  title.className = "note-title";
  title.textContent = n.title || "Untitled";

  const body = document.createElement("div");
  body.className = "note-body";
  body.textContent = n.body || "";

  const badges = document.createElement("div");
  badges.className = "badges";
  if (n.pinned) {
    const b = document.createElement("span");
    b.className = "badge";
    b.textContent = "Pinned";
    badges.appendChild(b);
  }
  if (n.reminder && !n.notified) {
    const r = document.createElement("span");
    r.className = "badge";
    try {
      r.textContent = "Reminder: " + new Date(n.reminder).toLocaleString();
    } catch { r.textContent = "Reminder set"; }
    badges.appendChild(r);
  }

  const ts = document.createElement("div");
  ts.className = "note-timestamp";
  const createdDate = new Date(n.createdAt);
  const updatedDate = new Date(n.updatedAt);
  ts.textContent = `Created: ${createdDate.toLocaleString()} | Edited: ${updatedDate.toLocaleString()}`;

  const actions = document.createElement("div");
  actions.className = "actions";

  const editBtn = document.createElement("button");
  editBtn.className = "btn-edit";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", (e) => { e.stopPropagation(); openEditor(n.id); });

  const pinBtn = document.createElement("button");
  pinBtn.className = "btn-pin";
  pinBtn.textContent = n.pinned ? "Unpin" : "Pin";
  pinBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    n.pinned = !n.pinned;
    n.updatedAt = nowISO();
    saveStorage();
    renderBoard();
  });

  const delBtn = document.createElement("button");
  delBtn.className = "btn-del";
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (confirm("Delete this note?")) {
      notes = notes.filter(x => x.id !== n.id);
      saveStorage();
      renderBoard();
    }
  });

  actions.appendChild(editBtn);
  actions.appendChild(pinBtn);
  actions.appendChild(delBtn);

  el.appendChild(title);
  el.appendChild(body);
  el.appendChild(badges);
  el.appendChild(ts);
  el.appendChild(actions);

  try {
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      const idx = notes.findIndex(x => x.id === n.id);
      if (idx !== -1) {
        notes[idx].w = Math.round(rect.width);
        notes[idx].h = Math.round(rect.height);
        saveStorage();
      }
    });
    ro.observe(el);
  } catch (err) {  }


  attachDragHandlers(el, n);

  return el;
}

let currentQuery = "";
function renderBoard() {
  const board = $("#board");
  board.innerHTML = "";

  const q = (currentQuery || "").trim().toLowerCase();
  const filtered = q
    ? notes.filter(n =>
        (n.title || "").toLowerCase().includes(q) ||
        (n.body || "").toLowerCase().includes(q)
      )
    : [...notes];

  filtered.sort((a,b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const ao = Number.isFinite(a.order) ? a.order : Infinity;
    const bo = Number.isFinite(b.order) ? b.order : Infinity;
    if (ao !== bo) return ao - bo;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  filtered.forEach(n => board.appendChild(createStickyElement(n)));
}

function openEditor(id) {
  activeId = id || null;
  const modal = $("#editorModal");
  modal.style.display = "flex";
  modal.removeAttribute("hidden");

  if (!id) {
    $("#modalTitle").textContent = "New Note";
    $("#noteTitle").value = "";
    $("#noteBody").value = "";
    $("#noteColor").value = "#fff3b0";
    $("#pinChk").checked = false;
    $("#noteReminder").value = "";
  } else {
    const n = notes.find(x => x.id === id);
    if (!n) return;
    $("#modalTitle").textContent = "Edit Note";
    $("#noteTitle").value = n.title || "";
    $("#noteBody").value = n.body || "";
    $("#noteColor").value = n.color || "#fff3b0";
    $("#pinChk").checked = !!n.pinned;
    $("#noteReminder").value = n.reminder ? toLocalInputValue(n.reminder) : "";
  }

  $("#noteTitle").focus();
}

function closeEditor() {
  $("#editorModal").style.display = "none";
  $("#editorModal").setAttribute("hidden", "");
  activeId = null;
}

function saveFromEditor() {
  const title = $("#noteTitle").value.trim() || "Untitled";
  const body = $("#noteBody").value.trim();
  const color = $("#noteColor").value || "#fff3b0";
  const pinned = $("#pinChk").checked;
  const reminderLocal = $("#noteReminder").value;
  const reminderAt = reminderLocal ? new Date(reminderLocal).toISOString() : null;

  if (activeId) {
    const idx = notes.findIndex(n => n.id === activeId);
    if (idx === -1) return;
    const n = notes[idx];
    n.title = title; n.body = body; n.color = color; n.pinned = pinned;
    n.reminder = reminderAt; n.notified = false;
    n.updatedAt = nowISO();
  } else {
    const n = {
      id: uid(), title, body, color, pinned,
      createdAt: nowISO(), updatedAt: nowISO(),
      reminder: reminderAt, notified: false
    };
    notes.unshift(n);
  }

  saveStorage();
  scheduleAllReminders();
  renderBoard();
  closeEditor();
}

let lastDeleted = null;
function deleteWithUndo(id) {
  const idx = notes.findIndex(n => n.id === id);
  if (idx === -1) return;
  lastDeleted = notes[idx];
  notes.splice(idx,1);
  saveStorage();
  renderBoard();

  const snack = document.createElement("div");
  snack.textContent = "Note deleted — Click to Undo";
  Object.assign(snack.style, {
    position:"fixed", left:"50%", transform:"translateX(-50%)",
    bottom:"18px", background:"#333", color:"#fff", padding:"10px 14px", borderRadius:"10px", zIndex:10000, cursor:"pointer"
  });
  document.body.appendChild(snack);
  const t = setTimeout(()=>{ snack.remove(); lastDeleted = null; }, 4000);
  snack.addEventListener("click", ()=>{ if (lastDeleted){ notes.unshift(lastDeleted); lastDeleted=null; saveStorage(); renderBoard(); } snack.remove(); clearTimeout(t); });
}

function debounce(fn, ms=200){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
const onSearch = debounce((val)=>{ currentQuery = val; renderBoard(); }, 120);

let dragId = null;
function attachDragHandlers(card, note) {
  card.addEventListener("dragstart", (e) => {
    dragId = note.id;
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    dragId = null;
    $$(".placeholder").forEach(p => p.classList.remove("placeholder"));
    writeOrdersFromDom();
  });

  card.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragged = notes.find(n => n.id === dragId);
    if (!dragged) return;
    if (!!dragged.pinned !== !!note.pinned) return;
    const board = $("#board");
    const after = e.clientY > card.getBoundingClientRect().top + card.offsetHeight/2;
    card.classList.add("placeholder");
    if (after) {
      board.insertBefore($(`[data-id="${dragId}"]`), card.nextSibling);
    } else {
      board.insertBefore($(`[data-id="${dragId}"]`), card);
    }
  });
}

function writeOrdersFromDom() {
  const domIdsPinned = $$("#board .sticky.pinned").map(el => el.dataset.id);
  const domIdsUnpinned = $$("#board .sticky:not(.pinned)").map(el => el.dataset.id);

  let order = 0;
  for (const id of domIdsPinned) {
    const n = notes.find(x => x.id === id);
    if (n) n.order = order++;
  }
  order = 0;
  for (const id of domIdsUnpinned) {
    const n = notes.find(x => x.id === id);
    if (n) n.order = order++;
  }
  saveStorage();
}

function toLocalInputValue(iso){
  const d = new Date(iso);
  const pad = n => String(n).padStart(2,'0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth()+1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function scheduleReminder(n) {
  if (reminderTimers.has(n.id)) {
    clearTimeout(reminderTimers.get(n.id));
    reminderTimers.delete(n.id);
  }
  if (!n.reminder || n.notified) return;
  const due = new Date(n.reminder).getTime();
  const now = Date.now();
  const delay = due - now;
  if (delay <= 0) { fireReminder(n); return; }
  const t = setTimeout(()=>fireReminder(n), delay);
  reminderTimers.set(n.id, t);
}

function scheduleAllReminders() {
  reminderTimers.forEach(t => clearTimeout(t));
  reminderTimers.clear();
  notes.forEach(scheduleReminder);
}

function fireReminder(n) {
  n.notified = true;
  n.updatedAt = nowISO();
  saveStorage();
  renderBoard();

  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification("Reminder: " + (n.title || "Untitled"), { body: n.body || "It's time!" });
      playDing();
      showOnScreenNotification("Reminder: " + (n.title || "Untitled"));
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((perm)=>{
        if (perm === "granted") {
          new Notification("Reminder: " + (n.title || "Untitled"), { body: n.body || "It's time!" });
          playDing();
          showOnScreenNotification("Reminder: " + (n.title || "Untitled"));
        } else {
          alert("Reminder: " + (n.title || "Untitled"));
          playDing();
        }
      });
    } else {
      alert("Reminder: " + (n.title || "Untitled"));
      playDing();
    }
  } else {
    alert("Reminder: " + (n.title || "Untitled"));
    playDing();
  }
}

function showOnScreenNotification(msg){
  const n = $("#notification");
  n.textContent = msg;
  n.style.display = "block";
  n.setAttribute("aria-hidden","false");
  setTimeout(()=>{ n.style.display = "none"; n.setAttribute("aria-hidden","true"); }, 3500);
}

(function init(){
  loadStorage();
  renderBoard();
  scheduleAllReminders();

  $("#addNoteBtn").addEventListener("click", ()=> openEditor());
  $("#saveNoteBtn").addEventListener("click", saveFromEditor);
  $("#cancelNoteBtn").addEventListener("click", closeEditor);
  $("#closeModalBtn").addEventListener("click", closeEditor);

  $("#editorModal").addEventListener("click",(e)=>{ if (e.target === $("#editorModal")) closeEditor(); });

  $("#searchBar").addEventListener("input", (e)=> onSearch(e.target.value));
  const debounced = debounce((v)=>{ currentQuery = v; renderBoard(); }, 150);

  const onSearch = debounced;
  document.addEventListener("keydown", (e)=>{
    const modalOpen = $("#editorModal").style.display === "flex";
    if (modalOpen) {
      if (e.key === "Escape") { e.preventDefault(); closeEditor(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") { e.preventDefault(); saveFromEditor(); }
    } else {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") { e.preventDefault(); openEditor(); }
    }
  });


  $("#board").addEventListener("dragover", e => e.preventDefault());
  $("#board").addEventListener("drop", e => {
    e.preventDefault();
    const id = e.dataTransfer.getData("id");
    const dragged = notes.find(x => x.id === id);
    if (!dragged) return;
    notes = notes.filter(x => x.id !== id);
    notes.unshift(dragged);
    saveStorage();
    renderBoard();
  });
  $("#searchBar").addEventListener("input", (e)=>{ currentQuery = e.target.value; renderBoard(); });
  document.addEventListener("click", function once(){ if ("Notification" in window && Notification.permission === "default") { /*lazy*/ } document.removeEventListener("click", once); });

})();
