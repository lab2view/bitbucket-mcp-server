import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AxiosInstance } from 'axios';
import { z } from 'zod';
import { WORKSPACE, REPO_SLUG, CHARACTER_LIMIT } from '../constants.js';
import { truncateResponse } from '../services/bitbucket-client.js';
import type { BitbucketTag } from '../types.js';

export function registerTagTools(server: McpServer, client: AxiosInstance): void {

  // ── bb_list_tags ─────────────────────────────────────────────
  server.registerTool(
    'bb_list_tags',
    {
      title: 'List Tags',
      description: `List tags in ${WORKSPACE}/${REPO_SLUG}, sorted by most recent first.

Args:
  - limit (number): Maximum tags to return, 1-100 (default: 20)
  - filter (string): Filter tag names by substring (optional)

Returns:
  JSON array of tags with: name, target commit hash, date, message (if annotated).

Examples:
  - "List recent tags" → no filter
  - "Find v2.x tags" → filter="v2."`,
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(20).describe('Max tags to return'),
        filter: z.string().optional().describe('Filter tag names by substring')
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ limit, filter }) => {
      try {
        const params: Record<string, unknown> = { pagelen: limit, sort: '-target.date' };
        if (filter) params.q = `name ~ "${filter}"`;
        const response = await client.get(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/refs/tags`,
          { params }
        );
        const tags: BitbucketTag[] = response.data.values ?? [];
        const result = tags.map(t => ({
          name: t.name,
          hash: t.target.hash.slice(0, 12),
          date: t.target.date,
          message: t.message ?? null
        }));
        const text = truncateResponse(JSON.stringify(result, null, 2), CHARACTER_LIMIT);
        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── bb_create_tag ────────────────────────────────────────────
  server.registerTool(
    'bb_create_tag',
    {
      title: 'Create Tag',
      description: `Create a new tag in ${WORKSPACE}/${REPO_SLUG}.

Args:
  - name (string): Tag name — convention: v1.2.3 (required)
  - target_hash (string): Full or short commit hash to tag (required)
  - message (string): Tag message — if provided, creates an annotated tag (optional)

Returns:
  Created tag details with name, target hash, and date.`,
      inputSchema: z.object({
        name: z.string().min(1).describe('Tag name (e.g., v1.2.3)'),
        target_hash: z.string().min(7).describe('Target commit hash'),
        message: z.string().optional().describe('Tag message (creates annotated tag)')
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ name, target_hash, message }) => {
      try {
        const body: Record<string, unknown> = {
          name,
          target: { hash: target_hash }
        };
        if (message) body.message = message;
        const response = await client.post(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/refs/tags`,
          body
        );
        const tag = response.data;
        return { content: [{ type: 'text' as const, text: JSON.stringify({
          name: tag.name,
          hash: tag.target?.hash?.slice(0, 12),
          date: tag.target?.date,
          message: tag.message ?? null
        }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── bb_delete_tag ────────────────────────────────────────────
  server.registerTool(
    'bb_delete_tag',
    {
      title: 'Delete Tag',
      description: `Delete a tag from ${WORKSPACE}/${REPO_SLUG}.

Args:
  - name (string): Tag name to delete (required)

Returns:
  Confirmation message.

Warning: This is a destructive operation that cannot be undone.`,
      inputSchema: z.object({
        name: z.string().min(1).describe('Tag name to delete')
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ name }) => {
      try {
        await client.delete(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/refs/tags/${name}`
        );
        return { content: [{ type: 'text' as const, text: `Tag "${name}" supprimé avec succès.` }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );
}
