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

function normalizePracticeAnswer(answerName: string) {
  return `{$[99h=type ${answerName}; flip 0!${answerName}; 98h=type ${answerName}; flip ${answerName}; ${answerName}]}[]`;
}

export const PRACTICE_CHALLENGES: PracticeChallenge[] = [
  {
    id: 'city-revenue-rollup',
    title: 'City Revenue Rollup',
    difficulty: 'warmup',
    prompt:
      'Use the preloaded `sales` table to build `answer`, a table with `city` and `totalRevenue` columns. Keep only cities whose total revenue is at least 200, and sort the result by `totalRevenue` descending.',
    hint: 'The dataset is already in q form. You only need to aggregate and shape the output table.',
    answerLabel: 'Expected revenue table',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: {
      city: ['London', 'Paris'],
      totalRevenue: [260, 200],
    },
    starterCode: `sales:([]
  city:\`London\`London\`Paris\`Paris\`Berlin\`Berlin;
  quarter:\`Q1\`Q2\`Q1\`Q2\`Q1\`Q2;
  revenue:120 140 90 110 80 70;
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
    id: 'hot-days',
    title: 'Hot Days',
    difficulty: 'warmup',
    prompt:
      'Use the preloaded `weather` table to build `answer`, a table with `day` and `tempC` columns containing only days where the temperature exceeded 24 °C. Sort the result by `tempC` descending.',
    hint: 'Filter with `where tempC > 24` then sort. `xdesc` sorts a table by a column descending.',
    answerLabel: 'Expected hot days',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: {
      day: ['Sat', 'Thu', 'Fri'],
      tempC: [31, 27, 25],
    },
    starterCode: `weather:([]
  day:\`Mon\`Tue\`Wed\`Thu\`Fri\`Sat\`Sun;
  tempC:18 22 20 27 25 31 16
);

/ Build answer: days where tempC > 24, with day and tempC columns, sorted by tempC descending.
answer:([] day:\`symbol$(); tempC:\`long$());
`,
    datasets: [
      {
        kind: 'table',
        id: 'weather',
        label: 'weather',
        columns: ['day', 'tempC'],
        rows: [
          { day: 'Mon', tempC: 18 },
          { day: 'Tue', tempC: 22 },
          { day: 'Wed', tempC: 20 },
          { day: 'Thu', tempC: 27 },
          { day: 'Fri', tempC: 25 },
          { day: 'Sat', tempC: 31 },
          { day: 'Sun', tempC: 16 },
        ],
      },
      {
        kind: 'chart',
        id: 'weather-chart',
        label: 'Temp by day',
        chartType: 'bar',
        xKey: 'day',
        yKey: 'tempC',
        points: [
          { day: 'Mon', tempC: 18 },
          { day: 'Tue', tempC: 22 },
          { day: 'Wed', tempC: 20 },
          { day: 'Thu', tempC: 27 },
          { day: 'Fri', tempC: 25 },
          { day: 'Sat', tempC: 31 },
          { day: 'Sun', tempC: 16 },
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
    answerExpression: normalizePracticeAnswer('answer'),
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
  {
    id: 'dept-max-salary',
    title: 'Dept Max Salary',
    difficulty: 'core',
    prompt:
      'Use the preloaded `staff` table to build `answer`, a table with `dept` and `maxSalary` columns showing the highest salary in each department. Sort by `maxSalary` descending.',
    hint: '`select max salary by dept` groups and aggregates in one shot. `xdesc` sorts the result.',
    answerLabel: 'Expected salary table',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: {
      dept: ['Eng', 'Ops', 'Mktg'],
      maxSalary: [112000, 78000, 71000],
    },
    starterCode: `staff:([]
  name:\`Alice\`Bob\`Carlos\`Diana\`Eve;
  dept:\`Eng\`Mktg\`Eng\`Ops\`Mktg;
  salary:95000 67000 112000 78000 71000
);

/ Build answer: a table with dept and maxSalary, sorted by maxSalary descending.
answer:([] dept:\`symbol$(); maxSalary:\`long$());
`,
    datasets: [
      {
        kind: 'table',
        id: 'staff',
        label: 'staff',
        columns: ['name', 'dept', 'salary'],
        rows: [
          { name: 'Alice', dept: 'Eng', salary: 95000 },
          { name: 'Bob', dept: 'Mktg', salary: 67000 },
          { name: 'Carlos', dept: 'Eng', salary: 112000 },
          { name: 'Diana', dept: 'Ops', salary: 78000 },
          { name: 'Eve', dept: 'Mktg', salary: 71000 },
        ],
      },
    ],
  },
  {
    id: 'goal-difference',
    title: 'Goal Difference',
    difficulty: 'core',
    prompt:
      'Use the preloaded `matches` table to build `answer`, a table with `team` and `goalDiff` columns showing each team\'s total goals scored minus goals conceded across all their matches. Sort by `goalDiff` descending.',
    hint: '`select sum scored-conceded by team` computes the net goal difference in one expression.',
    answerLabel: 'Expected standings',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: {
      team: ['Arsenal', 'Chelsea', 'Spurs'],
      goalDiff: [4, 1, -1],
    },
    starterCode: `matches:([]
  team:\`Arsenal\`Arsenal\`Chelsea\`Chelsea\`Spurs\`Spurs;
  scored:2 3 1 4 0 2;
  conceded:1 0 3 1 2 1
);

/ Build answer: a table with team and goalDiff (scored - conceded total), sorted desc.
answer:([] team:\`symbol$(); goalDiff:\`long$());
`,
    datasets: [
      {
        kind: 'table',
        id: 'matches',
        label: 'matches',
        columns: ['team', 'scored', 'conceded'],
        rows: [
          { team: 'Arsenal', scored: 2, conceded: 1 },
          { team: 'Arsenal', scored: 3, conceded: 0 },
          { team: 'Chelsea', scored: 1, conceded: 3 },
          { team: 'Chelsea', scored: 4, conceded: 1 },
          { team: 'Spurs', scored: 0, conceded: 2 },
          { team: 'Spurs', scored: 2, conceded: 1 },
        ],
      },
    ],
  },
];

export function getPracticeChallenge(challengeId: string) {
  return PRACTICE_CHALLENGES.find((challenge) => challenge.id === challengeId) ?? PRACTICE_CHALLENGES[0];
}
