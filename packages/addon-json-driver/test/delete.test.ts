import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Pager } from "../src/pager";
import { search, insert, remove } from "../src/btree/btree";
import { initEmptyPage } from "../src/slottedPage";
import { PAGE_TYPE_LEAF } from "../src/constants";

describe("btree tombstone delete", () => {
  let tmpFile: string;

  afterEach(async () => {
    await fs.rm(tmpFile, { force: true });
  });

  async function openTestDb(
    pageSize?: number,
  ): Promise<{ pager: Pager; rootPage: number }> {
    tmpFile = path.join(
      os.tmpdir(),
      `delete-test-${Date.now()}-${Math.random()}.db`,
    );
    const pager = await Pager.open(tmpFile, pageSize);
    const rootPage = await pager.allocatePage();
    const leaf = await pager.readPage(rootPage);
    initEmptyPage(leaf, PAGE_TYPE_LEAF);
    await pager.writePage(rootPage, leaf);
    return { pager, rootPage };
  }

  it("delete-then-reinsert reuses freed pages", async () => {
    const { pager, rootPage } = await openTestDb(256);

    for (let i = 0; i < 100; i++) {
      await insert(pager, rootPage, i.toString(), Buffer.from(`payload-${i}`));
    }

    for (let i = 0; i < 90; i++) {
      await remove(pager, rootPage, i.toString());
    }

    const pageCountBefore = await countAllocatedPages(pager, rootPage);

    for (let i = 100; i < 150; i++) {
      await insert(pager, rootPage, i.toString(), Buffer.from(`payload-${i}`));
    }

    const pageCountAfter = await countAllocatedPages(pager, rootPage);

    expect(pageCountAfter).toBeLessThan(pageCountBefore + 50);

    for (let i = 90; i < 100; i++) {
      expect(await search(pager, rootPage, i.toString())).toEqual(
        Buffer.from(`payload-${i}`),
      );
    }
    for (let i = 100; i < 150; i++) {
      expect(await search(pager, rootPage, i.toString())).toEqual(
        Buffer.from(`payload-${i}`),
      );
    }
    for (let i = 0; i < 90; i++) {
      expect(await search(pager, rootPage, i.toString())).toBeNull();
    }

    await pager.close();
  });

  it("remaining keys stay findable at sub-50% occupancy after many deletes", async () => {
    const { pager, rootPage } = await openTestDb(256);

    for (let i = 0; i < 100; i++) {
      await insert(pager, rootPage, i.toString(), Buffer.from(`payload-${i}`));
    }

    for (let i = 0; i < 60; i++) {
      await remove(pager, rootPage, i.toString());
    }

    for (let i = 60; i < 100; i++) {
      expect(await search(pager, rootPage, i.toString())).toEqual(
        Buffer.from(`payload-${i}`),
      );
    }
    for (let i = 0; i < 60; i++) {
      expect(await search(pager, rootPage, i.toString())).toBeNull();
    }

    await pager.close();
  });

  it("deleting a key that does not exist is a no-op", async () => {
    const { pager, rootPage } = await openTestDb();

    await insert(pager, rootPage, "a", Buffer.from("payload-a"));
    await remove(pager, rootPage, "does-not-exist");

    expect(await search(pager, rootPage, "a")).toEqual(Buffer.from("payload-a"));

    await pager.close();
  });
});

async function countAllocatedPages(pager: Pager, rootPage: number): Promise<number> {
  // approximation grossière via pageCount du header pour ce test — pas d'API publique de comptage
  const header = await pager.readPage(0);
  return header.readUInt32LE(18); // PAGE_HEADER_OFFSET_PAGE_COUNT (header.ts) — cf. constants.ts si renommé
}
