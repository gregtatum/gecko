# Resolving a Memory Leak Case Study

Leaking memory can be difficult to diagnose. This document is a tutorial on diagnosing a memory leak from a failing mochitest. The test in this case study was for a new feature that added the ability to recognize text in an image only on macOS. The feature was working, but after successfully writing a test for the feature, the test was still failing with a leakcheck failure:

```
INFO leakcheck | Processing leak log file /var/.../runtests_leaks.log
INFO
INFO == BloatView: ALL (cumulative) LEAK AND BLOAT STATISTICS, default process 64390
INFO
INFO      |<----------------Class--------------->|<-----Bytes------>|<----Objects---->|
INFO      |                                      | Per-Inst   Leaked|   Total      Rem|
INFO    0 |TOTAL                                 |       58      104|  877720        2|
INFO  246 |DataSourceSurfaceAlignedRawData       |       80       80|       1        1|
INFO 1065 |ThreadSafeWeakReference               |       24       24|     533        1|
INFO
INFO nsTraceRefcnt::DumpStatistics: 1891 entries
INFO leakcheck: default leaked 1 DataSourceSurfaceAlignedRawData
INFO leakcheck: default leaked 1 ThreadSafeWeakReference
UNEXPECTED-FAIL leakcheck: default 104 bytes leaked
```

This is reporting 104 bytes leaked, and two objects, the `DataSourceSurfaceAlignedRawData` and `ThreadSafeWeakReference`. There was only 1 object of each that leaked as can be seen from the `Rem` or "remaining" column.

The feature created an internal graphics surface which was then used as a macOS type `CGImage` or "Core Graphics Image". Unfortunately the code was extremely complicated in the control flow with off-thread work happening, and messages passing between content and parent process, and calling into macOS kernel APIs. Luckily the test only excercised the code in the parent process somewhat simplifying the process.
