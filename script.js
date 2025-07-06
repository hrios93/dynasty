// script.js

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, collection, addDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBTY-rF1jHLFyPjtQ5NVNTKAO7_9ts8MjI",
  authDomain: "dynastyboard.firebaseapp.com",
  projectId: "dynastyboard",
  storageBucket: "dynastyboard.firebasestorage.app",
  messagingSenderId: "437736128588",
  appId: "1:437736128588:web:5f53329d49c4b3ccc4b4e9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const RULES_DOC = "league/rules";
const POLLS_COLLECTION = "polls";

const user = {
  id: localStorage.getItem("user_id") || "guest",
  name: localStorage.getItem("user_name") || "Guest",
  isCommissioner: localStorage.getItem("is_commissioner") === "true"
};

// ---------------------- Dark Mode ----------------------
function applyDarkMode() {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const stored = localStorage.getItem("darkMode");
  if (stored === "true" || (stored === null && prefersDark)) {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
}
applyDarkMode();

document.getElementById("theme-toggle")?.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", isDark);
});

// ---------------------- Rules Editor ----------------------
async function loadRules() {
  const docRef = doc(db, RULES_DOC);
  const snap = await getDoc(docRef);
  const content = snap.exists() ? snap.data().text : "No rules set yet.";

  const display = document.getElementById("rules-display");
  const editor = document.getElementById("rules-editor");

  display.innerText = content;
  editor.value = content;

  if (user.isCommissioner) {
    document.getElementById("edit-rules-btn").style.display = "inline-block";
  }
}

function toggleRulesEdit() {
  const editor = document.getElementById("rules-editor");
  const display = document.getElementById("rules-display");
  const saveBtn = document.getElementById("save-rules-btn");

  const isEditing = editor.style.display === "block";
  editor.style.display = isEditing ? "none" : "block";
  display.style.display = isEditing ? "block" : "none";
  saveBtn.style.display = isEditing ? "none" : "inline-block";
}

async function saveRules() {
  const newText = document.getElementById("rules-editor").value;
  const docRef = doc(db, RULES_DOC);
  await setDoc(docRef, {
    text: newText,
    updatedBy: user.name,
    timestamp: serverTimestamp()
  });
  document.getElementById("rules-display").innerText = newText;
  toggleRulesEdit();
}

// ---------------------- Polling ----------------------
async function submitPoll() {
  const title = document.getElementById("poll-title").value.trim();
  const optionsText = document.getElementById("poll-options").value.trim();
  const allowMulti = document.getElementById("poll-multi").checked;
  if (!title || !optionsText) return alert("Enter title and options.");

  const options = optionsText.split("\n").map(o => o.trim()).filter(Boolean);
  const votes = options.reduce((acc, o) => ({ ...acc, [o]: [] }), {});

  await addDoc(collection(db, POLLS_COLLECTION), {
    title,
    options,
    votes,
    multi: allowMulti,
    createdBy: user.name,
    timestamp: serverTimestamp()
  });
  document.getElementById("poll-title").value = "";
  document.getElementById("poll-options").value = "";
  document.getElementById("poll-multi").checked = false;
}

function renderPoll(doc) {
  const poll = doc.data();
  const hasVoted = Object.values(poll.votes).some(v => v.includes(user.id));

  let html = `<div class="poll"><h3>${poll.title}</h3>`;
  if (!hasVoted) {
    html += poll.options.map(opt => `
      <label>
        <input type="${poll.multi ? "checkbox" : "radio"}" name="poll-${doc.id}" value="${opt}">
        ${opt}
      </label><br>
    `).join('');
    html += `<button onclick="votePoll('${doc.id}', ${poll.multi})">Vote</button>`;
  } else {
    html += `<p><em>You voted. Results:</em></p>`;
    for (const opt of poll.options) {
      const count = poll.votes[opt]?.length || 0;
      html += `<p>${opt}: ${count} vote(s)</p>`;
    }
  }
  html += `</div>`;
  return html;
}

function loadPolls() {
  const pollsFeed = document.getElementById("polls-feed");
  onSnapshot(collection(db, POLLS_COLLECTION), snapshot => {
    pollsFeed.innerHTML = snapshot.docs.map(renderPoll).join("");
  });
}

async function votePoll(pollId, multi) {
  const inputs = Array.from(document.querySelectorAll(`[name=poll-${pollId}]`));
  const selected = inputs.filter(i => i.checked).map(i => i.value);
  if (selected.length === 0) return alert("Please select an option.");

  const pollRef = doc(db, POLLS_COLLECTION, pollId);
  const snap = await getDoc(pollRef);
  const data = snap.data();

  for (const opt of data.options) {
    const isSelected = selected.includes(opt);
    const currentVotes = new Set(data.votes[opt]);
    if (isSelected) currentVotes.add(user.id);
    else currentVotes.delete(user.id);
    data.votes[opt] = Array.from(currentVotes);
  }

  await updateDoc(pollRef, { votes: data.votes });
}

// ---------------------- Init ----------------------
window.submitPoll = submitPoll;
window.votePoll = votePoll;
window.toggleRulesEdit = toggleRulesEdit;
window.saveRules = saveRules;

if (document.getElementById("rules-display")) loadRules();
if (document.getElementById("polls-feed")) loadPolls();

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBTY-rF1jHLFyPjtQ5NVNTKAO7_9ts8MjI",
  authDomain: "dynastyboard.firebaseapp.com",
  projectId: "dynastyboard",
  storageBucket: "dynastyboard.firbasestorage.app",
  messagingSenderId: "437736128588",
  appId: "1:437736128588:web:5f53329d49c4b3ccc4b4e9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Start login flow
function startLogin() {
  signInWithPopup(auth, provider)
    .then((result) => {
      console.log("Signed in:", result.user);
    })
    .catch((error) => {
      console.error("Login failed:", error);
    });
}

// Logout
function logout() {
  signOut(auth);
}

// Auth state changes
onAuthStateChanged(auth, (user) => {
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userInfo = document.getElementById("user-info");

  if (user) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline";
    userInfo.innerText = `Welcome, ${user.displayName || user.email}`;
    window.currentUser = user;
  } else {
    loginBtn.style.display = "inline";
    logoutBtn.style.display = "none";
    userInfo.innerText = "";
    window.currentUser = null;
  }
});


