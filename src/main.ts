import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { appState } from '$lib/state/app-state.svelte';

appState.initialize();

mount(App, {
  target: document.getElementById('app')!,
});
