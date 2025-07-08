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

let currentUser = null;
function startLogin(){ auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout(){ auth.signOut(); }
auth.onAuthStateChanged(u=>{
  currentUser = u;
  const lb = document.getElementById("login-btn"),
        lo = document.getElementById("logout-btn"),
        ui = document.getElementById("user-info");
  if(lb && lo && ui){
    lb.style.display = u?"none":"inline";
    lo.style.display = u?"inline":"none";
    ui.innerText    = u?`Hello, ${u.displayName}`:"";
  }
  loadRules();
  loadPolls();
  loadEvents();
});
window.startLogin = startLogin;
window.logout     = logout;

// Dark Mode init + toggle
(function(){
  const stored = localStorage.getItem("darkMode"),
        pref   = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.body.classList.toggle("dark", stored==="true" || (stored===null && pref));
})();
document.querySelectorAll("#theme-toggle").forEach(btn=>
  btn.onclick = ()=>{
    const on = document.body.classList.toggle("dark");
    localStorage.setItem("darkMode", on);
  }
);

// Utility: Toggle element by ID
function toggleSection(id){
  const e = document.getElementById(id);
  if(!e) return;
  e.style.display = e.style.display==="none"?"block":"none";
}
window.toggleSection = toggleSection;

// League IDs
const leagueId         = "1180208789911158784";
const fallbackLeagueId = "1048313545995296768";


/* =======================================
   HOME PAGE: League Info, Standings, Events
   ======================================= */
async function fetchLeagueInfo(){
  const el = document.getElementById("league-data");
  if(!el) return;
  try {
    const d = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`).then(r=>r.json());
    el.innerText = `${d.name} • Season ${d.season} • ${d.total_rosters} Teams`;
  } catch(e){ console.error("League Info Error:", e); }
}

async function fetchStandings(){
  console.log("[DEBUG] fetchStandings() called");
  const el = document.getElementById("standings-data");
  if(!el) return console.log("[DEBUG] No standings container");

  // Always get the live waiver positions
  const liveRs = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`)
                       .then(r=>r.json());
  const waiverMap = Object.fromEntries(liveRs.map(r=>[r.owner_id,r.settings?.waiver_position||0]));

  // Fetch rosters + users, fallback if nobody's played yet
  let lid = leagueId;
  let [rs, us] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${lid}/rosters`).then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${lid}/users`).then(r=>r.json())
  ]);
  if(rs.every(r=>(r.settings?.wins||0)+(r.settings?.losses||0)===0)){
    console.log("[DEBUG] No games this season; using 2024 data");
    lid = fallbackLeagueId;
    [rs, us] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${lid}/rosters`).then(r=>r.json()),
      fetch(`https://api.sleeper.app/v1/league/${lid}/users`).then(r=>r.json())
    ]);
  }

  const userMap       = Object.fromEntries(us.map(u=>[u.user_id,u.display_name]));
  const rosterToOwner = Object.fromEntries(rs.map(r=>[r.roster_id,r.owner_id]));

  // Find last-played week on fallback league
  let lastOppMap={}, lastScoreMap={};
  for(let wk=18; wk>=1; wk--){
    try{
      const mups = await fetch(`https://api.sleeper.app/v1/league/${fallbackLeagueId}/matchups/${wk}`)
                           .then(r=>r.ok?r.json():[]);
      if(mups.length){
        console.log(`[DEBUG] Using fallback week ${wk} matchups`);
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
    } catch(e){
      console.warn("Matchup fetch error wk",wk,e);
    }
  }

  // Compute metrics
  rs.forEach(r=>{
    r.power    = (r.settings?.fpts||0) + (r.settings?.wins||0)*20;
    r.maxPF    = r.settings?.fpts_max||0;
    r.waiver   = waiverMap[r.owner_id]||0;
  });

  // Sort by dropdown
  const sortBy = document.getElementById("standings-sort")?.value||"rank";
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

  // Render table
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
      <td>${i+1}</td><td><a href="teams.html#${r.owner_id}">${name}</a></td>
      <td>${w}-${l}</td><td>${pf}</td><td>${pa}</td>
      <td>${mp}</td><td>${ps}</td><td>${wv}</td>
      <td>${lastStr}</td><td>—</td>
    </tr>`;
  });
  document.getElementById("standings-data").innerHTML=`
    <table>
      <thead><tr>
        <th>Standings</th><th>Team</th><th>W-L</th>
        <th>PF</th><th>PA</th><th>Max PF</th>
        <th>Power Score</th><th>Waiver</th>
        <th>Last</th><th>Next</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  console.log("[DEBUG] fetchStandings() done");
}
const sortEl = document.getElementById("standings-sort");
if(sortEl) sortEl.addEventListener("change", fetchStandings);

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
        return {ts:e.timestamp.toDate(),user:e.user||"Commissioner",action:e.desc,type:e.type};
      });
      const txns = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/1`)
                         .then(r=>r.json());
      txns.forEach(t=>{
        if(t.type==="waiver"){
          for(let pid in t.adds){
            docs.push({ts:new Date(t.created),user:userMap[t.creator]||t.creator,
                       action:`📥 ${players[pid]?.full_name||pid}`,type:"waiver"});
          }
          for(let pid in t.drops){
            docs.push({ts:new Date(t.created),user:userMap[t.creator]||t.creator,
                       action:`❌ ${players[pid]?.full_name||pid}`,type:"waiver"});
          }
        }
        if(t.type==="trade"){
          docs.push({ts:new Date(t.created),user:userMap[t.creator]||t.creator,
                     action:"🛠️ Trade executed",type:"trade"});
        }
      });
      docs.sort((a,b)=>b.ts - a.ts);
      c.innerHTML = `
        <table>
          <thead><tr><th>Date</th><th>User</th><th>Action</th><th>Type</th></tr></thead>
          <tbody>${docs.map(e=>`
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

// =======================================
// === TEAMS PAGE LOGIC START ===

/**
 * Utility to turn a number into its ordinal (1→“1st”, 2→“2nd”, 3→“3rd”, 4→“4th”, etc.)
 */
function ordinal(n) {
  const s=["th","st","nd","rd"],
        v=n%100;
  return n + (s[(v-20)%10]||s[v]||s[0]);
}

async function fetchTeams() {
  const sel  = document.getElementById("team-selector"),
        cont = document.getElementById("team-pages");
  if (!sel || !cont) return;

  // 1) Load all needed data
  const [users, rosters25, rosters24, rosters23, players] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${fallbackLeagueId}/rosters`).then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/918655311878270976/rosters`).then(r=>r.json()),
    fetch("https://api.sleeper.app/v1/players/nfl").then(r=>r.json())
  ]);

  // Map for quick user lookup
  const userMap = Object.fromEntries(users.map(u=>[u.user_id, u]));

  // 2) Build per-season ranking maps
  const seasons = [
    { year:2025, data:rosters25 },
    { year:2024, data:rosters24 },
    { year:2023, data:rosters23 }
  ];
  const seasonRankMaps = seasons.map(s => {
    const sorted = [...s.data].sort((a,b)=>{
      const aw=a.settings?.wins||0, bw=b.settings?.wins||0;
      if(bw!==aw) return bw-aw;
      return (b.settings?.fpts||0)-(a.settings?.fpts||0);
    });
    return Object.fromEntries(sorted.map((r,i)=>[r.owner_id,i+1]));
  });

  // 3) Aggregate “all-time” metrics
  const metrics = {}; // owner_id → { winsSum, lossesSum, tiesSum, pfSum, paSum, gamesSum, avgPF, bestFinish, worstFinish }
  users.forEach(u => {
    metrics[u.user_id] = {
      winsSum:0, lossesSum:0, tiesSum:0,
      pfSum:0, paSum:0,
      bestFinish: Infinity, worstFinish: 0
    };
  });
  seasons.forEach((s, idx) => {
    s.data.forEach(r => {
      const m = metrics[r.owner_id];
      const w = r.settings?.wins||0,
            l = r.settings?.losses||0,
            t = r.settings?.ties||0,
            pf= r.settings?.fpts||0,
            pa= r.settings?.fpts_against||0;
      m.winsSum    += w;
      m.lossesSum  += l;
      m.tiesSum    += t;
      m.pfSum      += pf;
      m.paSum      += pa;
      const rank = seasonRankMaps[idx][r.owner_id]||(seasons[idx].data.length);
      m.bestFinish = Math.min(m.bestFinish, rank);
      m.worstFinish= Math.max(m.worstFinish, rank);
    });
  });
// finalize games & avgPF
  Object.values(metrics).forEach(m => {
    m.gamesSum = m.winsSum + m.lossesSum + m.tiesSum;
    m.avgPF    = m.gamesSum ? m.pfSum / m.gamesSum : 0;
  });

  // 4) Compute rank‐maps for each metric
  const ownerIds = users.map(u=>u.user_id);
  const recordRankMap = Object.fromEntries(
    [...ownerIds].sort((a,b)=>metrics[b].winsSum - metrics[a].winsSum)
                  .map((id,i)=>[id,i+1])
  );
  const pfRankMap = Object.fromEntries(
    [...ownerIds].sort((a,b)=>metrics[b].pfSum - metrics[a].pfSum)
                  .map((id,i)=>[id,i+1])
  );
  const paRankMap = Object.fromEntries(
    [...ownerIds].sort((a,b)=>metrics[a].paSum - metrics[b].paSum)
                  .map((id,i)=>[id,i+1])
  );
  const avgRankMap = Object.fromEntries(
    [...ownerIds].sort((a,b)=>metrics[b].avgPF - metrics[a].avgPF)
                  .map((id,i)=>[id,i+1])
  );
  const bestFinishRankMap = Object.fromEntries(
    [...ownerIds].sort((a,b)=>metrics[a].bestFinish - metrics[b].bestFinish)
                  .map((id,i)=>[id,i+1])
  );
  const worstFinishRankMap = Object.fromEntries(
    [...ownerIds].sort((a,b)=>metrics[b].worstFinish - metrics[a].worstFinish)
                  .map((id,i)=>[id,i+1])
  );

  // 5) Render selector (avatar + name)
  users.sort((a,b)=>a.display_name.localeCompare(b.display_name));
  sel.innerHTML = users.map(u=>{
    const r = rosters25.find(x=>x.owner_id===u.user_id) || {};
    const avatar = u.avatar
      ? `<img class="avatar" src="https://sleepercdn.com/avatars/thumbs/${u.avatar}">`
      : `<div class="avatar"></div>`;
    const name = r.metadata?.team_name || u.display_name;
    return `<div class="team-tab" data-user="${u.user_id}">
      ${avatar}<div class="tab-label">${name}</div>
    </div>`;
  }).join("");

  // 6) Wire up clicks
  const tabs = sel.querySelectorAll(".team-tab");
  tabs.forEach(tab=>{
    tab.onclick = ()=>{
      tabs.forEach(t=>t.classList.remove("active"));
      tab.classList.add("active");
      renderTeamPage(tab.dataset.user, userMap, players,
                     metrics, {
                       record: recordRankMap,
                       pf: pfRankMap,
                       pa: paRankMap,
                       avg: avgRankMap,
                       best: bestFinishRankMap,
                       worst: worstFinishRankMap
                     });
    };
  });
  if(tabs[0]) tabs[0].click();
}

function renderTeamPage(userId, userMap, players, metrics, ranks){
  const cont = document.getElementById("team-pages"),
        m    = metrics[userId];
  if(!m) return cont.innerHTML="<p>No data.</p>";

  // Build the All-Time Snapshot
  const snapshotHTML = `
    <div class="team-alltime">
      <h3>All-Time Snapshot</h3>
      <ul>
        <li>Record: ${m.winsSum}-${m.lossesSum}-${m.tiesSum}
            (${ordinal(ranks.record[userId])})</li>
        <li>Total PF: ${m.pfSum.toFixed(1)}
            (${ordinal(ranks.pf[userId])})</li>
        <li>Total PA: ${m.paSum.toFixed(1)}
            (${ordinal(ranks.pa[userId])})</li>
        <li>Avg PF/Game: ${m.avgPF.toFixed(1)}
            (${ordinal(ranks.avg[userId])})</li>
        <li>Best Finish: ${m.bestFinish}
            (${ordinal(ranks.best[userId])})</li>
        <li>Worst Finish: ${m.worstFinish}
            (${ordinal(ranks.worst[userId])})</li>
        <li>Championships Won: <!-- manual count needed --> 0 (—)</li>
        <li>Waiver Pickups: <!-- placeholder --> 0 (—)</li>
        <li>Trades Executed: <!-- placeholder --> 0 (—)</li>
        <li>Playoff Appearances: <!-- placeholder --> 0 (—)</li>
        <li>Playoff Record: <!-- placeholder --> 0-0 (—)</li>
      </ul>
    </div>`;

  // Then your existing stats + roster…
  const statsR = _rostersCurr.find(r=>r.owner_id===userId),
        w = statsR.settings?.wins||0,
        l = statsR.settings?.losses||0,
        t = statsR.settings?.ties||0,
        pf= (statsR.settings?.fpts||0).toFixed(1),
        pa= (statsR.settings?.fpts_against||0).toFixed(1);

  const statsHTML = `
    <div class="team-stats">
      <p><strong>${userMap[userId].display_name}</strong></p>
      <p>Record: ${w}-${l}-${t}</p>
      <p>For / Agst: ${pf} / ${pa}</p>
    </div>`;

  // Roster grouping (as before)…
  const groups = {};
  _rostersCurr.find(r=>r.owner_id===userId).players
    .forEach(pid=>{
      const p = players[pid]||{full_name:pid,position:"UNK"};
      (groups[p.position]=groups[p.position]||[]).push(p.full_name);
    });
  const order=["QB","RB","WR","TE","FLEX","DST","K","BENCH","TAXI"];
  const rosterHtml = order.map(pos=>{
    if(!groups[pos]) return "";
    return `<div class="position-group">
      <h3>${pos}</h3>
      <ul>${groups[pos].map(n=>`<li>${n}</li>`).join("")}</ul>
    </div>`;
  }).join("");

  cont.innerHTML = snapshotHTML + statsHTML + rosterHtml;
}

// Initialize on load
window.addEventListener("load", ()=>{
  if(document.getElementById("team-selector")) fetchTeams();
});

// === TEAMS PAGE LOGIC END ===

/* =======================================
   STUBS FOR RULES, POLLS, ANALYSIS PAGES
   ======================================= */
function loadPolls(){}
function loadRules(){}
function analyzeTrade(){}
function drawTrendChart(){}
function drawAgeCurve(){}
