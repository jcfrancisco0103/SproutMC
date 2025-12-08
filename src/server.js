const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const fs = require('fs')
const fse = require('fs-extra')
const path = require('path')
const child_process = require('child_process')
const os = require('os')
const multer = require('multer')
const archiver = require('archiver')
const AdmZip = require('adm-zip')
const pidusage = require('pidusage')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const cron = require('node-cron')
const https = require('https')

const cfg = JSON.parse(fs.readFileSync(path.resolve('config.json'), 'utf8'))
const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.resolve('public'), { maxAge: '1h', etag: true }))

const dataDir = path.resolve('data')
const logsDir = path.resolve('logs')
const backupsDir = path.resolve('backups')
const instancesDir = path.resolve('instances')
fse.ensureDirSync(dataDir)
fse.ensureDirSync(logsDir)
fse.ensureDirSync(backupsDir)
fse.ensureDirSync(instancesDir)
fse.ensureDirSync(path.resolve(cfg.instanceRoot))
fse.ensureDirSync(path.join(dataDir, 'uploads'))

let mcProcess = null
let status = { online: false, crashed: false, starting: false, stopping: false }
let consoleBuffer = []
const procMap = new Map()
const statusMap = new Map()
const consoleMap = new Map()
let wsClients = new Set()
let backoffSeconds = 1
let lastLogKey = null
let currentLogStream = null
let metricsCache = { cpu: null, memory: null, diskUsedBytes: null, tps: null, players: { count: 0, list: [] }, systemMemoryTotal: null, systemMemoryFree: null }
let diskSizeLastTs = 0
let diskSizeComputing = false
const playersOnline = new Set()
let restartPending = false
let terminalBuffer = []

function rotateLogIfNeeded() {
  const d = new Date().toISOString().slice(0, 10)
  const inst = (typeof activeInstanceName === 'function' ? (activeInstanceName()||'root') : 'root')
  const key = `${d}-${inst}`
  if (key !== lastLogKey) {
    if (currentLogStream) currentLogStream.end()
    currentLogStream = fs.createWriteStream(path.join(logsDir, `server-${key}.log`), { flags: 'a' })
    lastLogKey = key
  }
}

function broadcast(type, payload) {
  const msg = JSON.stringify({ type, payload })
  for (const ws of wsClients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg)
  }
}

function appendConsole(line) {
  rotateLogIfNeeded()
  consoleBuffer.push(line)
  if (consoleBuffer.length > 1000) consoleBuffer.shift()
  if (currentLogStream) currentLogStream.write(line + os.EOL)
  try {
    let m = line.match(/There are.*online:?\s*(.*)/i)
    if (m) {
      const names = (m[1]||'').split(',').map(s=>s.trim()).filter(Boolean)
      playersOnline.clear()
      names.forEach(n=>{ if (n) playersOnline.add(n) })
    }
    m = line.match(/Players\s+online:?\s*(.*)/i)
    if (m) {
      const names = (m[1]||'').split(',').map(s=>s.trim()).filter(Boolean)
      playersOnline.clear()
      names.forEach(n=>{ if (n) playersOnline.add(n) })
    }
    m = line.match(/Online\s+players:?\s*(.*)/i)
    if (m) {
      const names = (m[1]||'').split(',').map(s=>s.trim()).filter(Boolean)
      playersOnline.clear()
      names.forEach(n=>{ if (n) playersOnline.add(n) })
    }
    m = line.match(/\]:\s(.+?)\sjoined the game/i)
    if (m) playersOnline.add(m[1])
    m = line.match(/\]:\s(.+?)\sleft the game/i)
    if (m) playersOnline.delete(m[1])
    m = line.match(/\]:\s(.+?)\sjoined the server/i)
    if (m) playersOnline.add(m[1])
    m = line.match(/\]:\s(.+?)\sleft the server/i)
    if (m) playersOnline.delete(m[1])
    metricsCache.players = { count: playersOnline.size, list: Array.from(playersOnline) }
    broadcast('metrics', metricsCache)
  } catch {}
  broadcast('console', { instance: activeInstanceName()||'root', line })
}

function appendTerminal(line) {
  terminalBuffer.push(line)
  if (terminalBuffer.length > 1000) terminalBuffer.shift()
  broadcast('terminal', { line })
}

function rootForInstance(name){
  try {
    if (name) {
      const dir = path.join(instancesDir, sanitizeName(name))
      if (fs.existsSync(dir)) return path.resolve(dir)
    }
  } catch {}
  return path.resolve(cfg.instanceRoot)
}
function safeResolve(p, inst) {
  const base = rootForInstance(inst)
  const abs = path.resolve(base, p || '.')
  if (!abs.startsWith(base)) throw new Error('Invalid path')
  return abs
}

async function computeFolderSize(root) {
  let total = 0
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const p = path.join(dir, e.name)
      try {
        const st = fs.statSync(p)
        if (e.isDirectory()) stack.push(p); else total += st.size
      } catch {}
    }
  }
  return total
}

