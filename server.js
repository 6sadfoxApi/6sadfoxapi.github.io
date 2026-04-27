 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/server.js b/server.js
new file mode 100644
index 0000000000000000000000000000000000000000..9952a4375629a4450f18aa33374ee205a36f47b5
--- /dev/null
+++ b/server.js
@@ -0,0 +1,24 @@
+const http = require('http');
+
+const port = Number(process.env.PORT || 3000);
+
+const server = http.createServer((req, res) => {
+  if (req.url === '/' || req.url === '/health') {
+    if (req.url === '/') {
+      res.writeHead(200, { 'Content-Type': 'application/json' });
+      res.end(JSON.stringify({ status: 'ok', message: 'Server is live' }));
+      return;
+    }
+
+    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
+    res.end('Server is live');
+    return;
+  }
+
+  res.writeHead(404, { 'Content-Type': 'application/json' });
+  res.end(JSON.stringify({ status: 'error', message: 'Not Found' }));
+});
+
+server.listen(port, () => {
+  console.log(`Server is live on port ${port}`);
+});
 
EOF
)
