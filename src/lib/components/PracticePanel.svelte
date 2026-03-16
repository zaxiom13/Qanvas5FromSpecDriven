<script lang="ts">
  import { appState } from '$lib/state/app-state.svelte';

  function formatValue(value: unknown) {
    return JSON.stringify(value, null, 2);
  }

  // Chart dimensions — plot area: x=[44,296], y=[12,132]
  const CHART_LEFT = 44;
  const CHART_RIGHT = 296;
  const CHART_TOP = 12;
  const CHART_BOTTOM = 132;
  const CHART_WIDTH = CHART_RIGHT - CHART_LEFT;
  const CHART_HEIGHT = CHART_BOTTOM - CHART_TOP;

  function chartX(index: number, total: number) {
    return CHART_LEFT + (index * CHART_WIDTH) / Math.max(total - 1, 1);
  }

  function chartY(value: number, values: number[]) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);
    return CHART_BOTTOM - ((value - min) / range) * CHART_HEIGHT;
  }

  function chartPath(points: Array<Record<string, string | number>>, yKey: string) {
    if (!points.length) return '';
    const values = points.map((point) => Number(point[yKey]));
    return points
      .map((point, index) => {
        const x = chartX(index, points.length);
        const y = chartY(Number(point[yKey]), values);
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }

  function dataMin(points: Array<Record<string, string | number>>, yKey: string) {
    return Math.min(...points.map((p) => Number(p[yKey])));
  }

  function dataMax(points: Array<Record<string, string | number>>, yKey: string) {
    return Math.max(...points.map((p) => Number(p[yKey])));
  }

  function fmtAxisVal(v: number) {
    // Show integers cleanly; abbreviate large numbers
    if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
    return String(Math.round(v));
  }

  const difficultyOrder: Record<string, number> = { warmup: 0, core: 1 };
  let groupedChallenges = $derived(
    Object.entries(
      appState.practiceChallenges.reduce<Record<string, typeof appState.practiceChallenges>>(
        (acc, c) => {
          const key = c.difficulty;
          if (!acc[key]) acc[key] = [];
          acc[key].push(c);
          return acc;
        },
        {}
      )
    ).sort(([a], [b]) => (difficultyOrder[a] ?? 99) - (difficultyOrder[b] ?? 99))
  );
</script>

<section id="practice-panel">
  <div class="practice-toolbar">
    <div>
      <span class="practice-eyebrow">Practice</span>
      <h2 class="practice-title">{appState.activePracticeChallenge.title}</h2>
    </div>
  </div>

  <!-- Challenge picker -->
  <nav class="practice-picker" aria-label="Choose challenge">
    {#each groupedChallenges as [difficulty, challenges]}
      <div class="practice-picker-group">
        <span class="practice-picker-label">{difficulty}</span>
        {#each challenges as challenge (challenge.id)}
          <button
            class="practice-picker-item"
            class:is-active={challenge.id === appState.practiceChallengeId}
            type="button"
            onclick={() => appState.setPracticeChallenge(challenge.id)}
          >
            {challenge.title}
          </button>
        {/each}
      </div>
    {/each}
  </nav>

  <div class="practice-scroll">
    <article class="practice-card practice-card--prompt">
      <div class="practice-chip-row">
        <span class="practice-chip">{appState.activePracticeChallenge.difficulty}</span>
        <span class="practice-chip practice-chip--ghost">define `answer`</span>
      </div>
      <p class="practice-prompt">{appState.activePracticeChallenge.prompt}</p>
      <p class="practice-hint">{appState.activePracticeChallenge.hint}</p>
    </article>

    <div class="practice-dataset-stack">
      {#each appState.activePracticeChallenge.datasets as dataset (dataset.id)}
        <article class="practice-card">
          <div class="practice-card-header">
            <h3>{dataset.label}</h3>
            <span>{dataset.kind}</span>
          </div>

          {#if dataset.kind === 'table'}
            <div class="practice-table-wrap">
              <table class="practice-table">
                <thead>
                  <tr>
                    {#each dataset.columns as column}
                      <th>{column}</th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each dataset.rows as row}
                    <tr>
                      {#each dataset.columns as column}
                        <td>{row[column]}</td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            {@const yMin = dataMin(dataset.points, dataset.yKey)}
            {@const yMax = dataMax(dataset.points, dataset.yKey)}
            {@const yMid = (yMin + yMax) / 2}
            <div class="practice-chart-wrap">
              <svg viewBox="0 0 320 160" class="practice-chart" aria-label={dataset.label}>
                <!-- Y-axis labels -->
                <text class="practice-chart-axis-label" x={CHART_LEFT - 4} y={CHART_TOP + 4} text-anchor="end">{fmtAxisVal(yMax)}</text>
                <text class="practice-chart-axis-label" x={CHART_LEFT - 4} y={(CHART_TOP + CHART_BOTTOM) / 2 + 4} text-anchor="end">{fmtAxisVal(yMid)}</text>
                <text class="practice-chart-axis-label" x={CHART_LEFT - 4} y={CHART_BOTTOM + 4} text-anchor="end">{fmtAxisVal(yMin)}</text>

                <!-- Grid lines -->
                <path
                  class="practice-chart-grid"
                  d={`M ${CHART_LEFT} ${CHART_BOTTOM} H ${CHART_RIGHT} M ${CHART_LEFT} ${(CHART_TOP + CHART_BOTTOM) / 2} H ${CHART_RIGHT} M ${CHART_LEFT} ${CHART_TOP} H ${CHART_RIGHT}`}
                />

                <!-- Y-axis tick marks -->
                <path
                  class="practice-chart-grid"
                  d={`M ${CHART_LEFT} ${CHART_TOP} V ${CHART_BOTTOM}`}
                  stroke-dasharray="none"
                />

                {#if dataset.chartType === 'bar'}
                  <!-- Bar chart -->
                  {@const values = dataset.points.map((p) => Number(p[dataset.yKey]))}
                  {@const barW = Math.floor(CHART_WIDTH / dataset.points.length) - 6}
                  {#each dataset.points as point, index}
                    {@const bx = chartX(index, dataset.points.length) - barW / 2}
                    {@const by = chartY(Number(point[dataset.yKey]), values)}
                    <rect
                      x={bx}
                      y={by}
                      width={barW}
                      height={CHART_BOTTOM - by}
                      class="practice-chart-bar"
                    />
                  {/each}
                {:else}
                  <!-- Line chart -->
                  <path class="practice-chart-line" d={chartPath(dataset.points, dataset.yKey)} />
                  {#each dataset.points as point, index}
                    {@const values = dataset.points.map((entry) => Number(entry[dataset.yKey]))}
                    <circle
                      cx={chartX(index, dataset.points.length)}
                      cy={chartY(Number(point[dataset.yKey]), values)}
                      r="4"
                      class="practice-chart-dot"
                    />
                  {/each}
                {/if}

                <!-- X-axis labels -->
                {#each dataset.points as point, index}
                  <text
                    class="practice-chart-axis-label"
                    x={chartX(index, dataset.points.length)}
                    y="150"
                    text-anchor="middle"
                  >{point[dataset.xKey]}</text>
                {/each}
              </svg>
            </div>
          {/if}
        </article>
      {/each}
    </div>

    {#if appState.practiceVerification}
      <article class="practice-card practice-card--verification">
        <div class="practice-card-header">
          <h3>Verification</h3>
          <span class={`practice-status practice-status--${appState.practiceVerification.status}`}>
            {appState.practiceVerification.status}
          </span>
        </div>

        <p class="practice-verification-copy">{appState.practiceVerification.message}</p>

        <div class="practice-compare-grid">
          <div class="practice-compare-card">
            <div class="practice-compare-label">Your output</div>
            <pre>{formatValue(appState.practiceVerification.actual)}</pre>
          </div>
          <div class="practice-compare-card">
            <div class="practice-compare-label">{appState.activePracticeChallenge.answerLabel}</div>
            <pre>{formatValue(appState.practiceVerification.expected)}</pre>
          </div>
        </div>
      </article>
    {/if}
  </div>
</section>
