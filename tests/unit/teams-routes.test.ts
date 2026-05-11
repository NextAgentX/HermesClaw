import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HostApiContext } from '@electron/api/context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleTeamRoutes } from '@electron/api/routes/teams';

const { mockParseJsonBody, mockSendJson } = vi.hoisted(() => ({
  mockParseJsonBody: vi.fn(),
  mockSendJson: vi.fn(),
}));

vi.mock('@electron/api/route-utils', () => ({
  parseJsonBody: mockParseJsonBody,
  sendJson: mockSendJson,
}));

const mockTeamManager = vi.hoisted(() => ({
  createTeam: vi.fn(),
  listTeams: vi.fn(),
  getTeam: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
}));

vi.mock('@electron/services/team-manager', () => mockTeamManager);

function makeReq(method: string): IncomingMessage {
  return { method } as IncomingMessage;
}

function makeUrl(pathname: string): URL {
  return new URL(`http://localhost${pathname}`);
}

function makeCtx(): HostApiContext {
  return { gatewayManager: { rpc: vi.fn() } } as unknown as HostApiContext;
}

function makeRes(): ServerResponse {
  return {} as ServerResponse;
}

describe('handleTeamRoutes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates a team', async () => {
    mockParseJsonBody.mockResolvedValue({ name: 'Alpha', orchestratorId: 'orch-1' });
    mockTeamManager.createTeam.mockReturnValue({ id: 'team-1' });

    const res = makeRes();
    const matched = await handleTeamRoutes(makeReq('POST'), res, makeUrl('/api/teams'), makeCtx());

    expect(matched).toBe(true);
    expect(mockParseJsonBody).toHaveBeenCalledTimes(1);
    expect(mockTeamManager.createTeam).toHaveBeenCalledWith({ name: 'Alpha', orchestratorId: 'orch-1' });
    expect(mockSendJson).toHaveBeenCalledWith(res, 201, { success: true, team: { id: 'team-1' } });
  });

  it('rejects team creation without required fields', async () => {
    mockParseJsonBody.mockResolvedValue({ name: 'Alpha' });

    const res = makeRes();
    const matched = await handleTeamRoutes(makeReq('POST'), res, makeUrl('/api/teams'), makeCtx());

    expect(matched).toBe(true);
    expect(mockTeamManager.createTeam).not.toHaveBeenCalled();
    expect(mockSendJson).toHaveBeenCalledWith(res, 400, {
      success: false,
      error: 'name and orchestratorId are required',
    });
  });

  it('returns 500 when team creation fails', async () => {
    mockParseJsonBody.mockResolvedValue({ name: 'Alpha', orchestratorId: 'orch-1' });
    mockTeamManager.createTeam.mockImplementation(() => {
      throw new Error('boom');
    });

    const res = makeRes();
    const matched = await handleTeamRoutes(makeReq('POST'), res, makeUrl('/api/teams'), makeCtx());

    expect(matched).toBe(true);
    expect(mockSendJson).toHaveBeenCalledWith(res, 500, { success: false, error: 'Error: boom' });
  });

  it('lists teams', async () => {
    mockTeamManager.listTeams.mockReturnValue([{ id: 'team-1' }]);

    const res = makeRes();
    const matched = await handleTeamRoutes(makeReq('GET'), res, makeUrl('/api/teams'), makeCtx());

    expect(matched).toBe(true);
    expect(mockTeamManager.listTeams).toHaveBeenCalledTimes(1);
    expect(mockSendJson).toHaveBeenCalledWith(res, 200, { success: true, teams: [{ id: 'team-1' }] });
  });

  it('gets a team', async () => {
    mockTeamManager.getTeam.mockReturnValue({ id: 'team-1' });

    const res = makeRes();
    const matched = await handleTeamRoutes(makeReq('GET'), res, makeUrl('/api/teams/team-1'), makeCtx());

    expect(matched).toBe(true);
    expect(mockTeamManager.getTeam).toHaveBeenCalledWith('team-1');
    expect(mockSendJson).toHaveBeenCalledWith(res, 200, { success: true, team: { id: 'team-1' } });
  });

  it('returns 404 when team is missing', async () => {
    mockTeamManager.getTeam.mockImplementation(() => {
      throw new Error('not found');
    });

    const res = makeRes();
    const matched = await handleTeamRoutes(makeReq('GET'), res, makeUrl('/api/teams/team-1'), makeCtx());

    expect(matched).toBe(true);
    expect(mockSendJson).toHaveBeenCalledWith(res, 404, { success: false, error: 'Error: not found' });
  });

  it('updates a team', async () => {
    mockParseJsonBody.mockResolvedValue({ name: 'Beta' });
    mockTeamManager.updateTeam.mockReturnValue({ id: 'team-1', name: 'Beta' });

    const res = makeRes();
    const matched = await handleTeamRoutes(makeReq('PUT'), res, makeUrl('/api/teams/team-1'), makeCtx());

    expect(matched).toBe(true);
    expect(mockParseJsonBody).toHaveBeenCalledTimes(1);
    expect(mockTeamManager.updateTeam).toHaveBeenCalledWith('team-1', { name: 'Beta' });
    expect(mockSendJson).toHaveBeenCalledWith(res, 200, { success: true, team: { id: 'team-1', name: 'Beta' } });
  });

  it('deletes a team', async () => {
    const res = makeRes();
    const matched = await handleTeamRoutes(makeReq('DELETE'), res, makeUrl('/api/teams/team-1'), makeCtx());

    expect(matched).toBe(true);
    expect(mockTeamManager.deleteTeam).toHaveBeenCalledWith('team-1');
    expect(mockSendJson).toHaveBeenCalledWith(res, 200, { success: true });
  });

  it('adds a member', async () => {
    mockParseJsonBody.mockResolvedValue({ agentId: 'agent-1' });
    mockTeamManager.addMember.mockReturnValue({ id: 'team-1', members: ['agent-1'] });

    const res = makeRes();
    const matched = await handleTeamRoutes(makeReq('POST'), res, makeUrl('/api/teams/team-1/members'), makeCtx());

    expect(matched).toBe(true);
    expect(mockTeamManager.addMember).toHaveBeenCalledWith('team-1', 'agent-1');
    expect(mockSendJson).toHaveBeenCalledWith(res, 200, {
      success: true,
      team: { id: 'team-1', members: ['agent-1'] },
    });
  });

  it('rejects member add without agentId', async () => {
    mockParseJsonBody.mockResolvedValue({});

    const res = makeRes();
    const matched = await handleTeamRoutes(makeReq('POST'), res, makeUrl('/api/teams/team-1/members'), makeCtx());

    expect(matched).toBe(true);
    expect(mockTeamManager.addMember).not.toHaveBeenCalled();
    expect(mockSendJson).toHaveBeenCalledWith(res, 400, { success: false, error: 'agentId is required' });
  });

  it('removes a member', async () => {
    mockTeamManager.removeMember.mockReturnValue({ id: 'team-1', members: [] });

    const res = makeRes();
    const matched = await handleTeamRoutes(makeReq('DELETE'), res, makeUrl('/api/teams/team-1/members/agent-1'), makeCtx());

    expect(matched).toBe(true);
    expect(mockTeamManager.removeMember).toHaveBeenCalledWith('team-1', 'agent-1');
    expect(mockSendJson).toHaveBeenCalledWith(res, 200, { success: true, team: { id: 'team-1', members: [] } });
  });

  it('sends a team chat message', async () => {
    mockParseJsonBody.mockResolvedValue({ message: 'hello' });
    mockTeamManager.getTeam.mockReturnValue({ orchestratorId: 'orch-1' });

    const rpc = vi.fn().mockResolvedValue({ ok: true });
    const ctx = { gatewayManager: { rpc } } as unknown as HostApiContext;
    const res = makeRes();

    const matched = await handleTeamRoutes(makeReq('POST'), res, makeUrl('/api/teams/team-1/chat'), ctx);

    expect(matched).toBe(true);
    expect(mockTeamManager.getTeam).toHaveBeenCalledWith('team-1');
    expect(rpc).toHaveBeenCalledWith(
      'chat.send',
      { sessionKey: 'agent:orch-1:main', message: 'hello', deliver: false },
      30_000,
    );
    expect(mockSendJson).toHaveBeenCalledWith(res, 200, { success: true, result: { ok: true } });
  });

  it('rejects chat without message', async () => {
    mockParseJsonBody.mockResolvedValue({});

    const res = makeRes();
    const matched = await handleTeamRoutes(makeReq('POST'), res, makeUrl('/api/teams/team-1/chat'), makeCtx());

    expect(matched).toBe(true);
    expect(mockTeamManager.getTeam).not.toHaveBeenCalled();
    expect(mockSendJson).toHaveBeenCalledWith(res, 400, { success: false, error: 'message is required' });
  });

  it('returns false for unmatched routes', async () => {
    const matched = await handleTeamRoutes(makeReq('GET'), makeRes(), makeUrl('/api/not-teams'), makeCtx());

    expect(matched).toBe(false);
    expect(mockSendJson).not.toHaveBeenCalled();
  });
});
