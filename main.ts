// Driver for the csv-reader-speed-01 entry: read every case, answer each
// one alone with run() from solve.js, and write the answers in order.
//
// The harness runs `node /bot/main.ts` (Node 22) with /input/cases.json
// mounted read-only and /output writable; outside a container the
// MAKEFUN_INPUT_DIR / MAKEFUN_OUTPUT_DIR variables stand in for them.
// V8's incremental marking is switched off before solve.js loads, the way
// the house baseline runs: the answers are long chains of joined strings,
// and marking them a step at a time costs wall time without changing a byte.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

setFlagsFromString('--no-incremental-marking');

const { run } = (await import(new URL('./solve.js', import.meta.url).href)) as {
  run: (input: unknown) => unknown;
};

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const cases = JSON.parse(readFileSync(join(inputDir, 'cases.json'), 'utf8')) as {
  id: string;
  input: unknown;
}[];

const answers = cases.map((c) => run(c.input));

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'answers.json'), JSON.stringify(answers));
