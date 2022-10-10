# Serverless Dev Mode Extension
This extension layer will forward logs from your lambda function to serverless console dev mode.

> This layer is utilizing [lambda logs API](https://docs.aws.amazon.com/lambda/latest/dg/runtimes-logs-api.html). It is important to note that the lambda logs API is not necessarily meant to forward logs in real time. Logs are really mean to be batched and sent out. This means that in this project we added a wait process that will keep the lambda function running until all logs have been posted. This means that you probably shouldn't run this extension in a production environment where longer running lambda functions will result in high costs.

## Development
There isn't much you have to do to build/deploy this code. Simply run the following command and the code will be deployed to whatever AWS account your AWS CLI is configured for.
```shell
make deploy
```

The command above will output a layer arn once successfully deployed.

After the layer is deployed you can attach this layer to any lambda function, just be sure to create the following environment variables.

|Env Variable | Description | Required |
|--|--|--|
| `SLS_DEV_MODE_ORG_ID` | This is the id of the org that you will be publishing to | `true` |
| `SLS_PUBLISH_ENDPOINT` | This is endpoint that you want logs to be forwarded to. This is helpful if you are trying to send logs to dev. | `false` |

## Testing
This app is reusing unit tests from our node extension so the unit tests live in `../node/packages/aws-lambda-otel-extension/test/unit/external/index.test.ts`

These tests will spin up a local server that emulates the lambda API server.

To run these tests locally simply run

```shell
make test
```

### Integrations tests
Integrations tests for this extension are using the integration testing setup/framework that we are using for all other projects in this monorepo. This means that the integration tests are hosted in [`../../../node/test/go/dev-mode` folder](../../../node/test/go/dev-mode/README.md). Check this folder for more details about the integration tests.

## Releasing a version
When you are ready to release a new version of this extension simply increment the version number in the `version.txt` file.
