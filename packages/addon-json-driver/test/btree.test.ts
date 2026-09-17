import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Pager } from "../src/pager";
import { search, insert, remove } from "../src/btree/btree";
import { initEmptyPage } from "../src/slottedPage";
import { PAGE_TYPE_LEAF } from "../src/constants";

describe("btree (single leaf)", () => {
  let tmpFile: string;

  afterEach(async () => {
    await fs.rm(tmpFile, { force: true });
  });

  async function openTestDb(): Promise<{ pager: Pager; rootPage: number }> {
    tmpFile = path.join(
      os.tmpdir(),
      `btree-test-${Date.now()}-${Math.random()}.db`,
    );
    const pager = await Pager.open(tmpFile);
    const rootPage = await pager.allocatePage();
    const leaf = await pager.readPage(rootPage);
    initEmptyPage(leaf, PAGE_TYPE_LEAF);
    await pager.writePage(rootPage, leaf);
    return { pager, rootPage };
  }

  it("inserts multiple keys and finds them all back", async () => {
    const { pager, rootPage } = await openTestDb();

    await insert(pager, rootPage, "a", Buffer.from("payload-a"));
    await insert(pager, rootPage, "b", Buffer.from("payload-b"));
    await insert(pager, rootPage, "c", Buffer.from("payload-c"));

    expect(await search(pager, rootPage, "a")).toEqual(
      Buffer.from("payload-a"),
    );
    expect(await search(pager, rootPage, "b")).toEqual(
      Buffer.from("payload-b"),
    );
    expect(await search(pager, rootPage, "c")).toEqual(
      Buffer.from("payload-c"),
    );

    await pager.close();
  });

  it("upserts: inserting the same key twice overwrites the payload", async () => {
    const { pager, rootPage } = await openTestDb();

    await insert(pager, rootPage, "x", Buffer.from("first"));
    await insert(pager, rootPage, "x", Buffer.from("second"));

    expect(await search(pager, rootPage, "x")).toEqual(Buffer.from("second"));

    await pager.close();
  });

  it("removing a key makes it unfindable", async () => {
    const { pager, rootPage } = await openTestDb();

    await insert(pager, rootPage, "gone", Buffer.from("bye"));
    expect(await search(pager, rootPage, "gone")).toEqual(Buffer.from("bye"));

    await remove(pager, rootPage, "gone");
    expect(await search(pager, rootPage, "gone")).toBeNull();

    await pager.close();
  });
});
