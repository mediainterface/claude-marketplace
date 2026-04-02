export interface AdoRemoteInfo {
  server: string;
  collection: string;
  project: string;
  repository: string;
}

/**
 * Parses an on-premises Azure DevOps Server git remote URL.
 * Expected format: https://{host}/{tfs-path}/{collection}/{project}/_git/{repo}
 * Strips trailing .git suffix. URL-decodes project and repository names.
 * Returns null if the URL does not match.
 */
export function parseAdoRemote(remoteUrl: string): AdoRemoteInfo | null {
  // Strip trailing .git suffix
  const url = remoteUrl.replace(/\.git$/, "");

  // Match: https://{host}/{tfs-path}/{collection}/{project}/_git/{repo}
  const match = url.match(/^(https?:\/\/[^/]+\/[^/]+)\/([^/]+)\/(.+)\/_git\/(.+)$/);
  if (!match) {
    return null;
  }

  const [, server, collection, projectRaw, repoRaw] = match;

  return {
    server,
    collection,
    project: decodeURIComponent(projectRaw),
    repository: decodeURIComponent(repoRaw),
  };
}
