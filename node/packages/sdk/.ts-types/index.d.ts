import TraceSpan from './lib/trace-span';
import ExpressAppInstrument from './instrumentation/express-app';
import sdk from './../index';

export interface TraceSpans {}

export interface Instrumentation {
  expressApp: ExpressAppInstrument;
}

export interface Sdk {
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
      tags?: Record<string, boolean | number | string | Date | Array<unknown> | null>;
      input?: string;
      output?: string;
      onCloseByRoot?: Function;
    }
  ): TraceSpan;
  captureError(
    error: Error,
    options?: {
      tags?: Record<string, boolean | number | string | Date | Array<unknown> | null>;
    }
  ): undefined;
  captureWarning(
    message: string,
    options?: {
      tags?: Record<string, boolean | number | string | Date | Array<unknown> | null>;
    }
  ): undefined;
}

export interface SdkOptions {
  orgId?: string;
  disableHttpMonitoring?: boolean;
  disableRequestResponseMonitoring?: boolean;
  disableExpressMonitoring?: boolean;
  disableNodeConsoleMonitoring?: boolean;
  traceMaxCapturedBodySizeKb?: number;
}

export default sdk;
