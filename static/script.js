const $ = id => document.getElementById(id), qa = s => document.querySelectorAll(s);
const fill = (n, h) => qa(`[data-v="${n}"]`).forEach(e => e.innerHTML = h);   // fill every view with that name
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TITLES = {dashboard:'Dashboard', routing:'Request Routing', servers:'Servers', analytics:'Analytics', profile:'User Profile'};
let S = null, filter = 'all', events = [], demoing = false;
const user = () => { const u = JSON.parse(localStorage.getItem('sf_user') || 'null'); if (u && /DAA/i.test(u.role)) u.role = 'Participant'; return u; };

/* ---------- API + toast ---------- */
async function api(path, body) {
  try {
    const r = await fetch('/api/' + path, body === undefined ? {} :
      {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    const d = await r.json();
    if (!r.ok) { toast('⚠ ' + d.error, 'warn'); return null; }
    if (d.servers) { S = d; render(); }
    return d;
  } catch (e) { toast('⚠ Cannot reach server', 'warn'); return null; }
}
function toast(m, t = 'info') {
  if (t === 'ok') { events.push(m); updBadge(); }
  const e = document.createElement('div'); e.className = 'toast ' + (t === 'ok' ? '' : t); e.textContent = m;
  $('toasts').appendChild(e); setTimeout(() => e.remove(), 3200);
}
const updBadge = () => { $('badge').textContent = events.length; $('badge').classList.toggle('hidden', !events.length); };
const bell = () => { toast(events.slice(-3).join('  •  ') || 'No new notifications', 'info'); events = []; updBadge(); };

/* ---------- login / nav ---------- */
async function login() {
  const name = $('lu').value.trim(), email = $('le').value.trim();
  const d = await fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username: name})}).then(r => r.json());
  if (d.error) return toast('⚠ ' + d.error, 'warn');
  localStorage.setItem('sf_user', JSON.stringify({name, email: email || 'not set', role: 'Participant'}));
  showApp();
}
function logout() { localStorage.removeItem('sf_user'); $('app').classList.add('hidden'); $('login').classList.remove('hidden'); }
function showApp() { $('login').classList.add('hidden'); $('app').classList.remove('hidden'); render(); nav('dashboard'); }
function nav(p) {
  qa('.page').forEach(e => e.classList.toggle('active', e.id === 'p-' + p));
  qa('.nav').forEach(e => e.classList.toggle('on', e.dataset.p === p));
  $('title').textContent = TITLES[p]; $('side').classList.remove('open'); scrollTo(0, 0);
}
const openM = id => { if (id === 'm-profile') { const u = user(); $('pn').value = u.name; $('pe').value = u.email; $('pr').value = u.role; } $(id).classList.add('show'); };
const closeM = () => qa('.mbg').forEach(e => e.classList.remove('show'));
function saveProfile() {
  localStorage.setItem('sf_user', JSON.stringify({name: $('pn').value || 'User', email: $('pe').value, role: $('pr').value}));
  closeM(); render(); toast('✓ Profile updated', 'ok');
}

/* ---------- actions ---------- */
async function routeNext() {
  const d = await api('route', {});
  if (!d) return false;
  toast(`✓ Request ${d.last.req.id} routed to ${d.last.chosen}`, 'ok'); return true;
}
async function runDemo() {
  if (demoing) return; demoing = true;
  await api('demo', {}); toast('▶ Demo started – loading sample servers & requests', 'info');
  while (S.queue.length) { await sleep(1000); if (!await routeNext()) break; await sleep(1200); }
  demoing = false; toast('✓ Demo complete', 'ok');
}
async function resetSim() { if (await api('reset', {})) toast('✓ Simulation reset', 'ok'); }
async function addReq() {
  const d = await api('request', {id: $('ri').value, p: $('rp').value, cost: $('rc').value});
  if (d) { toast(`✓ Request ${S.queue.reduce((a, r) => a.seq > r.seq ? a : r).id} added`, 'ok'); $('ri').value = ''; }
}
async function addServer() {
  const d = await api('server', {action: 'add', id: $('si').value, cap: $('sc').value, q: $('sq').value, cost: $('sr').value});
  if (d) { closeM(); toast(`✓ Server ${S.servers.at(-1).id} added`, 'ok'); $('si').value = ''; }
}
async function rmServer(id) { if (await api('server', {action: 'remove', id})) toast(`✓ Server ${id} removed`, 'ok'); }
function setF(f) { filter = f; qa('.chip').forEach(c => c.classList.toggle('on', c.dataset.f === f)); render(); }

