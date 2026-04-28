 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/script.js b/script.js
index 9d2a910041914cc4e0e86e2b20c52dbaf2640422..fe7c993e1d62e38c020f76b1b483b45daf599ebb 100644
--- a/script.js
+++ b/script.js
@@ -1,117 +1,189 @@
-cat > script.js <<'EOF'
 const noteInput = document.getElementById('noteInput');
+const noteTags = document.getElementById('noteTags');
+const notePriority = document.getElementById('notePriority');
 const saveBtn = document.getElementById('saveNote');
+const refreshBtn = document.getElementById('refreshNotes');
 const clearBtn = document.getElementById('clearNotes');
 const notesList = document.getElementById('notesList');
 const timeline = document.getElementById('thinkingTimeline');
 const status = document.getElementById('noteStatus');
 
-const KEY = 'notes-local';
-
-function getLocal() {
-  return JSON.parse(localStorage.getItem(KEY)) || [];
-}
-
-function saveLocal(data) {
-  localStorage.setItem(KEY, JSON.stringify(data));
-}
+let currentNotes = [];
 
 function createTimeline(text) {
   const t = Date.now();
+  const words = text.trim().split(/\s+/).filter(Boolean).length;
   return [
-    { label: "Input received", detail: text, at: t },
-    { label: "Analyzing", detail: "Breaking words + metadata", at: t + 200 },
-    { label: "Processing", detail: "Building structured note object", at: t + 400 },
-    { label: "Saving", detail: "Writing to storage", at: t + 600 },
-    { label: "Done", detail: "Note stored + rendered", at: t + 800 }
+    { label: 'Input received', detail: `Captured ${words} words.`, at: t },
+    { label: 'Tag parsing', detail: 'Parsed priority + tags for metadata.', at: t + 180 },
+    { label: 'Complexity scoring', detail: 'Estimated intent and readability.', at: t + 350 },
+    { label: 'Save operation', detail: 'Sending payload to backend database route.', at: t + 500 },
+    { label: 'AI ready', detail: 'Stored note can be consumed from AI endpoints.', at: t + 700 }
   ];
 }
 
