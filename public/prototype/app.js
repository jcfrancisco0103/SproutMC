(function(){
  const app = document.getElementById('app');
  if (app) app.setAttribute('data-theme','dark');

  // -- UI elements
  const cpuVal = document.getElementById('cpuVal');
  const ramVal = document.getElementById('ramVal');
  const diskVal = document.getElementById('diskVal');
  const playersVal = document.getElementById('playersVal');
  const consoleOut = document.getElementById('consoleOut');
  const consoleFull = document.getElementById('consoleFullOut');
  const openConsole = document.getElementById('openConsole');
  const consoleModal = document.getElementById('consoleModal');
  const closeConsole = document.getElementById('closeConsole');
  const previewFilter = document.getElementById('previewFilter');
  const togglePause = document.getElementById('togglePause');
  const collapseSidebar = document.getElementById('collapseSidebar');
  const previewSearchDebounce = 150;

  // Console state
  let paused = false; // when true, new logs are buffered
  let autoscroll = true; // autoscroll when console open
  let buffer = [];
  let maxLines = 500;

  function rand(min,max){return Math.round((Math.random()*(max-min)+min)*10)/10}

  // Append a log with optional severity
  function appendLog(raw, severity='info'){
    const d = new Date().toLocaleTimeString();
    const content = `[${d}] ${raw}`;
    const el = document.createElement('div');
    el.className = 'log-line log-' + (severity||'info');
    el.textContent = content;

    // preview area (always shows a short recent tail)
    consoleOut.appendChild(el.cloneNode(true));
    while (consoleOut.children.length > 60) consoleOut.removeChild(consoleOut.firstChild);

    // full console: either buffer or append
    if (paused) {
      buffer.push({content, severity});
      if (buffer.length > maxLines) buffer.shift();
    } else {
      const fe = document.createElement('div'); fe.className = 'log-line log-' + (severity||'info'); fe.textContent = content;
      consoleFull.appendChild(fe);
      // limit
      while (consoleFull.children.length > maxLines) consoleFull.removeChild(consoleFull.firstChild);
      if (autoscroll) consoleFull.scrollTop = consoleFull.scrollHeight;
    }

    // apply preview filter if set
    if (previewFilter && previewFilter.value.trim()) applyPreviewFilter(previewFilter.value.trim());
  }

  function flushBuffer(){
    while (buffer.length) {
      const b = buffer.shift();
      const fe = document.createElement('div'); fe.className = 'log-line log-' + (b.severity||'info'); fe.textContent = b.content;
      consoleFull.appendChild(fe);
    }
    if (autoscroll) consoleFull.scrollTop = consoleFull.scrollHeight;
  }

  // filtering helpers
  function applyPreviewFilter(query){
    const q = String(query||'').toLowerCase();
    [...consoleOut.children].forEach(node=>{
      node.style.display = q? (node.textContent.toLowerCase().includes(q)?'block':'none') : '';
    })
  }

  function applyModalFilter(){
    const q = String(document.getElementById('consoleSearch').value||'').toLowerCase();
    const activeBtn = document.querySelector('.filter-btn.active');
    const sev = activeBtn? (activeBtn.dataset.sev||'all') : 'all';
    [...consoleFull.children].forEach(node=>{
      const txt = node.textContent.toLowerCase();
      const matchesQuery = !q || txt.includes(q);
      const matchesSeverity = (sev==='all') || node.classList.contains('log-'+sev);
      node.style.display = (matchesQuery && matchesSeverity) ? '' : 'none';
    })
  }

  // hook preview filter input
  if (previewFilter){
    let t=null;
    previewFilter.addEventListener('input', ()=>{ if (t) clearTimeout(t); t=setTimeout(()=>{applyPreviewFilter(previewFilter.value.trim())}, previewSearchDebounce) })
  }

  // open/close console modal
  openConsole.addEventListener('click', ()=>{ consoleModal.classList.remove('hidden'); consoleFull.focus(); flushBuffer(); });
  closeConsole.addEventListener('click', ()=>{ consoleModal.classList.add('hidden'); });

  // pause toggle
  if (togglePause){ togglePause.addEventListener('click', ()=>{ paused = !paused; togglePause.setAttribute('aria-pressed', String(paused)); togglePause.textContent = paused ? '▶' : '⏸'; if (!paused) flushBuffer(); }) }

  // autoscroll and pause controls in modal
  const toggleAutoscroll = document.getElementById('toggleAutoscroll');
  const pauseBtn = document.getElementById('pauseBtn');
  if (toggleAutoscroll){ toggleAutoscroll.addEventListener('click', ()=>{ autoscroll = !autoscroll; toggleAutoscroll.setAttribute('aria-pressed', String(autoscroll)); toggleAutoscroll.classList.toggle('active', autoscroll); }) }
  if (pauseBtn){ pauseBtn.addEventListener('click', ()=>{ paused = !paused; pauseBtn.setAttribute('aria-pressed', String(paused)); pauseBtn.textContent = paused? 'Resume' : 'Pause'; if(!paused) flushBuffer(); }) }

  // clear console
  const clearConsoleBtn = document.getElementById('clearConsole');
  if (clearConsoleBtn){ clearConsoleBtn.addEventListener('click', ()=>{ consoleFull.innerHTML=''; buffer = []; }) }

  // filter buttons
  document.querySelectorAll('.filter-btn').forEach(b=>{
    b.addEventListener('click', ()=>{ document.querySelectorAll('.filter-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); applyModalFilter(); })
  })

  // quick commands
  document.getElementById('sendQuick').addEventListener('click', ()=>{
    const cmd = document.getElementById('quickCmd').value.trim(); if(!cmd) return; appendLog('[CMD] '+cmd,'info'); document.getElementById('quickCmd').value='';
  });
  document.getElementById('cmdSend').addEventListener('click', ()=>{
    const cmd = document.getElementById('cmdInput').value.trim(); if(!cmd) return; appendLog('[CMD] '+cmd,'info'); document.getElementById('cmdInput').value='';
  });

  // sidebar collapse
  if (collapseSidebar){ collapseSidebar.addEventListener('click', ()=>{ const pressed = collapseSidebar.getAttribute('aria-pressed')==='true'; collapseSidebar.setAttribute('aria-pressed', String(!pressed)); app.classList.toggle('sidebar-collapsed'); }) }

  // keyboard shortcuts: ` toggles console, Esc closes
  document.addEventListener('keydown', (e)=>{
    if (e.key === '`'){
      e.preventDefault(); if (consoleModal.classList.contains('hidden')) { consoleModal.classList.remove('hidden'); consoleFull.focus(); flushBuffer(); } else { consoleModal.classList.add('hidden'); }
    }
    if (e.key === 'Escape'){ if (!consoleModal.classList.contains('hidden')) consoleModal.classList.add('hidden'); }
  })

  // sample metrics and logs update
  function pushMetric(){
    cpuVal.textContent = rand(3,65)+"%";
    ramVal.textContent = rand(0.5,18).toFixed(1)+" GB";
    diskVal.textContent = (rand(10,120)).toFixed(1)+" GB";
    playersVal.textContent = Math.floor(rand(0,10));
    appendLog('[SERVER] metrics updated: cpu='+cpuVal.textContent+' ram='+ramVal.textContent,'info')
  }

  appendLog('[WRAPPER] Dashboard prototype loaded','info');

  // prototype start/stop/restart simulation handlers
  const protoStart = document.getElementById('startBtn');
  const protoStop = document.getElementById('stopBtn');
  const protoRestart = document.getElementById('restartBtn');
  if (protoStart) protoStart.addEventListener('click', ()=>{ appendLog('[WRAPPER] (sim) Start requested','info') })
  if (protoStop) protoStop.addEventListener('click', ()=>{ appendLog('[WRAPPER] (sim) Stop requested','warn') })
  if (protoRestart) protoRestart.addEventListener('click', ()=>{ if (!confirm('Restart the prototype server?')) return; appendLog('[WRAPPER] (sim) Restart requested','info'); appendLog('[WRAPPER] (sim) Saving worlds before restart','info'); setTimeout(()=>{ appendLog('[WRAPPER] (sim) Stopping','info'); setTimeout(()=>{ appendLog('[WRAPPER] (sim) Starting','info') }, 1400) }, 1200) })
  setInterval(()=>{pushMetric()}, 2500);
  setInterval(()=>{appendLog('[SERVER] Player joined the game: player'+Math.floor(Math.random()*10),'info')}, 5000);
  setInterval(()=>{ if (Math.random()<0.2) appendLog('[WARN] Simulated high latency detected','warn'); if (Math.random()<0.05) appendLog('[ERROR] Simulated exception in plugin X','error') }, 4000);

  // better chart drawing with rAF
  const canvas = document.getElementById('cpuChart');
  const ctx = canvas.getContext('2d'); let points = [];
  function addPoint(){ points.push(Math.max(0, Math.min(100, Math.round((Math.sin(Date.now()/10000)*15 + Math.random()*40 + 40)*10)/10))); if(points.length>120) points.shift(); }
  function draw(){
    const w = canvas.clientWidth, h = canvas.height; canvas.width = w; canvas.height = h; ctx.clearRect(0,0,w,h);
    if(points.length<2) return; ctx.lineWidth=2; const grad = ctx.createLinearGradient(0,0,w,0); grad.addColorStop(0,'#2bbd52'); grad.addColorStop(1,'#63e68a'); ctx.strokeStyle = grad; ctx.beginPath(); for(let i=0;i<points.length;i++){const x=(i/(points.length-1))*w;const y=h-(points[i]/100)*h; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y)} ctx.stroke();
    // fill area
    ctx.lineTo(w,h); ctx.lineTo(0,h); ctx.closePath(); ctx.fillStyle = 'rgba(43,189,82,0.06)'; ctx.fill();
  }
  function frame(){ addPoint(); draw(); requestAnimationFrame(frame); }
  requestAnimationFrame(frame);
})();