function startServer() {
  if (mcProcess || status.starting) return
  status.starting = true
  status.crashed = false
  try {
    const eulaPath = path.resolve(cfg.instanceRoot, 'eula.txt')
    if (!fs.existsSync(eulaPath)) fs.writeFileSync(eulaPath, 'eula=true' + os.EOL)
  } catch {}
  function sanitizeJvmArgs(list){
    const out = []
    for (const a of (list||[])){
      if (typeof a !== 'string') continue
      const s = a.trim()
      if (!s.startsWith('-')) continue
      const parts = s.split(/(?=-[A-Za-z])/).map(x=>x.trim()).filter(Boolean)
      for (const p of parts) out.push(p)
    }
    return out
  }
  let exec = String(cfg.javaPath||'java').trim()
  let extra = []
  if (/\s-/.test(exec)) { const parts = exec.split(/\s+/); exec = parts.shift(); extra = parts }
  const aikar = cfg.aikarFlags ? ['-XX:+UseG1GC','-XX:+ParallelRefProcEnabled','-XX:MaxGCPauseMillis=200','-XX:+UnlockExperimentalVMOptions','-XX:+DisableExplicitGC','-XX:+AlwaysPreTouch','-XX:G1NewSizePercent=30','-XX:G1MaxNewSizePercent=40','-XX:G1HeapRegionSize=8M','-XX:G1ReservePercent=20','-XX:G1HeapWastePercent=5','-XX:G1MixedGCCountTarget=4','-XX:InitiatingHeapOccupancyPercent=15','-XX:SoftRefLRUPolicyMSPerMB=50','-XX:SurvivorRatio=32','-XX:+PerfDisableSharedMem','-XX:MaxTenuringThreshold=1'] : []
  const jarPath = path.resolve(cfg.serverJar)
  if (!fs.existsSync(jarPath)) { appendConsole('[WRAPPER] Server jar not found: '+jarPath); status.starting=false; broadcast('status', status); return }
  const args = [...extra, ...aikar, ...sanitizeJvmArgs(cfg.jvmArgs||[]), '-jar', jarPath, 'nogui']
  mcProcess = child_process.spawn(exec, args, { cwd: path.resolve(cfg.instanceRoot) })
  backoffSeconds = 1
  rotateLogIfNeeded()
  appendConsole('[WRAPPER] Starting server')
  mcProcess.stdout.on('data', d => {
    const s = d.toString()
    s.split(/\r?\n/).forEach(l => { if (l) appendConsole(l) })
  })
  mcProcess.stderr.on('data', d => {
    const s = d.toString()
    s.split(/\r?\n/).forEach(l => { if (l) appendConsole(l) })
  })
  mcProcess.on('spawn', () => {
    status = { online: true, crashed: false, starting: false, stopping: false }
    broadcast('status', status)
  })
  mcProcess.on('exit', (code, signal) => {
    mcProcess = null
    const crashed = !status.stopping
    status = { online: false, crashed, starting: false, stopping: false }
    appendConsole(`[WRAPPER] Server exited code=${code} signal=${signal}`)
    broadcast('status', status)
    if (restartPending) { restartPending = false; const d=3000; appendConsole(`[WRAPPER] Restarting in ${d}ms`); setTimeout(()=>{ startServer() }, d) }
    else if (crashed && cfg.autoRestart) scheduleAutoRestart()
  })
}

function stopServer() {
  if (!mcProcess || status.stopping) return
  status.stopping = true
  appendConsole('[WRAPPER] Saving worlds before stop')
  try { sendCommand('save-all') } catch {}
  setTimeout(() => { try { sendCommand('stop') } catch {} }, 1500)
  setTimeout(() => { if (mcProcess) mcProcess.kill('SIGINT') }, 30000)
}

function killServer() {
  if (!mcProcess) return
  mcProcess.kill('SIGKILL')
}

function restartServer() {
  if (!mcProcess) { startServer(); return }
  restartPending = true
  appendConsole('[WRAPPER] Saving worlds before restart')
  try { sendCommand('save-all') } catch {}
  setTimeout(() => { stopServer() }, 1500)
}

function scheduleAutoRestart() {
  const delay = Math.min(backoffSeconds, cfg.autoRestartMaxBackoffSeconds) * 1000
  appendConsole(`[WRAPPER] Auto-restart in ${Math.floor(delay/1000)}s`)
  setTimeout(() => { startServer(); backoffSeconds = Math.min(backoffSeconds * 2, cfg.autoRestartMaxBackoffSeconds) }, delay)
}

function sendCommand(cmd) {
  if (!mcProcess) return
  mcProcess.stdin.write(cmd + os.EOL)
}

async function updateMetrics() {
  try {
    const name = activeInstanceName()||null
    const p = name? procMap.get(name) : null
    if (p) {
      const pu = await pidusage(p.pid)
      metricsCache.cpu = pu.cpu
      metricsCache.memory = pu.memory
    } else {
      metricsCache.cpu = 0
      metricsCache.memory = 0
    }
    const now = Date.now()
    if (!diskSizeComputing && (now - diskSizeLastTs > 60_000 || metricsCache.diskUsedBytes == null)) {
      diskSizeComputing = true
      setImmediate(async () => {
        try {
          const size = await computeFolderSize(path.resolve(cfg.instanceRoot))
          metricsCache.diskUsedBytes = size
          diskSizeLastTs = Date.now()
        } catch {}
        finally { diskSizeComputing = false }
      })
    }
    metricsCache.systemMemoryTotal = os.totalmem()
    metricsCache.systemMemoryFree = os.freemem()
  } catch {}
  broadcast('metrics', { instance: activeInstanceName()||'root', metrics: metricsCache })
}

setInterval(updateMetrics, 10000)

function requireAuth(req, res, next) {
  req.user = { username: 'system' }
  next()
}

function audit(actor, action, details) {
  const line = JSON.stringify({ ts: Date.now(), actor, action, details }) + os.EOL
  fs.appendFileSync(path.join(dataDir, 'audit.log'), line)
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {}
  if (username !== cfg.auth.username) return res.status(401).json({ error: 'invalid' })
  if (!bcrypt.compareSync(password, cfg.auth.passwordHash)) return res.status(401).json({ error: 'invalid' })
  const token = jwt.sign({ username, role: 'admin' }, cfg.auth.jwtSecret, { expiresIn: '12h' })
  res.json({ token })
})

app.get('/api/status', requireAuth, (req, res) => {
  const name = req.query.name || activeInstanceName()
  const st = statusMap.get(name) || { online:false, crashed:false, starting:false, stopping:false }
  res.json({ status: st, metrics: metricsCache, instance: name })
})

app.get('/api/players/online', requireAuth, (req, res) => {
  try {
    res.json({ players: Array.from(playersOnline) })
  } catch { res.status(500).json({ error: 'players_failed' }) }
})

app.post('/api/start', requireAuth, (req, res) => {
  const name = req.body.name || activeInstanceName()
  startInstance(name)
  audit(req.user.username, 'start', {})
  res.json({ ok: true })
})

app.post('/api/stop', requireAuth, (req, res) => {
  const name = req.body.name || activeInstanceName()
  stopInstance(name)
  audit(req.user.username, 'stop', {})
  res.json({ ok: true })
})

app.post('/api/restart', requireAuth, (req, res) => {
  const name = req.body.name || activeInstanceName()
  stopInstance(name); setTimeout(()=>startInstance(name), 2000)
  audit(req.user.username, 'restart', {})
  res.json({ ok: true })
})

