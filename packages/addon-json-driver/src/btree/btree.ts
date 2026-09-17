import {
  MAX_LOCAL_PAYLOAD_BYTES,
  PAGE_HEADER_OFFSET_TYPE,
  PAGE_TYPE_INTERNAL,
  PAGE_TYPE_LEAF,
} from "../constants";
import { Pager } from "../pager";
import {
  compactPage,
  deleteCellAt,
  findCellIndex,
  getCellPointer,
  getNumCells,
  initEmptyPage,
  insertCell,
} from "../slottedPage";
import {
  decodeInternalCell,
  encodeInternalCell,
  getInternalCellSize,
  getLeftmostChild,
  readInternalKeyAt,
  setLeftmostChild,
} from "./internal";
import {
  decodeLeafCell,
  encodeLeafCell,
  getLeafCellSize,
  readLeafKeyAt,
} from "./leaf";
import {
  writeOverflowChain,
  readOverflowChain,
  freeOverflowChain,
} from "./overflow";

async function prepareLeafPayload(
  pager: Pager,
  payload: Buffer,
): Promise<{
  localPayload: Buffer;
  totalPayloadLen: number;
  overflowPage: number;
}> {
  if (payload.length <= MAX_LOCAL_PAYLOAD_BYTES) {
    return {
      localPayload: payload,
      totalPayloadLen: payload.length,
      overflowPage: 0,
    };
  }

  const localPayload = payload.subarray(0, MAX_LOCAL_PAYLOAD_BYTES);
  const overflowPage = await writeOverflowChain(pager, payload);
  return { localPayload, totalPayloadLen: payload.length, overflowPage };
}

export async function search(
  pager: Pager,
  rootPage: number,
  key: string,
): Promise<Buffer | null> {
  let pageId = rootPage;
  let page = await pager.readPage(pageId);

  while (page.readUInt8(PAGE_HEADER_OFFSET_TYPE) !== PAGE_TYPE_LEAF) {
    pageId = findChildPage(page, key);
    page = await pager.readPage(pageId);
  }
  const { index, found } = findCellIndex(page, key, readLeafKeyAt);

  if (!found) {
    return null;
  }

  const offset = getCellPointer(page, index);
  const cell = decodeLeafCell(
    page.subarray(offset, offset + getLeafCellSize(page, offset)),
  );

  if (cell.overflowPage === 0) {
    return cell.payload;
  }

  return readOverflowChain(pager, cell.overflowPage, cell.totalPayloadLen);
}
type SplitResult = { separatorKey: string; newRightPageId: number } | null;

async function insertIntoNode(
  pager: Pager,
  pageId: number,
  key: string,
  payload: Buffer,
): Promise<SplitResult> {
  const page = await pager.readPage(pageId);
  const pageType = page.readUInt8(PAGE_HEADER_OFFSET_TYPE);

  if (pageType === PAGE_TYPE_LEAF) {
    return insertIntoLeaf(pager, pageId, page, key, payload);
  } else {
    return insertIntoInternal(pager, pageId, page, key, payload);
  }
}
async function insertIntoLeaf(
  pager: Pager,
  pageId: number,
  page: Buffer,
  key: string,
  payload: Buffer,
): Promise<SplitResult> {
  const { index, found } = findCellIndex(page, key, readLeafKeyAt);

  if (found) {
    const offset = getCellPointer(page, index);
    const existing = decodeLeafCell(
      page.subarray(offset, offset + getLeafCellSize(page, offset)),
    );
    if (existing.overflowPage !== 0) {
      await freeOverflowChain(pager, existing.overflowPage);
    }
    deleteCellAt(page, index);
  }

  const { localPayload, totalPayloadLen, overflowPage } =
    await prepareLeafPayload(pager, payload);
  const cellBytes = encodeLeafCell(
    key,
    localPayload,
    totalPayloadLen,
    overflowPage,
  );

  try {
    insertCell(page, index, cellBytes);
    await pager.writePage(pageId, page);
    return null;
  } catch {
    return splitLeafPage(pager, pageId, page, index, cellBytes);
  }
}

