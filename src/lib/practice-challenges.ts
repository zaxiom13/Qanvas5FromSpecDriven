export type PracticeDatasetTable = {
  kind: 'table';
  id: string;
  label: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
};

export type PracticeDatasetChart = {
  kind: 'chart';
  id: string;
  label: string;
  chartType: 'bar' | 'line';
  xKey: string;
  yKey: string;
  points: Array<Record<string, string | number>>;
};

export type PracticeDataset = PracticeDatasetTable | PracticeDatasetChart;

export type PracticeChallenge = {
  id: string;
  title: string;
  difficulty: 'warmup' | 'core';
  prompt: string;
  hint: string;
  answerLabel: string;
  answerExpression: string;
  expected: unknown;
  starterCode: string;
  datasets: PracticeDataset[];
};

export const PRACTICE_CHALLENGES: PracticeChallenge[] = [
  {
    id: 'city-revenue-rollup',
    title: 'City Revenue Rollup',
    difficulty: 'warmup',
    prompt:
      'Use the preloaded `sales` table to build `answer`, a table with `city` and `totalRevenue` columns. Keep only cities whose total revenue is at least 200, and sort the result by `totalRevenue` descending.',
    hint: 'The dataset is already in q form. You only need to aggregate and shape the output table.',
    answerLabel: 'Expected revenue table',
    answerExpression: 'flip answer',
    expected: {
      city: ['London', 'Paris'],
      totalRevenue: [260, 200],
    },
    starterCode: `sales:([]
  city:\`London\`London\`Paris\`Paris\`Berlin\`Berlin;
  quarter:\`Q1\`Q2\`Q1\`Q2\`Q1\`Q2;
  revenue:120 140 90 110 80 70
);

/ Build answer as a table with city and totalRevenue columns.
/ Keep cities with totalRevenue >= 200 and sort descending.
answer:([] city:\`symbol$(); totalRevenue:\`long$());
`,
    datasets: [
      {
        kind: 'table',
        id: 'sales',
        label: 'sales',
        columns: ['city', 'quarter', 'revenue'],
        rows: [
          { city: 'London', quarter: 'Q1', revenue: 120 },
          { city: 'London', quarter: 'Q2', revenue: 140 },
          { city: 'Paris', quarter: 'Q1', revenue: 90 },
          { city: 'Paris', quarter: 'Q2', revenue: 110 },
          { city: 'Berlin', quarter: 'Q1', revenue: 80 },
          { city: 'Berlin', quarter: 'Q2', revenue: 70 },
        ],
      },
    ],
  },
  {
    id: 'monthly-lift',
    title: 'Monthly Lift',
    difficulty: 'core',
    prompt:
      'Use the preloaded `traffic` table to build `answer`, a table with `month` and `lift` columns for months where visits increased compared with the previous month. Sort by `lift` descending and keep the top two rows.',
    hint: 'Think in deltas. The left panel gives you both the rendered table and a chart so the pattern is easy to inspect before you write q.',
    answerLabel: 'Expected top lift table',
    answerExpression: 'flip answer',
    expected: {
      month: ['Apr', 'Jun'],
      lift: [28, 21],
    },
    starterCode: `traffic:([]
  month:\`Jan\`Feb\`Mar\`Apr\`May\`Jun;
  visits:108 124 119 147 141 162
);

/ Build answer as a table with month and lift columns.
/ lift is the positive increase versus the previous month.
/ Sort descending and keep the top two rows.
answer:([] month:\`symbol$(); lift:\`long$());
`,
    datasets: [
      {
        kind: 'table',
        id: 'traffic',
        label: 'traffic',
        columns: ['month', 'visits'],
        rows: [
          { month: 'Jan', visits: 108 },
          { month: 'Feb', visits: 124 },
          { month: 'Mar', visits: 119 },
          { month: 'Apr', visits: 147 },
          { month: 'May', visits: 141 },
          { month: 'Jun', visits: 162 },
        ],
      },
      {
        kind: 'chart',
        id: 'traffic-chart',
        label: 'Visits trend',
        chartType: 'line',
        xKey: 'month',
        yKey: 'visits',
        points: [
          { month: 'Jan', visits: 108 },
          { month: 'Feb', visits: 124 },
          { month: 'Mar', visits: 119 },
          { month: 'Apr', visits: 147 },
          { month: 'May', visits: 141 },
          { month: 'Jun', visits: 162 },
        ],
      },
    ],
  },
];

export function getPracticeChallenge(challengeId: string) {
  return PRACTICE_CHALLENGES.find((challenge) => challenge.id === challengeId) ?? PRACTICE_CHALLENGES[0];
}
