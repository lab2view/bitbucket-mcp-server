// Bitbucket API paginated response envelope
export interface BitbucketPaginatedResponse<T> {
  pagelen: number;
  size?: number;
  page?: number;
  next?: string;
  previous?: string;
  values: T[];
}

// Pull Request types
export interface BitbucketUser {
  display_name: string;
  uuid: string;
  nickname?: string;
  account_id?: string;
}

export interface BitbucketRef {
  branch: { name: string };
  commit: { hash: string };
  repository?: { full_name: string };
}

export interface BitbucketPullRequest {
  id: number;
  title: string;
  description?: string;
  state: string;
  author: BitbucketUser;
  source: BitbucketRef;
  destination: BitbucketRef;
  created_on: string;
  updated_on: string;
  merge_commit?: { hash: string } | null;
  close_source_branch?: boolean;
  reviewers?: BitbucketUser[];
  participants?: Array<{
    user: BitbucketUser;
    role: string;
    approved: boolean;
  }>;
  comment_count?: number;
  task_count?: number;
}

// Branch types
export interface BitbucketBranch {
  name: string;
  target: {
    hash: string;
    date: string;
    message?: string;
    author?: { raw: string; user?: BitbucketUser };
  };
  type: string;
}

// Commit types
export interface BitbucketCommit {
  hash: string;
  date: string;
  message: string;
  author: { raw: string; user?: BitbucketUser };
  parents?: Array<{ hash: string }>;
}

// Tag types
export interface BitbucketTag {
  name: string;
  target: {
    hash: string;
    date: string;
  };
  message?: string;
  type: string;
}

// Pipeline types
export interface BitbucketPipeline {
  uuid: string;
  state: {
    name: string;
    result?: { name: string };
    stage?: { name: string };
  };
  target: {
    ref_name?: string;
    ref_type?: string;
    selector?: { type: string; pattern?: string };
  };
  created_on: string;
  completed_on?: string;
  duration_in_seconds?: number;
  build_number?: number;
}

// Branch restriction types
export interface BitbucketBranchRestriction {
  id: number;
  kind: string;
  pattern: string;
  branch_match_kind?: string;
  branch_type?: string;
  users?: BitbucketUser[];
  groups?: Array<{ slug: string; name?: string }>;
  value?: number;
}

// Permission types
export interface BitbucketUserPermission {
  user: BitbucketUser;
  permission: 'read' | 'write' | 'admin';
}

export interface BitbucketGroupPermission {
  group: { slug: string; name?: string };
  permission: 'read' | 'write' | 'admin';
}
