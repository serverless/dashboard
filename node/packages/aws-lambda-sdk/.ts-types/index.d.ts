import { Sdk, TraceSpans, Instrumentation } from '@serverless/sdk';
import TraceSpan from '@serverless/sdk/lib/trace-span';
import AwsSdkV2Instrument from './instrumentation/aws-sdk-v2';
import AwsSdkV3ClientInstrument from './instrumentation/aws-sdk-v3-client';

interface AwsLambdaTraceSpans extends TraceSpans {
  awsLambda: TraceSpan;
  awsLambdaInitialization: TraceSpan;
}

interface AwsLambdaInstrumentation extends Instrumentation {
  awsSdkV2: AwsSdkV2Instrument;
  awsSdkV3Client: AwsSdkV3ClientInstrument;
}

interface AwsLambdaSdk extends Sdk {
  traceSpans: AwsLambdaTraceSpans;
  instrumentation: AwsLambdaInstrumentation;
}

declare const sdk: AwsLambdaSdk;
export default sdk;
