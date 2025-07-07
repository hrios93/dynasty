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
  // After auth state settles, load Firebase data:
  loadRules();
  loadPolls();
  loadEvents();
});

// Expose auth funcs to global
window.startLogin = startLogin;
window.logout     = logout;

// ——————————————————————————————————
// Dark Mode (system + toggle override)
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
// Utility: Show/Hide Sections
// ——————————————————————————————————
function toggleSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = el.style.display === "none" ? "block" : "none";
}
window.toggleSection = toggleSection;

// ——————————————————————————————————
// Sleeper API Data Fetchers with Guards
// ——————————————————————————————————
const leagueId = "1180208789911158784";

// 1. League Info
async function fetchLeagueInfo() {
  const el = document.getElementById("league-data");
  if (!el) return;
  try {
    const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
    const d   = await res.json();
    el.innerText = `${d.name} • Season ${d.season} • ${d.total_rosters} Teams`;
  } catch (e) {
    console.error("League Info Error:", e);
  }
}

// 2. Standings + Upcoming Matchup + Power Score
async function fetchStandings() {
  const el = document.getElementById("standings-data");
  if (!el) return;
  try {
    const [rs, us] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then(r => r.json()),
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r => r.json())
    ]);
    const userMap = Object.fromEntries(us.map(u => [u.user_id, u.display_name]));
    rs.sort((a, b) => {
      const aw = a.settings.wins ?? 0, bw = b.settings.wins ?? 0;
      if (bw !== aw) return bw - aw;
      const af = a.settings.fpts ?? 0, bf = b.settings.fpts ?? 0;
      return bf - af;
    });
    let rows = "";
    rs.forEach((r, i) => {
      const owner = userMap[r.owner_id] || "Unknown";
      const wins = r.settings.wins ?? 0;
      const losses = r.settings.losses ?? 0;
      const fpts = r.settings.fpts ?? 0;
      const fpts_against = r.settings.fpts_against ?? 0;
      const lastOpp = "-";
      const nextOpp = "-";
      rows += `<tr>
        <td>${i+1}</td>
        <td><a href="teams.html#${r.owner_id}">${owner}</a></td>
        <td>${wins}-${losses}</td>
        <td>${fpts.toFixed(1)}</td>
        <td>${fpts_against.toFixed(1)}</td>
        <td>${i+1}</td>
        <td>${lastOpp}</td>
        <td>${nextOpp}</td>
      </tr>`;
    });
    el.innerHTML = `
      <table>
        <thead>
          <tr><th>Rank</th><th>Team</th><th>W-L</th><th>PF</th><th>PA</th><th>Waiver</th><th>Last</th><th>Next</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  } catch (e) {
    console.error("Standings Error:", e);
  }
}

// 3. Waiver Feed
async function fetchWaivers() {
  const el = document.getElementById("waiver-feed");
  if (!el) return;
  try {
    const tx = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/1`).then(r => r.json());
    const adds = tx.filter(t => t.type === 'waiver' && t.adds);
    const drops = tx.filter(t => t.type === 'waiver' && t.drops);
    const players = await fetch('https://api.sleeper.app/v1/players/nfl').then(r => r.json());
    let html = "";
    adds.slice(0,5).forEach(t => Object.keys(t.adds).forEach(pid => html += `<p>📥 ${players[pid]?.full_name||pid}</p>`));
    drops.slice(0,5).forEach(t => Object.keys(t.drops).forEach(pid => html += `<p>❌ ${players[pid]?.full_name||pid}</p>`));
    el.innerHTML = html || '<p>No recent waivers</p>';
  } catch(e) {
    console.error("Waivers Error:", e);
  }
}

