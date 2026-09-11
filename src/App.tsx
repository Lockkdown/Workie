import { remainingMs } from "./domain/remainingTime";

const PLACEHOLDER_ENDS_AT = 2_000_000_000_000;

export function App() {
  const remaining = remainingMs(PLACEHOLDER_ENDS_AT, Date.now());

  return (
    <main>
      <h1 className="display">Workie</h1>
      <p className="body" data-testid="user-content">
        Việc cần làm
      </p>
      <button type="button">Continue</button>
      <output
        data-testid="remaining"
        data-ends-at={String(PLACEHOLDER_ENDS_AT)}
      >
        {remaining}
      </output>
    </main>
  );
}
