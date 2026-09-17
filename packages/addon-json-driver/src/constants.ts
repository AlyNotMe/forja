export const DEFAULT_PAGE_SIZE = 4096;
export const HEADER_MAGIC = "FRJAJSN1"; // 8 bytes
export const PAGE_TYPE_INTERNAL = 0x01;
export const PAGE_TYPE_LEAF = 0x02;
export const PAGE_TYPE_OVERFLOW = 0x03;
export const MAX_LOCAL_PAYLOAD_BYTES = 1024;
export const MAX_KEY_LENGTH_BYTES = 512;


export const PAGE_HEADER_SIZE = 16;
export const PAGE_HEADER_OFFSET_TYPE = 0; // 1 octet
export const PAGE_HEADER_OFFSET_NUM_CELLS = 1; // 2 octets
export const PAGE_HEADER_OFFSET_CELL_CONTENT_START = 3; // 2 octets
export const PAGE_HEADER_OFFSET_TYPE_SPECIFIC = 5; // 4 octets (leaf: right-sibling page id, internal: leftmost-child page id)

export const CELL_POINTER_SIZE = 2;
