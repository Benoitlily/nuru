const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Database setup ──────────────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'nuru.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT DEFAULT '',
    title TEXT DEFAULT '',
    dept TEXT DEFAULT '',
    email TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    company TEXT DEFAULT 'Nuru Communications Group',
    website TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO profile (id) VALUES (1);

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    dept TEXT DEFAULT '',
    description TEXT DEFAULT '',
    start_date TEXT DEFAULT '',
    due_date TEXT DEFAULT '',
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'In Progress',
    progress INTEGER DEFAULT 0,
    created_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    assignee_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'bl',
    due_date TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT DEFAULT '',
    job_title TEXT DEFAULT '',
    dept TEXT DEFAULT '',
    role TEXT DEFAULT 'Member',
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    sender TEXT DEFAULT 'me',
    sender_name TEXT DEFAULT '',
    body TEXT NOT NULL,
    sent_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'General',
    type TEXT DEFAULT 'PDF',
    uploaded_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quicklinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    subtitle TEXT DEFAULT '',
    icon TEXT DEFAULT '🔗',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT DEFAULT '',
    action TEXT NOT NULL,
    entity_type TEXT DEFAULT '',
    entity_name TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helper ──────────────────────────────────────────────────────────────────
function log(actor, action, type, name) {
  try {
    db.prepare(`INSERT INTO activity_log (actor, action, entity_type, entity_name) VALUES (?,?,?,?)`).run(actor||'', action, type||'', name||'');
  } catch(e) {}
}

// ── PROFILE ─────────────────────────────────────────────────────────────────
app.get('/api/profile', (req, res) => {
  const row = db.prepare('SELECT * FROM profile WHERE id=1').get();
  res.json(row);
});

app.put('/api/profile', (req, res) => {
  const { name, title, dept, email, bio, company, website } = req.body;
  db.prepare(`UPDATE profile SET name=?, title=?, dept=?, email=?, bio=?, company=?, website=?, updated_at=datetime('now') WHERE id=1`)
    .run(name||'', title||'', dept||'', email||'', bio||'', company||'', website||'');
  log(name, 'updated their profile', 'profile', name);
  res.json({ ok: true });
});

// ── PROJECTS ─────────────────────────────────────────────────────────────────
app.get('/api/projects', (req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  res.json(rows);
});

app.post('/api/projects', (req, res) => {
  const { name, dept, description, start_date, due_date, priority, status } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare(`INSERT INTO projects (name, dept, description, start_date, due_date, priority, status) VALUES (?,?,?,?,?,?,?)`)
    .run(name, dept||'', description||'', start_date||'', due_date||'', priority||'Medium', status||'In Progress');
  log('', 'created project', 'project', name);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/projects/:id', (req, res) => {
  const { name, dept, description, start_date, due_date, priority, status, progress } = req.body;
  db.prepare(`UPDATE projects SET name=?, dept=?, description=?, start_date=?, due_date=?, priority=?, status=?, progress=?, updated_at=datetime('now') WHERE id=?`)
    .run(name||'', dept||'', description||'', start_date||'', due_date||'', priority||'Medium', status||'In Progress', progress||0, req.params.id);
  log('', 'updated project', 'project', name);
  res.json({ ok: true });
});

app.delete('/api/projects/:id', (req, res) => {
  const p = db.prepare('SELECT name FROM projects WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM projects WHERE id=?').run(req.params.id);
  log('', 'deleted project', 'project', p?.name||'');
  res.json({ ok: true });
});

// ── TASKS ────────────────────────────────────────────────────────────────────
app.get('/api/tasks', (req, res) => {
  const rows = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
  res.json(rows);
});

