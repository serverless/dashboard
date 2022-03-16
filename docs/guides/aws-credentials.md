<!--
title: Setup AWS Access Keys
menuText: Setup AWS Access Keys
description: A guide to setting up local AWS Access Keys
menuOrder: 2
-->

# Setup a local AWS Access Key

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

