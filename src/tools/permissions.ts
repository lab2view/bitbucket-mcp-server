import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AxiosInstance } from 'axios';
import { z } from 'zod';
import { WORKSPACE, REPO_SLUG, CHARACTER_LIMIT } from '../constants.js';
import { truncateResponse } from '../services/bitbucket-client.js';
import type { BitbucketUserPermission, BitbucketGroupPermission } from '../types.js';

export function registerPermissionTools(server: McpServer, client: AxiosInstance): void {

  // ── bb_list_user_permissions ──────────────────────────────────
  server.registerTool(
    'bb_list_user_permissions',
    {
      title: 'List User Permissions',
      description: `List user permissions for ${WORKSPACE}/${REPO_SLUG}. Requires repository:admin scope.

Returns:
  JSON array of user permissions with: user display name, UUID, permission level (read/write/admin).`,
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
          `/repositories/${WORKSPACE}/${REPO_SLUG}/permissions-config/users`,
          { params: { pagelen: 100 } }
        );
        const perms: BitbucketUserPermission[] = response.data.values ?? [];
        const result = perms.map(p => ({
          user: p.user.display_name,
          uuid: p.user.uuid,
          permission: p.permission
        }));
        const text = truncateResponse(JSON.stringify(result, null, 2), CHARACTER_LIMIT);
        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── bb_set_user_permission ───────────────────────────────────
  server.registerTool(
    'bb_set_user_permission',
    {
      title: 'Set User Permission',
      description: `Set permission level for a specific user on ${WORKSPACE}/${REPO_SLUG}. Requires repository:admin scope.

Args:
  - user_id (string): Atlassian UUID of the user (required)
  - permission (string): Permission level — read, write, or admin (required)

Returns:
  Updated permission details.`,
      inputSchema: z.object({
        user_id: z.string().min(1).describe('Atlassian UUID of the user'),
        permission: z.enum(['read', 'write', 'admin']).describe('Permission level')
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ user_id, permission }) => {
      try {
        const response = await client.put(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/permissions-config/users/${user_id}`,
          { permission }
        );
        return { content: [{ type: 'text' as const, text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── bb_delete_user_permission ────────────────────────────────
  server.registerTool(
    'bb_delete_user_permission',
    {
      title: 'Delete User Permission',
      description: `Remove a user's explicit permission from ${WORKSPACE}/${REPO_SLUG}. Requires repository:admin scope.

Args:
  - user_id (string): Atlassian UUID of the user to remove (required)

Returns:
  Confirmation message.

Warning: This is a destructive operation.`,
      inputSchema: z.object({
        user_id: z.string().min(1).describe('Atlassian UUID of the user')
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ user_id }) => {
      try {
        await client.delete(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/permissions-config/users/${user_id}`
        );
        return { content: [{ type: 'text' as const, text: `Permission de l'utilisateur ${user_id} supprimée avec succès.` }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── bb_list_group_permissions ─────────────────────────────────
  server.registerTool(
    'bb_list_group_permissions',
    {
      title: 'List Group Permissions',
      description: `List group permissions for ${WORKSPACE}/${REPO_SLUG}. Requires repository:admin scope.

Returns:
  JSON array of group permissions with: group slug, name, permission level (read/write/admin).`,
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
          `/repositories/${WORKSPACE}/${REPO_SLUG}/permissions-config/groups`,
          { params: { pagelen: 100 } }
        );
        const perms: BitbucketGroupPermission[] = response.data.values ?? [];
        const result = perms.map(p => ({
          group_slug: p.group.slug,
          group_name: p.group.name ?? null,
          permission: p.permission
        }));
        const text = truncateResponse(JSON.stringify(result, null, 2), CHARACTER_LIMIT);
        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── bb_set_group_permission ──────────────────────────────────
  server.registerTool(
    'bb_set_group_permission',
    {
      title: 'Set Group Permission',
      description: `Set permission level for a group on ${WORKSPACE}/${REPO_SLUG}. Requires repository:admin scope.

Args:
  - group_slug (string): Workspace group slug (required)
  - permission (string): Permission level — read, write, or admin (required)

Returns:
  Updated group permission details.`,
      inputSchema: z.object({
        group_slug: z.string().min(1).describe('Workspace group slug'),
        permission: z.enum(['read', 'write', 'admin']).describe('Permission level')
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ group_slug, permission }) => {
      try {
        const response = await client.put(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/permissions-config/groups/${group_slug}`,
          { permission }
        );
        return { content: [{ type: 'text' as const, text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );
}
