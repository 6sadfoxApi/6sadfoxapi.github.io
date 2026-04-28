 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/server.js b/server.js
index 6d7f2365b105279e9245907d7b9c5484e5d67619..4a56753463793112c8d6480057d1eb36546b0d53 100644
--- a/server.js
+++ b/server.js
@@ -1,239 +1,344 @@
-cat > server.js <<'EOF'
 require('dotenv').config();
 
 const fs = require('fs');
 const path = require('path');
 const dns = require('dns').promises;
 const net = require('net');
 const crypto = require('crypto');
 
 const cors = require('cors');
 const express = require('express');
 const cheerio = require('cheerio');
 
 const app = express();
 const PORT = Number(process.env.PORT || 3000);
 
 const ROOT = __dirname;
 const DATA_DIR = path.join(ROOT, 'data');
 const SCRAPES_FILE = path.join(DATA_DIR, 'scrapes.json');
 const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
 
 app.use(cors());
 app.use(express.json({ limit: '1mb' }));
 app.use(express.static(ROOT));
 
 function ensureJsonFile(filePath) {
   if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
   if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '[]', 'utf8');
 }
 
 function readJson(filePath) {
   ensureJsonFile(filePath);
-
   try {
     return JSON.parse(fs.readFileSync(filePath, 'utf8'));
   } catch {
     return [];
   }
 }
 
 function writeJson(filePath, data) {
   ensureJsonFile(filePath);
   fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
 }
 
-function getClientIp(req) {
-  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
-    || req.socket.remoteAddress
-    || 'unknown';
-}
-
 function createThinkingTimeline(text) {
   const words = text.trim().split(/\s+/).filter(Boolean);
   const now = Date.now();
 
   return [
     {
       label: 'Note received',
       detail: `Captured ${words.length} words from homepage input.`,
       at: new Date(now).toISOString()
     },
     {
       label: 'Metadata attached',
-      detail: 'Added timestamp, request IP, source page, and browser user agent.',
+      detail: 'Added timestamp, request IP, browser user agent, and priority/tags.',
       at: new Date(now + 300).toISOString()
     },
     {
-      label: 'Intent scan',
-      detail: words.length > 8 ? 'Longer note detected. Marked as detailed input.' : 'Short note detected. Marked as quick input.',
+      label: 'Semantic pass',
+      detail: 'Created lexical metrics (word count, unique ratio, average word length).',
       at: new Date(now + 600).toISOString()
     },
     {
       label: 'Database write',
       detail: 'Saved note to data/notes.json.',
       at: new Date(now + 900).toISOString()
     },
     {
       label: 'AI-ready output',
-      detail: 'Note is now available through /api/notes for your robot/backend.',
+      detail: 'Note is now available through /api/notes and /api/notes/ai-feed.',
       at: new Date(now + 1200).toISOString()
     }
   ];
 }
 
