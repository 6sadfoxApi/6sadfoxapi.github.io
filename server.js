cat > server.js <<'EOF'
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const net = require('net');

const cors = require('cors');
const express = require('express');
const cheerio = require('cheerio');

const app = express();
const PORT = Number(process.env.PORT || 3000);

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'scrapes.json');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(ROOT));

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf8');
  }
}

function readScrapes() {
  ensureDataFile();

  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeScrapes(scrapes) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(scrapes, null, 2), 'utf8');
}

function isPrivateIp(ip) {
  if (net.isIP(ip) === 4) {
    const parts = ip.split('.').map(Number);

    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 169 && parts[1] === 254) ||
      parts[0] === 0
    );
  }

  if (net.isIP(ip) === 6) {
    return (
      ip === '::1' ||
      ip.startsWith('fc') ||
      ip.startsWith('fd') ||
      ip.startsWith('fe80')
    );
  }

  return true;
}

async function validatePublicUrl(rawUrl) {
  const parsed = new URL(rawUrl);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs are allowed.');
  }

  const records = await dns.lookup(parsed.hostname, { all: true });

  if (!records.length) {
    throw new Error('Could not resolve hostname.');
  }

  if (records.some((record) => isPrivateIp(record.address))) {
    throw new Error('Private/internal network URLs are blocked.');
  }

  return parsed.toString();
}

function extractMetadata(html, url) {
  const $ = cheerio.load(html);

  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('title').first().text() ||
    'Untitled';

  const description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    $('meta[name="twitter:description"]').attr('content') ||
    'No description found.';

  const image =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    '';

  return {
    id: crypto.randomUUID(),
    url,
    title: title.trim(),
    description: description.trim(),
    image,
    createdAt: new Date().toISOString()
  };
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is live' });
});

app.get('/api/history', (req, res) => {
  const scrapes = readScrapes();
  res.json(scrapes.slice().reverse());
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
        'User-Agent': '6SadFoxBot/1.0 (+https://6sadfoxapi.github.io)'
      },
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      return res.status(400).json({
        error: `Fetch failed with status ${response.status}`
      });
    }

    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) {
      return res.status(400).json({
        error: 'URL did not return HTML.'
      });
    }

    const html = await response.text();
    const scrape = extractMetadata(html, safeUrl);

    const scrapes = readScrapes();
    scrapes.push(scrape);
    writeScrapes(scrapes.slice(-100));

    res.json(scrape);
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Scrape failed.'
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

ensureDataFile();

app.listen(PORT, () => {
  console.log(`Server is live on http://localhost:${PORT}`);
});
EOF
