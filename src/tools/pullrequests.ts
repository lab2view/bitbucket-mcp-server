import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AxiosInstance } from 'axios';
import { z } from 'zod';
import { WORKSPACE, REPO_SLUG, CHARACTER_LIMIT } from '../constants.js';
import { truncateResponse } from '../services/bitbucket-client.js';
import type { BitbucketPullRequest } from '../types.js';

export function registerPullRequestTools(server: McpServer, client: AxiosInstance): void {

  // ── bb_list_prs ──────────────────────────────────────────────
  server.registerTool(
    'bb_list_prs',
    {
      title: 'List Pull Requests',
      description: `List pull requests for the Bitbucket repository ${WORKSPACE}/${REPO_SLUG}.

Args:
  - state (string): Filter by PR state — OPEN, MERGED, or DECLINED (default: OPEN)
  - limit (number): Maximum number of PRs to return, 1-50 (default: 25)

Returns:
  JSON array of pull requests with: id, title, author, source branch, destination branch, created date, state.

Examples:
  - "Show open PRs" → state="OPEN"
  - "Show merged PRs" → state="MERGED"`,
      inputSchema: z.object({
        state: z.enum(['OPEN', 'MERGED', 'DECLINED']).default('OPEN').describe('PR state filter'),
        limit: z.number().int().min(1).max(50).default(25).describe('Max results to return')
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ state, limit }) => {
      try {
        const response = await client.get(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/pullrequests`,
          { params: { state, pagelen: limit } }
        );
        const prs: BitbucketPullRequest[] = response.data.values ?? [];
        const result = prs.map(pr => ({
          id: pr.id,
          title: pr.title,
          author: pr.author.display_name,
          source: pr.source.branch.name,
          destination: pr.destination.branch.name,
          created_on: pr.created_on,
          state: pr.state
        }));
        const text = truncateResponse(JSON.stringify(result, null, 2), CHARACTER_LIMIT);
        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── bb_get_pr ────────────────────────────────────────────────
  server.registerTool(
    'bb_get_pr',
    {
      title: 'Get Pull Request Details',
      description: `Get full details of a specific pull request by ID in ${WORKSPACE}/${REPO_SLUG}.

Args:
  - pr_id (number): The pull request ID (required)

Returns:
  Complete PR details including: id, title, description, author, source/destination branches, state, reviewers, participants, approval status, comment/task counts.

Examples:
  - "Get PR #42 details" → pr_id=42`,
      inputSchema: z.object({
        pr_id: z.number().int().positive().describe('Pull request ID')
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ pr_id }) => {
      try {
        const response = await client.get(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/pullrequests/${pr_id}`
        );
        const pr: BitbucketPullRequest = response.data;
        const result = {
          id: pr.id,
          title: pr.title,
          description: pr.description,
          state: pr.state,
          author: pr.author.display_name,
          source: pr.source.branch.name,
          destination: pr.destination.branch.name,
          created_on: pr.created_on,
          updated_on: pr.updated_on,
          reviewers: pr.reviewers?.map(r => r.display_name) ?? [],
          participants: pr.participants?.map(p => ({
            user: p.user.display_name,
            role: p.role,
            approved: p.approved
          })) ?? [],
          comment_count: pr.comment_count ?? 0,
          task_count: pr.task_count ?? 0,
          merge_commit: pr.merge_commit?.hash ?? null,
          close_source_branch: pr.close_source_branch ?? false
        };
        const text = truncateResponse(JSON.stringify(result, null, 2), CHARACTER_LIMIT);
        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── bb_create_pr ─────────────────────────────────────────────
  server.registerTool(
    'bb_create_pr',
    {
      title: 'Create Pull Request',
      description: `Create a new pull request in ${WORKSPACE}/${REPO_SLUG}.

Args:
  - title (string): PR title — MUST contain a Jira ticket reference (ZN-XXX) (required)
  - source_branch (string): Source branch name (required)
  - destination_branch (string): Target branch (default: "main")
  - description (string): PR description body (optional)
  - reviewers (string[]): List of Bitbucket usernames to add as reviewers (optional)

Returns:
  Created PR details with id, title, state, and web link.

Error Handling:
  - Returns validation error if title does not contain "ZN-"`,
      inputSchema: z.object({
        title: z.string().min(1).describe('PR title — must contain ZN-XXX ticket reference'),
        source_branch: z.string().min(1).describe('Source branch name'),
        destination_branch: z.string().default('main').describe('Destination branch (default: main)'),
        description: z.string().optional().describe('PR description'),
        reviewers: z.array(z.string()).optional().describe('Reviewer usernames')
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ title, source_branch, destination_branch, description, reviewers }) => {
      try {
        if (!/ZN-\d+/.test(title)) {
          return { content: [{ type: 'text' as const, text: 'Error: Le titre de la PR doit contenir une référence Jira (ZN-XXX). Ex: "ZN-123 Ajouter feature X"' }], isError: true };
        }
        const body: Record<string, unknown> = {
          title,
          source: { branch: { name: source_branch } },
          destination: { branch: { name: destination_branch } },
        };
        if (description) body.description = description;
        if (reviewers?.length) {
          body.reviewers = reviewers.map(username => ({ username }));
        }
        const response = await client.post(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/pullrequests`,
          body
        );
        const pr = response.data;
        const result = {
          id: pr.id,
          title: pr.title,
          state: pr.state,
          source: pr.source?.branch?.name,
          destination: pr.destination?.branch?.name,
          link: pr.links?.html?.href ?? null
        };
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── bb_merge_pr ──────────────────────────────────────────────
  server.registerTool(
    'bb_merge_pr',
    {
      title: 'Merge Pull Request',
      description: `Merge a pull request in ${WORKSPACE}/${REPO_SLUG}.

Args:
  - pr_id (number): The pull request ID to merge (required)
  - merge_strategy (string): Strategy — merge_commit, squash, or fast_forward (default: squash)

Returns:
  Merged PR details with final state and merge commit hash.

Warning: This is a destructive operation that cannot be undone.`,
      inputSchema: z.object({
        pr_id: z.number().int().positive().describe('Pull request ID'),
        merge_strategy: z.enum(['merge_commit', 'squash', 'fast_forward']).default('squash').describe('Merge strategy')
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ pr_id, merge_strategy }) => {
      try {
        const response = await client.post(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/pullrequests/${pr_id}/merge`,
          { type: merge_strategy, close_source_branch: true }
        );
        const pr = response.data;
        return { content: [{ type: 'text' as const, text: JSON.stringify({
          id: pr.id,
          title: pr.title,
          state: pr.state,
          merge_commit: pr.merge_commit?.hash ?? null
        }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── bb_comment_pr ────────────────────────────────────────────
  server.registerTool(
    'bb_comment_pr',
    {
      title: 'Comment on Pull Request',
      description: `Add a comment to a pull request in ${WORKSPACE}/${REPO_SLUG}.

Args:
  - pr_id (number): The pull request ID (required)
  - content (string): Comment text in Markdown (required)

Returns:
  Created comment details with id, author, and created date.`,
      inputSchema: z.object({
        pr_id: z.number().int().positive().describe('Pull request ID'),
        content: z.string().min(1).describe('Comment body (Markdown supported)')
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ pr_id, content }) => {
      try {
        const response = await client.post(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/pullrequests/${pr_id}/comments`,
          { content: { raw: content } }
        );
        const comment = response.data;
        return { content: [{ type: 'text' as const, text: JSON.stringify({
          id: comment.id,
          author: comment.user?.display_name,
          created_on: comment.created_on,
          content_preview: content.slice(0, 100)
        }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );
}
