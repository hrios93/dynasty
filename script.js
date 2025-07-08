// script.js

/* =======================================
   GLOBAL SETUP (Firebase, Dark Mode, Auth)
   ======================================= */
firebase.initializeApp({
  apiKey:    "AIzaSyBTY-rF1jHLFyPjtQ5NVNTKAO7_9ts8MjI",
  authDomain:"dynastyboard.firebaseapp.com",
  projectId: "dynastyboard"
});
const db   = firebase.firestore();
const auth = firebase.auth();

// Dark Mode init + toggle
(function(){
  const stored = localStorage.getItem("darkMode"),
        pref   = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.body.classList.toggle("dark", stored==="true" || (stored===null && pref));
})();
document.querySelectorAll("#theme-toggle").forEach(btn =>
  btn.onclick = () => {
    const on = document.body.classList.toggle("dark");
    localStorage.setItem("darkMode", on);
  }
);

// Auth helpers
let currentUser = null;
function startLogin() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout()     { auth.signOut(); }
auth.onAuthStateChanged(u => {
  currentUser = u;
  const lb = document.getElementById("login-btn"),
        lo = document.getElementById("logout-btn"),
        ui = document.getElementById("user-info");
  if (lb && lo && ui) {
    lb.style.display = u ? "none" : "inline";
    lo.style.display = u ? "inline" : "none";
    ui.innerText    = u ? `Hello, ${u.displayName}` : "";
  }
  loadRules();
  loadPolls();
  loadEvents();
});
window.startLogin = startLogin;
window.logout     = logout;

// Utility: toggle any section by ID
function toggleSection(id) {
  const e = document.getElementById(id);
  if (!e) return;
  e.style.display = e.style.display === "none" ? "block" : "none";
}
window.toggleSection = toggleSection;

// League IDs
const leagueId         = "1180208789911158784";
const fallbackLeagueId = "1048313545995296768";

// Keep the current‐season rosters here for Teams rendering
let _rostersCurr = [];


/* =======================================
   HOME PAGE LOGIC: League Info, Standings, Events
   ======================================= */
