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
  el.style.display = el.style.display === "none" ? "block" : "none";
}
window.toggleSection = toggleSection;

// ——————————————————————————————————
// Sleeper League IDs
// ——————————————————————————————————
const leagueId         = "1180208789911158784";
const fallbackLeagueId = "1048313545995296768";

// ——————————————————————————————————
// FETCH: League Info
// ——————————————————————————————————
async function fetchLeagueInfo() {
  const el = document.getElementById("league-data");
  if (!el) return;
  try {
    const d = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`)
                      .then(r=>r.json());
    el.innerText = `${d.name} • Season ${d.season} • ${d.total_rosters} Teams`;
  } catch(e) { console.error("League Info Error:", e); }
}

// ——————————————————————————————————
// FETCH: Standings + Upcoming + Power Scores
// ——————————————————————————————————
async function fetchStandings() {
  console.log("[DEBUG] fetchStandings() called");
  const el = document.getElementById("standings-data");
  if (!el) {
    console.log("[DEBUG] #standings-data element not found");
    return;
  }

  // Always fetch live waiver positions
  const currentRosters = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`)
                              .then(r=>r.json());
  const waiverMap = Object.fromEntries(
    currentRosters.map(r=>[r.owner_id, r.settings?.waiver_position||0])
  );

  // Fetch rosters + users; fallback to last season if no games played
  let lid = leagueId;
  let [rs, us] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${lid}/rosters`).then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${lid}/users`).then(r=>r.json())
  ]);
  if (rs.every(r=> (r.settings?.wins||0)+(r.settings?.losses||0) === 0)) {
    console.log("[DEBUG] No games yet; switching to fallback season");
    lid = fallbackLeagueId;
    [rs, us] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${lid}/rosters`).then(r=>r.json()),
      fetch(`https://api.sleeper.app/v1/league/${lid}/users`).then(r=>r.json())
    ]);
  }

  // Build maps
  const userMap       = Object.fromEntries(us.map(u=>[u.user_id,u.display_name]));
  const rosterToOwner = Object.fromEntries(rs.map(r=>[r.roster_id, r.owner_id]));

  // Fetch last-week matchups from fallback league (week 18)
  const lastOppMap  = {};
  const lastScoreMap = {};
  try {
    const mups = await fetch(`https://api.sleeper.app/v1/league/${fallbackLeagueId}/matchups/18`)
                         .then(r=>r.ok?r.json():[]);
    const games = {};
    mups.forEach(m=>{
      games[m.matchup_id] = games[m.matchup_id]||[];
      games[m.matchup_id].push(m);
    });
    Object.values(games).forEach(pair=>{
      if (pair.length===2) {
        const [a,b] = pair;
        const oa = rosterToOwner[a.roster_id];
        const ob = rosterToOwner[b.roster_id];
        lastOppMap[oa] = ob;
        lastOppMap[ob] = oa;
        lastScoreMap[oa] = { pts: a.points, oppPts: b.points };
        lastScoreMap[ob] = { pts: b.points, oppPts: a.points };
      }
    });
  } catch(e) {
    console.warn("[WARN] Last matchups fetch failed", e);
  }

  // Compute metrics on each roster
  rs.forEach(r=>{
    r.power    = (r.settings?.fpts||0) + (r.settings?.wins||0)*20;
    r.maxPF    = r.settings?.fpts_max||0;
    r.waiver   = waiverMap[r.owner_id]||0;
  });

  // Sort based on dropdown
  const sortBy = document.getElementById("standings-sort")?.value||"rank";
  console.log("[DEBUG] Sorting by:", sortBy);
  rs.sort((a,b)=>{
    switch(sortBy){
      case 'pf':    return (b.settings?.fpts||0) - (a.settings?.fpts||0);
      case 'pa':    return (a.settings?.fpts_against||0) - (b.settings?.fpts_against||0);
      case 'maxpf': return b.maxPF - a.maxPF;
      case 'power': return b.power - a.power;
      case 'waiver':return a.waiver - b.waiver;
      default:      return ((b.settings?.wins||0)-(a.settings?.wins||0)) || ((b.settings?.fpts||0)-(a.settings?.fpts||0));
    }
  });

  // Build table rows
  let rows = "";
  rs.forEach((r,i)=>{
    const ownerName = userMap[r.owner_id] || "Unknown";
    const wins      = r.settings?.wins||0;
    const losses    = r.settings?.losses||0;
    const pf        = (r.settings?.fpts||0).toFixed(1);
    const pa        = (r.settings?.fpts_against||0).toFixed(1);
    const maxpf     = r.maxPF.toFixed(1);
    const power     = r.power.toFixed(1);
    const waiver    = r.waiver;
    // Last game
    let lastStr = "—";
    const oppId = lastOppMap[r.owner_id];
    if (oppId && lastScoreMap[r.owner_id]) {
      const sc = lastScoreMap[r.owner_id];
      lastStr = `${userMap[oppId]||oppId} (${sc.pts}-${sc.oppPts})`;
    }
    rows += `<tr>
      <td>${i+1}</td>
      <td><a href="teams.html#${r.owner_id}">${ownerName}</a></td>
      <td>${wins}-${losses}</td>
      <td>${pf}</td>
      <td>${pa}</td>
      <td>${maxpf}</td>
      <td>${power}</td>
      <td>${waiver}</td>
      <td>${lastStr}</td>
      <td>—</td>
    </tr>`;
  });

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Standings</th><th>Team</th><th>W-L</th>
          <th>PF</th><th>PA</th><th>Max PF</th>
          <th>Power Score</th><th>Waiver</th><th>Last</th><th>Next</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  console.log("[DEBUG] fetchStandings() completed render");
}

