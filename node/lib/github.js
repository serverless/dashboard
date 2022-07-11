'use strict';

const { Octokit } = require('@octokit/rest');

const githubToken = process.env.GITHUB_TOKEN;

if (!githubToken) {
  throw new Error('Missing GITHUB_TOKEN env var');
}

module.exports = new Octokit({ auth: `token ${githubToken}` });
