'use strict';

const _ = require('lodash');
const { S3 } = require('@aws-sdk/client-s3');
const awsRequest = require('@serverless/test/aws-request');
const toPromise = require('stream-promise/to-promise');
const log = require('log').get('layers-upload');
const publishPublicLayer = require('./publish-public-layer');
const lambdaRegions = require('./lambda-regions');

module.exports = async ({ bucketName, layerBasename, version, content, githubTag }) => {
  const newMeta = {};
  const errors = [];
  const layerName = `${layerBasename}-v${version.replace(/[.]/g, '-')}`;
  await Promise.all(
    lambdaRegions.map(async (region) => {
      const arn = await (async () => {
        try {
          return await publishPublicLayer({ region, layerName, content });
        } catch (error) {
          log.error('error at %s: %O', region, error);
          errors.push(new Error(`Could not upload to region "${region}": ${error.messsage}`));
          return null;
        }
      })();
      if (!arn) return;
      log.notice('published to %s (%s)', region, arn);
      newMeta[region] = { [version]: arn };
    })
  );

  if (Object.keys(newMeta).length) {
    const registryName = `${layerBasename}.json`;
    await Promise.all([
      (async () => {
        const layersRegistry = JSON.parse(
          await toPromise(
            (
              await awsRequest(S3, 'getObject', { Bucket: bucketName, Key: registryName })
            ).Body
          )
        );
        _.merge(layersRegistry, newMeta);
        await awsRequest(S3, 'putObject', {
          Bucket: bucketName,
          Key: registryName,
          Body: Buffer.from(JSON.stringify(layersRegistry)),
        });
      })(),
      (async () => {
        if (!githubTag) return;
        const github = require('./github');
        const owner = 'serverless';
        const repo = 'console';
        const ghReleaseMeta = (await github.repos.getReleaseByTag({ owner, repo, tag: githubTag }))
          .data;
        await github.repos.uploadReleaseAsset({
          owner,
          repo,
          release_id: ghReleaseMeta.id,
          name: registryName,
          data: Object.fromEntries(
            // Simplify `{ [region]: { [version]: arn }}` into `{ [region]: arn }`
            Object.entries(newMeta).map(([region, { [version]: arn }]) => [region, arn])
          ),
        });
      })(),
    ]);
  }

  if (errors.length) {
    throw new Error(
      `There were problems when publishing the layers:\n\t${errors
        .map(({ message }) => message)
        .join('\n\t')}`
    );
  }
};
