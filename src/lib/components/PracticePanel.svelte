<script lang="ts">
  import { appState } from '$lib/state/app-state.svelte';

  function formatValue(value: unknown) {
    return JSON.stringify(value, null, 2);
  }

  function chartPath(points: Array<Record<string, string | number>>, yKey: string) {
    if (!points.length) return '';

    const values = points.map((point) => Number(point[yKey]));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);

    return points
      .map((point, index) => {
        const x = chartX(index, points.length);
        const y = chartY(Number(point[yKey]), values);
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }

  function chartX(index: number, total: number) {
    return 24 + (index * 252) / Math.max(total - 1, 1);
  }

  function chartY(value: number, values: number[]) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);
    return 124 - ((value - min) / range) * 92;
  }
</script>

<section id="practice-panel">
  <div class="practice-toolbar">
    <div>
      <span class="practice-eyebrow">Practice</span>
      <h2 class="practice-title">{appState.activePracticeChallenge.title}</h2>
    </div>

    <label class="practice-select-wrap">
      <span class="visually-hidden">Choose challenge</span>
      <select
        class="practice-select"
        bind:value={appState.practiceChallengeId}
        onchange={(event) => appState.setPracticeChallenge((event.currentTarget as HTMLSelectElement).value)}
      >
        {#each appState.practiceChallenges as challenge (challenge.id)}
          <option value={challenge.id}>{challenge.title}</option>
        {/each}
      </select>
    </label>
  </div>

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
            <div class="practice-chart-wrap">
              <svg viewBox="0 0 300 150" class="practice-chart" aria-label={dataset.label}>
                <path class="practice-chart-grid" d="M 24 124 H 276 M 24 78 H 276 M 24 32 H 276" />
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
              </svg>
              <div class="practice-chart-labels">
                {#each dataset.points as point}
                  <span>{point[dataset.xKey]}</span>
                {/each}
              </div>
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