app.post('/api/kill', requireAuth, (req, res) => {
  const name = req.body.name || activeInstanceName()
  killInstance(name)
  audit(req.user.username, 'kill', {})
  res.json({ ok: true })
})

app.post('/api/console', requireAuth, (req, res) => {
  const { command, name } = req.body || {}
  if (!command) return res.status(400).json({ error: 'no_command' })
  const inst = name || activeInstanceName()
  sendCommandInstance(inst, command)
  audit(req.user.username, 'console', { command, instance: inst })
  res.json({ ok: true })
})

app.get('/api/console/tail', requireAuth, (req, res) => {
  const name = req.query.name || activeInstanceName()
  const lines = consoleMap.get(name) || []
  res.json({ lines })
})

app.get('/api/logs/latest', requireAuth, (req, res) => {
  try {
    rotateLogIfNeeded()
    if (!currentLogStream) return res.status(404).json({ error: 'no_log' })
    const p = path.join(logsDir, `server-${lastLogKey}.log`)
    res.download(p)
  } catch { res.status(404).json({ error: 'no_log' }) }
})

app.get('/api/console/history', requireAuth, (req, res) => {
  try {
    const name = req.query.name || activeInstanceName()
    let n = parseInt(String(req.query.lines || '500'), 10)
    if (!Number.isFinite(n)) n = 500
    n = Math.min(Math.max(n, 1), 2000)
    const buf = consoleMap.get(name) || []
    res.json({ lines: buf.slice(Math.max(0, buf.length - n)) })
  } catch { res.status(500).json({ error: 'history_failed' }) }
})

wss.on('connection', (ws, req) => {
  wsClients.add(ws)
  ws.send(JSON.stringify({ type: 'status', payload: { instance: activeInstanceName()||'root', status } }))
  ws.send(JSON.stringify({ type: 'metrics', payload: { instance: activeInstanceName()||'root', metrics: metricsCache } }))
  ws.on('close', () => { wsClients.delete(ws) })
})

const upload = multer({ dest: path.join(dataDir, 'uploads') })

app.get('/api/fs/list', requireAuth, (req, res) => {
  try {
    const root = safeResolve(req.query.path || '.', req.query.inst)
    const dirents = fs.readdirSync(root, { withFileTypes: true })
    const many = dirents.length > 200
    const entries = dirents.map(e => ({ name: e.name, isDir: e.isDirectory(), size: (e.isDirectory() || many) ? 0 : fs.statSync(path.join(root, e.name)).size }))
    res.json({ path: path.relative(rootForInstance(req.query.inst), root), entries })
  } catch (e) { res.status(400).json({ error: 'bad_path' }) }
})