+function getClientIp(req) {
+  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
+    || req.socket.remoteAddress
+    || 'unknown';
+}
+
+function normalizeTags(tags) {
+  if (!Array.isArray(tags)) return [];
+  return tags
+    .map((tag) => String(tag).trim().toLowerCase())
+    .filter(Boolean)
+    .slice(0, 8);
+}
+
+function sentimentFromText(text) {
+  const positives = ['good', 'great', 'awesome', 'win', 'happy', 'progress', 'improve'];
+  const negatives = ['bad', 'bug', 'issue', 'fail', 'sad', 'blocked', 'error'];
+
+  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
+  let score = 0;
+
+  for (const token of tokens) {
+    if (positives.includes(token)) score += 1;
+    if (negatives.includes(token)) score -= 1;
+  }
+
+  if (score > 0) return 'positive';
+  if (score < 0) return 'negative';
+  return 'neutral';
+}
+
+function analyzeNote(text) {
+  const tokens = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
+  const unique = new Set(tokens);
+  const totalChars = tokens.reduce((sum, token) => sum + token.length, 0);
+
+  return {
+    wordCount: tokens.length,
+    uniqueWordRatio: tokens.length ? Number((unique.size / tokens.length).toFixed(2)) : 0,
+    averageWordLength: tokens.length ? Number((totalChars / tokens.length).toFixed(2)) : 0,
+    sentiment: sentimentFromText(text)
+  };
+}
+
+async function summarizeWithOpenAI(note) {
+  const apiKey = process.env.OPENAI_API_KEY;
+  if (!apiKey) return null;
+
+  const prompt = [
+    'Summarize the following note in 2 concise bullet points and 1 action item.',
+    `Text: ${note.text}`,
+    `Priority: ${note.priority}`,
+    `Tags: ${(note.tags || []).join(', ') || 'none'}`
+  ].join('\n');
+
+  const response = await fetch('https://api.openai.com/v1/responses', {
+    method: 'POST',
+    headers: {
+      'Content-Type': 'application/json',
+      Authorization: `Bearer ${apiKey}`
+    },
+    body: JSON.stringify({
+      model: 'gpt-4.1-mini',
+      input: prompt,
+      max_output_tokens: 180
+    })
+  });
+
+  if (!response.ok) {
+    return null;
+  }
+
+  const body = await response.json();
+  return body.output_text || null;
+}
+
+function fallbackSummary(note) {
+  return [
+    `Priority ${note.priority} note with ${note.analysis.wordCount} words and ${note.analysis.sentiment} sentiment.`,
+    `Tags: ${(note.tags || []).join(', ') || 'none'}.`,
+    `Action: review and convert this note into one concrete next task.`
+  ].join(' ');
+}
+
 function isPrivateIp(ip) {
   if (net.isIP(ip) === 4) {
     const p = ip.split('.').map(Number);
-    return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
-      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
-      (p[0] === 192 && p[1] === 168) ||
-      (p[0] === 169 && p[1] === 254);
+    return p[0] === 10 || p[0] === 127 || p[0] === 0
+      || (p[0] === 172 && p[1] >= 16 && p[1] <= 31)
+      || (p[0] === 192 && p[1] === 168)
+      || (p[0] === 169 && p[1] === 254);
   }
 
   if (net.isIP(ip) === 6) {
     return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80');
   }
 
   return true;
 }
 
 async function validatePublicUrl(rawUrl) {
   const parsed = new URL(rawUrl);
 
   if (!['http:', 'https:'].includes(parsed.protocol)) {
     throw new Error('Only http and https URLs are allowed.');
   }
 
   const records = await dns.lookup(parsed.hostname, { all: true });
 
   if (!records.length || records.some((r) => isPrivateIp(r.address))) {
     throw new Error('Private/internal URLs are blocked.');
   }
 
   return parsed.toString();
 }
 
 function extractMetadata(html, url) {
   const $ = cheerio.load(html);
 
   return {
     id: crypto.randomUUID(),
     url,
     title: (
-      $('meta[property="og:title"]').attr('content') ||
-      $('meta[name="twitter:title"]').attr('content') ||
-      $('title').first().text() ||
-      'Untitled'
+      $('meta[property="og:title"]').attr('content')
+      || $('meta[name="twitter:title"]').attr('content')
+      || $('title').first().text()
+      || 'Untitled'
     ).trim(),
     description: (
-      $('meta[property="og:description"]').attr('content') ||
-      $('meta[name="description"]').attr('content') ||
-      $('meta[name="twitter:description"]').attr('content') ||
-      'No description found.'
+      $('meta[property="og:description"]').attr('content')
+      || $('meta[name="description"]').attr('content')
+      || $('meta[name="twitter:description"]').attr('content')
+      || 'No description found.'
     ).trim(),
     image: (
-      $('meta[property="og:image"]').attr('content') ||
-      $('meta[name="twitter:image"]').attr('content') ||
-      ''
+      $('meta[property="og:image"]').attr('content')
+      || $('meta[name="twitter:image"]').attr('content')
+      || ''
     ).trim(),
     createdAt: new Date().toISOString()
   };
 }
 
 app.get('/health', (req, res) => {
   res.json({ status: 'ok', message: 'Server is live' });
 });
 
 app.get('/api/history', (req, res) => {
   res.json(readJson(SCRAPES_FILE).slice().reverse());
 });
 
 app.post('/api/scrape', async (req, res) => {
   try {
     const { url } = req.body;
 
     if (!url || typeof url !== 'string') {
       return res.status(400).json({ error: 'Missing URL.' });
     }
 
     const safeUrl = await validatePublicUrl(url);
 
     const response = await fetch(safeUrl, {
       headers: { 'User-Agent': '6SadFoxBot/1.0' },
       signal: AbortSignal.timeout(12000)
     });
 
     if (!response.ok) {
       return res.status(400).json({ error: `Fetch failed with status ${response.status}` });
     }
 
     const contentType = response.headers.get('content-type') || '';
-
     if (!contentType.includes('text/html')) {
       return res.status(400).json({ error: 'URL did not return HTML.' });
     }
 
     const scrape = extractMetadata(await response.text(), safeUrl);
     const scrapes = readJson(SCRAPES_FILE);
-
     scrapes.push(scrape);
     writeJson(SCRAPES_FILE, scrapes.slice(-100));
 
     res.json(scrape);
   } catch (error) {
     res.status(500).json({ error: error.message || 'Scrape failed.' });
   }
 });
 
 app.get('/api/notes', (req, res) => {
   res.json(readJson(NOTES_FILE).slice().reverse());
 });
 
