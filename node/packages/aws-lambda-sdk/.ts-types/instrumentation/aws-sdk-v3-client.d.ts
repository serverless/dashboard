interface AwsSdkV3ClientInstrument {
  install(Client: Object): Function;
  uninstall(Client: Object): undefined;
}

export default AwsSdkV3ClientInstrument;
