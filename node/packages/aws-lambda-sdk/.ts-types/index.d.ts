import TraceSpan from './lib/trace-span';

export interface SdkOptions {
  orgId?: string;
  disableHttpMonitoring?: boolean;
}

interface traceSpans {
  awsLambda: TraceSpan;
  awsLambdaInitialization: TraceSpan;
}

interface Sdk {
  orgId: string;
  traceSpans: traceSpans;
  initialize(options?: SdkOptions): Sdk;
}

export default Sdk;
