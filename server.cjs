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
  let file = files[route];
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
  const stream = fs.createReadStream(path.join(__dirname, file[0]));
  stream.on('error', () => {
    if (!response.headersSent) response.writeHead(500);
    response.end('Server error');
  });
  stream.pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`粒子系统已启动：http://localhost:${port}`);
});
