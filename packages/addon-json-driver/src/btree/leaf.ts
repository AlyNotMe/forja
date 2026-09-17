export function encodeLeafCell(key: string, payload: Buffer): Buffer {
  const keyBytes = Buffer.from(key, "utf8");
  const cell = Buffer.alloc(2 + keyBytes.length + 4 + 4 + 4 + payload.length);

  let offset = 0;
  cell.writeUInt16LE(keyBytes.length, offset);
  offset += 2;
  keyBytes.copy(cell, offset);
  offset += keyBytes.length;
  cell.writeUInt32LE(payload.length, offset);
  offset += 4; // totalPayloadLen
  cell.writeUInt32LE(payload.length, offset);
  offset += 4; // localPayloadLen (identique pour l'instant, pas d'overflow)
  cell.writeUInt32LE(0, offset);
  offset += 4; // overflowPage = 0 (pas d'overflow ce jalon)
  payload.copy(cell, offset);

  return cell;
}

export function decodeLeafCell(cellBytes: Buffer): {
  key: string;
  payload: Buffer;
  overflowPage: number;
} {
  let offset = 0;
  const keyLen = cellBytes.readUInt16LE(offset);
  offset += 2;
  const key = cellBytes.toString("utf8", offset, offset + keyLen);
  offset += keyLen;
  offset += 4; // totalPayloadLen — pas utilisé tant qu'il n'y a pas d'overflow, on saute
  const localPayloadLen = cellBytes.readUInt32LE(offset);
  offset += 4;
  const overflowPage = cellBytes.readUInt32LE(offset);
  offset += 4;
  const payload = cellBytes.subarray(offset, offset + localPayloadLen);

  return { key, payload, overflowPage };
}

export function readLeafKeyAt(page: Buffer, cellOffset: number): string {
  const keyLen = page.readUInt16LE(cellOffset);
  return page.toString("utf8", cellOffset + 2, cellOffset + 2 + keyLen);
}

export function getLeafCellSize(page: Buffer, cellOffset: number): number {
  const keyLen = page.readUInt16LE(cellOffset);
  const localPayloadLenOffset = cellOffset + 2 + keyLen + 4; // après keyLen + key + totalPayloadLen
  const localPayloadLen = page.readUInt32LE(localPayloadLenOffset);

  return 2 + keyLen + 4 + 4 + 4 + localPayloadLen;
}
