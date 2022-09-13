import { SdkOptions } from './';

declare function instrument(handler: Function, options?: SdkOptions): Function;
export default instrument;
