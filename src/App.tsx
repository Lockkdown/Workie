import { remainingMs } from "./domain/remainingTime";
import { PrimitivesHarness } from "./harness/PrimitivesHarness";
import { Button } from "./ui/Button";

const PLACEHOLDER_ENDS_AT = 2_000_000_000_000;

export function App() {
  const remaining = remainingMs(PLACEHOLDER_ENDS_AT, Date.now());

  return (
    <>
      <main>
        <h1 className="type-display-xl display">Workie</h1>
        <p className="type-body-l body" data-testid="user-content">
          Việc cần làm
        </p>
        <Button type="button" variant="primary" ornament="dense">
          Continue
        </Button>
        <output
          className="type-numeric"
          data-testid="remaining"
          data-ends-at={String(PLACEHOLDER_ENDS_AT)}
        >
          {remaining}
        </output>
      </main>
      <PrimitivesHarness />
    </>
  );
}
