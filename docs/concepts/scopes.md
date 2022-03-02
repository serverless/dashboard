<!--
title: Scopes
menuText: Scopes
description: Overview of concepts used on serevrless console. 
menuOrder: 3
-->

# Scopes
To make sense of Traces coming into our system we need to recognize 
them as defined Scopes. Scopes are used to define patterns in Traces
we understand so we can ingest and store them for charting and alerting.
We currently support the following curated views, corresponding to these
specific scopes. 

**API** - This scope is used for displaying a Trace we recognize an HTTP 
based API request. This scope requires the following tags.
    * http.path
    * http.method
    * http.status_code

**All Functions** - This is used for displaying any Lambda function 
invocation. The following tags are required on the trace to qualify
as a function. 
    * faas.error_timeout
    * faas.coldstart
    * faas.error
    * faas.event_type
    * faas.name

More details about tags are maintained in our [tag definition list](tags.md).