/* ---------- rendering ---------- */
const hl = v => v.status === 'Full' || v.pct >= 85 ? ['Critical', 'r', '🔴'] : v.pct >= 60 ? ['Busy', 'o', '🟠'] : ['Healthy', 'g', '🟢'];
const pc = p => p >= 8 ? '🔴' : p >= 5 ? '🟠' : '🟡';
const bar = (pct, c) => `<div class="pbar"><i class="${c}" style="width:${Math.min(pct, 100)}%"></i></div>`;

function srvCard(v, big) {
  const [t, c, ic] = hl(v), win = S.last && S.last.chosen === v.id ? 'win' : '';
  return `<div class="card srv ${win}"><div class="srv-h"><b>SERVER ${esc(v.id)}</b><span class="pill ${v.status === 'Full' ? 'r' : 'g'}">● ${v.status}</span></div>
  <div class="stats"><div><small>Capacity</small><strong>${v.cap}</strong></div><div><small>Current Queue</small><strong>${v.q}</strong></div>
  <div><small>Response Cost</small><strong>${v.cost} ms</strong></div>${big ? `<div><small>Processed</small><strong>${v.done}</strong></div>` : ''}</div>
  <small>Utilization</small>${bar(v.pct, c)}<div class="srv-f"><b>${v.pct}%</b><span class="pill ${c}">${ic} ${t}</span></div>
  ${big ? `<button class="ghost sm" data-id="${esc(v.id)}" onclick="rmServer(this.dataset.id)">Remove Server</button>` : ''}</div>`;
}

