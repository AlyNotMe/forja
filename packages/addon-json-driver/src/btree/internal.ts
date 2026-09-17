import { PAGE_HEADER_OFFSET_TYPE_SPECIFIC } from "../constants";

export function encodeInternalCell(
  key: string,
  rightChildPage: number,
): Buffer {
  const keyBytes = Buffer.from(key, "utf-8");
  const cell = Buffer.alloc(2 + keyBytes.length + 4);

  let offset = 0;
  cell.writeUInt16LE(keyBytes.length, offset);
  offset += 2;
  keyBytes.copy(cell, offset);
  offset += keyBytes.length;
  cell.writeUInt32LE(rightChildPage, offset);
  return cell;
}
export function decodeInternalCell(cellBytes: Buffer): {
  key: string;
  rightChildPage: number;
} {
  let offset = 0;
  const keyLen = cellBytes.readUInt16LE(offset);
  offset += 2;
  const key = cellBytes.toString("utf8", offset, offset + keyLen);
  offset += keyLen;
  const rightChildPage = cellBytes.readUint32LE(offset);

  return { key, rightChildPage };
}
export function readInternalKeyAt(page: Buffer, cellOffset: number): string {
  const keyLen = page.readUInt16LE(cellOffset);
  return page.toString("utf8", cellOffset + 2, cellOffset + 2 + keyLen);
}
export function getInternalCellSize(page: Buffer, cellOffset: number): number {
  const keyLen = page.readUInt16LE(cellOffset);
  return 2 + keyLen + 4;
}

export function getLeftmostChild(page: Buffer): number {
    return page.readUInt32LE(PAGE_HEADER_OFFSET_TYPE_SPECIFIC)
}
export function setLeftmostChild(page: Buffer, pageId: number): void {
    page.writeUInt32LE(pageId, PAGE_HEADER_OFFSET_TYPE_SPECIFIC)
}
