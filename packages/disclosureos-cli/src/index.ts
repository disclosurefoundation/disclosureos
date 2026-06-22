import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './utils/args';
import { scaffold } from './commands/scaffold';
import { validate } from './commands/validate';
import { completeness } from './commands/completeness';
import { registry } from './commands/registry';
import { info } from './commands/info';
import { heading, dim, BRAND } from './output/format';

const CLI_VERSION = readCliVersion();
const args = parseArgs(process.argv);

if (args.flags['version']) {
  printVersion();
} else if (args.flags['help'] && !args.command) {
  printHelp();
} else {
  switch (args.command) {
    case 'scaffold':
      scaffold(args);
      break;
    case 'validate':
      validate(args);
      break;
    case 'completeness':
      completeness(args);
      break;
    case 'registry':
      registry(args);
      break;
    case 'info':
      info(args);
      break;
    case 'help':
    case '':
      printHelp();
      break;
    case 'version':
      printVersion();
      break;
    default:
      console.log(`Unknown command: "${args.command}"\n`);
      printHelp();
      process.exit(1);
  }
}

function printHelp(): void {
  console.log(heading(`${BRAND} CLI v${CLI_VERSION}`));
  console.log(`\n  Developer tools for the DisclosureOS ecosystem.\n`);
  console.log(`${dim('Commands:')}`);
  console.log(`  scaffold       Generate typed data structure templates`);
  console.log(`  validate       Validate observation JSON files`);
  console.log(`  completeness   Measure how fully observations populate the schema`);
  console.log(`  registry       Introspect field, observable, and origin registries`);
  console.log(`  info           Quick reference for types and definitions`);
  console.log(`  help           Show this help message`);
  console.log(`  version        Print version\n`);
  console.log(`${dim('Global Options:')}`);
  console.log(`  --help, -h     Show help (for any command)`);
  console.log(`  --version, -v  Print version\n`);
  console.log(`${dim('Examples:')}`);
  console.log(`  disclosureos scaffold observation --full`);
  console.log(`  disclosureos validate ./data/ --recursive`);
  console.log(`  disclosureos completeness ./out/ --recursive`);
  console.log(`  disclosureos registry origins --id 1.1.3`);
  console.log(`  disclosureos info observable TO-3\n`);
}

function printVersion(): void {
  console.log(CLI_VERSION);
}

function readCliVersion(): string {
  try {
    const packagePath = join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'package.json',
    );
    const parsed = JSON.parse(readFileSync(packagePath, 'utf8')) as {
      version?: unknown;
    };
    return typeof parsed.version === 'string' ? parsed.version : '1.0.0';
  } catch {
    return '1.0.0';
  }
}
