import { Link } from "react-router";
import { TableHead } from "~/components/ui/table";

interface SortableHeaderProps {
  columnId: string;
  label: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  searchParams: URLSearchParams;
  className?: string;
}

export function SortableHeader({
  columnId,
  label,
  sortBy,
  sortOrder,
  searchParams,
  className = "",
}: SortableHeaderProps) {
  const isActive = sortBy === columnId;
  const nextOrder = isActive && sortOrder === "asc" ? "desc" : "asc";
  const href = `?${new URLSearchParams({
    ...Object.fromEntries(searchParams),
    sortBy: columnId,
    sortOrder: nextOrder,
    page: "1",
  })}`;

  return (
    <TableHead className={className}>
      <Link
        to={href}
        className="flex items-center gap-1 hover:text-blue-700 select-none"
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        <span className={`text-xs ${isActive ? "text-blue-600" : "text-gray-400"}`}>
          {isActive ? (sortOrder === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </Link>
    </TableHead>
  );
}
