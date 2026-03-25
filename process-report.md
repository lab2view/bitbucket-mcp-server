# Process Report — Bitbucket MCP Server

**Date** : Nuit du 21 mars 2026
**Tâche** : Construction autonome du MCP Bitbucket Cloud pour Zeney / lab2view
**Résultat** : ✅ Compilation réussie — 22 outils livrés

---

## Approche générale

J'ai lu le brief `cowork-bitbucket-mcp.md` en entier, puis consulté les guides de référence MCP (skill `mcp-builder`, guides TypeScript et best practices) avant d'écrire la moindre ligne de code. Cela m'a permis d'aligner le projet sur les conventions modernes du SDK MCP (notamment `server.registerTool()` au lieu de l'ancien `server.tool()`).

## Étapes exécutées

### 1. Initialisation du projet
- Créé la structure `bitbucket-mcp-server/src/{services,tools}`
- Écrit `package.json` avec les bonnes dépendances : `@modelcontextprotocol/sdk`, `axios`, `zod`, `dotenv`
- Écrit `tsconfig.json` en mode strict, ES2022, Node16 module resolution
- Lancé `npm install` → 111 packages installés sans erreur (quelques warnings esbuild/fsevents non-bloquants)

### 2. Fichiers fondamentaux
- **`constants.ts`** : URL de base Bitbucket, workspace/repo par défaut, CHARACTER_LIMIT à 8000
- **`types.ts`** : Interfaces TypeScript complètes pour tous les types Bitbucket API (PR, Branch, Commit, Tag, Pipeline, Restriction, Permission) — aucun `any`
- **`services/bitbucket-client.ts`** : Client HTTP axios avec Bearer token, intercepteurs d'erreur (401/403/404/429), pagination générique `fetchAllPages<T>()`, et helper `truncateResponse()`

### 3. Les 6 modules d'outils (22 outils au total)

| Module | Outils | Détails |
|---|---|---|
| `pullrequests.ts` | 5 | list, get, create (avec validation ZN-), merge (squash par défaut), comment |
| `branches.ts` | 2 | list branches (avec filtre), get commits (extraction clé Jira ZN-XXX) |
| `tags.ts` | 3 | list (tri par date), create (annotated si message), delete |
| `pipelines.ts` | 3 | list (tri par date), get details, trigger (support custom pipeline) |
| `restrictions.ts` | 4 | list, create (10 kinds supportés), update, delete |
| `permissions.ts` | 5 | list/set/delete user permissions, list/set group permissions |

**Choix techniques notables :**
- Chaque outil utilise `server.registerTool()` avec `title`, `description` complète (args + returns + examples), `inputSchema` Zod `.strict()`, et `annotations` (readOnlyHint, destructiveHint, etc.)
- Validation spéciale sur `bb_create_pr` : le titre **doit** contenir `ZN-\d+` (convention Jira Zeney)
- Validation sur `bb_create_branch_restriction` : `value` requis si kind = `require_approvals_to_merge`
- Toutes les réponses sont tronquées à 8000 caractères via `truncateResponse()`
- Extraction automatique des clés Jira (ZN-XXX) dans les messages de commit

### 4. Point d'entrée `index.ts`
- Import de `dotenv/config` pour charger les variables d'environnement
- Enregistrement séquentiel des 6 modules d'outils
- Transport stdio avec log sur stderr (conformément aux best practices MCP)

### 5. Build & vérification

**Premier build** → 1 erreur TypeScript :
```
src/services/bitbucket-client.ts(47,11): error TS7022: 'response' implicitly has type 'any'
```
**Cause** : En mode strict avec `AxiosInstance.get()` dans une boucle, TypeScript n'arrive pas à inférer le type de retour quand la variable `nextUrl` est réassignée à partir de `response.data.next`.

**Fix** : Ajout d'une annotation de type explicite `AxiosResponse<{ values?: T[]; next?: string }>` sur la variable `response`.

**Deuxième build** → ✅ Succès, 0 erreurs.

**Vérification** :
- `dist/index.js` existe ✅
- Tous les `.js`, `.d.ts`, `.js.map`, `.d.ts.map` générés pour chaque fichier source ✅
- Structure dist/ miroir de src/ ✅

### 6. Fichiers complémentaires
- **`.env.example`** : Template avec les 3 variables (token, workspace, repo) et avertissement sur Basic Auth
- **`README.md`** : Documentation complète avec tableau des 22 outils, instructions d'installation, configuration Claude Desktop, et guide de génération du token

---

## Résumé des fichiers livrés

```
bitbucket-mcp-server/
├── src/
│   ├── index.ts                          # Point d'entrée MCP stdio
│   ├── constants.ts                      # URLs, workspace, repo, limits
│   ├── types.ts                          # Interfaces TypeScript Bitbucket API
│   ├── services/
│   │   └── bitbucket-client.ts           # Client HTTP Bearer + pagination + truncate
│   └── tools/
│       ├── pullrequests.ts               # 5 outils PR
│       ├── branches.ts                   # 2 outils branches/commits
│       ├── tags.ts                       # 3 outils tags
│       ├── pipelines.ts                  # 3 outils pipelines
│       ├── restrictions.ts               # 4 outils branch restrictions
│       └── permissions.ts                # 5 outils permissions
├── dist/                                 # JavaScript compilé (ES2022)
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── process-report.md                     # Ce fichier
```

## Prochaines étapes pour Tcharod

1. **Générer un Repository Access Token** dans Bitbucket → Repository Settings → Security → Access tokens (cocher tous les scopes listés dans le README)
2. Copier `.env.example` vers `.env` et coller le token
3. Tester avec : `BITBUCKET_ACCESS_TOKEN=xxx node dist/index.js`
4. Intégrer dans Claude Desktop via la config `mcpServers` documentée dans le README
