<script lang="ts">
  import { onMount } from 'svelte';
  import { CanvasSurface } from '$lib/runtime/canvas-surface';
  import { appState } from '$lib/state/app-state.svelte';

  const surface = new CanvasSurface();
  let canvasElement = $state<HTMLCanvasElement | null>(null);
  let containerElement = $state<HTMLDivElement | null>(null);
  let frameHandle = 0;
  let frameNumber = 0;
  let startTime = 0;
  let lastTime = 0;
  let activeRunNonce = -1;
  let inFlight = false;

  const inputState = {
    mouse: null as [number, number] | null,
    mouseButtons: { left: false, middle: false, right: false },
    scroll: [0, 0] as [number, number],
    key: '',
    keys: new Set<string>(),
  };

  function setMouseToCanvasCenter() {
    if (!canvasElement) return;
    const rect = canvasElement.getBoundingClientRect();
    inputState.mouse = [rect.width * 0.5, rect.height * 0.5];
  }

  function updateMouse(event: PointerEvent) {
    if (!canvasElement) return;
    const rect = canvasElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      return;
    }
    inputState.mouse = [x, y];
  }

  function consumeInput() {
    const payload = {
      mouse: inputState.mouse,
      mouseButtons: { ...inputState.mouseButtons },
      scroll: [...inputState.scroll],
      key: inputState.key,
      keys: [...inputState.keys],
    };

    inputState.scroll = [0, 0];
    return payload;
  }

  function isExpectedFrameStop(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return (
      !appState.running ||
      appState.runtimeTransitioning ||
      activeRunNonce !== appState.runNonce ||
      message === 'Runtime stopped.' ||
      message === 'q runtime is not running.' ||
      message.startsWith('q exited with code')
    );
  }

  async function renderFrame(now: number) {
    frameHandle = 0;
    if (!appState.running || appState.paused || inFlight || activeRunNonce !== appState.runNonce) return;

    inFlight = true;

    try {
      if (!startTime) {
        startTime = now;
        lastTime = now;
      }

      const size = surface.getSize();
      appState.setCanvasSize(size as [number, number]);

      const commands = await window.electronAPI.frameRuntime({
        frameInfo: {
          frameNum: frameNumber,
          time: now - startTime,
          dt: frameNumber === 0 ? 16 : now - lastTime,
        },
        input: consumeInput(),
        canvas: {
          size,
          pixelRatio: window.devicePixelRatio || 1,
        },
      });

      surface.draw(commands, {
        showFps: appState.showFps,
        fps: appState.fps,
      });

      appState.setFps(surface.updateFps(now));
      frameNumber += 1;
      lastTime = now;
    } catch (error) {
      if (!isExpectedFrameStop(error)) {
        appState.handleRuntimeError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      inFlight = false;
      if (appState.running && !appState.paused && activeRunNonce === appState.runNonce) {
        frameHandle = requestAnimationFrame(renderFrame);
      }
    }
  }

  function scheduleFrameLoop(reset: boolean) {
    cancelAnimationFrame(frameHandle);
    frameHandle = 0;

    if (!appState.running || appState.paused) return;

    if (reset) {
      frameNumber = 0;
      startTime = 0;
      lastTime = 0;
      activeRunNonce = appState.runNonce;
    }

    frameHandle = requestAnimationFrame(renderFrame);
  }

  onMount(() => {
    if (!canvasElement) return;

    surface.attach(canvasElement);
    const resize = () => {
      surface.resize();
      const size = surface.getSize();
      appState.setCanvasSize(size as [number, number]);
      if (!inputState.mouse) {
        setMouseToCanvasCenter();
      }
    };

    resize();
    window.addEventListener('resize', resize);

    appState.registerCanvasExports(
      () => surface.exportPng(`${appState.activeFileName.replace(/\.q$/, '') || 'sketch'}-frame.png`),
      (durationSeconds) => {
        appState.appendConsole('info', `GIF export is queued for ${durationSeconds}s, but the encoder pass is not wired yet.`);
      }
    );

    return () => {
      appState.registerCanvasExports(null, null);
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameHandle);
    };
  });

  $effect(() => {
    const nonce = appState.runNonce;
    if (nonce !== activeRunNonce && appState.running) {
      scheduleFrameLoop(true);
    }
  });

  $effect(() => {
    const running = appState.running;
    const paused = appState.paused;

    if (!running || paused) {
      cancelAnimationFrame(frameHandle);
      frameHandle = 0;
      return;
    }

    if (!frameHandle) {
      scheduleFrameLoop(false);
    }
  });
