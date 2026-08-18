"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaginationMeta } from "@/lib/pagination";

type PaginationControlsProps = {
  pagination: PaginationMeta;
  loading?: boolean;
  label?: string;
  onPageChange: (page: number) => void;
};

export function PaginationControls({ pagination, loading = false, label = "records", onPageChange }: PaginationControlsProps) {
  if (pagination.totalPages <= 1) return null;

  const first = (pagination.page - 1) * pagination.pageSize + 1;
  const last = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground">
      <span>
        Showing {first}–{last} of {pagination.total.toLocaleString()} {label}
      </span>
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
        <span aria-live="polite">Page {pagination.page} of {pagination.totalPages}</span>
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
