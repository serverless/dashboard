<!--
title: Creating Orgs
menuText: Creating Orgs
description: A guide to ensuring API Applications are Setup to be Instrumented Correctly
menuOrder: 3
-->

# Creating an Organization 
An organization is a unique tenant within the Serverless suite of 
products (including Serverless Dashboard, Serverless Cloud, and 
Serverless Console). When you sign up we randomly assign 
a combination of words as your organization name if you're using 
Serverless for the first time. 

## Adding Team Mates

Console currently supports the following basic roles which are shared across
your org. 

- **Owner** - Owner of the account. Can add other contributors and access the
Org Settings. Only one owner per account can be present.
- **Contributor** - Contributors can use all of console but can not add other users
or access the Org Settings directly.

## Configuring CI/CD Systems

### Org Token
An Org Token is a token that organization owners can use to 
configure an automated deployment system to deploy apps and
services instrumented for console.

To configure deployment in these system, do the following.

1. Go to the settings tab of your organization, and copy the org key to your clipboard
1. Paste the value as the environment variable SLS_ORG_TOKEN in your CI/CD environment

## Changing Org Name
Org names can be changed from the Org Settings section of Console. 
Keep in mind that org names do need to be globally unique across Serverless, 
so your desired organization name may not be available. 

## Using Serverless Dashboard Orgs
If you have an existing Serverless Dashboard org and you log into 
Serverless Console you will automatically start using your existing 
organization. Additionally if you are a member of a Serverless Dashboard
organization you will automatically made a member of that org in 
Serverless Console.  

**Note:** if you change your org name in Console, you’ll need to specify the dashboard name separately to take advantage of dashboard features like Parameters and Providers. This can be done by including the console specific name in the console section of your configuration, as in the example below.


```yaml
org: thisismydashboardname
console: 
   org: thisismyconsolename
service: thisismyservice
frameworkVersion: '3'
```
