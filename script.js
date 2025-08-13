let notes = [];
let activeId = null;

const $ = s => document.querySelector(s);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function nowISO() {
  return new Date().toISOString();
}

function loadStorage() {
  notes = JSON.parse(localStorage.getItem("sticky_notes_v3") || "[]");
}
function saveStorage() {
  localStorage.setItem("sticky_notes_v3", JSON.stringify(notes));
}

function createStickyElement(n) {
  const el = document.createElement("div");
  el.className = "sticky" + (n.pinned ? " pinned" : "");
  el.style.background = n.color || "#fff3b0";

  const title = document.createElement("div");
  title.className = "note-title";
  title.textContent = n.title || "Untitled";

  const body = document.createElement("div");
  body.className = "note-body";
  body.textContent = n.body || "";

  const ts = document.createElement("div");
  ts.className = "note-timestamp";
  let createdDate = new Date(n.createdAt);
  let updatedDate = new Date(n.updatedAt);
  ts.textContent = `Created: ${createdDate.toLocaleString()} | Edited: ${updatedDate.toLocaleString()}`;

  const actions = document.createElement("div");
  actions.className = "actions";

  const editBtn = document.createElement("button");
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", () => openEditor(n.id));

  const pinBtn = document.createElement("button");
  pinBtn.textContent = n.pinned ? "Unpin" : "Pin";
  pinBtn.addEventListener("click", () => {
    n.pinned = !n.pinned;
    n.updatedAt = nowISO();
    saveStorage();
    renderBoard();
  });

  const delBtn = document.createElement("button");
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", () => {
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
  el.appendChild(ts);
  el.appendChild(actions);

  return el;
}

function renderBoard() {
  const board = $("#board");
  board.innerHTML = "";

  notes.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  notes.forEach(n => {
    const el = createStickyElement(n);
    board.appendChild(el);
  });
}

function openEditor(id) {
  activeId = id || null;
  const modal = $("#editorModal");
  modal.style.display = "flex";

  if (!id) {
    $("#modalTitle").textContent = "New Note";
    $("#noteTitle").value = "";
    $("#noteBody").value = "";
    $("#noteColor").value = "#fff3b0";
    $("#pinChk").checked = false;
  } else {
    const n = notes.find(x => x.id === id);
    if (!n) return;
    $("#modalTitle").textContent = "Edit Note";
    $("#noteTitle").value = n.title;
    $("#noteBody").value = n.body;
    $("#noteColor").value = n.color || "#fff3b0";
    $("#pinChk").checked = n.pinned;
  }
}

function closeEditor() {
  $("#editorModal").style.display = "none";
  activeId = null;
}

function saveFromEditor() {
  const title = $("#noteTitle").value.trim() || "Untitled";
  const body = $("#noteBody").value.trim();
  const color = $("#noteColor").value || "#fff3b0";
  const pinned = $("#pinChk").checked;

  if (activeId) {
    const idx = notes.findIndex(n => n.id === activeId);
    if (idx === -1) return;
    notes[idx].title = title;
    notes[idx].body = body;
    notes[idx].color = color;
    notes[idx].pinned = pinned;
    notes[idx].updatedAt = nowISO();
  } else {
    const n = {
      id: uid(),
      title,
      body,
      color,
      pinned,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    notes.unshift(n);
  }

  saveStorage();
  renderBoard();
  closeEditor();
}

(function init() {
  loadStorage();
  renderBoard();

  $("#addNoteBtn").addEventListener("click", () => openEditor());
  $("#saveNoteBtn").addEventListener("click", saveFromEditor);
  $("#cancelNoteBtn").addEventListener("click", closeEditor);

  $("#editorModal").addEventListener("click", (e) => {
    if (e.target === $("#editorModal")) closeEditor();
  });
})();