async function splitLeafPage(
  pager: Pager,
  pageId: number,
  fullLeaf: Buffer,
  insertIndex: number,
  newCellBytes: Buffer,
): Promise<SplitResult> {
  const numCells = getNumCells(fullLeaf);
  const cells: Buffer[] = new Array();

  for (let i = 0; i < numCells; i++) {
    const offset = getCellPointer(fullLeaf, i);
    const size = getLeafCellSize(fullLeaf, offset);
    cells.push(Buffer.from(fullLeaf.subarray(offset, offset + size)));
  }
  cells.splice(insertIndex, 0, newCellBytes);
  const mid = Math.ceil(cells.length / 2);
  const left = cells.splice(0, mid);
  const right = cells;

  const newPageId = await pager.allocatePage();
  const page = await pager.readPage(newPageId);
  initEmptyPage(page, PAGE_TYPE_LEAF);
  for (const [index, buffer] of right.entries()) {
    insertCell(page, index, buffer);
  }

  initEmptyPage(fullLeaf, PAGE_TYPE_LEAF);
  for (const [index, buffer] of left.entries()) {
    insertCell(fullLeaf, index, buffer);
  }

  await pager.writePage(pageId, fullLeaf);
  await pager.writePage(newPageId, page);

  const separatorOffset = getCellPointer(page, 0);
  const separatorKey = readLeafKeyAt(page, separatorOffset);
  return { separatorKey, newRightPageId: newPageId };
}
async function insertIntoInternal(
  pager: Pager,
  pageId: number,
  page: Buffer,
  key: string,
  payload: Buffer,
): Promise<SplitResult> {
  const childPageId = findChildPage(page, key);
  const childSplit = await insertIntoNode(pager, childPageId, key, payload);

  if (childSplit === null) {
    return null; // rien à propager, l'enfant a absorbé l'insertion normalement
  }

  // l'enfant a splitté -> il faut insérer (separatorKey, newRightPageId) dans CE nœud internal
  const { index } = findCellIndex(
    page,
    childSplit.separatorKey,
    readInternalKeyAt,
  );
  const cellBytes = encodeInternalCell(
    childSplit.separatorKey,
    childSplit.newRightPageId,
  );

  try {
    insertCell(page, index, cellBytes);
    await pager.writePage(pageId, page);
    return null;
  } catch {
    return splitInternalPage(pager, pageId, page, index, cellBytes);
  }
}
async function splitInternalPage(
  pager: Pager,
  pageId: number,
  fullPage: Buffer,
  insertIndex: number,
  newCellBytes: Buffer,
): Promise<SplitResult> {
  const numCells = getNumCells(fullPage);
  const entries: { key: string; rightChildPage: number }[] = [];

  for (let i = 0; i < numCells; i++) {
    const offset = getCellPointer(fullPage, i);
    const size = getInternalCellSize(fullPage, offset);
    entries.push(decodeInternalCell(fullPage.subarray(offset, offset + size)));
  }
  const { key: newKey, rightChildPage: newRightChild } =
    decodeInternalCell(newCellBytes);
  entries.splice(insertIndex, 0, {
    key: newKey,
    rightChildPage: newRightChild,
  });

  const mid = Math.floor(entries.length / 2);
  const leftEntries = entries.slice(0, mid);
  const medianEntry = entries[mid]; // celle-ci MONTE au parent, ne reste nulle part
  const rightEntries = entries.slice(mid + 1);

  const originalLeftmostChild = getLeftmostChild(fullPage);

  const newPageId = await pager.allocatePage();
  const newPage = await pager.readPage(newPageId);
  initEmptyPage(newPage, PAGE_TYPE_INTERNAL);
  setLeftmostChild(newPage, medianEntry.rightChildPage); // l'enfant droit du médian devient le leftmost du nouveau nœud
  rightEntries.forEach((entry, i) => {
    insertCell(newPage, i, encodeInternalCell(entry.key, entry.rightChildPage));
  });

  initEmptyPage(fullPage, PAGE_TYPE_INTERNAL);
  setLeftmostChild(fullPage, originalLeftmostChild); // inchangé, la moitié gauche garde le même leftmost
  leftEntries.forEach((entry, i) => {
    insertCell(
      fullPage,
      i,
      encodeInternalCell(entry.key, entry.rightChildPage),
    );
  });

  await pager.writePage(pageId, fullPage);
  await pager.writePage(newPageId, newPage);

  return { separatorKey: medianEntry.key, newRightPageId: newPageId };
}

