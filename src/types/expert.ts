export interface LocalizedText {
  zh: string;
  en: string;
}

export interface ExpertTemplate {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  category: string;
  avatar?: string;
  systemPrompt: string;
  modelRef?: string;
  tags?: string[];
  usageCount?: number;
}

export interface ExpertTeamTemplate {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  expertIds: string[];
  avatar?: string;
  tags?: string[];
}

export interface SummonedExpert {
  expertId: string;
  agentId: string;
  agentName: string;
  systemPrompt: string;
  summonedAt: number;
}

export interface ExpertTeamSession {
  teamId: string;
  teamName: string;
  summonedExperts: SummonedExpert[];
  createdAt: number;
}

export const EXPERT_CATEGORIES = [
  'all',
  'product-design',
  'engineering',
  'finance',
  'content',
  'research',
  'data',
  'operations',
] as const;

export type ExpertCategory = (typeof EXPERT_CATEGORIES)[number];
