# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/arianda17/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/arianda17/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0 that answers exactly as
it does on every case. The reference walks the text one character at a time,
building each field with string appends; this reader jumps between field
boundaries with `indexOf` and cuts fields out with `slice`, so the common
case (a plain field, a quoted field with no line breaks inside) costs a few
native scans instead of a JavaScript loop per character. A record whose line
holds no quote at all is split in one native step. Nothing is cached between
cases: each `run(input)` reads its own text from scratch.

Verified against csv-reader 1.0.0 on the kit's whole practice set (6 cases,
6/6 identical), a 97-case battery of broken-CSV edges, and 9,000 random
differential fuzz cases. On the practice set it runs about 4.7x faster than
the reference on CPU time (median of paired runs: ~162 ms vs ~758 ms).

## Run it

```sh
node main.ts
```

`main.ts` reads every case from `/input/cases.json` (or `MAKEFUN_INPUT_DIR`),
answers each one alone with `run()` from `solve.js`, and writes the answers
in order to `/output/answers.json` (or `MAKEFUN_OUTPUT_DIR`). Node 22.
No dependencies, no network, no WebAssembly.

---

<sub>Entered on [make.fun](https://make.fun/?ref=4hnkatg5&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
