"use strict";

const modes = {
  solo: { players: 1, title: "Solo run", rules: "Cash out to bank your streak. A crash wipes your unbanked points." },
  duel: { players: 2, title: "Duel", rules: "First crash loses the round. First to two wins takes the duel." },
  survival: { players: 3, title: "Last one standing", rules: "A crash knocks a player out. The last player in wins the round." },
};

const byId = (id) => document.getElementById(id);
const primary = byId("primary");
const bank = byId("bank");
const sound = byId("sound");
const machine = document.querySelector(".machine");
const channels = [...document.querySelectorAll(".channel")];
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const sessions = {};
let mode = "solo";
let state;
let spinning = false;
let audio;
let muted = true;
let enablingSound = false;
let highScore = 0;

try {
  const savedScore = Number(localStorage.getItem("roulette-high-score"));
  if (Number.isSafeInteger(savedScore) && savedScore > 0) highScore = savedScore;
} catch {
  // Storage availability varies when opening a local file.
}

function playerName(player) {
  return `Player ${player + 1}`;
}

function dealTiles() {
  return { tiles: channels.map(() => ""), crashTile: Math.floor(Math.random() * channels.length) };
}

function startRound(round = 1, wins = Array(modes[mode].players).fill(0)) {
  const players = wins.map((_, index) => (index + round - 1) % wins.length);
  state = sessions[mode] = {
    round, wins, players, streak: 0, result: "", channel: -1, next: null,
    ...dealTiles(), redeal: false,
    status: mode === "solo" ? "Ready to draw" : `${playerName(players[0])}'s turn`,
    detail: mode === "solo" ? "A safe tile adds one point to your streak." : "Press Enter to draw.",
  };
}

function selectMode(selected) {
  if (spinning) return;
  mode = selected;
  state = sessions[mode];
  if (!state) startRound();
  render();
}

function lightChannel(channel) {
  channels.forEach((element, index) => element.classList.toggle("active", index === channel));
}

function addScore(label, value, note = "", active = false) {
  const row = document.createElement("div");
  row.className = "score";
  row.dataset.active = String(active);
  const text = document.createElement("div");
  const name = document.createElement("span");
  name.textContent = label;
  text.append(name);
  if (note) {
    const small = document.createElement("small");
    small.textContent = note;
    text.append(small);
  }
  const number = document.createElement("strong");
  number.textContent = value;
  row.append(text, number);
  byId("scores").append(row);
}

function render() {
  const selected = modes[mode];
  machine.dataset.result = spinning ? "" : state.result;
  byId("status").textContent = spinning ? "Drawing…" : state.status;
  byId("detail").textContent = spinning ? "Revealing a tile." : state.detail;
  primary.firstElementChild.textContent = spinning ? "Drawing…" : state.next?.label ?? "Draw a tile";
  const remaining = state.tiles.filter((tile) => !tile).length;
  byId("odds").textContent = state.next ? "—" : `1/${state.redeal ? channels.length : remaining}`;
  byId("remaining").textContent = state.redeal ? "Fresh deal next" : `${remaining} ${remaining === 1 ? "tile" : "tiles"} left`;
  channels.forEach((element, index) => {
    const face = state.tiles[index];
    element.dataset.face = face;
    element.firstElementChild.textContent = face === "safe" ? "✓" : face === "crash" ? "×" : "";
  });
  primary.disabled = spinning;
  bank.hidden = mode !== "solo";
  bank.disabled = spinning || state.streak === 0 || Boolean(state.next);
  modeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    button.disabled = spinning;
  });
  byId("score-title").textContent = mode === "solo" ? selected.title : `${selected.title} · Round ${state.round}`;
  byId("rules").textContent = selected.rules;
  byId("scores").replaceChildren();
  if (mode === "solo") {
    addScore("Streak", state.streak);
    addScore("High score", highScore);
  } else {
    const active = state.next ? null : state.players[0];
    state.wins.forEach((wins, player) => {
      const note = player === active ? "Up next" : state.players.includes(player) ? "" : "Out";
      addScore(playerName(player), `${wins} ${wins === 1 ? "win" : "wins"}`, note, player === active);
    });
  }
  lightChannel(state.channel);
}

