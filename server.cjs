const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const port = Number(process.env.PORT || 8001);

const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/gestures.js': ['gestures.js', 'text/javascript; charset=utf-8'],
  '/hand-tracker.js': ['hand-tracker.js', 'text/javascript; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/portrait-data.json': ['portrait-data.json', 'application/json; charset=utf-8']
};

http.createServer((request, response) => {
  const route = new URL(request.url, 'http://localhost').pathname;
  if (route === '/rose' || route === '/rose/v2' || route === '/rose/v3') {
    response.writeHead(302, { Location: `${route}/` });
    response.end();
    return;
  }
  let file = files[route];
  if (route === '/rose/' || route === '/rose/v2/' || route === '/rose/v3/') {
    file = [route.slice(1) + 'index.html', 'text/html; charset=utf-8'];
  } else if (/^\/rose\/[a-zA-Z0-9_./-]+$/.test(route) && !route.split('/').includes('..')) {
    const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mp3': 'audio/mpeg' }[path.extname(route)];
    if (mime) file = [route.slice(1), mime];
  }
  if (/^\/vendor\/hands\/[a-zA-Z0-9_.-]+$/.test(route)) {
    const mime = {'.js': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.gz': 'application/gzip', '.data': 'application/octet-stream', '.tflite': 'application/octet-stream', '.binarypb': 'application/octet-stream'}[path.extname(route)];
    if (mime) file = [route.slice(1), mime];
  }
  if (!file) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.setHeader('Content-Type', file[1]);
  if (file[1] === 'audio/mpeg') {
    const audioPath = path.join(__dirname, file[0]);
    let size;
    try { size = fs.statSync(audioPath).size; }
    catch { response.writeHead(404); response.end('Not found'); return; }
    response.setHeader('Accept-Ranges', 'bytes');
    if (request.headers.range) {
      const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range);
      const start = range ? Number(range[1]) : NaN;
      const end = range && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
        response.writeHead(416, { 'Content-Range': `bytes */${size}` });
        response.end();
        return;
      }
      response.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
      fs.createReadStream(audioPath, { start, end }).pipe(response);
      return;
    }
    response.setHeader('Content-Length', size);
  }
  const stream = fs.createReadStream(path.join(__dirname, file[0]));
  stream.on('error', () => {
    if (!response.headersSent) response.writeHead(500);
    response.end('Server error');
  });
  stream.pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`粒子系统已启动：http://localhost:${port}`);
});
