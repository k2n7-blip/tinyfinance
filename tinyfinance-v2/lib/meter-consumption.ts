export type Reading = {
  id: string;
  meter_id: string;
  read_on: string;
  reading: string | number;
};
export function meterConsumption(rows: Reading[]) {
  const sorted = [...rows].sort(
    (a, b) =>
      a.meter_id.localeCompare(b.meter_id) ||
      a.read_on.localeCompare(b.read_on),
  );
  return sorted.map((row, i) => {
    const previous =
      i > 0 && sorted[i - 1].meter_id === row.meter_id ? sorted[i - 1] : null;
    const difference = previous
      ? Math.round((Number(row.reading) - Number(previous.reading)) * 1000) /
        1000
      : null;
    return {
      ...row,
      previous_date: previous?.read_on ?? null,
      consumption:
        difference !== null && difference >= 0 && Number.isFinite(difference)
          ? difference
          : null,
      invalid:
        difference !== null && (difference < 0 || !Number.isFinite(difference)),
    };
  });
}
