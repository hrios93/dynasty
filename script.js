// Sleeper League ID
const leagueId = '1180208789911158784';

// Cache global data to reduce redundant fetches
let cachedUsers = null;
let cachedPlayers = null;

// Utility: toggle visibility of section by ID
function toggleSection(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = (el.style.display === "none") ? "block" : "none";
  }
}

// Fetch users once and cache
async function fetchUsers() {
  if (cachedUsers) return cachedUsers;
  try {
    const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
    cachedUsers = await res.json();
    return cachedUsers;
  } catch (e) {
    console.error("Failed to fetch users", e);
    alert("Failed to load user data");
    return [];
  }
}

// Fetch players once and cache
async function fetchPlayers() {
  if (cachedPlayers) return cachedPlayers;
  try {
    const res = await fetch('https://api.sleeper.app/v1/players/nfl');
    cachedPlayers = await res.json();
    return cachedPlayers;
  } catch (e) {
    console.error("Failed to fetch players", e);
    alert("Failed to load player data");
    return {};
  }
}

async function fetchLeagueInfo() {
  try {
    const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
    const data = await res.json();
    document.getElementById('league-data').innerHTML = `
      <strong>League Name:</strong> ${data.name}<br>
      <strong>Season:</strong> ${data.season}<br>
      <strong>Total Teams:</strong> ${data.total_rosters}
    `;
  } catch (e) {
    console.error("Failed to fetch league info", e);
    document.getElementById('league-data').innerText = "Failed to load league info";
  }
}

async function fetchRosters() {
  try {
    const [rostersRes, users, players] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
      fetchUsers(),
      fetchPlayers()
    ]);
    const rosters = await rostersRes.json();

    const userMap = Object.fromEntries(users.map(u => [u.user_id, u.display_name]));

    // Sort rosters by points
    const sortedRosters = rosters.sort((a, b) => b.settings.fpts - a.settings.fpts);

    const rosterHtml = sortedRosters.map((r, i) => {
      const playerNames = (r.players || []).map(pid => players[pid]?.full_name || pid);
      return `
        <div class="roster">
          <h3>Team ${i + 1} - ${userMap[r.owner_id] || 'Unknown Manager'}</h3>
          <p><strong>Wins:</strong> ${r.settings.wins}, <strong>Losses:</strong> ${r.settings.losses}</p>
          <p><strong>Points For:</strong> ${r.settings.fpts}</p>
          <p><strong>Roster:</strong> ${playerNames.join(', ')}</p>
        </div>
      `;
    }).join("");

    document.getElementById('rosters-data').innerHTML = rosterHtml;

    const standingsHtml = sortedRosters.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${userMap[r.owner_id] || 'Unknown'}</td>
        <td>${r.settings.wins}</td>
        <td>${r.settings.losses}</td>
        <td>${r.settings.fpts}</td>
      </tr>
    `).join("");

    document.getElementById('standings-data').innerHTML = `
      <table>
        <thead>
          <tr><th>Rank</th><th>Team</th><th>Wins</th><th>Losses</th><th>Points For</th></tr>
        </thead>
        <tbody>${standingsHtml}</tbody>
      </table>
    `;

  } catch (e) {
    console.error("Failed to fetch rosters", e);
    document.getElementById('rosters-data').innerText = "Failed to load rosters";
    document.getElementById('standings-data').innerText = "Failed to load standings";
  }
}

function loadDraftBoard() {
  document.getElementById('draft-data').innerHTML = "<p>Coming soon: draft board integration!</p>";
}

function loadTradeTracker() {
  document.getElementById('trade-data').innerHTML = "<p>Coming soon: trade tracker!</p>";
}

async function fetchMatchups() {
  try {
    const weekSelect = document.getElementById('week-select');
    const week = weekSelect ? weekSelect.value : '1';
    const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
    const matchups = await res.json();

    const users = await fetchUsers();
    const userMap = Object.fromEntries(users.map(u => [u.user_id, u.display_name]));

    let html = "";
    matchups.forEach(m => {
      const name = userMap[m.owner_id] || 'Unknown';
      html += `<p><strong>${name}</strong>: ${m.points} points</p>`;
    });

    document.getElementById('matchups-data').innerHTML = html;
  } catch (e) {
    console.error("Failed to fetch matchups", e);
    document.getElementById('matchups-data').innerText = "Failed to load matchups";
  }
}

function populateWeekSelector() {
  const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
  const select = document.getElementById('week-select');
  if (!select) return;

  select.innerHTML = weeks.map(w => `<option value="${w}">Week ${w}</option>`).join('');
  select.value = '1'; // default week

  select.addEventListener('change', fetchMatchups);
  fetchMatchups();
}

async function fetchTrades() {
  try {
    const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/1`);
    const trades = await res.json();
    const filtered = trades.filter(t => t.type === 'trade');

    const users = await fetchUsers();
    const userMap = Object.fromEntries(users.map(u => [u.user_id, u.display_name]));

    const players = await fetchPlayers();

    let html = "";
    filtered.slice(0, 5).forEach(t => {
      const teams = Object.values(t.adds || {}).reduce((acc, user) => {
        acc[user] = acc[user] || [];
        return acc;
      }, {});
      for (const user in teams) {
        const playersReceived = Object.keys(t.adds).filter(pid => t.adds[pid] === user);
        html += `<p><strong>${userMap[user]}</strong> received: ${playersReceived.map(p => players[p]?.full_name || p).join(", ")}</p>`;
      }
      html += "<hr>";
    });

    document.getElementById('trade-feed').innerHTML = html || "<p>No recent trades</p>";
  } catch (e) {
    console.error("Failed to fetch trades", e);
    document.getElementById('trade-feed').innerText = "Failed to load trades";
  }
}

async function showManagerProfiles() {
  try {
    const users = await fetchUsers();

    const html = users.map(u => `
      <div class="roster">
        <h3>${u.display_name}</h3>
        <p>User ID: ${u.user_id}</p>
        ${u.avatar ? `<img src="https://sleepercdn.com/avatars/thumbs/${u.avatar}" width="60">` : ''}
      </div>
    `).join('');

    document.getElementById('manager-profiles').innerHTML = html;
  } catch (e) {
    console.error("Failed to load manager profiles", e);
    document.getElementById('manager-profiles').innerText = "Failed to load profiles";
  }
}

// ... Keep other functions with similar improvements

function toggleDarkMode() {
  document.body.classList.toggle('dark');
}

function saveNotes() {
  const text = document.getElementById("commish-text").value;
  localStorage.setItem("commish_notes", text);
  document.getElementById("commish-display").innerText = text;
  alert("Notes saved!");
}

function loadNotes() {
  const notes = localStorage.getItem("commish_notes") || "";
  document.getElementById("commish-text").value = notes;
  document.getElementById("commish-display").innerText = notes;
}

// Initialization on page load
async function init() {
  await fetchLeagueInfo();
  await fetchRosters();
  loadDraftBoard();
  loadTradeTracker();
  populateWeekSelector();
  fetchTrades();
  showManagerProfiles();
  showFuturePicks();
  populateTradeDropdowns();
  buildScheduleDropdown();
  fetchWaivers();
  drawScoringChart();
  loadNotes();
  buildTeamPages();
  showPowerRankings();
}

init();
