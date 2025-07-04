// Sleeper League Info
const leagueId = '1180208789911158784';
const pastSeasons = ['1048313545995296768', '918655311878270976'];

// Utility
function toggleSection(id) {
  const el = document.getElementById(id);
  el.style.display = el.style.display === "none" ? "block" : "none";
}

// Load Notes
function saveNotes() {
  const text = document.getElementById("commish-text").value;
  localStorage.setItem("commish_notes", text);
  document.getElementById("commish-display").innerText = text;
}
function loadNotes() {
  const notes = localStorage.getItem("commish_notes") || "";
  document.getElementById("commish-text").value = notes;
  document.getElementById("commish-display").innerText = notes;
}

// Dark Mode
function toggleDarkMode() {
  document.body.classList.toggle('dark');
}

// Fetch League Info
async function fetchLeagueInfo() {
  const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
  const data = await res.json();
  document.getElementById('league-data').innerHTML = `
    <strong>League Name:</strong> ${data.name}<br>
    <strong>Season:</strong> ${data.season}<br>
    <strong>Total Teams:</strong> ${data.total_rosters}
  `;
}

// Fetch Users
async function fetchUsers() {
  const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
  return await res.json();
}

// Fetch Rosters
async function fetchRosters() {
  const [rostersRes, users] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
    fetchUsers()
  ]);
  const rosters = await rostersRes.json();
  const playerRes = await fetch('https://api.sleeper.app/v1/players/nfl');
  const players = await playerRes.json();
  const userMap = Object.fromEntries(users.map(u => [u.user_id, u.display_name]));

  const sortedRosters = rosters.sort((a, b) => b.settings.fpts - a.settings.fpts);

  document.getElementById('standings-data').innerHTML = `
    <table>
      <thead>
        <tr><th>Rank</th><th>Team</th><th>Wins</th><th>Losses</th><th>Points For</th></tr>
      </thead>
      <tbody>
        ${sortedRosters.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${userMap[r.owner_id] || 'Unknown'}</td>
            <td>${r.settings.wins}</td>
            <td>${r.settings.losses}</td>
            <td>${r.settings.fpts}</td>
          </tr>`).join("")}
      </tbody>
    </table>
  `;

  document.getElementById('rosters-data').innerHTML = sortedRosters.map((r, i) => {
    const names = (r.players || []).map(pid => players[pid]?.full_name || pid);
    return `
      <div class="roster">
        <h3>${userMap[r.owner_id] || 'Unknown Manager'}</h3>
        <p><strong>Wins:</strong> ${r.settings.wins}, <strong>Losses:</strong> ${r.settings.losses}</p>
        <p><strong>Points For:</strong> ${r.settings.fpts}</p>
        <p><strong>Roster:</strong> ${names.join(', ')}</p>
      </div>
    `;
  }).join('');
}

// Populate Week Selector
function populateWeekSelector() {
  const select = document.getElementById('week-select');
  select.innerHTML = Array.from({ length: 18 }, (_, i) => 
    `<option value="${i + 1}">Week ${i + 1}</option>`).join('');
  fetchMatchups();
}

// Fetch Matchups
async function fetchMatchups() {
  const week = document.getElementById('week-select').value;
  const [matchupRes, userRes, rosterRes] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`),
    fetchUsers(),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`)
  ]);
  const matchups = await matchupRes.json();
  const users = await userRes.json();
  const rosters = await rosterRes.json();
  const userMap = Object.fromEntries(users.map(u => [u.user_id, u.display_name]));
  const rosterMap = Object.fromEntries(rosters.map(r => [r.roster_id, r.owner_id]));

  const games = {};
  matchups.forEach(m => {
    if (!games[m.matchup_id]) games[m.matchup_id] = [];
    games[m.matchup_id].push(m);
  });

  const html = Object.values(games).map(pair => {
    const a = pair[0], b = pair[1];
    const nameA = userMap[rosterMap[a.roster_id]] || 'Team A';
    const nameB = userMap[rosterMap[b.roster_id]] || 'Team B';
    return `<p><strong>${nameA}</strong> vs <strong>${nameB}</strong></p>`;
  }).join('');

  document.getElementById('matchups-data').innerHTML = html || '<p>No matchups found</p>';
}

// Export CSV
function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
async function downloadStandingsCSV() {
  const rosters = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then(r => r.json());
  const users = await fetchUsers();
  const userMap = Object.fromEntries(users.map(u => [u.user_id, u.display_name]));
  const rows = [["Team", "Wins", "Losses", "FPTS", "FPTS Against"]];
  rosters.forEach(r => {
    rows.push([
      userMap[r.owner_id] || r.owner_id,
      r.settings.wins,
      r.settings.losses,
      r.settings.fpts,
      r.settings.fpts_against
    ]);
  });
  downloadCSV("standings.csv", rows);
}
async function downloadRostersCSV() {
  const [rosters, users, players] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then(r => r.json()),
    fetchUsers(),
    fetch('https://api.sleeper.app/v1/players/nfl').then(r => r.json())
  ]);
  const userMap = Object.fromEntries(users.map(u => [u.user_id, u.display_name]));
  const rows = [["Team", "Player"]];
  rosters.forEach(r => {
    (r.players || []).forEach(pid => {
      rows.push([
        userMap[r.owner_id] || r.owner_id,
        players[pid]?.full_name || pid
      ]);
    });
  });
  downloadCSV("rosters.csv", rows);
}
