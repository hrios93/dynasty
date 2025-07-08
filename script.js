// script.js

// ——————————————————————————————————
// Firebase & App Initialization
// ——————————————————————————————————
firebase.initializeApp({
  apiKey:    "AIzaSyBTY-rF1jHLFyPjtQ5NVNTKAO7_9ts8MjI",
  authDomain:"dynastyboard.firebaseapp.com",
  projectId: "dynastyboard"
});
const db   = firebase.firestore();
const auth = firebase.auth();

// ——————————————————————————————————
// Auth (Google Popup)
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
  const stored  = localStorage.getItem("darkMode");
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
// League IDs & Config
// ——————————————————————————————————
const leagueId         = "1180208789911158784";
const fallbackLeagueId = "1048313545995296768";

// ——————————————————————————————————
// FETCH: League Info
// ——————————————————————————————————
async function fetchLeagueInfo(){
  const el = document.getElementById("league-data");
  if(!el) return;
  try {
    const d = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`)
                    .then(r=>r.json());
    el.innerText = `${d.name} • Season ${d.season} • ${d.total_rosters} Teams`;
  } catch(e){
    console.error("League Info Error:", e);
  }
}

// ——————————————————————————————————
// FETCH: Standings + Upcoming + Power Scores
// ——————————————————————————————————
async function fetchStandings(){
  console.log("[DEBUG] fetchStandings() called");
  const el = document.getElementById("standings-data");
  if(!el){
    console.log("[DEBUG] #standings-data element not found");
    return;
  }

  // Always get live waiver positions
  let currentRosters = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`)
                                .then(r=>r.json());
  const waiverMap = Object.fromEntries(
    currentRosters.map(r=>[r.owner_id, r.settings?.waiver_position||0])
  );

  // Fetch rosters & users; fallback to last season if nobody has played
  let lid = leagueId;
  let [rs, us] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${lid}/rosters`).then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${lid}/users`).then(r=>r.json())
  ]);
  // if all 0-0, switch
  if(rs.every(r=> (r.settings?.wins||0)+(r.settings?.losses||0) === 0)){
    console.log("[DEBUG] No games this season; switching to 2024 data");
    lid = fallbackLeagueId;
    [rs, us] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${lid}/rosters`).then(r=>r.json()),
      fetch(`https://api.sleeper.app/v1/league/${lid}/users`).then(r=>r.json())
    ]);
  }

  const userMap       = Object.fromEntries(us.map(u=>[u.user_id, u.display_name]));
  const rosterToOwner = Object.fromEntries(rs.map(r=>[r.roster_id, r.owner_id]));

  // Find last non-empty matchup week on fallback
  let lastOppMap   = {};
  let lastScoreMap = {};
  for(let wk=18; wk>=1; wk--){
    try{
      const mups = await fetch(`https://api.sleeper.app/v1/league/${fallbackLeagueId}/matchups/${wk}`)
                           .then(r=>r.ok ? r.json() : []);
      if(Array.isArray(mups) && mups.length){
        const games = {};
        mups.forEach(m => {
          games[m.matchup_id] = games[m.matchup_id]||[];
          games[m.matchup_id].push(m);
        });
        Object.values(games).forEach(pair => {
          if(pair.length===2){
            const [a,b] = pair;
            const oa = rosterToOwner[a.roster_id];
            const ob = rosterToOwner[b.roster_id];
            lastOppMap[oa] = ob;
            lastOppMap[ob] = oa;
            lastScoreMap[oa] = { pts: a.points, oppPts: b.points };
            lastScoreMap[ob] = { pts: b.points, oppPts: a.points };
          }
        });
        console.log(`[DEBUG] Using last matchup from week ${wk}`);
        break;
      }
    } catch(e){
      console.warn("[WARN] Error fetching matchups for week", wk, e);
    }
  }

  // Compute metrics
  rs.forEach(r=>{
    r.power  = (r.settings?.fpts||0) + (r.settings?.wins||0)*20;
    r.maxPF  = r.settings?.fpts_max||0;
    r.waiver = waiverMap[r.owner_id]||0;
  });

  // Sort
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

  // Build table
  let rows = "";
  rs.forEach((r,i)=>{
    const ownerName = userMap[r.owner_id] || "Unknown";
    const w = r.settings?.wins||0, l = r.settings?.losses||0;
    const pf = (r.settings?.fpts||0).toFixed(1);
    const pa = (r.settings?.fpts_against||0).toFixed(1);
    const mp = r.maxPF.toFixed(1), ps = r.power.toFixed(1);
    const wv = r.waiver;
    // Last game
    let lastStr = "—";
    const oppId = lastOppMap[r.owner_id];
    if(oppId && lastScoreMap[r.owner_id]){
      const sc = lastScoreMap[r.owner_id];
      lastStr = `${userMap[oppId]||oppId} (${sc.pts}-${sc.oppPts})`;
    }
    rows += `<tr>
      <td>${i+1}</td>
      <td><a href="teams.html#${r.owner_id}">${ownerName}</a></td>
      <td>${w}-${l}</td>
      <td>${pf}</td>
      <td>${pa}</td>
      <td>${mp}</td>
      <td>${ps}</td>
      <td>${wv}</td>
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

// Re-run on sort change
const sortEl = document.getElementById("standings-sort");
if(sortEl) sortEl.addEventListener("change", fetchStandings);

// ——————————————————————————————————
// Unified Waiver & Events Feed
// ——————————————————————————————————
async function loadEvents(){
  const container = document.getElementById("event-log");
  if(!container) return;

  // Pre-fetch player names & user names
  const [players, users] = await Promise.all([
    fetch("https://api.sleeper.app/v1/players/nfl").then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r=>r.json())
  ]);
  const userMap = Object.fromEntries(users.map(u=>[u.user_id,u.display_name]));

  // Listen for Firestore events (rules/polls)
  db.collection("events")
    .orderBy("timestamp","desc")
    .limit(20)
    .onSnapshot(async snap=>{
      const docs = snap.docs.map(d => {
        const e = d.data();
        return {
          ts:     e.timestamp.toDate(),
          user:   e.user || "Commissioner",
          action: e.desc,
          type:   e.type
        };
      });

      // Fetch recent waiver txns
      const txns = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/1`)
                          .then(r=>r.json());
      txns.filter(t=>t.type==="waiver").slice(0,5).forEach(t=>{
        // adds
        for(const pid in t.adds){
          const ownerId = String(t.adds[pid]);
          docs.push({
            ts:     new Date(t.created),
            user:   userMap[t.creator] || t.creator,
            action: `📥 ${players[pid]?.full_name||pid}`,
            type:   "waiver"
          });
        }
        // drops
        for(const pid in t.drops){
          const ownerId = String(t.drops[pid]);
          docs.push({
            ts:     new Date(t.created),
            user:   userMap[t.creator] || t.creator,
            action: `❌ ${players[pid]?.full_name||pid}`,
            type:   "waiver"
          });
        }
      });

      // Sort and render
      docs.sort((a,b)=>b.ts - a.ts);
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
// Stubs for other pages to avoid errors
// ——————————————————————————————————
function loadPolls(){}  
function loadRules(){}  
function fetchTeams(){}  
function analyzeTrade(){}  
function drawTrendChart(){}  
function drawAgeCurve(){}

// ——————————————————————————————————
// INIT on Load
// ——————————————————————————————————
window.addEventListener("load",()=>{
  fetchLeagueInfo();
  fetchStandings();
  loadEvents();
});
