// test/slottedPage.test.ts
import { describe, it, expect } from "vitest";
import {
  getNumCells,
  getCellPointer,
  findCellIndex,
  insertCell,
  deleteCellAt,
  getFreeSpace,
  compactPage,
} from "../src/slottedPage";
import { PAGE_HEADER_SIZE } from "../src/constants";

const PAGE_SIZE = 4096;

function makeBlankPage(): Buffer {
  const page = Buffer.alloc(PAGE_SIZE);
  page.writeUInt16LE(PAGE_SIZE, 3); // cellContentStart = fin de page au départ (offset 3, cf. PAGE_HEADER_OFFSET_CELL_CONTENT_START)
  return page;
}

function makeTestCell(key: string): Buffer {
  const keyBytes = Buffer.from(key, "utf8");
  const cell = Buffer.alloc(2 + keyBytes.length);
  cell.writeUInt16LE(keyBytes.length, 0);
  keyBytes.copy(cell, 2);
  return cell;
}

function readKeyAt(page: Buffer, cellOffset: number): string {
  const keyLen = page.readUInt16LE(cellOffset);
  return page.toString("utf8", cellOffset + 2, cellOffset + 2 + keyLen);
}

function getCellSize(page: Buffer, cellOffset: number): number {
  const keyLen = page.readUInt16LE(cellOffset);
  return 2 + keyLen;
}

describe("slottedPage", () => {
  it("inserts cells in sorted order and finds them by key", () => {
    const page = makeBlankPage();
    for (const key of ["banana", "apple", "cherry"]) {
      const { index } = findCellIndex(page, key, readKeyAt);
      insertCell(page, index, makeTestCell(key));
    }

    expect(getNumCells(page)).toBe(3);

    const keysInOrder = [];
    for (let i = 0; i < getNumCells(page); i++) {
      keysInOrder.push(readKeyAt(page, getCellPointer(page, i)));
    }
    expect(keysInOrder).toEqual(["apple", "banana", "cherry"]);
  });

  it("finds an existing key and reports the right insertion point for a missing one", () => {
    const page = makeBlankPage();
    for (const key of ["1", "2", "4", "5"]) {
      const { index } = findCellIndex(page, key, readKeyAt);
      insertCell(page, index, makeTestCell(key));
    }

    expect(findCellIndex(page, "5", readKeyAt)).toEqual({
      index: 3,
      found: true,
    });
    expect(findCellIndex(page, "3", readKeyAt)).toEqual({
      index: 2,
      found: false,
    });
  });

  it("deletes a cell and frees its pointer slot", () => {
    const page = makeBlankPage();
    for (const key of ["banana", "apple", "cherry"]) {
      const { index } = findCellIndex(page, key, readKeyAt);
      insertCell(page, index, makeTestCell(key));
    }
    deleteCellAt(page, 1);
    expect(getNumCells(page)).toBe(2);

    const banana = findCellIndex(page, "banana", readKeyAt);
    const apple = findCellIndex(page, "apple", readKeyAt);
    const cherry = findCellIndex(page, "cherry", readKeyAt);
    expect(banana).toEqual({ index: 1, found: false });
    expect(apple).toEqual({ index: 0, found: true });
    expect(cherry).toEqual({ index: 1, found: true });
  });

  it("compactPage reclaims space wasted by deleted cells", () => {
    const page = makeBlankPage();
    for (const key of ["banana", "apple", "cherry"]) {
      const { index } = findCellIndex(page, key, readKeyAt);
      insertCell(page, index, makeTestCell(key));
    }

    deleteCellAt(page, 1);
    const freeSpaceBefore = getFreeSpace(page);
    compactPage(page, getCellSize);
    const freeSpaceAfter = getFreeSpace(page);

    expect(freeSpaceAfter).toBeGreaterThan(freeSpaceBefore);

    expect(readKeyAt(page, getCellPointer(page, 0))).toBe("apple");
    expect(readKeyAt(page, getCellPointer(page, 1))).toBe("cherry");
  });
});
