import Tags from './tags';

declare class TraceSpan {
  traceId: string;
  id: string;
  parentSpan: TraceSpan | null;
  subSpans: Set<TraceSpan>;
  spans: Set<TraceSpan>;
  tags: Tags;
  input?: string;
  output?: string;

  close(): TraceSpan;
  closeContext(): undefined;
  destroy(): undefined;
  toJSON(): Object;
}

export default TraceSpan;
