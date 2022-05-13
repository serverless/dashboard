<!--
title: Setup Automated Deployments
menuText: Setup Automated Deployments
description: Configure your CI/CD system to deploy to console
menuOrder: 3
-->

# Setup your CI/CD system to deploy to console

It easy to configure your CI/CD system for deploying to Sereverless Console
using the orginization token. The Org token authenticates your org for deploying
to Serverless Console and is intended for use by automated deployments sytems. This token 
is not associated with any users, and is only accessible to be viewed by org owners.

To use this for automated deployments, login to console as an org owner.

1. Go to settings, general and copy the org token to your clipboard.
2. Paste the value as the environment variable SLS_ORG_TOKEN in your CI/CD environment
