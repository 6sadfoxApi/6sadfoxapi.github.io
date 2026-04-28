cat > script.js <<'EOF'
(function initSite() {
  const randomNumberNode = document.getElementById('randomNumber');
  const noteInput = document.getElementById('noteInput');
  const saveNoteButton = document.getElementById('saveNote');
  const clearNotesButton = document.getElementById('clearNotes');
  const notesList = document.getElementById('notesList');
  const noteStatus = document.getElementById('noteStatus');
  const thinkingTimeline = document.getElementById('thinkingTimeline');

  const LOCAL_NOTES_KEY = 'sixSadFoxNotesFallback';

  function generateNumber() {
    if (randomNumberNode) {
      randomNumberNode.textContent = String(Math.floor(Math.random() * 1000));
    }
  }

  generateNumber();
  setInterval(generateNumber, 3000);

  function setNoteStatus(message) {
    if (noteStatus) noteStatus.textContent = message;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[char]);
  }

  function createLocalTimeline(text) {
    const now = Date.now();
    const words = text.trim().split(/\s+/).filter(Boolean);

    return [
      {
        label: 'Note received',
        detail: `Captured ${words.length} words from note input.`,
        at: new Date(now).toISOString()
      },
      {
        label: 'Local metadata attached',
        detail: 'Added browser timestamp, source page, and local storage flag.',
        at: new Date(now + 300).toISOString()
      },
      {
        label: 'Database fallback write',
        detail: 'Saved note to browser localStorage because backend API is offline.',
        at: new Date(now + 600).toISOString()
      },
      {
        label: 'AI-ready display',
        detail: 'Note is visible in the saved notes database panel.',
        at: new Date(now + 900).toISOString()
      }
    ];
  }

  function renderTimeline(events = []) {
    if (!thinkingTimeline) return;

    if (!events.length) {
      thinkingTimeline.innerHTML = '<div class="timeline-empty">Waiting for a note...</div>';
      return;
    }

    thinkingTimeline.innerHTML = events.map((event, index) => `
      <div class="timeline-item" style="animation-delay:${index * 90}ms">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <strong>${escapeHtml(event.label)}</strong>
          <p>${escapeHtml(event.detail)}</p>
          <small>${new Date(event.at).toLocaleString()}</small>
        </div>
      </div>
    `).join('');
  }

  function getLocalNotes() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_NOTES_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveLocalNotes(notes) {
    localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(notes));
  }

  function renderNotes(notes) {
    if (!notesList) return;

    if (!notes.length) {
      notesList.innerHTML = '<p class="status-line">No notes saved yet.</p>';
      renderTimeline([]);
      return;
    }

    renderTimeline(notes[0].thinkingTimeline || []);

    notesList.innerHTML = notes.map((note) => `
      <div class="note-card saved-pop">
        <small>${new Date(note.createdAt).toLocaleString()}</small>
        <p>${escapeHtml(note.text)}</p>

        <div class="note-meta">
          <span>ID: ${escapeHtml(note.id || 'local')}</span>
          <span>IP: ${escapeHtml(note.ipAddress || 'local browser')}</span>
          <span>Source: ${escapeHtml(note.source || 'homepage-notes')}</span>
        </div>

        <div class="note-meta">
          <span>Words: ${escapeHtml(note.metadata?.wordCount ?? '0')}</span>
          <span>Chars: ${escapeHtml(note.metadata?.length ?? '0')}</span>
          <span>Storage: ${escapeHtml(note.storage || 'localStorage')}</span>
        </div>
      </div>
    `).join('');
  }

  async function loadNotes() {
    try {
      const response = await fetch('/api/notes');

      if (!response.ok) throw new Error('API offline');

      const notes = await response.json();
      renderNotes(Array.isArray(notes) ? notes : []);
      setNoteStatus('Notes loaded from backend data/notes.json.');
    } catch {
      const localNotes = getLocalNotes().slice().reverse();
      renderNotes(localNotes);
      setNoteStatus('Backend offline. Notes using browser local database.');
    }
  }

  async function saveNote() {
    const text = noteInput?.value.trim();

    if (!text) {
      setNoteStatus('Type a note first.');
      return;
    }

    if (saveNoteButton) {
      saveNoteButton.disabled = true;
      saveNoteButton.textContent = 'Saving...';
    }

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) throw new Error('Backend offline');

      const savedNote = await response.json();
      noteInput.value = '';
      renderTimeline(savedNote.thinkingTimeline || []);
      await loadNotes();
      setNoteStatus('Note saved to backend data/notes.json.');
    } catch {
      const localNote = {
        id: `local-${Date.now()}`,
        text,
        createdAt: new Date().toISOString(),
        ipAddress: 'local browser',
        userAgent: navigator.userAgent,
        source: 'homepage-notes',
        storage: 'localStorage',
        metadata: {
          length: text.length,
          wordCount: text.split(/\s+/).filter(Boolean).length,
          endpoint: 'local fallback'
        },
        thinkingTimeline: createLocalTimeline(text)
      };

      const notes = getLocalNotes();
      notes.push(localNote);
      saveLocalNotes(notes.slice(-250));

      noteInput.value = '';
      renderTimeline(localNote.thinkingTimeline);
      await loadNotes();
      setNoteStatus('Note saved locally. Backend API is not running.');
    } finally {
      if (saveNoteButton) {
        saveNoteButton.disabled = false;
        saveNoteButton.textContent = 'Save Note';
      }
    }
  }

  async function clearNotes() {
    try {
      await fetch('/api/notes', { method: 'DELETE' });
    } catch {
      // backend offline
    }

    localStorage.removeItem(LOCAL_NOTES_KEY);
    await loadNotes();
    setNoteStatus('Notes cleared.');
  }

  if (saveNoteButton) saveNoteButton.addEventListener('click', saveNote);
  if (clearNotesButton) clearNotesButton.addEventListener('click', clearNotes);

  loadNotes();
})();
EOF

git add script.js
git commit -m "Fix notes save with local fallback"
git push origin main
