export function encodeLeafCell(
  key: string,
  localPayload: Buffer,
  totalPayloadLen: number,
  overflowPage: number,
): Buffer {
  const keyBytes = Buffer.from(key, "utf8");
  const cell = Buffer.alloc(2 + keyBytes.length + 4 + 4 + 4 + localPayload.length);

  let offset = 0;
  cell.writeUInt16LE(keyBytes.length, offset);
  offset += 2;
  keyBytes.copy(cell, offset);
  offset += keyBytes.length;
  cell.writeUInt32LE(totalPayloadLen, offset);
  offset += 4;
  cell.writeUInt32LE(localPayload.length, offset);
  offset += 4;
  cell.writeUInt32LE(overflowPage, offset);
  offset += 4;
  localPayload.copy(cell, offset);

  return cell;
}

export function decodeLeafCell(cellBytes: Buffer): {
  key: string;
  payload: Buffer;
  totalPayloadLen: number;
  overflowPage: number;
} {
  let offset = 0;
  const keyLen = cellBytes.readUInt16LE(offset);
  offset += 2;
  const key = cellBytes.toString("utf8", offset, offset + keyLen);
  offset += keyLen;
  const totalPayloadLen = cellBytes.readUInt32LE(offset);
  offset += 4;
  const localPayloadLen = cellBytes.readUInt32LE(offset);
  offset += 4;
  const overflowPage = cellBytes.readUInt32LE(offset);
  offset += 4;
  const payload = cellBytes.subarray(offset, offset + localPayloadLen);

  return { key, payload, totalPayloadLen, overflowPage };
}

export function readLeafKeyAt(page: Buffer, cellOffset: number): string {
  const keyLen = page.readUInt16LE(cellOffset);
  return page.toString("utf8", cellOffset + 2, cellOffset + 2 + keyLen);
}

export function getLeafCellSize(page: Buffer, cellOffset: number): number {
  const keyLen = page.readUInt16LE(cellOffset);
  const localPayloadLenOffset = cellOffset + 2 + keyLen + 4;
  const localPayloadLen = page.readUInt32LE(localPayloadLenOffset);

  return 2 + keyLen + 4 + 4 + 4 + localPayloadLen;
}
