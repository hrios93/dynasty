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
  el.style.display = el.style.display === "none" ? "block" : "none";
}
window.toggleSection = toggleSection;

// ——————————————————————————————————
// Sleeper API Data Fetchers
// ——————————————————————————————————
const leagueId = "1180208789911158784";

// 1. League Info
async function fetchLeagueInfo() {
  try {
    const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
    const d   = await res.json();
    document.getElementById("league-data").innerText =
      `${d.name} • Season ${d.season} • ${d.total_rosters} Teams`;
  } catch (e) {
    console.error("League Info Error:", e);
  }
}

// 2. Standings + Upcoming Matchup + Power Score
async function fetchStandings() {
  try {
    // get rosters and users
    const [rs, us] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then(r => r.json()),
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r => r.json())
    ]);
    const userMap = Object.fromEntries(us.map(u=>[u.user_id,u.display_name]));

    // sort by wins then fpts
    rs.sort((a,b) => b.settings.wins - a.settings.wins || b.settings.fpts - a.settings.fpts);

    // build table rows
    let rows = "", week = new Date().getWeek(); // you can define getWeek if you want current NFL week
    for (let i=0; i<rs.length; i++) {
      const r = rs[i];
      const owner = userMap[r.owner_id]||"Unknown";
      // find last & next opponent placeholders:
      const lastOpp = "-", nextOpp = "-";
      rows += `<tr>
        <td>${i+1}</td>
        <td><a href="teams.html#${r.owner_id}">${owner}</a></td>
        <td>${r.settings.wins}-${r.settings.losses}</td>
        <td>${r.settings.fpts.toFixed(1)}</td>
        <td>${r.settings.fpts_against.toFixed(1)}</td>
        <td>${i+1}</td>
        <td>${lastOpp}</td>
        <td>${nextOpp}</td>
      </tr>`;
    }

    document.getElementById("standings-data").innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Rank</th><th>Team</th><th>W-L</th><th>PF</th><th>PA</th>
            <th>Waiver</th><th>Last</th><th>Next</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  } catch(e) {
    console.error("Standings Error:", e);
  }
}

