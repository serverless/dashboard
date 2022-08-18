interface Options {
  orgId?: string;
}

declare function instrument(handler: Function, options?: Options): Function;
export default instrument;
