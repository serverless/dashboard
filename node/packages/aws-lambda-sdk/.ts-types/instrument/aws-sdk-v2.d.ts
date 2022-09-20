interface AwsSdkV2Instrument {
  install(AWS: Object): Function;
  uninstall(AWS: Object): undefined;
}

export default AwsSdkV2Instrument;
