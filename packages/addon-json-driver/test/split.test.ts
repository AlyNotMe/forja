import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Pager } from "../src/pager";
import { search, insert } from "../src/btree/btree";
import { initEmptyPage } from "../src/slottedPage";
import {
  PAGE_TYPE_LEAF,
  PAGE_HEADER_OFFSET_TYPE,
  PAGE_TYPE_INTERNAL,
} from "../src/constants";

describe("btree splitting", () => {
  let tmpFile: string;

  afterEach(async () => {
    await fs.rm(tmpFile, { force: true });
  });

  async function openTestDb(
    pageSize: number,
  ): Promise<{ pager: Pager; rootPage: number }> {
    tmpFile = path.join(
      os.tmpdir(),
      `split-test-${Date.now()}-${Math.random()}.db`,
    );
    const pager = await Pager.open(tmpFile, pageSize);
    const rootPage = await pager.allocatePage();
    const leaf = await pager.readPage(rootPage);
    initEmptyPage(leaf, PAGE_TYPE_LEAF);
    await pager.writePage(rootPage, leaf);
    return { pager, rootPage };
  }

  it("keeps every key findable across many forced leaf splits", async () => {
    // TODO: openTestDb avec une petite pageSize (ex: 256) pour forcer des splits rapidement
    const { pager, rootPage } = await openTestDb(256);

    // TODO: insérer disons 100 clés (ex: "key-0" à "key-99", chacune avec un payload distinct)
    for (let i = 0; i < 100; i++) {
      await insert(pager, rootPage, i.toString(), Buffer.from(`payload-${i}`));
      const result = await search(pager, rootPage, i.toString());
      expect(result).toEqual(Buffer.from(`payload-${i}`));
    }

    for (let i = 0; i < 100; i++) {
      const result = await search(pager, rootPage, i.toString());
      expect(result).toEqual(Buffer.from(`payload-${i}`));
    }

    await pager.close();
  });

  it("grows the root into an internal node after enough splits", async () => {
    const { pager, rootPage } = await openTestDb(256);

    for (let i = 0; i < 100; i++) {
      await insert(pager, rootPage, i.toString(), Buffer.from(`payload-${i}`));
    }

    const rootBuffer = await pager.readPage(rootPage);
    expect(rootBuffer.readUInt8(PAGE_HEADER_OFFSET_TYPE)).toBe(PAGE_TYPE_INTERNAL);

    for (let i = 0; i < 100; i++) {
      const result = await search(pager, rootPage, i.toString());
      expect(result).toEqual(Buffer.from(`payload-${i}`));
    }

    await pager.close();
  });
});
