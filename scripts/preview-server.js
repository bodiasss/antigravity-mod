'use strict';

/**
 * Antigravity Mod UI Preview Server
 * Serves the Mod Overview UI with live reactive data streaming from data-service.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const dataService = require('../core/data-service');

const PORT = 3300;
const MODULE_DIR = path.resolve(__dirname, '../modules/mod-overview');

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/api/overview') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(dataService.getOverviewData()));
    return;
  }

  if (url === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('retry: 2000\n\n');

    const onUpdate = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    dataService.on('update', onUpdate);
    req.on('close', () => {
      dataService.removeListener('update', onUpdate);
    });
    return;
  }

  let filePath = path.join(MODULE_DIR, url === '/' ? 'preview.html' : url);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8'
    };
    const contentType = mimeTypes[ext] || 'text/plain';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n======================================================`);
  console.log(`  Antigravity Mod Overview UI Preview Server`);
  console.log(`  URL: http://127.0.0.1:${PORT}/`);
  console.log(`  Live API: http://127.0.0.1:${PORT}/api/overview`);
  console.log(`======================================================\n`);
});
