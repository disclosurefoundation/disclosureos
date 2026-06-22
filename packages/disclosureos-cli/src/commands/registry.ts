import type { ParsedArgs } from '../utils/args';
import { heading, table, bullet, dim, label, BRAND } from '../output/format';
import { deriveFieldPaths, type FieldPath } from '@disclosureos/scoring';
import {
  ALL_OBSERVABLES,
  TECHNOLOGY_OBSERVABLES,
  BIOLOGICS_OBSERVABLES,
  ASSESSMENT_LEVELS,
} from '@disclosureos/observables';
import {
  OCS_TAXONOMY,
  getNode,
  getChildren,
  getTestableNodes,
  ORIGIN_DOMAINS,
  ORIGIN_DOMAIN_LABELS,
} from '@disclosureos/origins';

export function registry(args: ParsedArgs): void {
  if (args.flags['help']) {
    printUsage();
    return;
  }

  const sub = args.subcommand;

  switch (sub) {
    case 'fields':
      registryFields(args);
      break;
    case 'observables':
      registryObservables(args);
      break;
    case 'origins':
      registryOrigins(args);
      break;
    default:
      printUsage();
  }
}

function registryFields(args: ParsedArgs): void {
  const group = args.flags['category'] as string | undefined;

  // Field paths are derived from the records JSON Schema (via @disclosureos/scoring),
  // grouped by their top-level domain (the first path segment).
  const paths = deriveFieldPaths();
  const groups = new Map<string, FieldPath[]>();
  for (const field of paths) {
    const top = field.path.split('.')[0] ?? field.path;
    const list = groups.get(top) ?? [];
    list.push(field);
    groups.set(top, list);
  }

  console.log(heading('Observation Field Registry (schema-derived)'));

  if (group) {
    const fields = groups.get(group);
    if (!fields || fields.length === 0) {
      console.log(`\n  No fields found for group "${group}"`);
      return;
    }
    console.log(`\n  Group: ${group}\n`);
    const rows = fields.map((f): [string, string] => [f.path, f.required ? 'required' : 'optional']);
    console.log(table(rows));
  } else {
    for (const groupName of [...groups.keys()].sort()) {
      const fields = groups.get(groupName)!;
      console.log(`\n  ${groupName} (${fields.length} fields)`);
      for (const f of fields) {
        console.log(bullet(`${f.path}${f.required ? ' [required]' : ''}`));
      }
    }
  }

  console.log(`\n  ${dim(`Total: ${paths.length} schema-derived field paths`)}\n`);
}

function registryObservables(args: ParsedArgs): void {
  const biologicsOnly = !!args.flags['biologics'];
  const techOnly = !!args.flags['technology'];

  console.log(heading('Observable Registry'));

  if (!biologicsOnly) {
    console.log(`\n  Technology Observables (AATIP-derived)\n`);
    const techObs = Object.values(TECHNOLOGY_OBSERVABLES);
    for (const obs of techObs) {
      console.log(`  ${obs.code}  ${obs.label}`);
      if (obs.description) {
        console.log(`       ${dim(obs.description)}`);
      }
    }
  }

  if (!techOnly) {
    console.log(`\n  Biologics Observables (NHI Detection)\n`);
    const bioObs = Object.values(BIOLOGICS_OBSERVABLES);
    for (const obs of bioObs) {
      console.log(`  ${obs.code}  ${obs.label}`);
      if (obs.description) {
        console.log(`       ${dim(obs.description)}`);
      }
    }
  }

  console.log(`\n  ${dim(`Assessment Levels: ${ASSESSMENT_LEVELS.join(' → ')}`)}`);
  console.log(`  ${dim(`Total: ${ALL_OBSERVABLES.length} observables`)}\n`);
}

function registryOrigins(args: ParsedArgs): void {
  const targetId = args.flags['id'] as string | undefined;
  const testableOnly = !!args.flags['testable'];

  console.log(heading('Origin Classification System (OCS)'));

  if (testableOnly) {
    const testable = getTestableNodes();
    console.log(`\n  Scientifically Testable Hypotheses (${testable.length}):\n`);
    for (const node of testable) {
      console.log(`  [${node.id}]  ${node.label}`);
    }
    console.log('');
    return;
  }

  if (targetId) {
    const node = getNode(targetId);
    if (!node) {
      console.log(`\n  Unknown OCS node: "${targetId}"\n`);
      return;
    }

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

    const children = getChildren(targetId);
    if (children.length > 0) {
      console.log(`\n  Children (${children.length}):`);
      for (const child of children) {
        console.log(bullet(`[${child.id}] ${child.label}`));
      }
    }
    console.log('');
    return;
  }

  console.log(`\n  3 Domains, ${OCS_TAXONOMY.length} total nodes\n`);
  for (const domain of ORIGIN_DOMAINS) {
    const domainLabel = ORIGIN_DOMAIN_LABELS[domain];
    const domainNode = OCS_TAXONOMY.find(n => n.depth === 0 && n.domain === domain);
    if (domainNode) {
      console.log(`  [${domainNode.id}] ${domainLabel}`);
      const subdomains = getChildren(domainNode.id);
      for (const sub of subdomains) {
        console.log(`    [${sub.id}] ${sub.label}`);
        const leaves = getChildren(sub.id);
        for (const leaf of leaves) {
          console.log(`      ${dim(`[${leaf.id}] ${leaf.label}`)}`);
        }
      }
    }
  }
  console.log('');
}

function printUsage(): void {
  console.log(heading(`${BRAND} registry`));
  console.log(`\nIntrospect DisclosureOS field, observable, and origin registries.\n`);
  console.log(`${dim('Usage:')}`);
  console.log(`  disclosureos registry <subcommand> [options]\n`);
  console.log(`${dim('Subcommands:')}`);
  console.log(`  fields                     List observation field definitions`);
  console.log(`  fields --category <cat>    Filter by category`);
  console.log(`  observables                List all 12 observables`);
  console.log(`  observables --biologics    Biologics only`);
  console.log(`  observables --technology   Technology only`);
  console.log(`  origins                    Show OCS taxonomy overview`);
  console.log(`  origins --id <nodeId>      Show subtree for specific node`);
  console.log(`  origins --testable         Only scientifically testable nodes\n`);
  console.log(`${dim('Options:')}`);
  console.log(`  --help, -h                 Show this help message\n`);
}
