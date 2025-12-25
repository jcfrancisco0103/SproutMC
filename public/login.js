function el(id){return document.getElementById(id)}
function getStoredToken(){return sessionStorage.getItem('token')||localStorage.getItem('token')}
function saveToken(token, remember){if(remember){localStorage.setItem('token',token);sessionStorage.removeItem('token')}else{sessionStorage.setItem('token',token);localStorage.removeItem('token')}}

async function doLogin(){
	const u=el('username').value;
	const p=el('password').value;
	const remember=!!el('rememberMe')?.checked;
	const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});
	if(!r.ok){el('loginErr').textContent='Invalid credentials';return}
	const j=await r.json();
	saveToken(j.token, remember);
	location.href='/'
}

document.addEventListener('DOMContentLoaded',()=>{
	const tk=getStoredToken();
	if(tk){location.href='/';return}
	const btn=el('loginBtn');
	if(btn) btn.onclick=doLogin;
	[el('username'), el('password')].forEach(inp=>{if(!inp)return;inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();doLogin()}})})
})
