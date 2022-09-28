interface expressAppInstrument {
  install(expressApp: Object): Function;
  uninstall(expressApp: Object): undefined;
}

export default expressAppInstrument;
