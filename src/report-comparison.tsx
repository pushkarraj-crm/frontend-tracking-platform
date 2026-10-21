import { previousPeriod, comparisonRows, change } from "./report-utils";
import { type Row } from "./api";
import { useData } from "./hooks";
import { ErrorBox, Loading, Panel, Table } from "./ui";

export function ReportComparison({
  params,
  current,
  version,
}: {
  params: string;
  current: Row[];
  version: number;
}) {
  const previous = previousPeriod(params);
  const shift =
    previous && ["day", "hour"].includes(previous.get("group_by") || "")
      ? new Date(previous.get("end")!).getTime() -
        new Date(previous.get("start")!).getTime()
      : 0;
  const result = useData<Row[]>(
    previous ? `/reports/grouped?${previous}` : null,
    version,
  );
  return (
    <Panel
      title="Previous period comparison"
      subtitle={
        previous
          ? `${previous.get("start")?.slice(0, 10)} to ${previous.get("end")?.slice(0, 10)} UTC (end exclusive). Same filters and duration as the current period. Each period is limited to 1,000 groups.`
          : "Choose a valid date range to compare periods."
      }
    >
      {result.error ? (
        <ErrorBox error={result.error} />
      ) : result.loading ? (
        <Loading />
      ) : (
        previous && (
          <Table
            rows={comparisonRows(current, result.data || [], shift)}
            columns={[
              { key: "group", title: "Group" },
              { key: "currency", title: "Currency" },
              { key: "clicks", title: "Current clicks" },
              { key: "previous_clicks", title: "Previous clicks" },
              {
                key: "click_change",
                title: "Click change",
                render: (row) => change(row.clicks, row.previous_clicks),
              },
              { key: "conversions", title: "Current conversions" },
              { key: "previous_conversions", title: "Previous conversions" },
              {
                key: "conversion_change",
                title: "Conversion change",
                render: (row) =>
                  change(row.conversions, row.previous_conversions),
              },
            ]}
          />
        )
      )}
    </Panel>
  );
}
