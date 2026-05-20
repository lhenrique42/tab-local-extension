import { useTheme } from '../../composables/useTheme';

export default function App() {
  useTheme();
  return (
    <div>
      <h1>TabLocal — Workspace</h1>
      <p>New Tab entrypoint (stub — implemented in TASK-005)</p>
    </div>
  );
}
