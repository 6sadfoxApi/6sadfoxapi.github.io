(cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF'
diff --git a/script.js b/script.js
index 29c9a670f6c7e1b24feea359833ed85b6bf1066b..b5b2cbe9b7c2f2b8b6d38a4b1b6d75f0d46e11a1 100644
--- a/script.js
+++ b/script.js
@@ -1,5 +1,56 @@
 (function initSite() {
   const randomNumberNode = document.getElementById('randomNumber');
+
+  /* -----------------------------
+     NOTES DATABASE
+  ----------------------------- */
+  const noteInput = document.getElementById('noteInput');
+  const saveNoteButton = document.getElementById('saveNote');
+  const clearNotesButton = document.getElementById('clearNotes');
+  const notesList = document.getElementById('notesList');
+  const NOTES_KEY = 'sixSadFoxNotes';
+
+  function escapeHtml(value) {
+    return value.replace(/[&<>"']/g, (char) => ({
+      '&': '&amp;',
+      '<': '&lt;',
+      '>': '&gt;',
+      '"': '&quot;',
+      "'": '&#039;',
+    })[char]);
+  }
+
+  function getNotes() {
+    return JSON.parse(localStorage.getItem(NOTES_KEY)) || [];
+  }
+
+  function saveNotes(notes) {
+    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
+  }
+
+  function renderNotes() {
+    if (!notesList) return;
+
+    const notes = getNotes();
+    notesList.innerHTML = notes.length ? '' : '<p class="status-line">No notes saved yet.</p>';
+
+    notes.slice().reverse().forEach((note) => {
+      const card = document.createElement('div');
+      card.className = 'note-card';
+      card.innerHTML = `
+        <small>${new Date(note.createdAt).toLocaleString()}</small>
+        <p>${escapeHtml(note.text)}</p>
+      `;
+      notesList.appendChild(card);
+    });
+  }
+
+  if (saveNoteButton && noteInput) {
+    saveNoteButton.addEventListener('click', () => {
+      const text = noteInput.value.trim();
+      if (!text) return;
+      saveNotes([...getNotes(), { text, createdAt: new Date().toISOString() }]);
+      noteInput.value = '';
+      renderNotes();
+    });
+  }
+
+  if (clearNotesButton) {
+    clearNotesButton.addEventListener('click', () => {
+      localStorage.removeItem(NOTES_KEY);
+      renderNotes();
+    });
+  }
+
+  renderNotes();
 
   function generateNumber() {
     if (!randomNumberNode) {
@@ -18,9 +69,11 @@ index 0000000000000000000000000000000000000000..29c9a670f6c7e1b24feea359833ed85
   setInterval(generateNumber, 3000);
 
   const canvas = document.getElementById('snakeCanvas');
-  if (!canvas) {
-    return;
-  }
+  if (!canvas) return;
@@ -101,3 +154,101 @@ index 0000000000000000000000000000000000000000..29c9a670f6c7e1b24feea359833ed85
 
   step();
 })();
+
+(function initPong() {
+  const canvas = document.getElementById('pongCanvas');
+  const leftScoreNode = document.getElementById('leftScore');
+  const rightScoreNode = document.getElementById('rightScore');
+
+  if (!canvas) return;
+
+  const context = canvas.getContext('2d');
+  const paddleWidth = 12;
+  const paddleHeight = 78;
+
+  let leftScore = 0;
+  let rightScore = 0;
+
+  const leftPaddle = {
+    x: 28,
+    y: canvas.height / 2 - paddleHeight / 2,
+    speed: 4.6,
+  };
+
+  const rightPaddle = {
+    x: canvas.width - 40,
+    y: canvas.height / 2 - paddleHeight / 2,
+    speed: 4.6,
+  };
+
+  const ball = {
+    x: canvas.width / 2,
+    y: canvas.height / 2,
+    size: 10,
+    vx: 4,
+    vy: 3,
+  };
+
+  function resetBall(direction) {
+    ball.x = canvas.width / 2;
+    ball.y = canvas.height / 2;
+    ball.vx = 4 * direction;
+    ball.vy = (Math.random() > 0.5 ? 1 : -1) * 3;
+  }
+
+  function moveAiPaddle(paddle) {
+    const paddleCenter = paddle.y + paddleHeight / 2;
+    const prediction = ball.y + ball.vy * 8;
+
+    if (paddleCenter < prediction - 10) paddle.y += paddle.speed;
+    if (paddleCenter > prediction + 10) paddle.y -= paddle.speed;
+
+    paddle.y = Math.max(0, Math.min(canvas.height - paddleHeight, paddle.y));
+  }
+
+  function update() {
+    moveAiPaddle(leftPaddle);
+    moveAiPaddle(rightPaddle);
+
+    ball.x += ball.vx;
+    ball.y += ball.vy;
+
+    if (ball.y <= 0 || ball.y + ball.size >= canvas.height) {
+      ball.vy *= -1;
+    }
+
+    const hitLeft =
+      ball.x <= leftPaddle.x + paddleWidth &&
+      ball.y + ball.size >= leftPaddle.y &&
+      ball.y <= leftPaddle.y + paddleHeight;
+
+    const hitRight =
+      ball.x + ball.size >= rightPaddle.x &&
+      ball.y + ball.size >= rightPaddle.y &&
+      ball.y <= rightPaddle.y + paddleHeight;
+
+    if (hitLeft) ball.vx = Math.abs(ball.vx) + 0.05;
+    if (hitRight) ball.vx = -Math.abs(ball.vx) - 0.05;
+
+    if (ball.x < 0) {
+      rightScore += 1;
+      if (rightScoreNode) rightScoreNode.textContent = String(rightScore);
+      resetBall(1);
+    }
+
+    if (ball.x > canvas.width) {
+      leftScore += 1;
+      if (leftScoreNode) leftScoreNode.textContent = String(leftScore);
+      resetBall(-1);
+    }
+  }
+
+  function draw() {
+    context.fillStyle = '#031008';
+    context.fillRect(0, 0, canvas.width, canvas.height);
+
+    context.strokeStyle = 'rgba(57, 255, 136, 0.18)';
+    context.setLineDash([8, 10]);
+    context.beginPath();
+    context.moveTo(canvas.width / 2, 0);
+    context.lineTo(canvas.width / 2, canvas.height);
+    context.stroke();
+    context.setLineDash([]);
+
+    context.fillStyle = '#39ff88';
+    context.fillRect(leftPaddle.x, leftPaddle.y, paddleWidth, paddleHeight);
+    context.fillRect(rightPaddle.x, rightPaddle.y, paddleWidth, paddleHeight);
+
+    context.fillStyle = '#9cffb9';
+    context.fillRect(ball.x, ball.y, ball.size, ball.size);
+  }
+
+  function loop() {
+    update();
+    draw();
+    window.requestAnimationFrame(loop);
+  }
+
+  loop();
+})();
EOF

git add script.js
git commit -m "Add notes storage and AI pong"
git push origin main
)
