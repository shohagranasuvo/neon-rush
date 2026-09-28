export class Pool<T> {
  private readonly free: T[] = [];
  private readonly factory: () => T;
  private readonly reset: (item: T) => void;
  constructor(factory: () => T, reset: (item: T) => void, prewarm = 0) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < prewarm; i++) this.free.push(factory());
  }
  acquire(): T {
    const item = this.free.pop() ?? this.factory();
    this.reset(item);
    return item;
  }
  release(item: T): void {
    this.free.push(item);
  }
}
