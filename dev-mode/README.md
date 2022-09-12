# Serverless Dev Mode Extension
This extension layer will forward logs from your lambda function to serverless console dev mode.

> This layer is utilizing [lambda logs API](https://docs.aws.amazon.com/lambda/latest/dg/runtimes-logs-api.html). It is important to note that the lambda logs API is not necessarily meant to forward logs in real time. Logs are really mean to be batched and send to you backend as soon as the logs are available to your lambda extension. This means that in this project we need to add a wait process that will periodically check if new logs have been posted. If we detect that no logs have been send then this layer will go to sleep. This could result in lambda function running in the extension process longer than they are meant to and can result in some logs being held until the next invocation. We will do our best to improve log delivery times but this layer shouldn't be used in a production environment where cost is an important factor.

## Development
First you will need to install rust crates
```shell
cargo install --path .
```

> You will need to install the [aws lambda rust runtime cargo plugin](https://github.com/awslabs/aws-lambda-rust-runtime#getting-started) before you can run the build/deploy commands

Then you will need to build the extension
```shell
cargo lambda build --extension --release
```

Then you can deploy the extension layer
```shell
cargo lambda deploy --extension
```

The command above will output a layer arn once successfully deployed.

After the layer is deployed you can attach this layer to any lambda function, just be sure to create the following environment variables.

|Env Variable | Description | Required |
|--|--|--|
| `SLS_ORG_ID` | This is the id of the org that you will be publishing to | `true` |
| `SLS_PUBLISH_ENDPOINT` | This is endpoint that you want logs to be forwarded to. This is helpful if you are trying to send logs to dev. | `false` |