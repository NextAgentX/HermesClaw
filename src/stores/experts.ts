/**
 * Experts store - manages pre-created persistent expert agents.
 *
 * All expert agents are pre-created at app startup (or first visit to Expert Center).
 * This avoids the gateway reset UX issue caused by dynamic agent creation on each summon.
 *
 * Flow:
 *   1. App initializes → ensureExperts() called (once)
 *   2. POST /api/experts/ensure sends all templates → backend creates missing agents + writes SOUL.md
 *   3. expertMapping (expertId→agentId) persisted to localStorage
 *   4. UI: click 使用 → navigate to /?agent={agentId}
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { hostApiFetch } from '@/lib/host-api';
import { BUILT_IN_EXPERTS } from '@/data/experts';
import { BUILT_IN_EXPERT_TEAMS } from '@/data/expert-teams';
import type { ExpertTemplate, ExpertTeamTemplate } from '@/types/expert';

interface ExpertsState {
  /** Maps expertId → agentId for all pre-created expert agents */
  expertMapping: Record<string, string>;
  /** Whether ensureExperts has completed successfully */
  initialized: boolean;
  /** Whether ensureExperts is currently running */
  loading: boolean;
  /** Error from last ensureExperts call */
  error: string | null;

  /** Pre-create all expert agents (idempotent - skips existing ones) */
  ensureExperts: () => Promise<void>;

  /** Get the agentId for a given expertId */
  getAgentId: (expertId: string) => string | undefined;

  /** Check if an expert agent exists (has been provisioned) */
  isReady: (expertId: string) => boolean;

  /** Reset initialized flag (forces re-provision on next ensureExperts call) */
  reset: () => void;
}

export const useExpertsStore = create<ExpertsState>()(
  persist(
    (set, get) => ({
      expertMapping: {},
      initialized: false,
      loading: false,
      error: null,

      ensureExperts: async () => {
        // Skip if already running
        if (get().loading) return;

        set({ loading: true, error: null });

        try {
          // Build the list of expert items to send to the backend
          const experts = BUILT_IN_EXPERTS.map(e => ({
            id: e.id,
            name: e.name.zh,
            systemPrompt: e.systemPrompt,
          }));

          const response = await hostApiFetch<{
            success: boolean;
            mapping: Record<string, string>;
            results: { expertId: string; agentId: string; created: boolean }[];
          }>('/api/experts/ensure', {
            method: 'POST',
            body: JSON.stringify({ experts }),
          });

          if (response.success && response.mapping) {
            set({
              expertMapping: response.mapping,
              initialized: true,
              loading: false,
              error: null,
            });
          } else {
            set({ loading: false, error: 'Failed to ensure experts' });
          }
        } catch (err) {
          set({ loading: false, error: String(err) });
        }
      },

      getAgentId: (expertId: string) => {
        return get().expertMapping[expertId];
      },

      isReady: (expertId: string) => {
        return Boolean(get().expertMapping[expertId]);
      },

      reset: () => {
        set({ initialized: false, expertMapping: {}, error: null });
      },
    }),
    {
      name: 'hermesclaw-experts',
      partialize: state => ({
        expertMapping: state.expertMapping,
        initialized: state.initialized,
      }),
    }
  )
);

// Re-export built-in data for convenience
export { BUILT_IN_EXPERTS, BUILT_IN_EXPERT_TEAMS };
export type { ExpertTemplate, ExpertTeamTemplate };