function findChildPage(page: Buffer, key: string): number {
  const { index, found } = findCellIndex(page, key, readInternalKeyAt);
  const effectiveIndex = found ? index + 1 : index;

  if (effectiveIndex === 0) {
    return getLeftmostChild(page);
  }

  const offset = getCellPointer(page, effectiveIndex - 1);
  return decodeInternalCell(
    page.subarray(offset, offset + getInternalCellSize(page, offset)),
  ).rightChildPage;
}

export async function insert(
  pager: Pager,
  rootPage: number,
  key: string,
  payload: Buffer,
): Promise<void> {
  const rootSplit = await insertIntoNode(pager, rootPage, key, payload);

  if (rootSplit === null) {
    return;
  }

  // la racine a splitté -> il faut lui faire gagner un niveau, en gardant rootPage comme même id
  const oldRootContent = await pager.readPage(rootPage);

  const newLeftPageId = await pager.allocatePage();
  await pager.writePage(newLeftPageId, oldRootContent); // copie de l'ancien contenu de la racine

  const newRootPage = Buffer.alloc(pager.getPageSize());
  initEmptyPage(newRootPage, PAGE_TYPE_INTERNAL);
  setLeftmostChild(newRootPage, newLeftPageId);
  insertCell(
    newRootPage,
    0,
    encodeInternalCell(rootSplit.separatorKey, rootSplit.newRightPageId),
  );

  await pager.writePage(rootPage, newRootPage);
}

export async function remove(
  pager: Pager,
  rootPage: number,
  key: string,
): Promise<void> {
  await removeFromNode(pager, rootPage, key, true);
}

async function removeFromNode(
  pager: Pager,
  pageId: number,
  key: string,
  isRoot = false,
): Promise<boolean> {
  const page = await pager.readPage(pageId);
  const pageType = page.readUInt8(PAGE_HEADER_OFFSET_TYPE);

  if (pageType === PAGE_TYPE_LEAF) {
    return removeFromLeaf(pager, pageId, page, key, isRoot);
  }
  return removeFromInternal(pager, pageId, page, key);
}

async function removeFromLeaf(
  pager: Pager,
  pageId: number,
  page: Buffer,
  key: string,
  isRoot: boolean,
): Promise<boolean> {
  const { index, found } = findCellIndex(page, key, readLeafKeyAt);
  if (!found) return false;

  const offset = getCellPointer(page, index);
  const existing = decodeLeafCell(
    page.subarray(offset, offset + getLeafCellSize(page, offset)),
  );
  if (existing.overflowPage !== 0) {
    await freeOverflowChain(pager, existing.overflowPage);
  }

  deleteCellAt(page, index);
  compactPage(page, getLeafCellSize);

  const isEmpty = getNumCells(page) === 0;
  if (isEmpty && !isRoot) {
    await pager.freePage(pageId);
    return true;
  }

  await pager.writePage(pageId, page);
  return false;
}

async function removeFromInternal(
  pager: Pager,
  pageId: number,
  page: Buffer,
  key: string,
): Promise<boolean> {
  const childPageId = findChildPage(page, key);
  const childBecameEmpty = await removeFromNode(pager, childPageId, key);

  if (!childBecameEmpty) return false;

  if (childPageId === getLeftmostChild(page)) {
    if (getNumCells(page) === 0) {
      await pager.writePage(pageId, page); // dégénéré, rien à débrancher de plus
      return false;
    }
    const offset = getCellPointer(page, 0);
    const firstCell = decodeInternalCell(
      page.subarray(offset, offset + getInternalCellSize(page, offset)),
    );
    setLeftmostChild(page, firstCell.rightChildPage);
    deleteCellAt(page, 0);
  } else {
    const numCells = getNumCells(page);
    for (let i = 0; i < numCells; i++) {
      const offset = getCellPointer(page, i);
      const cell = decodeInternalCell(
        page.subarray(offset, offset + getInternalCellSize(page, offset)),
      );
      if (cell.rightChildPage === childPageId) {
        deleteCellAt(page, i);
        break;
      }
    }
  }

  await pager.writePage(pageId, page);
  return false;
}
