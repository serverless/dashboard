import TraceSpan from './lib/trace-span';
import AwsSdkV2Instrument from './instrumentation/aws-sdk-v2';
import AwsSdkV3ClientInstrument from './instrumentation/aws-sdk-v3-client';
import ExpressAppInstrument from './instrumentation/express-app';

interface TraceSpans {
  awsLambda: TraceSpan;
  awsLambdaInitialization: TraceSpan;
}

interface Instrumentation {
  awsSdkV2: AwsSdkV2Instrument;
  awsSdkV3Client: AwsSdkV3ClientInstrument;
  expressApp: ExpressAppInstrument;
}

interface Sdk {
  orgId: string;
  traceSpans: TraceSpans;
  instrumentation: Instrumentation;
  createTraceSpan(
    name: string,
    options?: {
      startTime?: bigint;
      immediateDescendants?: string[];
      tags?: Record<string, boolean | number | string | Date | Array | Null>;
      input?: string;
      output?: string;
      onCloseByRoot?: Function;
    }
  ): TraceSpan;
}

export default Sdk;
