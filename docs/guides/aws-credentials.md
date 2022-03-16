<!--
title: Setup AWS Access Keys
menuText: Setup AWS Access Keys
description: A guide to setting up local AWS Access Keys
menuOrder: 2
-->

# Setup a local AWS Access Key

If you have not used framework to deploy before, you'll need to configure AWS
credentials. {ou can follow along with the onboarding prompts or do the
following:

1. [Create an AWS access key](https://www.youtube.com/watch?v=KngM5bfpttA)
(AWS Console Access required).
2. Configure your Credentials locally.

```text
serverless config credentials \
  --provider aws \
  --key AKIAIOSFODNN7EXAMPLE \
  --secret wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