// 4. Events Feed (Firestore)
async function loadEvents() {
  const el = document.getElementById("event-log");
  if (!el) return;
  db.collection("events").orderBy("timestamp","desc").limit(20)
    .onSnapshot(snap => {
      el.innerHTML = snap.docs.map(d => {
        const e = d.data();
        const icon = e.type==='rules'?'📜': e.type==='poll'?'🗳️': e.type==='waiver'?'📥':'🔄';
        return `<p>${icon} ${e.desc} <small>${e.timestamp.toDate().toLocaleString()}</small></p>`;
      }).join('');
    });
}
async function logEvent(desc, type='misc') {
  await db.collection("events").add({desc, type, timestamp: firebase.firestore.FieldValue.serverTimestamp()});
}

// 5. Polls (Firestore)
async function submitPoll() {
  const feedEl = document.getElementById("polls-feed"); if (!feedEl) return;
  const title = document.getElementById("poll-title").value.trim();
  const opts = document.getElementById("poll-options").value.split("\n").map(o=>o.trim()).filter(Boolean);
  const multi = document.getElementById("poll-multi").checked;
  if(!title||opts.length<2) return alert("Title + at least 2 options");
  const votes = opts.reduce((a,o)=>{a[o]=[];return a;},{});
  await db.collection("polls").add({title, options:opts, votes, multi, createdBy: currentUser?.displayName||'Anon', timestamp: firebase.firestore.FieldValue.serverTimestamp()});
  logEvent(`Poll created: "${title}"`, 'poll');
}
async function votePoll(pid, multi) {
  const feedEl = document.getElementById("polls-feed"); if (!feedEl) return;
  const doc = await db.collection("polls").doc(pid).get(); const p = doc.data();
  const choices = Array.from(document.querySelectorAll(`[name=poll-${pid}]`)).filter(i=>i.checked).map(i=>i.value);
  if(!choices.length) return alert("Select at least one");
  p.options.forEach(opt => {
    const set = new Set(p.votes[opt]);
    choices.includes(opt)? set.add(currentUser.uid) : set.delete(currentUser.uid);
    p.votes[opt] = Array.from(set);
  });
  await db.collection("polls").doc(pid).update({votes: p.votes});
}
function renderPoll(doc) {
  const p = doc.data(); const feedEl=document.getElementById("polls-feed"); if(!feedEl)return;
  const voted = p.options.some(o=>p.votes[o].includes(currentUser?.uid));
  let html=`<article><h3>${p.title}</h3>`;
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
  const feedEl = document.getElementById("polls-feed"); if(!feedEl)return;
  db.collection("polls").orderBy("timestamp","desc").onSnapshot(snap=>{
    feedEl.innerHTML = snap.docs.map(renderPoll).join('');
  });
}

// 6. Rules Editor (Firestore)
async function loadRules() {
  const disp = document.getElementById("rules-display"); if(!disp)return;
  const edit = document.getElementById("rules-editor"); const eb = document.getElementById("edit-rules-btn"); const sb=document.getElementById("save-rules-btn");
  const doc = await db.collection("rules").doc("league_rules").get();
  const txt = doc.exists?doc.data().text:'No rules set.';
  disp.innerText=txt; edit.value=txt;
  if(currentUser?.email==='harnyrios@me.com') eb.style.display='inline-block';
}
function toggleRulesEdit(){
  const disp=document.getElementById("rules-display"); const edit=document.getElementById("rules-editor"); const sb=document.getElementById("save-rules-btn");
  if(edit.style.display==='block'){edit.style.display='none';disp.style.display='block';sb.style.display='none';}
  else{edit.style.display='block';disp.style.display='none';sb.style.display='inline-block';}
}
async function saveRules(){
  const txt=document.getElementById("rules-editor").value;
  await db.collection("rules").doc("league_rules").set({text:txt,updatedBy:currentUser.displayName,timestamp:firebase.firestore.FieldValue.serverTimestamp()});
  logEvent('Rules updated','rules');toggleRulesEdit();loadRules();
}

// 7. Initialization
window.addEventListener('load',()=>{
  fetchLeagueInfo(); fetchStandings(); fetchWaivers(); loadEvents(); loadPolls(); loadRules();
});
