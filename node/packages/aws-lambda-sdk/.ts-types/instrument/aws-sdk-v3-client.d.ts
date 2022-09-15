interface awsSdkV3ClientInstrument {
  install(Client: Object): Function;
  uninstall(Client: Object): undefined;
}

export default awsSdkV3ClientInstrument;
