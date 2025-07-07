// Initialize Firebase
firebase.initializeApp({
  apiKey: "AIzaSyBTY-rF1jHLFyPjtQ5NVNTKAO7_9ts8MjI",
  authDomain: "dynastyboard.firebaseapp.com",
  projectId: "dynastyboard"
});
const db = firebase.firestore();
const auth = firebase.auth();
let currentUser = null;

// Auth handlers
function startLogin(){
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider);
}
function logout(){ auth.signOut(); }
auth.onAuthStateChanged(user=>{
  currentUser=user;
  document.getElementById('login-btn').style.display = user?'none':'inline';
  document.getElementById('logout-btn').style.display = user?'inline':'none';
  document.getElementById('user-info').innerText = user?`Hello, ${user.displayName}`:'';
  loadRules(); loadPolls(); loadEvents();
});

// Dark mode
(function(){
  const stored=localStorage.getItem('darkMode');
  const pref=window.matchMedia('(prefers-color-scheme:dark)').matches;
  document.body.classList.toggle('dark', stored==='true' || (stored===null&&pref));
})();
document.querySelectorAll('#theme-toggle').forEach(btn=>{
  btn.onclick=()=>{
    const on=document.body.classList.toggle('dark');
    localStorage.setItem('darkMode',on);
  };
});

// Utility
function toggleSection(id){
  const el=document.getElementById(id);
  el.style.display=el.style.display==='none'?'block':'none';
}

// Sleeper API calls
const leagueId='1180208789911158784';
async function fetchLeague(){
  try{
    const res=await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
    const d=await res.json();
    document.getElementById('league-data').innerText=`${d.name} • Season ${d.season} • ${d.total_rosters} Teams`;
  }catch(e){console.error(e);}
}
fetchLeague();

// Placeholder for other data functions (standings, waiver, events, polls, rules, charts)
