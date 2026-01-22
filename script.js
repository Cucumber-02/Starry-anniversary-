const sky = document.getElementById("sky");
const scene = document.getElementById("scene");
const container = document.getElementById("starContainer");
const dialogue = document.getElementById("dialogue");
const dismissBtn = document.getElementById("dismissBtn");
const jar = document.getElementById("jarPopup");

const stars = [
  { text: "I love you 💙", rare: false },
  { text: "You’re my favorite person ✨", rare: false },
  { text: "Free meal on me 🍜", rare: true },
  { text: "One cuddle on demand 🫂", rare: true }
];

let inventory = [];
let activeStar = null;

/* Pixel sky stars */
for (let i = 0; i < 80; i++) {
  const s = document.createElement("div");
  s.className = "star-dot";
  s.style.left = Math.random() * 100 + "%";
  s.style.top = Math.random() * 100 + "%";
  sky.appendChild(s);
}

/* Capture */
document.getElementById("captureBtn").onclick = () => {
  scene.classList.add("pan");
  spawnStar();
};

function spawnStar() {
  const data = stars[Math.floor(Math.random() * stars.length)];

  const star = document.createElement("div");
  star.className = "star";
  star.style.left = "50%";

  star.innerHTML = `
    <svg viewBox="0 0 24 24" width="160" height="160">
      <polygon points="12,2 15,9 22,9 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9 9,9"
      fill="${data.rare ? '#ffd700' : 'white'}"/>
    </svg>
    <div class="star-text">${data.text}</div>
  `;

  container.appendChild(star);
  activeStar = star;

  if (data.rare) {
    dialogue.textContent = "Oh? What's this…?";
    dialogue.classList.remove("hidden");
    inventory.push(data.text);
  }

  dismissBtn.classList.remove("hidden");
}

/* Dismiss */
dismissBtn.onclick = () => {
  if (activeStar) activeStar.remove();
  dialogue.classList.add("hidden");
  dismissBtn.classList.add("hidden");
  scene.classList.remove("pan");
};

/* Jar */
document.getElementById("starJar").onclick = () => {
  jar.innerHTML = inventory.map(s => `⭐ ${s}`).join("<br>");
  jar.classList.toggle("hidden");
};

/* Shooting stars */
setInterval(() => {
  const s = document.createElement("div");
  s.className = "shooting-star";
  s.style.left = Math.random() * window.innerWidth + "px";
  s.style.top = "-50px";
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 1200);
}, 5000);
