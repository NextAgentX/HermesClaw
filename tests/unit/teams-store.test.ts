import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTeamsStore } from '@/stores/teams';
import type { AgentTeam, AcpActivity, CreateTeamParams, UpdateTeamParams } from '@/types/team';

const { mockHostApiFetch } = vi.hoisted(() => ({
  mockHostApiFetch: vi.fn(),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: mockHostApiFetch,
}));

const createTeam = (overrides: Partial<AgentTeam> = {}): AgentTeam => ({
  id: 'team-1',
  name: 'Team One',
  description: 'First team',
  avatar: 'team-1.png',
  orchestratorId: 'agent-orchestrator-1',
  memberIds: ['agent-2', 'agent-3'],
  config: {
    delegationMode: 'auto',
    soulTemplate: 'template-a',
    sharedContext: true,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const makeActivity = (overrides: Partial<AcpActivity> = {}): AcpActivity => ({
  type: 'message',
  parentAgentId: 'agent-1',
  childAgentId: 'agent-2',
  sessionKey: 'session-1',
  teamId: 'team-1',
  content: 'hello',
  timestamp: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  useTeamsStore.setState({ teams: [], loading: false, error: null, acpActivities: [] });
});

describe('useTeamsStore', () => {
  it('has default state', () => {
    expect(useTeamsStore.getState()).toMatchObject({
      teams: [],
      loading: false,
      error: null,
      acpActivities: [],
    });
  });

  it('fetchTeams sets loading, loads teams, and clears loading', async () => {
    const teams = [createTeam(), createTeam({ id: 'team-2', name: 'Team Two' })];
    mockHostApiFetch.mockResolvedValueOnce({ success: true, teams });

    const promise = useTeamsStore.getState().fetchTeams();

    expect(useTeamsStore.getState().loading).toBe(true);
    await promise;

    expect(mockHostApiFetch).toHaveBeenCalledWith('/api/teams');
    expect(useTeamsStore.getState()).toMatchObject({
      teams,
      loading: false,
      error: null,
    });
  });

  it('fetchTeams stores error and clears loading on failure', async () => {
    mockHostApiFetch.mockRejectedValueOnce(new Error('fetch failed'));

    await useTeamsStore.getState().fetchTeams();

    expect(mockHostApiFetch).toHaveBeenCalledWith('/api/teams');
    expect(useTeamsStore.getState()).toMatchObject({
      teams: [],
      loading: false,
      error: 'Error: fetch failed',
    });
  });

  it('createTeam posts params, prepends team, and returns it', async () => {
    const existing = createTeam({ id: 'team-existing', name: 'Existing Team' });
    useTeamsStore.setState({ teams: [existing] });

    const params: CreateTeamParams = {
      name: 'New Team',
      description: 'Created team',
      orchestratorId: 'agent-orchestrator-2',
      memberIds: ['agent-4'],
      config: { delegationMode: 'manual', sharedContext: false },
    };
    const created = createTeam({ id: 'team-new', name: 'New Team', orchestratorId: 'agent-orchestrator-2' });
    mockHostApiFetch.mockResolvedValueOnce({ success: true, team: created });

    const result = await useTeamsStore.getState().createTeam(params);

    expect(result).toEqual(created);
    expect(mockHostApiFetch).toHaveBeenCalledWith(
      '/api/teams',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
    );
    expect(useTeamsStore.getState().teams).toEqual([created, existing]);
  });

  it('createTeam stores error and throws on failure', async () => {
    const error = new Error('create failed');
    mockHostApiFetch.mockRejectedValueOnce(error);

    await expect(
      useTeamsStore.getState().createTeam({
        name: 'Broken Team',
        orchestratorId: 'agent-orchestrator-1',
      })
    ).rejects.toThrow('create failed');

    expect(useTeamsStore.getState().error).toBe('Error: create failed');
  });

  it('updateTeam replaces the matching team', async () => {
    const existing = createTeam({ id: 'team-existing', name: 'Existing Team' });
    const target = createTeam({ id: 'team-update', name: 'Old Name' });
    useTeamsStore.setState({ teams: [existing, target] });

    const params: UpdateTeamParams = {
      name: 'Updated Name',
      orchestratorId: 'agent-orchestrator-3',
      config: { delegationMode: 'manual' },
    };
    const updated = createTeam({ id: 'team-update', name: 'Updated Name', orchestratorId: 'agent-orchestrator-3' });
    mockHostApiFetch.mockResolvedValueOnce({ success: true, team: updated });

    await useTeamsStore.getState().updateTeam('team-update', params);

    expect(mockHostApiFetch).toHaveBeenCalledWith(
      '/api/teams/team-update',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
    );
    expect(useTeamsStore.getState().teams).toEqual([existing, updated]);
  });

  it('updateTeam stores error and throws on failure', async () => {
    mockHostApiFetch.mockRejectedValueOnce(new Error('update failed'));

    await expect(
      useTeamsStore.getState().updateTeam('team-1', {
        name: 'Updated Name',
      })
    ).rejects.toThrow('update failed');

    expect(useTeamsStore.getState().error).toBe('Error: update failed');
  });

  it('deleteTeam removes the matching team', async () => {
    const existing = createTeam({ id: 'team-existing', name: 'Existing Team' });
    const target = createTeam({ id: 'team-delete', name: 'Delete Me' });
    useTeamsStore.setState({ teams: [existing, target] });

    mockHostApiFetch.mockResolvedValueOnce({ success: true });

    await useTeamsStore.getState().deleteTeam('team-delete');

    expect(mockHostApiFetch).toHaveBeenCalledWith('/api/teams/team-delete', { method: 'DELETE' });
    expect(useTeamsStore.getState().teams).toEqual([existing]);
  });

  it('deleteTeam stores error and throws on failure', async () => {
    mockHostApiFetch.mockRejectedValueOnce(new Error('delete failed'));

    await expect(useTeamsStore.getState().deleteTeam('team-1')).rejects.toThrow('delete failed');

    expect(useTeamsStore.getState().error).toBe('Error: delete failed');
  });

  it('addMember replaces the matching team', async () => {
    const existing = createTeam({ id: 'team-existing', name: 'Existing Team' });
    const target = createTeam({ id: 'team-member', memberIds: ['agent-2'] });
    useTeamsStore.setState({ teams: [existing, target] });

    const updated = createTeam({ id: 'team-member', memberIds: ['agent-2', 'agent-99'] });
    mockHostApiFetch.mockResolvedValueOnce({ success: true, team: updated });

    await useTeamsStore.getState().addMember('team-member', 'agent-99');

    expect(mockHostApiFetch).toHaveBeenCalledWith(
      '/api/teams/team-member/members',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: 'agent-99' }),
      })
    );
    expect(useTeamsStore.getState().teams).toEqual([existing, updated]);
  });

  it('addMember stores error and throws on failure', async () => {
    mockHostApiFetch.mockRejectedValueOnce(new Error('add member failed'));

    await expect(useTeamsStore.getState().addMember('team-1', 'agent-9')).rejects.toThrow(
      'add member failed'
    );

    expect(useTeamsStore.getState().error).toBe('Error: add member failed');
  });

  it('removeMember replaces the matching team', async () => {
    const existing = createTeam({ id: 'team-existing', name: 'Existing Team' });
    const target = createTeam({ id: 'team-member', memberIds: ['agent-2', 'agent-99'] });
    useTeamsStore.setState({ teams: [existing, target] });

    const updated = createTeam({ id: 'team-member', memberIds: ['agent-2'] });
    mockHostApiFetch.mockResolvedValueOnce({ success: true, team: updated });

    await useTeamsStore.getState().removeMember('team-member', 'agent-99');

    expect(mockHostApiFetch).toHaveBeenCalledWith(
      '/api/teams/team-member/members/agent-99',
      { method: 'DELETE' }
    );
    expect(useTeamsStore.getState().teams).toEqual([existing, updated]);
  });

  it('removeMember stores error and throws on failure', async () => {
    mockHostApiFetch.mockRejectedValueOnce(new Error('remove member failed'));

    await expect(useTeamsStore.getState().removeMember('team-1', 'agent-9')).rejects.toThrow(
      'remove member failed'
    );

    expect(useTeamsStore.getState().error).toBe('Error: remove member failed');
  });

  it('pushAcpActivity appends activity synchronously', () => {
    const first = makeActivity();
    const second = makeActivity({
      type: 'spawn',
      childAgentId: 'agent-3',
      parentAgentId: 'agent-1',
      sessionKey: 'session-2',
    });

    useTeamsStore.getState().pushAcpActivity(first);
    useTeamsStore.getState().pushAcpActivity(second);

    expect(useTeamsStore.getState().acpActivities).toEqual([first, second]);
  });
});
