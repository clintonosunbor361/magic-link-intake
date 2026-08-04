# Use optimistic concurrency with live freshness

Phase 1 combines live or polled list freshness with version-checked writes. A stale edit is rejected while preserving submitted input for reload and reapplication, avoiding silent last-write-wins data loss without introducing offline editing.
