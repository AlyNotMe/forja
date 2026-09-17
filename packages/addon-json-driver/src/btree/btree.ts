import { MAX_LOCAL_PAYLOAD_BYTES } from "../constants";
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
import { writeOverflowChain, readOverflowChain, freeOverflowChain } from "./overflow";

async function prepareLeafPayload(
  pager: Pager,
  payload: Buffer,
): Promise<{ localPayload: Buffer; totalPayloadLen: number; overflowPage: number }> {
  if (payload.length <= MAX_LOCAL_PAYLOAD_BYTES) {
    return { localPayload: payload, totalPayloadLen: payload.length, overflowPage: 0 };
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
  const leaf = await pager.readPage(rootPage);
  const { index, found } = findCellIndex(leaf, key, readLeafKeyAt);

  if (!found) {
    return null;
  }

  const offset = getCellPointer(leaf, index);
  const cell = decodeLeafCell(
    leaf.subarray(offset, offset + getLeafCellSize(leaf, offset)),
  );

  if (cell.overflowPage === 0) {
    return cell.payload;
  }

  return readOverflowChain(pager, cell.overflowPage, cell.totalPayloadLen);
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
    const offset = getCellPointer(leaf, index);
    const existing = decodeLeafCell(
      leaf.subarray(offset, offset + getLeafCellSize(leaf, offset)),
    );
    if (existing.overflowPage !== 0) {
      await freeOverflowChain(pager, existing.overflowPage);
    }
    deleteCellAt(leaf, index);
  }

  const { localPayload, totalPayloadLen, overflowPage } = await prepareLeafPayload(
    pager,
    payload,
  );
  const cellBytes = encodeLeafCell(key, localPayload, totalPayloadLen, overflowPage);
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

  const offset = getCellPointer(leaf, index);
  const existing = decodeLeafCell(
    leaf.subarray(offset, offset + getLeafCellSize(leaf, offset)),
  );
  if (existing.overflowPage !== 0) {
    await freeOverflowChain(pager, existing.overflowPage);
  }

  deleteCellAt(leaf, index);
  await pager.writePage(rootPage, leaf);
}
