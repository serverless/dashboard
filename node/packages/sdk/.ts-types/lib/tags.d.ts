declare class Tags extends Map {
  set(key: string, value: boolean | number | string | Date | Array<unknown>): this;
  setMany(
    tags: Record<string, boolean | number | string | Date | Array<unknown> | null>,
    options?: { prefix?: string }
  ): Tags;
}

export default Tags;