app.get('/api/fs/download', requireAuth, (req, res) => {
  try {
    const p = safeResolve(req.query.path, req.query.inst)
    res.download(p)
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

app.get('/api/fs/download-zip', requireAuth, (req, res) => {
  try {
    const root = safeResolve(req.query.path || '.', req.query.inst)
    const st = fs.statSync(root)
    const name = path.basename(root) + '.zip'
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`)
    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.on('error', () => { try { res.status(500).end() } catch {} })
    archive.pipe(res)
    if (st.isDirectory()) archive.directory(root, path.basename(root))
    else archive.file(root, { name: path.basename(root) })
    archive.finalize()
    audit(req.user.username, 'download_zip', { path: root })
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

app.post('/api/fs/download-zip-multi', requireAuth, (req, res) => {
  try {
    const paths = Array.isArray(req.body && req.body.paths) ? req.body.paths : []
    if (!paths.length) return res.status(400).json({ error: 'no_paths' })
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', 'attachment; filename="selected.zip"')
    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.on('error', () => { try { res.status(500).end() } catch {} })
    archive.pipe(res)
    for (const rel of paths) {
      try {
        const p = safeResolve(rel, req.body.inst)
        const st = fs.statSync(p)
        const base = path.basename(p)
        if (st.isDirectory()) archive.directory(p, base)
        else archive.file(p, { name: base })
      } catch {}
    }
    archive.finalize()
    audit(req.user.username, 'download_zip_multi', { count: paths.length })
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

const editableExt = new Set(['.yml','.yaml','.json','.properties','.txt','.cfg','.ini','.md','.config','.confi','.conf'])
app.get('/api/fs/read', requireAuth, (req, res) => {
  try {
    const p = safeResolve(req.query.path, req.query.inst)
    const ext = path.extname(p).toLowerCase()
    if (!editableExt.has(ext)) return res.status(400).json({ error: 'not_editable' })
    if (ext === '.jar') return res.status(400).json({ error: 'not_editable' })
    const st = fs.statSync(p)
    if (st.size > 5 * 1024 * 1024) return res.status(413).json({ error: 'too_large' })
    const content = fs.readFileSync(p, 'utf8')
    res.json({ path: path.relative(rootForInstance(req.query.inst), p), size: st.size, content })
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

app.post('/api/fs/write', requireAuth, (req, res) => {
  try {
    const p = safeResolve(req.body.path, req.body.inst)
    const ext = path.extname(p).toLowerCase()
    if (!editableExt.has(ext)) return res.status(400).json({ error: 'not_editable' })
    if (ext === '.jar') return res.status(400).json({ error: 'not_editable' })
    const content = req.body.content || ''
    fs.writeFileSync(p, content, 'utf8')
    audit(req.user.username, 'file_edit', { path: p })
    res.json({ ok: true })
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

app.post('/api/fs/upload', requireAuth, upload.single('file'), (req, res) => {
  try {
    const dest = safeResolve(req.body.dest || '.', req.body.inst)
    fse.ensureDirSync(dest)
    if (!req.file) return res.status(400).json({ error: 'no_file' })
    const target = path.join(dest, req.file.originalname)
    fse.moveSync(req.file.path, target, { overwrite: true })
    audit(req.user.username, 'upload', { target })
    res.json({ ok: true })
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

app.post('/api/fs/upload-multi', requireAuth, upload.array('files'), (req, res) => {
  try {
    const dest = safeResolve(req.body.dest || '.', req.body.inst)
    fse.ensureDirSync(dest)
    const saved = []
    for (const f of req.files || []) {
      const target = path.join(dest, f.originalname)
      fse.moveSync(f.path, target, { overwrite: true })
      saved.push(path.basename(target))
      audit(req.user.username, 'upload', { target })
    }
    res.json({ ok: true, saved })
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

// Chunked upload (start/append/finish) to avoid proxy resets on large files
app.post('/api/fs/upload-chunk/start', requireAuth, (req, res) => {
  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    fse.ensureDirSync(path.join(dataDir, 'uploads'))
    const part = path.join(dataDir, 'uploads', id + '.part')
    fs.writeFileSync(part, '')
    res.json({ uploadId: id })
  } catch { res.status(500).json({ error: 'chunk_start_failed' }) }
})

app.post('/api/fs/upload-chunk/append', requireAuth, upload.single('chunk'), (req, res) => {
  try {
    const id = String(req.body.uploadId || '')
    if (!id) return res.status(400).json({ error: 'no_upload_id' })
    const part = path.join(dataDir, 'uploads', id + '.part')
    const cur = fs.existsSync(part) ? fs.statSync(part).size : 0
    const offset = parseInt(String(req.body.offset || '0'), 10)
    if (!req.file) return res.status(400).json({ error: 'no_chunk' })
    if (offset !== cur) return res.status(409).json({ error: 'offset_mismatch', current: cur })
    const buf = fs.readFileSync(req.file.path)
    fs.appendFileSync(part, buf)
    fse.removeSync(req.file.path)
    res.json({ ok: true, nextOffset: cur + buf.length })
  } catch { res.status(500).json({ error: 'chunk_append_failed' }) }
})

app.post('/api/fs/upload-chunk/append-raw', requireAuth, express.raw({ type: 'application/octet-stream', limit: '100mb' }), (req, res) => {
  try {
    const id = String((req.query || {}).uploadId || '')
    if (!id) return res.status(400).json({ error: 'no_upload_id' })
    const part = path.join(dataDir, 'uploads', id + '.part')
    const cur = fs.existsSync(part) ? fs.statSync(part).size : 0
    const offset = parseInt(String(((req.query || {}).offset) || '0'), 10)
    const buf = req.body
    if (!buf || !(buf instanceof Buffer)) return res.status(400).json({ error: 'no_chunk' })
    if (offset !== cur) return res.status(409).json({ error: 'offset_mismatch', current: cur })
    fs.appendFileSync(part, buf)
    res.json({ ok: true, nextOffset: cur + buf.length })
  } catch { res.status(500).json({ error: 'chunk_append_failed' }) }
})

app.post('/api/fs/upload-chunk/finish', requireAuth, (req, res) => {
  try {
    const id = String(req.body.uploadId || '')
    const name = String(req.body.name || '')
    const dest = safeResolve(req.body.dest || '.', req.body.inst)
    if (!id || !name) return res.status(400).json({ error: 'bad_request' })
    const part = path.join(dataDir, 'uploads', id + '.part')
    if (!fs.existsSync(part)) return res.status(400).json({ error: 'no_part' })
    fse.ensureDirSync(dest)
    const target = path.join(dest, name)
    fse.moveSync(part, target, { overwrite: true })
    audit(req.user.username, 'upload', { target })
    res.json({ ok: true })
  } catch { res.status(500).json({ error: 'chunk_finish_failed' }) }
})

app.post('/api/fs/mkdir', requireAuth, (req, res) => {
  try {
    const p = safeResolve(req.body.path, req.body.inst)
    fse.ensureDirSync(p)
    audit(req.user.username, 'mkdir', { path: p })
    res.json({ ok: true })
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

app.post('/api/fs/rename', requireAuth, (req, res) => {
  try {
    const from = safeResolve(req.body.from, req.body.inst)
    const to = safeResolve(req.body.to, req.body.inst)
    fse.moveSync(from, to, { overwrite: true })
    audit(req.user.username, 'rename', { from, to })
    res.json({ ok: true })
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

app.post('/api/fs/delete', requireAuth, (req, res) => {
  try {
    const p = safeResolve(req.body.path, req.body.inst)
    fse.removeSync(p)
    audit(req.user.username, 'delete', { path: p })
    res.json({ ok: true })
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

app.post('/api/fs/unzip', requireAuth, async (req, res) => {
  try {
    const src = safeResolve(req.body.path, req.body.inst)
    const dest = safeResolve(req.body.dest || '.', req.body.inst)
    if (!fs.existsSync(src)) return res.status(404).json({ error: 'not_found' })
    fse.ensureDirSync(dest)
    const lower = src.toLowerCase()
    if (lower.endsWith('.zip')) {
      const zip = new AdmZip(src)
      zip.extractAllTo(dest, true)
      audit(req.user.username, 'unzip', { src, dest })
      return res.json({ ok: true })
    }
    if (lower.endsWith('.rar')) {
      const run = (cmd, args) => new Promise((resolve, reject) => {
        try {
          const p = child_process.spawn(cmd, args, { cwd: process.cwd() })
          p.on('error', reject)
          p.on('close', code => (code === 0 ? resolve(true) : reject(new Error(`exit_${code}`))))
        } catch (e) { reject(e) }
      })
      try {
        await run('unrar', ['x', '-o+', '-y', src, dest])
      } catch (e1) {
        try { await run('7z', ['x', '-y', src, `-o${dest}`]) }
        catch (e2) { return res.status(500).json({ error: 'rar_extract_failed' }) }
      }
      audit(req.user.username, 'unrar', { src, dest })
      return res.json({ ok: true })
    }
    return res.status(400).json({ error: 'unsupported_archive' })
  } catch { res.status(400).json({ error: 'unzip_failed' }) }
})

app.get('/api/fs/unzip', requireAuth, async (req, res) => {
  try {
    const src = safeResolve(req.query.path, req.query.inst)
    const dest = safeResolve(req.query.dest || '.', req.query.inst)
    if (!fs.existsSync(src)) return res.status(404).json({ error: 'not_found' })
    fse.ensureDirSync(dest)
    const lower = src.toLowerCase()
    if (lower.endsWith('.zip')) {
      const zip = new AdmZip(src)
      zip.extractAllTo(dest, true)
      audit(req.user.username, 'unzip', { src, dest })
      return res.json({ ok: true })
    }
    if (lower.endsWith('.rar')) {
      const run = (cmd, args) => new Promise((resolve, reject) => {
        try {
          const p = child_process.spawn(cmd, args, { cwd: process.cwd() })
          p.on('error', reject)
          p.on('close', code => (code === 0 ? resolve(true) : reject(new Error(`exit_${code}`))))
        } catch (e) { reject(e) }
      })
      try {
        await run('unrar', ['x', '-o+', '-y', src, dest])
      } catch (e1) {
        try { await run('7z', ['x', '-y', src, `-o${dest}`]) }
        catch (e2) { return res.status(500).json({ error: 'rar_extract_failed' }) }
      }
      audit(req.user.username, 'unrar', { src, dest })
      return res.json({ ok: true })
    }
    return res.status(400).json({ error: 'unsupported_archive' })
  } catch { res.status(400).json({ error: 'unzip_failed' }) }
})

app.get('/api/settings/server-properties', requireAuth, (req, res) => {
  try {
    const p = safeResolve('server.properties')
    const txt = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''
    const obj = {}
    txt.split(/\r?\n/).forEach(l => { if (!l || l.startsWith('#')) return; const i = l.indexOf('='); if (i>0) obj[l.slice(0,i)] = l.slice(i+1) })
    res.json({ properties: obj })
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

app.post('/api/settings/server-properties', requireAuth, (req, res) => {
  try {
    const p = safeResolve('server.properties')
    const props = req.body.properties || {}
    const lines = Object.keys(props).map(k => `${k}=${props[k]}`)
    fs.writeFileSync(p, lines.join(os.EOL))
    audit(req.user.username, 'edit_properties', {})
    res.json({ ok: true })
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

app.get('/api/settings/config', requireAuth, (req, res) => {
  try {
    const c = JSON.parse(fs.readFileSync(path.resolve('config.json'), 'utf8'))
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'))
    const out = {
      instanceRoot: c.instanceRoot,
      javaPath: c.javaPath,
      serverJar: c.serverJar,
      jvmArgs: c.jvmArgs,
      autoRestart: c.autoRestart,
      autoRestartMaxBackoffSeconds: c.autoRestartMaxBackoffSeconds,
      terminalElevate: !!c.terminalElevate,
      version: pkg.version
    }
    res.json(out)
  } catch { res.status(500).json({ error: 'read_failed' }) }
})

app.post('/api/settings/config', requireAuth, (req, res) => {
  try {
    const c = JSON.parse(fs.readFileSync(path.resolve('config.json'), 'utf8'))
    const allowed = ['instanceRoot','javaPath','serverJar','jvmArgs','autoRestart','autoRestartMaxBackoffSeconds','terminalElevate']
    for (const k of allowed) {
      if (req.body[k] !== undefined) c[k] = req.body[k]
    }
    fs.writeFileSync(path.resolve('config.json'), JSON.stringify(c, null, 2))
    audit(req.user.username, 'edit_config', {})
    res.json({ ok: true })
  } catch { res.status(500).json({ error: 'write_failed' }) }
})

app.get('/api/update/check', requireAuth, (req, res) => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'))
    const url = 'https://api.github.com/repos/jcfrancisco0103/SproutMC/releases/latest'
    const opts = { headers: { 'User-Agent': 'SproutMC-Wrapper' } }
    https.get(url, opts, (r) => {
      let data = ''
      r.on('data', d => data += d.toString())
      r.on('end', () => {
        try {
          const j = JSON.parse(data)
          res.json({ currentVersion: pkg.version, latestTag: j.tag_name, latestName: j.name, publishedAt: j.published_at, htmlUrl: j.html_url })
        } catch { res.status(500).json({ error: 'parse_failed' }) }
      })
    }).on('error', () => res.status(500).json({ error: 'network_failed' }))
  } catch { res.status(500).json({ error: 'check_failed' }) }
})

app.post('/api/update/apply', requireAuth, (req, res) => {
  try {
    const steps = [ ['git',['fetch','--depth=1','--no-tags','--prune','origin','main']], ['git',['pull','--ff-only','origin','main']] ]
    let idx = 0
    let out = ''
    const runNext = () => {
      if (idx >= steps.length) { audit(req.user.username, 'update_apply', {}); return res.json({ ok: true, output: out }) }
      const [exe,args] = steps[idx++]
      const p = child_process.spawn(exe, args, { cwd: process.cwd() })
      p.stdout.on('data', d => { out += d.toString() })
      p.stderr.on('data', d => { out += d.toString() })
      p.on('error', () => { res.status(500).json({ error: 'update_failed', output: out }) })
      p.on('close', code => { if (code !== 0) return res.status(500).json({ error: 'update_failed', exitCode: code, output: out }); runNext() })
    }
    runNext()
  } catch { res.status(500).json({ error: 'update_failed' }) }
})

app.get('/api/update/apply', requireAuth, (req, res) => {
  try {
    const steps = [ ['git',['fetch','--depth=1','--no-tags','--prune','origin','main']], ['git',['pull','--ff-only','origin','main']] ]
    let idx = 0
    let out = ''
    const runNext = () => {
      if (idx >= steps.length) { audit(req.user.username, 'update_apply', {}); return res.json({ ok: true, output: out }) }
      const [exe,args] = steps[idx++]
      const p = child_process.spawn(exe, args, { cwd: process.cwd() })
      p.stdout.on('data', d => { out += d.toString() })
      p.stderr.on('data', d => { out += d.toString() })
      p.on('error', () => { res.status(500).json({ error: 'update_failed', output: out }) })
      p.on('close', code => { if (code !== 0) return res.status(500).json({ error: 'update_failed', exitCode: code, output: out }); runNext() })
    }
    runNext()
  } catch { res.status(500).json({ error: 'update_failed' }) }
})

app.get('/api/plugins', requireAuth, (req, res) => {
  try {
    const dir = safeResolve('plugins', req.query.inst)
    fse.ensureDirSync(dir)
    const list = fs.readdirSync(dir).filter(n => n.endsWith('.jar')).map(n => ({ name: n }))
    res.json({ plugins: list })
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

app.post('/api/plugins/upload', requireAuth, upload.single('file'), (req, res) => {
  try {
    const dir = safeResolve('plugins', req.body.inst)
    fse.ensureDirSync(dir)
    const target = path.join(dir, req.file.originalname)
    fse.moveSync(req.file.path, target, { overwrite: true })
    audit(req.user.username, 'plugin_upload', { target })
    res.json({ ok: true })
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

app.post('/api/plugins/upload-multi', requireAuth, upload.array('files'), (req, res) => {
  try {
    const dir = safeResolve('plugins', req.body.inst)
    fse.ensureDirSync(dir)
    const saved = []
    for (const f of req.files || []) {
      const target = path.join(dir, f.originalname)
      fse.moveSync(f.path, target, { overwrite: true })
      saved.push(path.basename(target))
      audit(req.user.username, 'plugin_upload', { target })
    }
    res.json({ ok: true, saved })
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

app.post('/api/plugins/delete', requireAuth, (req, res) => {
  try {
    const dir = safeResolve('plugins', req.body.inst)
    const target = path.join(dir, req.body.name)
    fse.removeSync(target)
    audit(req.user.username, 'plugin_delete', { target })
    res.json({ ok: true })
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

app.post('/api/players/kick', requireAuth, (req, res) => { sendCommand(`kick ${req.body.player} ${req.body.reason||''}`); audit(req.user.username, 'kick', req.body); res.json({ ok: true }) })
app.post('/api/players/ban', requireAuth, (req, res) => { sendCommand(`ban ${req.body.player} ${req.body.reason||''}`); audit(req.user.username, 'ban', req.body); res.json({ ok: true }) })
app.post('/api/players/pardon', requireAuth, (req, res) => { sendCommand(`pardon ${req.body.player}`); audit(req.user.username, 'pardon', req.body); res.json({ ok: true }) })
app.post('/api/players/whitelist/add', requireAuth, (req, res) => { sendCommand(`whitelist add ${req.body.player}`); audit(req.user.username, 'whitelist_add', req.body); res.json({ ok: true }) })
app.post('/api/players/whitelist/remove', requireAuth, (req, res) => { sendCommand(`whitelist remove ${req.body.player}`); audit(req.user.username, 'whitelist_remove', req.body); res.json({ ok: true }) })
app.post('/api/players/op', requireAuth, (req, res) => { sendCommand(`op ${req.body.player}`); audit(req.user.username, 'op', req.body); res.json({ ok: true }) })
app.post('/api/players/deop', requireAuth, (req, res) => { sendCommand(`deop ${req.body.player}`); audit(req.user.username, 'deop', req.body); res.json({ ok: true }) })

app.post('/api/world/save', requireAuth, (req, res) => { sendCommand('save-all'); audit(req.user.username, 'save_all', {}); res.json({ ok: true }) })

app.get('/api/worlds', requireAuth, (req, res) => {
  try {
    const root = safeResolve('.')
    const list = fs.readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory() && (/^world/.test(e.name))).map(e => e.name)
    res.json({ worlds: list })
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

app.post('/api/terminal/exec', requireAuth, (req, res) => {
  try {
    const cmd = String((req.body||{}).cmd||'').trim()
    if (!cmd) return res.status(400).json({ error: 'no_command' })
    appendTerminal(`[TERM] $ ${cmd}`)
    let proc
    if (process.platform === 'win32') {
      proc = child_process.spawn('powershell', ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command', cmd], { cwd: process.cwd() })
    } else {
      const sh = '/bin/bash'
      const elev = !!cfg.terminalElevate
      const isRoot = typeof process.getuid === 'function' ? (process.getuid() === 0) : false
      if (elev && !isRoot) {
        proc = child_process.spawn('sudo', ['-n', sh, '-lc', cmd], { cwd: process.cwd() })
      } else {
        proc = child_process.spawn(sh, ['-lc', cmd], { cwd: process.cwd() })
      }
    }
    const timer = setTimeout(() => { try { proc.kill('SIGINT') } catch {} }, 5*60*1000)
    proc.stdout.on('data', d => {
      const s = d.toString()
      s.split(/\r?\n/).forEach(l => { if (l) appendTerminal(l) })
    })
    proc.stderr.on('data', d => {
      const s = d.toString()
      s.split(/\r?\n/).forEach(l => { if (l) appendTerminal(l) })
    })
    proc.on('error', e => { clearTimeout(timer); appendTerminal(`[TERM] error: ${String(e)}`) })
    proc.on('close', code => { clearTimeout(timer); audit(req.user.username, 'terminal_exec', { cmd, code }); appendTerminal(`[TERM] exit ${code}`) })
    res.json({ ok: true })
  } catch { res.status(500).json({ error: 'exec_failed' }) }
})

app.post('/api/worlds/download', requireAuth, (req, res) => {
  try {
    const w = req.body.world
    const p = safeResolve(w)
    const out = path.join(backupsDir, `${w}-${Date.now()}.zip`)
    const output = fs.createWriteStream(out)
    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.directory(p, false)
    archive.finalize()
    archive.pipe(output)
    output.on('close', () => { res.download(out) })
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

app.post('/api/worlds/reset', requireAuth, (req, res) => {
  try {
    const w = req.body.world
    const p = safeResolve(w)
    fse.removeSync(p)
    audit(req.user.username, 'world_reset', { world: w })
    res.json({ ok: true })
  } catch { res.status(400).json({ error: 'bad_path' }) }
})

app.post('/api/backup/create', requireAuth, (req, res) => {
  try {
    const out = path.join(backupsDir, `backup-${Date.now()}.zip`)
    const output = fs.createWriteStream(out)
    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.glob('**/*', { cwd: path.resolve(cfg.instanceRoot), dot: true })
    archive.finalize()
    archive.pipe(output)
    output.on('close', () => { audit(req.user.username, 'backup_create', { file: out }); res.json({ ok: true, file: path.basename(out) }) })
  } catch { res.status(500).json({ error: 'backup_failed' }) }
})

app.get('/api/backups', requireAuth, (req, res) => {
  try {
    fse.ensureDirSync(backupsDir)
    const list = fs.readdirSync(backupsDir).filter(n => n.endsWith('.zip')).map(n => ({ name: n, size: fs.statSync(path.join(backupsDir, n)).size, ts: fs.statSync(path.join(backupsDir, n)).mtimeMs }))
    res.json({ backups: list })
  } catch { res.json({ backups: [] }) }
})

app.post('/api/backup/restore', requireAuth, (req, res) => {
  try {
    const name = req.body.name
    const p = path.join(backupsDir, name)
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'not_found' })
    const unzip = require('adm-zip')
    const z = new unzip(p)
    z.extractAllTo(path.resolve(cfg.instanceRoot), true)
    audit(req.user.username, 'backup_restore', { file: name })
    res.json({ ok: true })
  } catch { res.status(500).json({ error: 'restore_failed' }) }
})

app.get('/api/backup/download', requireAuth, (req, res) => {
  try {
    const name = req.query.name
    const p = path.join(backupsDir, name)
    res.download(p)
  } catch { res.status(404).json({ error: 'not_found' }) }
})

app.post('/api/backup/delete', requireAuth, (req, res) => {
  try {
    const name = req.body.name
    const p = path.join(backupsDir, name)
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'not_found' })
    fse.removeSync(p)
    audit(req.user.username, 'backup_delete', { file: name })
    res.json({ ok: true })
  } catch { res.status(500).json({ error: 'delete_failed' }) }
})

const tasksFile = path.join(dataDir, 'scheduled.json')
if (!fs.existsSync(tasksFile)) fs.writeFileSync(tasksFile, '[]')
let scheduled = JSON.parse(fs.readFileSync(tasksFile, 'utf8'))
let cronJobs = {}

function applyTask(t) {
  if (cronJobs[t.id]) { cronJobs[t.id].stop(); delete cronJobs[t.id] }
  if (!t.enabled) return
  const job = cron.schedule(t.cron, () => {
    if (t.type === 'restart') restartServer()
    else if (t.type === 'backup') app.handle({ method: 'POST', url: '/api/backup/create', headers: { authorization: `Bearer ${jwt.sign({ username: 'system' }, cfg.auth.jwtSecret)}` } }, { json: () => {} })
    else if (t.type === 'command') sendCommand(t.command)
    else if (t.type === 'announce') sendCommand(`say ${t.message}`)
  })
  cronJobs[t.id] = job
}

scheduled.forEach(applyTask)

app.get('/api/tasks', requireAuth, (req, res) => { res.json({ tasks: scheduled }) })
app.post('/api/tasks/create', requireAuth, (req, res) => {
  const t = req.body
  t.id = String(Date.now())
  scheduled.push(t)
  fs.writeFileSync(tasksFile, JSON.stringify(scheduled))
  applyTask(t)
  audit(req.user.username, 'task_create', t)
  res.json({ ok: true })
})
app.post('/api/tasks/update', requireAuth, (req, res) => {
  const t = req.body
  const i = scheduled.findIndex(x => x.id === t.id)
  if (i === -1) return res.status(404).json({ error: 'not_found' })
  scheduled[i] = t
  fs.writeFileSync(tasksFile, JSON.stringify(scheduled))
  applyTask(t)
  audit(req.user.username, 'task_update', t)
  res.json({ ok: true })
})
app.post('/api/tasks/delete', requireAuth, (req, res) => {
  const id = req.body.id
  const i = scheduled.findIndex(x => x.id === id)
  if (i === -1) return res.status(404).json({ error: 'not_found' })
  if (cronJobs[id]) { cronJobs[id].stop(); delete cronJobs[id] }
  const t = scheduled.splice(i,1)[0]
  fs.writeFileSync(tasksFile, JSON.stringify(scheduled))
  audit(req.user.username, 'task_delete', t)
  res.json({ ok: true })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Wrapper listening on http://localhost:${PORT}`)
})
function findItemsAdderZip() {
  try {
    const base = safeResolve('plugins/ItemsAdder')
    if (!fs.existsSync(base)) return null
    const prefer = ['ItemsAdder.zip','resource_pack.zip']
    const stack = [base]
    let fallback = null
    while (stack.length) {
      const dir = stack.pop()
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const e of entries) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) stack.push(p)
        else if (/\.zip$/i.test(e.name)) {
          if (prefer.includes(e.name)) return p
          if (!fallback) fallback = p
        }
      }
    }
    return fallback
  } catch { return null }
}

