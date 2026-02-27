// fallingStars.js
// One-by-one "catchable" falling star sequence (SCREEN SPACE) with:
// - Spawn away from left/right edges
// - Special star every N spawns (default 10) using different image
// - Special stars have glowing PIXELS cloud (not a ring/halo)
// - Each star picks a message from external messages.js (window.STAR_MESSAGES)
// - Regular stars slower, special stars faster
// - On catch: star flies into the jar (does NOT disappear); jar stores it
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
      this.enabled = false;
      this.star = null;
      this._spawnCooldown = 0;
      this._spawnCount = 0;

      // Rare star cadence: 6, then 7, then 8 normal spawns, repeating.
      // Start at a random point in the cycle so it feels less predictable.
      this.rareIntervals = opts.rareIntervals ?? [6, 7, 8];
      this._rareIndex = Math.floor(Math.random() * this.rareIntervals.length);
      this._sinceLastRare = 0;

      // SCREEN-space spawning
      this.spawnMargin = opts.spawnMargin ?? 24;   // spawns above top (-spawnMargin)
      this.edgeMargin  = opts.edgeMargin ?? 48;    // keep away from left/right
      this.bottomPad   = opts.bottomPad ?? 120;    // land/float above bottom

      // timing
      this.spawnDelayMin = opts.spawnDelayMin ?? 0.9;
      this.spawnDelayMax = opts.spawnDelayMax ?? 2.2;

      // speed
      this.baseSpeedNormal   = opts.baseSpeedNormal ?? 110;
      this.speedJitterNormal = opts.speedJitterNormal ?? 70;

      this.baseSpeedRare     = opts.baseSpeedRare ?? 190;
      this.speedJitterRare   = opts.speedJitterRare ?? 100;

      // growth
      this.minScale = opts.minScale ?? 0.06;
      this.maxScale = opts.maxScale ?? 0.55;
      this.uiScale = opts.uiScale ?? 1;

      // float
      this.floatDurationMin = opts.floatDurationMin ?? 1.2;
      this.floatDurationMax = opts.floatDurationMax ?? 2.2;
      this.floatAmpMin = opts.floatAmpMin ?? 6;
      this.floatAmpMax = opts.floatAmpMax ?? 14;
      this.floatHzMin  = opts.floatHzMin ?? 1.0;
      this.floatHzMax  = opts.floatHzMax ?? 1.8;

      // capture phases
      this.captureDuration = opts.captureDuration ?? 0.35; // to center
      this.messageHold     = opts.messageHold ?? 1.0;      // show message
      this.toJarDuration   = opts.toJarDuration ?? 0.55;   // fly to jar

      // message pools
      const external = window.STAR_MESSAGES || {};
      this.messages = external.normal ?? (opts.messages ?? ["✨"]);
      this.rareMessages = external.rare ?? (opts.rareMessages ?? ["✨ Rare ✨"]);

      // images
      this.imgNormal = new Image();
      this.imgNormal.src = opts.src ?? "star.png";
      this.normalLoaded = false;
      this.imgNormal.onload = () => { this.normalLoaded = true; };

      this.imgRare = new Image();
      this.imgRare.src = opts.rareSrc ?? "star_special.png";
      this.rareLoaded = false;
      this.imgRare.onload = () => { this.rareLoaded = true; };

      // glow pixels for rare
      this.glowRGB = opts.glowRGB ?? "255, 230, 120";
      this.glowCount = opts.glowCount ?? 28;

      // jar
      this.jar = opts.jar ?? null;
    }

    enable() { this.startSequence(); }
    disable() { this.stop(); }

    startSequence() {
      this.enabled = true;
      this.star = null;
      this._spawnCooldown = 0;
      this._spawnCount = 0;

      this._rareIndex = Math.floor(Math.random() * this.rareIntervals.length);
      this._sinceLastRare = 0;
    }

    stop() {
      this.enabled = false;
      this.star = null;
      this._spawnCooldown = 0;
      this._spawnCount = 0;

      this._rareIndex = Math.floor(Math.random() * this.rareIntervals.length);
      this._sinceLastRare = 0;
    }

    _assetsReadyFor(isRare) {
      return isRare ? this.rareLoaded : this.normalLoaded;
    }

    _spawnOne(w, h) {
      this._spawnCount += 1;

      // Rare star pattern: 6, 7, 8 (repeat)
      this._sinceLastRare += 1;
      const interval = this.rareIntervals[this._rareIndex];
      const isRare = (this._sinceLastRare >= interval);

      if (isRare) {
        this._sinceLastRare = 0;
        this._rareIndex = (this._rareIndex + 1) % this.rareIntervals.length;
      }

      if (!this._assetsReadyFor(isRare)) {
        this._spawnCount -= 1;
        return;
      }
      if (this.star) return;

      const m = this.edgeMargin ?? 0;
      const x = clamp(Math.random() * w, m, w - m);

      // spawn above the TOP edge
      const y = -this.spawnMargin - rand(0, 24);

      // land visible but above bottomPad
      const landTop = h * 0.35;
      const landBottom = Math.max(landTop + 10, h - this.bottomPad);
      const landY = rand(landTop, landBottom);

      const speed = isRare
        ? (this.baseSpeedRare + rand(0, this.speedJitterRare))
        : (this.baseSpeedNormal + rand(0, this.speedJitterNormal));

      const floatDur = rand(this.floatDurationMin, this.floatDurationMax);
      const floatAmp = rand(this.floatAmpMin, this.floatAmpMax) * this.uiScale;
      const floatHz  = rand(this.floatHzMin,  this.floatHzMax);

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

        jarT: 0,
        jarFromX: 0, jarFromY: 0,
        jarToX: 0,   jarToY: 0,

        msgT: 0,

        hitX: 0,
        hitY: 0,
        hitR: 0,

        ph: Math.random() * Math.PI * 2,

        dismiss: false
      };
    }

    onPointerDown(px, py, w, h) {
      if (!this.enabled) return false;
      const s = this.star;
      if (!s) return false;

      // 1st click: catch the star while it's falling or floating
      if (s.phase === "fall" || s.phase === "float") {
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

      // 2nd click: while the message is showing, click the star again to dismiss.
      if (s.phase === "message") {
        // During message phase the star is centered on screen.
        const cx = w * 0.5;
        const cy = h * 0.5;
        const dx = px - cx;
        const dy = py - cy;
        const r = s.hitR > 0 ? s.hitR : 48;
        if (dx*dx + dy*dy <= r * r) {
          s.dismiss = true;
          return true;
        }
        return false;
      }

      return false;
    }

    update(dt, w, h) {
      if (!this.enabled) return;

      // pause if overlay open (prevents weird stuff)
      if (this.jar && this.jar.overlayOpen) return;

      if (!this.star) {
        this._spawnCooldown -= dt;
        if (this._spawnCooldown <= 0) {
          this._spawnOne(w, h);
          if (!this.star) this._spawnCooldown = 0.15;
        }
        return;
      }

      const s = this.star;
      s.t += dt;

      if (s.phase === "fall") {
        s.y += s.vy * dt;
        if (s.y >= s.landY) {
          s.phase = "float";
          s.floatT = 0;
          s.anchorY = s.y;
        }

      } else if (s.phase === "float") {
        s.floatT += dt;
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
        // Show the message until the user clicks the star again.
        s.msgT += dt;

        if (s.dismiss) {
          if (this.jar && s.rare) {
            const drop = this.jar.getDropPoint(w, h);
            s.phase = "toJar";
            s.jarT = 0;
            s.jarFromX = w * 0.5;
            s.jarFromY = h * 0.5;
            s.jarToX = drop.x;
            s.jarToY = drop.y;
          } else {
            // Normal stars (or no jar) simply disappear on the 2nd click.
            this.star = null;
            this._spawnCooldown = rand(this.spawnDelayMin, this.spawnDelayMax);
          }
        }

      } else if (s.phase === "toJar") {
        s.jarT += dt;
        if (s.jarT >= this.toJarDuration) {
          // Only store *special/rare* stars in the jar.
          if (this.jar && s.rare) this.jar.addStar({ rare: true, msg: s.msg });
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

    draw(ctx, w, h) {
      if (!this.enabled) return;
      const s = this.star;
      if (!s) return;

      const img = s.rare ? this.imgRare : this.imgNormal;
      if (!img || img.width === 0) return;

      // growth
      const growth = clamp(s.t / 2.2, 0, 1);
      const g = Math.pow(growth, 2.0);
      const scale = lerp(this.minScale, this.maxScale, g);

      const dw = img.width * scale * this.uiScale;
      const dh = img.height * scale * this.uiScale;

      let cx, cy;

      if (s.phase === "fall") {
        cx = s.x;
        cy = s.y;

      } else if (s.phase === "float") {
        const bob = Math.sin(s.floatT * Math.PI * 2 * s.floatHz) * s.floatAmp;
        cx = s.x;
        cy = s.anchorY + bob;

      } else if (s.phase === "capture") {
        const u = clamp(s.capT / this.captureDuration, 0, 1);
        const e = easeInOut(u);
        cx = lerp(s.fromX, s.toX, e);
        cy = lerp(s.fromY, s.toY, e);

      } else if (s.phase === "message") {
        cx = w * 0.5;
        cy = h * 0.5;

      } else if (s.phase === "toJar") {
        const u = clamp(s.jarT / this.toJarDuration, 0, 1);
        const e = easeInOut(u);
        cx = lerp(s.jarFromX, s.jarToX, e);
        cy = lerp(s.jarFromY, s.jarToY, e);

      } else if (s.phase === "fadeout") {
        const bob = Math.sin(s.floatT * Math.PI * 2 * s.floatHz) * s.floatAmp;
        cx = s.x;
        cy = s.anchorY + bob;
      }

      // hit circle
      s.hitX = cx;
      s.hitY = cy;
      // a little extra forgiveness for touch
      s.hitR = Math.max(dw, dh) * 0.72;

      // fade alpha
      let alpha = 1;
      if (s.phase === "fadeout") alpha = clamp(1 - (s.msgT / 0.35), 0, 1);

      // Rare glow pixels cloud
      if (s.rare && s.phase !== "fadeout") {
        const strength =
          (s.phase === "float") ? 1.0 :
          (s.phase === "fall")  ? 0.75 :
          (s.phase === "capture" ? 0.65 : 0.55);

        const pulse = 0.75 + 0.25 * Math.sin(performance.now() * 0.004 + s.ph);
        const glowA = alpha * strength * (0.22 + 0.12 * pulse);
        const rBase = Math.max(dw, dh) * 0.55;

        ctx.save();
        ctx.globalAlpha = glowA;

        for (let i = 0; i < this.glowCount; i++) {
          const a = Math.random() * Math.PI * 2;
          const rr = rBase * (0.35 + Math.random() * 0.75);
          const gx = Math.floor(cx + Math.cos(a) * rr);
          const gy = Math.floor(cy + Math.sin(a) * rr);

          const local = 0.55 + 0.45 * Math.random();
          ctx.fillStyle = `rgba(${this.glowRGB}, ${local})`;

          const sz = (Math.random() < 0.22) ? 2 : 1;
          ctx.fillRect(gx, gy, sz, sz);
        }

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

      // message box
      if (s.phase === "message") {
        // Quick fade-in, then stay until the user dismisses it.
        const msgAlpha = clamp(s.msgT / 0.18, 0, 1);

        ctx.save();
        ctx.globalAlpha = msgAlpha;

        const isMobile = Math.min(window.innerWidth, window.innerHeight) < 520;
        ctx.font = isMobile
          ? "700 32px system-ui, -apple-system, Segoe UI, Roboto, Arial"
          : "700 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
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
