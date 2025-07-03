// Sleeper League ID
const leagueId = '1180208789911158784';

async function fetchLeagueInfo() {
  const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
  const data = await res.json();
  document.getElementById('league-data').innerHTML = `
    <strong>League Name:</strong> ${data.name}<br>
    <strong>Season:</strong> ${data.season}<br>
    <strong>Total Teams:</strong> ${data.total_rosters}
  `;
}

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

  // Fetch player details
  const playersRes = await fetch('https://api.sleeper.app/v1/players/nfl');
  const players = await playersRes.json();

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
}

function loadDraftBoard() {
  document.getElementById('draft-data').innerHTML = "<p>Coming soon: draft board integration!</p>";
}

function loadTradeTracker() {
  document.getElementById('trade-data').innerHTML = "<p>Coming soon: trade tracker!</p>";
}

fetchLeagueInfo();
fetchRosters();
loadDraftBoard();
loadTradeTracker();
