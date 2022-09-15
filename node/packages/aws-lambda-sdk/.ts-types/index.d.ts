import TraceSpan from './lib/trace-span';

interface traceSpans {
  awsLambda: TraceSpan;
  awsLambdaInitialization: TraceSpan;
}

interface Sdk {
  orgId: string;
  traceSpans: traceSpans;
}

export default Sdk;
