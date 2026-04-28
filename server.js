cat > server.js <<'EOF'
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

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'unknown';
}

function isPrivateIp(ip) {
  if (net.isIP(ip) === 4) {
    const p = ip.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 169 && p[1] === 254);
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
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').first().text() ||
      'Untitled'
    ).trim(),
    description: (
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      'No description found.'
    ).trim(),
    image: (
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      ''
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
      headers: {
        'User-Agent': '6SadFoxBot/1.0'
      },
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      return res.status(400).json({ error: `Fetch failed with status ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) {
      return res.status(400).json({ error: 'URL did not return HTML.' });
    }

    const html = await response.text();
    const scrape = extractMetadata(html, safeUrl);

    const scrapes = readJson(SCRAPES_FILE);
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

app.post('/api/notes', (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing note text.' });
  }

  const note = {
    id: crypto.randomUUID(),
    text: text.trim(),
    createdAt: new Date().toISOString(),
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    source: 'homepage-notes'
  };

  const notes = readJson(NOTES_FILE);
  notes.push(note);
  writeJson(NOTES_FILE, notes.slice(-250));

  res.json(note);
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
EOF
