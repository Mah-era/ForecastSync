"use client";

import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

export function DataTable({ rows }: { rows: object[] }) {
  const data = rows.slice(0, 12).map((row) => row as Record<string, unknown>);
  const columns = Object.keys(data[0] ?? {}).slice(0, 6).map((key) => ({
    accessorKey: key,
    header: key
  }));
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  if (!data.length) return <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No table rows available.</div>;

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-muted-foreground">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id} className="px-3 py-2">{flexRender(header.column.columnDef.header, header.getContext())}</th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2">{String(cell.getValue() ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
