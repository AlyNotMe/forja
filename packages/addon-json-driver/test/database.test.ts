import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { openDatabase } from "../src/database";

describe("openDatabase", () => {
  let tmpFile: string;

  afterEach(async () => {
    await fs.rm(tmpFile, { force: true });
  });

  function tmpDbPath(): string {
    tmpFile = path.join(os.tmpdir(), `database-test-${Date.now()}-${Math.random()}.db`);
    return tmpFile;
  }

  it("set/get/has/delete round-trip", async () => {
    const db = await openDatabase(tmpDbPath());

    await db.set("user-1", { name: "Alice", age: 30 });

    expect(await db.get("user-1")).toEqual({ name: "Alice", age: 30 });
    expect(await db.has("user-1")).toBe(true);
    expect(await db.get("missing")).toBeNull();
    expect(await db.has("missing")).toBe(false);

    await db.delete("user-1");
    expect(await db.get("user-1")).toBeNull();
    expect(await db.has("user-1")).toBe(false);

    await db.close();
  });

  it("scan() returns all documents, filtered by predicate when given", async () => {
    const db = await openDatabase(tmpDbPath());

    await db.set("a", { role: "admin" });
    await db.set("b", { role: "user" });
    await db.set("c", { role: "admin" });

    const all = await db.scan();
    expect(all).toHaveLength(3);

    const admins = await db.scan((doc) => doc.role === "admin");
    expect(admins).toHaveLength(2);
    expect(admins.every((doc) => doc.role === "admin")).toBe(true);

    await db.close();
  });

  it("survives close and reopen at the same file path", async () => {
    const filePath = tmpDbPath();
    const db1 = await openDatabase(filePath);
    await db1.set("persisted", { value: 42 });
    await db1.close();

    const db2 = await openDatabase(filePath);
    expect(await db2.get("persisted")).toEqual({ value: 42 });
    await db2.close();
  });

  it("survives many concurrent writes to distinct keys without corrupting shared pages", async () => {
    const db = await openDatabase(tmpDbPath());

    const concurrentOps = 50;
    await Promise.all(
      Array.from({ length: concurrentOps }, (_, i) =>
        db.set(`key-${i}`, { index: i }),
      ),
    );

    for (let i = 0; i < concurrentOps; i++) {
      expect(await db.get(`key-${i}`)).toEqual({ index: i });
    }

    await db.close();
  });
});
