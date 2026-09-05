export type ArrangementKind = 'cloud' | 'grid' | 'stack';

export type AppState =
  | { kind: 'INTRO' }
  | { kind: 'FIELD'; arrangement: ArrangementKind; hoverId: string | null }
  | { kind: 'OPENING'; workId: string }
  | { kind: 'OPEN'; workId: string; mediaIndex: number }
  | { kind: 'CLOSING'; workId: string; toArrangement: ArrangementKind };

type Listener = (state: AppState, prev: AppState) => void;

/**
 * Explicit state machine. All transitions go through `set`; no module outside
 * this file is allowed to hold its own notion of which phase the app is in.
 */
class StateMachine {
  private state: AppState = { kind: 'INTRO' };
  private listeners = new Set<Listener>();

  get(): AppState {
    return this.state;
  }

  set(next: AppState): void {
    const prev = this.state;
    this.state = next;
    for (const listener of this.listeners) listener(next, prev);
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const appState = new StateMachine();

export function currentArrangement(): ArrangementKind {
  const s = appState.get();
  if (s.kind === 'FIELD') return s.arrangement;
  if (s.kind === 'CLOSING') return s.toArrangement;
  return 'cloud';
}
