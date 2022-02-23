<!--
title: FAQ
menuText: FAQ
description: Frequently Asked Questions about Serverless Console
menuOrder: 8
-->

# FAQ
**How do I get access to Serverless Console**
We have a limited number of spots for teams that are interested in 
monitoring Serverless architectures. 

[Request access.](https://www.serverless.com/console )  

**Will Serverless Console replace the Serverless Dashboard?** 
Yes, the Serveless Console is the eventual replacement for Serverless 
Dashboard. We plan to keep key features like providers, parameters, and 
secrets in the transition but eventually the two tools will consolidate.

**How is the cost figure calculated?**
Cost is based on the duration and memory used by your Lambda function 
and is based on a x86 price of `$0.0000166667` per Gigabyte second. ARM 
or other compute option pricing are not accounted for at this time. 

**What data is stored by Serverless Console and for how long?**
We store metrics and tag metadata about any instrumented invocation in 
our system for 30 days. This includes some limited details provided by 
developers like names of services and functions, but does not include 
log data. 

**How secure is Serverless Console?**
Serverless Console is architected with Tenant isolation, and no trust 
models in mind. We collect very limited data with potential for PII or 
other sensitive information and plan to get SOX compliance for our 
general availability. 
 
**Can I deploy the same app to Console and Dashboard?**
Yes, by default enabling console, disables dashboard but it is 
possible to use the same Serverless.yaml file to deploy to both. 

<details needed>

**What languages and frameworks are supported?**
Yes, currently console only supports node.js and related frameworks 
for Node. We test our apps in Typescript and utilize popular 
frameworks like Express and Koa for testing compatibility. 
