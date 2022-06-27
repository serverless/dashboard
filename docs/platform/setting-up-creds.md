<!--
title: Setting up Credentials
menuText: Setting up Credentials
description: Setting up AWS Credentials for Serverless Framework
menuOrder: 5
-->

# Setting up AWS Credentials
If you have not used framework to deploy before, you'll need to configure AWS
credentials. You can follow along with the onboarding prompts or do the
following:

1. [Create an AWS access key](https://www.serverless.com/framework/docs/providers/aws/guide/credentials#create-an-iam-user-and-access-key)
(AWS Console Access required).
2. Configure your Credentials locally.

```text
serverless config credentials \
  --provider aws \
  --key AKIAIOSFODNN7EXAMPLE \
  --secret wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```