export class AsyncMutex {
  private tail: Promise<unknown> = Promise.resolve();

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn, fn);
    this.tail = result.catch(() => {});
    return result;
  }
}
