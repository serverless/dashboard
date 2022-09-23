declare class TraceSpanTags extends Map {
  set(key: string, value: boolean | number | string | Date | Array): TraceSpanTags;
  setMany(
    tags: Record<string, boolean | number | string | Date | Array | Null>,
    options?: { prefix?: string }
  ): TraceSpanTags;
}

declare class TraceSpan {
  traceId: string;
  id: string;
  parentSpan: TraceSpan | null;
  subSpans: Set<TraceSpan>;
  tags: TraceSpanTags;

  close(): TraceSpan;
  spans(): Set<TraceSpan>;
  toJSON(): Object;
}

export default TraceSpan;
