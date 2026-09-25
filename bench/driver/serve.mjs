// Tiny static file server for a built app directory.
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
};
export function serve(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/' || p === '') p = '/index.html';
      const file = join(dir, p);
      try {
        const st = statSync(file);
        if (!st.isFile()) throw new Error('nf');
        res.writeHead(200, {
          'content-type': types[extname(file)] ?? 'application/octet-stream',
          'cache-control': 'no-store',
          'cross-origin-opener-policy': 'same-origin',
          'cross-origin-embedder-policy': 'require-corp',
        });
        createReadStream(file).pipe(res);
      } catch {
        res.writeHead(404);
        res.end('not found ' + p);
      }
    });
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` }),
    );
  });
}
