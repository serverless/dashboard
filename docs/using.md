<!--
title: Using Serveless Console
menuText: Using Serveless Console
description: A guide to using Serverless Console UI
menuOrder: 6
-->

# Using Console

## Metric Views 
Metric views provide curated metric displays created for each of our 
defined [Scopes](scopes.md). By default these curated views do not 
apply filters, but allow for filterings. Users can apply and save 
filters to share across their org with other users.

## Explorer 
The explorer allows users to filter and search across all Traces in 
their organization. This will help you identify specific invocations 
that are resulting errors, slow, over or under utilizing resources. 

## Trace Details
Trace details provide the specifics about a Trace and surface all 
the relevant information we store about an invocation to the user. 
A Trace is made up of a collection of metadata, and child spans 
(each with their own metadata). We use this information to display 
a traditional Gantt Chart along with highlighting key information 
about the trace.  If enabled we also use your cloudwatch Subscription 
to pull and display logs in the UI. 
