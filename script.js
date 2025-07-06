// Firebase Init
firebase.initializeApp({
  apiKey: "AIzaSyBTY-rF1jHLFyPjtQ5NVNTKAO7_9ts8MjI",
  authDomain: "dynastyboard.firebaseapp.com",
  projectId: "dynastyboard"
});
const db = firebase.firestore();
const auth = firebase.auth();

let currentUser = null;
auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user && user.email === "YOUR_EMAIL_HERE") {
    document.getElementById('edit-rules-btn').style.display = 'inline-block';
  }
  loadRules();
  loadPolls();
});

// Dark Mode
(function(){
  const stored = localStorage.getItem('darkMode');
  const match = window.matchMedia('(prefers-color-scheme:dark)').matches;
  document.body.classList.toggle('dark', stored==='true' || (stored===null && match));
})();
document.getElementById('theme-toggle').onclick = ()=>{
  const on = document.body.classList.toggle('dark');
  localStorage.setItem('darkMode', on);
};

// Utility
function toggleSection(id){
  const el = document.getElementById(id);
  el.style.display = el.style.display==='none'?'block':'none';
}

// Fetch League Info
const leagueId='1180208789911158784';
async function fetchLeague(){
  const res = await fetch(\`https://api.sleeper.app/v1/league/\${leagueId}\`);
  const d = await res.json();
  document.getElementById('league-data').innerText = \`\${d.name} • Season \${d.season} • \${d.total_rosters} Teams\`;
}
fetchLeague();

// The rest of functions: standings, waiver-feed, events, polls, rules, tradeAnalysis, charts...
