<!--
title: Using Serveless Console
menuText: Using Serveless Console
description: A guide to using Serverless Console UI
menuOrder: 1
-->

# Using Console
Serverless Console provides an easy to use User Interface for 
monitoring your Serverless architectures. We automatically
recongize patterns by observing [Traces](traces.md) sent by our
[Serverless Runtime instrumentation](concepts/index.md).

## Getting Started
To start using the Console to monitor your apps, you'll need 
to start by instrumenting your firt app. Check our
[getting started](../index.md) guide to deploy your first 
Open Telemetry instrumented app. Once you have deployed and
visited your app your ready to start using Console. 

## Creating an Orginization 

You'll need to sign up and create an Orginization (Org) to
start using Serverless Console. An Orginization is treated
as a Tenant across Serverless products and data is not able to
be shared across Orginizations. It also will appear in your
URL. We recommend using a name your teamm will recognize and
is easy to type.

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