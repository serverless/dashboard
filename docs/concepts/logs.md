<!--
title: Logs
menuText: Logs
description: Log collection
menuOrder: 6
-->

# Logs
Logs are a critical step for monitoring and troubleshooting your
Serverless Application. These logs are refined and formatted for
display, and some log content may be hidden. 

You can disable log collection on your service by setting the
following property. 

```yaml
org: myorg
console: 
    disableLogsCollection: true
service: myservice
frameworkVersion: '3'
```
