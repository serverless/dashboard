<!--
title: Creating an org
menuText: Creating an org
description: A guide to ensuring API Applications are Setup to be Instrumented Correctly
menuOrder: 4
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

## Changing Org Name
Org names can be changed from the Org Settings section of Console. 
Keep in mind that org names do need to be globally unique across Serverless, 
so your desired organization name may not be available. 

## Configuring CI/CD Systems

### Org Token
An Org Token is a token that organization owners can use to 
configure an automated deployment system to deploy apps and
services instrumented for console.

To configure deployment in these system, do the following.

1. Go to the settings tab of your organization, and copy the org key to your clipboard
1. Paste the value as the environment variable SLS_ORG_TOKEN in your CI/CD environment

