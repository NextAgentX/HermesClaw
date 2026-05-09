/**
 * Expert Center Page
 * Browse and use pre-created persistent AI expert agents.
 *
 * All expert agents are pre-created at app startup - no summon/dismiss cycle.
 * Click "使用" to navigate directly to chat with the pre-existing agent.
 */
import { useState, useMemo, useEffect } from 'react';
import { Search, Users, User, MessageSquare, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useExpertsStore, BUILT_IN_EXPERTS, BUILT_IN_EXPERT_TEAMS } from '@/stores/experts';
import type { ExpertTemplate, ExpertTeamTemplate } from '@/types/expert';
import { EXPERT_CATEGORIES } from '@/types/expert';

// Category label map
const CATEGORY_LABELS: Record<string, { zh: string; en: string }> = {
  all: { zh: '全部', en: 'All' },
  'product-design': { zh: '产品设计', en: 'Product Design' },
  engineering: { zh: '技术工程', en: 'Engineering' },
  finance: { zh: '金融投资', en: 'Finance' },
  content: { zh: '内容创作', en: 'Content' },
  research: { zh: '深度研究', en: 'Research' },
  data: { zh: '数据分析', en: 'Data' },
  operations: { zh: '运营增长', en: 'Operations' },
};

// Generate avatar background color from name
const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-rose-500',
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.slice(0, 2);
}

// Expert Card Component
interface ExpertCardProps {
  expert: ExpertTemplate;
  isReady: boolean;
  loading: boolean;
  onUse: (expert: ExpertTemplate) => void;
}

function ExpertCard({ expert, isReady, loading, onUse }: ExpertCardProps) {
  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm">
      {/* Avatar + Name */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white',
            getAvatarColor(expert.id)
          )}
        >
          {getInitials(expert.name.zh)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">{expert.name.zh}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{expert.name.en}</p>
        </div>
      </div>

      {/* Description */}
      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {expert.description.zh}
      </p>

      {/* Tags */}
      {expert.tags && expert.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {expert.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="h-7 flex-1 gap-1 text-xs"
          onClick={() => onUse(expert)}
          disabled={loading || !isReady}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <MessageSquare className="h-3 w-3" />
          )}
          {loading ? '准备中...' : '使用'}
        </Button>
      </div>
    </div>
  );
}

// Expert Team Card Component
interface ExpertTeamCardProps {
  team: ExpertTeamTemplate;
  isReady: boolean;
  loading: boolean;
  onUse: (team: ExpertTeamTemplate) => void;
}

function ExpertTeamCard({ team, isReady, loading, onUse }: ExpertTeamCardProps) {
  // Get up to 4 member experts for avatars
  const memberExperts = team.expertIds
    .slice(0, 4)
    .map(id => BUILT_IN_EXPERTS.find(e => e.id === id))
    .filter((e): e is ExpertTemplate => e !== undefined);

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{team.name.zh}</h3>
          <p className="text-xs text-muted-foreground">{team.expertIds.length} 位专家</p>
        </div>
      </div>

      {/* Description */}
      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {team.description.zh}
      </p>

      {/* Member avatars */}
      <div className="flex items-center gap-1">
        {memberExperts.map((expert, i) => (
          <div
            key={expert.id}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-card',
              getAvatarColor(expert.id)
            )}
            style={{ marginLeft: i > 0 ? '-6px' : '0' }}
            title={expert.name.zh}
          >
            {getInitials(expert.name.zh)}
          </div>
        ))}
        {team.expertIds.length > 4 && (
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card"
            style={{ marginLeft: '-6px' }}
          >
            +{team.expertIds.length - 4}
          </div>
        )}
      </div>

      {/* Tags */}
      {team.tags && team.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {team.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="h-7 flex-1 gap-1 text-xs"
          onClick={() => onUse(team)}
          disabled={loading || !isReady}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Users className="h-3 w-3" />
          )}
          {loading ? '准备中...' : '使用专家团'}
        </Button>
      </div>
    </div>
  );
}

