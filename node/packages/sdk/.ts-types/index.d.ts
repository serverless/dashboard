import TraceSpan from './lib/trace-span';
import ExpressAppInstrument from './instrumentation/express-app';

export interface TraceSpans {}

export interface Instrumentation {
  expressApp: ExpressAppInstrument;
}

interface Sdk {
  name: string;
  version: string;
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
  captureError(
    error: Error,
    options?: {
      tags?: Record<string, boolean | number | string | Date | Array | Null>;
    }
  ): undefined;
}

export default Sdk;

export interface SdkOptions {
  orgId?: string;
  disableHttpMonitoring?: boolean;
  disableRequestResponseMonitoring?: boolean;
  disableExpressMonitoring?: boolean;
  traceMaxCapturedBodySizeKb?: number;
}