async function fetchLeagueInfo() {
  const el = document.getElementById("league-data");
  if (!el) return;
  try {
    const d = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`)
                        .then(r => r.json());
    el.innerText = `${d.name} • Season ${d.season} • ${d.total_rosters} Teams`;
  } catch (e) {
    console.error("League Info Error:", e);
  }
}

async function fetchStandings() {
  console.log("[DEBUG] fetchStandings() called");
  const el = document.getElementById("standings-data");
  if (!el) return console.log("[DEBUG] No standings container");

  const liveRs = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`)
                        .then(r => r.json());
  const waiverMap = Object.fromEntries(
    liveRs.map(r => [r.owner_id, r.settings?.waiver_position || 0])
  );

  let lid = leagueId;
  let [rs, us] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${lid}/rosters`).then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${lid}/users`).then(r=>r.json())
  ]);
  if (rs.every(r => (r.settings?.wins||0)+(r.settings?.losses||0) === 0)) {
    console.log("[DEBUG] No games this season; fallback to 2024");
    lid = fallbackLeagueId;
    [rs, us] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${lid}/rosters`).then(r=>r.json()),
      fetch(`https://api.sleeper.app/v1/league/${lid}/users`).then(r=>r.json())
    ]);
  }

  const userMap       = Object.fromEntries(us.map(u=>[u.user_id, u.display_name]));
  const rosterToOwner = Object.fromEntries(rs.map(r=>[r.roster_id, r.owner_id]));

  let lastOppMap={}, lastScoreMap={};
  for (let wk = 18; wk >= 1; wk--) {
    try {
      const mups = await fetch(`https://api.sleeper.app/v1/league/${fallbackLeagueId}/matchups/${wk}`)
        .then(r => r.ok ? r.json() : []);
      if (mups.length) {
        console.log(`[DEBUG] Using fallback week ${wk}`);
        const games = {};
        mups.forEach(m => {
          games[m.matchup_id] = (games[m.matchup_id]||[]).concat(m);
        });
        Object.values(games).forEach(pair => {
          if (pair.length===2) {
            const [a,b] = pair;
            const oa = rosterToOwner[a.roster_id],
                  ob = rosterToOwner[b.roster_id];
            lastOppMap[oa]=ob; lastOppMap[ob]=oa;
            lastScoreMap[oa]={pts:a.points, oppPts:b.points};
            lastScoreMap[ob]={pts:b.points, oppPts:a.points};
          }
        });
        break;
      }
    } catch(e) {
      console.warn("Matchup fetch error wk",wk,e);
    }
  }

  rs.forEach(r=>{
    r.power  = (r.settings?.fpts||0) + (r.settings?.wins||0)*20;
    r.maxPF  = r.settings?.fpts_max||0;
    r.waiver = waiverMap[r.owner_id]||0;
  });

  const sortBy = document.getElementById("standings-sort")?.value||"rank";
  rs.sort((a,b)=>{
    switch(sortBy){
      case 'pf':    return (b.settings?.fpts||0)-(a.settings?.fpts||0);
      case 'pa':    return (a.settings?.fpts_against||0)-(b.settings?.fpts_against||0);
      case 'maxpf': return b.maxPF - a.maxPF;
      case 'power': return b.power - a.power;
      case 'waiver':return a.waiver - b.waiver;
      default:      return ((b.settings?.wins||0)-(a.settings?.wins||0))||
                           ((b.settings?.fpts||0)-(a.settings?.fpts||0));
    }
  });

  let rows="";
  rs.forEach((r,i)=>{
    const name = userMap[r.owner_id]||"Unknown";
    const w=r.settings?.wins||0, l=r.settings?.losses||0;
    const pf=(r.settings?.fpts||0).toFixed(1),
          pa=(r.settings?.fpts_against||0).toFixed(1),
          mp=r.maxPF.toFixed(1),
          ps=r.power.toFixed(1),
          wv=r.waiver;
    let lastStr="—";
    const opp = lastOppMap[r.owner_id];
    if(opp && lastScoreMap[r.owner_id]){
      const sc = lastScoreMap[r.owner_id];
      lastStr = `${userMap[opp]||opp} (${sc.pts}-${sc.oppPts})`;
    }
    rows+=`<tr>
      <td>${i+1}</td>
      <td><a href="teams.html#${r.owner_id}">${name}</a></td>
      <td>${w}-${l}</td><td>${pf}</td><td>${pa}</td>
      <td>${mp}</td><td>${ps}</td><td>${wv}</td>
      <td>${lastStr}</td><td>—</td>
    </tr>`;
  });

  document.getElementById("standings-data").innerHTML=`
    <table>
      <thead>
        <tr>
          <th>Standings</th><th>Team</th><th>W-L</th>
          <th>PF</th><th>PA</th><th>Max PF</th>
          <th>Power Score</th><th>Waiver</th>
          <th>Last</th><th>Next</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  console.log("[DEBUG] fetchStandings() done");
}
const sortEl = document.getElementById("standings-sort");
if (sortEl) sortEl.addEventListener("change", fetchStandings);

async function loadEvents(){
  const c = document.getElementById("event-log");
  if(!c) return;
  const [players, users] = await Promise.all([
    fetch("https://api.sleeper.app/v1/players/nfl").then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r=>r.json())
  ]);
  const userMap = Object.fromEntries(users.map(u=>[u.user_id,u.display_name]));
  db.collection("events").orderBy("timestamp","desc").limit(20)
    .onSnapshot(async snap=>{
      let docs = snap.docs.map(d=>{
        const e = d.data();
        return {
          ts: e.timestamp.toDate(),
          user: e.user||"Commissioner",
          action: e.desc,
          type: e.type
        };
      });
      const txns = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/1`)
        .then(r=>r.json());
      txns.forEach(t=>{
        if(t.type==="waiver"){
          for(let pid in t.adds){
            docs.push({
              ts: new Date(t.created),
              user: userMap[t.creator]||t.creator,
              action: `📥 ${players[pid]?.full_name||pid}`,
              type: "waiver"
            });
          }
          for(let pid in t.drops){
            docs.push({
              ts: new Date(t.created),
              user: userMap[t.creator]||t.creator,
              action: `❌ ${players[pid]?.full_name||pid}`,
              type: "waiver"
            });
          }
        }
        if(t.type==="trade"){
          docs.push({
            ts: new Date(t.created),
            user: userMap[t.creator]||t.creator,
            action: "🛠️ Trade executed",
            type: "trade"
          });
        }
      });
      docs.sort((a,b)=>b.ts - a.ts);
      c.innerHTML = `
        <table>
          <thead>
            <tr><th>Date</th><th>User</th><th>Action</th><th>Type</th></tr>
          </thead>
          <tbody>
            ${docs.map(e=>`
              <tr>
                <td>${e.ts.toLocaleString()}</td>
                <td>${e.user}</td>
                <td>${e.action}</td>
                <td>${e.type}</td>
              </tr>`).join("")}
          </tbody>
        </table>`;
    });
}


