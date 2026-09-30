// Adds accounts, cloud-saved progress and a leaderboard. Does nothing if there is no backend (e.g. GitHub Pages).
(() => {
  const KEY = 'nightschool-v1', orig = Storage.prototype.setItem;
  let me = null, backend = false, t;
  try { // synchronous on purpose: runs before the page reads its saved progress
    const r = new XMLHttpRequest(); r.open('GET', '/api/me', false); r.send();
    let j = null; try { j = JSON.parse(r.responseText); } catch {}
    backend = j !== null && (r.status === 200 || r.status === 401);
    if (r.status === 200) { me = j; if (j.data && j.data.xp !== undefined) orig.call(localStorage, KEY, JSON.stringify(j.data)); }
  } catch {}
  if (!backend) return;
  const api = (m, u, b) => fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })
    .then(async r => ({ ok: r.ok, j: await r.json().catch(() => ({})) }));
  const local = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const push = () => api('PUT', '/api/progress', { data: local() }).then(r => r.ok && badge());
  Storage.prototype.setItem = function (k, v) { orig.call(this, k, v); if (k === KEY && me) { clearTimeout(t); t = setTimeout(push, 800); } };

  let btn, box;
  const badge = () => { btn.textContent = me ? `${me.name} · ${local().xp || 0} XP` : 'Log in to save progress'; };
  async function board() {
    const r = await api('GET', '/api/leaderboard');
    box.querySelector('ol').innerHTML = (r.j.length ? r.j : []).map(u => `<li>${u.name.replace(/</g, '&lt;')}<b>${u.xp} XP</b></li>`).join('') || '<li>No one yet. Be the first!</li>';
  }
  function draw() {
    box.querySelector('.f').innerHTML = me
      ? `<p>Signed in as <b>${me.name}</b>. Progress saves automatically.</p><button id="lo">Log out</button>`
      : `<input id="un" placeholder="Name" autocomplete="username"><input id="pw" type="password" placeholder="Password (6+ characters)" autocomplete="current-password">
         <div><button id="li">Log in</button><button id="rg">Create account</button></div><p id="er"></p>`;
    const go = path => async () => {
      const r = await api('POST', path, { name: box.querySelector('#un').value, password: box.querySelector('#pw').value });
      if (!r.ok) return box.querySelector('#er').textContent = r.j.error || 'Something went wrong';
      const mine = local(), s = await api('GET', '/api/me');
      if (s.ok && !(s.j.data && s.j.data.xp !== undefined)) await api('PUT', '/api/progress', { data: mine });
      location.reload();
    };
    if (me) box.querySelector('#lo').onclick = async () => { await api('POST', '/api/logout'); location.reload(); };
    else { box.querySelector('#li').onclick = go('/api/login'); box.querySelector('#rg').onclick = go('/api/register'); }
  }
  addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = `#nsb{position:fixed;left:16px;bottom:16px;z-index:20;background:#ffd166;color:#14122b;border:0;border-radius:999px;padding:10px 18px;font:600 .95rem system-ui,sans-serif;cursor:pointer}
    #nsx{position:fixed;left:16px;bottom:64px;z-index:20;width:min(320px,calc(100vw - 32px));background:#1f1b40;color:#f3eeff;border:1px solid #3a3470;border-radius:20px;padding:18px;font:.95rem system-ui,sans-serif;display:none}
    #nsx input{display:block;width:100%;margin:6px 0;padding:9px 12px;border-radius:10px;border:1px solid #3a3470;background:#14122b;color:#f3eeff;font:inherit}
    #nsx button{background:#ffd166;color:#14122b;border:0;border-radius:10px;padding:8px 14px;margin:4px 6px 4px 0;font:600 .9rem system-ui,sans-serif;cursor:pointer}
    #nsx ol{padding-left:20px;margin:6px 0 0}#nsx li{margin:3px 0}#nsx li b{float:right;color:#ffd166}#er{color:#ff6b8b;margin:6px 0 0}#nsx h4{margin:14px 0 0}`;
    document.head.appendChild(st);
    btn = document.createElement('button'); btn.id = 'nsb';
    box = document.createElement('div'); box.id = 'nsx'; box.innerHTML = '<div class="f"></div><h4>Top learners</h4><ol></ol>';
    document.body.append(btn, box); badge(); draw();
    btn.onclick = () => { const o = box.style.display === 'block'; box.style.display = o ? 'none' : 'block'; if (!o) board(); };
  });
})();