-function renderTimeline(data) {
+function renderTimeline(data = []) {
   timeline.innerHTML = '';
-  data.forEach(step => {
+  data.forEach((step) => {
     const div = document.createElement('div');
     div.className = 'timeline-item';
     div.innerHTML = `<strong>${step.label}</strong><br>${step.detail}`;
     timeline.appendChild(div);
   });
 }
 
+function esc(text) {
+  return String(text)
+    .replaceAll('&', '&amp;')
+    .replaceAll('<', '&lt;')
+    .replaceAll('>', '&gt;')
+    .replaceAll('"', '&quot;')
+    .replaceAll("'", '&#039;');
+}
+
 function renderNotes(notes) {
   notesList.innerHTML = '';
 
-  notes.slice().reverse().forEach(note => {
-    const div = document.createElement('div');
-    div.className = 'note-card';
-
-    div.innerHTML = `
-      <small>${new Date(note.createdAt).toLocaleString()}</small>
-      <p>${note.text}</p>
-      <small>${note.meta}</small>
+  notes.forEach((note) => {
+    const card = document.createElement('article');
+    card.className = 'note-card';
+
+    const tagsHtml = (note.tags || []).map((tag) => `<span class="tag">#${esc(tag)}</span>`).join('');
+
+    card.innerHTML = `
+      <div class="note-head">
+        <small>${new Date(note.createdAt).toLocaleString()}</small>
+        <small class="note-meta">priority: ${esc(note.priority || 'normal')}</small>
+      </div>
+      <p>${esc(note.text)}</p>
+      <div>${tagsHtml}</div>
+      <p class="note-meta">words: ${note.analysis?.wordCount ?? '--'} | sentiment: ${note.analysis?.sentiment ?? '--'}</p>
+      <button type="button" data-action="ai" data-note-id="${note.id}">AI Read</button>
     `;
 
-    div.onclick = () => renderTimeline(note.timeline);
+    card.addEventListener('click', (event) => {
+      const button = event.target.closest('button[data-action="ai"]');
+      if (!button) {
+        renderTimeline(note.thinkingTimeline || note.timeline || []);
+        return;
+      }
+      event.stopPropagation();
+      aiReadNote(note.id);
+    });
 
-    notesList.appendChild(div);
+    notesList.appendChild(card);
   });
 }
 
+function parseTags(raw) {
+  return raw
+    .split(',')
+    .map((x) => x.trim().toLowerCase())
+    .filter(Boolean)
+    .slice(0, 8);
+}
+
+async function loadNotes() {
+  status.textContent = 'Loading notes...';
+  const response = await fetch('/api/notes');
+  if (!response.ok) {
+    throw new Error('Could not load notes');
+  }
+  currentNotes = await response.json();
+  renderNotes(currentNotes);
+  status.textContent = `Loaded ${currentNotes.length} note(s).`;
+}
+
 async function saveNote() {
   const text = noteInput.value.trim();
-  if (!text) return;
+  if (!text) {
+    status.textContent = 'Type a note before saving.';
+    return;
+  }
 
-  // ANIMATION START
-  saveBtn.classList.add('is-saving');
   saveBtn.disabled = true;
-  status.textContent = "Saving...";
-
-  const timelineData = createTimeline(text);
-  renderTimeline(timelineData);
+  status.textContent = 'Saving to backend...';
+  renderTimeline(createTimeline(text));
 
-  const note = {
-    id: Date.now(),
+  const payload = {
     text,
-    createdAt: new Date().toISOString(),
-    meta: navigator.userAgent,
-    timeline: timelineData
+    tags: parseTags(noteTags.value),
+    priority: notePriority.value || 'normal'
   };
 
-  try {
-    await fetch('/api/notes', {
-      method: 'POST',
-      headers: { 'Content-Type': 'application/json' },
-      body: JSON.stringify({ text })
-    });
-    status.textContent = "Saved to backend";
-  } catch {
-    const notes = getLocal();
-    notes.push(note);
-    saveLocal(notes);
-    status.textContent = "Saved locally (no backend)";
+  const response = await fetch('/api/notes', {
+    method: 'POST',
+    headers: { 'Content-Type': 'application/json' },
+    body: JSON.stringify(payload)
+  });
+
+  saveBtn.disabled = false;
+
+  if (!response.ok) {
+    const body = await response.json().catch(() => ({}));
+    status.textContent = body.error || 'Save failed.';
+    return;
   }
 
   noteInput.value = '';
-  renderNotes(getLocal());
+  noteTags.value = '';
+  notePriority.value = 'normal';
 
-  // ANIMATION END
-  saveBtn.classList.remove('is-saving');
-  saveBtn.classList.add('saved-flash');
+  status.textContent = 'Saved. Refreshing notes list...';
+  await loadNotes();
+}
 
-  setTimeout(() => {
-    saveBtn.classList.remove('saved-flash');
-    saveBtn.disabled = false;
-  }, 400);
+async function aiReadNote(noteId) {
+  status.textContent = 'Generating AI summary...';
+  const response = await fetch(`/api/notes/${encodeURIComponent(noteId)}/summary`);
+
+  if (!response.ok) {
+    status.textContent = 'AI read failed.';
+    return;
+  }
+
+  const body = await response.json();
+  const note = currentNotes.find((item) => item.id === noteId);
+  renderTimeline([
+    ...(note?.thinkingTimeline || []),
+    { label: 'AI reader', detail: body.summary, at: Date.now() }
+  ]);
+  status.textContent = 'AI summary ready.';
 }
 
-function clearNotes() {
-  localStorage.removeItem(KEY);
-  renderNotes([]);
-  timeline.innerHTML = '';
-  status.textContent = "Cleared";
+async function clearNotes() {
+  status.textContent = 'Clearing notes...';
+  const response = await fetch('/api/notes', { method: 'DELETE' });
+
+  if (!response.ok) {
+    status.textContent = 'Clear failed.';
+    return;
+  }
+
+  renderTimeline([]);
+  await loadNotes();
+  status.textContent = 'All notes cleared.';
 }
 
-saveBtn.onclick = saveNote;
-clearBtn.onclick = clearNotes;
+saveBtn.addEventListener('click', () => {
+  saveNote().catch((error) => {
+    saveBtn.disabled = false;
+    status.textContent = error.message || 'Save error.';
+  });
+});
+
+refreshBtn.addEventListener('click', () => {
+  loadNotes().catch((error) => {
+    status.textContent = error.message || 'Load error.';
+  });
+});
+
+clearBtn.addEventListener('click', () => {
+  clearNotes().catch((error) => {
+    status.textContent = error.message || 'Clear error.';
+  });
+});
 
-renderNotes(getLocal());
-EOF
+loadNotes().catch((error) => {
+  status.textContent = `${error.message}. Start the backend server.`;
+});
 
EOF
)
