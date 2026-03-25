import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AxiosInstance } from 'axios';
import { z } from 'zod';
import { WORKSPACE, REPO_SLUG, CHARACTER_LIMIT } from '../constants.js';
import { truncateResponse } from '../services/bitbucket-client.js';
import type { BitbucketBranchRestriction } from '../types.js';

const RESTRICTION_KINDS = [
  'push',
  'restrict_merges',
  'require_approvals_to_merge',
  'require_default_reviewer_approvals_to_merge',
  'require_passing_builds_to_merge',
  'require_tasks_to_be_completed',
  'require_no_changes_requested',
  'reset_pullrequest_approvals_on_change',
  'reset_pullrequest_changes_requested_on_change',
  'allow_auto_merge_when_builds_pass'
] as const;

export function registerRestrictionTools(server: McpServer, client: AxiosInstance): void {

  // ── bb_list_branch_restrictions ──────────────────────────────
  server.registerTool(
    'bb_list_branch_restrictions',
    {
      title: 'List Branch Restrictions',
      description: `List all branch restrictions in ${WORKSPACE}/${REPO_SLUG}. Requires repository:admin scope.

Returns:
  JSON array of restrictions with: id, kind, pattern, branch_match_kind, users/groups exempted, value.

Examples:
  - "What branch protections exist?" → call with no params`,
      inputSchema: z.object({}).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async () => {
      try {
        const response = await client.get(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/branch-restrictions`,
          { params: { pagelen: 100 } }
        );
        const restrictions: BitbucketBranchRestriction[] = response.data.values ?? [];
        const result = restrictions.map(r => ({
          id: r.id,
          kind: r.kind,
          pattern: r.pattern,
          branch_match_kind: r.branch_match_kind ?? null,
          branch_type: r.branch_type ?? null,
          users: r.users?.map(u => u.display_name) ?? [],
          groups: r.groups?.map(g => g.slug) ?? [],
          value: r.value ?? null
        }));
        const text = truncateResponse(JSON.stringify(result, null, 2), CHARACTER_LIMIT);
        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── bb_create_branch_restriction ─────────────────────────────
  server.registerTool(
    'bb_create_branch_restriction',
    {
      title: 'Create Branch Restriction',
      description: `Create a new branch restriction in ${WORKSPACE}/${REPO_SLUG}. Requires repository:admin scope.

Args:
  - kind (string): Restriction kind (required). Values: push, restrict_merges, require_approvals_to_merge, require_default_reviewer_approvals_to_merge, require_passing_builds_to_merge, require_tasks_to_be_completed, require_no_changes_requested, reset_pullrequest_approvals_on_change, reset_pullrequest_changes_requested_on_change, allow_auto_merge_when_builds_pass
  - branch_match_kind (string): "glob" or "branching_model" (default: glob)
  - pattern (string): Branch pattern for glob matching, e.g., "main", "release/*" (required if glob)
  - branch_type (string): Branch type for branching_model: production, development, feature, release, bugfix, hotfix (optional)
  - users (string[]): UUIDs of exempted users (optional)
  - groups (string[]): Slugs of exempted groups (optional)
  - value (number): Required for require_approvals_to_merge — minimum approvals count (optional)

Returns:
  Created restriction details.`,
      inputSchema: z.object({
        kind: z.enum(RESTRICTION_KINDS).describe('Restriction kind'),
        branch_match_kind: z.enum(['glob', 'branching_model']).default('glob').describe('Match mode'),
        pattern: z.string().optional().describe('Branch glob pattern (e.g., "main", "release/*")'),
        branch_type: z.enum(['production', 'development', 'feature', 'release', 'bugfix', 'hotfix']).optional().describe('Branch type (for branching_model)'),
        users: z.array(z.string()).optional().describe('UUIDs of exempted users'),
        groups: z.array(z.string()).optional().describe('Slugs of exempted groups'),
        value: z.number().int().min(1).optional().describe('Value — required for require_approvals_to_merge')
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ kind, branch_match_kind, pattern, branch_type, users, groups, value }) => {
      try {
        if (kind === 'require_approvals_to_merge' && value === undefined) {
          return { content: [{ type: 'text' as const, text: 'Error: "value" est requis pour require_approvals_to_merge (nombre minimum d\'approbations).' }], isError: true };
        }
        const body: Record<string, unknown> = {
          kind,
          branch_match_kind
        };
        if (pattern) body.pattern = pattern;
        if (branch_type) body.branch_type = branch_type;
        if (users?.length) body.users = users.map(uuid => ({ uuid }));
        if (groups?.length) body.groups = groups.map(slug => ({ slug }));
        if (value !== undefined) body.value = value;

        const response = await client.post(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/branch-restrictions`,
          body
        );
        return { content: [{ type: 'text' as const, text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── bb_update_branch_restriction ─────────────────────────────
  server.registerTool(
    'bb_update_branch_restriction',
    {
      title: 'Update Branch Restriction',
      description: `Update an existing branch restriction in ${WORKSPACE}/${REPO_SLUG}. Requires repository:admin scope.

Args:
  - restriction_id (number): The restriction ID to update (required)
  - kind (string): Updated restriction kind (required)
  - branch_match_kind (string): "glob" or "branching_model" (default: glob)
  - pattern (string): Branch glob pattern (optional)
  - branch_type (string): Branch type for branching_model (optional)
  - users (string[]): UUIDs of exempted users (optional)
  - groups (string[]): Slugs of exempted groups (optional)
  - value (number): Minimum approvals count (optional)

Returns:
  Updated restriction details.`,
      inputSchema: z.object({
        restriction_id: z.number().int().positive().describe('Restriction ID'),
        kind: z.enum(RESTRICTION_KINDS).describe('Restriction kind'),
        branch_match_kind: z.enum(['glob', 'branching_model']).default('glob').describe('Match mode'),
        pattern: z.string().optional().describe('Branch glob pattern'),
        branch_type: z.enum(['production', 'development', 'feature', 'release', 'bugfix', 'hotfix']).optional().describe('Branch type'),
        users: z.array(z.string()).optional().describe('UUIDs of exempted users'),
        groups: z.array(z.string()).optional().describe('Slugs of exempted groups'),
        value: z.number().int().min(1).optional().describe('Value for approval-based restrictions')
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ restriction_id, kind, branch_match_kind, pattern, branch_type, users, groups, value }) => {
      try {
        const body: Record<string, unknown> = {
          kind,
          branch_match_kind
        };
        if (pattern) body.pattern = pattern;
        if (branch_type) body.branch_type = branch_type;
        if (users?.length) body.users = users.map(uuid => ({ uuid }));
        if (groups?.length) body.groups = groups.map(slug => ({ slug }));
        if (value !== undefined) body.value = value;

        const response = await client.put(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/branch-restrictions/${restriction_id}`,
          body
        );
        return { content: [{ type: 'text' as const, text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── bb_delete_branch_restriction ─────────────────────────────
  server.registerTool(
    'bb_delete_branch_restriction',
    {
      title: 'Delete Branch Restriction',
      description: `Delete a branch restriction from ${WORKSPACE}/${REPO_SLUG}. Requires repository:admin scope.

Args:
  - restriction_id (number): The restriction ID to delete (required)

Returns:
  Confirmation message.

Warning: This is a destructive operation that cannot be undone.`,
      inputSchema: z.object({
        restriction_id: z.number().int().positive().describe('Restriction ID to delete')
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ restriction_id }) => {
      try {
        await client.delete(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/branch-restrictions/${restriction_id}`
        );
        return { content: [{ type: 'text' as const, text: `Restriction #${restriction_id} supprimée avec succès.` }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );
}
