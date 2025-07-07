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
  loadRules(); loadPolls(); loadEvents();
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
// 2. Fetch Standings & Upcoming with Sorting & Fallback + Debug
// ——————————————————————————————————
async function fetchStandings() {
  console.log("[DEBUG] fetchStandings() called");
  const el = document.getElementById("standings-data");
  if (!el) {
    console.log("[DEBUG] #standings-data element not found");
    return;
  }
  try {
    let lid = leagueId;
    let [rs, us] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${lid}/rosters`).then(r=>r.json()),
      fetch(`https://api.sleeper.app/v1/league/${lid}/users`).then(r=>r.json())
    ]);
    // fallback to last season if no games played
    if (rs.every(r=> (r.settings?.wins||0)+(r.settings?.losses||0) === 0)) {
      console.log("[DEBUG] No games yet; switching to fallback season");
      lid = fallbackLeagueId;
      [rs, us] = await Promise.all([
        fetch(`https://api.sleeper.app/v1/league/${lid}/rosters`).then(r=>r.json()),
        fetch(`https://api.sleeper.app/v1/league/${lid}/users`).then(r=>r.json())
      ]);
    }
    const userMap = Object.fromEntries(us.map(u=>[u.user_id, u.display_name]));
    // compute power & maxPF
    rs.forEach(r=>{
      r.power = (r.settings?.fpts||0) + (r.settings?.wins||0)*20;
      r.maxPF = r.settings?.fpts_max || 0;
    });
    // sort logic
    const sortBy = document.getElementById('standings-sort')?.value || 'rank';
    console.log("[DEBUG] Sorting by:", sortBy);
    rs.sort((a,b)=>{
      switch(sortBy) {
        case 'pf':    return (b.settings?.fpts||0) - (a.settings?.fpts||0);
        case 'pa':    return (a.settings?.fpts_against||0) - (b.settings?.fpts_against||0);
        case 'maxpf': return b.maxPF - a.maxPF;
        case 'waiver':return (a.settings?.waiver_position||0) - (b.settings?.waiver_position||0);
        case 'power': return b.power - a.power;
        default:      return ((b.settings?.wins||0) - (a.settings?.wins||0)) || ((b.settings?.fpts||0) - (a.settings?.fpts||0));
      }
    });
    // render rows
    let rows = '';
    rs.forEach((r,i)=>{
      const owner    = r.metadata?.team_name || userMap[r.owner_id] || 'Unknown';
      const w        = r.settings?.wins||0;
      const l        = r.settings?.losses||0;
      const pf       = r.settings?.fpts||0;
      const pa       = r.settings?.fpts_against||0;
      const maxPF    = r.maxPF;
      const power    = r.power;
      const waiver   = r.settings?.waiver_position || i+1;
      rows += `<tr>
        <td>${i+1}</td>
        <td><a href="teams.html#${r.owner_id}">${owner}</a></td>
        <td>${w}-${l}</td>
        <td>${pf.toFixed(1)}</td>
        <td>${pa.toFixed(1)}</td>
        <td>${maxPF.toFixed(1)}</td>
        <td>${power.toFixed(1)}</td>
        <td>${waiver}</td>
        <td>—</td>
        <td>—</td>
      </tr>`;
    });
    el.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Standings</th>
            <th>Team</th>
            <th>W-L</th>
            <th>PF</th>
            <th>PA</th>
            <th>Max PF</th>
            <th>Power Score</th>
            <th>Waiver</th>
            <th>Last</th>
            <th>Next</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  } catch(e) {
    console.error("Standings Error:", e);
  }
}
// re-fetch on sort change
document.getElementById('standings-sort')?.addEventListener('change', fetchStandings);

// ——————————————————————————————————
// 3. Combined Waiver + Events Feed
// ——————————————————————————————————
async function loadEvents() {
  const el = document.getElementById("event-log"); if(!el) return;
  // Firestore events
  const fsSnap = await db.collection("events").orderBy("timestamp","desc").limit(20).get();
  const fsEvents = fsSnap.docs.map(d=>({
    ts: d.data().timestamp.toDate(),
    user: d.data().updatedBy||d.data().createdBy||'Commissioner',
    desc: d.data().desc,
    type: d.data().type
  }));
  // waiver txns
  const tx = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/1`).then(r=>r.json());
  const [rosters, users, players] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r=>r.json()),
    fetch('https://api.sleeper.app/v1/players/nfl').then(r=>r.json())
  ]);
  const rosterMap = Object.fromEntries(rosters.map(r=>[r.roster_id,r.owner_id]));
  const userMap   = Object.fromEntries(users.map(u=>[u.user_id,u.display_name]));
  const waiverEvents = tx.filter(t=>t.type==='waiver').flatMap(t=>{
    const ts = new Date(t.created*1000);
    return [
      ...Object.entries(t.adds).map(([pid, rid]) => ({
        ts, user: userMap[rosterMap[rid]]||'Unknown', desc: `📥 ${players[pid]?.full_name||pid}`, type:'Waiver'
      })),
      ...Object.entries(t.drops).map(([pid, rid]) => ({
        ts, user: userMap[rosterMap[rid]]||'Unknown', desc: `❌ ${players[pid]?.full_name||pid}`, type:'Waiver'
      }))
    ];
  });
  // merge & sort
  const merged = [...fsEvents, ...waiverEvents].sort((a,b)=>b.ts - a.ts).slice(0,20);
  // render
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
  loadEvents();
  // other page-specific calls...
});
