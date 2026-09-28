export class Input {
  readonly down = new Set<string>();
  readonly pressed = new Set<string>();
  readonly released = new Set<string>();
  mouseX = 0;
  mouseY = 0;
  pointerLane: number | null = null;
  private bound = false;

  bind(): void {
    if (this.bound) return;
    this.bound = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('pointerdown', this.onPointer);
    window.addEventListener('pointermove', this.onPointer);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('blur', this.clear);
  }

  unbind(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointerdown', this.onPointer);
    window.removeEventListener('pointermove', this.onPointer);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('blur', this.clear);
    this.bound = false;
  }

  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
  }

  just(code: string): boolean {
    return this.pressed.has(code);
  }

  held(code: string): boolean {
    return this.down.has(code);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (
      e.code === 'Space' ||
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight'
    ) {
      e.preventDefault();
    }
    this.down.add(e.code);
    this.pressed.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
    this.released.add(e.code);
  };

  private onPointer = (e: PointerEvent): void => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    const w = window.innerWidth;
    this.pointerLane = e.buttons ? clampLane(Math.floor((e.clientX / w) * 3)) : this.pointerLane;
    if (e.type === 'pointerdown') {
      this.pressed.add('Pointer');
      this.down.add('Pointer');
      this.pointerLane = clampLane(Math.floor((e.clientX / w) * 3));
      if (e.clientY < window.innerHeight * 0.38) this.pressed.add('JumpTap');
      else if (e.clientY > window.innerHeight * 0.78) this.pressed.add('SlideTap');
    }
  };

  private onPointerUp = (): void => {
    this.down.delete('Pointer');
    this.released.add('Pointer');
    this.pointerLane = null;
  };

  private clear = (): void => {
    this.down.clear();
    this.pointerLane = null;
  };
}

function clampLane(n: number): number {
  return Math.max(0, Math.min(2, n));
}
