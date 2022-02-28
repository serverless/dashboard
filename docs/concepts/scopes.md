<!--
title: Scopes
menuText: Scopes
description: Overview of concepts used on serevrless console. 
menuOrder: 2
-->

# Scopes
To make sense of Traces coming into our system we need to recognize 
them as defined Scopes. Scopes are used to define Metric Views as 
well as enforce a set of requirements on data we receive into our 
system. We maintain a defined set of scopes for ingestion below.

**All Functions** - This is used for displaying any Lambda function invocation of any kind and has the following required tags.

**API** - This scope is used for displaying a Trace we recognize an HTTP based API request. It includes details about endpoint, path and other relevant API details. 

Details about what is required for each scope is maintained and 
updated for each release in our [tag definitions](tags.md).
