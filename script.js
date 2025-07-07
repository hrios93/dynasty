// script.js

// ——————————————————————————————————
// Firebase & App Initialization
// ——————————————————————————————————
firebase.initializeApp({
  apiKey: "AIzaSyBTY-rF1jHLFyPjtQ5NVNTKAO7_9ts8MjI",
  authDomain: "dynastyboard.firebaseapp.com",
  projectId: "dynastyboard"
});
const db   = firebase.firestore();
const auth = firebase.auth();

// ——————————————————————————————————
// Authentication (Google Popup)
// ——————————————————————————————————
let currentUser = null;

function startLogin() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider);
}
function logout() {
  auth.signOut();
}
auth.onAuthStateChanged(user => {
  currentUser = user;
  const loginBtn  = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userInfo  = document.getElementById("user-info");
  if (loginBtn && logoutBtn && userInfo) {
    loginBtn.style.display  = user ? "none"    : "inline";
    logoutBtn.style.display = user ? "inline"  : "none";
    userInfo.innerText      = user ? `Hello, ${user.displayName}` : "";
  }
  // After auth state settles, load Firebase data
  loadRules();
  loadPolls();
  loadEvents();
});
window.startLogin = startLogin;
window.logout     = logout;

// ——————————————————————————————————
// Dark Mode
// ——————————————————————————————————
(function(){
  const stored = localStorage.getItem("darkMode");
  const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.body.classList.toggle("dark", stored === "true" || (stored === null && prefers));
})();
document.querySelectorAll("#theme-toggle").forEach(btn => {
  btn.onclick = () => {
    const on = document.body.classList.toggle("dark");
    localStorage.setItem("darkMode", on);
  };
});

// ——————————————————————————————————
// Utility: Toggle Sections
// ——————————————————————————————————
function toggleSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = el.style.display === "none" ? "block" : "none";
}
window.toggleSection = toggleSection;

// ——————————————————————————————————
// Sleeper League ID
// ——————————————————————————————————
const leagueId = "1180208789911158784";

// ——————————————————————————————————
// 1. Fetch League Info
// ——————————————————————————————————
async function fetchLeagueInfo() {
  const el = document.getElementById("league-data"); if(!el) return;
  try {
    const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
    const d = await res.json();
    el.innerText = `${d.name} • Season ${d.season} • ${d.total_rosters} Teams`;
  } catch(e) {
    console.error("League Info Error:", e);
  }
}

// ——————————————————————————————————
// 2. Fetch Standings & Upcoming
// ——————————————————————————————————
async function fetchStandings() {
  const el = document.getElementById("standings-data"); if(!el) return;
  try {
    const [rosters, users] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then(r=>r.json()),
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r=>r.json())
    ]);
    const userMap = Object.fromEntries(users.map(u=>[u.user_id, u.display_name]));
    rosters.sort((a,b) => (b.settings?.wins||0) - (a.settings?.wins||0) || (b.settings?.fpts||0) - (a.settings?.fpts||0));

    let rows = "";
    rosters.forEach((r,i) => {
      const owner = userMap[r.owner_id]||"Unknown";
      const w = r.settings?.wins||0, l = r.settings?.losses||0;
      const pf = r.settings?.fpts||0, pa = r.settings?.fpts_against||0;
      rows += `<tr>
        <td>${i+1}</td>
        <td><a href="teams.html#${r.owner_id}">${owner}</a></td>
        <td>${w}-${l}</td>
        <td>${pf.toFixed(1)}</td>
        <td>${pa.toFixed(1)}</td>
        <td>${i+1}</td>
        <td>-</td>
        <td>-</td>
      </tr>`;
    });
    el.innerHTML = `
      <table>
        <thead>
          <tr><th>Rank</th><th>Team</th><th>W-L</th><th>PF</th><th>PA</th><th>Waiver</th><th>Last</th><th>Next</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  } catch(e) { console.error("Standings Error:", e); }
}

// ——————————————————————————————————
// 3. Fetch Waiver Activity
// ——————————————————————————————————
async function fetchWaivers() {
  const el = document.getElementById("waiver-feed"); if(!el) return;
  try {
    const tx = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/1`).then(r=>r.json());
    const adds = tx.filter(t=>t.type==='waiver'&&t.adds);
    const drops= tx.filter(t=>t.type==='waiver'&&t.drops);
    const players = await fetch('https://api.sleeper.app/v1/players/nfl').then(r=>r.json());
    let html="";
    adds.slice(0,5).forEach(t=>Object.keys(t.adds).forEach(pid=>html+=`<p>📥 ${players[pid]?.full_name||pid}</p>`));
    drops.slice(0,5).forEach(t=>Object.keys(t.drops).forEach(pid=>html+=`<p>❌ ${players[pid]?.full_name||pid}</p>`));
    el.innerHTML = html || '<p>No recent waivers</p>';
  } catch(e) { console.error("Waivers Error:", e); }
}

