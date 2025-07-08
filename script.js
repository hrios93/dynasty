// script.js
// =======================================
// 📍 GLOBAL SETUP
// =======================================
firebase.initializeApp({
  apiKey:    "AIzaSyBTY-rF1jHLFyPjtQ5NVNTKAO7_9ts8MjI",
  authDomain:"dynastyboard.firebaseapp.com",
  projectId: "dynastyboard"
});
const db   = firebase.firestore();
const auth = firebase.auth();

// Dark Mode
(function(){
  const stored  = localStorage.getItem("darkMode");
  const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.body.classList.toggle("dark", stored==="true" || (stored===null && prefers));
})();
document.querySelectorAll("#theme-toggle").forEach(btn=>{
  btn.onclick = ()=>{
    const on = document.body.classList.toggle("dark");
    localStorage.setItem("darkMode", on);
  };
});

// Auth Helpers
let currentUser = null;
function startLogin(){
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider);
}
function logout(){
  auth.signOut();
}
auth.onAuthStateChanged(user=>{
  currentUser = user;
  const loginBtn  = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userInfo  = document.getElementById("user-info");
  if(loginBtn && logoutBtn && userInfo){
    loginBtn.style.display  = user ? "none":"inline";
    logoutBtn.style.display = user ? "inline":"none";
    userInfo.innerText      = user ? `Hello, ${user.displayName}` : "";
  }
});
window.startLogin = startLogin;
window.logout     = logout;

// Utility: Toggle any section by ID
function toggleSection(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.style.display = el.style.display==="none"?"block":"none";
}
window.toggleSection = toggleSection;

// League IDs
const leagueId         = "1180208789911158784";
const fallbackLeagueId = "1048313545995296768";

// =======================================
// 🏠 HOME PAGE LOGIC
// =======================================