// 3. Waiver Feed
async function fetchWaivers() {
  try {
    const tx = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/1`)
      .then(r=>r.json());
    const adds  = tx.filter(t=>t.type==="waiver"&&t.adds);
    const drops = tx.filter(t=>t.type==="waiver"&&t.drops);
    const players = await fetch("https://api.sleeper.app/v1/players/nfl").then(r=>r.json());
    let html="";
    adds.slice(0,5).forEach(t=> {
      Object.keys(t.adds).forEach(pid=>{
        html+=`<p>📥 ${players[pid]?.full_name||pid}</p>`;
      });
    });
    drops.slice(0,5).forEach(t=> {
      Object.keys(t.drops).forEach(pid=>{
        html+=`<p>❌ ${players[pid]?.full_name||pid}</p>`;
      });
    });
    document.getElementById("waiver-feed").innerHTML = html||"<p>No recent waivers</p>";
  } catch(e) {
    console.error("Waivers Error:", e);
  }
}

// 4. Events Feed (Firestore)
async function loadEvents() {
  const container = document.getElementById("event-log");
  if (!container) return;
  db.collection("events")
    .orderBy("timestamp","desc")
    .limit(20)
    .onSnapshot(snap=>{
      const html = snap.docs.map(d=>{
        const e = d.data();
        const ic = e.type==="rules"?"📜": e.type==="poll"?"🗳️": e.type==="waiver"?"📥":"🔄";
        return `<p>${ic} ${e.desc} <small>${e.timestamp.toDate().toLocaleString()}</small></p>`;
      }).join("");
      container.innerHTML = html;
    });
}
// Utility to log events
async function logEvent(desc,type="misc") {
  await db.collection("events").add({ desc, type, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
}

// 5. Polls (Firestore)
async function submitPoll() {
  const title = document.getElementById("poll-title").value.trim();
  const opts  = document.getElementById("poll-options").value.split("\n").map(o=>o.trim()).filter(Boolean);
  const multi = document.getElementById("poll-multi").checked;
  if(!title||opts.length<2) return alert("Title + at least 2 options");
  const votes = opts.reduce((a,o)=>{ a[o]=[]; return a; },{});
  await db.collection("polls").add({
    title, options: opts, votes, multi,
    createdBy: currentUser?.displayName||"Anonymous",
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  logEvent(`Poll created: "${title}"`,"poll");
}
async function votePoll(pid,multi) {
  const snap = await db.collection("polls").doc(pid).get();
  const data = snap.data();
  const choices = Array.from(document.querySelectorAll(`[name=poll-${pid}]`))
    .filter(i=>i.checked).map(i=>i.value);
  if(!choices.length) return alert("Select at least one");
  // update votes
  data.options.forEach(opt=>{
    let set = new Set(data.votes[opt]);
    if (choices.includes(opt)) set.add(currentUser.uid);
    else set.delete(currentUser.uid);
    data.votes[opt] = Array.from(set);
  });
  await db.collection("polls").doc(pid).update({ votes: data.votes });
}
function renderPoll(doc) {
  const p = doc.data();
  const hasVoted = p.options.some(o=>p.votes[o].includes(currentUser?.uid));
  let html = `<article><h3>${p.title}</h3>`;
  if(!hasVoted) {
    html += p.options.map(opt=>
      `<label><input type="${p.multi?"checkbox":"radio"}"
        name="poll-${doc.id}" value="${opt}"> ${opt}</label><br>`
    ).join("");
    html += `<button onclick="votePoll('${doc.id}',${p.multi})">Vote</button>`;
  } else {
    html += `<p><em>Results:</em></p>` + p.options.map(opt=>
      `<p>${opt}: ${p.votes[opt].length}</p>`
    ).join("");
  }
  html += `</article>`;
  return html;
}
function loadPolls() {
  const feed = document.getElementById("polls-feed");
  if (!feed) return;
  db.collection("polls")
    .orderBy("timestamp","desc")
    .onSnapshot(snap=>{
      feed.innerHTML = snap.docs.map(renderPoll).join("");
    });
}

// 6. Rules Editor (Firestore)
async function loadRules() {
  const disp   = document.getElementById("rules-display");
  const edit   = document.getElementById("rules-editor");
  const editBtn= document.getElementById("edit-rules-btn");
  const saveBtn= document.getElementById("save-rules-btn");
  if (!disp) return;
  const docRef = await db.collection("rules").doc("league_rules").get();
  const txt = docRef.exists ? docRef.data().text : "No rules set.";
  disp.innerText = txt;
  edit.value    = txt;
  // show edit button only to commissioner
  if (currentUser?.email === "harnyrios@me.com") {
    editBtn.style.display = "inline-block";
  }
}
function toggleRulesEdit() {
  const disp = document.getElementById("rules-display");
  const edit = document.getElementById("rules-editor");
  const save = document.getElementById("save-rules-btn");
  if (edit.style.display === "block") {
    edit.style.display = "none"; disp.style.display = "block"; save.style.display = "none";
  } else {
    edit.style.display = "block"; disp.style.display = "none"; save.style.display = "inline-block";
  }
}
async function saveRules() {
  const txt = document.getElementById("rules-editor").value;
  await db.collection("rules").doc("league_rules").set({
    text: txt,
    updatedBy: currentUser.displayName,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  logEvent("Rules updated","rules");
  toggleRulesEdit();
  loadRules();
}

// 7. Charts & Analysis Helpers
async function drawTrendChart() {
  // placeholder: implement data collection and Chart.js instantiation
}
async function drawAgeCurve() {
  // placeholder
}

// ——————————————————————————————————
// Initialization on DOM Ready
// ——————————————————————————————————
document.addEventListener("DOMContentLoaded", () => {
  fetchLeagueInfo();
  fetchStandings();
  fetchWaivers();
  loadEvents();
  loadPolls();
  loadRules();
  // optionally call drawTrendChart(), drawAgeCurve()
});
