'use strict';

const { Lambda } = require('@aws-sdk/client-lambda');
const awsRequest = require('@serverless/test/aws-request');

module.exports = async ({ region, layerName, content }) => {
  const clientConfig = { client: Lambda, params: { region } };
  const { LayerVersionArn: arn, Version: version } = await awsRequest(
    clientConfig,
    'publishLayerVersion',
    {
      LayerName: layerName,
      Content: { ZipFile: content },
    }
  );
  await awsRequest(clientConfig, 'addLayerVersionPermission', {
    LayerName: layerName,
    VersionNumber: version,
    Action: 'lambda:GetLayerVersion',
    Principal: '*',
    StatementId: 'allow-any', // id of a policy statement specific to layer version
  });

  return arn;
};
