// Sleeper League ID
const leagueId = '1180208789911158784';

function toggleSection(id) {
  const el = document.getElementById(id);
  if (el.style.display === "none") {
    el.style.display = "block";
  } else {
    el.style.display = "none";
  }
}

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
async function fetchMatchups() {
  const week = document.getElementById('week-select').value;
  const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
  const matchups = await res.json();

  const usersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
  const users = await usersRes.json();
  const userMap = Object.fromEntries(users.map(u => [u.user_id, u.display_name]));

  let html = "";
  matchups.forEach(m => {
    const name = userMap[m.owner_id] || 'Unknown';
    html += `<p><strong>${name}</strong>: ${m.points} points</p>`;
  });

  document.getElementById('matchups-data').innerHTML = html;
}

async function populateWeekSelector() {
  const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
  const select = document.getElementById('week-select');
  select.innerHTML = weeks.map(w => `<option value="${w}">Week ${w}</option>`).join('');
  select.value = new Date().getDay(); // Set a rough default
  fetchMatchups();
}

async function fetchTrades() {
  const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/1`);
  const trades = await res.json();
  const filtered = trades.filter(t => t.type === 'trade');

  const usersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
  const users = await usersRes.json();
  const userMap = Object.fromEntries(users.map(u => [u.user_id, u.display_name]));

  const playerData = await fetch('https://api.sleeper.app/v1/players/nfl').then(r => r.json());

  let html = "";
  filtered.slice(0, 5).forEach(t => {
    const teams = Object.values(t.adds || {}).reduce((acc, user) => {
      acc[user] = acc[user] || [];
      return acc;
    }, {});
    for (const user in teams) {
      const players = Object.keys(t.adds).filter(pid => t.adds[pid] === user);
      html += `<p><strong>${userMap[user]}</strong> received: ${players.map(p => playerData[p]?.full_name || p).join(", ")}</p>`;
    }
    html += "<hr>";
  });

  document.getElementById('trade-feed').innerHTML = html || "<p>No recent trades</p>";
}

async function showManagerProfiles() {
  const usersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
  const users = await usersRes.json();

  let html = users.map(u => `
    <div class="roster">
      <h3>${u.display_name}</h3>
      <p>User ID: ${u.user_id}</p>
      ${u.metadata?.avatar ? `<img src="https://sleepercdn.com/avatars/thumbs/${u.avatar}" width="60">` : ''}
    </div>
  `).join('');

  document.getElementById('manager-profiles').innerHTML = html;
}
async function buildTeamPages() {
  const usersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
  const rostersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
  const users = await usersRes.json();
  const rosters = await rostersRes.json();
  const userMap = Object.fromEntries(users.map(u => [u.user_id, u.display_name]));

  const container = document.createElement('section');
  container.innerHTML = '<h2>Team Pages</h2>';

  rosters.forEach((r, i) => {
    const name = userMap[r.owner_id] || 'Unknown';
    const page = document.createElement('div');
    page.classList.add('roster');
    page.innerHTML = `
      <h3>${name}</h3>
      <p><strong>Wins:</strong> ${r.settings.wins}, Losses: ${r.settings.losses}</p>
      <p><strong>Points For:</strong> ${r.settings.fpts}, Points Against: ${r.settings.fpts_against}</p>
      <p><em>Additional history/stats can go here!</em></p>
    `;
    container.appendChild(page);
  });

  document.body.appendChild(container);
}

async function showPowerRankings() {
  const rostersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
  const usersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
  const users = await usersRes.json();
  const userMap = Object.fromEntries(users.map(u => [u.user_id, u.display_name]));

  const rosters = await rostersRes.json();
  const rankings = rosters.map(r => ({
    name: userMap[r.owner_id] || 'Unknown',
    score: r.settings.fpts + (r.settings.wins * 20)
  }));

  rankings.sort((a, b) => b.score - a.score);

  const html = rankings.map((r, i) => `
    <p><strong>#${i + 1} ${r.name}</strong> — Power Score: ${r.score}</p>
  `).join('');

  document.getElementById('power-rankings-data').innerHTML = html;
}
function toggleDarkMode() {
  document.body.classList.toggle('dark');
}

async function showFuturePicks() {
  // NOTE: Sleeper doesn’t have pick ownership API — this is placeholder logic
  const usersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
  const users = await usersRes.json();
  const userMap = Object.fromEntries(users.map(u => [u.user_id, u.display_name]));

  // Example static pick data (you can expand or replace with real data)
  const picks = [
    { year: 2025, round: 1, owner: userMap[users[0].user_id] },
    { year: 2025, round: 2, owner: userMap[users[1].user_id] },
    { year: 2026, round: 1, owner: userMap[users[2].user_id] }
  ];

  const grouped = {};
  picks.forEach(p => {
    const key = `${p.year} Round ${p.round}`;
    grouped[key] = p.owner;
  });

  const html = Object.entries(grouped).map(([pick, owner]) => `
    <p><strong>${pick}</strong>: ${owner}</p>
  `).join('');

  document.getElementById('pick-table').innerHTML = html;
}

async function populateTradeDropdowns() {
  const usersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
  const users = await usersRes.json();

  const options = users.map(u => `<option value="${u.user_id}">${u.display_name}</option>`).join('');
  document.getElementById('team-a').innerHTML = options;
  document.getElementById('team-b').innerHTML = options;
}

async function analyzeTrade() {
  const teamA = document.getElementById('team-a').value;
  const teamB = document.getElementById('team-b').value;

  const [rostersRes, playersRes] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
    fetch('https://api.sleeper.app/v1/players/nfl')
  ]);

  const rosters = await rostersRes.json();
  const players = await playersRes.json();

  const rosterA = rosters.find(r => r.owner_id === teamA);
  const rosterB = rosters.find(r => r.owner_id === teamB);

  const listPlayers = r =>
    (r.players || []).map(pid => players[pid]?.full_name || pid).slice(0, 10).join(', ') || 'No players listed';

  const html = `
    <h4>Team A Roster Preview:</h4>
    <p>${listPlayers(rosterA)}</p>
    <h4>Team B Roster Preview:</h4>
    <p>${listPlayers(rosterB)}</p>
    <p><em>You can use this as a visual aid to discuss trades.</em></p>
  `;

  document.getElementById('trade-analysis-results').innerHTML = html;
}
async function renderSchedule() {
  const week = document.getElementById('schedule-week').value;

  const [matchupsRes, rostersRes, usersRes] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`)
  ]);

  const matchups = await matchupsRes.json();
  const rosters = await rostersRes.json();
  const users = await usersRes.json();

  const userMap = Object.fromEntries(users.map(u => [u.user_id, u.display_name]));
  const rosterMap = Object.fromEntries(rosters.map(r => [r.roster_id, r]));

  const games = {};
  matchups.forEach(m => {
    if (!games[m.matchup_id]) games[m.matchup_id] = [];
    games[m.matchup_id].push(m);
  });

  const html = Object.values(games).map(pair => {
    const teamA = pair[0];
    const teamB = pair[1];
    const nameA = userMap[rosterMap[teamA.roster_id]?.owner_id] || 'Team A';
    const nameB = userMap[rosterMap[teamB.roster_id]?.owner_id] || 'Team B';
    return `<p><strong>${nameA}</strong> vs <strong>${nameB}</strong></p>`;
  }).join('');

  document.getElementById('schedule-table').innerHTML = html || 'No matchups available.';
}

