<script lang="ts">
  import { formatDisplayValue } from '$lib/formatting/value-format';
  import { appState } from '$lib/state/app-state.svelte';
  import {
    PRACTICE_CHART,
    createPracticePanelViewModel,
    formatPracticeAxisValue,
  } from '$lib/view-models/practice-panel';

  let viewModel = $derived(
    createPracticePanelViewModel(appState.practiceChallenges, appState.activePracticeChallenge)
  );
</script>

<section id="practice-panel">
  <div class="practice-toolbar">
    <div>
      <span class="practice-eyebrow">Practice</span>
      <h2 class="practice-title">{viewModel.activeChallenge.title}</h2>
    </div>
  </div>

  <!-- Challenge picker -->
  <nav class="practice-picker" aria-label="Choose challenge">
    {#each viewModel.challengeGroups as group}
      <div class="practice-picker-group">
        <span class="practice-picker-label">{group.difficulty}</span>
        {#each group.challenges as challenge (challenge.id)}
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
        <span class="practice-chip">{viewModel.activeChallenge.difficulty}</span>
        <span class="practice-chip practice-chip--ghost">define `answer`</span>
      </div>
      <p class="practice-prompt">{viewModel.activeChallenge.prompt}</p>
      <p class="practice-hint">{viewModel.activeChallenge.hint}</p>
      <div class="practice-actions">
        {#if appState.practiceAnswerVisible}
          <button class="btn-secondary" id="btn-practice-hide-answer" type="button" onclick={() => appState.hidePracticeAnswer()}>
            Hide answer
          </button>
          <button class="btn-secondary" id="btn-practice-load-answer" type="button" onclick={() => appState.loadPracticeAnswer()}>
            Use answer
          </button>
          <button class="btn-secondary" id="btn-practice-reset" type="button" onclick={() => appState.resetPracticeStarter()}>
            Reset starter
          </button>
        {:else}
          <button class="btn-secondary" id="btn-practice-show-answer" type="button" onclick={() => appState.revealPracticeAnswer()}>
            Show answer
          </button>
        {/if}
      </div>
    </article>

    {#if appState.practiceAnswerVisible}
      <article class="practice-card practice-card--answer">
        <div class="practice-card-header">
          <h3>Working answer</h3>
          <span>solution</span>
        </div>

        <div class="practice-answer-body">
          <p class="practice-answer-copy">If you’re stuck, this is a runnable answer for the current practice. You can inspect it here or load it into the editor and verify it.</p>
          <pre class="practice-answer-code">{appState.activePracticeSolution}</pre>
        </div>
      </article>
    {/if}

    <div class="practice-dataset-stack">
      {#each viewModel.datasets as dataset (dataset.id)}
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
              <svg viewBox="0 0 320 160" class="practice-chart" aria-label={dataset.label}>
                <!-- Y-axis labels -->
                <text class="practice-chart-axis-label" x={PRACTICE_CHART.left - 4} y={PRACTICE_CHART.top + 4} text-anchor="end">{formatPracticeAxisValue(dataset.chart.yMax)}</text>
                <text class="practice-chart-axis-label" x={PRACTICE_CHART.left - 4} y={(PRACTICE_CHART.top + PRACTICE_CHART.bottom) / 2 + 4} text-anchor="end">{formatPracticeAxisValue(dataset.chart.yMid)}</text>
                <text class="practice-chart-axis-label" x={PRACTICE_CHART.left - 4} y={PRACTICE_CHART.bottom + 4} text-anchor="end">{formatPracticeAxisValue(dataset.chart.yMin)}</text>

                <!-- Grid lines -->
                <path
                  class="practice-chart-grid"
                  d={dataset.chart.gridPath}
                />

                <!-- Y-axis tick marks -->
                <path
                  class="practice-chart-grid"
                  d={`M ${PRACTICE_CHART.left} ${PRACTICE_CHART.top} V ${PRACTICE_CHART.bottom}`}
                  stroke-dasharray="none"
                />

                {#if dataset.chartType === 'bar'}
                  <!-- Bar chart -->
                  {#each dataset.chart.bars as bar}
                    <rect
                      x={bar.x}
                      y={bar.y}
                      width={dataset.chart.barWidth}
                      height={bar.height}
                      class="practice-chart-bar"
                    />
                  {/each}
                {:else}
                  <!-- Line chart -->
                  <path class="practice-chart-line" d={dataset.chart.linePath} />
                  {#each dataset.chart.dots as dot}
                    <circle cx={dot.cx} cy={dot.cy} r="4" class="practice-chart-dot" />
                  {/each}
                {/if}

                <!-- X-axis labels -->
                {#each dataset.chart.labels as label}
                  <text
                    class="practice-chart-axis-label"
                    x={label.x}
                    y="150"
                    text-anchor="middle"
                  >{label.value}</text>
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
            <pre>{formatDisplayValue(appState.practiceVerification.actual)}</pre>
          </div>
          <div class="practice-compare-card">
            <div class="practice-compare-label">{viewModel.activeChallenge.answerLabel}</div>
            <pre>{formatDisplayValue(appState.practiceVerification.expected)}</pre>
          </div>
        </div>
      </article>
    {/if}
  </div>
</section>
