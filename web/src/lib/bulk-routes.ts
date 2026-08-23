// Bulk route paste parser. One route per line: origin,destination,zone[,core]
// '#' lines and blank lines are skipped. Pure so the client preview and the
// server action validate identically. IATA codes are shape-checked only —
// the engine validates against fli's Airport enum at scan time.

export interface ParsedRoute {
  origin: string;
  destination: string;
  zone: string;
  core: boolean;
  line: number;
}

export interface ParseIssue {
  line: number;
  raw: string;
  problem: string;
}

export interface BulkParseResult {
  routes: ParsedRoute[];
  issues: ParseIssue[];
}

const IATA = /^[A-Z]{3}$/;
const CORE_MARKERS = new Set(['core', '1', 'true', 'yes']);
const NON_CORE_MARKERS = new Set(['false', 'no', '0']);

export function parseBulkRoutes(text: string, validZones: string[]): BulkParseResult {
  const zones = new Set(validZones);
  const routes: ParsedRoute[] = [];
  const issues: ParseIssue[] = [];
  const seen = new Set<string>();

  text.split('\n').forEach((raw, idx) => {
    const line = idx + 1;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const fields = trimmed.split(',').map((f) => f.trim());
    if (fields.length < 3 || fields.length > 4) {
      issues.push({ line, raw, problem: `expected 3-4 comma-separated fields, got ${fields.length}` });
      return;
    }
    const origin = fields[0].toUpperCase();
    const destination = fields[1].toUpperCase();
    const zone = fields[2];
    if (!IATA.test(origin)) {
      issues.push({ line, raw, problem: `origin '${fields[0]}' is not a 3-letter IATA code` });
      return;
    }
    if (!IATA.test(destination)) {
      issues.push({ line, raw, problem: `destination '${fields[1]}' is not a 3-letter IATA code` });
      return;
    }
    if (!zones.has(zone)) {
      issues.push({ line, raw, problem: `unknown zone '${zone}'` });
      return;
    }

    let core = false;
    if (fields.length === 4) {
      const marker = fields[3].toLowerCase();
      if (CORE_MARKERS.has(marker)) {
        core = true;
      } else if (NON_CORE_MARKERS.has(marker)) {
        core = false;
      } else {
        issues.push({
          line,
          raw,
          problem: `unknown core marker '${fields[3]}' (use 'core' or leave blank)`,
        });
        return;
      }
    }

    const key = `${origin}-${destination}`;
    if (seen.has(key)) {
      issues.push({ line, raw, problem: `duplicate of ${key} earlier in the paste` });
      return;
    }
    seen.add(key);
    routes.push({ origin, destination, zone, core, line });
  });

  return { routes, issues };
}
