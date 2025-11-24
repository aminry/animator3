/**
 * Simple HTTP server to serve the viewer.html and output files
 * Run with: node serve.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const mimeTypes = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.css': 'text/css'
};

const server = http.createServer((req, res) => {
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './viewer.html';
  }

  const extname = path.extname(filePath);
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('🎬 Lottie Animation Viewer Server');
  console.log('================================');
  console.log('');
  console.log(`✅ Server running at http://localhost:${PORT}/`);
  console.log('');
  console.log('📖 Open in your browser:');
  console.log(`   http://localhost:${PORT}/viewer.html`);
  console.log('');
  console.log('Press Ctrl+C to stop the server');
  console.log('');
});
