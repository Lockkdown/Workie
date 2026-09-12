import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type JSX,
} from "react";
import type { Task } from "../domain/types";
import { newId } from "../id";
import { appDb } from "../shell/appDb";
import { COPY } from "./copy";
import {
  commitErrorMessage,
  commitImportBatch,
  prepareImportBatch,
} from "./commit";
import {
  deleteReviewDraft,
  restoreReviewDraft,
  saveReviewDraft,
} from "./draft";
import { FileControl } from "../ui/FileControl";
import { ingestBatchFile } from "./ingest";
import { ImportReviewView } from "./ImportReview";
import {
  addAnyway,
  addSubtaskRow,
  editItemContent,
  editSubtaskRow,
  moveItem,
  removeSubtaskRow,
  setItemSelected,
  toggleCompare,
  validateSelected,
} from "./reviewState";
import type { ReviewSession } from "./types";
import "./import.css";

type Phase = "idle" | "loading" | "error" | "review";

function subscribeOnline(onStoreChange: () => void): () => void {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

export function ImportBoundary(): JSX.Element {
  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<ReviewSession | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [discardConfirming, setDiscardConfirming] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [locals, setLocals] = useState<Task[]>([]);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const saveLock = useRef(Promise.resolve());
  const savingEnabled = useRef(true);
  const bootGeneration = useRef(0);
  const [draftSavedAt, setDraftSavedAt] = useState(0);

  useEffect(() => {
    return subscribeOnline(() => {
      setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const generation = bootGeneration.current;
    setPhase("loading");
    void (async () => {
      const restored = await restoreReviewDraft(appDb);
      if (cancelled || bootGeneration.current !== generation) {
        return;
      }
      const current = await appDb.tasks.toArray();
      if (cancelled || bootGeneration.current !== generation) {
        return;
      }
      setLocals(current);
      if (!restored.ok) {
        setError(restored.error);
        setPhase("error");
        return;
      }
      if (restored.session) {
        setSession(restored.session);
        setDraftSavedAt((saved) => saved + 1);
        setPhase("review");
        return;
      }
      setPhase("idle");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistSession = useCallback((next: ReviewSession) => {
    if (!savingEnabled.current) {
      return;
    }
    saveLock.current = saveLock.current.then(async () => {
      await saveReviewDraft(appDb, next, Date.now());
      setDraftSavedAt((current) => current + 1);
    });
  }, []);

  const apply = useCallback(
    (mutator: (current: ReviewSession) => ReviewSession) => {
      setSession((current) => {
        if (!current) {
          return current;
        }
        const next = mutator(current);
        persistSession(next);
        return next;
      });
    },
    [persistSession],
  );

  async function handleFile(file: File): Promise<void> {
    bootGeneration.current += 1;
    const keepReview = session !== undefined;
    setPhase("loading");
    setError(undefined);
    setDiscardConfirming(false);
    try {
      const result = await ingestBatchFile(appDb, file, Date.now());
      const current = await appDb.tasks.toArray();
      setLocals(current);
      if (!result.ok) {
        setError(result.error);
        setPhase(keepReview ? "review" : "error");
        return;
      }
      savingEnabled.current = true;
      setSession(result.session);
      setDraftSavedAt((current) => current + 1);
      setPhase("review");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPhase(keepReview ? "review" : "error");
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      void handleFile(file);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      void handleFile(file);
    }
  }

  async function handleConfirm(): Promise<void> {
    if (!session) {
      return;
    }
    const valid = validateSelected(session);
    if (!valid.ok) {
      setError(valid.error);
      return;
    }
    await saveLock.current;
    savingEnabled.current = false;
    setCommitting(true);
    const prepared = prepareImportBatch(session, {
      now: Date.now(),
      newId,
    });
    if (!prepared.ok) {
      savingEnabled.current = true;
      setCommitting(false);
      setError(prepared.error);
      return;
    }
    try {
      await commitImportBatch(appDb, prepared.prepared);
      setSession(undefined);
      setError(undefined);
      setDiscardConfirming(false);
      setPhase("idle");
      setLocals(await appDb.tasks.toArray());
    } catch (cause) {
      savingEnabled.current = true;
      const named = commitErrorMessage(cause);
      setError(`${named} ${COPY.commitRecovery}`);
    } finally {
      setCommitting(false);
    }
  }

  async function handleConfirmDiscard(): Promise<void> {
    await saveLock.current;
    savingEnabled.current = false;
    await deleteReviewDraft(appDb);
    setSession(undefined);
    setDiscardConfirming(false);
    setError(undefined);
    setPhase("idle");
    savingEnabled.current = true;
  }

  return (
    <>
      <div className="import-entry">
        <FileControl
          id="import-batch-file"
          label={COPY.importBatch}
          accept=".json"
          onChange={onFileChange}
        />
        <div
          className="import-drop type-body-s"
          data-drop="true"
          data-state={phase === "idle" ? "empty" : phase}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
        >
          {phase === "loading" ? COPY.loading : COPY.dropHint}
        </div>
        {phase === "error" && error ? (
          <p className="import-error type-body-s" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      {phase === "review" && session ? (
        <ImportReviewView
          session={session}
          online={online}
          loading={committing}
          error={error}
          discardConfirming={discardConfirming}
          committing={committing}
          draftSavedAt={draftSavedAt}
          onTitle={(itemKey, title) =>
            apply((current) =>
              editItemContent(current, itemKey, { title }, locals),
            )
          }
          onDescription={(itemKey, description) =>
            apply((current) =>
              editItemContent(current, itemKey, { description }, locals),
            )
          }
          onSelect={(itemKey, selected) =>
            apply((current) => setItemSelected(current, itemKey, selected))
          }
          onAddAnyway={(itemKey) =>
            apply((current) => addAnyway(current, itemKey))
          }
          onCompare={(itemKey) =>
            apply((current) => toggleCompare(current, itemKey))
          }
          onMove={(itemKey, direction) =>
            apply((current) => moveItem(current, itemKey, direction))
          }
          onAddSubtask={(itemKey) =>
            apply((current) => addSubtaskRow(current, itemKey, locals))
          }
          onEditSubtask={(itemKey, index, title) =>
            apply((current) =>
              editSubtaskRow(current, itemKey, index, title, locals),
            )
          }
          onRemoveSubtask={(itemKey, index) =>
            apply((current) =>
              removeSubtaskRow(current, itemKey, index, locals),
            )
          }
          onConfirm={() => void handleConfirm()}
          onDiscard={() => setDiscardConfirming(true)}
          onKeepReview={() => setDiscardConfirming(false)}
          onConfirmDiscard={() => void handleConfirmDiscard()}
        />
      ) : null}
    </>
  );
}
