import {
  PAGE_HEADER_OFFSET_NUM_CELLS,
  PAGE_HEADER_OFFSET_CELL_CONTENT_START,
  PAGE_HEADER_SIZE,
  CELL_POINTER_SIZE,
  PAGE_HEADER_OFFSET_TYPE,
} from "./constants";

export function initEmptyPage(page: Buffer, pageType: number): void {
  page.writeUInt8(pageType, PAGE_HEADER_OFFSET_TYPE);
  setNumCells(page, 0);
  setCellContentStart(page, page.length);
}

export function getNumCells(page: Buffer): number {
  return page.readUInt16LE(PAGE_HEADER_OFFSET_NUM_CELLS);
}

export function getCellContentStart(page: Buffer): number {
  return page.readUInt16LE(PAGE_HEADER_OFFSET_CELL_CONTENT_START);
}

function setNumCells(page: Buffer, value: number): void {
  page.writeUInt16LE(value, PAGE_HEADER_OFFSET_NUM_CELLS);
}

function setCellContentStart(page: Buffer, value: number): void {
  page.writeUInt16LE(value, PAGE_HEADER_OFFSET_CELL_CONTENT_START);
}

export function getCellPointer(page: Buffer, index: number): number {
  const offset = PAGE_HEADER_SIZE + index * CELL_POINTER_SIZE;
  return page.readUInt16LE(offset);
}

function setCellPointer(page: Buffer, index: number, value: number): void {
  const offset = PAGE_HEADER_SIZE + index * CELL_POINTER_SIZE;
  page.writeUInt16LE(value, offset);
}

export function findCellIndex(
  page: Buffer,
  key: string,
  readKeyAt: (page: Buffer, cellOffset: number) => string,
): { index: number; found: boolean } {
  let low = 0;
  let high = getNumCells(page) - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midKey = readKeyAt(page, getCellPointer(page, mid));

    if (midKey === key) return { index: mid, found: true };
    if (midKey < key) low = mid + 1;
    else high = mid - 1;
  }

  return { index: low, found: false };
}

export function insertCell(
  page: Buffer,
  index: number,
  cellBytes: Buffer,
): void {
  const numCells = getNumCells(page);
  if (getFreeSpace(page) < cellBytes.length + CELL_POINTER_SIZE) {
    throw new Error("not enough space in page for this cell");
  }

  const newCellContentStart = getCellContentStart(page) - cellBytes.length;
  cellBytes.copy(page, newCellContentStart);
  setCellContentStart(page, newCellContentStart);

  for (let i = numCells; i > index; i--) {
    setCellPointer(page, i, getCellPointer(page, i - 1));
  }

  setCellPointer(page, index, newCellContentStart);
  setNumCells(page, numCells + 1);
}

export function deleteCellAt(page: Buffer, index: number): void {
  const numCells = getNumCells(page);

  // décaler tous les pointeurs après `index` d'un cran vers la gauche (écrase celui supprimé)
  for (let i = index; i < numCells - 1; i++) {
    setCellPointer(page, i, getCellPointer(page, i + 1));
  }

  setNumCells(page, numCells - 1);
}

export function getFreeSpace(page: Buffer): number {
  const pointerArrayEnd =
    PAGE_HEADER_SIZE + getNumCells(page) * CELL_POINTER_SIZE;
  return getCellContentStart(page) - pointerArrayEnd;
}

export function compactPage(
  page: Buffer,
  getCellSize: (page: Buffer, cellOffset: number) => number,
): void {
  const numCells = getNumCells(page);

  const cells: Buffer[] = [];
  for (let i = 0; i < numCells; i++) {
    const offset = getCellPointer(page, i);
    const size = getCellSize(page, offset);
    cells.push(Buffer.from(page.subarray(offset, offset + size)));
  }

  let writeOffset = page.length;
  for (let i = numCells - 1; i >= 0; i--) {
    writeOffset -= cells[i].length;
    cells[i].copy(page, writeOffset);
    setCellPointer(page, i, writeOffset);
  }

  setCellContentStart(page, writeOffset);
}