app.post('/api/tasks', (req, res) => {
  const { title, project_id, assignee_id, priority, status, due_date, notes } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const r = db.prepare(`INSERT INTO tasks (title, project_id, assignee_id, priority, status, due_date, notes) VALUES (?,?,?,?,?,?,?)`)
    .run(title, project_id||null, assignee_id||null, priority||'Medium', status||'bl', due_date||'', notes||'');
  log('', 'created task', 'task', title);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/tasks/:id', (req, res) => {
  const { title, project_id, assignee_id, priority, status, due_date, notes } = req.body;
  db.prepare(`UPDATE tasks SET title=?, project_id=?, assignee_id=?, priority=?, status=?, due_date=?, notes=?, updated_at=datetime('now') WHERE id=?`)
    .run(title||'', project_id||null, assignee_id||null, priority||'Medium', status||'bl', due_date||'', notes||'', req.params.id);
  log('', 'updated task', 'task', title);
  res.json({ ok: true });
});

app.delete('/api/tasks/:id', (req, res) => {
  const t = db.prepare('SELECT title FROM tasks WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM tasks WHERE id=?').run(req.params.id);
  log('', 'deleted task', 'task', t?.title||'');
  res.json({ ok: true });
});

// ── MEMBERS ──────────────────────────────────────────────────────────────────
app.get('/api/members', (req, res) => {
  const rows = db.prepare('SELECT * FROM members ORDER BY created_at DESC').all();
  res.json(rows);
});

