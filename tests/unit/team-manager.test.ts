import { beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';

const {
  mockExistsSync,
  mockReadFileSync,
  mockWriteFileSync,
  mockReaddirSync,
  mockUnlinkSync,
  mockRandomUUID,
  mockHomedir,
  mockGetDataDir,
  mockEnsureDir,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
  mockRandomUUID: vi.fn(),
  mockHomedir: vi.fn(),
  mockGetDataDir: vi.fn(),
  mockEnsureDir: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  readdirSync: mockReaddirSync,
  unlinkSync: mockUnlinkSync,
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    readdirSync: mockReaddirSync,
    unlinkSync: mockUnlinkSync,
  },
}));

vi.mock('node:crypto', () => ({
  randomUUID: mockRandomUUID,
  default: {
    randomUUID: mockRandomUUID,
  },
}));

vi.mock('node:os', () => ({
  homedir: mockHomedir,
  default: {
    homedir: mockHomedir,
  },
}));

vi.mock('../../electron/utils/paths', () => ({
  getDataDir: mockGetDataDir,
  ensureDir: mockEnsureDir,
  default: {
    getDataDir: mockGetDataDir,
    ensureDir: mockEnsureDir,
  },
}));

const DATA_DIR = '/fake/data';
const HOME_DIR = '/fake/home';
const TEAMS_DIR = join(DATA_DIR, 'teams');

function setupModule(): Promise<typeof import('../../electron/services/team-manager')> {
  return import('../../electron/services/team-manager');
}

function teamFilePath(teamId: string): string {
  return join(TEAMS_DIR, `${teamId}.json`);
}

function agentSoulPath(orchestratorId: string): string {
  return join(HOME_DIR, '.openclaw', 'agents', orchestratorId, 'agent', 'SOUL.md');
}

