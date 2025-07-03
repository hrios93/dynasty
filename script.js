// Sleeper League ID
const leagueId = '1180208789911158784';

async function fetchLeagueInfo() {
  const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
  const data = await res.json();
  document.getElementById('league-data').textContent = JSON.stringify(data, null, 2);
}

async function fetchRosters() {
  const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
  const data = await res.json();
  document.getElementById('rosters-data').textContent = JSON.stringify(data, null, 2);
}

fetchLeagueInfo();
fetchRosters();
