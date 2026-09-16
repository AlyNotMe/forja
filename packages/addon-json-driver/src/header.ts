export interface DatabaseHeader {
  pageSize: number;
  rootPage: number;
  freeListHead: number;
  pageCount: number;
  recordCount: number;
}
export function parseHeader(buffer: Buffer): DatabaseHeader {
  const magic = buffer.toString("ascii", 0, 8);
  if (magic !== "FRJAJSN1") {
    throw new Error(`invalid database file: bad magic "${magic}"`);
  }

  const pageSize = buffer.readInt16LE(8);
  const rootPage = buffer.readInt32LE(10);
  const freeListHead = buffer.readInt32LE(14);
  const pageCount = buffer.readInt32LE(18);
  const recordCount = buffer.readInt32LE(22);

  return { pageSize, rootPage, freeListHead, pageCount, recordCount };
}

export function serializeHeader(header: DatabaseHeader): Buffer {
  const buffer = Buffer.alloc(header.pageSize);

  buffer.write("FRJAJSN1", 0, "ascii");
  buffer.writeUInt16LE(header.pageSize, 8);
  buffer.writeUInt32LE(header.rootPage, 10);
  buffer.writeUInt32LE(header.freeListHead, 14);
  buffer.writeUInt32LE(header.pageCount, 18);
  buffer.writeUInt32LE(header.recordCount, 22);

  return buffer;
}