+app.get('/api/notes/ai-feed', (req, res) => {
+  const notes = readJson(NOTES_FILE).slice(-50).map((note) => ({
+    id: note.id,
+    text: note.text,
+    priority: note.priority,
+    tags: note.tags,
+    createdAt: note.createdAt,
+    analysis: note.analysis
+  }));
+
+  res.json({ count: notes.length, notes });
+});
+
 app.post('/api/notes', (req, res) => {
-  const { text } = req.body;
+  const { text, tags, priority } = req.body;
 
   if (!text || typeof text !== 'string') {
     return res.status(400).json({ error: 'Missing note text.' });
   }
 
   const cleanText = text.trim();
+  if (!cleanText) {
+    return res.status(400).json({ error: 'Note text cannot be empty.' });
+  }
+
+  const safePriority = ['low', 'normal', 'high'].includes(priority) ? priority : 'normal';
 
   const note = {
     id: crypto.randomUUID(),
     text: cleanText,
+    tags: normalizeTags(tags),
+    priority: safePriority,
     createdAt: new Date().toISOString(),
     ipAddress: getClientIp(req),
     userAgent: req.headers['user-agent'] || 'unknown',
     source: 'homepage-notes',
-    metadata: {
-      length: cleanText.length,
-      wordCount: cleanText.split(/\s+/).filter(Boolean).length,
-      endpoint: '/api/notes'
-    },
+    analysis: analyzeNote(cleanText),
     thinkingTimeline: createThinkingTimeline(cleanText)
   };
 
   const notes = readJson(NOTES_FILE);
   notes.push(note);
   writeJson(NOTES_FILE, notes.slice(-250));
 
-  res.json(note);
+  res.status(201).json(note);
+});
+
+app.get('/api/notes/:id/summary', async (req, res) => {
+  const notes = readJson(NOTES_FILE);
+  const note = notes.find((item) => item.id === req.params.id);
+
+  if (!note) {
+    return res.status(404).json({ error: 'Note not found.' });
+  }
+
+  try {
+    const summary = (await summarizeWithOpenAI(note)) || fallbackSummary(note);
+    res.json({ id: note.id, summary, source: process.env.OPENAI_API_KEY ? 'openai_or_fallback' : 'fallback' });
+  } catch {
+    res.json({ id: note.id, summary: fallbackSummary(note), source: 'fallback' });
+  }
 });
 
 app.delete('/api/notes', (req, res) => {
   writeJson(NOTES_FILE, []);
   res.json({ status: 'ok', message: 'Notes cleared.' });
 });
 
 app.get('/', (req, res) => {
   res.sendFile(path.join(ROOT, 'index.html'));
 });
 
 ensureJsonFile(SCRAPES_FILE);
 ensureJsonFile(NOTES_FILE);
 
 app.listen(PORT, () => {
   console.log(`Server is live on http://localhost:${PORT}`);
 });
-EOF
 
EOF
)