// Re‐run standings when sort changes
const sortEl = document.getElementById("standings-sort");
if (sortEl) sortEl.addEventListener("change", fetchStandings);

// ——————————————————————————————————
// Waivers + Events Unified (Firestore + Sleeper)
// ——————————————————————————————————
async function loadEvents() {
  const container = document.getElementById("event-log");
  if (!container) return;

  // Listen for Firestore events/polls/rules
  db.collection("events")
    .orderBy("timestamp","desc")
    .limit(20)
    .onSnapshot(async snap => {
      const docs = snap.docs.map(d => {
        const e = d.data();
        return {
          ts:  e.timestamp.toDate(),
          user: e.user||"Commissioner",
          action: e.desc,
          type:   e.type
        };
      });

      // Also fetch latest 5 waivers
      const txns = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/1`)
                        .then(r=>r.json());
      const adds  = txns.filter(t=>t.type==="waiver"&&t.adds).slice(0,5);
      const drops = txns.filter(t=>t.type==="waiver"&&t.drops).slice(0,5);
      adds.forEach(t => {
        Object.keys(t.adds).forEach(pid => {
          docs.push({
            ts:    new Date(t.timestamp || Date.now()), 
            user:  t.created_by||"Unknown",
            action:`📥 Added ${pid}`,
            type:  "waiver"
          });
        });
      });
      drops.forEach(t => {
        Object.keys(t.drops).forEach(pid => {
          docs.push({
            ts:    new Date(t.timestamp || Date.now()),
            user:  t.created_by||"Unknown",
            action:`❌ Dropped ${pid}`,
            type:  "waiver"
          });
        });
      });

      // Sort all by timestamp desc
      docs.sort((a,b)=>b.ts - a.ts);

      // Render table
      container.innerHTML = `
        <table>
          <thead><tr>
            <th>Date</th><th>User</th><th>Action</th><th>Type</th>
          </tr></thead>
          <tbody>
            ${docs.map(e=>`
              <tr>
                <td>${e.ts.toLocaleString()}</td>
                <td>${e.user}</td>
                <td>${e.action}</td>
                <td>${e.type}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`;
    });
}

// ——————————————————————————————————
// Polls, Rules, Teams, Analysis — stubs kept for completeness
// ——————————————————————————————————
// (Ensure these exist to avoid missing fn errors)
function loadPolls(){/* ... */} 
function loadRules(){/* ... */}
function fetchWaivers(){/* ... */}
function fetchMatchups(){/* ... */}
async function fetchTeams(){/* ... */}
function analyzeTrade(){/* ... */}
function drawTrendChart(){/* ... */}
function drawAgeCurve(){/* ... */}

// ——————————————————————————————————
// INIT on Load
// ——————————————————————————————————
window.addEventListener("load", () => {
  fetchLeagueInfo();
  fetchStandings();
  loadEvents();
});
