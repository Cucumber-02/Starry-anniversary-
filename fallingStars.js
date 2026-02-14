// fallingStars.js
// Falling stars using a pixel sprite image
// Exposes: window.FallingStarSystem

(function () {
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  class FallingStarSystem {
    constructor(opts = {}) {
      this.stars = [];

      this.enabled = false;

      this.spawnRate = opts.spawnRate ?? 0.35; // fewer = calmer
      this.maxStars  = opts.maxStars ?? 20;

      this.baseSpeed   = opts.baseSpeed ?? 120;
      this.speedJitter = opts.speedJitter ?? 90;

      this.minLife = opts.minLife ?? 2.2;
      this.maxLife = opts.maxLife ?? 3.8;

      // SUPER SMALL start, slower overall growth
      this.minScale = opts.minScale ?? 0.06;  // <-- tiny
      this.maxScale = opts.maxScale ?? 0.55;  // <-- not huge

      this.spawnMargin = opts.spawnMargin ?? 24;

      this._spawnAccumulator = 0;

      // sprite
      this.img = new Image();
      this.img.src = opts.src ?? "star.png";
      this.imgLoaded = false;

      this.img.onload = () => { this.imgLoaded = true; };
    }

    enable()  { this.enabled = true; }
    disable() { this.enabled = false; this.stars.length = 0; this._spawnAccumulator = 0; }

    _spawn(w, camNowY) {
      if (!this.imgLoaded) return;
      if (this.stars.length >= this.maxStars) return;

      const topWorldY = -camNowY;
      const x = Math.random() * w;
      const y = topWorldY - this.spawnMargin - Math.random() * 18;

      const speed = this.baseSpeed + Math.random() * this.speedJitter;
      const life  = this.minLife + Math.random() * (this.maxLife - this.minLife);

      this.stars.push({ x, y, vy: speed, t: 0, life });
    }

    update(dt, w, h, camNowY) {
      if (!this.enabled) return;
      if (!this.imgLoaded) return;

      // spawn
      this._spawnAccumulator += dt * this.spawnRate;
      while (this._spawnAccumulator >= 1) {
        this._spawnAccumulator -= 1;
        this._spawn(w, camNowY);
      }

      const bottomWorldY = -camNowY + h;

      // update
      for (let i = this.stars.length - 1; i >= 0; i--) {
        const s = this.stars[i];
        s.t += dt;
        s.y += s.vy * dt;

        if (s.t >= s.life || s.y > bottomWorldY + 140) {
          this.stars.splice(i, 1);
        }
      }
    }

    draw(ctx) {
      if (!this.enabled) return;
      if (!this.imgLoaded) return;

      for (const s of this.stars) {
        const p = clamp(s.t / s.life, 0, 1);

        // Slower growth: keep it tiny longer
        // (higher exponent => slower early growth)
        const g = Math.pow(p, 2.0);

        const scale = lerp(this.minScale, this.maxScale, g);

        const dw = this.img.width * scale;
        const dh = this.img.height * scale;

        // snap-ish to pixels so it stays crispy
        const dx = Math.floor(s.x - dw / 2);
        const dy = Math.floor(s.y - dh / 2);

        ctx.drawImage(this.img, dx, dy, dw, dh);
      }
    }
  }

  window.FallingStarSystem = FallingStarSystem;
})();
