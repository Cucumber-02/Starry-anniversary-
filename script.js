const sky = document.getElementById("sky");
const captureBtn = document.getElementById("captureBtn");
const dismissBtn = document.getElementById("dismissBtn");
const dialogue = document.getElementById("dialogue");
const activeStar = document.getElementById("activeStar");
const starMessage = document.getElementById("starMessage");
const jarIcon = document.getElementById("jarIcon");
const jarModal = document.getElementById("jarModal");
const jarStars = document.getElementById("jarStars");

let starJar = [];

// ✨ CUSTOM NOTES (EDIT THIS)
const starPool = [
  { type: "normal", text: "You make my world feel calm." },
  { type: "normal", text: "I love how your mind works." },
  { type: "normal", text: "You are my favorite person." },
  { type: "rare", text: "🌟 Redeem: One free meal on me 🌟", redeemable: true },
  { type: "rare", text: "🌟 Redeem: Choose our next date 🌟", redeemable: true }
];

// Create background stars
for (let i = 0; i < 60; i++) {
  const star = document.createElement("div");
  star.className = "star";
  star.style.top = Math.random() * 100 + "vh";
  star.style.left = Math.random() * 100 + "vw";
  sky.appendChild(star);
}

// Dialogue helper
function showDialogue(text) {
  dialogue.textContent = text;
  dialogue.style.opacity = 1;
  setTimeout(() => dialogue.style.opacity = 0, 3000);
}

// Random star logic
function getRandomStar() {
  const chance = Math.random();
  const rares = starPool.filter(s => s.type === "rare");
  const normals = starPool.filter(s => s.type === "normal");

  if (chance < 0.2) {
    return rares[Math.floor(Math.random() * rares.length)];
  }
  return normals[Math.floor(Math.random() * normals.length)];
}

// Capture Star
captureBtn.onclick = () => {
  showDialogue("Oh? What’s this?");
  const star = getRandomStar();

  activeStar.className = "";
  activeStar.classList.add(star.type === "rare" ? "star rare" : "star");
  starMessage.textContent = star.text;
  activeStar.classList.remove("hidden");

  if (star.type === "rare") {
    showDialogue("✨ A rare star appeared!");
    if (star.redeemable) starJar.push(star);
  }

  captureBtn.classList.add("hidden");
  dismissBtn.classList.remove("hidden");
};

// Return Star
dismissBtn.onclick = () => {
  activeStar.classList.add("hidden");
  captureBtn.classList.remove("hidden");
  dismissBtn.classList.add("hidden");
};

// Jar
jarIcon.onclick = () => {
  jarStars.innerHTML = "";
  starJar.forEach(star => {
    const div = document.createElement("div");
    div.textContent = star.text;
    jarStars.appendChild(div);
  });
  jarModal.classList.remove("hidden");
};

function closeJar() {
  jarModal.classList.add("hidden");
}

