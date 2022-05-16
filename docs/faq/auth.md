<!--
title: Authentication FAQ
menuText: Authentication FAQ
description: Frequently Asked Questions about Serverless Console Authentication
menuOrder: 8
-->

# Authentication FAQ
**I am not able to deploy or login to console from the CLI, how do I fix this?**

You need to be on version 3.18+ to login and deploy. To check the version of your framework run.

```text
serverless –version
To upgrade to the latest version run.
```text
npm -g install serverless
```

**What’s an organization? Where did my organization name come from?**

An organization is a unique tenant within the Serverless suite of products (including Serverless Dashboard, Serverless Cloud, and Serverless Console). This name must be unique, and we randomly assign a combination of words as your organization name if you're using Console for the first time. 

**Can I change my org name?**

Yes, org names can be changed from the settings section of Console. Keep in mind that org names do need to be globally unique across Serverless, so your desired organization name may not be available. 

**If I setup an organization in Serverless before, will it work with console?**

Yes, you will automatically start using an existing organization if you have already set one up in Servrless Dashboard. 

**I joined an organization in Serverless, will it be there in Serverless Console**
Yes, any organizations you are a member of in Serverless Dashboard will be automatically added to your Serverless Console. 

**What roles exist in Serverless Console?**

Serverless Console has two user roles. An org owner, and contributor.

**Who can manage payment information for my organization? Who can add users to my organization?**

Only org owners can add other users and access payment information. 

**What is an Org Token? How do I configure automated deployments in a CI/CD system?**

An org token is a token that organization owners can use to configure an automated deployment system. To configure deployment in these system, do the following.

Go to the settings tab of your organization, and copy the org key to your clipboard
Paste the value as the environment variable SLS_ORG_TOKEN in your CI/CD environment


**If I change my org name in Console, will my dashboard name change as well?**

No, if you change your org name in Console, you’ll need to specify the dashboard name separately to take advantage of dashboard features like Parameters and Providers. This can be done by including the console specific name in the console section of your configuration, as in the example below.

```yaml
org: thisismydashboardname
console: 
   org: thisismyconsolename
service: thisismyservice
frameworkVersion: '3'
```