function playTone(frequency, duration, volume) {
  if (muted || audio?.state !== "running") return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;
  oscillator.type = "triangle";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

sound.addEventListener("click", async () => {
  if (enablingSound) return;
  if (muted) {
    enablingSound = true;
    try {
      audio ??= new AudioContext();
      await audio.resume();
    } catch {
      sound.textContent = "Sound unavailable";
      return;
    } finally {
      enablingSound = false;
    }
  }
  muted = !muted;
  sound.textContent = muted ? "Sound off" : "Sound on";
  sound.setAttribute("aria-pressed", String(!muted));
  playTone(460, 0.12, 0.08);
});

async function revealTile(channel) {
  lightChannel(channel);
  if (reducedMotion.matches) return;
  const animation = channels[channel].firstElementChild.animate(
    [{ transform: "translateY(0) rotateY(0deg)" },
      { transform: "translateY(-12px) rotateY(0deg)", offset: 0.45 },
      { transform: "translateY(-8px) rotateY(90deg)" }],
    { duration: 500, easing: "ease-in-out" },
  );
  await animation.finished;
}

function cashOut() {
  if (mode !== "solo" || bank.disabled) return;
  const banked = state.streak;
  const record = banked > highScore;
  if (record) {
    highScore = banked;
    try {
      localStorage.setItem("roulette-high-score", String(highScore));
    } catch {
      // Keep the record for this session when storage is unavailable.
    }
  }
  state.streak = 0;
  state.status = `Banked ${banked} ${banked === 1 ? "point" : "points"}`;
  state.detail = record ? "New high score." : "Your next run starts at zero.";
  state.next = { label: "New run", round: 1 };
  playTone(740, 0.22, 0.09);
  render();
}

function resolveSolo(crashed) {
  if (crashed) {
    state.status = "Crash";
    state.detail = `You lost ${state.streak} unbanked ${state.streak === 1 ? "point" : "points"}.`;
    state.streak = 0;
    state.next = { label: "New run", round: 1 };
  } else {
    state.streak += 1;
    state.status = "Safe";
    state.detail = "Draw again or cash out.";
  }
}

function resolveMultiplayer(crashed) {
  const player = state.players.shift();
  if (!crashed) state.players.push(player);
  state.status = crashed ? `${playerName(player)} crashed` : `${playerName(player)} is safe`;
  const nextPlayer = state.players[0];
  if (state.players.length > 1) {
    state.redeal = crashed;
    state.detail = crashed
      ? `Fresh tiles for ${playerName(nextPlayer)}.`
      : `${playerName(nextPlayer)} is up next.`;
    return;
  }

  state.wins[nextPlayer] += 1;
  const matchOver = mode === "duel" && state.wins[nextPlayer] === 2;
  state.detail = `${playerName(nextPlayer)} wins the ${matchOver ? "duel" : "round"}.`;
  state.next = {
    label: matchOver ? "Rematch" : "Next round",
    round: matchOver ? 1 : state.round + 1,
    wins: matchOver ? undefined : state.wins,
  };
}

async function takeAction() {
  if (spinning) return;
  if (state.next) {
    startRound(state.next.round, state.next.wins);
    render();
    return;
  }

  const refocus = document.activeElement === primary;
  if (state.redeal) {
    Object.assign(state, dealTiles());
    state.redeal = false;
  }
  spinning = true;
  state.channel = -1;
  render();
  const available = state.tiles.flatMap((tile, index) => tile ? [] : [index]);
  const channel = available[Math.floor(Math.random() * available.length)];
  const crashed = channel === state.crashTile;
  await revealTile(channel);
  state.channel = channel;
  state.result = crashed ? "crash" : "safe";
  state.tiles[channel] = state.result;
  if (mode === "solo") resolveSolo(crashed);
  else resolveMultiplayer(crashed);
  playTone(crashed ? 115 : 620, crashed ? 0.32 : 0.19, 0.12);
  spinning = false;
  render();
  if (refocus && document.activeElement === document.body) primary.focus();
}

modeButtons.forEach((button) => button.addEventListener("click", () => {
  selectMode(button.dataset.mode);
  primary.focus();
}));
primary.addEventListener("click", takeAction);
bank.addEventListener("click", () => {
  cashOut();
  primary.focus();
});
document.addEventListener("keydown", (event) => {
  if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey &&
      !event.repeat && event.key.toLowerCase() === "c" && !bank.disabled) {
    event.preventDefault();
    cashOut();
    primary.focus();
    return;
  }
  if (event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.key === "Enter" && event.repeat) {
    event.preventDefault();
    return;
  }
  if (event.key === "Enter" && !event.target.closest("button")) {
    event.preventDefault();
    takeAction();
  }
});
selectMode(mode);
