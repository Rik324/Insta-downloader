const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const COBALT_API = process.env.COBALT_API || 'https://co.wuk.sh/api/json';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const publicDir = path.join(__dirname, 'public');

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  const safePath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.normalize(path.join(publicDir, safePath));

  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

async function handleDownload(req, res) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const { url, platform, type } = JSON.parse(body || '{}');

      if (!url || typeof url !== 'string') {
        sendJson(res, 400, { error: 'A valid URL is required.' });
        return;
      }

      const normalizedPlatform = String(platform || '').toLowerCase();
      if (!['instagram', 'tiktok'].includes(normalizedPlatform)) {
        sendJson(res, 400, { error: 'Platform must be Instagram or TikTok.' });
        return;
      }

      const normalizedType = String(type || '').toLowerCase();
      if (!['video', 'story'].includes(normalizedType)) {
        sendJson(res, 400, { error: 'Type must be video or story.' });
        return;
      }

      const cobaltResponse = await fetch(COBALT_API, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          downloadMode: 'auto',
          videoQuality: 'max',
          filenamePattern: 'basic',
          disableMetadata: true,
        }),
      });

      const data = await cobaltResponse.json();

      if (!cobaltResponse.ok || data.status === 'error') {
        sendJson(res, 400, {
          error: data.text || 'Failed to resolve media URL from provider.',
          providerResponse: data,
        });
        return;
      }

      if (data.status === 'picker' && Array.isArray(data.picker) && data.picker.length > 0) {
        const firstVideo = data.picker.find((item) => item.type === 'video') || data.picker[0];
        sendJson(res, 200, {
          status: 'ok',
          downloadUrl: firstVideo.url,
          sourceUrl: url,
          platform: normalizedPlatform,
          type: normalizedType,
          watermark: 'removed_when_available',
        });
        return;
      }

      if (data.status === 'stream' || data.status === 'redirect' || data.url) {
        sendJson(res, 200, {
          status: 'ok',
          downloadUrl: data.url,
          sourceUrl: url,
          platform: normalizedPlatform,
          type: normalizedType,
          watermark: 'removed_when_available',
        });
        return;
      }

      sendJson(res, 400, { error: 'Unsupported response from media provider.', providerResponse: data });
    } catch (error) {
      sendJson(res, 500, {
        error: 'Server failed to process request.',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/download') {
    handleDownload(req, res);
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