function render() {
  if (!S) return;
  const m = S.metrics, u = user() || {name: 'Guest', email: '', role: ''};
  fill('uname', esc(u.name)); fill('uav', esc(u.name[0] || '?').toUpperCase());

  const dc = Math.round((m.avg_cost - 26.7) / 26.7 * 100);   // vs default servers' average
  const kp = (ic, l, v, tr, s) => `<div class="card kpi"><div class="ic">${ic}</div><div><small>${l}</small><h3>${v}</h3><small>${s}</small></div><span class="trend">${tr}</span></div>`;
  fill('kpi', kp('📨', 'Total Requests', m.total, `▲ ${m.pending} pending`, 'routed + waiting') +
    kp('✅', 'Requests Processed', m.processed, m.total ? Math.round(100 * m.processed / m.total) + '% done' : '0%', 'assigned to servers') +
    kp('🖥', 'Active Servers', m.active, `${S.servers.length} total`, 'with capacity left') +
    kp('⚡', 'Avg Response Cost', m.avg_cost + ' ms', `${dc >= 0 ? '▲' : '▼'} ${Math.abs(dc)}% vs default`, 'across servers'));

  fill('srvmini', S.servers.map(v => srvCard(v, false)).join('') || '<p class="muted">No servers</p>');
  fill('srvbig', S.servers.map(v => srvCard(v, true)).join('') || '<p class="muted">No servers – add one.</p>');

  fill('qtable', S.queue.map((r, i) => `<tr class="${i ? '' : 'hl'}"><td>${esc(r.id)}</td><td>${pc(r.p)} ${r.p}</td><td>${r.cost} ms</td><td>${i ? 'Waiting' : 'Next'}</td></tr>`).join('')
    || '<tr><td colspan="4" class="muted">Queue empty</td></tr>');
  fill('qstack', S.queue.length ? `<div class="qs"><div class="lab">HIGH PRIORITY ↓</div>` +
    S.queue.map((r, i) => `<div class="qi ${i ? '' : 'top'}"><b>${esc(r.id)}</b><span>${pc(r.p)} P${r.p}</span><span class="muted">${r.cost} ms</span></div>`).join('') +
    `<div class="lab">↓ LOW PRIORITY</div></div>` : '<p class="muted c">Queue is empty – add or generate requests.</p>');

  const l = S.last;
  fill('decision', !l ? '<p class="muted">Route a request to see the greedy decision here.</p>' :
    `<h3>Request ${esc(l.req.id)} <small>(priority ${l.req.p})</small></h3><p class="muted">Servers evaluated – Score = Queue + Response Cost:</p>
    <table><thead><tr><th>Server</th><th>Queue</th><th>Response Cost</th><th>Score</th></tr></thead><tbody>` +
    l.evals.map(e => `<tr class="${e.id === l.chosen ? 'hl' : ''}"><td>${esc(e.id)}</td><td>${e.q}</td><td>${e.cost}</td><td>${e.ok ? e.score : 'Full – skipped'}</td></tr>`).join('') +
    `</tbody></table><h2 style="margin-top:14px">Selected Server: ${esc(l.chosen)}<span class="badge-g">GREEDY CHOICE</span></h2>
    <p class="muted">Reason: Lowest feasible score</p><div class="note">A locally optimal choice for this request – not necessarily a globally optimal load distribution.</div>`);

  const rows = [...S.hist.map(h => ({t: h.time, r: h.req, p: h.p, s: h.server, sc: h.score, st: 'Completed'})),
    ...S.queue.map(r => ({t: '—', r: r.id, p: r.p, s: '—', sc: '—', st: 'Pending'}))].filter(x => filter === 'all' || x.st.toLowerCase() === filter);
  fill('history', rows.map(x => `<tr><td>${x.t}</td><td>${esc(x.r)}</td><td>${x.p}</td><td>${esc(x.s)}</td><td>${x.sc}</td>
    <td><span class="pill ${x.st === 'Completed' ? 'g' : 'o'}">${x.st}</span></td></tr>`).join('') || '<tr><td colspan="6" class="muted">No entries</td></tr>');

  const tot = S.servers.reduce((a, v) => a + v.done, 0) || 1;
  const box = (t, b) => `<div class="card"><h2>${t}</h2>${b}</div>`;
  fill('analytics',
    box('Request Distribution', S.servers.map(v => `<div class="kv"><span>${esc(v.id)}</span><b>${v.done} requests</b></div>${bar(100 * v.done / tot, 'g')}`).join('')) +
    box('Server Utilization', S.servers.map(v => `<div class="kv"><span>${esc(v.id)}</span><b>${v.pct}%</b></div>${bar(v.pct, hl(v)[1])}`).join('')) +
    box('Routing Efficiency', `<div class="ring" style="background:conic-gradient(var(--accent) ${m.eff}%,#3d3b37 0)"><b>${m.eff}%</b></div>
      <p class="muted c">Load-balance score = 100 − (highest − lowest utilization %)</p>`) +
    box('Queue & Response Cost', `<div class="grid g2"><div><small>Average Queue Length</small><div class="bigv">${m.avg_q}</div></div><div><small>Average Response Cost</small><div class="bigv">${m.avg_cost} ms</div></div></div>`) +
    `<div class="card" style="grid-column:1/-1"><h2>Algorithm Performance</h2><table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>
    <tr><td>Requests Processed</td><td>${m.processed}</td></tr><tr><td>Average Queue</td><td>${m.avg_q}</td></tr>
    <tr><td>Average Response Cost</td><td>${m.avg_cost} ms</td></tr><tr><td>Active Servers</td><td>${m.active}</td></tr></tbody></table></div>`);

  const kv = (k, v) => `<div class="kv"><span class="muted">${k}</span><b>${v}</b></div>`, p = S.profile;
  fill('profile',
    box('Account', kv('Name', esc(u.name)) + kv('Email', esc(u.email)) + kv('Role', esc(u.role))) +
    box('Project', kv('Project', 'Server Request Load Distributor') + kv('Algorithms', 'Greedy + Priority Queue') + kv('Technology', 'Python + Flask + JavaScript')) +
    box('Activity', kv('Requests Processed', p.processed) + kv('Servers Managed', S.servers.length + ' active, ' + p.added + ' added') + kv('Demo Runs', p.demos)));
}

/* ---------- init ---------- */
api('state').then(() => { if (user()) showApp(); });
