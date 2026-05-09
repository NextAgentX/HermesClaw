import type { ExpertTeamTemplate } from '../types/expert';

export const BUILT_IN_EXPERT_TEAMS: ExpertTeamTemplate[] = [
  {
    id: 'software-dev-team',
    name: { zh: '软件开发团队', en: 'Software Development Team' },
    description: {
      zh: '全栈开发团队，覆盖前端、后端、DevOps，适合完整项目开发',
      en: 'Full-stack team covering frontend, backend, DevOps for complete project development',
    },
    expertIds: ['senior-dev', 'frontend-engineer', 'backend-engineer', 'devops-engineer'],
    tags: ['全栈开发', '软件工程'],
  },
  {
    id: 'product-design-team',
    name: { zh: '产品设计团队', en: 'Product Design Team' },
    description: {
      zh: '产品与设计协作团队，从用户研究到 UI 设计全流程覆盖',
      en: 'Product and design collaboration team covering full flow from user research to UI design',
    },
    expertIds: ['product-manager', 'ui-designer', 'ux-researcher'],
    tags: ['产品设计', '用户体验'],
  },
  {
    id: 'content-creation-team',
    name: { zh: '内容创作专家团', en: 'Content Creation Team' },
    description: {
      zh: '专业内容团队，覆盖营销文案、技术文档和多平台内容运营',
      en: 'Professional content team for marketing copy, technical docs and multi-platform content',
    },
    expertIds: ['content-creator', 'technical-writer'],
    tags: ['内容创作', '文案写作'],
  },
  {
    id: 'financial-analysis-team',
    name: { zh: '交易分析团队', en: 'Financial Analysis Team' },
    description: {
      zh: '金融分析团队，结合基本面研究和量化方法进行投资决策',
      en: 'Financial analysis team combining fundamental research and quantitative methods',
    },
    expertIds: ['investment-analyst', 'quant-analyst'],
    tags: ['金融分析', '投资研究'],
  },
  {
    id: 'deep-research-team',
    name: { zh: '深度研究团队', en: 'Deep Research Team' },
    description: {
      zh: '系统性研究团队，行业研究、数据分析和战略报告全覆盖',
      en: 'Systematic research team for industry analysis, data insights and strategy reports',
    },
    expertIds: ['research-analyst', 'data-analyst', 'investment-analyst'],
    tags: ['深度研究', '市场分析'],
  },
  {
    id: 'data-ai-team',
    name: { zh: 'AI 数据团队', en: 'AI & Data Team' },
    description: {
      zh: '数据与 AI 团队，从数据分析到机器学习模型全栈覆盖',
      en: 'Data and AI team covering data analysis to machine learning model deployment',
    },
    expertIds: ['data-analyst', 'ml-engineer'],
    tags: ['数据科学', '人工智能'],
  },
  {
    id: 'growth-team',
    name: { zh: '增长运营团队', en: 'Growth Team' },
    description: {
      zh: '增长黑客团队，数据驱动的用户增长和内容营销策略',
      en: 'Growth hacker team with data-driven user growth and content marketing strategy',
    },
    expertIds: ['growth-operator', 'data-analyst', 'content-creator'],
    tags: ['增长运营', '用户获取'],
  },
  {
    id: 'full-stack-product-team',
    name: { zh: '产品战略团队', en: 'Product Strategy Team' },
    description: {
      zh: '完整产品团队，从市场研究、产品规划到技术实现全链路',
      en: 'Complete product team from market research and product planning to technical implementation',
    },
    expertIds: ['product-manager', 'research-analyst', 'senior-dev', 'ui-designer'],
    tags: ['产品战略', '全链路'],
  },
];
