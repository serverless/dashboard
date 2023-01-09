declare class Tags extends Map {
  set(key: string, value: boolean | number | string | Date | Array<any>): Tags;
  setMany(
    tags: Record<string, boolean | number | string | Date | Array<any> | null>,
    options?: { prefix?: string }
  ): Tags;
}

export default Tags;
