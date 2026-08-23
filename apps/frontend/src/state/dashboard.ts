import { useEffect, useState } from "react";
import { apiClient, type ReadApiClient } from "../api/client.js";
import type { GenerationRun, PostSummary } from "../types/api.js";

export type PostsState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly posts: readonly PostSummary[] }
  | { readonly status: "empty" }
  | { readonly status: "error"; readonly message: string };

export interface DashboardState {
  readonly posts: PostsState;
  readonly latestRun: GenerationRun | null;
}

const loadingState: DashboardState = {
  posts: { status: "loading" },
  latestRun: null,
};

export const loadDashboard = async (
  client: ReadApiClient,
): Promise<DashboardState> => {
  const latestRun = client.getLatestRun().catch(() => null);
  try {
    const posts = await client.listPosts();
    return {
      posts:
        posts.length === 0 ? { status: "empty" } : { status: "ready", posts },
      latestRun: await latestRun,
    };
  } catch {
    return {
      posts: { status: "error", message: "Unable to load posts." },
      latestRun: await latestRun,
    };
  }
};

export const useDashboard = (
  client: ReadApiClient = apiClient,
): DashboardState => {
  const [state, setState] = useState<DashboardState>(loadingState);

  useEffect(() => {
    let active = true;
    void loadDashboard(client).then((nextState) => {
      if (active) {
        setState(nextState);
      }
    });
    return () => {
      active = false;
    };
  }, [client]);

  return state;
};