</script>

<section id="canvas-panel">
  <div class="canvas-toolbar">
    <span class="canvas-title">Canvas</span>
    <div class="canvas-size-label" id="canvas-size-label">{appState.currentCanvasSize[0]} × {appState.currentCanvasSize[1]}</div>
  </div>

  <div
    id="canvas-container"
    bind:this={containerElement}
  >
    <canvas
      bind:this={canvasElement}
      class="svelte-canvas"
      aria-label="Sketch canvas"
      tabindex="0"
      onpointermove={updateMouse}
      onpointerdown={(event) => {
        updateMouse(event);
        if (event.button === 0) inputState.mouseButtons.left = true;
        if (event.button === 1) inputState.mouseButtons.middle = true;
        if (event.button === 2) inputState.mouseButtons.right = true;
      }}
      onpointerup={(event) => {
        updateMouse(event);
        if (event.button === 0) inputState.mouseButtons.left = false;
        if (event.button === 1) inputState.mouseButtons.middle = false;
        if (event.button === 2) inputState.mouseButtons.right = false;
      }}
      onpointerleave={() => {
        inputState.mouseButtons = { left: false, middle: false, right: false };
      }}
      onwheel={(event) => {
        inputState.scroll = [event.deltaX, event.deltaY];
      }}
      onkeydown={(event) => {
        inputState.key = event.key;
        inputState.keys.add(event.key);
      }}
      onkeyup={(event) => {
        inputState.keys.delete(event.key);
        inputState.key = '';
      }}
    ></canvas>

    <div id="sketch-overlay" class="sketch-overlay" class:sketch-overlay--idle={appState.overlayMode === 'idle' || appState.overlayMode === 'runtime-missing'} class:sketch-overlay--running={appState.overlayMode === 'running'} class:sketch-overlay--stopped={appState.overlayMode === 'stopped'} class:sketch-overlay--error={appState.overlayMode === 'error'}>
      <div class="overlay-content">
        {#if appState.overlayMode === 'runtime-missing'}
          <svg class="overlay-icon" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="var(--red)" stroke-width="2"></circle>
            <path d="M24 14v12M24 32v2" stroke="var(--red)" stroke-width="2.5" stroke-linecap="round"></path>
          </svg>
          <p class="overlay-label">q runtime not configured</p>
          <div class="overlay-actions">
            <button class="btn-primary overlay-primary-action" type="button" onclick={() => (appState.activeModal = 'settings')}>Configure</button>
            <button class="overlay-link" type="button" onclick={() => (appState.activeModal = 'examples')}>Browse examples</button>
          </div>
        {:else if appState.overlayMode === 'error'}
          <svg class="overlay-icon" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="var(--red)" stroke-width="2"></circle>
            <path d="M24 14v12M24 32v2" stroke="var(--red)" stroke-width="2.5" stroke-linecap="round"></path>
          </svg>
          <p class="overlay-label">Sketch error</p>
          {#if appState.overlayMessage}
            <div class="overlay-error-msg">{appState.overlayMessage}</div>
          {/if}
        {:else if appState.overlayMode === 'stopped'}
          <svg class="overlay-icon" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="var(--text-secondary)" stroke-width="2"></circle>
            <rect x="16" y="16" width="16" height="16" rx="2" fill="var(--text-secondary)"></rect>
          </svg>
          <p class="overlay-label">Sketch stopped</p>
        {:else}
          <svg class="overlay-icon" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="var(--accent)" stroke-width="2"></circle>
            <polygon points="19,16 35,24 19,32" fill="var(--accent)"></polygon>
          </svg>
          <p class="overlay-label">Press <kbd>Run</kbd> to start</p>
          <div class="overlay-actions">
            <button class="overlay-link" type="button" onclick={() => (appState.activeModal = 'examples')}>or browse examples</button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</section>
