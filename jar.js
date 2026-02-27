// jar.js
// Star Jar UI (top-right) + expandable overlay gallery.
// FIX: Jar was hard to click on mobile -> add generous hitSlop (tap margin)
// and ensure hit-testing always uses the same rect as drawing.
//
// Exposes: window.StarJarUI

(function () {
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

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

  class StarJarUI {
    constructor(opts = {}) {
      this.pad = opts.pad ?? 18;
      this.w   = opts.w   ?? 220;
      this.h   = opts.h   ?? 160;

      this.lineWidth = opts.lineWidth ?? 2;
      this.stroke = opts.stroke ?? "rgba(255,255,255,0.85)";
      this.bgOverlay = opts.bgOverlay ?? "rgba(0,0,0,0.72)";

      // NEW: extra padding around jar for easier tapping on mobile
      this.hitSlop = opts.hitSlop ?? 18; // in *device pixels* (your canvas is device-px sized)

      this.stars = []; // { rare, msg, t }
      this.overlayOpen = false;
      this.selectedIndex = -1;
    }

    // Always top-right
    getRect(w, h) {
      const x = Math.floor(w - this.w - this.pad);
      const y = Math.floor(this.pad);
      return { x, y, w: this.w, h: this.h };
    }

    getDropPoint(w, h) {
      const r = this.getRect(w, h);
      return { x: r.x + r.w * 0.5, y: r.y + r.h * 0.55 };
    }

    addStar(starData) {
      this.stars.push({ ...starData, t: performance.now() * 0.001 });
    }

    toggleOverlay() {
      this.overlayOpen = !this.overlayOpen;
      this.selectedIndex = -1;
    }

    // FIX: generous hit area (hitSlop) to make jar reliably clickable on phones
    isPointInJar(px, py, w, h) {
      const r = this.getRect(w, h);

      // Auto-scale hit slop a bit based on canvas size (still in device px)
      const auto = Math.floor(Math.min(w, h) * 0.015); // ~1.5% of screen
      const slop = clamp(Math.max(this.hitSlop, auto), 12, 42);

      const x0 = r.x - slop;
      const y0 = r.y - slop;
      const x1 = r.x + r.w + slop;
      const y1 = r.y + r.h + slop;

      return (px >= x0 && px <= x1 && py >= y0 && py <= y1);
    }

    onPointerDown(px, py, w, h) {
      // If overlay open: allow interactions inside overlay, close on outside click
      if (this.overlayOpen) {
        const panel = this._overlayPanelRect(w, h);

        // close if click outside panel
        if (!(px >= panel.x && px <= panel.x + panel.w && py >= panel.y && py <= panel.y + panel.h)) {
          this.toggleOverlay();
          return true;
        }

        const hit = this._hitTestOverlayStar(px, py, w, h);
        if (hit >= 0) {
          this.selectedIndex = hit;
          return true;
        }
        return true;
      }

      // Jar click when overlay closed
      if (this.isPointInJar(px, py, w, h)) {
        this.toggleOverlay();
        return true;
      }

      return false;
    }

    draw(ctx, w, h) {
      this._drawJar(ctx, w, h);
      if (this.overlayOpen) this._drawOverlay(ctx, w, h);
    }

    _drawJar(ctx, w, h) {
      const r = this.getRect(w, h);

      ctx.save();
      ctx.lineWidth = this.lineWidth;
      ctx.strokeStyle = this.stroke;
      ctx.strokeRect(r.x, r.y, r.w, r.h);

      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("Jar", r.x + 10, r.y + 8);

      // draw tiny stored star pixels
      const cols = 8;
      const cell = 14;
      const innerPad = 10;
      const startX = r.x + innerPad;
      const startY = r.y + r.h - innerPad - cell;

      for (let i = 0; i < this.stars.length; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = startX + col * cell;
        const y = startY - row * cell;
        if (y < r.y + 28) break;

        const s = this.stars[i];
        if (s.rare) {
          ctx.fillStyle = "rgba(255, 230, 120, 0.95)";
          ctx.fillRect(Math.floor(x), Math.floor(y), 3, 3);
          ctx.fillStyle = "rgba(255, 230, 120, 0.35)";
          ctx.fillRect(Math.floor(x) - 2, Math.floor(y) - 2, 7, 7);
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fillRect(Math.floor(x), Math.floor(y), 3, 3);
        }
      }

      ctx.restore();
    }

    _overlayPanelRect(w, h) {
      const pad = Math.floor(Math.min(w, h) * 0.08);
      const panelW = Math.min(760, w - pad * 2);
      const panelH = Math.min(520, h - pad * 2);
      const x = Math.floor(w * 0.5 - panelW * 0.5);
      const y = Math.floor(h * 0.5 - panelH * 0.5);
      return { x, y, w: panelW, h: panelH };
    }

    _drawOverlay(ctx, w, h) {
      ctx.save();

      ctx.fillStyle = this.bgOverlay;
      ctx.fillRect(0, 0, w, h);

      const panel = this._overlayPanelRect(w, h);

      ctx.fillStyle = "rgba(10, 14, 24, 0.82)";
      roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 18);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 18);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "700 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("Your Star Jar", panel.x + 18, panel.y + 16);

      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "500 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText("Tap a star to read its message. Tap outside to close.", panel.x + 18, panel.y + 42);

      const gridX = panel.x + 18;
      const gridY = panel.y + 70;
      const gridW = panel.w - 36;
      const gridH = panel.h - 150;

      const cell = 70;
      const cols = Math.max(1, Math.floor(gridW / cell));
      const rows = Math.max(1, Math.floor(gridH / cell));
      const maxCells = cols * rows;

      const count = Math.min(this.stars.length, maxCells);

      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = gridX + col * cell;
        const cy = gridY + row * cell;

        const selected = (i === this.selectedIndex);

        ctx.fillStyle = selected ? "rgba(120, 180, 255, 0.15)" : "rgba(255,255,255,0.06)";
        roundRect(ctx, cx, cy, cell - 10, cell - 10, 12);
        ctx.fill();

        ctx.strokeStyle = selected ? "rgba(120, 180, 255, 0.35)" : "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        roundRect(ctx, cx, cy, cell - 10, cell - 10, 12);
        ctx.stroke();

        const s = this.stars[i];
        const gx = cx + (cell - 10) * 0.5;
        const gy = cy + (cell - 10) * 0.5;

        if (s.rare) {
          ctx.fillStyle = "rgba(255, 230, 120, 0.35)";
          for (let k = 0; k < 18; k++) {
            const a = (k / 18) * Math.PI * 2;
            const rr = 10 + (k % 3) * 2;
            ctx.fillRect(Math.floor(gx + Math.cos(a) * rr), Math.floor(gy + Math.sin(a) * rr), 2, 2);
          }
          ctx.fillStyle = "rgba(255, 230, 120, 0.95)";
          ctx.fillRect(Math.floor(gx) - 2, Math.floor(gy) - 2, 5, 5);
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.fillRect(Math.floor(gx) - 2, Math.floor(gy) - 2, 5, 5);
        }
      }

      const msgY = panel.y + panel.h - 66;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      roundRect(ctx, panel.x + 18, msgY, panel.w - 36, 46, 14);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      roundRect(ctx, panel.x + 18, msgY, panel.w - 36, 46, 14);
      ctx.stroke();

      let msg = "No stars caught yet.";
      if (this.stars.length > 0) {
        msg = (this.selectedIndex >= 0 && this.selectedIndex < this.stars.length)
          ? this.stars[this.selectedIndex].msg
          : "Pick a star ✨";
      }

      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "600 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(msg, Math.floor(w * 0.5), Math.floor(msgY + 23));

      ctx.restore();
    }

    _hitTestOverlayStar(px, py, w, h) {
      const panel = this._overlayPanelRect(w, h);
      const gridX = panel.x + 18;
      const gridY = panel.y + 70;
      const gridW = panel.w - 36;
      const gridH = panel.h - 150;

      const cell = 70;
      const cols = Math.max(1, Math.floor(gridW / cell));
      const rows = Math.max(1, Math.floor(gridH / cell));
      const maxCells = cols * rows;

      const count = Math.min(this.stars.length, maxCells);
      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = gridX + col * cell;
        const cy = gridY + row * cell;
        const w0 = cell - 10;
        const h0 = cell - 10;
        if (px >= cx && px <= cx + w0 && py >= cy && py <= cy + h0) return i;
      }
      return -1;
    }
  }

  window.StarJarUI = StarJarUI;
})();