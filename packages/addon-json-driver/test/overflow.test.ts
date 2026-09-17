import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Pager } from "../src/pager";
import { search, insert } from "../src/btree/btree";
import { initEmptyPage } from "../src/slottedPage";
import { PAGE_TYPE_LEAF, MAX_LOCAL_PAYLOAD_BYTES } from "../src/constants";

describe("btree overflow payloads", () => {
  let tmpFile: string;

  afterEach(async () => {
    await fs.rm(tmpFile, { force: true });
  });

  async function openTestDb(): Promise<{ pager: Pager; rootPage: number }> {
    tmpFile = path.join(
      os.tmpdir(),
      `overflow-test-${Date.now()}-${Math.random()}.db`,
    );
    const pager = await Pager.open(tmpFile);
    const rootPage = await pager.allocatePage();
    const leaf = await pager.readPage(rootPage);
    initEmptyPage(leaf, PAGE_TYPE_LEAF);
    await pager.writePage(rootPage, leaf);
    return { pager, rootPage };
  }

  it("stores a payload exactly at the local limit without overflow", async () => {
    const { pager, rootPage } = await openTestDb();
    const payload = Buffer.alloc(MAX_LOCAL_PAYLOAD_BYTES, "x");

    await insert(pager, rootPage, "exact", payload);
    const result = await search(pager, rootPage, "exact");

    expect(result).toEqual(payload);
    await pager.close();
  });

  it("stores a payload one byte over the limit via a single overflow page", async () => {
    const { pager, rootPage } = await openTestDb();
    const payload = Buffer.alloc(MAX_LOCAL_PAYLOAD_BYTES + 1, "y");

    await insert(pager, rootPage, "over-by-one", payload);
    const result = await search(pager, rootPage, "over-by-one");

    expect(result).toEqual(payload);
    await pager.close();
  });

  it("stores and reconstructs a large payload spanning multiple overflow pages", async () => {
    const { pager, rootPage } = await openTestDb();
    const payload = Buffer.from(
      Array.from({ length: 10000 }, (_, i) => i % 256),
    );

    await insert(pager, rootPage, "big", payload);
    const result = await search(pager, rootPage, "big");

    expect(result).toEqual(payload);
    await pager.close();
  });
});