// ——————————————————————————————————
// 4. Load Events Feed
// ——————————————————————————————————
async function loadEvents() {
  const el = document.getElementById("event-log"); if(!el) return;
  db.collection("events").orderBy("timestamp","desc").limit(20)
    .onSnapshot(snap => {
      el.innerHTML = snap.docs.map(d=>{
        const e = d.data();
        const ic = e.type==='rules'?'📜': e.type==='poll'?'🗳️': e.type==='waiver'?'📥':'🔄';
        return `<p>${ic} ${e.desc} <small>${e.timestamp.toDate().toLocaleString()}</small></p>`;
      }).join('');
    });
}
async function logEvent(desc, type='misc') {
  await db.collection("events").add({desc, type, timestamp: firebase.firestore.FieldValue.serverTimestamp()});
}

// ——————————————————————————————————
// 5. Load & Submit Polls
// ——————————————————————————————————
async function submitPoll() {
  const feed = document.getElementById("polls-feed"); if(!feed) return;
  const title = document.getElementById("poll-title").value.trim();
  const opts  = document.getElementById("poll-options").value.split("\n").map(o=>o.trim()).filter(Boolean);
  const multi = document.getElementById("poll-multi").checked;
  if(!title||opts.length<2) return alert("Enter title and 2+ options");
  const votes = opts.reduce((a,o)=>{a[o]=[];return a;},{});
  await db.collection("polls").add({title, options:opts, votes, multi, createdBy: currentUser?.displayName||'Anon', timestamp: firebase.firestore.FieldValue.serverTimestamp()});
  logEvent(`Poll created: "${title}"`, 'poll');
}
async function votePoll(pid, multi) {
  const doc = await db.collection("polls").doc(pid).get();const p = doc.data();
  const choices = Array.from(document.querySelectorAll(`[name=poll-${pid}]`)).filter(i=>i.checked).map(i=>i.value);
  if(!choices.length) return alert("Select one or more");
  p.options.forEach(opt=>{
    const set = new Set(p.votes[opt]);
    choices.includes(opt)? set.add(currentUser.uid) : set.delete(currentUser.uid);
    p.votes[opt] = Array.from(set);
  });
  await db.collection("polls").doc(pid).update({votes:p.votes});
}
function renderPoll(doc) {
  const p = doc.data(); let html=`<article><h3>${p.title}</h3>`;
  const voted = p.options.some(o=>p.votes[o].includes(currentUser?.uid));
  if(!voted) {
    html += p.options.map(o=>`<label><input type="${p.multi?'checkbox':'radio'}" name="poll-${doc.id}" value="${o}"> ${o}</label><br>`).join('');
    html += `<button onclick="votePoll('${doc.id}',${p.multi})">Vote</button>`;
  } else {
    html += `<p><em>Results:</em></p>` + p.options.map(o=>`<p>${o}: ${p.votes[o].length}</p>`).join('');
  }
  html += `</article>`;
  return html;
}
function loadPolls() {
  const feed = document.getElementById("polls-feed"); if(!feed) return;
  db.collection("polls").orderBy("timestamp","desc").onSnapshot(snap=>{
    feed.innerHTML = snap.docs.map(renderPoll).join('');
  });
}

