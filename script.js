// script.js - Full File

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
function startLogin() { const provider = new firebase.auth.GoogleAuthProvider(); auth.signInWithPopup(provider); }
function logout()    { auth.signOut(); }
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
  if (typeof loadRules   === 'function') loadRules();
  if (typeof loadPolls   === 'function') loadPolls();
  if (typeof loadEvents  === 'function') loadEvents();
});
window.startLogin = startLogin;
window.logout     = logout;

// ——————————————————————————————————
// Dark Mode
// ——————————————————————————————————
(function() {
  const stored  = localStorage.getItem("darkMode");
  const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.body.classList.toggle("dark", stored === "true" || (stored === null && prefers));
})();
document.querySelectorAll("#theme-toggle").forEach(btn => btn.onclick = () => {
  const on = document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", on);
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
// Safe Stub for Rules & Polls Loaders
// ——————————————————————————————————
async function loadRules() { /* stub */ }
function loadPolls()   { /* stub */ }

// ——————————————————————————————————
// Constants & League IDs
// ——————————————————————————————————
const leagueId         = "1180208789911158784";
const fallbackLeagueId = "1048313545995296768";

// ——————————————————————————————————
// 1. Fetch League Info
// ——————————————————————————————————
async function fetchLeagueInfo() {
  const el = document.getElementById("league-data"); if(!el) return;
  try {
    const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
    const d   = await res.json();
    el.innerText = `${d.name} • Season ${d.season} • ${d.total_rosters} Teams`;
  } catch(e) {
    console.error("League Info Error:", e);
  }
}

// ——————————————————————————————————
// 2. Fetch Standings & Upcoming with Sorting & Fallback
// ——————————————————————————————————
async function fetchStandings() {
  console.log("[DEBUG] fetchStandings() called");
  const el = document.getElementById("standings-data"); if(!el) return console.log("[DEBUG] #standings-data element not found");

  // current waiver positions always live
  const currentRosters = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then(r=>r.json());
  const waiverMap = Object.fromEntries(currentRosters.map(r=>[r.owner_id, r.settings?.waiver_position||0]));

  // fetch team metadata from Sleeper
  const metaRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/metadata`);
  const meta   = await metaRes.json();
  const teamMetaMap = Object.fromEntries((meta.teams||[]).map(t=>[t.roster_id, t.name]));

  // fetch stats, fallback if no games
  let lid = leagueId;
  let [rs, us] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${lid}/rosters`).then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${lid}/users`).then(r=>r.json())
  ]);
  if(rs.every(r=> (r.settings?.wins||0)+(r.settings?.losses||0) ===0)){
    console.log("[DEBUG] No games yet; switching to fallback season");
    lid = fallbackLeagueId;
    [rs, us] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${lid}/rosters`).then(r=>r.json()),
      fetch(`https://api.sleeper.app/v1/league/${lid}/users`).then(r=>r.json())
    ]);
  }

  const userMap = Object.fromEntries(us.map(u=>[u.user_id, u.display_name]));
  const rosterToOwner = Object.fromEntries(rs.map(r=>[r.roster_id, r.owner_id]));

  // last matchup mapping (fallback last week = 18)
  let lastOppMap = {};
  try{
    const lastWeek = 18;
    const mups = await fetch(`https://api.sleeper.app/v1/league/${lid}/matchups/${lastWeek}`).then(r=>r.json());
    const games = {};
    mups.forEach(m=>{ games[m.matchup_id] = games[m.matchup_id]||[]; games[m.matchup_id].push(m); });
    Object.values(games).forEach(pair=>{ if(pair.length===2){
      const [a,b] = pair;
      const oa = rosterToOwner[a.roster_id]; const ob = rosterToOwner[b.roster_id];
      lastOppMap[oa] = ob; lastOppMap[ob] = oa;
    }});
  }catch(e){ console.warn("[WARN] Last matchups failed",e); }

  // compute metrics & attach waiver
  rs.forEach(r=>{
    r.power = (r.settings?.fpts||0)+(r.settings?.wins||0)*20;
    r.maxPF = r.settings?.fpts_max||0;
    r.waiver = waiverMap[r.owner_id]||0;
  });

  const sortBy = document.getElementById('standings-sort')?.value||'rank';
  console.log("[DEBUG] Sorting by:",sortBy);
  rs.sort((a,b)=>{
    switch(sortBy){
      case 'pf': return (b.settings?.fpts||0)-(a.settings?.fpts||0);
      case 'pa': return (a.settings?.fpts_against||0)-(b.settings?.fpts_against||0);
      case 'maxpf': return b.maxPF - a.maxPF;
      case 'power': return b.power - a.power;
      case 'waiver': return a.waiver - b.waiver;
      default: return ((b.settings?.wins||0)-(a.settings?.wins||0))||((b.settings?.fpts||0)-(a.settings?.fpts||0));
    }
  });

  let rows = '';
  rs.forEach((r,i)=>{
    const owner = teamMetaMap[r.roster_id]||userMap[r.owner_id]||'Unknown';
    const opp = lastOppMap[r.owner_id];
    let lastStr = '—';
    if(opp && userMap[opp]){
      const or = rs.find(x=>x.owner_id===opp);
      lastStr = `${teamMetaMap[or.roster_id]||userMap[opp]} (${or.settings.wins}-${or.settings.losses})`;
    }
    rows += `<tr>
      <td>${i+1}</td>
      <td><a href="teams.html#${r.owner_id}">${owner}</a></td>
      <td>${r.settings.wins||0}-${r.settings.losses||0}</td>
      <td>${(r.settings.fpts||0).toFixed(1)}</td>
      <td>${(r.settings.fpts_against||0).toFixed(1)}</td>
      <td>${r.maxPF.toFixed(1)}</td>
      <td>${r.power.toFixed(1)}</td>
      <td>${r.waiver}</td>
      <td>${lastStr}</td>
      <td>—</td>
    </tr>`;
  });

  el.innerHTML = `
    <table>
      <thead><tr>
        <th>Standings</th><th>Team</th><th>W-L</th>
        <th>PF</th><th>PA</th><th>Max PF</th>
        <th>Power Score</th><th>Waiver</th>
        <th>Last</th><th>Next</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
console.log("[DEBUG] fetchStandings() completed render");

}
const sortEl = document.getElementById('standings-sort');
if (sortEl) sortEl.addEventListener('change', fetchStandings);

// ——————————————————————————————————
// 3. Combined Waiver + Events Feed
// ——————————————————————————————————
async function loadEvents() {
  const el = document.getElementById("event-log"); if(!el) return;
  const fsSnap = await db.collection("events").orderBy("timestamp","desc").limit(20).get();
  const fsEvents = fsSnap.docs.map(d=>({
    ts: d.data().timestamp.toDate(),
    user: d.data().updatedBy||d.data().createdBy||'Commissioner',
    desc: d.data().desc,
    type: d.data().type
  }));
  const tx    = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/1`).then(r=>r.json());
  const [rosters, users, players] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r=>r.json()),
    fetch('https://api.sleeper.app/v1/players/nfl').then(r=>r.json())
  ]);
  const rosterMap = Object.fromEntries(rosters.map(r=>[r.roster_id,r.owner_id]));
  const userMap   = Object.fromEntries(users.map(u=>[u.user_id,u.display_name]));
  const waiverEvents = [];
  tx.forEach(t=>{
    if (t.type !== 'waiver') return;
    const ts = new Date(t.created*1000);
    if (t.adds) Object.entries(t.adds).forEach(([pid,rid]) => {
      waiverEvents.push({ ts, user: userMap[rosterMap[rid]]||'Unknown', desc: `📥 ${players[pid]?.full_name||pid}`, type: 'Waiver' });
    });
    if (t.drops) Object.entries(t.drops).forEach(([pid,rid]) => {
      waiverEvents.push({ ts, user: userMap[rosterMap[rid]]||'Unknown', desc: `❌ ${players[pid]?.full_name||pid}`, type: 'Waiver' });
    });
  });
  const merged = [...fsEvents, ...waiverEvents].sort((a,b)=>b.ts - a.ts).slice(0,20);
  let rows = merged.map(e=>`<tr>
    <td>${e.ts.toLocaleString()}</td>
    <td>${e.user}</td>
    <td>${e.desc}</td>
    <td>${e.type}</td>
  </tr>`).join('');
  el.innerHTML = `<table>
    <thead><tr><th>Date</th><th>User</th><th>Action</th><th>Type</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ——————————————————————————————————
// Initialization
// ——————————————————————————————————
window.addEventListener('load', () => {
  fetchLeagueInfo();
  fetchStandings();
  if (typeof loadEvents === 'function') loadEvents();
});
