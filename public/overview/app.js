// Public overview script: fetches live server status and updates UI
(function(){
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const root = document.querySelector('.overview-root');
  const statusEl = document.getElementById('server-status');
  if (!statusEl || !root) return;

  const host = root.getAttribute('data-server-host') || 'play.sproutmc.example';

  function badgeHtml(text, color){ return `<span style="padding:3px 8px;border-radius:8px;background:${color};font-weight:700;color:#021101">${text}</span>` }

  function renderServerRow(s){
    const st = s.status || {}
    let statusText = 'Offline'
    let color = '#ff9b9b'
    if (st.online) { statusText = 'Online'; color = '#9ff7b6' }
    else if (st.starting) { statusText = 'Starting'; color = '#ffd27a' }
    else if (st.stopping) { statusText = 'Stopping'; color = '#cccccc' }
    const players = (s.players==null) ? '—' : String(s.players)
    return `<li data-name="${s.name}" style="display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:8px;background:linear-gradient(180deg,rgba(0,0,0,0.18),rgba(0,0,0,0.06))"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-weight:700;color:#eaffea">${s.name}</div><div style="color:rgba(255,255,255,0.75);font-size:12px">Players: ${players}</div></div><div>${badgeHtml(statusText,color)}</div></div><div class="player-list" style="font-size:13px;margin-top:6px;color:rgba(255,255,255,0.8);display:none"></div></li>`
  }

  async function fetchServers(){
    try {
      const globalEl = document.getElementById('server-global-status')
      const listEl = document.getElementById('servers-list')
      if (globalEl) globalEl.textContent = 'Checking status…'
      if (listEl) listEl.innerHTML = ''

      // prefer the local overview server endpoint (same origin)
      const resp = await fetch('/api/overview/servers')
      if (!resp.ok) throw new Error('fetch_failed')
      const payload = await resp.json()
      if (!payload || !payload.ok) throw new Error('invalid_payload')
      const servers = payload.servers || []
      if (globalEl) globalEl.textContent = `${servers.length} server(s) found`;
      if (listEl) listEl.innerHTML = servers.map(renderServerRow).join('')
    } catch (e) {
      const globalEl = document.getElementById('server-global-status')
      const listEl = document.getElementById('servers-list')
      if (globalEl) globalEl.textContent = 'Unavailable'
      if (listEl) listEl.innerHTML = ''
    }
  }

  // Keep external host checker for non-managed servers
  async function fetchHostStatus(){
    try {
      const resp = await fetch(`/api/overview/status?host=${encodeURIComponent(host)}`)
      if (!resp.ok) return
      const payload = await resp.json()
      if (!payload || !payload.ok) return
      const data = payload.data || null
      const globalEl = document.getElementById('server-global-status')
      if (globalEl && data) globalEl.textContent = data.online ? 'Public server: Online' : 'Public server: Offline'
    } catch (e) {}
  }

  fetchServers()
  fetchHostStatus()

  // manual refresh button
  const refreshBtn = document.getElementById('refresh-servers')
  if (refreshBtn) refreshBtn.onclick = () => { fetchServers(); fetchHostStatus() }

  // click to toggle players list
  const listEl = document.getElementById('servers-list')
  if (listEl) {
    listEl.addEventListener('click', async (e) => {
      const li = e.target.closest('li[data-name]')
      if (!li) return
      const name = li.getAttribute('data-name')
      const pl = li.querySelector('.player-list')
      if (!pl) return
      if (pl.style.display === 'none' || !pl.textContent) {
        pl.style.display = 'block'
        pl.textContent = 'Loading players...'
        try {
          const r = await fetch(`/api/overview/players?name=${encodeURIComponent(name)}`)
          if (!r.ok) throw new Error('failed')
          const j = await r.json()
          const arr = (j.players || [])
          if (arr.length === 0) pl.textContent = 'No players online'
          else pl.textContent = arr.join(', ')
        } catch (err) { pl.textContent = 'Failed to load players' }
      } else {
        pl.style.display = 'none'
      }
    })
  }

  // WebSocket real-time updates (connects to wrapper WS at default port 3000)
  (function setupWS(){
    const host = location.hostname
    const wsPort = 3000
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
    let url = `${protocol}://${host}:${wsPort}`
    let ws = null
    let attempts = 0
    function tryConnect(){
      attempts++
      try {
        ws = new WebSocket(url)
        ws.onopen = () => {
          console.info('Overview WS connected to', url)
          attempts = 0
        }
        ws.onmessage = (e) => {
          try {
            const m = JSON.parse(e.data)
            if (!m || !m.type) return
            if (m.type === 'status') {
              const inst = (m.payload && m.payload.instance) || null
              const st = (m.payload && m.payload.status) || (m.payload && m.payload)
              if (inst) updateServerRow(inst, st)
            }
            if (m.type === 'players') {
              const inst = (m.payload && m.payload.instance) || null
              const players = (m.payload && m.payload.players) || []
              if (inst) updatePlayersFor(inst, players)
            }
            if (m.type === 'chat') {
              const inst = (m.payload && m.payload.instance) || null
              const player = (m.payload && m.payload.player) || 'Server'
              const message = (m.payload && m.payload.message) || ''
              if (inst) addChatMessage(inst, player, message)
            }
          } catch (err) { console.warn('WS message parse failed', err) }
        }
        ws.onclose = () => {
          console.info('Overview WS closed, retrying...')
          scheduleReconnect()
        }
        ws.onerror = (e) => {
          console.warn('Overview WS error', e)
          try { ws.close() } catch {}
        }
      } catch (err) {
        scheduleReconnect()
      }
    }
    function scheduleReconnect(){
      attempts = Math.min(attempts, 6)
      const delay = Math.pow(2, attempts) * 1000
      setTimeout(tryConnect, delay)
    }
    function updateServerRow(name, st){
      const li = document.querySelector(`#servers-list li[data-name="${name}"]`)
      if (!li) { fetchServers(); return }
      const badge = li.querySelector('div > div:last-child')
      // rebuild row by fetching servers to keep rendering consistent
      fetchServers()
    }
    async function updatePlayersFor(name, players){
      const li = document.querySelector(`#servers-list li[data-name="${name}"]`)
      if (!li) return
      const playersDiv = li.querySelector('.player-list')
      if (!playersDiv) return
      // If visible, update content
      if (playersDiv.style.display !== 'none'){
        if (!players || players.length === 0) playersDiv.textContent = 'No players online'
        else playersDiv.textContent = players.join(', ')
      }
      // update player count in header
      const header = li.querySelector('div > div > div:nth-child(2)')
      if (header) header.textContent = 'Players: ' + (players ? players.length : '—')
    }

    function addChatMessage(inst, player, message){
      const chatEl = document.getElementById('chat-messages')
      if (!chatEl) return
      const div = document.createElement('div')
      div.style.cssText = 'padding:4px;border-radius:4px;background:rgba(255,255,255,0.04);color:#eaffea'
      const time = new Date().toLocaleTimeString()
      div.innerHTML = `<div style="font-weight:700;color:#2bbd52">${player}</div><div style="color:rgba(255,255,255,0.8)">${message}</div><div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px">${time}</div>`
      chatEl.appendChild(div)
      // Keep only last 50 messages
      while (chatEl.children.length > 50) chatEl.removeChild(chatEl.firstChild)
      // Auto-scroll to bottom
      chatEl.scrollTop = chatEl.scrollHeight
      // Update status
      const statusEl = document.getElementById('chat-status')
      if (statusEl) statusEl.textContent = 'Live chat active'
    }

    tryConnect()
  })()

  setInterval(fetchServers, 15_000)
  setInterval(fetchHostStatus, 30_000)
})();
