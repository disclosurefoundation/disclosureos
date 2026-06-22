import type { ParsedArgs } from '../utils/args';
import { heading, label, bullet, dim, table, BRAND } from '../output/format';
import { deriveFieldPaths } from '@disclosureos/scoring';
import {
  ALL_OBSERVABLES,
  ALL_OBSERVABLE_IDS,
  ASSESSMENT_LEVELS,
} from '@disclosureos/observables';
import {
  OCS_TAXONOMY,
  getNode,
  getChildren,
  getAncestors,
  ORIGIN_DOMAINS,
} from '@disclosureos/origins';

const FIELD_PATH_COUNT = deriveFieldPaths().length;

export function info(args: ParsedArgs): void {
  if (args.flags['help']) {
    printUsage();
    return;
  }

  const sub = args.subcommand;

  switch (sub) {
    case '':
    case undefined:
      infoOverview();
      break;
    case 'observation':
      infoObservation();
      break;
    case 'observable':
      infoObservable(args.positional[0]);
      break;
    case 'origin':
      infoOrigin(args.positional[0]);
      break;
    default:
      infoOverview();
  }
}

function infoOverview(): void {
  console.log(heading(`${BRAND} Ecosystem`));
  console.log(`\n  A structured data framework for UAP research.\n`);
  console.log(table([
    ['@disclosureos/records', `Data dictionary — ${FIELD_PATH_COUNT} schema fields, Observation type`],
    ['@disclosureos/observables', `Detection criteria — ${ALL_OBSERVABLE_IDS.length} observables`],
    ['@disclosureos/origins', `Classification taxonomy — ${OCS_TAXONOMY.length} OCS nodes`],
    ['@disclosureos/scoring', 'Reference completeness + compellingness scoring'],
    ['@disclosureos/cli', 'Developer tooling (this package)'],
  ]));
  console.log(`\n${dim('  Commands: scaffold, validate, registry, info')}\n`);
}

function infoObservation(): void {
  console.log(heading('Observation Type'));
  console.log(`\n  The core record type for UAP/UAI research data.\n`);
  console.log(`  ${dim('Required Fields:')}`);
  console.log(bullet('id — Unique identifier'));
  console.log(bullet('temporal — Date, time, duration'));
  console.log(bullet('location — Coordinates, site type'));
  console.log(bullet('status — Publication status (draft/review/published/archived/retracted)'));
  console.log(bullet('createdAt — ISO timestamp'));
  console.log(bullet('updatedAt — ISO timestamp'));
  console.log(`\n  ${dim('Extension Slots:')}`);
  console.log(bullet('observableAssessments — Technology + Biologics assessment levels'));
  console.log(bullet('origin — OCS hypothesis assignment'));
  console.log(`\n  ${dim('Records-owned slots: provenance, identifiers, testimony, physicalEvidence, documents')}`);
  console.log(`  ${dim(`Total schema-derived field paths: ${FIELD_PATH_COUNT}`)}\n`);
}

function infoObservable(id: string | undefined): void {
  if (!id) {
    console.log(heading('Observables'));
    console.log(`\n  Use: disclosureos info observable <code>\n`);
    console.log(`  ${dim('Available codes:')}`);
    for (const obs of ALL_OBSERVABLES) {
      console.log(bullet(`${obs.code} — ${obs.label}`));
    }
    console.log('');
    return;
  }

  const obs = ALL_OBSERVABLES.find(o => o.code === id || o.id === id);
  if (!obs) {
    console.log(`\n  Unknown observable: "${id}"`);
    console.log(`  ${dim(`Available: ${ALL_OBSERVABLES.map(o => o.code).join(', ')}`)}\n`);
    return;
  }

  console.log(heading(`Observable: ${obs.label}`));
  console.log(`\n${label('Code', obs.code)}`);
  console.log(label('ID', obs.id));
  console.log(label('Category', obs.category));
  if (obs.description) {
    console.log(label('Description', obs.description));
  }
  console.log(`\n  ${dim('Assessment Levels:')}`);
  for (const level of ASSESSMENT_LEVELS) {
    console.log(bullet(level));
  }
  console.log('');
}

function infoOrigin(id: string | undefined): void {
  if (!id) {
    console.log(heading('Origin Classification System'));
    console.log(`\n  Use: disclosureos info origin <nodeId>\n`);
    console.log(`  ${dim('Domains:')}`);
    for (const domain of ORIGIN_DOMAINS) {
      const domainNode = OCS_TAXONOMY.find(n => n.depth === 0 && n.domain === domain);
      if (domainNode) {
        console.log(bullet(`[${domainNode.id}] — ${domainNode.label}`));
      }
    }
    console.log('');
    return;
  }

  const node = getNode(id);
  if (!node) {
    console.log(`\n  Unknown OCS node: "${id}"\n`);
    return;
  }

  console.log(heading(`Origin: ${node.label}`));
  console.log(`\n${label('ID', node.id)}`);
  console.log(label('Label', node.label));
  console.log(label('Domain', node.domain));
  console.log(label('Depth', String(node.depth)));
  console.log(label('Testable', node.scientificallyTestable ? 'Yes' : 'No'));
  if (node.description) {
    console.log(label('Description', node.description));
  }
  if (node.aliases && node.aliases.length > 0) {
    console.log(label('Aliases', node.aliases.join(', ')));
  }

  const ancestors = getAncestors(id);
  if (ancestors.length > 0) {
    console.log(`\n  ${dim('Path:')}`);
    console.log(`  ${ancestors.map(a => a.label).join(' → ')} → ${node.label}`);
  }

  const children = getChildren(id);
  if (children.length > 0) {
    console.log(`\n  ${dim(`Children (${children.length}):`)}`);
    for (const child of children) {
      console.log(bullet(`[${child.id}] ${child.label}`));
    }
  }
  console.log('');
}

function printUsage(): void {
  console.log(heading(`${BRAND} info`));
  console.log(`\nQuick reference for DisclosureOS types and definitions.\n`);
  console.log(`${dim('Usage:')}`);
  console.log(`  disclosureos info [topic] [id]\n`);
  console.log(`${dim('Topics:')}`);
  console.log(`  (none)               Ecosystem overview`);
  console.log(`  observation          Observation type summary`);
  console.log(`  observable <code>    Observable detail (e.g. TO-3, BO-1)`);
  console.log(`  origin <nodeId>      OCS node detail (e.g. 1.1.3)\n`);
  console.log(`${dim('Options:')}`);
  console.log(`  --help, -h           Show this help message\n`);
}
