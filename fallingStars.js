// fallingStars.js
// One-by-one "catchable" falling star sequence with:
// - Spawn away from edges + not near bottom
// - Special star every N spawns (default 10)
// - Special star uses a different image
// - Special star has "glowing pixels" around it (NOT a halo)
// - Each star picks a message from lists (regular vs special)
// - Regular stars slower, special stars faster
//
// Exposes: window.FallingStarSystem

(function () {
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t) {
    t = clamp(t, 0, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function choice(arr, fallback = "") {
    if (!arr || arr.length === 0) return fallback;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  class FallingStarSystem {
    constructor(opts = {}) {
      // --- system state ---
      this.enabled = false;
      this.star = null;
      this._spawnCooldown = 0;
      this._spawnCount = 0; // counts total spawns (regular + special)

      // --- cadence ---
      this.rareEvery = opts.rareEvery ?? 10; // special every 10 stars

      // --- spawning geometry ---
      this.spawnMargin = opts.spawnMargin ?? 24;         // world px above view
      this.edgeMargin  = opts.edgeMargin ?? 48;          // keep away from left/right edges (screen px)
      this.bottomPad   = opts.bottomPad ?? 120;          // keep float point above bottom edge (screen px)

      // --- timing ---
      this.spawnDelayMin = opts.spawnDelayMin ?? 0.9;
      this.spawnDelayMax = opts.spawnDelayMax ?? 2.2;

      // speeds: regular slower, special faster
      this.baseSpeedNormal   = opts.baseSpeedNormal ?? 110;
      this.speedJitterNormal = opts.speedJitterNormal ?? 70;

      this.baseSpeedRare     = opts.baseSpeedRare ?? 190;
      this.speedJitterRare   = opts.speedJitterRare ?? 100;

      // growth
      this.minScale = opts.minScale ?? 0.06;
      this.maxScale = opts.maxScale ?? 0.55;

      // float (click window)
      this.floatDurationMin = opts.floatDurationMin ?? 1.2;
      this.floatDurationMax = opts.floatDurationMax ?? 2.2;
      this.floatAmpMin = opts.floatAmpMin ?? 6;
      this.floatAmpMax = opts.floatAmpMax ?? 14;
      this.floatHzMin  = opts.floatHzMin ?? 1.0;
      this.floatHzMax  = opts.floatHzMax ?? 1.8;

      // capture + message
      this.captureDuration = opts.captureDuration ?? 0.45;
      this.messageHold     = opts.messageHold ?? 1.1;

      // message pools (prefer external messages.js, then opts, then fallback)
      const external = window.STAR_MESSAGES || {};
      this.messages = external.normal ?? ["✨"];
      this.rareMessages = external.rare ?? ["✨ Rare ✨"];
      
      // sprite images
      this.imgNormal = new Image();
      this.imgNormal.src = opts.src ?? "star.png";
      this.normalLoaded = false;
      this.imgNormal.onload = () => { this.normalLoaded = true; };

      this.imgRare = new Image();
      this.imgRare.src = opts.rareSrc ?? "star_special.png";
      this.rareLoaded = false;
      this.imgRare.onload = () => { this.rareLoaded = true; };

      // glow pixels
      this.glowRGB = opts.glowRGB ?? "255, 230, 120";
      this.glowCount = opts.glowCount ?? 28; // number of glowing pixels around special star
    }

    // Back-compat with your index.html
    enable() { this.startSequence(); }
    disable() { this.stop(); }

    startSequence() {
      this.enabled = true;
      this.star = null;
      this._spawnCooldown = 0;
      this._spawnCount = 0;
    }

    stop() {
      this.enabled = false;
      this.star = null;
      this._spawnCooldown = 0;
      this._spawnCount = 0;
    }

    _assetsReadyFor(isRare) {
      return isRare ? this.rareLoaded : this.normalLoaded;
    }

    // screenY = worldY + camNowY
    _worldToScreenY(worldY, camNowY) {
      return worldY + camNowY;
    }

    _spawnOne(w, h, camNowY) {
      // Decide if this spawn is special
      this._spawnCount += 1;
      const isRare = (this._spawnCount % this.rareEvery === 0);

      // If the chosen asset isn't loaded yet, don't spawn now.
      if (!this._assetsReadyFor(isRare)) {
        this._spawnCount -= 1; // don't count a failed spawn
        return;
      }
      if (this.star) return;

      const topWorldY = -camNowY;
      const bottomWorldY = -camNowY + h;

      // Keep away from edges
      const m = this.edgeMargin ?? 0;
      const x = clamp(Math.random() * w, m, w - m);

      // Spawn above view so it falls in
      const y = topWorldY - this.spawnMargin - rand(0, 24);

      // Land well above bottom (avoid "end of screen")
      // bottomWorldY - bottomPad ensures the float area isn't at the bottom edge.
      const landYMax = bottomWorldY - this.bottomPad;
      const landYMin = topWorldY + h * 0.45; // ensure it gets down into view a bit
      const landY = bottomWorldY * 0.55 + (Math.random() * h * 0.12);
      // speed
      const speed = isRare
        ? (this.baseSpeedRare + rand(0, this.speedJitterRare))
        : (this.baseSpeedNormal + rand(0, this.speedJitterNormal));

      const floatDur = rand(this.floatDurationMin, this.floatDurationMax);
      const floatAmp = rand(this.floatAmpMin, this.floatAmpMax);
      const floatHz  = rand(this.floatHzMin,  this.floatHzMax);

      // Pick message now (unique per star)
      const msg = isRare ? choice(this.rareMessages, "✨ Lucky ✨") : choice(this.messages, "✨");

      this.star = {
        phase: "fall",
        rare: isRare,
        msg,

        x, y,
        vy: speed,

        t: 0,

        landY,

        floatT: 0,
        floatDur,
        floatAmp,
        floatHz,
        anchorY: 0,

        capT: 0,
        fromX: 0, fromY: 0,
        toX: 0,   toY: 0,

        msgT: 0,

        hitX: 0,
        hitY: 0,
        hitR: 0,

        ph: Math.random() * Math.PI * 2
      };
    }

    onPointerDown(px, py, w, h, camNowY) {
      if (!this.enabled) return false;
      const s = this.star;
      if (!s) return false;
      if (s.phase !== "float") return false;

      const dx = px - s.hitX;
      const dy = py - s.hitY;
      if (dx*dx + dy*dy <= s.hitR * s.hitR) {
        s.phase = "capture";
        s.capT = 0;

        s.fromX = s.hitX;
        s.fromY = s.hitY;

        s.toX = w * 0.5;
        s.toY = h * 0.5;

        return true;
      }
      return false;
    }

    update(dt, w, h, camNowY) {
      if (!this.enabled) return;

      // Spawn when none exists
      if (!this.star) {
        this._spawnCooldown -= dt;
        if (this._spawnCooldown <= 0) {
          this._spawnOne(w, h, camNowY);
          // if spawn didn't happen (assets not loaded), try again soon
          if (!this.star) this._spawnCooldown = 0.15;
        }
        return;
      }

      const s = this.star;
      s.t += dt;

      const bottomWorldY = -camNowY + h;

      if (s.phase === "fall") {
        s.y += s.vy * dt;

        if (s.y >= s.landY) {
          s.phase = "float";
          s.floatT = 0;
          s.anchorY = s.y;
        }

      } else if (s.phase === "float") {
        s.floatT += dt;

        // time out
        if (s.floatT >= s.floatDur) {
          s.phase = "fadeout";
          s.msgT = 0;
        }

      } else if (s.phase === "capture") {
        s.capT += dt;
        if (s.capT >= this.captureDuration) {
          s.phase = "message";
          s.msgT = 0;
        }

      } else if (s.phase === "message") {
        s.msgT += dt;
        if (s.msgT >= this.messageHold) {
          this.star = null;
          this._spawnCooldown = rand(this.spawnDelayMin, this.spawnDelayMax);
        }

      } else if (s.phase === "fadeout") {
        s.msgT += dt;
        if (s.msgT >= 0.35) {
          this.star = null;
          this._spawnCooldown = rand(this.spawnDelayMin, this.spawnDelayMax);
        }
      }
    }

    // Draw in SCREEN coords (identity transform)
    draw(ctx, w, h, camNowY) {
      if (!this.enabled) return;
      const s = this.star;
      if (!s) return;

      const img = s.rare ? this.imgRare : this.imgNormal;
      if (!img || img.width === 0) return;

      // growth
      const growth = clamp(s.t / 2.2, 0, 1);
      const g = Math.pow(growth, 2.0);
      const scale = lerp(this.minScale, this.maxScale, g);

      const dw = img.width * scale;
      const dh = img.height * scale;

      let cx, cy;

      if (s.phase === "fall") {
        cx = s.x;
        cy = this._worldToScreenY(s.y, camNowY);

      } else if (s.phase === "float") {
        const bob = Math.sin(s.floatT * Math.PI * 2 * s.floatHz) * s.floatAmp;
        cx = s.x;
        cy = this._worldToScreenY(s.anchorY + bob, camNowY);

      } else if (s.phase === "capture") {
        const u = clamp(s.capT / this.captureDuration, 0, 1);
        const e = easeInOut(u);
        cx = lerp(s.fromX, s.toX, e);
        cy = lerp(s.fromY, s.toY, e);

      } else if (s.phase === "message") {
        cx = w * 0.5;
        cy = h * 0.5;

      } else if (s.phase === "fadeout") {
        const bob = Math.sin(s.floatT * Math.PI * 2 * s.floatHz) * s.floatAmp;
        cx = s.x;
        cy = this._worldToScreenY(s.anchorY + bob, camNowY);
      }

      // clickable hit circle (only used in float)
      s.hitX = cx;
      s.hitY = cy;
      s.hitR = Math.max(dw, dh) * 0.62;

      // fadeout alpha
      let alpha = 1;
      if (s.phase === "fadeout") alpha = clamp(1 - (s.msgT / 0.35), 0, 1);

      // --- SPECIAL: glowing pixels cloud (NOT a halo) ---
      // Only during visible phases (fall/float/capture/message) but strongest in float
      if (s.rare && s.phase !== "fadeout") {
        const strength =
          (s.phase === "float") ? 1.0 :
          (s.phase === "fall")  ? 0.75 :
          (s.phase === "capture" ? 0.65 : 0.55);

        const pulse = 0.75 + 0.25 * Math.sin(performance.now() * 0.004 + s.ph);
        const glowA = alpha * strength * (0.22 + 0.12 * pulse);

        // scatter radius around sprite (tight cluster)
        const rBase = Math.max(dw, dh) * 0.55;

        ctx.save();
        ctx.globalAlpha = glowA;

        // draw many tiny pixels around the star
        // (pixelated feel: snap to integer px)
        for (let i = 0; i < this.glowCount; i++) {
          const a = Math.random() * Math.PI * 2;
          const rr = rBase * (0.35 + Math.random() * 0.75);
          const gx = Math.floor(cx + Math.cos(a) * rr);
          const gy = Math.floor(cy + Math.sin(a) * rr);

          // vary brightness
          const local = 0.55 + 0.45 * Math.random();
          ctx.fillStyle = `rgba(${this.glowRGB}, ${local})`;

          // use 1–2 px squares (chunky)
          const sz = (Math.random() < 0.22) ? 2 : 1;
          ctx.fillRect(gx, gy, sz, sz);
        }

        // a few steady pixels closer-in (more "glow" consistency)
        ctx.globalAlpha = alpha * strength * 0.25;
        ctx.fillStyle = `rgba(${this.glowRGB}, 1)`;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const rr = rBase * 0.35;
          const gx = Math.floor(cx + Math.cos(a) * rr);
          const gy = Math.floor(cy + Math.sin(a) * rr);
          ctx.fillRect(gx, gy, 1, 1);
        }

        ctx.restore();
      }

      // sprite
      const dx = Math.floor(cx - dw / 2);
      const dy = Math.floor(cy - dh / 2);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();

      // message
      if (s.phase === "message") {
        const u = clamp(s.msgT / this.messageHold, 0, 1);
        const msgAlpha =
          (u < 0.15) ? easeInOut(u / 0.15)
          : (u > 0.85 ? 1 - easeInOut((u - 0.85) / 0.15) : 1);

        ctx.save();
        ctx.globalAlpha = msgAlpha;

        ctx.font = "700 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        const padX = 18;
        const metrics = ctx.measureText(s.msg);
        const boxW = Math.ceil(metrics.width) + padX * 2;
        const boxH = 44;

        const bx = Math.floor(w * 0.5 - boxW / 2);
        const by = Math.floor(h * 0.5 + 42);

        ctx.fillStyle = "rgba(10, 14, 24, 0.65)";
        roundRect(ctx, bx, by, boxW, boxH, 14);
        ctx.fill();

        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1;
        roundRect(ctx, bx, by, boxW, boxH, 14);
        ctx.stroke();

        ctx.fillStyle = "rgba(255,255,255,0.94)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(s.msg, Math.floor(w * 0.5), Math.floor(by + boxH / 2));

        ctx.restore();
      }
    }
  }

  window.FallingStarSystem = FallingStarSystem;
})();