app.post('/api/members', (req, res) => {
  const { first_name, last_name, email, job_title, dept, role, status } = req.body;
  if (!first_name || !last_name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare(`INSERT INTO members (first_name, last_name, email, job_title, dept, role, status) VALUES (?,?,?,?,?,?,?)`)
    .run(first_name, last_name, email||'', job_title||'', dept||'', role||'Member', status||'active');
  log('', 'added member', 'member', `${first_name} ${last_name}`);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/members/:id', (req, res) => {
  const { first_name, last_name, email, job_title, dept, role, status } = req.body;
  db.prepare(`UPDATE members SET first_name=?, last_name=?, email=?, job_title=?, dept=?, role=?, status=?, updated_at=datetime('now') WHERE id=?`)
    .run(first_name||'', last_name||'', email||'', job_title||'', dept||'', role||'Member', status||'active', req.params.id);
  log('', 'updated member', 'member', `${first_name} ${last_name}`);
  res.json({ ok: true });
});

app.delete('/api/members/:id', (req, res) => {
  const m = db.prepare('SELECT first_name, last_name FROM members WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM members WHERE id=?').run(req.params.id);
  log('', 'removed member', 'member', m ? `${m.first_name} ${m.last_name}` : '');
  res.json({ ok: true });
});

// ── MESSAGES ─────────────────────────────────────────────────────────────────
app.get('/api/threads', (req, res) => {
  const threads = db.prepare('SELECT * FROM threads ORDER BY created_at DESC').all();
  const result = threads.map(t => {
    const msgs = db.prepare('SELECT * FROM messages WHERE thread_id=? ORDER BY sent_at ASC').all(t.id);
    return { ...t, msgs };
  });
  res.json(result);
});

app.post('/api/threads', (req, res) => {
  const { recipient, message, sender_name } = req.body;
  if (!recipient || !message) return res.status(400).json({ error: 'Recipient and message required' });
  let thread = db.prepare('SELECT * FROM threads WHERE lower(recipient)=lower(?)').get(recipient);
  if (!thread) {
    const r = db.prepare('INSERT INTO threads (recipient) VALUES (?)').run(recipient);
    thread = { id: r.lastInsertRowid, recipient };
  }
  db.prepare('INSERT INTO messages (thread_id, sender, sender_name, body) VALUES (?,?,?,?)').run(thread.id, 'me', sender_name||'', message);
  log(sender_name, 'sent message to', 'message', recipient);
  res.json({ thread_id: thread.id });
});

app.post('/api/threads/:id/reply', (req, res) => {
  const { message, sender_name } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  db.prepare('INSERT INTO messages (thread_id, sender, sender_name, body) VALUES (?,?,?,?)').run(req.params.id, 'me', sender_name||'', message);
  res.json({ ok: true });
});

app.delete('/api/threads/:id', (req, res) => {
  db.prepare('DELETE FROM messages WHERE thread_id=?').run(req.params.id);
  db.prepare('DELETE FROM threads WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── DOCUMENTS ────────────────────────────────────────────────────────────────
app.get('/api/documents', (req, res) => {
  const rows = db.prepare('SELECT * FROM documents ORDER BY created_at DESC').all();
  res.json(rows);
});

app.post('/api/documents', (req, res) => {
  const { name, description, category, type } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare('INSERT INTO documents (name, description, category, type) VALUES (?,?,?,?)')
    .run(name, description||'', category||'General', type||'PDF');
  log('', 'uploaded document', 'document', name);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/documents/:id', (req, res) => {
  const { name, description, category, type } = req.body;
  db.prepare(`UPDATE documents SET name=?, description=?, category=?, type=?, updated_at=datetime('now') WHERE id=?`)
    .run(name||'', description||'', category||'General', type||'PDF', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/documents/:id', (req, res) => {
  db.prepare('DELETE FROM documents WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── QUICK LINKS ───────────────────────────────────────────────────────────────
app.get('/api/quicklinks', (req, res) => {
  res.json(db.prepare('SELECT * FROM quicklinks ORDER BY created_at DESC').all());
});

app.post('/api/quicklinks', (req, res) => {
  const { label, subtitle, icon } = req.body;
  if (!label) return res.status(400).json({ error: 'Label required' });
  const r = db.prepare('INSERT INTO quicklinks (label, subtitle, icon) VALUES (?,?,?)').run(label, subtitle||'', icon||'🔗');
  res.json({ id: r.lastInsertRowid });
});

app.delete('/api/quicklinks/:id', (req, res) => {
  db.prepare('DELETE FROM quicklinks WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── ACTIVITY LOG ──────────────────────────────────────────────────────────────
app.get('/api/activity', (req, res) => {
  const rows = db.prepare('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 50').all();
  res.json(rows);
});

// ── BULK STATE (single request to load everything on page open) ────────────
app.get('/api/state', (req, res) => {
  try {
    const profile  = db.prepare('SELECT * FROM profile WHERE id=1').get();
    const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    const tasks    = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
    const members  = db.prepare('SELECT * FROM members ORDER BY created_at DESC').all();
    const threads  = db.prepare('SELECT * FROM threads ORDER BY created_at DESC').all().map(t => ({
      ...t, msgs: db.prepare('SELECT * FROM messages WHERE thread_id=? ORDER BY sent_at ASC').all(t.id)
    }));
    const documents  = db.prepare('SELECT * FROM documents ORDER BY created_at DESC').all();
    const quicklinks = db.prepare('SELECT * FROM quicklinks ORDER BY created_at DESC').all();
    const activity   = db.prepare('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 20').all();
    res.json({ profile, projects, tasks, members, threads, documents, quicklinks, activity });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── LONG-POLL for live updates ─────────────────────────────────────────────
// Returns a lightweight "heartbeat" object with counts — clients poll every 5s
app.get('/api/heartbeat', (req, res) => {
  const since = req.query.since || '1970-01-01';
  try {
    const counts = {
      projects:  db.prepare('SELECT COUNT(*) as n FROM projects WHERE updated_at > ?').get(since).n,
      tasks:     db.prepare('SELECT COUNT(*) as n FROM tasks WHERE updated_at > ?').get(since).n,
      members:   db.prepare('SELECT COUNT(*) as n FROM members WHERE updated_at > ?').get(since).n,
      messages:  db.prepare('SELECT COUNT(*) as n FROM messages WHERE sent_at > ?').get(since).n,
      documents: db.prepare('SELECT COUNT(*) as n FROM documents WHERE updated_at > ?').get(since).n,
      ts: new Date().toISOString()
    };
    res.json(counts);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Catch-all: serve the SPA ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Nuru Communications Platform running on http://localhost:${PORT}\n`);
});
