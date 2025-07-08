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
// League IDs
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

  // 1) Live waiver positions
  const currentRs = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`)
                          .then(r=>r.json());
  const waiverMap = Object.fromEntries(
    currentRs.map(r=>[r.owner_id, r.settings?.waiver_position||0])
  );

  // 2) Fetch rosters & users, fallback if no games yet
  let lid = leagueId;
  let [rs, us] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${lid}/rosters`).then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${lid}/users`).then(r=>r.json())
  ]);
  if(rs.every(r=> (r.settings?.wins||0)+(r.settings?.losses||0) ===0)){
    console.log("[DEBUG] No games this season; using 2024 data");
    lid = fallbackLeagueId;
    [rs, us] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${lid}/rosters`).then(r=>r.json()),
      fetch(`https://api.sleeper.app/v1/league/${lid}/users`).then(r=>r.json())
    ]);
  }

  const userMap       = Object.fromEntries(us.map(u=>[u.user_id,u.display_name]));
  const rosterToOwner = Object.fromEntries(rs.map(r=>[r.roster_id,r.owner_id]));

  // 3) Find last played matchup from last season
  let lastOppMap={}, lastScoreMap={};
  for(let wk=18; wk>=1; wk--){
    try{
      const mups = await fetch(`https://api.sleeper.app/v1/league/${fallbackLeagueId}/matchups/${wk}`)
                           .then(r=>r.ok?r.json():[]);
      if(Array.isArray(mups) && mups.length){
        console.log(`[DEBUG] Using last matchup from week ${wk}`);
        const games = {};
        mups.forEach(m=>{
          games[m.matchup_id]=(games[m.matchup_id]||[]).concat(m);
        });
        Object.values(games).forEach(pair=>{
          if(pair.length===2){
            const [a,b]=pair;
            const oa=rosterToOwner[a.roster_id], ob=rosterToOwner[b.roster_id];
            lastOppMap[oa]=ob; lastOppMap[ob]=oa;
            lastScoreMap[oa]={pts:a.points,oppPts:b.points};
            lastScoreMap[ob]={pts:b.points,oppPts:a.points};
          }
        });
        break;
      }
    }catch(e){
      console.warn("Matchups fetch error wk",wk,e);
    }
  }

  // 4) Compute metrics
  rs.forEach(r=>{
    r.power  =(r.settings?.fpts||0)+ (r.settings?.wins||0)*20;
    r.maxPF  =r.settings?.fpts_max||0;
    r.waiver =waiverMap[r.owner_id]||0;
  });

  // 5) Sort
  const sortBy = document.getElementById("standings-sort")?.value||"rank";
  console.log("[DEBUG] Sorting by:", sortBy);
  rs.sort((a,b)=>{
    switch(sortBy){
      case 'pf':    return (b.settings?.fpts||0)-(a.settings?.fpts||0);
      case 'pa':    return (a.settings?.fpts_against||0)-(b.settings?.fpts_against||0);
      case 'maxpf': return b.maxPF - a.maxPF;
      case 'power': return b.power - a.power;
      case 'waiver':return a.waiver - b.waiver;
      default:      return ((b.settings?.wins||0)-(a.settings?.wins||0))||((b.settings?.fpts||0)-(a.settings?.fpts||0));
    }
  });

  // 6) Render table
  let rows="";
  rs.forEach((r,i)=>{
    const name = userMap[r.owner_id]||"Unknown";
    const w=r.settings?.wins||0, l=r.settings?.losses||0;
    const pf=(r.settings?.fpts||0).toFixed(1);
    const pa=(r.settings?.fpts_against||0).toFixed(1);
    const mp=r.maxPF.toFixed(1), ps=r.power.toFixed(1);
    const wv=r.waiver;
    let lastStr="—";
    const opp=lastOppMap[r.owner_id];
    if(opp && lastScoreMap[r.owner_id]){
      const sc=lastScoreMap[r.owner_id];
      lastStr=`${userMap[opp]||opp} (${sc.pts}-${sc.oppPts})`;
    }
    rows+=`<tr>
      <td>${i+1}</td>
      <td><a href="teams.html#${r.owner_id}">${name}</a></td>
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

  el.innerHTML=`<table>
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

// re-run on sort change
const sortEl = document.getElementById("standings-sort");
if(sortEl) sortEl.addEventListener("change", fetchStandings);

// ——————————————————————————————————
// Unified League Events (Firestore + Waivers + Trades)
// ——————————————————————————————————
async function loadEvents(){
  const container = document.getElementById("event-log");
  if(!container) return;

  // Preload player & user maps
  const [players, users] = await Promise.all([
    fetch("https://api.sleeper.app/v1/players/nfl").then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r=>r.json())
  ]);
  const userMap = Object.fromEntries(users.map(u=>[u.user_id,u.display_name]));

  // Listen Firestore events
  db.collection("events")
    .orderBy("timestamp","desc")
    .limit(20)
    .onSnapshot(async snap=>{
      let docs = snap.docs.map(d=>{
        const e = d.data();
        return { ts:e.timestamp.toDate(), user:e.user||"Commissioner", action:e.desc, type:e.type };
      });

      // Fetch recent transactions
      const txns = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/1`)
                        .then(r=>r.json());

      // Waiver entries
      txns.filter(t=>t.type==="waiver").forEach(t=>{
        for(let pid in t.adds){
          docs.push({
            ts: new Date(t.created),
            user: userMap[t.creator]||t.creator,
            action:`📥 ${players[pid]?.full_name||pid}`,
            type:"waiver"
          });
        }
        for(let pid in t.drops){
          docs.push({
            ts: new Date(t.created),
            user: userMap[t.creator]||t.creator,
            action:`❌ ${players[pid]?.full_name||pid}`,
            type:"waiver"
          });
        }
      });

      // Trade entries
      txns.filter(t=>t.type==="trade").forEach(t=>{
        docs.push({
          ts: new Date(t.created),
          user: userMap[t.creator]||t.creator,
          action:"🛠️ Trade executed",
          type:"trade"
        });
      });

      // Sort by timestamp desc
      docs.sort((a,b)=>b.ts - a.ts);

      // Render table
      container.innerHTML = `<table>
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
            </tr>`).join("")}
        </tbody>
      </table>`;
    });
}

// Stubs to avoid console errors on other pages
function loadPolls(){}
function loadRules(){}
function fetchTeams(){}
function analyzeTrade(){}
function drawTrendChart(){}
function drawAgeCurve(){}

// ——————————————————————————————————
// Initialization
// ——————————————————————————————————
window.addEventListener("load",()=>{
  fetchLeagueInfo();
  fetchStandings();
  loadEvents();
});
