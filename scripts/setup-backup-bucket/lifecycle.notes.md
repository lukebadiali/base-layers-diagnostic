# GCS lifecycle.json — dwell-time semantics

GCS lifecycle: Standard at upload → Nearline at day 30 from creation → Archive at day 365 from creation (335-day Nearline dwell, exceeds BACKUP-02 90d Nearline minimum).

Note: `age` values in lifecycle.json are **days-from-object-creation**, NOT days-from-prior-class-transition. Objects spend ~335 days in Nearline (day 30 to day 365), satisfying BACKUP-02's 90d Nearline minimum.

Citations: BACKUP-02; 08-RESEARCH.md §Pattern 2; GCS lifecycle docs (https://docs.cloud.google.com/storage/docs/lifecycle-configurations).
