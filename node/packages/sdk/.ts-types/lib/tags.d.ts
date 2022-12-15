declare class Tags extends Map {
  set(key: string, value: boolean | number | string | Date | Array): Tags;
  setMany(
    tags: Record<string, boolean | number | string | Date | Array | Null>,
    options?: { prefix?: string }
  ): Tags;
}

export default Tags;
