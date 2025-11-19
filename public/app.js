let token=null
let ws=null
function el(id){return document.getElementById(id)}
function showTab(t){document.querySelectorAll('.tab').forEach(x=>{x.classList.remove('active');x.classList.add('hidden')});document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));const editor=el('editor');if(editor){editor.classList.add('hidden');document.body.classList.remove('modal-open')}const s=el(t);s.classList.remove('hidden');requestAnimationFrame(()=>{s.classList.add('active');if(t==='console'){const c=el('consoleOut');if(c)c.scrollTop=c.scrollHeight}})}
document.addEventListener('DOMContentLoaded',()=>{token=localStorage.getItem('token');if(!token){location.href='/login.html';return}connectWS();loadStatus();loadConsoleHistory();loadFiles('.');loadPlugins();loadBackups();loadTasks();loadWorlds();showTab('dashboard')})
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>showTab(b.dataset.tab))
el('logoutBtn').onclick=()=>{localStorage.removeItem('token');location.href='/login.html'}
el('themeToggle').onclick=()=>{const cur=document.body.getAttribute('data-theme')||'dark';const next=cur==='light'?'dark':'light';document.body.setAttribute('data-theme',next);localStorage.setItem('theme',next)}
document.addEventListener('DOMContentLoaded',()=>{const t=localStorage.getItem('theme')||'dark';document.body.setAttribute('data-theme',t)})
function auth(){return{Authorization:`Bearer ${token}`}}
function apiFetch(url,opt){const o=opt||{};o.headers={...(o.headers||{}),...auth()};return fetch(url,o).then(r=>{if(r.status===401){localStorage.removeItem('token');location.href='/login.html'};return r})}
function apiUpload(url,fd,onp){return new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('POST',url);const h=auth();Object.keys(h).forEach(k=>x.setRequestHeader(k,h[k]));x.upload.onprogress=e=>{if(e.lengthComputable&&onp)onp(Math.round(e.loaded*100/e.total))};x.onload=()=>resolve({ok:x.status>=200&&x.status<300,status:x.status,body:x.responseText});x.onerror=()=>reject(new TypeError('network_error'));x.send(fd)})}
function connectWS(){ws=new WebSocket(`ws://${location.host}`);ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='console'){appendConsole(m.payload.line)}if(m.type==='status'){updateStatus(m.payload)}if(m.type==='metrics'){updateMetrics(m.payload)}}}
function updateStatus(s){el('statusText').textContent=`${s.online?'Online':'Offline'}${s.crashed?' (crashed)':''}`;el('statusBar').textContent=el('statusText').textContent}
async function loadStatus(){const r=await apiFetch('/api/status');const j=await r.json();updateStatus(j.status);updateMetrics(j.metrics)}
function stripAnsi(s){return s.replace(/\x1b\[[0-9;]*m/g,'')}
function classifySeverity(sev,line){const s=(sev||'').toLowerCase();const L=line||'';if(s.includes('error')||L.includes('ERROR'))return'log-error';if(s.includes('warn')||L.includes('WARN'))return'log-warn';if(s.includes('debug'))return'log-debug';if(s.includes('info'))return'log-info';if(L.includes('WRAPPER'))return'log-system';return'log-info'}
function renderColoredLine(line,target){const clean=stripAnsi(line);const m=clean.match(/^\[(\d{2}:\d{2}:\d{2})] \[(.+?)\/(.+?)]:\s(.*)$/);const row=document.createElement('div');row.className='log-line';if(m){const ts=m[1],thread=m[2],sev=m[3],msg=m[4];row.classList.add(classifySeverity(sev,clean));const tsSpan=document.createElement('span');tsSpan.className='log-ts';tsSpan.textContent = `[${ts}]`;row.appendChild(tsSpan);const thSpan=document.createElement('span');thSpan.className='log-thread';thSpan.textContent = `[${thread}]`;row.appendChild(thSpan);const tag=document.createElement('span');const sevClass=classifySeverity(sev,clean);tag.className='log-tag'+(sevClass==='log-warn'?' warn':sevClass==='log-error'?' error':sevClass==='log-debug'?' debug':'');tag.textContent = sev.toUpperCase();row.appendChild(tag);const msgSpan=document.createElement('span');msgSpan.textContent = msg;row.appendChild(msgSpan)}else{row.classList.add(classifySeverity('',clean));const s=document.createElement('span');s.textContent = clean;row.appendChild(s)}target.appendChild(row);target.scrollTop=target.scrollHeight}
function trimConsole(target){while(target.children.length>500){target.removeChild(target.firstChild)}}
function appendConsole(line){const out=el('consoleOut');const prev=el('logsPreview');renderColoredLine(line,out);renderColoredLine(line,prev);trimConsole(out);trimConsole(prev)}
el('sendCmd').onclick=async()=>{const cmd=el('consoleIn').value;if(!cmd)return;await apiFetch('/api/console',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:cmd})});el('consoleIn').value=''}
el('consoleIn').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();el('sendCmd').click()}})
el('downloadLog').onclick=()=>{window.location='/api/logs/latest'}
el('consoleJumpLast').onclick=()=>{const c=el('consoleOut');if(c)c.scrollTop=c.scrollHeight}
el('consoleStart').onclick=()=>apiFetch('/api/start',{method:'POST'})
el('consoleStop').onclick=()=>apiFetch('/api/stop',{method:'POST'})
el('consoleRestart').onclick=()=>apiFetch('/api/restart',{method:'POST'})
el('consoleKill').onclick=()=>apiFetch('/api/kill',{method:'POST'})
el('startBtn').onclick=()=>apiFetch('/api/start',{method:'POST'})
el('stopBtn').onclick=()=>apiFetch('/api/stop',{method:'POST'})
el('restartBtn').onclick=()=>apiFetch('/api/restart',{method:'POST'})
el('killBtn').onclick=()=>apiFetch('/api/kill',{method:'POST'})
async function loadConsoleTail(){const r=await apiFetch('/api/console/tail');const j=await r.json();j.lines.forEach(appendConsole)}
async function loadConsoleHistory(){const r=await apiFetch('/api/console/history?lines=500');if(r.ok){const j=await r.json();el('consoleOut').innerHTML='';el('logsPreview').innerHTML='';j.lines.forEach(appendConsole);const c=el('consoleOut');c.scrollTop=c.scrollHeight} else {await loadConsoleTail()}}
async function loadFiles(p){
  el('pathInput').value=p;
  const r=await apiFetch('/api/fs/list?path='+encodeURIComponent(p));
  if(!r.ok)return;
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
    const dl=document.createElement('button');dl.className=e.isDir?'btn-dir':'btn-file';dl.textContent='Download';dl.onclick=()=>window.location='/api/fs/download?path='+encodeURIComponent(pathJoin(p,e.name));tdA.appendChild(dl);
    if(!e.isDir && isEditable(e.name)){const ed=document.createElement('button');ed.className='btn-file';ed.textContent='Edit';ed.onclick=()=>openEditor(pathJoin(p,e.name));tdA.appendChild(ed)}
    const rn=document.createElement('button');rn.className=e.isDir?'btn-dir':'btn-file';rn.textContent='Rename';rn.onclick=async()=>{const newName=prompt('New name',e.name);if(!newName||newName===e.name)return;await apiFetch('/api/fs/rename',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:pathJoin(p,e.name),to:pathJoin(p,newName)})});loadFiles(p);if(p==='plugins'||p.startsWith('plugins/'))loadPlugins()};tdA.appendChild(rn);
    const rm=document.createElement('button');rm.className=e.isDir?'btn-dir':'btn-file';rm.textContent='Delete';rm.onclick=async()=>{const target=pathJoin(p,e.name);const ok=confirm(`Are you sure you want to delete this ${e.isDir?'folder':'file'}?`);if(!ok)return;await apiFetch('/api/fs/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:target})});loadFiles(p);if(target.startsWith('plugins/'))loadPlugins()};tdA.appendChild(rm);
    tr.appendChild(tdSel);tr.appendChild(tdN);tr.appendChild(tdT);tr.appendChild(tdS);tr.appendChild(tdA);
    t.appendChild(tr)
  })
  const filesSelAll=el('filesSelectAllCb');
  if(filesSelAll){filesSelAll.onchange=()=>{const rows=[...t.querySelectorAll('tr')].slice(1);rows.forEach(tr=>{const cb=tr.querySelector('input[type="checkbox"]');const a=tr.querySelector('td:nth-child(2) a');const name=a?a.textContent.trim():'';if(cb&&name){cb.checked=filesSelAll.checked;const target=pathJoin(p,name);if(filesSelAll.checked)selectedFiles.add(target);else selectedFiles.delete(target)}});updateFilesSelectAllState()};updateFilesSelectAllState()}
}

