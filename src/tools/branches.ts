import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AxiosInstance } from 'axios';
import { z } from 'zod';
import { WORKSPACE, REPO_SLUG, CHARACTER_LIMIT } from '../constants.js';
import { truncateResponse } from '../services/bitbucket-client.js';
import type { BitbucketBranch, BitbucketCommit } from '../types.js';

export function registerBranchTools(server: McpServer, client: AxiosInstance): void {

  // ── bb_list_branches ─────────────────────────────────────────
  server.registerTool(
    'bb_list_branches',
    {
      title: 'List Branches',
      description: `List branches in ${WORKSPACE}/${REPO_SLUG}.

Args:
  - filter (string): Filter branch names by substring (optional)
  - limit (number): Maximum branches to return, 1-100 (default: 20)

Returns:
  JSON array of branches with: name, target commit hash, date, last commit message.

Examples:
  - "List all branches" → no filter
  - "Find feature branches" → filter="feature/"`,
      inputSchema: z.object({
        filter: z.string().optional().describe('Filter branch names by substring'),
        limit: z.number().int().min(1).max(100).default(20).describe('Max results')
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ filter, limit }) => {
      try {
        const params: Record<string, unknown> = { pagelen: limit };
        if (filter) params.q = `name ~ "${filter}"`;
        const response = await client.get(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/refs/branches`,
          { params }
        );
        const branches: BitbucketBranch[] = response.data.values ?? [];
        const result = branches.map(b => ({
          name: b.name,
          hash: b.target.hash.slice(0, 12),
          date: b.target.date,
          message: b.target.message?.split('\n')[0] ?? null
        }));
        const text = truncateResponse(JSON.stringify(result, null, 2), CHARACTER_LIMIT);
        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── bb_get_commits ───────────────────────────────────────────
  server.registerTool(
    'bb_get_commits',
    {
      title: 'Get Commits',
      description: `Get recent commits in ${WORKSPACE}/${REPO_SLUG}.

Args:
  - branch (string): Branch name to filter commits (optional — defaults to all branches)
  - limit (number): Maximum commits to return, 1-50 (default: 15)

Returns:
  JSON array of commits with: hash, date, message, author, Jira key (ZN-XXX) if found in message.

Examples:
  - "Show recent commits on main" → branch="main"
  - "Last 5 commits" → limit=5`,
      inputSchema: z.object({
        branch: z.string().optional().describe('Branch name to filter'),
        limit: z.number().int().min(1).max(50).default(15).describe('Max commits')
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ branch, limit }) => {
      try {
        const url = branch
          ? `/repositories/${WORKSPACE}/${REPO_SLUG}/commits/${branch}`
          : `/repositories/${WORKSPACE}/${REPO_SLUG}/commits`;
        const response = await client.get(url, { params: { pagelen: limit } });
        const commits: BitbucketCommit[] = response.data.values ?? [];
        const jiraKeyRegex = /ZN-\d+/g;
        const result = commits.map(c => {
          const jiraKeys = c.message.match(jiraKeyRegex) ?? [];
          return {
            hash: c.hash.slice(0, 12),
            date: c.date,
            message: c.message.split('\n')[0],
            author: c.author.user?.display_name ?? c.author.raw,
            jira_keys: jiraKeys.length > 0 ? jiraKeys : undefined
          };
        });
        const text = truncateResponse(JSON.stringify(result, null, 2), CHARACTER_LIMIT);
        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );
}
