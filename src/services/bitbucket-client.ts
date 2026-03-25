import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import { BITBUCKET_BASE_URL } from '../constants.js';

export function createBitbucketClient(): AxiosInstance {
  const token = process.env.BITBUCKET_ACCESS_TOKEN;
  if (!token) throw new Error(
    'BITBUCKET_ACCESS_TOKEN est requis. ' +
    'Génère un Repository Access Token dans Bitbucket → Repository Settings → Security → Access tokens.'
  );

  const client = axios.create({
    baseURL: BITBUCKET_BASE_URL,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });

  client.interceptors.response.use(
    response => response,
    (error: AxiosError) => {
      const status = error.response?.status;
      const data = error.response?.data as Record<string, unknown> | undefined;
      const message = (data?.error as Record<string, unknown>)?.message ?? error.message;
      if (status === 401) throw new Error('Token invalide ou expiré. Régénère un Repository Access Token dans Bitbucket Settings.');
      if (status === 403) throw new Error('Permission refusée. Vérifie que le token a le scope requis (repository:admin pour restrictions/permissions).');
      if (status === 404) throw new Error(`Ressource introuvable : ${error.config?.url}`);
      if (status === 429) throw new Error('Rate limit atteint. Réessaie dans quelques secondes.');
      throw new Error(`Bitbucket API error ${status}: ${message}`);
    }
  );

  return client;
}

export async function fetchAllPages<T>(
  client: AxiosInstance,
  url: string,
  params: Record<string, unknown> = {},
  maxPages: number = 10
): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = url;
  let page = 0;
  while (nextUrl && page < maxPages) {
    const response: AxiosResponse<{ values?: T[]; next?: string }> = await client.get(nextUrl, { params: nextUrl === url ? params : {} });
    results.push(...(response.data.values ?? []));
    nextUrl = response.data.next ?? null;
    page++;
  }
  return results;
}

export function truncateResponse(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit) + '\n\n... [Réponse tronquée. Utilisez les paramètres limit/filter pour affiner.]';
}
