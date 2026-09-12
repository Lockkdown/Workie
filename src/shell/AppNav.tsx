import { DESTINATIONS, type Destination } from "./destinations";

type AppNavProps = {
  destination: Destination;
  onDestination: (destination: Destination) => void;
};

export function AppNav({ destination, onDestination }: AppNavProps) {
  return (
    <nav className="app-nav" aria-label="App">
      {DESTINATIONS.map((name) => {
        const current = name === destination;
        return (
          <button
            key={name}
            type="button"
            className="app-nav-item type-display-m"
            data-variant="quiet"
            aria-current={current ? "page" : undefined}
            onClick={() => onDestination(name)}
          >
            {name}
          </button>
        );
      })}
    </nav>
  );
}
