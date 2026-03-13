<script lang="ts">
  import { appState } from '$lib/state/app-state.svelte';
</script>

<footer id="console-panel">
  <div class="console-toolbar">
    <span class="console-title">Console</span>
    <div class="console-filters">
      <button class="console-filter-btn" type="button" class:console-filter-btn--active={appState.consoleFilter === 'all'} data-filter="all" onclick={() => (appState.consoleFilter = 'all')}>All</button>
      <button class="console-filter-btn" type="button" class:console-filter-btn--active={appState.consoleFilter === 'stdout'} data-filter="stdout" onclick={() => (appState.consoleFilter = 'stdout')}>stdout</button>
      <button class="console-filter-btn" type="button" class:console-filter-btn--active={appState.consoleFilter === 'stderr'} data-filter="stderr" onclick={() => (appState.consoleFilter = 'stderr')}>stderr</button>
    </div>
    <button id="btn-clear-console" class="btn-icon-only console-clear-btn" type="button" title="Clear console" onclick={() => appState.clearConsole(false)}>
      <svg class="icon" viewBox="0 0 16 16" fill="none">
        <path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M4 4l1 9h6l1-9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      </svg>
    </button>
  </div>
  <div id="console-output" class="console-output">
    {#each appState.filteredConsole as entry (entry.id)}
      <div class={`console-line console-line--${entry.type}`}>
        <span class="console-prefix">{entry.type === 'stdout' ? '›' : entry.type === 'stderr' ? '✕' : '—'}</span>
        <span class="console-text">{entry.text}</span>
      </div>
    {/each}
  </div>
</footer>
