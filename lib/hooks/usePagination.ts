'use client'

import { useEffect, useMemo, useState } from 'react'

// Client-side pagination over an already-fetched array. Every list in this
// app fetches its full result set in one request (small-school scale), so
// pagination here is a rendering slice, not a server round-trip -- keeps
// every table/list component simple while still capping DOM size and
// giving users a real page-by-page control instead of one long scroll.
export function usePagination<T>(items: T[], initialPageSize = 10) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))

  // Reset to page 1 whenever the underlying result set changes (new
  // search/filter), and clamp if the current page no longer exists.
  useEffect(() => {
    setPage(1)
  }, [items.length])

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  function changePageSize(next: number) {
    setPageSize(next)
    setPage(1)
  }

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  return { page, setPage, pageCount, pageItems, total: items.length, pageSize, setPageSize: changePageSize }
}
