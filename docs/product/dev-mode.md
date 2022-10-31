<!--
title: Dev Mode
menuText: Dev Mode
description: A guide for using logs within Serverless Console
menuOrder: 5
-->

# Dev Mode
Dev(elopment) Mode is an optimized development focused suite of Observability
tools for building and troubleshooting Serverless architectures. To get started you need [enable dev mode](../integrations/enable-monitoring-features.md) on
your functions.

Once you have your function(s) enabled for Dev Mode you will 
see an aggregate stream of [logs](#real-time-logging), [invocation events](#real-time-invocation-events), and [spans](#spans)
for your function. You may need to filter for a namespace
or environment to better troubleshoot your application.

## Real Time Logging
Using log statements is one of the more intuitive approach troubleshooting
and Serverless Console offers you a best in class experience to using logs 
across your Lambda Function. 

Once you have [enabled Dev Mode](../integrations/enable-monitoring-features.md#enabling-dev-mode) you will start seeing logs forwarded directly from your Lambda function. 
[Historical logs](#historical-logs) for your function are also collected using
[CloudWatch Log Subscriptions](../integrations/data-sources-and-roles.md#cloudwatch-log-subscriptions). 

## Real Time Invocation Events
In addition to Logs, when you [enable Tracing](../integrations/enable-monitoring-features.md#enabling-traces) in your functions, you will receive real time event details for your function.

These will appear in the log stream as.

```
Invocation Started: your-lambda-function 
```

### Event Payload
With Tracing enabled you also receive additional details about the invocation
of your function. This allows you to better recreate and troubleshoot behavior.

This data is only forwarded to Dev Mode and is not stored in Serverless Console. 

It will include helpful information about your event. Below is an example of an 
[API Gateway](../glossary.md#api-gateway) request. 

```json
{
  "version": "2.0",
  "routeKey": "$default",
  "rawPath": "/",
  "rawQueryString": "",
  "headers": {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "max-age=0",
    "content-length": "0",
    "host": "n9gera3luh.execute-api.us-east-1.amazonaws.com",
    "if-none-match": "W/\"23-chdbkHlXLH0xUOfv0n794s6zoK4\"",
    "sec-ch-ua": "\"Google Chrome\";v=\"105\", \"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"105\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "cross-site",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36",
    "x-amzn-trace-id": "Root=1-6345b256-1b6b2bca522d219c32dd52ae",
    "x-forwarded-for": "174.51.29.171",
    "x-forwarded-port": "443",
    "x-forwarded-proto": "https"
  },
  "requestContext": {
    "accountId": "12345",
    "apiId": "3luhn9gera",
    "domainName": "3luhn9gera.execute-api.us-east-1.amazonaws.com",
    "domainPrefix": "3luhn9gera",
    "http": {
      "method": "GET",
      "path": "/",
      "protocol": "HTTP/1.1",
      "sourceIp": "174.51.29.171",
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36"
    },
    "requestId": "Z2jNjiVeIAMdQ=",
    "routeKey": "$default",
    "stage": "$default",
    "time": "11/Oct/2022:18:13:42 +0000",
    "timeEpoch": 1665512022559
  },
  "isBase64Encoded": false
}
```

#### Invocation Logs Panel
All logs for an invocation are grouped into a [Trace](./traces.md#traces-from-logs) (even when Tracing is not enabled on a function). You can interact with any event or log by clicking on it to
view all other logs, [namespace and environment](./metrics.md#filters) details along with function name and AWS Account details. 

#### Child Span Events
With Tracing enabled you will also be able to see the sequence of all child spans of a Trace by
clicking on a log or event. This will show [detailed information about the interactions](./traces.md#supported-child-spans) of your Lambda function along with more detailed specifics about those interactions. 

In Dev Mode this includes specific of the request and response of particular interactions that 
can be helpful for troubleshooting. For example below is a sample Dynamo DB request.

```text
TAGs sample needed for this
```
<!--
## Historical Logs
Development mode works similar to a terminal display in that the most recent 
logs appear at the bottom of the screen automatically

This is designed to help you isolate and recreate specific behavior while you develop. You are also
able to access recent historical logs by applying filters and scrolling upwards. 
-->
## Filtering
The default view for dev mode is across all your logs and invocations, so you will
likely need to apply filters to meaningfully utilize Dev Mode. We recommend filtering 
by [Namespace](../glossary.md#namespace) or [Environment] but you can also utilize
this to do keyword searches such as a user-id, or tag.

## Log Formatting
Where possible we detect and format structured logs such as JSON. We also include
encoded information in logs if you [enable Tracing](../integrations/enable-monitoring-features.md#enabling-traces) on a function but this is hidden in development mode. In some cases we also hide
logs that are not relevant for display but [encode information about the Trace](../integrations/data-sources-and-roles.md#serverless-node-sdk)