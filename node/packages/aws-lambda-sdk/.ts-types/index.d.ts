import TraceSpan from './lib/trace-span';
import AwsSdkV2Instrument from './instrument/aws-sdk-v2';
import AwsSdkV3ClientInstrument from './instrument/aws-sdk-v3-client';
import ExpressAppInstrument from './instrument/express-app';

interface TraceSpans {
  awsLambda: TraceSpan;
  awsLambdaInitialization: TraceSpan;
}

interface Instrument {
  awsSdkV2: AwsSdkV2Instrument;
  awsSdkV3Client: AwsSdkV3ClientInstrument;
  expressApp: ExpressAppInstrument;
}

interface Sdk {
  orgId: string;
  traceSpans: TraceSpans;
  instrument: Instrument;
}

export default Sdk;
