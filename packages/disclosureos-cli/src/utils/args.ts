/**
 * Minimal argument parser with short and long flag support.
 */
export interface ParsedArgs {
  command: string;
  subcommand: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

const SHORT_FLAG_MAP: Record<string, string> = {
  o: 'out',
  h: 'help',
  v: 'version',
  r: 'recursive',
  s: 'strict',
  j: 'json',
};

/**
 * Flags that take a value (e.g. `--out file.json`). Every other flag is boolean
 * and must NOT consume the following token — otherwise a boolean flag placed
 * before a path (`validate --recursive ./dir`) would silently swallow the path.
 */
const VALUE_FLAGS = new Set<string>(['out', 'category', 'id']);

function assignFlag(
  key: string,
  args: string[],
  index: number,
  flags: Record<string, string | boolean>,
): number {
  if (VALUE_FLAGS.has(key)) {
    const next = args[index + 1];
    if (next !== undefined && !next.startsWith('-')) {
      flags[key] = next;
      return index + 1;
    }
  }
  flags[key] = true;
  return index;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let command = 'help';
  let subcommand = '';
  let positionsFilled = 0;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg.startsWith('--')) {
      i = assignFlag(arg.slice(2), args, i, flags);
    } else if (arg.startsWith('-') && arg.length === 2) {
      const longKey = SHORT_FLAG_MAP[arg[1]!] ?? arg[1]!;
      i = assignFlag(longKey, args, i, flags);
    } else if (positionsFilled === 0) {
      command = arg;
      positionsFilled++;
    } else if (positionsFilled === 1) {
      subcommand = arg;
      positionsFilled++;
    } else {
      positional.push(arg);
    }
  }

  return { command, subcommand, positional, flags };
}
