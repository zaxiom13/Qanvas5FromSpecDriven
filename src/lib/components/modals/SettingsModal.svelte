<script lang="ts">
  import { appState } from '$lib/state/app-state.svelte';
</script>

<div id="modal-settings" class="modal" hidden={appState.activeModal !== 'settings'}>
  <button class="modal-backdrop" type="button" aria-label="Close settings" onclick={() => appState.closeModal('settings')}></button>
  <div class="modal-box">
    <div class="modal-header">
      <h2 class="modal-title">Settings</h2>
      <button class="modal-close" id="btn-settings-close" type="button" aria-label="Close settings" onclick={() => appState.closeModal('settings')}>
        <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
      </button>
    </div>
    <div class="modal-body">
      <div class="settings-section">
        <label class="settings-label" for="runtime-path-input">q Runtime Path</label>
        <p class="settings-description">Path to the <code>q</code> executable from your kdb-x installation.</p>
        <div class="settings-input-row">
          <input type="text" id="runtime-path-input" class="settings-input" placeholder="/usr/local/bin/q" spellcheck="false" bind:value={appState.runtimePathDraft} />
          <button class="btn-secondary" id="btn-detect-runtime" type="button" onclick={() => void appState.detectRuntime()}>Auto-detect</button>
        </div>
        {#if appState.runtimeDetectStatus}
          <div id="runtime-detect-status" class="runtime-detect-status" class:ok={appState.runtimeDetectTone === 'ok'} class:error={appState.runtimeDetectTone === 'error'}>
            {appState.runtimeDetectStatus}
          </div>
        {/if}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="btn-settings-cancel" type="button" onclick={() => appState.closeModal('settings')}>Cancel</button>
      <button class="btn-primary" id="btn-settings-save" type="button" onclick={() => appState.saveSettings()}>Save</button>
    </div>
  </div>
</div>
