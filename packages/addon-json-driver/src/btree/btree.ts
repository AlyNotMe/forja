import { Pager } from "../pager";
import {
  deleteCellAt,
  findCellIndex,
  getCellPointer,
  insertCell,
} from "../slottedPage";
import {
  decodeLeafCell,
  encodeLeafCell,
  getLeafCellSize,
  readLeafKeyAt,
} from "./leaf";

export async function search(
  pager: Pager,
  rootPage: number,
  key: string,
): Promise<Buffer | null> {
  const leaf = await pager.readPage(rootPage);
  const { index, found } = findCellIndex(leaf, key, readLeafKeyAt);

  if (!found) {
    return null;
  }
  const offset = getCellPointer(leaf, index);
  return decodeLeafCell(
    leaf.subarray(offset, offset + getLeafCellSize(leaf, offset)),
  ).payload;
}

export async function insert(
  pager: Pager,
  rootPage: number,
  key: string,
  payload: Buffer,
): Promise<void> {
  const leaf = await pager.readPage(rootPage);
  const { index, found } = findCellIndex(leaf, key, readLeafKeyAt);
  if (found) {
    deleteCellAt(leaf, index);
  }
  const cellBytes = encodeLeafCell(key, payload);
  insertCell(leaf, index, cellBytes);

  await pager.writePage(rootPage, leaf);
}

export async function remove(
  pager: Pager,
  rootPage: number,
  key: string,
): Promise<void> {
  const leaf = await pager.readPage(rootPage);
  const { index, found } = findCellIndex(leaf, key, readLeafKeyAt);

  if (!found) return;
  deleteCellAt(leaf, index);
  await pager.writePage(rootPage, leaf);
}