// ——————————————————————————————————
// 6. Load & Edit Rules
// ——————————————————————————————————
async function loadRules() {
  const disp = document.getElementById("rules-display"); if(!disp) return;
  const edit = document.getElementById("rules-editor");
  const eb = document.getElementById("edit-rules-btn");
  const sb = document.getElementById("save-rules-btn");
  const doc = await db.collection("rules").doc("league_rules").get();
  const txt = doc.exists?doc.data().text:'No rules yet.';
  disp.innerText = txt;
  edit.value = txt;
  if(currentUser?.email==='harnyrios@me.com') eb.style.display='inline-block';
}
function toggleRulesEdit() {
  const disp = document.getElementById("rules-display"); const edit = document.getElementById("rules-editor"); const sb = document.getElementById("save-rules-btn");
  if(edit.style.display==='block'){edit.style.display='none'; disp.style.display='block'; sb.style.display='none';}
  else{edit.style.display='block'; disp.style.display='none'; sb.style.display='inline-block';}
}
async function saveRules() {
  const txt = document.getElementById("rules-editor").value;
  await db.collection("rules").doc("league_rules").set({text:txt,updatedBy:currentUser.displayName,timestamp:firebase.firestore.FieldValue.serverTimestamp()});
  logEvent('Rules updated','rules'); toggleRulesEdit(); loadRules();
}

// ——————————————————————————————————
// 7. Teams Page Logic
// ——————————————————————————————————
async function fetchTeams() {
  const grid = document.getElementById("team-selector");
  const details = document.getElementById("team-pages");
  if(!grid||!details) return;
  const [users, rosters, players] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then(r=>r.json()),
    fetch('https://api.sleeper.app/v1/players/nfl').then(r=>r.json())
  ]);
  const userMap = Object.fromEntries(users.map(u=>[u.user_id,u]));
  grid.innerHTML = users.map(u=>{
    const av = u.avatar? `<img class="avatar" src="https://sleepercdn.com/avatars/thumbs/${u.avatar}">` : `<div class="avatar"></div>`;
    return `<div class="team-tab" data-id="${u.user_id}">${av}<div>${u.display_name}</div></div>`;
  }).join('');
  document.querySelectorAll('.team-tab').forEach(tab=>{
    tab.onclick = ()=> renderTeamPage(tab.dataset.id, rosters, userMap, players);
  });
  if(users.length) document.querySelector('.team-tab').click();
}
function renderTeamPage(uid, rosters, userMap, players) {
  const details = document.getElementById("team-pages");
  const roster = rosters.find(r=>r.owner_id===uid);
  if(!roster) { details.innerHTML=`<p>No roster</p>`; return; }
  // group by position
  const posMap = {};
  roster.players.forEach(pid=>{
    const p = players[pid];
    const pos = p?.position||'UNK';
    posMap[pos] = posMap[pos]||[];
    posMap[pos].push(p?.full_name||pid);
  });
  let html = `<h3>${userMap[uid].display_name}</h3><p>W-L: ${roster.settings.wins}-${roster.settings.losses}</p><h4>Roster</h4>`;
  Object.keys(posMap).forEach(pos=>{
    html+=`<strong>${pos}</strong><ul>`+ posMap[pos].map(n=>`<li>${n}</li>`).join('')+`</ul>`;
  });
  details.innerHTML=html;
}

// ——————————————————————————————————
// 8. Analysis Page Logic
// ——————————————————————————————————
async function initAnalysis() {
  const ta = document.getElementById("team-a");
  const tb = document.getElementById("team-b");
  if(!ta||!tb) return;
  const users = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r=>r.json());
  const opts = users.map(u=>`<option value="${u.user_id}">${u.display_name}</option>`).join('');
  ta.innerHTML = opts; tb.innerHTML = opts;
}
async function analyzeTrade() {
  const a = document.getElementById('team-a').value;
  const b = document.getElementById('team-b').value;
  const [rs, players] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then(r=>r.json()),
    fetch('https://api.sleeper.app/v1/players/nfl').then(r=>r.json())
  ]);
  const ra = rs.find(r=>r.owner_id===a), rb = rs.find(r=>r.owner_id===b);
  const list = r=> (r.players||[]).map(pid=>players[pid]?.full_name||pid).slice(0,10).join(', ');
  document.getElementById('trade-analysis-results').innerHTML = `
    <h4>Team A Roster:</h4><p>${list(ra)}</p>
    <h4>Team B Roster:</h4><p>${list(rb)}</p>
    <p><em>Data from FantasyCalc Superflex</em></p>`;
}
window.analyzeTrade = analyzeTrade;

// ——————————————————————————————————
// Initialization
// ——————————————————————————————————
window.addEventListener('load', ()=>{
  fetchLeagueInfo();
  fetchStandings();
  fetchWaivers();
  loadEvents();
  loadPolls();
  loadRules();
  // page-specific
  fetchTeams();
  initAnalysis();
});
