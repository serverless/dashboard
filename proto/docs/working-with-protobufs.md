# Working with Protobufs

At Serverless, we use Protobufs to describe the data schemas that will be used in our instrumentation libraries. 
The Serverless ingest platform only accept Protobufs that are implemented in this repo. To contribute to our Schemas, you must follow the rules below.

## Why Protobufs

We picked Protobufs in order to standardize the data sent from all instrumentation sources. Using Protobufs we can guarantee the data produced from our instrumentation SDKs will be in a format that our ingest services will always be able to parse. 

With Protobufs we get,

1. Strongly typed interfaces for Typescript and Go.
2. A Standard way for the platform to encode & decode ingest payloads.
3. Backward Compatibility for protobuf versions. When we make updates to our Protobufs, older versions of our instrumentation SDK and ingest will still be able to parse payloads.
4. Forward Compatibility. We can add fields to our protobufs for instrumentation without having to coordinate updates to ingest. Ingest will just ignore new fields. When we are ready to use that new field we can update ingest to be aware of it.

## Implementing New Messages

When creating a new message there are some guidelines to keep in mind,

1. Field numbers 1 - 15 take 1 byte to encode, that means when you define your message you should put fields that will always exist or be frequently accessed in fields 1 - 15.
2. We document all fields. If a field can be in our schema it can be documented for users to know what exactly it means.
3. Always use verbose names for messages and fields.
4. Fields should not influence other fields. If I have an optional field `a`, I should not have bool field called `isASet` for example.

Here is an example of what would be considered a message that does not meet our standards,

```protobuf
message Example {
  optional string some_infrequent_field = 1;
  optional string b = 2;
  bool isBSet = 3;
  string org_id = 20;
}
```

Looking at this, we can see that this message breaks all 4 of our core guidelines. First we have optional infrequently accessed fields within field numbers 1-15. Compare that to having `org_id`, a field we require in all our systems, at field number 20. Because of breaking guideline 1 we now have a larger encoded payload. Next we are breaking guideline 2, we have no comments on our fields and by extension no generated documentation for our users. We are breaking guideline 3 but having a field name `b` so not only do we have no comments, we have no way to infer what `b` represents. Finally we are breaking guideline 4 by having a boolean field `isBSet`. When we generated our language specific libraries containing these interfaces we can easily check for if `b` exists using language specific optional methods.

Now let's look at an example that meets all our standards,

```protobuf
// A DeploymentEvent contains information about the last time,
// a service was deployed to the Serverless Platfrom.
message DeploymentEvent {
  // A Serverless Platform OrgId
  string org_id = 1;
  // A Unique identifier for the service that DeploymentEvent is related to.
  string service_id = 2;
  // An optional Git Commit Id attached to this DeploymentEvent.
  optional string commit_id = 16;
  // An optional Git Commit Message attached to this DeploymentEvent.
  optional string commit_message = 17;
}
```
As we can see, with this message it is very clear what this message represents and what each field represents. We place fields that we know will be set and accessed at field number 1 and 2. While optional fields we make their field numbers greater than 15. This makes this message not only clear from the start but also gives us room to grow its definition, we have 13 more fields we can use for required fields, as well as creating an implicit boundary between required and optional fields.


## Updating Messages

The only supported update to messages is adding fields, and where absolutely necessary removing a field. You cannot change any part of an existing field.

### Adding a Field

Adding a new field is simple, find the next available field number and define your field. Ensure the field number is not reserved, the only time a field number would be reserved is if it was removed prior. 

Make sure to check the comments in the proto file itself as there may be specific ranges of field numbers based on optimizations and other considerations.

### Removing a Field

Removing a field should only be done when absolutely necessary. Given we do not want to break backwards compatibility with older versions of our libraries, we should only remove fields if there is a valid performance concern with that field remaining.

If a field is removed, you must reserve its field number and the field name so that it cannot be used again!

This does mean that you cannot reuse field names once removed. So extra care must be made when defining messages, once a field has been built into a package version, it is reserved no matter what.