app.get('/rp', (req, res) => {
  try {
    const p = findItemsAdderZip()
    if (!p) return res.status(404).json({ error: 'not_found' })
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('Content-Type', 'application/zip')
    res.download(p, path.basename(p))
  } catch { res.status(500).json({ error: 'serve_failed' }) }
})

function findItemsAdderZipByName(name) {
  try {
    const base = safeResolve('plugins/ItemsAdder')
    if (!fs.existsSync(base)) return null
    const target = name.toLowerCase()
    const stack = [base]
    while (stack.length) {
      const dir = stack.pop()
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const e of entries) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) stack.push(p)
        else if (/\.zip$/i.test(e.name) && e.name.toLowerCase() === target) return p
      }
    }
    return null
  } catch { return null }
}

app.get('/rp/:name', (req, res) => {
  try {
    const p = findItemsAdderZipByName(req.params.name||'')
    if (!p) return res.status(404).json({ error: 'not_found' })
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('Content-Type', 'application/zip')
    res.download(p, path.basename(p))
  } catch { res.status(500).json({ error: 'serve_failed' }) }
})

app.get('/generated.zip', (req, res) => {
  try {
    const p = findItemsAdderZipByName('generated.zip') || findItemsAdderZip()
    if (!p) return res.status(404).json({ error: 'not_found' })
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('Content-Type', 'application/zip')
    res.download(p, 'generated.zip')
  } catch { res.status(500).json({ error: 'serve_failed' }) }
})
function sanitizeName(name){return String(name||'').replace(/[^A-Za-z0-9._-]/g,'').slice(0,64)}
function listInstances(){try{const ents=fs.readdirSync(instancesDir,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);return ents}catch{return[]}}
function activeInstanceName(){try{const ar=path.resolve(cfg.instanceRoot);const rel=path.relative(instancesDir,ar);if(rel&& !rel.startsWith('..')){const top=rel.split(path.sep)[0];return top||null}return null}catch{return null}}

