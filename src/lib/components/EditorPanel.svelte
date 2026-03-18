<script lang="ts">
  import { electronGateway } from '$lib/electron';
  import { onMount } from 'svelte';
  import MonacoEditor from '$lib/components/MonacoEditor.svelte';
  import { appState } from '$lib/state/app-state.svelte';

  function handleGlobalShortcuts() {
    const saveHandler = () => void appState.saveProject(false);
    const sidebarHandler = () => appState.toggleSidebar();
    const exampleHandler = () => (appState.activeModal = appState.activeModal === 'examples' ? null : 'examples');
    const projectsHandler = () => appState.openProjectsModal();
    const newHandler = () => void appState.createNewSketch();

    window.addEventListener('qanvas:save', saveHandler as EventListener);
    window.addEventListener('qanvas:toggle-sidebar', sidebarHandler as EventListener);
    window.addEventListener('qanvas:toggle-examples', exampleHandler as EventListener);
    window.addEventListener('qanvas:toggle-projects', projectsHandler as EventListener);
    window.addEventListener('qanvas:new-sketch', newHandler as EventListener);

    return () => {
      window.removeEventListener('qanvas:save', saveHandler as EventListener);
      window.removeEventListener('qanvas:toggle-sidebar', sidebarHandler as EventListener);
      window.removeEventListener('qanvas:toggle-examples', exampleHandler as EventListener);
      window.removeEventListener('qanvas:toggle-projects', projectsHandler as EventListener);
      window.removeEventListener('qanvas:new-sketch', newHandler as EventListener);
    };
  }

  onMount(() => {
    const disposeShortcuts = handleGlobalShortcuts();
    const disposeMenuComment = electronGateway.menu.onToggleComment(() => {
      window.dispatchEvent(new CustomEvent('qanvas:toggle-comment'));
    });

    return () => {
      disposeShortcuts();
      disposeMenuComment();
    };
  });
</script>

<section id="editor-panel">
  <div class="editor-tabs">
    <div class="editor-tab editor-tab--active" id="active-tab">
      <svg class="file-icon" viewBox="0 0 16 16" fill="none">
        <path d="M4 2h6l3 3v9H4V2z" stroke="currentColor" stroke-width="1" fill="none" />
        <path d="M10 2v3h3" stroke="currentColor" stroke-width="1" fill="none" />
      </svg>
      <span id="active-tab-name">{appState.workspaceMode === 'practice' ? 'Practice Editor' : appState.activeFileName}</span>
    </div>
  </div>

  <MonacoEditor
    activeKey={appState.activeEditorKey}
    value={appState.activeEditorValue}
    onChange={(value) => appState.updateActiveEditorContent(value)}
  />
</section>