/* =======================================
   TEAMS PAGE LOGIC START
   ======================================= */

/** ordinal helper **/
function ordinal(n) {
  const s=["th","st","nd","rd"], v=n%100;
  return n + (s[(v-20)%10]||s[v]||s[0]);
}

async function fetchTeams() {
  const sel  = document.getElementById("team-selector"),
        cont = document.getElementById("team-pages");
  if (!sel||!cont) return;

  // Fetch 2025,2024,2023 rosters + users + players
  const [users, rosters25, rosters24, rosters23, players] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${fallbackLeagueId}/rosters`).then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/918655311878270976/rosters`).then(r=>r.json()),
    fetch("https://api.sleeper.app/v1/players/nfl").then(r=>r.json())
  ]);

  // Save current‐season rosters for rendering
  _rostersCurr = rosters25;

  // Build metric aggregates & ranks
  // ... your all-time code here (unchanged) ...

  // Render avatar‐tabs
  users.sort((a,b)=>a.display_name.localeCompare(b.display_name));
  sel.innerHTML = users.map(u=>{
    const r = rosters25.find(x=>x.owner_id===u.user_id)||{};
    const avatar = u.avatar
      ? `<img class="avatar" src="https://sleepercdn.com/avatars/thumbs/${u.avatar}">`
      : `<div class="avatar"></div>`;
    const name = r.metadata?.team_name||u.display_name;
    return `<div class="team-tab" data-user="${u.user_id}">
      ${avatar}<div class="tab-label">${name}</div>
    </div>`;
  }).join("");

  // Tab click handler
  const tabs = sel.querySelectorAll(".team-tab");
  tabs.forEach(tab=>{
    tab.onclick = ()=>{
      tabs.forEach(t=>t.classList.remove("active"));
      tab.classList.add("active");
      renderTeamPage(tab.dataset.user, /*pass metrics & ranks*/);
    };
  });
  if(tabs[0]) tabs[0].click();
}

function renderTeamPage(userId /*, metrics, ranks*/) {
  const cont = document.getElementById("team-pages"),
        r    = _rostersCurr.find(x=>x.owner_id===userId);
  if(!r) return cont.innerHTML="<p>No roster found.</p>";

  // Stats + roster grouping (as before)...
  cont.innerHTML = /* your snapshot + stats + roster HTML */;
}

// =======================================
// INITIAL PAGE LOAD
// =======================================
window.addEventListener("load", () => {
  fetchLeagueInfo();
  fetchStandings();
  loadEvents();
  if (document.getElementById("team-selector")) {
    fetchTeams();
  }
});

// =======================================
// STUBS FOR OTHER PAGES
// =======================================
function loadPolls(){}
function loadRules(){}
function analyzeTrade(){}
function drawTrendChart(){}
function drawAgeCurve(){}
