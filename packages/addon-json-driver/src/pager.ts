import * as fs from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { DEFAULT_PAGE_SIZE } from "./constants";
import { parseHeader, serializeHeader, type DatabaseHeader } from "./header";

export class Pager {
  private cache = new Map<number, Buffer>();
  private dirtyPages = new Set<number>();
  private header!: DatabaseHeader; // assigné juste après la construction, dans open()

  constructor(
    private fileHandle: FileHandle,
    private pageSize: number,
  ) {}

  private static async openFileHandle(filePath: string): Promise<FileHandle> {
    try {
      return await fs.open(filePath, "r+"); // existe déjà
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return await fs.open(filePath, "w+"); // n'existe pas -> le créer
      }
      throw err;
    }
  }

  static async open(
    filePath: string,
    pageSize: number = DEFAULT_PAGE_SIZE,
  ): Promise<Pager> {
    const fileHandle = await this.openFileHandle(filePath);
    const stats = await fileHandle.stat();
    const pager = new Pager(fileHandle, pageSize);

    if (stats.size === 0) {
      pager.header = {
        pageSize,
        rootPage: 0,
        freeListHead: 0,
        pageCount: 1,
        recordCount: 0,
      };
      await pager.writePage(0, serializeHeader(pager.header));
      await pager.flush();
    } else {
      pager.header = parseHeader(await pager.readPage(0));
    }

    return pager;
  }

  getPageSize(): number {
    return this.pageSize;
  }

  async readPage(pageId: number): Promise<Buffer> {
    const cached = this.cache.get(pageId);
    if (cached) return Buffer.from(cached);

    const buffer = Buffer.alloc(this.pageSize);
    await this.fileHandle.read(
      buffer,
      0,
      this.pageSize,
      pageId * this.pageSize,
    );
    this.cache.set(pageId, buffer);
    return Buffer.from(buffer);
  }

  async writePage(pageId: number, data: Buffer): Promise<void> {
    this.cache.set(pageId, data);
    this.dirtyPages.add(pageId);
  }

  async freePage(pageId: number): Promise<void> {
    const buffer = Buffer.alloc(this.pageSize);
    buffer.writeUInt32LE(this.header.freeListHead, 0);

    await this.writePage(pageId, buffer);
    this.header.freeListHead = pageId;
    await this.writePage(0, serializeHeader(this.header));
  }

  async allocatePage(): Promise<number> {
    const newPageId =
      this.header.freeListHead !== 0
        ? await this.reuseFreedPage()
        : this.growPageCount();

    await this.writePage(0, serializeHeader(this.header));
    return newPageId;
  }

  private async reuseFreedPage(): Promise<number> {
    const pageId = this.header.freeListHead;
    const freedPageBuffer = await this.readPage(pageId);
    this.header.freeListHead = freedPageBuffer.readUInt32LE(0);
    return pageId;
  }

  private growPageCount(): number {
    const pageId = this.header.pageCount;
    this.header.pageCount++;
    return pageId;
  }

  async flush(): Promise<void> {
    for (const pageId of this.dirtyPages) {
      const buffer = this.cache.get(pageId)!;
      await this.fileHandle.write(
        buffer,
        0,
        this.pageSize,
        pageId * this.pageSize,
      );
    }
    this.dirtyPages.clear();
    await this.fileHandle.sync();
  }

  async close(): Promise<void> {
    await this.flush();
    await this.fileHandle.close();
  }
}
