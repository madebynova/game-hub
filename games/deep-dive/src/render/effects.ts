import { rand } from '../core/math';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'bubble' | 'spark' | 'splash';
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  sub?: string;
  color: string;
  life: number;
  maxLife: number;
  big: boolean;
}

/** World-space particles and floating combat-style text. */
export class Effects {
  particles: Particle[] = [];
  texts: FloatText[] = [];

  bubble(x: number, y: number, size = rand(1.5, 4)) {
    this.particles.push({ x, y, vx: rand(-8, 8), vy: rand(-50, -30), life: 0, maxLife: rand(1.5, 3), size, color: '', kind: 'bubble' });
  }

  burst(x: number, y: number, color: string, count: number, speed = 160) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(speed * 0.3, speed);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, maxLife: rand(0.4, 0.9), size: rand(1.5, 3.5), color, kind: 'spark' });
    }
  }

  splash(x: number, y: number, strength = 1) {
    for (let i = 0; i < 26 * strength; i++) {
      this.particles.push({ x: x + rand(-14, 14), y, vx: rand(-110, 110), vy: rand(-320, -120) * strength, life: 0, maxLife: rand(0.5, 0.9), size: rand(2, 4.5), color: '#cdeffc', kind: 'splash' });
    }
    for (let i = 0; i < 14; i++) this.bubble(x + rand(-20, 20), y + rand(10, 50), rand(2, 6));
  }

  text(x: number, y: number, text: string, color: string, opts: { sub?: string; big?: boolean; life?: number } = {}) {
    const life = opts.life ?? 1.6;
    this.texts.push({ x, y, text, sub: opts.sub, color, life: 0, maxLife: life, big: !!opts.big });
  }

  update(dt: number) {
    for (const p of this.particles) {
      p.life += dt;
      if (p.kind === 'bubble') {
        p.vx += Math.sin((p.life + p.x) * 6) * 30 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy -= 20 * dt;
        if (p.y < 0) p.life = p.maxLife; // pop at surface
      } else if (p.kind === 'splash') {
        p.vy += 900 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y > 4 && p.vy > 0) p.life = p.maxLife;
      } else {
        p.vx *= Math.exp(-4 * dt);
        p.vy *= Math.exp(-4 * dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
    this.particles = this.particles.filter((p) => p.life < p.maxLife);
    for (const t of this.texts) t.life += dt;
    this.texts = this.texts.filter((t) => t.life < t.maxLife);
  }

  drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const k = 1 - p.life / p.maxLife;
      if (p.kind === 'bubble') {
        ctx.globalAlpha = Math.min(1, k * 2) * 0.7;
        ctx.strokeStyle = '#bfefff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(220,250,255,0.5)';
        ctx.beginPath();
        ctx.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.kind === 'spark' ? k + 0.3 : 1), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const k = t.life / t.maxLife;
      const pop = Math.min(1, t.life / 0.12);
      const alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const y = t.y - 46 * Math.sqrt(k);
      const size = (t.big ? 26 : 19) * (0.7 + 0.3 * pop);
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${size}px Rubik, system-ui, sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(3,10,22,0.85)';
      ctx.strokeText(t.text, t.x, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, y);
      if (t.sub) {
        ctx.font = `600 13px Rubik, system-ui, sans-serif`;
        ctx.lineWidth = 4;
        ctx.strokeText(t.sub, t.x, y + 18);
        ctx.fillStyle = '#e8f4f8';
        ctx.fillText(t.sub, t.x, y + 18);
      }
    }
    ctx.globalAlpha = 1;
  }
}