function buildScheduleDropdown() {
  const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
  const select = document.getElementById('schedule-week');
  select.innerHTML = weeks.map(w => `<option value="${w}">Week ${w}</option>`).join('');
  select.value = new Date().getDay();
  renderSchedule();
}

async function fetchWaivers() {
  const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/1`);
  const txns = await res.json();

  const adds = txns.filter(t => t.type === 'waiver' && t.adds);
  const drops = txns.filter(t => t.type === 'waiver' && t.drops);

  const playersRes = await fetch('https://api.sleeper.app/v1/players/nfl');
  const players = await playersRes.json();

  let html = '';

  adds.slice(0, 5).forEach(txn => {
    for (const pid in txn.adds) {
      html += `<p>Added: ${players[pid]?.full_name || pid}</p>`;
    }
  });

  drops.slice(0, 5).forEach(txn => {
    for (const pid in txn.drops) {
      html += `<p>Dropped: ${players[pid]?.full_name || pid}</p>`;
    }
  });

  document.getElementById('waiver-feed').innerHTML = html || '<p>No recent activity</p>';
}
async function drawScoringChart() {
  const [matchups, rosters, users] = await Promise.all([
    Promise.all(Array.from({ length: 18 }, (_, w) => 
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${w + 1}`).then(r => r.ok ? r.json() : [])
    )),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then(r => r.json()),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r => r.json())
  ]);

  const userMap = Object.fromEntries(users.map(u => [u.user_id, u.display_name]));
  const rosterMap = Object.fromEntries(rosters.map(r => [r.roster_id, r.owner_id]));

  const weeklyPoints = {}; // { owner_id: [w1, w2, w3, ...] }

  matchups.forEach((week, i) => {
    week.forEach(m => {
      const owner = rosterMap[m.roster_id];
      if (!weeklyPoints[owner]) weeklyPoints[owner] = [];
      weeklyPoints[owner][i] = m.points || 0;
    });
  });

  const ctx = document.getElementById("trendChart").getContext("2d");
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array.from({ length: 18 }, (_, i) => `W${i + 1}`),
      datasets: Object.entries(weeklyPoints).map(([owner, points]) => ({
        label: userMap[owner],
        data: points,
        fill: false,
        borderColor: "#" + Math.floor(Math.random()*16777215).toString(16),
        tension: 0.3
      }))
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } }
    }
  });
}
function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

async function downloadStandingsCSV() {
  const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
  const rosters = await res.json();
  const usersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
  const users = await usersRes.json();
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
  const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
  const rosters = await res.json();
  const usersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
  const users = await usersRes.json();
  const playersRes = await fetch(`https://api.sleeper.app/v1/players/nfl`);
  const players = await playersRes.json();
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


// Load these too
buildTeamPages();
showPowerRankings();

// INIT
populateWeekSelector();
fetchTrades();
showManagerProfiles();
showFuturePicks();
populateTradeDropdowns();
buildScheduleDropdown();
fetchWaivers();
drawScoringChart();
loadNotes();


fetchLeagueInfo();
fetchRosters();
loadDraftBoard();
loadTradeTracker();
