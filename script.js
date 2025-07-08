// script.js

/* =======================================
   GLOBAL SETUP
   – Firebase, Dark Mode, Auth, Utility
   ======================================= */

// Initialize Firebase
firebase.initializeApp({
  apiKey:    "AIzaSyBTY-rF1jHLFyPjtQ5NVNTKAO7_9ts8MjI",
  authDomain:"dynastyboard.firebaseapp.com",
  projectId: "dynastyboard"
});
const db   = firebase.firestore();
const auth = firebase.auth();

// Dark Mode: respect OS setting & toggle
(function(){
  const stored = localStorage.getItem("darkMode");
  const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.body.classList.toggle("dark", stored==="true" || (stored===null && prefers));
})();
document.querySelectorAll("#theme-toggle").forEach(btn=>{
  btn.onclick = () => {
    const on = document.body.classList.toggle("dark");
    localStorage.setItem("darkMode", on);
  };
});

// Simple toggle-section helper (used by “Show/Hide Events”)
function toggleSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = el.style.display === "none" ? "block" : "none";
}
window.toggleSection = toggleSection;

// Authentication (stubs for future)
let currentUser = null;
auth.onAuthStateChanged(u => {
  currentUser = u;
  // here you could show/hide login buttons if implemented
  loadPolls();
  loadRules();
  loadEvents();
});


/* =======================================
   HOME PAGE FUNCTIONS
   – League Info, Standings, Events Feed
   ======================================= */

// Your Sleeper league IDs
const leagueId         = "1180208789911158784";
const fallbackLeagueId = "1048313545995296768";

// 1) League Info (header)
async function fetchLeagueInfo() {
  const el = document.getElementById("league-data");
  if (!el) return;
  try {
    const data = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`)
                         .then(r => r.json());
    el.innerText = `${data.name} • Season ${data.season} • ${data.total_rosters} Teams`;
  } catch (e) {
    console.error("League Info Error:", e);
  }
}

// 2) Standings Table
async function fetchStandings() {
  const el = document.getElementById("standings-data");
  if (!el) return;

  // 1) Load rosters, users, and players
  let [rosters, users, players] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then(r => r.json()),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r => r.json()),
    fetch("https://api.sleeper.app/v1/players/nfl").then(r => r.json())
  ]);

  // 2) If nobody has played, fall back to last season’s rosters
  const allZero = rosters.every(r =>
    (r.settings?.wins || 0) + (r.settings?.losses || 0) === 0
  );
  if (allZero) {
    rosters = await fetch(`https://api.sleeper.app/v1/league/${fallbackLeagueId}/rosters`)
                      .then(r => r.json());
  }

  // 3) Build helper maps
  const userMap = Object.fromEntries(users.map(u => [u.user_id, u.display_name]));

  // 4) Compute additional metrics on each roster
  rosters.forEach(r => {
    r.power  = (r.settings?.fpts || 0) + (r.settings?.wins || 0) * 20;
    r.maxPF  = r.settings?.fpts_max || 0;
    r.waiver = r.settings?.waiver_position || 0;
  });

  // 5) Sort by wins → points for
  rosters.sort((a, b) => {
    const aw = a.settings?.wins || 0, bw = b.settings?.wins || 0;
    if (bw !== aw) return bw - aw;
    return (b.settings?.fpts || 0) - (a.settings?.fpts || 0);
  });

  // 6) Render the table
  const rows = rosters.map((r, i) => {
    const w = r.settings?.wins || 0,
          l = r.settings?.losses || 0,
          pf = (r.settings?.fpts || 0).toFixed(1),
          pa = (r.settings?.fpts_against || 0).toFixed(1),
          mp = r.maxPF.toFixed(1),
          ps = r.power.toFixed(1),
          wv = r.waiver;
    return `
      <tr>
        <td>${i+1}</td>
        <td>${userMap[r.owner_id] || "Unknown"}</td>
        <td>${w}-${l}</td>
        <td>${pf}</td>
        <td>${pa}</td>
        <td>${mp}</td>
        <td>${ps}</td>
        <td>${wv}</td>
        <td>—</td>
        <td>—</td>
      </tr>
    `;
  }).join("");

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
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}


// 3) Unified Events Feed
async function loadEvents() {
  const container = document.getElementById("event-log");
  if (!container) return;

  // Preload player & user maps
  const [players, users] = await Promise.all([
    fetch("https://api.sleeper.app/v1/players/nfl").then(r => r.json()),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r => r.json())
  ]);
  const userMap = Object.fromEntries(users.map(u => [u.user_id, u.display_name]));

  db.collection("events")
    .orderBy("timestamp","desc")
    .limit(20)
    .onSnapshot(async snap => {
      let docs = snap.docs.map(d => {
        const e = d.data();
        return {
          ts: e.timestamp.toDate(),
          user: e.user || "Commissioner",
          action: e.desc,
          type: e.type
        };
      });

      const txns = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/1`)
                          .then(r => r.json());

      txns.forEach(t => {
        if (t.type === "waiver") {
          for (let pid in t.adds) {
            docs.push({
              ts: new Date(t.created),
              user: userMap[t.creator] || t.creator,
              action: `📥 ${players[pid]?.full_name || pid}`,
              type: "waiver"
            });
          }
          for (let pid in t.drops) {
            docs.push({
              ts: new Date(t.created),
              user: userMap[t.creator] || t.creator,
              action: `❌ ${players[pid]?.full_name || pid}`,
              type: "waiver"
            });
          }
        }
        if (t.type === "trade") {
          docs.push({
            ts: new Date(t.created),
            user: userMap[t.creator] || t.creator,
            action: "🛠️ Trade executed",
            type: "trade"
          });
        }
      });

      docs.sort((a,b) => b.ts - a.ts);

      container.innerHTML = `
        <table>
          <thead>
            <tr><th>Date</th><th>User</th><th>Action</th><th>Type</th></tr>
          </thead>
          <tbody>
            ${docs.map(e => `
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

// 4) Placeholders for other pages
function loadPolls(){}
function loadRules(){}
function analyzeTrade(){}
function drawTrendChart(){}
function drawAgeCurve(){}


// =======================================
 // INITIALIZATION ON PAGE LOAD
// =======================================
window.addEventListener("load", () => {
  fetchLeagueInfo();
  fetchStandings();
  loadEvents();
});
