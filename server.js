// Nightschool backend: Express + built-in SQLite (needs Node 22.5+, no native installs)
const express = require('express'), crypto = require('crypto'), path = require('path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.env.DB || 'nightschool.db');
db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT UNIQUE COLLATE NOCASE,
  salt TEXT, hash TEXT, xp INTEGER DEFAULT 0, data TEXT DEFAULT '{}')`);
const SECRET = process.env.SECRET || crypto.randomBytes(32).toString('hex');
const app = express();
app.use(express.json({ limit: '50kb' }));

const mac = p => crypto.createHmac('sha256', SECRET).update(p).digest('hex');
const sign = id => { const p = id + '.' + Date.now(); return p + '.' + mac(p); };
const verify = t => {
  const a = (t || '').split('.'); if (a.length !== 3) return null;
  const good = mac(a[0] + '.' + a[1]);
  return a[2].length === good.length && crypto.timingSafeEqual(Buffer.from(a[2]), Buffer.from(good)) ? +a[0] : null;
};
const token = req => ((req.headers.cookie || '').split(';').map(s => s.trim().split('=')).find(x => x[0] === 'ns') || [])[1];
const login = (res, id) => res.setHeader('Set-Cookie', `ns=${sign(id)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`);
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const auth = (req, res, next) => {
  const id = verify(token(req));
  const u = id && db.prepare('SELECT id,name,xp,data FROM users WHERE id=?').get(id);
  if (!u) return res.status(401).json({ error: 'Log in first' });
  req.user = u; next();
};

app.post('/api/register', (req, res) => {
  const { name, password } = req.body || {};
  if (!/^\w{3,20}$/.test(name || '')) return res.status(400).json({ error: 'Name: 3-20 letters, numbers or _' });
  if (typeof password !== 'string' || password.length < 6) return res.status(400).json({ error: 'Password needs 6+ characters' });
  const salt = crypto.randomBytes(16).toString('hex');
  try {
    const r = db.prepare('INSERT INTO users(name,salt,hash) VALUES(?,?,?)').run(name, salt, hashPw(password, salt));
    login(res, Number(r.lastInsertRowid)); res.json({ name });
  } catch { res.status(409).json({ error: 'That name is taken' }); }
});
app.post('/api/login', (req, res) => {
  const { name, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE name=?').get(String(name || ''));
  const ok = u && crypto.timingSafeEqual(Buffer.from(hashPw(String(password || ''), u.salt)), Buffer.from(u.hash));
  if (!ok) return res.status(401).json({ error: 'Wrong name or password' });
  login(res, u.id); res.json({ name: u.name });
});
app.post('/api/logout', (req, res) => { res.setHeader('Set-Cookie', 'ns=; Path=/; Max-Age=0'); res.json({ ok: true }); });
app.get('/api/me', auth, (req, res) => res.json({ name: req.user.name, xp: req.user.xp, data: JSON.parse(req.user.data) }));
app.put('/api/progress', auth, (req, res) => {
  const d = req.body && req.body.data;
  if (!d || typeof d !== 'object') return res.status(400).json({ error: 'Bad data' });
  const xp = Math.min(Math.max(0, Math.floor(Number(d.xp) || 0)), 1e6);
  db.prepare('UPDATE users SET xp=?, data=? WHERE id=?').run(xp, JSON.stringify(d), req.user.id);
  res.json({ xp });
});
app.get('/api/leaderboard', (req, res) =>
  res.json(db.prepare('SELECT name,xp FROM users WHERE xp>0 ORDER BY xp DESC LIMIT 10').all()));

app.use(express.static(path.join(__dirname, 'public')));
app.listen(process.env.PORT || 3000, () => console.log('Nightschool running on http://localhost:' + (process.env.PORT || 3000)));
