import type { BlockSignal } from "../domain/cardSignals";
import type { ScaffoldRecord } from "../db/schema";

type LooseBlock = ScaffoldRecord & {
  startMs?: unknown;
  startsAt?: unknown;
  derivedStartMs?: unknown;
};

export function blockSignalFromRecord(record: ScaffoldRecord): BlockSignal {
  const loose = record as LooseBlock;
  const startsAt =
    typeof loose.startMs === "number"
      ? loose.startMs
      : typeof loose.startsAt === "number"
        ? loose.startsAt
        : typeof loose.derivedStartMs === "number"
          ? loose.derivedStartMs
          : record.createdAt;
  return { id: record.id, startsAt };
}

export function blockSignalsFromRecords(
  records: readonly ScaffoldRecord[],
): BlockSignal[] {
  return records.map(blockSignalFromRecord);
}
