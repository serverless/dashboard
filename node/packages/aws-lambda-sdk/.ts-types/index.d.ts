import TraceSpan from './lib/trace-span';
import AwsSdkV2Instrument from './instrument/aws-sdk-v2';
import AwsSdkV3ClientInstrument from './instrument/aws-sdk-v3-client';

interface traceSpans {
  awsLambda: TraceSpan;
  awsLambdaInitialization: TraceSpan;
}

interface instrument {
  awsSdkV2: AwsSdkV2Instrument;
  awsSdkV3Client: AwsSdkV3ClientInstrument;
}

interface Sdk {
  orgId: string;
  traceSpans: traceSpans;
  instrument: instrument;
}

export default Sdk;
