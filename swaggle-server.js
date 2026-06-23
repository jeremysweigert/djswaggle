/* =====================================================================
   swaggle-server.js  —  tiny score server for DJ SWAGGLE vs THE ALGORITHMS
   ---------------------------------------------------------------------
   - Serves swaggle.html (and any assets next to it) on PORT.
   - Stores the leaderboard in scores.json, SEPARATE from the HTML.
     Updating / replacing swaggle.html never touches scores.json.
   - GET  /scores  -> returns the leaderboard as a JSON array
     POST /scores  -> body = one score {id,n,s,d} or an array of them;
                      merges (highest score per id, top 50), saves, returns it.

   No dependencies. Run it with:   node swaggle-server.js
   Then open:                      http://localhost:8099
   Change the port:                PORT=9000 node swaggle-server.js

   To plug scores into an existing server instead of running this one,
   copy the readScores / writeScores / merge helpers and the two /scores
   branches into that server — that's the whole feature.
   ===================================================================== */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const ROOT   = __dirname;
const SCORES = path.join(ROOT, 'scores.json');
const PORT   = process.env.PORT || 8099;

const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg', '.gif':'image/gif', '.webp':'image/webp', '.svg':'image/svg+xml',
  '.mp3':'audio/mpeg', '.wav':'audio/wav', '.ogg':'audio/ogg', '.ico':'image/x-icon',
  '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf'
};

function readScores(){
  try { const a = JSON.parse(fs.readFileSync(SCORES, 'utf8')); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function writeScores(arr){
  // write to a temp file then rename = no half-written / corrupted scores.json
  try { const tmp = SCORES + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(arr)); fs.renameSync(tmp, SCORES); }
  catch (e) { console.error('scores write failed:', e.message); }
}
function merge(a, b){
  const m = {};
  [].concat(a || [], b || []).forEach(function(e){
    if (!e || e.id == null) return;
    // basic sanitising so a bad client can't poison the file
    const id = String(e.id).slice(0, 64);
    const n  = String(e.n == null ? 'PLAYER' : e.n).toUpperCase().slice(0, 12);
    const s  = Math.max(0, Math.min(1e12, parseInt(e.s, 10) || 0));
    const d  = parseInt(e.d, 10) || Date.now();
    if (!m[id] || s > m[id].s) m[id] = { id: id, n: n, s: s, d: d };
  });
  return Object.keys(m).map(function(k){ return m[k]; })
                       .sort(function(x, y){ return y.s - x.s; })
                       .slice(0, 50);
}

http.createServer(function(req, res){
  const u = url.parse(req.url);

  // allow the game to talk to this server even if it's hosted elsewhere
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // ---- scores API ----
  if (u.pathname === '/scores' || u.pathname === '/scores.php') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(readScores()));
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', function(d){ body += d; if (body.length > 1e6) req.destroy(); });
      req.on('end', function(){
        let inc = [];
        try { inc = JSON.parse(body); if (!Array.isArray(inc)) inc = [inc]; } catch (e) {}
        const merged = merge(readScores(), inc);
        writeScores(merged);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(merged));
      });
      return;
    }
    res.writeHead(405); return res.end('method not allowed');
  }

  // ---- static files (swaggle.html etc.) ----
  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/swaggle.html';
  const safe = path.normalize(p).replace(/^(\.\.[\/\\])+/, '');
  const fp = path.join(ROOT, safe);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }

  fs.readFile(fp, function(e, data){
    if (e) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, function(){
  console.log('DJ SWAGGLE server running:  http://localhost:' + PORT);
  console.log('Leaderboard file:           ' + SCORES);
  console.log('Updating swaggle.html will NOT touch scores.json.');
});
