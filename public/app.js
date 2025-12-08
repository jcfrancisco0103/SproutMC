let token=null
let ws=null
function el(id){return document.getElementById(id)}
const loadedTabs=new Set()
function ensureTabData(t){try{if(loadedTabs.has(t))return;loadedTabs.add(t);if(t==='dashboard'){loadStatus()}if(t==='console'){loadConsoleHistory()}if(t==='files'){loadFiles(el('pathInput').value||'.')}if(t==='plugins'){loadPlugins()}if(t==='backups'){loadBackups()}if(t==='tasks'){loadTasks()}if(t==='worlds'){loadWorlds()}if(t==='settings'){loadConfig()}}catch{}}
function showTab(t){document.querySelectorAll('.tab').forEach(x=>{x.classList.remove('active');x.classList.add('hidden')});document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));const editor=el('editor');if(editor){editor.classList.add('hidden');document.body.classList.remove('modal-open')}const s=el(t);s.classList.remove('hidden');localStorage.setItem('activeTab',t);ensureTabData(t);requestAnimationFrame(()=>{s.classList.add('active');if(t==='console'){const c=el('consoleOut');if(c)c.scrollTop=c.scrollHeight}})}
document.addEventListener('DOMContentLoaded',()=>{const qp=new URLSearchParams(location.search);activeInstance=qp.get('instance')||activeInstance;connectWS();const t=localStorage.getItem('activeTab')||'dashboard';showTab(t);updateActiveHeader();const ub=el('updatesBtn');if(ub)ub.onclick=()=>{document.body.classList.add('modal-open');const m=el('updatesModal');if(m)m.classList.remove('hidden')}})
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>showTab(b.dataset.tab))
if(el('logoutBtn')){el('logoutBtn').onclick=()=>{}}
function updateActiveHeader(){const h=el('activeInstanceHeader');if(h)h.textContent='Active: '+(activeInstance||'(none)')}
function auth(){return{}}
function urlInst(u){if(!activeInstance) return u;return u+(u.includes('?')?'&':'?')+'inst='+encodeURIComponent(activeInstance)}
function urlName(u){if(!activeInstance) return u;return u+(u.includes('?')?'&':'?')+'name='+encodeURIComponent(activeInstance)}
function apiFetch(url,opt){const o=opt||{};o.headers={...(o.headers||{}),...auth()};return fetch(url,o)}
function apiUpload(url,fd,onp,opts){return new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('POST',url);const h=auth();Object.keys(h).forEach(k=>x.setRequestHeader(k,h[k]));let last=Date.now();x.upload.onprogress=e=>{if(e.lengthComputable&&onp)onp(Math.round(e.loaded*100/e.total));last=Date.now()};let stallTimer=null;if(opts&&opts.stallMs){stallTimer=setInterval(()=>{if(Date.now()-last>opts.stallMs){try{x.abort()}catch{}}},opts.stallMs)};if(opts&&opts.timeoutMs){setTimeout(()=>{try{x.abort()}catch{}},opts.timeoutMs)};x.onload=()=>{if(stallTimer)clearInterval(stallTimer);resolve({ok:x.status>=200&&x.status<300,status:x.status,body:x.responseText})};x.onerror=()=>{if(stallTimer)clearInterval(stallTimer);reject(new TypeError('network_error'))};x.send(fd)})}
function apiUploadRaw(url,blob,onp,opts){return new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('POST',url);const h=auth();Object.keys(h).forEach(k=>x.setRequestHeader(k,h[k]));x.setRequestHeader('Content-Type','application/octet-stream');let last=Date.now();x.upload.onprogress=e=>{if(e.lengthComputable&&onp)onp(Math.round(e.loaded*100/e.total));last=Date.now()};let stallTimer=null;if(opts&&opts.stallMs){stallTimer=setInterval(()=>{if(Date.now()-last>opts.stallMs){try{x.abort()}catch{}}},opts.stallMs)};if(opts&&opts.timeoutMs){setTimeout(()=>{try{x.abort()}catch{}},opts.timeoutMs)};x.onload=()=>{if(stallTimer)clearInterval(stallTimer);resolve({ok:x.status>=200&&x.status<300,status:x.status,body:x.responseText})};x.onerror=()=>{if(stallTimer)clearInterval(stallTimer);reject(new TypeError('network_error'))};x.send(blob)})}
let activeInstance=null
function connectWS(){ws=new WebSocket(`ws://${location.host}`);ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='console'){const inst=m.payload.instance||null;if(!activeInstance||inst===activeInstance){appendConsole(m.payload.line)}}if(m.type==='status'){const inst=m.payload.instance||null;if(!inst||inst===activeInstance){updateStatus(m.payload.status||m.payload)}}if(m.type==='metrics'){const inst=m.payload.instance||null;if(!inst||inst===activeInstance){updateMetrics(m.payload.metrics||m.payload)}}if(m.type==='terminal'){appendTerminalLine(m.payload.line)}}}
function updateStatus(s){el('statusText').textContent=`${s.online?'Online':'Offline'}${s.crashed?' (crashed)':''}`;const b=el('statusBar');b.textContent=el('statusText').textContent;b.className='status-pill '+(s.crashed?'status-crashed':(s.online?'status-online':'status-offline'))}
async function loadStatus(){const r=await apiFetch(urlName('/api/status'));const j=await r.json();activeInstance=j.instance||activeInstance;updateStatus(j.status);updateMetrics(j.metrics);updateActiveHeader()}
function stripAnsi(s){return s.replace(/\x1b\[[0-9;]*m/g,'')}
function classifySeverity(sev,line){const s=(sev||'').toLowerCase();const L=line||'';if(s.includes('error')||L.includes('ERROR'))return'log-error';if(s.includes('warn')||L.includes('WARN'))return'log-warn';if(s.includes('debug'))return'log-debug';if(s.includes('info'))return'log-info';if(L.includes('WRAPPER'))return'log-system';return'log-info'}
function renderColoredLine(line,target){const clean=stripAnsi(line);const m=clean.match(/^\[(\d{2}:\d{2}:\d{2})] \[(.+?)\/(.+?)]:\s(.*)$/);const row=document.createElement('div');row.className='log-line';if(m){const ts=m[1],thread=m[2],sev=m[3],msg=m[4];row.classList.add(classifySeverity(sev,clean));const tsSpan=document.createElement('span');tsSpan.className='log-ts';tsSpan.textContent = `[${ts}]`;row.appendChild(tsSpan);const thSpan=document.createElement('span');thSpan.className='log-thread';thSpan.textContent = `[${thread}]`;row.appendChild(thSpan);const tag=document.createElement('span');const sevClass=classifySeverity(sev,clean);tag.className='log-tag'+(sevClass==='log-warn'?' warn':sevClass==='log-error'?' error':sevClass==='log-debug'?' debug':'');tag.textContent = sev.toUpperCase();row.appendChild(tag);const msgSpan=document.createElement('span');msgSpan.textContent = msg;row.appendChild(msgSpan)}else{row.classList.add(classifySeverity('',clean));const s=document.createElement('span');s.textContent = clean;row.appendChild(s)}target.appendChild(row);target.scrollTop=target.scrollHeight}
function trimConsole(target){while(target.children.length>500){target.removeChild(target.firstChild)}}
function appendConsole(line){const out=el('consoleOut');const prev=el('logsPreview');renderColoredLine(line,out);renderColoredLine(line,prev);trimConsole(out);trimConsole(prev)}
el('sendCmd').onclick=async()=>{const cmd=el('consoleIn').value;if(!cmd)return;await apiFetch('/api/console',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:cmd,name:activeInstance})});el('consoleIn').value=''}
el('consoleIn').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();el('sendCmd').click()}})
el('downloadLog').onclick=()=>{window.location='/api/logs/latest'}
el('consoleJumpLast').onclick=()=>{const c=el('consoleOut');if(c)c.scrollTop=c.scrollHeight}
el('consoleStart').onclick=()=>apiFetch('/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:activeInstance})})
el('consoleStop').onclick=()=>apiFetch('/api/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:activeInstance})})
el('consoleKill').onclick=()=>apiFetch('/api/kill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:activeInstance})})
el('startBtn').onclick=()=>apiFetch('/api/start',{method:'POST'})
el('stopBtn').onclick=()=>apiFetch('/api/stop',{method:'POST'})
el('killBtn').onclick=()=>apiFetch('/api/kill',{method:'POST'})
async function loadConsoleTail(){const r=await apiFetch(urlName('/api/console/tail'));const j=await r.json();j.lines.forEach(appendConsole)}
async function loadConsoleHistory(){const r=await apiFetch(urlName('/api/console/history?lines=500'));if(r.ok){const j=await r.json();el('consoleOut').innerHTML='';el('logsPreview').innerHTML='';j.lines.forEach(appendConsole);const c=el('consoleOut');c.scrollTop=c.scrollHeight}else{await loadConsoleTail()}}
async function loadFiles(p){
  showLoading()
  el('pathInput').value=p;
  const r=await apiFetch(urlInst('/api/fs/list?path='+encodeURIComponent(p)));
  if(!r.ok){hideLoading();return}
  const j=await r.json();
  const t=el('fileTable');
  t.innerHTML='<tr><th><input type="checkbox" id="filesSelectAllCb" /></th><th>Name</th><th>Type</th><th>Size</th><th>Actions</th></tr>';
  selectedFiles.clear()
  const entries=[...j.entries].sort((a,b)=>{
    if(a.isDir!==b.isDir) return a.isDir? -1: 1; // folders first
    return a.name.localeCompare(b.name);
  })
  entries.forEach(e=>{
    const tr=document.createElement('tr');
    const tdSel=document.createElement('td');const cb=document.createElement('input');cb.type='checkbox';cb.onchange=()=>{const target=pathJoin(p,e.name);if(cb.checked)selectedFiles.add(target);else selectedFiles.delete(target);updateFilesSelectAllState()};tdSel.appendChild(cb);
    const a=document.createElement('a');a.href='#';a.textContent=e.name;a.className=e.isDir?'link-dir':'link-file';a.onclick=()=>{if(e.isDir)navigateTo(pathJoin(p,e.name))};
    const tdN=document.createElement('td');tdN.appendChild(a);
    const tdT=document.createElement('td');tdT.textContent=e.isDir?'Folder':'File';tdT.className=e.isDir?'type-dir':'type-file';
    const tdS=document.createElement('td');tdS.textContent=e.size;
    const tdA=document.createElement('td');
  const dl=document.createElement('button');dl.className=e.isDir?'btn-dir':'btn-file';dl.textContent='Download';dl.onclick=()=>{const target=pathJoin(p,e.name);const url=e.isDir?('/api/fs/download-zip?path='+encodeURIComponent(target)):('/api/fs/download?path='+encodeURIComponent(target));window.location=urlInst(url)};tdA.appendChild(dl);
  if(!e.isDir && (e.name.toLowerCase().endsWith('.zip')||e.name.toLowerCase().endsWith('.rar'))){const uz=document.createElement('button');uz.className='btn-file';uz.textContent='Unzip';uz.onclick=async()=>{const ok=confirm('Extract this archive here?');if(!ok)return;const body={path:pathJoin(p,e.name),dest:p,inst:activeInstance};const box=el('fileUploadProgress');const bar=el('fileUploadBar');const txt=el('fileUploadText');let prog=0;let timer=null;try{if(box){box.classList.remove('hidden');bar&&bar.style.setProperty('--w','0%');if(txt)txt.textContent='Extracting...';try{box.scrollIntoView({ behavior:'smooth', block:'start' })}catch{};timer=setInterval(()=>{prog=Math.min(90,prog+1);if(bar)bar.style.setProperty('--w',prog+'%')},200)}uz.disabled=true;let r=await apiFetch('/api/fs/unzip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok){r=await apiFetch(urlInst('/api/fs/unzip?path='+encodeURIComponent(body.path)+'&dest='+encodeURIComponent(body.dest)))}if(r.ok){if(bar)bar.style.setProperty('--w','100%');if(txt)txt.textContent='100%';setTimeout(()=>{if(box)box.classList.add('hidden');loadFiles(p)},400)}else{alert('Extract failed')}}finally{if(timer)clearInterval(timer);uz.disabled=false}};tdA.appendChild(uz)}
  if(!e.isDir && isEditable(e.name)){const ed=document.createElement('button');ed.className='btn-file';ed.textContent='Edit';ed.onclick=()=>openEditor(pathJoin(p,e.name));tdA.appendChild(ed)}
  const rn=document.createElement('button');rn.className=e.isDir?'btn-dir':'btn-file';rn.textContent='Rename';rn.onclick=async()=>{const newName=prompt('New name',e.name);if(!newName||newName===e.name)return;await apiFetch('/api/fs/rename',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:pathJoin(p,e.name),to:pathJoin(p,newName),inst:activeInstance})});loadFiles(p);if(p==='plugins'||p.startsWith('plugins/'))loadPlugins()};tdA.appendChild(rn);
  const rm=document.createElement('button');rm.className=e.isDir?'btn-dir':'btn-file';rm.textContent='Delete';rm.onclick=async()=>{const target=pathJoin(p,e.name);const ok=await showConfirm(`Delete this ${e.isDir?'folder':'file'}?`);if(!ok)return;await apiFetch('/api/fs/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:target,inst:activeInstance})});loadFiles(p);if(target.startsWith('plugins/'))loadPlugins()};tdA.appendChild(rm);
    tr.appendChild(tdSel);tr.appendChild(tdN);tr.appendChild(tdT);tr.appendChild(tdS);tr.appendChild(tdA);
    t.appendChild(tr)
  })
  const filesSelAll=el('filesSelectAllCb');
  if(filesSelAll){filesSelAll.onchange=()=>{const rows=[...t.querySelectorAll('tr')].slice(1);rows.forEach(tr=>{const cb=tr.querySelector('input[type="checkbox"]');const a=tr.querySelector('td:nth-child(2) a');const name=a?a.textContent.trim():'';if(cb&&name){cb.checked=filesSelAll.checked;const target=pathJoin(p,name);if(filesSelAll.checked)selectedFiles.add(target);else selectedFiles.delete(target)}});updateFilesSelectAllState()};updateFilesSelectAllState()}
  hideLoading()
}

function updateFilesSelectAllState(){const t=el('fileTable');const selAll=el('filesSelectAllCb');if(!t||!selAll)return;const rows=[...t.querySelectorAll('tr')].slice(1);const cbs=rows.map(tr=>tr.querySelector('input[type="checkbox"]')).filter(Boolean);const total=cbs.length;const checked=cbs.filter(cb=>cb.checked).length;selAll.indeterminate=checked>0&&checked<total;selAll.checked=total>0&&checked===total}
function pathJoin(a,b){if(a==='.')return b;return a.replace(/\\$/,'')+'/'+b}
const filesHistory=[]
function navigateTo(next){filesHistory.push(el('pathInput').value);loadFiles(next)}
el('backBtn').onclick=()=>{if(!filesHistory.length)return;const prev=filesHistory.pop();loadFiles(prev)}
const origBrowse=()=>loadFiles(el('pathInput').value)
el('browseBtn').onclick=()=>{filesHistory.push(el('pathInput').value);origBrowse()}
el('selectAllFiles').onclick=()=>{const t=el('fileTable');const p=el('pathInput').value;const rows=[...t.querySelectorAll('tr')].slice(1);rows.forEach(tr=>{const cb=tr.querySelector('input[type="checkbox"]');const a=tr.querySelector('td:nth-child(2) a');const name=a?a.textContent.trim():'';if(cb&&name){cb.checked=true;selectedFiles.add(pathJoin(p,name))}})}
const editableExt=['.yml','.yaml','.json','.properties','.txt','.cfg','.ini','.md','.config','.confi','.conf','.key']
function isEditable(name){const i=name.lastIndexOf('.');if(i<0)return false;const ext=name.slice(i).toLowerCase();return editableExt.includes(ext)}
function openEditor(fullPath){el('editorPath').textContent=fullPath;document.body.classList.add('modal-open');el('editor').classList.remove('hidden');apiFetch(urlInst('/api/fs/read?path='+encodeURIComponent(fullPath))).then(r=>r.json()).then(j=>{el('editorContent').value=j.content})}
el('editorClose').onclick=()=>{document.body.classList.remove('modal-open');el('editor').classList.add('hidden')}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!el('editor').classList.contains('hidden')){el('editorClose').click()}}})
el('editor').addEventListener('click',e=>{if(e.target.id==='editor'){el('editorClose').click()}})
el('editorSave').onclick=async()=>{const p=el('editorPath').textContent;const c=el('editorContent').value;const r=await apiFetch('/api/fs/write',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p,content:c,inst:activeInstance})});if(r.ok){const cur=el('pathInput').value;document.body.classList.remove('modal-open');el('editor').classList.add('hidden');loadFiles(cur)}else{alert('Save failed')}}
el('browseBtn').onclick=()=>navigateTo(el('pathInput').value)
el('uploadBtn').onclick=async()=>{const files=el('uploadFile').files;if(!files||files.length===0)return;const p=el('pathInput').value;const box=el('fileUploadProgress');const bar=el('fileUploadBar');const txt=el('fileUploadText');box.classList.remove('hidden');bar.style.setProperty('--w','0%');txt.textContent='0%';el('uploadBtn').disabled=true;el('uploadFile').disabled=true;try{const arr=[...files];const totalSize=arr.reduce((a,f)=>a+f.size,0);const hasLarge=arr.some(f=>f.size>2*1024*1024||/\.(zip|rar|jar)$/i.test(f.name));let uploaded=0;const update=(bytes)=>{uploaded+=bytes;const pct=Math.min(100,Math.round(uploaded*100/Math.max(1,totalSize)));bar.style.setProperty('--w',pct+'%');txt.textContent=pct+'%'};let ok=false;if(!hasLarge){try{const fd=new FormData();for(const f of arr){fd.append('files',f)}fd.append('dest',p);fd.append('inst',activeInstance||'');const r=await apiUpload(urlInst('/api/fs/upload-multi'),fd,(pct)=>{bar.style.setProperty('--w',pct+'%');txt.textContent=pct+'%'},{ stallMs: 20000, timeoutMs: 10*60*1000 });ok=r.ok}catch{}}if(!ok&&!hasLarge){try{for(const f of arr){const fd1=new FormData();fd1.append('file',f);fd1.append('dest',p);fd1.append('inst',activeInstance||'');const r1=await apiUpload(urlInst('/api/fs/upload'),fd1,(pct)=>{update(Math.round(f.size*pct/100))},{ stallMs: 20000, timeoutMs: 10*60*1000 });if(!(r1&&r1.ok)) throw new Error('single_fail')}ok=true}catch{}}if(!ok){for(const f of arr){await uploadChunked(f,p,(bytes)=>update(bytes))}ok=true}el('uploadFile').value='';loadFiles(p)}catch(e){alert('Upload failed; try smaller files or upload one-by-one')}finally{el('uploadBtn').disabled=false;el('uploadFile').disabled=false;bar.style.setProperty('--w','0%');txt.textContent='';box.classList.add('hidden')}}
// Confirmation modal helpers
let __confirmResolve=null
function showConfirm(msg){el('confirmText').textContent=msg;document.body.classList.add('modal-open');el('confirm').classList.remove('hidden');return new Promise((resolve)=>{__confirmResolve=resolve})}
function hideConfirm(ok){document.body.classList.remove('modal-open');el('confirm').classList.add('hidden');const r=__confirmResolve;__confirmResolve=null;if(r)r(ok)}
if(el('confirmYes')) el('confirmYes').onclick=()=>hideConfirm(true)
if(el('confirmNo')) el('confirmNo').onclick=()=>hideConfirm(false)
async function loadPlugins(){
  showLoading()
  const r=await apiFetch(urlInst('/api/plugins'));
  const j=await r.json();
  const t=el('pluginTable');
  t.innerHTML='<tr><th><input type="checkbox" id="pluginsSelectAllCb" /></th><th>Name</th><th>Actions</th></tr>';
  selectedPlugins.clear()
  j.plugins.forEach(p=>{
    const tr=document.createElement('tr');
    const tdSel=document.createElement('td');const cb=document.createElement('input');cb.type='checkbox';cb.onchange=()=>{if(cb.checked)selectedPlugins.add(p.name);else selectedPlugins.delete(p.name);updatePluginsSelectAllState()};tdSel.appendChild(cb);
    const tdN=document.createElement('td');tdN.textContent=p.name;
    const tdA=document.createElement('td');
    const rn=document.createElement('button');rn.textContent='Rename';rn.onclick=async()=>{const newName=prompt('New name',p.name);if(!newName||newName===p.name)return;await apiFetch('/api/fs/rename',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:'plugins/'+p.name,to:'plugins/'+newName,inst:activeInstance})});loadPlugins()};tdA.appendChild(rn);
    const del=document.createElement('button');del.textContent='Delete';del.onclick=async()=>{const ok=await showConfirm('Delete this plugin?');if(!ok)return;await apiFetch('/api/plugins/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:p.name,inst:activeInstance})});loadPlugins()};tdA.appendChild(del);
    tr.appendChild(tdSel);tr.appendChild(tdN);tr.appendChild(tdA);
    t.appendChild(tr)
  })
  const pluginsSelAll=el('pluginsSelectAllCb');
  if(pluginsSelAll){pluginsSelAll.onchange=()=>{const rows=[...t.querySelectorAll('tr')].slice(1);rows.forEach(tr=>{const cb=tr.querySelector('input[type=\"checkbox\"]');const name=tr.querySelector('td:nth-child(2)')?.textContent.trim();if(cb&&name){cb.checked=pluginsSelAll.checked;if(pluginsSelAll.checked)selectedPlugins.add(name);else selectedPlugins.delete(name)}});updatePluginsSelectAllState()};updatePluginsSelectAllState()}
  hideLoading()
}
const selectedPlugins=new Set()
function updatePluginsSelectAllState(){const t=el('pluginTable');const selAll=el('pluginsSelectAllCb');if(!t||!selAll)return;const rows=[...t.querySelectorAll('tr')].slice(1);const cbs=rows.map(tr=>tr.querySelector('input[type="checkbox"]')).filter(Boolean);const total=cbs.length;const checked=cbs.filter(cb=>cb.checked).length;selAll.indeterminate=checked>0&&checked<total;selAll.checked=total>0&&checked===total}
el('pluginSelectAll').onclick=()=>{const t=el('pluginTable');const rows=[...t.querySelectorAll('tr')].slice(1);rows.forEach(tr=>{const cb=tr.querySelector('input[type="checkbox"]');const name=tr.querySelector('td:nth-child(2)')?.textContent.trim();if(cb&&name){cb.checked=true;selectedPlugins.add(name)}})}
el('pluginDeleteSelected').onclick=async()=>{if(selectedPlugins.size===0)return;const ok=await showConfirm(`Delete ${selectedPlugins.size} plugin(s)?`);if(!ok)return;for(const name of selectedPlugins){await apiFetch('/api/plugins/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})})}selectedPlugins.clear();loadPlugins()}
el('pluginUpload').onclick=async()=>{const files=el('pluginFile').files;if(!files||files.length===0)return;const box=el('pluginUploadProgress');const bar=el('pluginUploadBar');const txt=el('pluginUploadText');box.classList.remove('hidden');bar.style.setProperty('--w','0%');txt.textContent='0%';el('pluginUpload').disabled=true;el('pluginFile').disabled=true;try{const arr=[...files];const totalSize=arr.reduce((a,f)=>a+f.size,0);let uploaded=0;const update=(bytes)=>{uploaded+=bytes;const pct=Math.min(100,Math.round(uploaded*100/Math.max(1,totalSize)));bar.style.setProperty('--w',pct+'%');txt.textContent=pct+'%'};for(const f of arr){await uploadChunked(f,'plugins',update)}el('pluginFile').value='';loadPlugins()}catch(e){alert('Plugin upload failed')}finally{el('pluginUpload').disabled=false;el('pluginFile').disabled=false;bar.style.setProperty('--w','0%');txt.textContent='';box.classList.add('hidden')}}
async function loadBackups(){showLoading();try{const r=await apiFetch('/api/backups');if(!r.ok){el('backupTable').innerHTML='<tr><th>Name</th><th>Size</th><th>Actions</th></tr>';hideLoading();return}const j=await r.json();const t=el('backupTable');t.innerHTML='<tr><th>Name</th><th>Size</th><th>Actions</th></tr>';(j.backups||[]).forEach(b=>{const tr=document.createElement('tr');const tdN=document.createElement('td');tdN.textContent=b.name;const tdS=document.createElement('td');tdS.textContent=b.size;const tdA=document.createElement('td');const dl=document.createElement('button');dl.textContent='Download';dl.onclick=()=>window.location='/api/backup/download?name='+encodeURIComponent(b.name);tdA.appendChild(dl);const rs=document.createElement('button');rs.textContent='Restore';rs.onclick=async()=>{await apiFetch('/api/backup/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:b.name})});alert('Restored')};tdA.appendChild(rs);const del=document.createElement('button');del.textContent='Delete';del.onclick=async()=>{const ok=await showConfirm('Delete this backup?');if(!ok)return;await apiFetch('/api/backup/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:b.name})});loadBackups()};tdA.appendChild(del);tr.appendChild(tdN);tr.appendChild(tdS);tr.appendChild(tdA);t.appendChild(tr)});}finally{hideLoading()}}
el('backupCreate').onclick=async()=>{await apiFetch('/api/backup/create',{method:'POST'});loadBackups()}
async function loadTasks(){showLoading();const r=await apiFetch('/api/tasks');const j=await r.json();const t=el('taskTable');t.innerHTML='<tr><th>Cron</th><th>Type</th><th>Arg</th><th>Enabled</th><th>Actions</th></tr>';j.tasks.forEach(x=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${x.cron}</td><td>${x.type}</td><td>${x.command||x.message||''}</td><td>${x.enabled?'yes':'no'}</td>`;const tdA=document.createElement('td');const del=document.createElement('button');del.textContent='Delete';del.onclick=async()=>{await apiFetch('/api/tasks/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:x.id})});loadTasks()};tdA.appendChild(del);tr.appendChild(tdA);t.appendChild(tr)});hideLoading()}
el('taskCreate').onclick=async()=>{const cron=el('taskCron').value;const type=el('taskType').value;const enabled=el('taskEnabled').checked;const arg=el('taskArg').value;const t={cron,type,enabled};if(type==='command')t.command=arg;if(type==='announce')t.message=arg;await apiFetch('/api/tasks/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(t)});loadTasks()}
async function loadWorlds(){showLoading();const r=await apiFetch('/api/worlds');const j=await r.json();const t=el('worldTable');t.innerHTML='<tr><th>Name</th><th>Actions</th></tr>';j.worlds.forEach(w=>{const tr=document.createElement('tr');const tdN=document.createElement('td');tdN.textContent=w;const tdA=document.createElement('td');const dl=document.createElement('button');dl.textContent='Download';dl.onclick=async()=>{await apiFetch('/api/worlds/download',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({world:w})});loadWorlds()};tdA.appendChild(dl);const rs=document.createElement('button');rs.textContent='Reset';rs.onclick=async()=>{await apiFetch('/api/worlds/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({world:w})});loadWorlds()};tdA.appendChild(rs);tr.appendChild(tdN);tr.appendChild(tdA);t.appendChild(tr)});hideLoading()}
el('saveAll').onclick=()=>apiFetch('/api/world/save',{method:'POST'})
async function loadProps(){const c=el('propsForm');if(!c)return;const r=await apiFetch('/api/settings/server-properties');const j=await r.json();c.innerHTML='';Object.entries(j.properties||{}).forEach(([k,v])=>{const row=document.createElement('div');row.className='row';const a=document.createElement('input');a.value=k;a.disabled=true;const b=document.createElement('input');b.value=v;b.dataset.key=k;row.appendChild(a);row.appendChild(b);c.appendChild(row)})}
const commonProps=[
  ['motd','SproutMC Server'],
  ['difficulty','easy'],
  ['max-players','20'],
  ['white-list','false'],
  ['view-distance','10'],
  ['simulation-distance','10'],
  ['allow-flight','false'],
  ['online-mode','true'],
  ['enforce-secure-profile','true']
]
if(el('propsAddCommon')){
  el('propsAddCommon').onclick=()=>{const c=el('propsForm');const existing=[...c.querySelectorAll('input[disabled]')].map(i=>i.value);commonProps.forEach(([k,v])=>{if(existing.includes(k))return;const row=document.createElement('div');row.className='row';const a=document.createElement('input');a.value=k;a.disabled=true;const b=document.createElement('input');b.value=v;b.dataset.key=k;row.appendChild(a);row.appendChild(b);c.appendChild(row)})}
}
if(el('propsSave')){
  el('propsSave').onclick=async()=>{const inputs=[...el('propsForm').querySelectorAll('input[data-key]')];const props={};inputs.forEach(i=>props[i.dataset.key]=i.value);await apiFetch('/api/settings/server-properties',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({properties:props})})}
}
if(el('propsSaveRestart')){
  el('propsSaveRestart').onclick=async()=>{const inputs=[...el('propsForm').querySelectorAll('input[data-key]')];const props={};inputs.forEach(i=>props[i.dataset.key]=i.value);await apiFetch('/api/settings/server-properties',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({properties:props})});await apiFetch('/api/restart',{method:'POST'})}
}
async function loadConfig(){const r=await apiFetch('/api/settings/config');const j=await r.json();el('cfgInstanceRoot').value=j.instanceRoot||'';el('cfgJavaPath').value=j.javaPath||'';el('cfgServerJar').value=j.serverJar||'';el('cfgJvmArgs').value=(j.jvmArgs||[]).join(' ');el('cfgAutoRestart').checked=!!j.autoRestart;el('cfgMaxBackoff').value=j.autoRestartMaxBackoffSeconds||300;const te=el('cfgTerminalElevate');if(te)te.checked=!!j.terminalElevate;const af=el('cfgAikarFlags');if(af)af.checked=!!j.aikarFlags;const v=el('cfgVersion');if(v)v.value=j.version||''}
el('cfgSave').onclick=async()=>{const body={instanceRoot:el('cfgInstanceRoot').value,javaPath:el('cfgJavaPath').value,serverJar:el('cfgServerJar').value,jvmArgs:(el('cfgJvmArgs').value||'').split(/\s+/).filter(Boolean),autoRestart:el('cfgAutoRestart').checked,autoRestartMaxBackoffSeconds:parseInt(el('cfgMaxBackoff').value||'300',10),terminalElevate:el('cfgTerminalElevate').checked,aikarFlags:el('cfgAikarFlags').checked};await apiFetch('/api/settings/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}
document.addEventListener('DOMContentLoaded',loadConfig)
function formatBytes(n){if(n==null)return'';const u=['B','KB','MB','GB','TB'];let i=0;let v=n;while(v>1024&&i<u.length-1){v/=1024;i++}return v.toFixed(1)+' '+u[i]}

const chartData={cpu:[],ram:[],disk:[],tps:[]}
const chartMax=180
function pushData(k,v){const a=chartData[k];a.push(v);if(a.length>chartMax)a.shift()}
function LineChart(canvas,{color,maxY,grid}){this.c=canvas;this.ctx=canvas.getContext('2d');this.color=color;this.maxY=maxY;this.grid=grid;this.resize=()=>{const r=this.c.getBoundingClientRect();this.c.width=Math.floor(r.width);this.c.height=Math.floor(r.height)};this.draw=(points)=>{this.resize();const ctx=this.ctx;const w=this.c.width;const h=this.c.height;ctx.clearRect(0,0,w,h);if(this.grid){ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;for(let i=1;i<5;i++){const y=h*(i/5);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}}const n=points.length;if(n<2)return;const max=this.maxY||Math.max(...points,1);ctx.lineWidth=2;const grad=ctx.createLinearGradient(0,0,w,0);grad.addColorStop(0,'#2bbd52');grad.addColorStop(.5,'#4bd66a');grad.addColorStop(1,'#63e68a');ctx.strokeStyle=grad;ctx.beginPath();for(let i=0;i<n;i++){const x=(i/(n-1))*w;const y=h-(points[i]/max)*h;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke()}}
const charts={}
function initCharts(){charts.cpu=new LineChart(el('cpuChart'),{color:'#4bd66a',maxY:100,grid:true});charts.ram=new LineChart(el('ramChart'),{color:'#4bd66a',maxY:100,grid:true});charts.disk=new LineChart(el('diskChart'),{color:'#4bd66a',grid:true});charts.tps=new LineChart(el('tpsChart'),{color:'#4bd66a',maxY:20,grid:true});window.addEventListener('resize',()=>{drawCharts()})}
function drawCharts(){charts.cpu.draw(chartData.cpu);charts.ram.draw(chartData.ram);charts.disk.draw(chartData.disk);charts.tps.draw(chartData.tps)}
document.addEventListener('DOMContentLoaded',initCharts)
function updateMetrics(m){const cpuVal=(m.cpu||0);const ramBytes=(m.memory||0);const diskBytes=(m.diskUsedBytes||0);const tpsVal=m.tps==null?null:m.tps;const ramPct=m.systemMemoryTotal?Math.min(100,ramBytes/m.systemMemoryTotal*100):0;const setTxt=(id,txt)=>{const e=el(id);if(e)e.textContent=txt};setTxt('cpu',cpuVal.toFixed(1));setTxt('ram',formatBytes(ramBytes));setTxt('disk',formatBytes(diskBytes));setTxt('tps',tpsVal==null?'N/A':tpsVal);setTxt('players',(m.players&&m.players.count)||0);setTxt('cpuCur',cpuVal.toFixed(1)+'%');setTxt('ramCur',ramPct.toFixed(1)+'%');setTxt('diskCur',formatBytes(diskBytes));setTxt('tpsCur',tpsVal==null?'N/A':String(tpsVal));pushData('cpu',cpuVal);pushData('ram',ramPct);pushData('disk',diskBytes);pushData('tps',tpsVal==null?0:tpsVal);drawCharts()}
const selectedFiles=new Set()
el('deleteSelected').onclick=async()=>{if(selectedFiles.size===0)return;const ok=await showConfirm(`Delete ${selectedFiles.size} item(s)?`);if(!ok)return;let affect=false;for(const target of selectedFiles){if(target.startsWith('plugins/'))affect=true;await apiFetch('/api/fs/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:target})})}selectedFiles.clear();const p=el('pathInput').value;loadFiles(p);if(affect||p==='plugins'||p.startsWith('plugins/'))loadPlugins()}
el('downloadSelected').onclick=async()=>{if(selectedFiles.size===0)return;try{const paths=Array.from(selectedFiles);const r=await fetch('/api/fs/download-zip-multi',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paths})});if(!r.ok){alert('Download failed');return}const blob=await r.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='selected.zip';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},100)}catch(e){alert('Download failed')}}
if(el('termRun')){
  el('termRun').onclick=async()=>{
    const cmd=el('termCmd').value
    if(!cmd)return
    el('termRun').disabled=true
    const out=el('termOut'); if(out) out.innerHTML=''
    try{
      const r=await apiFetch('/api/terminal/exec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cmd})})
      if(!r.ok){alert('Terminal failed to start')}
    }catch{}
    finally{el('termRun').disabled=false}
  }
}
function appendTerminalLine(line){const out=el('termOut');if(out){renderColoredLine(line,out);trimConsole(out)}}
if(el('checkUpdates')){
  el('checkUpdates').onclick=async()=>{
    const out=el('updatesOut'); if(out) out.textContent='Checking...'
    try{const r=await apiFetch('/api/update/check');const j=await r.json();if(out) out.textContent=`Current: ${j.currentVersion}\nLatest: ${j.latestName} (${j.latestTag})\nPublished: ${j.publishedAt}\nURL: ${j.htmlUrl}`}
    catch(e){if(out) out.textContent='Failed to check updates'}
  }
}

if(el('applyUpdate')){
  el('applyUpdate').onclick=async()=>{
    const out=el('updatesOut'); if(out) out.textContent='Updating...'
    try{
      let r=await apiFetch('/api/update/apply',{method:'POST'});
      if(!r.ok){r=await apiFetch('/api/update/apply')}
      const j=await r.json();
      if(out) out.textContent=`Update completed.\n${j.output||''}`
    }catch(e){
      if(out) out.textContent='Update failed'
    }
  }
}
// also wired in DOMContentLoaded; keep for safety in case script reloads
if(el('updatesBtn')){el('updatesBtn').onclick=()=>{document.body.classList.add('modal-open');const m=el('updatesModal');if(m)m.classList.remove('hidden')}}
if(el('updatesClose')){el('updatesClose').onclick=()=>{document.body.classList.remove('modal-open');const m=el('updatesModal');if(m)m.classList.add('hidden')}}

// Updates tab handlers
if(el('checkUpdatesTab')){
  el('checkUpdatesTab').onclick=async()=>{
    const out=el('updatesOutTab'); if(out) out.textContent='Checking...'
    try{const r=await apiFetch('/api/update/check');const j=await r.json();if(out) out.textContent=`Current: ${j.currentVersion}\nLatest: ${j.latestName} (${j.latestTag})\nPublished: ${j.publishedAt}\nURL: ${j.htmlUrl}`}
    catch(e){if(out) out.textContent='Failed to check updates'}
  }
}
if(el('applyUpdateTab')){
  el('applyUpdateTab').onclick=async()=>{
    const out=el('updatesOutTab'); if(out) out.textContent='Updating...'
    try{
      let r=await apiFetch('/api/update/apply',{method:'POST'});
      if(!r.ok){r=await apiFetch('/api/update/apply')}
      const j=await r.json();
      if(out) out.textContent=`Update completed.\n${j.output||''}`
    }catch(e){
      if(out) out.textContent='Update failed'
    }
  }
}
function showLoading(){const o=el('loadingOverlay');if(o)o.classList.remove('hidden')}
function hideLoading(){const o=el('loadingOverlay');if(o)o.classList.add('hidden')}
async function loadServers(){showLoading();try{const r=await apiFetch('/api/instances');const j=await r.json();activeInstance=j.active||null;updateActiveHeader();const t=el('serverTable');t.innerHTML='<tr><th>Name</th><th>Actions</th></tr>';el('serverActive').textContent=j.active?('Active: '+j.active):'Active: (none)';(j.instances||[]).forEach(name=>{const tr=document.createElement('tr');const tdN=document.createElement('td');tdN.textContent=name;const tdA=document.createElement('td');const sel=document.createElement('button');sel.textContent='Select';sel.onclick=async()=>{await apiFetch('/api/instances/select',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});activeInstance=name;updateActiveHeader();const co=el('consoleOut'),lp=el('logsPreview');if(co)co.innerHTML='';if(lp)lp.innerHTML='';await loadStatus();await loadConsoleHistory();loadServers();loadFiles('.');loadPlugins();loadBackups();loadTasks();loadWorlds()};tdA.appendChild(sel);const st=document.createElement('button');st.textContent='Start';st.onclick=async()=>{await apiFetch('/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});if(name===activeInstance){await loadStatus()}};tdA.appendChild(st);const sp=document.createElement('button');sp.textContent='Stop';sp.onclick=async()=>{await apiFetch('/api/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});if(name===activeInstance){await loadStatus()}};tdA.appendChild(sp);const kl=document.createElement('button');kl.textContent='Kill';kl.onclick=async()=>{const ok=await showConfirm('Kill this server?');if(!ok)return;await apiFetch('/api/kill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});if(name===activeInstance){await loadStatus()}};tdA.appendChild(kl);const del=document.createElement('button');del.textContent='Delete';del.onclick=async()=>{const ok=await showConfirm('Delete this server?');if(!ok)return;await apiFetch('/api/instances/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});loadServers()};tdA.appendChild(del);tr.appendChild(tdN);tr.appendChild(tdA);t.appendChild(tr)});hideLoading()}catch{hideLoading()}}
if(el('serverCreate')) el('serverCreate').onclick=async()=>{const name=(el('serverName').value||'').trim();if(!name)return;await apiFetch('/api/instances/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});el('serverName').value='';loadServers()}
document.addEventListener('DOMContentLoaded',loadServers)
if(el('serverStartAll')) el('serverStartAll').onclick=async()=>{try{const r=await apiFetch('/api/instances');const j=await r.json();const names=j.instances||[];await Promise.all(names.map(n=>apiFetch('/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n})})));await loadStatus()}catch{}}
if(el('serverStopAll')) el('serverStopAll').onclick=async()=>{try{const r=await apiFetch('/api/instances');const j=await r.json();const names=j.instances||[];await Promise.all(names.map(n=>apiFetch('/api/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n})})));await loadStatus()}catch{}}
if(el('serverKillAll')) el('serverKillAll').onclick=async()=>{const ok=await showConfirm('Kill all servers?');if(!ok)return;try{const r=await apiFetch('/api/instances');const j=await r.json();const names=j.instances||[];await Promise.all(names.map(n=>apiFetch('/api/kill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n})})));await loadStatus()}catch{}}
async function uploadChunked(file,dest,onBytes){const start=await apiFetch('/api/fs/upload-chunk/start',{method:'POST'});const s=await start.json();let offset=0;const id=s.uploadId;const size=file.size;let chunkSize=512*1024;const minChunk=64*1024;const maxChunk=1024*1024;while(offset<size){let end=Math.min(offset+chunkSize,size);let chunk=file.slice(offset,end);let tries=0;let ok=false;while(!ok&&tries<3){try{const r=await apiUploadRaw(`/api/fs/upload-chunk/append-raw?uploadId=${encodeURIComponent(id)}&offset=${offset}`,chunk,null,{ stallMs: 30000, timeoutMs: 15*60*1000 });if(!r.ok) throw new Error('chunk_failed');const len=end-offset;if(onBytes)onBytes(len);try{const jr=JSON.parse(r.body||'{}');offset=jr.nextOffset||end}catch{offset=end}ok=true}catch(e){tries++;chunkSize=Math.max(minChunk,Math.floor(chunkSize/2));end=Math.min(offset+chunkSize,size);chunk=file.slice(offset,end);await new Promise(r=>setTimeout(r,300))}}if(!ok) throw new Error('chunk_failed')}const fin=await apiFetch('/api/fs/upload-chunk/finish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uploadId:id,dest:dest,name:file.name,inst:activeInstance})});if(!fin.ok) throw new Error('finish_failed')}
