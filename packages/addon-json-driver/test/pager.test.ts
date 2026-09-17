import { describe, it, expect, afterEach } from "vitest";
import { Pager } from "../src/pager";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

describe("Pager", () => {
  let tmpFile: string;

  afterEach(async () => {
    await fs.rm(tmpFile, { force: true });
  });

  it("round-trips a write though close and reopen", async () => {
    tmpFile = path.join(os.tmpdir(), `pager-test-${Date.now()}.db`);

    const pager1 = await Pager.open(tmpFile);
    const pageId = await pager1.allocatePage();
    await pager1.writePage(
      pageId,
      Buffer.from("hello page".padEnd(4096, "\0")),
    );
    await pager1.close();

    const pager2 = await Pager.open(tmpFile);
    const buffer = await pager2.readPage(pageId);
    await pager2.close();

    expect(buffer.toString("utf8", 0, "hello page".length)).toBe("hello page");
  });
  it("rejects a file with a bad magic", async () => {
    tmpFile = path.join(os.tmpdir(), `pager-bad-magic-${Date.now()}.db`);
    await fs.writeFile(tmpFile, Buffer.alloc(4096)); // 4096 zéros, pas le bon magic

    await expect(Pager.open(tmpFile)).rejects.toThrow(/bad magic/);
  });

  it("reuses freed page ids instead of growing pageCount", async () => {
    tmpFile = path.join(os.tmpdir(), `pager-freelist-${Date.now()}.db`);

    const pager = await Pager.open(tmpFile);
    const pageA = await pager.allocatePage();
    const pageB = await pager.allocatePage();

    await pager.freePage(pageA);
    const pageC = await pager.allocatePage(); // devrait recycler pageA

    expect(pageC).toBe(pageA);
    expect(pageC).not.toBe(pageB);
    await pager.close();
  });
});