// Main Experts Page
type TabType = 'teams' | 'experts';

export function Experts() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('experts');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { expertMapping, initialized, loading, error, ensureExperts, getAgentId, isReady } =
    useExpertsStore();

  // Ensure all expert agents are pre-created on mount
  useEffect(() => {
    if (!initialized && !loading) {
      void ensureExperts();
    }
  }, [initialized, loading, ensureExperts]);

  // Filter experts
  const filteredExperts = useMemo(() => {
    let experts = BUILT_IN_EXPERTS;

    if (activeCategory !== 'all') {
      experts = experts.filter(e => e.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      experts = experts.filter(
        e =>
          e.name.zh.toLowerCase().includes(q) ||
          e.name.en.toLowerCase().includes(q) ||
          e.description.zh.toLowerCase().includes(q) ||
          (e.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }

    return experts;
  }, [activeCategory, searchQuery]);

  // Filter teams
  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return BUILT_IN_EXPERT_TEAMS;
    const q = searchQuery.toLowerCase();
    return BUILT_IN_EXPERT_TEAMS.filter(
      t =>
        t.name.zh.toLowerCase().includes(q) ||
        t.name.en.toLowerCase().includes(q) ||
        t.description.zh.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleUseExpert = (expert: ExpertTemplate) => {
    const agentId = getAgentId(expert.id);
    if (agentId) {
      navigate(`/?agent=${agentId}`);
    }
  };

  const handleUseTeam = (team: ExpertTeamTemplate) => {
    // Navigate to the first available expert in the team
    const firstExpertId = team.expertIds.find(id => isReady(id));
    if (firstExpertId) {
      const agentId = getAgentId(firstExpertId);
      if (agentId) {
        navigate(`/?agent=${agentId}`);
      }
    }
  };

  const readyCount = Object.keys(expertMapping).length;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">专家中心</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {loading
                ? '正在初始化专家智能体...'
                : error
                  ? '初始化失败，请重试'
                  : readyCount > 0
                    ? `${readyCount} 位专家已就绪`
                    : '专家智能体'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Retry button on error */}
            {error && !loading && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => void ensureExperts()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重试
              </Button>
            )}

            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索专家或专家团..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1">
          <button
            onClick={() => setActiveTab('experts')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'experts'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              专家
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                {BUILT_IN_EXPERTS.length}
              </Badge>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'teams'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              专家团
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                {BUILT_IN_EXPERT_TEAMS.length}
              </Badge>
            </span>
          </button>
        </div>
      </div>

      {/* Loading / Error state */}
      {loading && (
        <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-6 py-2.5 text-xs text-primary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          正在后台初始化专家智能体，请稍候...
        </div>
      )}
      {error && !loading && (
        <div className="flex items-center gap-2 border-b border-border bg-destructive/5 px-6 py-2.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Category sidebar (experts tab only) */}
        {activeTab === 'experts' && (
          <div className="w-40 shrink-0 overflow-y-auto border-r border-border bg-card/50 px-2 py-3">
            {EXPERT_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'w-full rounded-md px-3 py-2 text-left text-xs font-medium transition-colors',
                  activeCategory === cat
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {CATEGORY_LABELS[cat]?.zh ?? cat}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'experts' && (
            <>
              {filteredExperts.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  没有找到匹配的专家
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredExperts.map(expert => (
                    <ExpertCard
                      key={expert.id}
                      expert={expert}
                      isReady={isReady(expert.id)}
                      loading={loading}
                      onUse={handleUseExpert}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'teams' && (
            <>
              {filteredTeams.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  没有找到匹配的专家团
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredTeams.map(team => (
                    <ExpertTeamCard
                      key={team.id}
                      team={team}
                      isReady={team.expertIds.some(id => isReady(id))}
                      loading={loading}
                      onUse={handleUseTeam}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
