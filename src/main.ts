import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { look } from './ui/theme.svelte'
import './ui/format.svelte'

// Stamp the saved look before first paint so there's no flash of the defaults.
look.apply()

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
