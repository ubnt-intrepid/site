import Link from "next/link";
import React from "react";
import { NavigateBefore, NavigateNext } from "@/components/MaterialIcon";
import { getPageHref } from "@/lib/pagination";

export type Props = {
  currentPage: number;
  totalPages: number;
};

const Pagination: React.FC<Props> = ({ currentPage, totalPages }) => {
  if (totalPages <= 1) return null;

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav className="flex justify-between items-center mt-10 text-sm">
      {hasPrev ? (
        <Link
          href={getPageHref(currentPage - 1)}
          className="px-3 py-2 rounded text-accent hover:bg-accent-light"
        >
          <NavigateBefore /> Prev
        </Link>
      ) : (
        <span />
      )}

      {hasNext ? (
        <Link
          href={getPageHref(currentPage + 1)}
          className="px-3 py-2 rounded text-accent hover:bg-accent-light"
        >
          Next <NavigateNext />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
};

export default Pagination;
