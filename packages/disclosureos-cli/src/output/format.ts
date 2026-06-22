import pc from 'picocolors';

export const BRAND = pc.bold(pc.cyan('DisclosureOS'));

export function heading(text: string): string {
  return `\n${pc.bold(pc.white(text))}\n${'─'.repeat(text.length)}`;
}

export function success(text: string): string {
  return pc.green(`✓ ${text}`);
}

export function error(text: string): string {
  return pc.red(`✗ ${text}`);
}

export function warn(text: string): string {
  return pc.yellow(`⚠ ${text}`);
}

export function dim(text: string): string {
  return pc.dim(text);
}

export function label(key: string, value: string): string {
  return `  ${pc.bold(key)}: ${value}`;
}

export function bullet(text: string): string {
  return `  ${pc.dim('•')} ${text}`;
}

export function table(rows: [string, string][], gutter = 2): string {
  const maxKey = Math.max(...rows.map(([k]) => k.length));
  return rows
    .map(([k, v]) => `  ${pc.bold(k.padEnd(maxKey + gutter))}${v}`)
    .join('\n');
}

export function indent(text: string, spaces = 4): string {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map(line => pad + line).join('\n');
}