function updateFilesSelectAllState(){const t=el('fileTable');const selAll=el('filesSelectAllCb');if(!t||!selAll)return;const rows=[...t.querySelectorAll('tr')].slice(1);const cbs=rows.map(tr=>tr.querySelector('input[type="checkbox"]')).filter(Boolean);const total=cbs.length;const checked=cbs.filter(cb=>cb.checked).length;selAll.indeterminate=checked>0&&checked<total;selAll.checked=total>0&&checked===total}
function pathJoin(a,b){if(a==='.')return b;return a.replace(/\\$/,'')+'/'+b}
const filesHistory=[]
function navigateTo(next){filesHistory.push(el('pathInput').value);loadFiles(next)}
el('backBtn').onclick=()=>{if(!filesHistory.length)return;const prev=filesHistory.pop();loadFiles(prev)}
const origBrowse=()=>loadFiles(el('pathInput').value)
el('browseBtn').onclick=()=>{filesHistory.push(el('pathInput').value);origBrowse()}
el('selectAllFiles').onclick=()=>{const t=el('fileTable');const p=el('pathInput').value;const rows=[...t.querySelectorAll('tr')].slice(1);rows.forEach(tr=>{const cb=tr.querySelector('input[type="checkbox"]');const a=tr.querySelector('td:nth-child(2) a');const name=a?a.textContent.trim():'';if(cb&&name){cb.checked=true;selectedFiles.add(pathJoin(p,name))}})}
const editableExt=['.yml','.yaml','.json','.properties','.txt','.cfg','.ini','.md','.config','.confi','.conf']
function isEditable(name){const i=name.lastIndexOf('.');if(i<0)return false;const ext=name.slice(i).toLowerCase();return editableExt.includes(ext)}
function openEditor(fullPath){el('editorPath').textContent=fullPath;document.body.classList.add('modal-open');el('editor').classList.remove('hidden');apiFetch('/api/fs/read?path='+encodeURIComponent(fullPath)).then(r=>r.json()).then(j=>{el('editorContent').value=j.content})}
el('editorClose').onclick=()=>{document.body.classList.remove('modal-open');el('editor').classList.add('hidden')}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!el('editor').classList.contains('hidden')){el('editorClose').click()}}})
el('editor').addEventListener('click',e=>{if(e.target.id==='editor'){el('editorClose').click()}})
el('editorSave').onclick=async()=>{const p=el('editorPath').textContent;const c=el('editorContent').value;await apiFetch('/api/fs/write',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p,content:c})});alert('Saved')}
el('browseBtn').onclick=()=>navigateTo(el('pathInput').value)
el('uploadBtn').onclick=async()=>{const files=el('uploadFile').files;if(!files||files.length===0)return;const p=el('pathInput').value;const fd=new FormData();for(const f of files){fd.append('files',f)}fd.append('dest',p);const box=el('fileUploadProgress');const bar=el('fileUploadBar');const txt=el('fileUploadText');box.classList.remove('hidden');bar.style.setProperty('--w','0%');txt.textContent='0%';el('uploadBtn').disabled=true;el('uploadFile').disabled=true;try{const r=await apiUpload('/api/fs/upload-multi',fd,(pct)=>{bar.style.setProperty('--w',pct+'%');txt.textContent=pct+'%'});el('uploadFile').value='';loadFiles(p)}catch(e){}finally{el('uploadBtn').disabled=false;el('uploadFile').disabled=false;bar.style.setProperty('--w','0%');txt.textContent='';box.classList.add('hidden')}}
async function loadPlugins(){
  const r=await apiFetch('/api/plugins');
  const j=await r.json();
  const t=el('pluginTable');
  t.innerHTML='<tr><th><input type="checkbox" id="pluginsSelectAllCb" /></th><th>Name</th><th>Actions</th></tr>';
  selectedPlugins.clear()
  j.plugins.forEach(p=>{
    const tr=document.createElement('tr');
    const tdSel=document.createElement('td');const cb=document.createElement('input');cb.type='checkbox';cb.onchange=()=>{if(cb.checked)selectedPlugins.add(p.name);else selectedPlugins.delete(p.name);updatePluginsSelectAllState()};tdSel.appendChild(cb);
    const tdN=document.createElement('td');tdN.textContent=p.name;
    const tdA=document.createElement('td');
    const rn=document.createElement('button');rn.textContent='Rename';rn.onclick=async()=>{const newName=prompt('New name',p.name);if(!newName||newName===p.name)return;await apiFetch('/api/fs/rename',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:'plugins/'+p.name,to:'plugins/'+newName})});loadPlugins()};tdA.appendChild(rn);
    const del=document.createElement('button');del.textContent='Delete';del.onclick=async()=>{const ok=confirm('Are you sure you want to delete this file?');if(!ok)return;await apiFetch('/api/plugins/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:p.name})});loadPlugins()};tdA.appendChild(del);
    tr.appendChild(tdSel);tr.appendChild(tdN);tr.appendChild(tdA);
    t.appendChild(tr)
  })
  const pluginsSelAll=el('pluginsSelectAllCb');
  if(pluginsSelAll){pluginsSelAll.onchange=()=>{const rows=[...t.querySelectorAll('tr')].slice(1);rows.forEach(tr=>{const cb=tr.querySelector('input[type=\"checkbox\"]');const name=tr.querySelector('td:nth-child(2)')?.textContent.trim();if(cb&&name){cb.checked=pluginsSelAll.checked;if(pluginsSelAll.checked)selectedPlugins.add(name);else selectedPlugins.delete(name)}});updatePluginsSelectAllState()};updatePluginsSelectAllState()}
}
const selectedPlugins=new Set()
function updatePluginsSelectAllState(){const t=el('pluginTable');const selAll=el('pluginsSelectAllCb');if(!t||!selAll)return;const rows=[...t.querySelectorAll('tr')].slice(1);const cbs=rows.map(tr=>tr.querySelector('input[type="checkbox"]')).filter(Boolean);const total=cbs.length;const checked=cbs.filter(cb=>cb.checked).length;selAll.indeterminate=checked>0&&checked<total;selAll.checked=total>0&&checked===total}
el('pluginSelectAll').onclick=()=>{const t=el('pluginTable');const rows=[...t.querySelectorAll('tr')].slice(1);rows.forEach(tr=>{const cb=tr.querySelector('input[type="checkbox"]');const name=tr.querySelector('td:nth-child(2)')?.textContent.trim();if(cb&&name){cb.checked=true;selectedPlugins.add(name)}})}
el('pluginDeleteSelected').onclick=async()=>{if(selectedPlugins.size===0)return;const ok=confirm(`Are you sure you want to delete ${selectedPlugins.size} plugin(s)?`);if(!ok)return;for(const name of selectedPlugins){await apiFetch('/api/plugins/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})})}selectedPlugins.clear();loadPlugins()}
el('pluginUpload').onclick=async()=>{const files=el('pluginFile').files;if(!files||files.length===0)return;const fd=new FormData();for(const f of files){fd.append('files',f)}const box=el('pluginUploadProgress');const bar=el('pluginUploadBar');const txt=el('pluginUploadText');box.classList.remove('hidden');bar.style.setProperty('--w','0%');txt.textContent='0%';el('pluginUpload').disabled=true;el('pluginFile').disabled=true;try{const r=await apiUpload('/api/plugins/upload-multi',fd,(pct)=>{bar.style.setProperty('--w',pct+'%');txt.textContent=pct+'%'});el('pluginFile').value='';loadPlugins()}catch(e){}finally{el('pluginUpload').disabled=false;el('pluginFile').disabled=false;bar.style.setProperty('--w','0%');txt.textContent='';box.classList.add('hidden')}}
async function loadBackups(){const r=await apiFetch('/api/backups');const j=await r.json();const t=el('backupTable');t.innerHTML='<tr><th>Name</th><th>Size</th><th>Actions</th></tr>';j.backups.forEach(b=>{const tr=document.createElement('tr');const tdN=document.createElement('td');tdN.textContent=b.name;const tdS=document.createElement('td');tdS.textContent=b.size;const tdA=document.createElement('td');const dl=document.createElement('button');dl.textContent='Download';dl.onclick=()=>window.location='/api/backup/download?name='+encodeURIComponent(b.name);tdA.appendChild(dl);const rs=document.createElement('button');rs.textContent='Restore';rs.onclick=async()=>{await apiFetch('/api/backup/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:b.name})});alert('Restored')};tdA.appendChild(rs);const del=document.createElement('button');del.textContent='Delete';del.onclick=async()=>{const ok=confirm('Are you sure you want to delete this backup?');if(!ok)return;await apiFetch('/api/backup/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:b.name})});loadBackups()};tdA.appendChild(del);tr.appendChild(tdN);tr.appendChild(tdS);tr.appendChild(tdA);t.appendChild(tr)})}
el('backupCreate').onclick=async()=>{await apiFetch('/api/backup/create',{method:'POST'});loadBackups()}
async function loadTasks(){const r=await apiFetch('/api/tasks');const j=await r.json();const t=el('taskTable');t.innerHTML='<tr><th>Cron</th><th>Type</th><th>Arg</th><th>Enabled</th><th>Actions</th></tr>';j.tasks.forEach(x=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${x.cron}</td><td>${x.type}</td><td>${x.command||x.message||''}</td><td>${x.enabled?'yes':'no'}</td>`;const tdA=document.createElement('td');const del=document.createElement('button');del.textContent='Delete';del.onclick=async()=>{await apiFetch('/api/tasks/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:x.id})});loadTasks()};tdA.appendChild(del);tr.appendChild(tdA);t.appendChild(tr)})}
el('taskCreate').onclick=async()=>{const cron=el('taskCron').value;const type=el('taskType').value;const enabled=el('taskEnabled').checked;const arg=el('taskArg').value;const t={cron,type,enabled};if(type==='command')t.command=arg;if(type==='announce')t.message=arg;await apiFetch('/api/tasks/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(t)});loadTasks()}
async function loadWorlds(){const r=await apiFetch('/api/worlds');const j=await r.json();const t=el('worldTable');t.innerHTML='<tr><th>Name</th><th>Actions</th></tr>';j.worlds.forEach(w=>{const tr=document.createElement('tr');const tdN=document.createElement('td');tdN.textContent=w;const tdA=document.createElement('td');const dl=document.createElement('button');dl.textContent='Download';dl.onclick=async()=>{await apiFetch('/api/worlds/download',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({world:w})});loadWorlds()};tdA.appendChild(dl);const rs=document.createElement('button');rs.textContent='Reset';rs.onclick=async()=>{await apiFetch('/api/worlds/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({world:w})});loadWorlds()};tdA.appendChild(rs);tr.appendChild(tdN);tr.appendChild(tdA);t.appendChild(tr)})}
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
async function loadConfig(){const r=await apiFetch('/api/settings/config');const j=await r.json();el('cfgInstanceRoot').value=j.instanceRoot||'';el('cfgJavaPath').value=j.javaPath||'';el('cfgServerJar').value=j.serverJar||'';el('cfgJvmArgs').value=(j.jvmArgs||[]).join(' ');el('cfgAutoRestart').checked=!!j.autoRestart;el('cfgMaxBackoff').value=j.autoRestartMaxBackoffSeconds||300}
el('cfgSave').onclick=async()=>{const body={instanceRoot:el('cfgInstanceRoot').value,javaPath:el('cfgJavaPath').value,serverJar:el('cfgServerJar').value,jvmArgs:(el('cfgJvmArgs').value||'').split(/\s+/).filter(Boolean),autoRestart:el('cfgAutoRestart').checked,autoRestartMaxBackoffSeconds:parseInt(el('cfgMaxBackoff').value||'300',10)};await apiFetch('/api/settings/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}
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
function updateMetrics(m){el('cpu').textContent=(m.cpu||0).toFixed(1);el('ram').textContent=formatBytes(m.memory||0);el('disk').textContent=formatBytes(m.diskUsedBytes||0);el('tps').textContent=m.tps==null?'N/A':m.tps;el('players').textContent=(m.players&&m.players.count)||0;pushData('cpu',m.cpu||0);const ramPct=m.systemMemoryTotal?Math.min(100,(m.memory||0)/m.systemMemoryTotal*100):0;pushData('ram',ramPct);pushData('disk',m.diskUsedBytes||0);pushData('tps',m.tps==null?0:m.tps);drawCharts()}
const selectedFiles=new Set()
el('deleteSelected').onclick=async()=>{if(selectedFiles.size===0)return;const ok=confirm(`Are you sure you want to delete ${selectedFiles.size} item(s)?`);if(!ok)return;let affect=false;for(const target of selectedFiles){if(target.startsWith('plugins/'))affect=true;await apiFetch('/api/fs/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:target})})}selectedFiles.clear();const p=el('pathInput').value;loadFiles(p);if(affect||p==='plugins'||p.startsWith('plugins/'))loadPlugins()}
