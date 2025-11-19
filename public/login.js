function el(id){return document.getElementById(id)}
async function doLogin(){const u=el('username').value;const p=el('password').value;const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});if(!r.ok){el('loginErr').textContent='Invalid credentials';return}const j=await r.json();localStorage.setItem('token',j.token);location.href='/'}
document.addEventListener('DOMContentLoaded',()=>{const tk=localStorage.getItem('token');if(tk){location.href='/';return}el('loginBtn').onclick=doLogin})
