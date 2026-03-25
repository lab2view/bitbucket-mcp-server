import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AxiosInstance } from 'axios';
import { z } from 'zod';
import { WORKSPACE, REPO_SLUG, CHARACTER_LIMIT } from '../constants.js';
import { truncateResponse } from '../services/bitbucket-client.js';
import type { BitbucketPipeline } from '../types.js';

export function registerPipelineTools(server: McpServer, client: AxiosInstance): void {

  // ── bb_list_pipelines ────────────────────────────────────────
  server.registerTool(
    'bb_list_pipelines',
    {
      title: 'List Pipelines',
      description: `List recent pipeline runs in ${WORKSPACE}/${REPO_SLUG}, sorted by most recent first.

Args:
  - limit (number): Maximum pipelines to return, 1-50 (default: 10)
  - branch (string): Filter by branch name (optional)

Returns:
  JSON array of pipelines with: uuid, build_number, state, result, branch, duration, created date.

Examples:
  - "Show recent pipelines" → no branch filter
  - "Pipelines on main" → branch="main"`,
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(10).describe('Max pipelines to return'),
        branch: z.string().optional().describe('Filter by branch name')
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ limit, branch }) => {
      try {
        const params: Record<string, unknown> = {
          pagelen: limit,
          sort: '-created_on'
        };
        if (branch) {
          params['target.ref_name'] = branch;
        }
        const response = await client.get(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/pipelines`,
          { params }
        );
        const pipelines: BitbucketPipeline[] = response.data.values ?? [];
        const result = pipelines.map(p => ({
          uuid: p.uuid,
          build_number: p.build_number,
          state: p.state.name,
          result: p.state.result?.name ?? null,
          branch: p.target.ref_name ?? null,
          duration_seconds: p.duration_in_seconds ?? null,
          created_on: p.created_on,
          completed_on: p.completed_on ?? null
        }));
        const text = truncateResponse(JSON.stringify(result, null, 2), CHARACTER_LIMIT);
        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── bb_get_pipeline ──────────────────────────────────────────
  server.registerTool(
    'bb_get_pipeline',
    {
      title: 'Get Pipeline Details',
      description: `Get full details of a specific pipeline run in ${WORKSPACE}/${REPO_SLUG}.

Args:
  - pipeline_uuid (string): Pipeline UUID (required)

Returns:
  Complete pipeline details including: uuid, build_number, state, result, branch, duration, steps, trigger info.

Examples:
  - "Get pipeline details" → pipeline_uuid="{uuid}"`,
      inputSchema: z.object({
        pipeline_uuid: z.string().min(1).describe('Pipeline UUID')
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ pipeline_uuid }) => {
      try {
        const response = await client.get(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/pipelines/${pipeline_uuid}`
        );
        const p: BitbucketPipeline = response.data;
        const result = {
          uuid: p.uuid,
          build_number: p.build_number,
          state: p.state.name,
          result: p.state.result?.name ?? null,
          stage: p.state.stage?.name ?? null,
          branch: p.target.ref_name ?? null,
          ref_type: p.target.ref_type ?? null,
          selector: p.target.selector ?? null,
          duration_seconds: p.duration_in_seconds ?? null,
          created_on: p.created_on,
          completed_on: p.completed_on ?? null
        };
        const text = truncateResponse(JSON.stringify(result, null, 2), CHARACTER_LIMIT);
        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // ── bb_trigger_pipeline ──────────────────────────────────────
  server.registerTool(
    'bb_trigger_pipeline',
    {
      title: 'Trigger Pipeline',
      description: `Trigger a new pipeline run in ${WORKSPACE}/${REPO_SLUG}.

Args:
  - branch (string): Branch to run the pipeline on (required)
  - custom_pipeline (string): Custom pipeline name from bitbucket-pipelines.yml (optional)

Returns:
  Triggered pipeline details with uuid, build_number, state, and branch.

Examples:
  - "Run pipeline on main" → branch="main"
  - "Run deploy pipeline on release/1.0" → branch="release/1.0", custom_pipeline="deploy"`,
      inputSchema: z.object({
        branch: z.string().min(1).describe('Branch to run pipeline on'),
        custom_pipeline: z.string().optional().describe('Custom pipeline name from bitbucket-pipelines.yml')
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async ({ branch, custom_pipeline }) => {
      try {
        const body: Record<string, unknown> = {
          target: {
            ref_type: 'branch',
            type: 'pipeline_ref_target',
            ref_name: branch
          }
        };
        if (custom_pipeline) {
          (body.target as Record<string, unknown>).selector = {
            type: 'custom',
            pattern: custom_pipeline
          };
        }
        const response = await client.post(
          `/repositories/${WORKSPACE}/${REPO_SLUG}/pipelines`,
          body
        );
        const p = response.data;
        return { content: [{ type: 'text' as const, text: JSON.stringify({
          uuid: p.uuid,
          build_number: p.build_number,
          state: p.state?.name,
          branch
        }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );
}
