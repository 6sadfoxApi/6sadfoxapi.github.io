 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/script.js b/script.js
new file mode 100644
index 0000000000000000000000000000000000000000..29c9a670f6c7e1b24feea359833ed85b6bf1066b
--- /dev/null
+++ b/script.js
@@ -0,0 +1,103 @@
+(function initSite() {
+  const randomNumberNode = document.getElementById('randomNumber');
+
+  function generateNumber() {
+    if (!randomNumberNode) {
+      return;
+    }
+
+    const num = Math.floor(Math.random() * 1000);
+    randomNumberNode.textContent = String(num);
+  }
+
+  generateNumber();
+  setInterval(generateNumber, 3000);
+
+  const canvas = document.getElementById('snakeCanvas');
+  if (!canvas) {
+    return;
+  }
+
+  const context = canvas.getContext('2d');
+  const cell = 16;
+  const cols = Math.floor(canvas.width / cell);
+  const rows = Math.floor(canvas.height / cell);
+
+  let direction = { x: 1, y: 0 };
+  let snake = [{ x: Math.floor(cols / 3), y: Math.floor(rows / 2) }];
+  let targetLength = 22;
+  let timer = 0;
+
+  function randomTurn() {
+    const turns = [
+      { x: 1, y: 0 },
+      { x: -1, y: 0 },
+      { x: 0, y: 1 },
+      { x: 0, y: -1 },
+    ].filter((next) => !(next.x === -direction.x && next.y === -direction.y));
+
+    direction = turns[Math.floor(Math.random() * turns.length)];
+  }
+
+  function drawGrid() {
+    context.fillStyle = '#031008';
+    context.fillRect(0, 0, canvas.width, canvas.height);
+
+    context.strokeStyle = 'rgba(57, 255, 136, 0.08)';
+    context.lineWidth = 1;
+
+    for (let x = 0; x <= canvas.width; x += cell) {
+      context.beginPath();
+      context.moveTo(x, 0);
+      context.lineTo(x, canvas.height);
+      context.stroke();
+    }
+
+    for (let y = 0; y <= canvas.height; y += cell) {
+      context.beginPath();
+      context.moveTo(0, y);
+      context.lineTo(canvas.width, y);
+      context.stroke();
+    }
+  }
+
+  function drawSnake() {
+    snake.forEach((part, index) => {
+      const isHead = index === 0;
+      context.fillStyle = isHead ? '#9cffb9' : '#39ff88';
+      context.shadowColor = '#39ff88';
+      context.shadowBlur = isHead ? 18 : 10;
+      context.fillRect(part.x * cell + 2, part.y * cell + 2, cell - 4, cell - 4);
+    });
+    context.shadowBlur = 0;
+  }
+
+  function step() {
+    timer += 1;
+    if (timer % 10 === 0) {
+      randomTurn();
+    }
+
+    const head = snake[0];
+    const next = {
+      x: (head.x + direction.x + cols) % cols,
+      y: (head.y + direction.y + rows) % rows,
+    };
+
+    snake.unshift(next);
+
+    if (snake.length > targetLength) {
+      snake.pop();
+    }
+
+    if (timer % 75 === 0) {
+      targetLength = 14 + Math.floor(Math.random() * 18);
+    }
+
+    drawGrid();
+    drawSnake();
+    window.requestAnimationFrame(step);
+  }
+
+  step();
+})();
 
EOF
)
