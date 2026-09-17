import { Pager } from "../pager";
import {
  OVERFLOW_HEADER_SIZE,
  OVERFLOW_OFFSET_NEXT_PAGE,
  OVERFLOW_OFFSET_VALID_BYTES,
  MAX_OVERFLOW_PAYLOAD_BYTES,
} from "../constants";

export async function writeOverflowChain(
  pager: Pager,
  payload: Buffer,
): Promise<number> {
  const chunks: Buffer[] = [];
  for (
    let offset = 0;
    offset < payload.length;
    offset += MAX_OVERFLOW_PAYLOAD_BYTES
  ) {
    chunks.push(payload.subarray(offset, offset + MAX_OVERFLOW_PAYLOAD_BYTES));
  }

  let nextPageId = 0;

  for (let i = chunks.length - 1; i >= 0; i--) {
    const pageId = await pager.allocatePage();
    const page = Buffer.alloc(pager.getPageSize());

    page.writeUInt32LE(nextPageId, OVERFLOW_OFFSET_NEXT_PAGE);
    page.writeUInt32LE(chunks[i].length, OVERFLOW_OFFSET_VALID_BYTES);
    chunks[i].copy(page, OVERFLOW_HEADER_SIZE);

    await pager.writePage(pageId, page);
    nextPageId = pageId;
  }

  return nextPageId;
}

export async function readOverflowChain(
  pager: Pager,
  firstPage: number,
  totalLength: number,
): Promise<Buffer> {
  const result = Buffer.alloc(totalLength);
  let writeOffset = 0;
  let pageId = firstPage;

  while (pageId !== 0 && writeOffset < totalLength) {
    const page = await pager.readPage(pageId);
    const nextPageId = page.readUInt32LE(OVERFLOW_OFFSET_NEXT_PAGE);
    const validBytes = page.readUInt32LE(OVERFLOW_OFFSET_VALID_BYTES);

    page.copy(
      result,
      writeOffset,
      OVERFLOW_HEADER_SIZE,
      OVERFLOW_HEADER_SIZE + validBytes,
    );
    writeOffset += validBytes;
    pageId = nextPageId;
  }

  return result;
}

export async function freeOverflowChain(
  pager: Pager,
  firstPage: number,
): Promise<void> {
  let pageId = firstPage;

  while (pageId !== 0) {
    const page = await pager.readPage(pageId);
    const nextPageId = page.readUInt32LE(OVERFLOW_OFFSET_NEXT_PAGE);
    await pager.freePage(pageId);
    pageId = nextPageId;
  }
}
