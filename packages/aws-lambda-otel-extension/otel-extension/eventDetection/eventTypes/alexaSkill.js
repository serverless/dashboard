module.exports = function eventType(e) {
  const type = 'aws.alexaskill';
  return e?.session?.attributes && e?.session?.user && e?.context?.System && e?.request?.requestId ? type : false;
};
