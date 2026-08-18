import { Grid } from "./components/Grid.tsx";
import { Legend } from "./components/Legend.tsx";
import { Toolbar } from "./components/Toolbar.tsx";

export function App() {
  return (
    <main class="app">
      <header class="app-header">
        <h1>Binding of Isaac — Completion Marks</h1>
        <p>
          Every cell shows what that character unlocks for that boss <em>and</em> tracks whether
          you've done it. Progress is saved in this browser.
        </p>
      </header>
      <Toolbar />
      <Grid />
      <Legend />
    </main>
  );
}
