export const DEFAULT_PAGE_SIZE = 4096;
export const HEADER_MAGIC = "FRJAJSN1"; // 8 bytes
export const PAGE_TYPE_INTERNAL = 0x01;
export const PAGE_TYPE_LEAF = 0x02;
export const PAGE_TYPE_OVERFLOW = 0x03;
export const MAX_LOCAL_PAYLOAD_BYTES = 1024;
export const MAX_KEY_LENGTH_BYTES = 512;
// + les offsets exacts du header de page 0 (magic à l'octet 0, pageSize après, etc.)
// + les offsets du header commun 16 octets de chaque page de contenu
