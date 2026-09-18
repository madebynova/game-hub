/* Camera: critically-damped follow with a little look-ahead, plus a shake
   channel. The look-ahead is what makes movement feel intentional - the view
   leads the creature slightly in the direction it is actually travelling. */

(function (EVO) {
  'use strict';

  var U = EVO.U;

  function Camera() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.targetZoom = 1;

    this.leadX = 0;
    this.leadY = 0;

    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;

    this.viewW = 1;
    this.viewH = 1;
  }

  Camera.prototype.snapTo = function (x, y) {
    this.x = x;
    this.y = y;
    this.leadX = 0;
    this.leadY = 0;
  };

  Camera.prototype.kick = function (amount) {
    this.shake = Math.min(this.shake + amount, 26);
  };

  Camera.prototype.update = function (target, dt, bounds) {
    // Lead the creature by a fraction of its velocity, eased so that stopping
    // does not snap the view back.
    var lx = U.clamp(target.vx * 0.26, -120, 120);
    var ly = U.clamp(target.vy * 0.26, -110, 110);
    this.leadX = U.damp(this.leadX, lx, 2.6, dt);
    this.leadY = U.damp(this.leadY, ly, 2.6, dt);

    var tx = target.x + this.leadX;
    var ty = target.y + this.leadY;

    this.x = U.damp(this.x, tx, 6.5, dt);
    this.y = U.damp(this.y, ty, 6.5, dt);

    this.zoom = U.damp(this.zoom, this.targetZoom, 3.2, dt);

    // Shake decays fast; the offset is re-randomised each frame.
    if (this.shake > 0.01) {
      this.shake = Math.max(0, this.shake - this.shake * 7 * dt - 6 * dt);
      var a = Math.random() * Math.PI * 2;
      this.shakeX = Math.cos(a) * this.shake;
      this.shakeY = Math.sin(a) * this.shake;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
      this.shake = 0;
    }

    if (bounds) this.clampToBounds(bounds);
  };

  Camera.prototype.clampToBounds = function (b) {
    var halfW = this.viewW / (2 * this.zoom);
    var halfH = this.viewH / (2 * this.zoom);

    // If the world is narrower than the view, centre it rather than jittering.
    if (b.w <= halfW * 2) this.x = b.w / 2;
    else this.x = U.clamp(this.x, halfW, b.w - halfW);

    if (b.h <= halfH * 2) this.y = b.h / 2;
    else this.y = U.clamp(this.y, halfH, b.h - halfH);
  };

  /* World-space rectangle currently visible, padded for culling. */
  Camera.prototype.viewRect = function (pad) {
    var p = pad || 0;
    var halfW = this.viewW / (2 * this.zoom) + p;
    var halfH = this.viewH / (2 * this.zoom) + p;
    return {
      x0: this.x - halfW, y0: this.y - halfH,
      x1: this.x + halfW, y1: this.y + halfH
    };
  };

  Camera.prototype.applyTransform = function (ctx) {
    ctx.translate(this.viewW / 2, this.viewH / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-(this.x + this.shakeX), -(this.y + this.shakeY));
  };

  EVO.Camera = Camera;
})(window.EVO);
