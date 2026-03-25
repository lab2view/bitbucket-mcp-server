#!/usr/bin/env node
/**
 * Bitbucket MCP Server — Zeney / lab2view
 *
 * MCP server providing 22 tools to interact with Bitbucket Cloud API:
 * Pull Requests, Branches, Tags, Pipelines, Branch Restrictions, and Permissions.
 *
 * Transport: stdio
 * Auth: Bearer token (Repository Access Token)
 */

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createBitbucketClient } from './services/bitbucket-client.js';
import { registerPullRequestTools } from './tools/pullrequests.js';
import { registerBranchTools } from './tools/branches.js';
import { registerTagTools } from './tools/tags.js';
import { registerPipelineTools } from './tools/pipelines.js';
import { registerRestrictionTools } from './tools/restrictions.js';
import { registerPermissionTools } from './tools/permissions.js';

const server = new McpServer({
  name: 'bitbucket-mcp-server',
  version: '1.0.0'
});

const client = createBitbucketClient();

registerPullRequestTools(server, client);
registerBranchTools(server, client);
registerTagTools(server, client);
registerPipelineTools(server, client);
registerRestrictionTools(server, client);
registerPermissionTools(server, client);

async function run(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Bitbucket MCP Server démarré (stdio)');
}

run().catch(error => {
  console.error('Erreur fatale:', error);
  process.exit(1);
});
