export class Loop {
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;
  readonly dt = 1 / 60;
  maxFrame = 0.05;
  private readonly tick: (dt: number) => void;
  private readonly draw: (alpha: number) => void;

  constructor(tick: (dt: number) => void, draw: (alpha: number) => void) {
    this.tick = tick;
    this.draw = draw;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    let frame = (now - this.last) / 1000;
    this.last = now;
    if (frame > this.maxFrame) frame = this.maxFrame;
    this.acc += frame;
    while (this.acc >= this.dt) {
      this.tick(this.dt);
      this.acc -= this.dt;
    }
    this.draw(this.acc / this.dt);
    this.raf = requestAnimationFrame(this.frame);
  };
}
