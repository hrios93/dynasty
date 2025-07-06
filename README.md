# 🏈 Dynasty Fantasy Football League Hub

Welcome to your custom-built Dynasty Fantasy Football League Website, powered by Sleeper API, FantasyCalc Superflex trade values, and Firebase!

This site provides a central hub for communication, stats, league tools, and interactive analysis for all managers in your league.

---

## 🔍 Features

- **Live Sleeper Integration**: Standings, rosters, matchups, waivers, and trades update automatically from your Sleeper league.
- **Power Rankings & Scoring Trends**: Visual insights via dynamic line charts.
- **Team Pages**: View manager profiles, rosters grouped by position, schedules, and team history.
- **Trade Analyzer**: Uses FantasyCalc Superflex values to compare trades.
- **Player Aging Trends**: Visualize team performance outlooks based on NFL player age tiers.
- **League Rules & Polls**: Editable by commissioner. Polls support yes/no or multiple choice and are stored in Firebase.
- **Message Board** *(planned)*: Topic-based post threads including polls, questions, and general discussion.
- **Dark Mode**: Auto-detects system theme with manual toggle.
- **CSV Exports**: Download standings and rosters.

---

## ⚙️ Setup Instructions

### 1. Hosting the Site (GitHub Pages)
This site is designed to run fully on GitHub Pages:

1. [Create a GitHub repo](https://github.com/new) named something like `dynasty`
2. Upload all files from this project (or unzip the provided ZIP and drag them in)
3. Go to **Settings > Pages**
4. Under "Source", select `main` branch and root (`/`)
5. Wait a few seconds — your site will be live at:  
   `https://your-username.github.io/dynasty`

### 2. Firebase Setup (for Polls & Rules Editing)
Firebase is used for storing:

- League rules (editable only by the commissioner)
- Polls and votes (persistent across devices and visible to all)

✅ You must [set up Firebase Firestore](https://console.firebase.google.com/)  
Then paste your Firebase config inside `script.js` or `firebase.js`.

If you're not using Firebase yet, polls and rules editing will be disabled but the rest of the site works.

---

## 🔐 Commissioner Privileges

- Commissioner logs in via the Rules page.
- Can edit rules and post new polls.
- Changes to rules are logged to the events feed.

---

## 🧩 File Structure Overview

```
📁 dynasty/
├── index.html           # Homepage (Standings, Events, Overview)
├── teams.html           # Team selector and detail pages
├── analysis.html        # Trade analyzer, scoring & aging trends
├── rules.html           # Rules, polls, commissioner-only editing
├── style.css            # Unified styling (responsive + dark mode)
├── script.js            # Main JS for Sleeper/Firebase interaction
└── README.md            # This file!
```

---

## ✍️ Customization Tips

- To update league ID: Open `script.js` and update `const leagueId = 'YOUR_LEAGUE_ID'`
- To update commissioner email: Update `COMMISSIONER_EMAIL` in `rules.html`
- To add past champions: Edit `index.html` → Champions section
- To change avatars or team names: Update team names via the Sleeper league manager or override in JS

---

## 🚧 Planned Features

- Message board with topics, likes, threaded replies
- Trade history analytics
- Draft board visualization
- Improved mobile UX filtering and player stats

---

## 👏 Credits

- [Sleeper API](https://docs.sleeper.app)
- [FantasyCalc](https://fantasycalc.com)
- [Firebase](https://firebase.google.com)
- UI built using vanilla JS/CSS, hosted on GitHub Pages

---

## 📬 Questions or Feedback?

Open an issue in the repo or modify as needed. This is your league's home turf — make it yours!