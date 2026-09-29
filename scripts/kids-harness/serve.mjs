// Tiny static server for the harness page (used by the playtest script).
import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Falls back to the app's public/ folder (sounds, icons).
const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public')

export function serve(dir, port = 0) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.svg': 'image/svg+xml', '.png': 'image/png' }
  const server = createServer((req, res) => {
    const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/$/, '/index.html').replace(/^\/tamizhi\//, '/')
    let p = path.join(dir, rel)
    if (!existsSync(p)) p = path.join(pub, rel)
    if (!(p.startsWith(dir) || p.startsWith(pub)) || !existsSync(p)) {
      res.writeHead(404)
      res.end()
      return
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' })
    res.end(readFileSync(p))
  })
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` })))
}