app.get('/api/instances', requireAuth, (req,res)=>{
  try {
    const list=listInstances()
    const active=activeInstanceName()
    res.json({ instances:list, active })
  } catch { res.status(500).json({ error:'list_failed' }) }
})

app.post('/api/instances/create', requireAuth, (req,res)=>{
  try {
    const name=sanitizeName(req.body.name)
    if(!name) return res.status(400).json({ error:'bad_name' })
    const dir=path.join(instancesDir,name)
    if(fs.existsSync(dir)) return res.status(400).json({ error:'exists' })
    fse.ensureDirSync(dir)
    fse.ensureDirSync(path.join(dir,'plugins'))
    fs.writeFileSync(path.join(dir,'server.properties'),'motd=New SproutMC Server'+os.EOL)
    audit(req.user.username,'instance_create',{ name })
    res.json({ ok:true })
  } catch { res.status(500).json({ error:'create_failed' }) }
})

app.post('/api/instances/select', requireAuth, (req,res)=>{
  try {
    const name=sanitizeName(req.body.name)
    const dir=path.join(instancesDir,name)
    if(!fs.existsSync(dir)) return res.status(404).json({ error:'not_found' })
    const c=JSON.parse(fs.readFileSync(path.resolve('config.json'),'utf8'))
    c.instanceRoot=dir
    c.serverJar=path.join(dir,'server.jar')
    fs.writeFileSync(path.resolve('config.json'), JSON.stringify(c, null, 2))
    cfg.instanceRoot=dir
    cfg.serverJar=c.serverJar
    fse.ensureDirSync(path.resolve(cfg.instanceRoot))
    appendConsole(`[WRAPPER] Switched active server to '${name}'`)
    audit(req.user.username,'instance_select',{ name })
    res.json({ ok:true })
  } catch { res.status(500).json({ error:'select_failed' }) }
})