// Fetch and render league info in header
async function fetchLeagueInfo(){
  const el = document.getElementById("league-data");
  if(!el) return;
  try{
    const d = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`)
                     .then(r=>r.json());
    el.innerText = `${d.name} • Season ${d.season} • ${d.total_rosters} Teams`;
  }catch(e){ console.error("League Info Error:", e); }
}

// Fetch and render standings table
async function fetchStandings(){
  console.log("[DEBUG] fetchStandings() called");
  const el = document.getElementById("standings-data");
  if(!el) return console.log("[DEBUG] No standings container");

  // Live waiver
  const liveRs = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`)
                         .then(r=>r.json());
  const waiverMap = Object.fromEntries(liveRs.map(r=>[r.owner_id, r.settings?.waiver_position||0]));

  // Roster + user fetch
  let lid = leagueId;
  let [rs, us] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${lid}/rosters`).then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${lid}/users`).then(r=>r.json())
  ]);
  // fallback if no games
  if(rs.every(r=>(r.settings?.wins||0)+(r.settings?.losses||0)===0)){
    console.log("[DEBUG] No games, fallback to 2024");
    lid = fallbackLeagueId;
    [rs, us] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${lid}/rosters`).then(r=>r.json()),
      fetch(`https://api.sleeper.app/v1/league/${lid}/users`).then(r=>r.json())
    ]);
  }

  const userMap = Object.fromEntries(us.map(u=>[u.user_id,u.display_name]));
  const rosterToOwner = Object.fromEntries(rs.map(r=>[r.roster_id,r.owner_id]));

  // Last-match logic
  let lastOppMap={}, lastScoreMap={};
  for(let wk=18; wk>=1; wk--){
    try{
      const mups = await fetch(`https://api.sleeper.app/v1/league/${fallbackLeagueId}/matchups/${wk}`)
                           .then(r=>r.ok?r.json():[]);
      if(mups.length){
        console.log(`[DEBUG] Using week ${wk} matchups`);
        const games = {};
        mups.forEach(m=>games[m.matchup_id]=(games[m.matchup_id]||[]).concat(m));
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
    }catch(e){ console.warn("Matchup fetch wk",wk,e); }
  }

  // Compute metrics
  rs.forEach(r=>{
    r.power  = (r.settings?.fpts||0)+(r.settings?.wins||0)*20;
    r.maxPF  = r.settings?.fpts_max||0;
    r.waiver = waiverMap[r.owner_id]||0;
  });

  // Sort
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

  // Render
  let rows = "";
  rs.forEach((r,i)=>{
    const name = userMap[r.owner_id]||"Unknown";
    const w=r.settings?.wins||0, l=r.settings?.losses||0;
    const pf=(r.settings?.fpts||0).toFixed(1), pa=(r.settings?.fpts_against||0).toFixed(1);
    const mp=r.maxPF.toFixed(1), ps=r.power.toFixed(1), wv=r.waiver;
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

  document.getElementById("standings-data").innerHTML = `
    <table>
      <thead><tr>
        <th>Standings</th><th>Team</th><th>W-L</th>
        <th>PF</th><th>PA</th><th>Max PF</th>
        <th>Power Score</th><th>Waiver</th>
        <th>Last</th><th>Next</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  console.log("[DEBUG] fetchStandings completed");
}

// Unified Events
async function loadEvents(){
  const container = document.getElementById("event-log");
  if(!container) return;
  const [players, users] = await Promise.all([
    fetch("https://api.sleeper.app/v1/players/nfl").then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r=>r.json())
  ]);
  const userMap = Object.fromEntries(users.map(u=>[u.user_id,u.display_name]));

  db.collection("events")
    .orderBy("timestamp","desc").limit(20)
    .onSnapshot(async snap=>{
      let docs = snap.docs.map(d=>{
        const e = d.data();
        return {ts:e.timestamp.toDate(),user:e.user,action:e.desc,type:e.type};
      });
      const txns = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/1`)
                         .then(r=>r.json());
      txns.forEach(t=>{
        if(t.type==="waiver"){
          for(let pid in t.adds){
            docs.push({
              ts:new Date(t.created),
              user:userMap[t.creator]||t.creator,
              action:`📥 ${players[pid]?.full_name||pid}`,
              type:"waiver"
            });
          }
          for(let pid in t.drops){
            docs.push({
              ts:new Date(t.created),
              user:userMap[t.creator]||t.creator,
              action:`❌ ${players[pid]?.full_name||pid}`,
              type:"waiver"
            });
          }
        }
        if(t.type==="trade"){
          docs.push({
            ts:new Date(t.created),
            user:userMap[t.creator]||t.creator,
            action:"🛠️ Trade executed",
            type:"trade"
          });
        }
      });
      docs.sort((a,b)=>b.ts - a.ts);
      container.innerHTML = `
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
async function fetchTeams(){
  const sel = document.getElementById("team-selector"),
        cont = document.getElementById("team-pages");
  if(!sel||!cont) return;

  const [users, rosters, players] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r=>r.json()),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then(r=>r.json()),
    fetch("https://api.sleeper.app/v1/players/nfl").then(r=>r.json())
  ]);

  // Map users by ID
  const userMap = Object.fromEntries(users.map(u=>[u.user_id,u]));

  // Sort alphabetically
  users.sort((a,b)=> a.display_name.localeCompare(b.display_name));

  // Build selector HTML
  sel.innerHTML = users.map(u=>{
    const roster = rosters.find(r=>r.owner_id===u.user_id) || {};
    const avatar = u.avatar
      ? `<img class="avatar" src="https://sleepercdn.com/avatars/thumbs/${u.avatar}" alt="">`
      : `<div class="avatar"></div>`;
    const name = roster.metadata?.team_name || u.display_name;
    return `<div class="team-tab" data-user="${u.user_id}">
      ${avatar}
      <div class="tab-label">${name}</div>
    </div>`;
  }).join("");

  // Tab click handler
  const tabs = sel.querySelectorAll(".team-tab");
  tabs.forEach(tab=>{
    tab.onclick = ()=>{
      tabs.forEach(t=>t.classList.remove("active"));
      tab.classList.add("active");
      renderTeamPage(tab.dataset.user, rosters, userMap, players);
    };
  });

  // Auto-select first
  if(tabs[0]) tabs[0].click();
}

function renderTeamPage(userId, rosters, userMap, players){
  const cont = document.getElementById("team-pages");
  const r = rosters.find(r=>r.owner_id===userId);
  if(!r){
    cont.innerHTML = "<p>No roster for this team.</p>";
    return;
  }

  // Safely default any missing settings
  const w  = r.settings?.wins || 0;
  const l  = r.settings?.losses || 0;
  const t  = r.settings?.ties || 0;
  const pf = (r.settings?.fpts || 0).toFixed(1);
  const pa = (r.settings?.fpts_against || 0).toFixed(1);

  // Stats snapshot
  const stats = `
    <div class="team-stats">
      <p><strong>${userMap[userId].display_name}</strong></p>
      <p>Record: ${w}-${l}-${t}</p>
      <p>For / Agst: ${pf} / ${pa}</p>
    </div>`;

  // Group players by position
  const groups = {};
  r.players.forEach(pid=>{
    const p = players[pid] || { full_name: pid, position: "UNK" };
    (groups[p.position] = groups[p.position]||[]).push(p.full_name);
  });
  const order = ["QB","RB","WR","TE","FLEX","DST","K","BENCH","TAXI"];
  const rosterHtml = order.map(pos=>{
    if(!groups[pos]) return "";
    return `<div class="position-group">
      <h3>${pos}</h3>
      <ul>${groups[pos].map(n=>`<li>${n}</li>`).join("")}</ul>
    </div>`;
  }).join("");

  cont.innerHTML = stats + rosterHtml;
}

// Initialize Teams on load
window.addEventListener("load", ()=>{
  if(document.getElementById("team-selector")){
    fetchTeams();
  }
});
// === TEAMS PAGE LOGIC END ===

// =======================================
// STUBS TO AVOID ERRORS ON OTHER PAGES
function loadPolls(){}
function loadRules(){}
function analyzeTrade(){}
function drawTrendChart(){}
function drawAgeCurve(){}

// =======================================
// 🚀 INITIAL LOAD
// =======================================
window.addEventListener("load", ()=>{
  fetchLeagueInfo();
  fetchStandings();
  loadEvents();
});
