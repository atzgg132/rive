"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaginationMeta } from "@/lib/pagination";

type PaginationControlsProps = {
  pagination: PaginationMeta;
  loading?: boolean;
  label?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export function PaginationControls({ pagination, loading = false, label = "records", onPageChange, onPageSizeChange }: PaginationControlsProps) {
  if (pagination.total <= 0) return null;

  const first = (pagination.page - 1) * pagination.pageSize + 1;
  const last = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span>
          Showing {first}–{last} of {pagination.total.toLocaleString()} {label}
        </span>
        {onPageSizeChange ? (
          <label className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              aria-label={`Rows per page for ${label}`}
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={loading}
              value={pagination.pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!pagination.hasPreviousPage || loading}
          onClick={() => onPageChange(pagination.page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span aria-live="polite" className="whitespace-nowrap">Page {pagination.page} of {pagination.totalPages}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!pagination.hasNextPage || loading}
          onClick={() => onPageChange(pagination.page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
