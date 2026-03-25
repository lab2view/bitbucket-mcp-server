# Bitbucket MCP Server

MCP server pour l'API Bitbucket Cloud — projet **Zeney** / **lab2view**.

## Fonctionnalités (22 outils)

| Catégorie | Outils | Type |
|---|---|---|
| Pull Requests | `bb_list_prs`, `bb_get_pr`, `bb_create_pr`, `bb_merge_pr`, `bb_comment_pr` | Read/Write |
| Branches | `bb_list_branches`, `bb_get_commits` | Read |
| Tags | `bb_list_tags`, `bb_create_tag`, `bb_delete_tag` | Read/Write |
| Pipelines | `bb_list_pipelines`, `bb_get_pipeline`, `bb_trigger_pipeline` | Read/Write |
| Restrictions | `bb_list_branch_restrictions`, `bb_create_branch_restriction`, `bb_update_branch_restriction`, `bb_delete_branch_restriction` | Read/Write |
| Permissions | `bb_list_user_permissions`, `bb_set_user_permission`, `bb_delete_user_permission`, `bb_list_group_permissions`, `bb_set_group_permission` | Read/Write |

## Installation

```bash
npm install
npm run build
```

## Configuration

Copie `.env.example` vers `.env` et remplis le token :

```bash
cp .env.example .env
```

### Générer un Repository Access Token

1. Va dans **Bitbucket → Repository Settings → Security → Access tokens**
2. Clique **Create**
3. Coche les scopes nécessaires :
   - `repository:read` — branches, commits, tags
   - `repository:write` — create/delete tags
   - `repository:admin` — restrictions, permissions
   - `pullrequest:read` — list/get PRs
   - `pullrequest:write` — create/merge/comment PRs
   - `pipeline:read` — list/get pipelines
   - `pipeline:write` — trigger pipelines

> **⚠️ NE PAS utiliser Basic Auth / App Passwords** — déprécié en juin 2026.

## Utilisation

### Stdio (local)

```bash
npm start
```

### Configuration Claude Desktop

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node",
      "args": ["<chemin>/bitbucket-mcp-server/dist/index.js"],
      "env": {
        "BITBUCKET_ACCESS_TOKEN": "<ton_token>",
        "BITBUCKET_WORKSPACE": "lab2view_team",
        "BITBUCKET_REPO": "zn.platform"
      }
    }
  }
}
```

## Stack technique

- TypeScript strict
- Transport : stdio
- SDK : `@modelcontextprotocol/sdk`
- Validation : Zod (`.strict()`)
- HTTP : axios (Bearer token)
- API : `https://api.bitbucket.org/2.0`
