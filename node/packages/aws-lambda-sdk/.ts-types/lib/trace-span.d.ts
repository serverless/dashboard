declare class TraceSpanTags extends Map {
  set(key: string, value: boolean | number | string | Date): TraceSpanTags;
}

declare class TraceSpan {
  traceId: string;
  id: string;
  parentSpan: TraceSpan | null;
  subSpans: Set<TraceSpan>;
  tags: TraceSpanTags;
  createSubSpan(
    name: string,
    options?: { startTime?: bigint; immediateDescendants?: string[] }
  ): TraceSpan;
  close(): TraceSpan;
  spans(): Set<TraceSpan>;
  toJSON(): Object;
}

export default TraceSpan;
