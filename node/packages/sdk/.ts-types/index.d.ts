import TraceSpan from '../lib/trace-span';
import ExpressAppInstrument from './instrumentation/express-app';

export interface TraceSpans {}

export interface Instrumentation {
  expressApp: ExpressAppInstrument;
}

export interface TraceSpan {
  close: () => void;
}

export interface Sdk {
  name: string;
  version: string;
  orgId: string;
  traceSpans: TraceSpans;
  instrumentation: Instrumentation;
  captureError(
    error: Error,
    options?: {
      fingerprint?: string;
      tags?: Record<string, boolean | number | string | Date | Array<unknown> | null>;
    }
  ): undefined;
  captureWarning(
    message: string,
    options?: {
      fingerprint?: string;
      tags?: Record<string, boolean | number | string | Date | Array<unknown> | null>;
    }
  ): undefined;
  setTag(name: string, value: boolean | number | string | Date | Array<unknown> | null): undefined;
  setEndpoint(endpoint: string): undefined;
  createSpan(name: string): TraceSpan;
  createSpan(name: string, closure: () => T): T;
  createSpan(name: string, closure: () => Promise<T>): Promise<T>;
}

export interface SdkOptions {
  orgId?: string;
  disableHttpMonitoring?: boolean;
  disableRequestResponseMonitoring?: boolean;
  disableExpressMonitoring?: boolean;
  disableNodeConsoleMonitoring?: boolean;
}
declare const sdk: Sdk;
export default sdk;
