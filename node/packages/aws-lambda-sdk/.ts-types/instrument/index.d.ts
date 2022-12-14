import { SdkOptions } from '@serverless/sdk';

interface AwsLambdaSdkOptions extends SdkOptions {
  disableAwsSdkMonitoring?: boolean;
}

declare function instrument(handler: Function, options?: AwsLambdaSdkOptions): Function;
export default instrument;
