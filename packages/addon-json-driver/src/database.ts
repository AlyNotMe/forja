import { Pager } from "./pager";
import { AsyncMutex } from "./mutex";
import { search, insert, remove } from "./btree/btree";
import { initEmptyPage, getNumCells, getCellPointer } from "./slottedPage";
import { decodeLeafCell, getLeafCellSize } from "./btree/leaf";
import {
  decodeInternalCell,
  getInternalCellSize,
  getLeftmostChild,
} from "./btree/internal";
import { readOverflowChain } from "./btree/overflow";
import { PAGE_TYPE_LEAF, PAGE_HEADER_OFFSET_TYPE } from "./constants";

export interface JsonEngineOptions {
  pageSize?: number;
}

export interface JsonDatabase {
  get(id: string): Promise<Record<string, unknown> | null>;
  set(id: string, doc: Record<string, unknown>): Promise<void>;
  has(id: string): Promise<boolean>;
  delete(id: string): Promise<void>;
  scan(
    predicate?: (doc: Record<string, unknown>, id: string) => boolean,
  ): Promise<Array<Record<string, unknown>>>;
  close(): Promise<void>;
}

export async function openDatabase(
  filePath: string,
  options: JsonEngineOptions = {},
): Promise<JsonDatabase> {
  const pager = await Pager.open(filePath, options.pageSize);
  const mutex = new AsyncMutex();

  let rootPage = pager.getRootPage();
  if (rootPage === 0) {
    rootPage = await pager.allocatePage();
    const leaf = await pager.readPage(rootPage);
    initEmptyPage(leaf, PAGE_TYPE_LEAF);
    await pager.writePage(rootPage, leaf);
    await pager.setRootPage(rootPage);
    await pager.flush();
  }

  async function scanNode(
    pageId: number,
    results: Array<{ key: string; payload: Buffer }>,
  ): Promise<void> {
    const page = await pager.readPage(pageId);

    if (page.readUInt8(PAGE_HEADER_OFFSET_TYPE) === PAGE_TYPE_LEAF) {
      const numCells = getNumCells(page);
      for (let i = 0; i < numCells; i++) {
        const offset = getCellPointer(page, i);
        const cell = decodeLeafCell(
          page.subarray(offset, offset + getLeafCellSize(page, offset)),
        );
        const payload =
          cell.overflowPage === 0
            ? cell.payload
            : await readOverflowChain(pager, cell.overflowPage, cell.totalPayloadLen);
        results.push({ key: cell.key, payload });
      }
      return;
    }

    await scanNode(getLeftmostChild(page), results);
    const numCells = getNumCells(page);
    for (let i = 0; i < numCells; i++) {
      const offset = getCellPointer(page, i);
      const cell = decodeInternalCell(
        page.subarray(offset, offset + getInternalCellSize(page, offset)),
      );
      await scanNode(cell.rightChildPage, results);
    }
  }

  async function scanAllLeaves(): Promise<Array<{ key: string; payload: Buffer }>> {
    const results: Array<{ key: string; payload: Buffer }> = [];
    await scanNode(rootPage, results);
    return results;
  }

  return {
    get(id: string): Promise<Record<string, unknown> | null> {
      return mutex.run(async () => {
        const payload = await search(pager, rootPage, id);
        return payload ? JSON.parse(payload.toString("utf8")) : null;
      });
    },

    set(id: string, doc: Record<string, unknown>): Promise<void> {
      return mutex.run(async () => {
        const payload = Buffer.from(JSON.stringify(doc), "utf8");
        await insert(pager, rootPage, id, payload);
        await pager.flush();
      });
    },

    has(id: string): Promise<boolean> {
      return mutex.run(async () => {
        const payload = await search(pager, rootPage, id);
        return payload !== null;
      });
    },

    delete(id: string): Promise<void> {
      return mutex.run(async () => {
        await remove(pager, rootPage, id);
        await pager.flush();
      });
    },

    scan(
      predicate?: (doc: Record<string, unknown>, id: string) => boolean,
    ): Promise<Array<Record<string, unknown>>> {
      return mutex.run(async () => {
        const entries = await scanAllLeaves();
        const docs = entries.map((entry) => ({
          id: entry.key,
          doc: JSON.parse(entry.payload.toString("utf8")) as Record<string, unknown>,
        }));
        const filtered = predicate
          ? docs.filter(({ doc, id }) => predicate(doc, id))
          : docs;
        return filtered.map(({ doc }) => doc);
      });
    },

    close(): Promise<void> {
      return mutex.run(() => pager.close());
    },
  };
}