app.post('/api/instances/delete', requireAuth, (req,res)=>{
  try {
    const name=sanitizeName(req.body.name)
    const dir=path.join(instancesDir,name)
    const ar=activeInstanceName()
    if(ar===name) return res.status(400).json({ error:'cannot_delete_active' })
    if(!fs.existsSync(dir)) return res.status(404).json({ error:'not_found' })
    fse.removeSync(dir)
    audit(req.user.username,'instance_delete',{ name })
    res.json({ ok:true })
  } catch { res.status(500).json({ error:'delete_failed' }) }
})
function appendConsoleFor(name, line){
  try {
    const buf = consoleMap.get(name) || []
    buf.push(line)
    while (buf.length>1000) buf.shift()
    consoleMap.set(name, buf)
    broadcast('console', { instance: name, line })
  } catch {}
}

function startInstance(name){
  if (!name) return
  if (procMap.get(name)) return
  const dir = path.join(instancesDir, name)
  const jar = path.join(dir, 'server.jar')
  try {
    const eulaPath = path.join(dir, 'eula.txt')
    if (!fs.existsSync(eulaPath)) fs.writeFileSync(eulaPath, 'eula=true' + os.EOL)
  } catch {}
  let exec = String(cfg.javaPath||'java').trim()
  let extra = []
  if (/\s-/.test(exec)) { const parts = exec.split(/\s+/); exec = parts.shift(); extra = parts }
  function sanitizeJvmArgs(list){const out=[];for(const a of (list||[])){if(typeof a!=='string')continue;const s=a.trim();if(!s.startsWith('-'))continue;const parts=s.split(/(?=-[A-Za-z])/).map(x=>x.trim()).filter(Boolean);for(const p of parts)out.push(p)}return out}
  const aikar = cfg.aikarFlags ? ['-XX:+UseG1GC','-XX:+ParallelRefProcEnabled','-XX:MaxGCPauseMillis=200','-XX:+UnlockExperimentalVMOptions','-XX:+DisableExplicitGC','-XX:+AlwaysPreTouch','-XX:G1NewSizePercent=30','-XX:G1MaxNewSizePercent=40','-XX:G1HeapRegionSize=8M','-XX:G1ReservePercent=20','-XX:G1HeapWastePercent=5','-XX:G1MixedGCCountTarget=4','-XX:InitiatingHeapOccupancyPercent=15','-XX:SoftRefLRUPolicyMSPerMB=50','-XX:SurvivorRatio=32','-XX:+PerfDisableSharedMem','-XX:MaxTenuringThreshold=1'] : []
  if (!fs.existsSync(jar)) { appendConsoleFor(name,'[WRAPPER] Server jar not found: '+jar); return }
  const args = [...extra, ...aikar, ...sanitizeJvmArgs(cfg.jvmArgs||[]), '-jar', jar, 'nogui']
  const p = child_process.spawn(exec, args, { cwd: dir })
  procMap.set(name, p)
  statusMap.set(name, { online: false, crashed: false, starting: true, stopping: false })
  appendConsoleFor(name,'[WRAPPER] Starting server')
  p.stdout.on('data', d=>{d.toString().split(/\r?\n/).forEach(l=>{if(l)appendConsoleFor(name,l)})})
  p.stderr.on('data', d=>{d.toString().split(/\r?\n/).forEach(l=>{if(l)appendConsoleFor(name,l)})})
  p.on('spawn', ()=>{statusMap.set(name,{ online:true, crashed:false, starting:false, stopping:false});broadcast('status',{ instance:name, status:statusMap.get(name) })})
  p.on('exit',(code,signal)=>{procMap.delete(name);const st=statusMap.get(name)||{online:false,stopping:false};const crashed=!st.stopping;statusMap.set(name,{ online:false, crashed, starting:false, stopping:false});appendConsoleFor(name,`[WRAPPER] Server exited code=${code} signal=${signal}`);broadcast('status',{ instance:name, status:statusMap.get(name) })})
}

function stopInstance(name){const p=procMap.get(name);if(!p)return;const st=statusMap.get(name)||{stopping:false};if(st.stopping)return;statusMap.set(name,{...st,stopping:true});appendConsoleFor(name,'[WRAPPER] Saving worlds before stop');try{p.stdin.write('save-all'+os.EOL)}catch{}setTimeout(()=>{try{p.stdin.write('stop'+os.EOL)}catch{}},1500);setTimeout(()=>{if(procMap.get(name)) try{p.kill('SIGINT')}catch{}},30000)}
function killInstance(name){const p=procMap.get(name);if(!p)return;try{p.kill('SIGKILL')}catch{}}
function sendCommandInstance(name,cmd){const p=procMap.get(name);if(!p)return;p.stdin.write(cmd+os.EOL)}
