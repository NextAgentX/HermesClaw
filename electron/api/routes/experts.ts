/**
 * Expert routes - pre-create and manage persistent expert agents.
 *
 * Unlike regular agent creation (which triggers gateway reload),
 * expert pre-creation writes config silently without restarting the gateway.
 * This avoids disruptive resets during normal use.
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  createAgent,
  listAgentsSnapshot,
} from '../../utils/agent-config';
import { expandPath } from '../../utils/paths';
import { syncAllProviderAuthToRuntime } from '../../services/providers/provider-runtime-sync';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';

interface ExpertEnsureItem {
  id: string;       // expert template id
  name: string;     // display name (zh)
  systemPrompt: string;
}

interface ExpertMapping {
  [expertId: string]: string; // expertId → agentId
}

const MAPPING_PATH = expandPath('~/.openclaw/hermesclaw-experts-mapping.json');

async function loadMapping(): Promise<ExpertMapping> {
  try {
    const raw = await readFile(MAPPING_PATH, 'utf-8');
    return JSON.parse(raw) as ExpertMapping;
  } catch {
    return {};
  }
}

async function saveMapping(mapping: ExpertMapping): Promise<void> {
  await writeFile(MAPPING_PATH, JSON.stringify(mapping, null, 2), 'utf-8');
}

async function writeExpertSoulFile(agentId: string, systemPrompt: string): Promise<void> {
  const soulPath = expandPath(join('~/.openclaw/agents', agentId, 'agent', 'SOUL.md'));
  try {
    await writeFile(soulPath, systemPrompt, 'utf-8');
  } catch (err) {
    console.warn(`[experts] Failed to write SOUL.md for agent ${agentId}:`, err);
  }
}

export async function handleExpertRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  _ctx: HostApiContext,
): Promise<boolean> {
  // GET /api/experts/mapping - return current expertId→agentId mapping
  if (url.pathname === '/api/experts/mapping' && req.method === 'GET') {
    const mapping = await loadMapping();
    sendJson(res, 200, { success: true, mapping });
    return true;
  }

  // POST /api/experts/ensure - ensure all expert agents are pre-created
  if (url.pathname === '/api/experts/ensure' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ experts: ExpertEnsureItem[] }>(req);
      const expertItems = body.experts ?? [];

      // Load existing mapping
      const mapping = await loadMapping();

      // Get current agent IDs to check which exist
      const snapshot = await listAgentsSnapshot();
      const existingAgentIds = new Set(snapshot.agents.map(a => a.id));

      const results: { expertId: string; agentId: string; created: boolean }[] = [];
      let anyCreated = false;

      for (const item of expertItems) {
        const existingAgentId = mapping[item.id];

        // Check if mapped agent still exists
        if (existingAgentId && existingAgentIds.has(existingAgentId)) {
          results.push({ expertId: item.id, agentId: existingAgentId, created: false });
          continue;
        }

        // Need to create agent
        try {
          const newSnapshot = await createAgent(item.name);
          // Find the newly created agent by diffing
          const newAgentIds = new Set(newSnapshot.agents.map(a => a.id));
          const newAgentId = [...newAgentIds].find(id => !existingAgentIds.has(id));

          if (newAgentId) {
            mapping[item.id] = newAgentId;
            existingAgentIds.add(newAgentId);
            // Write systemPrompt to SOUL.md
            await writeExpertSoulFile(newAgentId, item.systemPrompt);
            results.push({ expertId: item.id, agentId: newAgentId, created: true });
            anyCreated = true;
          }
        } catch (err) {
          console.warn(`[experts] Failed to create agent for expert ${item.id}:`, err);
          results.push({ expertId: item.id, agentId: '', created: false });
        }
      }

      // Save updated mapping
      await saveMapping(mapping);

      // Sync provider auth for newly created agents (without triggering gateway reload)
      if (anyCreated) {
        syncAllProviderAuthToRuntime().catch((err) => {
          console.warn('[experts] Failed to sync provider auth after expert creation:', err);
        });
      }

      sendJson(res, 200, { success: true, mapping, results });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  return false;
}
