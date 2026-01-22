const stars = [
  { text: "I love you more than you know 💙", rare: false },
  { text: "You’re my favorite person ✨", rare: false },
  { text: "Free meal on me 🍜", rare: true },
  { text: "One cuddle on demand 🫂", rare: true }
];

const btn = document.getElementById("captureBtn");
const scene = document.getElementById("scene");
const container = document.getElementById("starContainer");

btn.addEventListener("click", () => {
  scene.classList.add("pan-up");
  createStar();
});

function createStar() {
  const starData = stars[Math.floor(Math.random() * stars.length)];

  const star = document.createElement("div");
  star.className = "star";
  star.style.left = "50%";
  star.style.top = "0px";
  star.style.transform = "translateX(-50%)";

  const svg = `
    <svg viewBox="0 0 24 24" width="120" height="120">
      <polygon 
        points="12,2 15,9 22,9 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9 9,9"
        fill="${starData.rare ? '#ffd700' : 'white'}"
      />
    </svg>
  `;

  star.innerHTML = svg;

  const text = document.createElement("div");
  text.className = "star-text";
  text.innerText = starData.text;

  star.appendChild(text);
  container.appendChild(star);

  setTimeout(() => {
    star.remove();
    scene.classList.remove("pan-up");
  }, 5000);
}

/* Shooting stars */
function createShootingStar() {
  const s = document.createElement("div");
  s.className = "shooting-star";
  document.body.appendChild(s);

  s.style.left = Math.random() * window.innerWidth + "px";
  s.style.top = "-50px";

  setTimeout(() => s.remove(), 1500);
}

setInterval(createShootingStar, 4000);
