import TraceSpan from './lib/trace-span';

export const orgId: string;

export interface traceSpans {
  awsLambda: TraceSpan;
  awsLambdaInitialization: TraceSpan;
}
