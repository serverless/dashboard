interface SdkOptions {
  orgId?: string;
  disableHttpMonitoring?: boolean;
  disableRequestResponseMonitoring?: boolean;
  disableAwsSdkMonitoring?: boolean;
  disableExpressMonitoring?: boolean;
  traceMaxCapturedBodySizeKb?: number;
}

declare function instrument(handler: Function, options?: SdkOptions): Function;
export default instrument;