describe('team-manager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-02T03:04:05.000Z'));

    mockGetDataDir.mockReturnValue(DATA_DIR);
    mockHomedir.mockReturnValue(HOME_DIR);
    mockRandomUUID.mockReturnValue('team-uuid');
    mockEnsureDir.mockImplementation(() => undefined);
  });

  it('createTeam creates a team file with defaults and returns the team', async () => {
    const { createTeam } = await setupModule();

    const team = createTeam({
      name: 'Alpha',
      description: 'Ops team',
      avatar: 'alpha.png',
      orchestratorId: 'orch-1',
      memberIds: ['agent-1'],
      config: { sharedContext: false },
    });

    expect(team).toEqual({
      id: 'team-uuid',
      name: 'Alpha',
      description: 'Ops team',
      avatar: 'alpha.png',
      orchestratorId: 'orch-1',
      memberIds: ['agent-1'],
      config: {
        delegationMode: 'auto',
        sharedContext: false,
      },
      createdAt: '2026-01-02T03:04:05.000Z',
      updatedAt: '2026-01-02T03:04:05.000Z',
    });

    expect(mockEnsureDir).toHaveBeenCalledWith(TEAMS_DIR);
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      teamFilePath('team-uuid'),
      JSON.stringify(team, null, 2),
      'utf-8',
    );
  });

  it('updateTeam patches an existing team and persists it', async () => {
    const existing = {
      id: 'team-1',
      name: 'Old',
      description: 'Old desc',
      avatar: 'old.png',
      orchestratorId: 'orch-old',
      memberIds: ['agent-1'],
      config: { delegationMode: 'manual' as const, sharedContext: true },
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    mockExistsSync.mockImplementation((path: unknown) => path === teamFilePath('team-1'));
    mockReadFileSync.mockImplementation((path: unknown) => {
      if (path === teamFilePath('team-1')) {
        return JSON.stringify(existing);
      }
      throw new Error(`Unexpected read: ${String(path)}`);
    });

    const { updateTeam } = await setupModule();

    const updated = updateTeam('team-1', {
      name: 'New',
      avatar: 'new.png',
      orchestratorId: 'orch-new',
      config: { sharedContext: false },
    });

    expect(updated).toEqual({
      ...existing,
      name: 'New',
      avatar: 'new.png',
      orchestratorId: 'orch-new',
      config: {
        delegationMode: 'manual',
        sharedContext: false,
      },
      updatedAt: '2026-01-02T03:04:05.000Z',
    });
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      teamFilePath('team-1'),
      JSON.stringify(updated, null, 2),
      'utf-8',
    );
  });

  it('deleteTeam removes an existing team file', async () => {
    mockExistsSync.mockImplementation((path: unknown) => path === teamFilePath('team-1'));

    const { deleteTeam } = await setupModule();

    deleteTeam('team-1');

    expect(mockUnlinkSync).toHaveBeenCalledWith(teamFilePath('team-1'));
  });

  it('listTeams reads json files and sorts by updatedAt descending', async () => {
    const teamA = {
      id: 'team-a',
      name: 'A',
      description: '',
      orchestratorId: 'orch-a',
      memberIds: [],
      config: { delegationMode: 'auto' as const, sharedContext: true },
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
    };
    const teamB = {
      id: 'team-b',
      name: 'B',
      description: '',
      orchestratorId: 'orch-b',
      memberIds: [],
      config: { delegationMode: 'manual' as const, sharedContext: false },
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-03T00:00:00.000Z',
    };

    mockReaddirSync.mockReturnValue(['team-a.json', 'notes.txt', 'team-b.json']);
    mockReadFileSync.mockImplementation((path: unknown) => {
      if (path === join(TEAMS_DIR, 'team-a.json')) return JSON.stringify(teamA);
      if (path === join(TEAMS_DIR, 'team-b.json')) return JSON.stringify(teamB);
      throw new Error(`Unexpected read: ${String(path)}`);
    });

    const { listTeams } = await setupModule();

    expect(listTeams()).toEqual([teamB, teamA]);
    expect(mockEnsureDir).toHaveBeenCalledWith(TEAMS_DIR);
  });

  it('getTeam returns the parsed team', async () => {
    const team = {
      id: 'team-1',
      name: 'Team 1',
      description: '',
      orchestratorId: 'orch-1',
      memberIds: ['agent-1'],
      config: { delegationMode: 'auto' as const, sharedContext: true },
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    mockExistsSync.mockImplementation((path: unknown) => path === teamFilePath('team-1'));
    mockReadFileSync.mockImplementation((path: unknown) => {
      if (path === teamFilePath('team-1')) return JSON.stringify(team);
      throw new Error(`Unexpected read: ${String(path)}`);
    });

    const { getTeam } = await setupModule();

    expect(getTeam('team-1')).toEqual(team);
  });

  it('addMember appends a missing member and deduplicates existing ones', async () => {
    const team = {
      id: 'team-1',
      name: 'Team 1',
      description: '',
      orchestratorId: 'orch-1',
      memberIds: ['agent-1'],
      config: { delegationMode: 'auto' as const, sharedContext: true },
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    mockExistsSync.mockImplementation((path: unknown) => path === teamFilePath('team-1'));
    mockReadFileSync.mockImplementation((path: unknown) => {
      if (path === teamFilePath('team-1')) return JSON.stringify(team);
      throw new Error(`Unexpected read: ${String(path)}`);
    });

    const { addMember } = await setupModule();

    const added = addMember('team-1', 'agent-2');
    expect(added.memberIds).toEqual(['agent-1', 'agent-2']);
    expect(added.updatedAt).toBe('2026-01-02T03:04:05.000Z');
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      teamFilePath('team-1'),
      JSON.stringify(added, null, 2),
      'utf-8',
    );

    vi.clearAllMocks();
    mockExistsSync.mockImplementation((path: unknown) => path === teamFilePath('team-1'));
    mockReadFileSync.mockImplementation((path: unknown) => {
      if (path === teamFilePath('team-1')) return JSON.stringify(team);
      throw new Error(`Unexpected read: ${String(path)}`);
    });

    const duplicate = addMember('team-1', 'agent-1');
    expect(duplicate.memberIds).toEqual(['agent-1']);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('removeMember filters out a member and persists the team', async () => {
    const team = {
      id: 'team-1',
      name: 'Team 1',
      description: '',
      orchestratorId: 'orch-1',
      memberIds: ['agent-1', 'agent-2'],
      config: { delegationMode: 'auto' as const, sharedContext: true },
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    mockExistsSync.mockImplementation((path: unknown) => path === teamFilePath('team-1'));
    mockReadFileSync.mockImplementation((path: unknown) => {
      if (path === teamFilePath('team-1')) return JSON.stringify(team);
      throw new Error(`Unexpected read: ${String(path)}`);
    });

    const { removeMember } = await setupModule();

    const updated = removeMember('team-1', 'agent-1');
    expect(updated.memberIds).toEqual(['agent-2']);
    expect(updated.updatedAt).toBe('2026-01-02T03:04:05.000Z');
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      teamFilePath('team-1'),
      JSON.stringify(updated, null, 2),
      'utf-8',
    );
  });

  it('generateOrchestratorSoul includes team details and auto delegation rules', async () => {
    const { generateOrchestratorSoul } = await setupModule();

    const soul = generateOrchestratorSoul(
      {
        id: 'team-1',
        name: 'Alpha',
        description: 'Handles ops',
        orchestratorId: 'orch-1',
        memberIds: ['agent-1', 'agent-2'],
        config: { delegationMode: 'auto', sharedContext: true },
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
      ['Alice', 'Bob'],
    );

    expect(soul).toContain('# Team Orchestrator: Alpha');
    expect(soul).toContain('Team purpose: Handles ops');
    expect(soul).toContain('- Alice (ID: agent-1)');
    expect(soul).toContain('- Bob (ID: agent-2)');
    expect(soul).toContain('Automatically delegate subtasks to the most appropriate team member based on their specialization.');
  });

  it('generateOrchestratorSoul uses the manual delegation rule when configured', async () => {
    const { generateOrchestratorSoul } = await setupModule();

    const soul = generateOrchestratorSoul(
      {
        id: 'team-1',
        name: 'Beta',
        description: '',
        orchestratorId: 'orch-1',
        memberIds: [],
        config: { delegationMode: 'manual', sharedContext: false },
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
      [],
    );

    expect(soul).toContain('- (no members yet)');
    expect(soul).toContain('Ask the user which team member should handle each subtask before delegating.');
  });

  it('writeOrchestratorSoul writes SOUL.md when the orchestrator directory exists', async () => {
    mockExistsSync.mockImplementation((path: unknown) => path === join(HOME_DIR, '.openclaw', 'agents', 'orch-1', 'agent'));

    const { writeOrchestratorSoul } = await setupModule();

    const team = {
      id: 'team-1',
      name: 'Alpha',
      description: 'Handles ops',
      orchestratorId: 'orch-1',
      memberIds: ['agent-1'],
      config: { delegationMode: 'auto' as const, sharedContext: true },
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    writeOrchestratorSoul(team, ['Alice']);

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      agentSoulPath('orch-1'),
      expect.stringContaining('# Team Orchestrator: Alpha'),
      'utf-8',
    );
  });

  it.each([
    ['updateTeam', async () => {
      const { updateTeam } = await setupModule();
      updateTeam('missing', {});
    }],
    ['deleteTeam', async () => {
      const { deleteTeam } = await setupModule();
      deleteTeam('missing');
    }],
    ['getTeam', async () => {
      const { getTeam } = await setupModule();
      getTeam('missing');
    }],
    ['addMember', async () => {
      const { addMember } = await setupModule();
      addMember('missing', 'agent-1');
    }],
    ['removeMember', async () => {
      const { removeMember } = await setupModule();
      removeMember('missing', 'agent-1');
    }],
  ])('%s throws when the team does not exist', async (_name, action) => {
    mockExistsSync.mockReturnValue(false);

    await expect(action()).rejects.toThrow('Team not found: missing');
  });
});
