import TraceSpan from './lib/trace-span';
import ExpressAppInstrument from './instrumentation/express-app';

export interface TraceSpans {}

export interface Instrumentation {
  expressApp: ExpressAppInstrument;
}

export function createTraceSpan(
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

export function captureError(
  error: Error,
  options?: {
    fingerprint?: string;
    tags?: Record<string, boolean | number | string | Date | Array<unknown> | null>;
  }
): undefined;

export function captureWarning(
  message: string,
  options?: {
    fingerprint?: string;
    tags?: Record<string, boolean | number | string | Date | Array<unknown> | null>;
  }
): undefined;

export interface Sdk {
  name: string;
  version: string;
  orgId: string;
  traceSpans: TraceSpans;
  instrumentation: Instrumentation;
  createTraceSpan: typeof createTraceSpan;
  captureError: typeof captureError;
  captureWarning: typeof captureWarning;
}

export interface SdkOptions {
  orgId?: string;
  disableHttpMonitoring?: boolean;
  disableRequestResponseMonitoring?: boolean;
  disableExpressMonitoring?: boolean;
  disableNodeConsoleMonitoring?: boolean;
  traceMaxCapturedBodySizeKb?: number;
}
