<!--
title: Sending Data to Console 
menuText: Instrumentation
description: Compatible Serverless Console Platform
menuOrder: 3
-->

# Sending Data to Console
Serverless Console has a growing list of supported instrumentation options,
for sending logs, metrics, and traces to Serverless Console. We aim to make this
process as simple as possible and try to either offer packaged solutions with simple configuration
options, or on-boarding through a web based user interface. 

This guide describes how these integrations work, and how they 
leverage [AWS Lambda Extensions](../glossary.md#extension), [AWS IAM Roles (in review)](../../instrumentation/aws/iam-role-cfn-template.yaml), and Cloudwatch Subscriptions (in definition) to gather data
about how your app is functioning. 
