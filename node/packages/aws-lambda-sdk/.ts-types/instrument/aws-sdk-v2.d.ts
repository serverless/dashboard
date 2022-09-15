interface awsSdkV2Instrument {
  install(AWS: Object): Function;
  uninstall(AWS: Object): undefined;
}

export default awsSdkV2Instrument;
