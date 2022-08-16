import TraceSpan from './lib/trace-span';

export interface traceSpans {
  awsLambda: TraceSpan;
  awsLambdaInitialization: TraceSpan;
}
