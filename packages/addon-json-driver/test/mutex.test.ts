import { describe, it, expect } from "vitest";
import { AsyncMutex } from "../src/mutex";

describe("AsyncMutex", () => {
  it("serializes N concurrent read-modify-write critical sections to exactly N", async () => {
    const mutex = new AsyncMutex();
    let counter = 0;

    async function increment(): Promise<void> {
      await mutex.run(async () => {
        const current = counter;
        await new Promise((resolve) => setTimeout(resolve, 0)); // force un vrai point d'entrelacement
        counter = current + 1;
      });
    }

    const concurrentOps = 50;
    await Promise.all(Array.from({ length: concurrentOps }, () => increment()));

    expect(counter).toBe(concurrentOps);
  });

  it("still runs subsequent tasks after a task throws", async () => {
    const mutex = new AsyncMutex();
    const order: number[] = [];

    await expect(
      mutex.run(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    await mutex.run(async () => {
      order.push(1);
    });
    await mutex.run(async () => {
      order.push(2);
    });

    expect(order).toEqual([1, 2]);
  });
});
