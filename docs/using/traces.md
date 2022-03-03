<!--
title: Trace Explorer
menuText: Trace Explorer and Trace Details
description: A guide to using our metric views and create your own.
menuOrder: 3
-->


## Trace Explorer 
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
