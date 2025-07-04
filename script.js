// Dynasty League Hub - script.js
// League configuration
const leagueId = '1180208789911158784';
const pastSeasonIds = ['1048313545995296768', '918655311878270976'];

// Utility: Toggle visibility of a section
function toggleSection(id) {
  const el = document.getElementById(id);
  el.style.display = (el.style.display === 'none') ? 'block' : 'none';
}

// Utility: CSV export helper
function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

// Fetch league info
async function fetchLeagueInfo() {
  const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
  const data = await res.json();
  document.getElementById('league-data').innerHTML = `
    <strong>Name:</strong> ${data.name}<br>
    <strong>Season:</strong> ${data.season}<br>
    <strong>Total Teams:</strong> ${data.total_rosters}
  `;
}

// Fetch users and rosters
async function fetchUsers() {
  const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
  return await res.json();
}

async function fetchRosters() {
  const [rostersRes, usersRes] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
    fetchUsers()
  ]);

  const rosters = await rostersRes.json();
  const users = usersRes;
  const userMap = Object.fromEntries(users.map(u => [u.user_id, u.display_name]));
  const playersRes = await fetch('https://api.sleeper.app/v1/players/nfl');
  const players = await playersRes.json();

  const sorted = rosters.sort((a, b) => b.settings.fpts - a.settings.fpts);

  document.getElementById('standings-data').innerHTML = `
    <table>
      <thead><tr><th>Rank</th><th>Team</th><th>W</th><th>L</th><th>PF</th></tr></thead>
      <tbody>
        ${sorted.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${userMap[r.owner_id] || 'Unknown'}</td>
            <td>${r.settings.wins}</td>
            <td>${r.settings.losses}</td>
            <td>${r.settings.fpts}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  document.getElementById('rosters-data').innerHTML = sorted.map((r, i) => `
    <div class="roster">
      <h3>Team ${i + 1} - ${userMap[r.owner_id] || 'Unknown'}</h3>
      <p><strong>Wins:</strong> ${r.settings.wins}, <strong>Losses:</strong> ${r.settings.losses}</p>
      <p><strong>PF:</strong> ${r.settings.fpts}</p>
      <p><strong>Roster:</strong> ${(r.players || []).map(pid => players[pid]?.full_name || pid).join(', ')}</p>
    </div>`).join('');
}

// Placeholder
function loadDraftBoard() {
  document.getElementById('draft-data').innerHTML = '<p>Draft board coming soon...</p>';
}

function loadTradeTracker() {
  document.getElementById('trade-data').innerHTML = '<p>Trade tracker coming soon...</p>';
}

// Init
function init() {
  fetchLeagueInfo();
  fetchRosters();
  loadDraftBoard();
  loadTradeTracker();
  // Additional setup can be added here as more features go live
}

document.addEventListener('DOMContentLoaded', init);
