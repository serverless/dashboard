<!--
title: Using Serveless Console
menuText: Using Serveless Console
description: A guide to using Serverless Console UI
menuOrder: 1
-->

# ## Getting Started
Serverless Console provides an easy to use User Interface for 
monitoring your Serverless architectures. We automatically
recongize patterns by observing [Traces](traces.md) sent by our
[Serverless Runtime instrumentation](concepts/index.md).


To start using the Console to monitor your apps, you'll need 
to start by instrumenting your firt app. Check our
[getting started](../index.md) guide to deploy your first 
Open Telemetry instrumented app. Once you have deployed and
visited your app your ready to start using Console. 

## Creating an Orginization 
If your new to Serveless, you'll need to sign up and create an 
Orginization (Org) to start using Serverless Console. An Orginization is treated
as a Tenant across Serverless products and data is not able to
be shared across Orginizations. It also will appear in your
URL. We recommend using a name your teamm will recognize and
is easy to type.


**Login from the CLI to Create your Org**

```
serverless login
```

**Setup a local AWS Access Key**
Serverless Console leverages the providers concept from
Serverless Framework to make it easyo to target the aporpriate
Cloud Provider to deploy into. 

1. To get started with console fist [create an AWS access key](https://www.youtube.com/watch?v=KngM5bfpttA)
(AWS Console Access required).
1. Configure your Credentials locally.

```text
serverless config credentials \
  --provider aws \
  --key AKIAIOSFODNN7EXAMPLE \
  --secret wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**Get started a simple http api template.**
The following onboarding command will clone a repo
for a simple Node.js API and deploy it to your
AWS account. This app will be instrumented
automatically wtih our [Serverless Runtime](./concepts)
Open Telemetry collector. 


If you have used Serverless Dashboard, or Serverless Cloud
your login details and Orginization will already be present.
Simply login with your existing credentials. 

## Adding Team Members

Console currently supports the following basic roles which 
are shared across your org.

* **Owner** - Owner of the account. Can add other admins and 
contributors. Only one owner per account can be present.
* **Admin** - Admins can add other users, deploy apps, and use 
all of console.
* **Contributor** - Contributors can use all of console but 
can not add other users.

*Note: adding users requires a valid Enterprise subscription
or a Free Trial.*