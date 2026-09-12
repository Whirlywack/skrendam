# Runbook — move yip.lt DNS hosting off iv.lt (keep the domain registered there)

> **Status 2026-09-12 13:50 — DONE.** Zone imported at Cloudflare (`greg`/`sarah.ns.cloudflare.com`, Vercel
> records DNS-only), DNSSEC switched off at iv.lt 12:01, nameservers changed 12:13; the .lt registry published
> both at 13:49 and yip.lt resolved everywhere within a minute. In practice the NS change was submitted before
> the DS was withdrawn — harmless because the domain was already SERVFAIL, and the registry applied both
> in one publication. **Open:** enable DNSSEC at Cloudflare and get the DS added by iv.lt ticket (§ step 5).

Written 2026-09-12 from live checks and current provider docs (facts + sources in
`.superpowers/sdd/2026-09-12-dns-migration-research.md`, exact records in
`.superpowers/sdd/2026-09-12-yip-lt-zone-records.txt`). Founder does the clicks; Claude verifies each
step with `dig` before the next one.

## Why
iv.lt's zone editor and their DNSSEC signer overwrite each other (2026-08-28, 09-10, 09-12 incidents):
enabling DNSSEC republishes a stale signed snapshot; saving the zone publishes an unsigned one. With a DS
at the .lt registry, validating resolvers (Google, Quad9, most ISPs) then answer SERVFAIL. Their
secondaries ns3/ns4 also lag the primaries by days. Verified constraints:
- iv.lt's own help says DNSSEC must be **disabled before** a nameserver change.
- iv.lt's panel can only toggle *their* signing; a third-party DS is added/removed by **support ticket**
  (klientams.iv.lt/support.php). The .lt registry accepts algorithm-13 DS records (other .lt domains carry them).
- DS and NS records at the .lt zone have a **7200 s TTL**. Cross-provider key sharing is impossible, so the
  move goes through an "insecure" window (RFC 6781 §4.3.5.2).
- Vercel's nameservers have **no DNSSEC** → Vercel DNS is out. Vercel officially discourages Cloudflare
  proxying (orange cloud) in front of Vercel; DNS-only records are fine.

## Where to host
**Cloudflare Free** (recommended: one-click DNSSEC with a DS to hand to iv.lt, instant propagation, familiar
UI; the one trap is the proxy toggle — every Vercel record must be **DNS only / grey cloud**). Equally valid:
**deSEC** (free, EU, always-signed, no proxy foot-gun, minimal UI). Not Hetzner DNS (cannot sign), not Vercel DNS.

## Records to create in the new zone (verbatim from the current servers + Vercel's domain card)
| Name | Type | Value | Note |
|---|---|---|---|
| `@` | A | `76.76.21.21` | Vercel apex; confirm on the Vercel domain card — newer projects may show a different IP |
| `www` | CNAME | the per-project value on the Vercel domain card (`<hash>.vercel-dns-017.com`); `cname.vercel-dns.com` still works | today's servers wrongly say `yip.lt.` — fix here |
| `@` | MX | `10 yip.lt.` | as today (no real mailbox; keep) |
| `send` | MX | `10 feedback-smtp.eu-west-1.amazonses.com.` | Resend |
| `@` | TXT | `v=spf1 a mx include:spf.serveriai.lt` | keep for now (drop `include:spf.serveriai.lt` later if nothing sends via iv.lt) |
| `_dmarc` | TXT | `v=DMARC1; p=none;` | tighten to `p=quarantine` after the first sends look clean |
| `resend._domainkey` | TXT | the full 1024-bit key in the records file (single string, copy exactly) | Resend DKIM |
| `send` | TXT | `v=spf1 include:amazonses.com ~all` | Resend |
Both Vercel records: **DNS only** (grey cloud) at Cloudflare. TTL auto/300.

## Sequence (each step verified before the next)
0. **Now, regardless of the move:** iv.lt → DNSSEC apsauga → Valdyti → **Išjungti**. Verify: `dig DS yip.lt @a.tld.lt`
   returns nothing (15–30 min). Resolvers recover within ≤ 2 h (DS TTL) as the unsigned zone on ns1/ns2 is
   accepted. If the toggle republishes a stale zone, re-save the zone once more (unsigned is fine now).
1. **Create the zone at the new host** (Cloudflare: Add site → Free → it scans; delete anything it invents, add
   the eight records above, set the two Vercel ones to DNS only). Do **not** enable DNSSEC there yet. Note the
   two nameserver names it assigns.
2. **Wait ≥ 2 h after the DS disappeared from `a.tld.lt`** (3 h is safer) so no validator still holds the old DS.
3. **Change nameservers at iv.lt** („Inicijuoti vardų serverių keitimą" → the two new names). Verify at the
   registry: `dig NS yip.lt @a.tld.lt` shows the new pair; then `dig A yip.lt @<new-ns>` and `@1.1.1.1` return
   `76.76.21.21`; `https://yip.lt` 200. Old NS TTL is 7200 s — full propagation ≤ 2 h. Cloudflare flips the zone
   from "pending" to "active" on its own once it sees the NS change.
4. **Resend:** Domains → yip.lt → Verify (it re-checks; a gap of up to 72 h is tolerated). **Vercel:** the domain
   card should show valid configuration for `yip.lt` and `www.yip.lt`.
5. **Enable DNSSEC at the new host** (Cloudflare: DNS → Settings → DNSSEC → Enable; it shows a DS record,
   algorithm 13). **Send the DS to iv.lt support** (panel cannot add it) — message below. Verify after they
   add it: `dig DS yip.lt @a.tld.lt` shows the new key tag and `dig +dnssec A yip.lt @1.1.1.1` has the `ad` flag.
6. Leave the old zone at iv.lt untouched (it persists) — that is the rollback: switch nameservers back with the
   same panel button; DNSSEC stays off there.

Total elapsed: ~30 min of clicks + 2–4 h of waiting, plus iv.lt's ticket time for step 5.

## Ticket text for step 5 (LT)
```
Sveiki, domenui yip.lt vardų serveriai perkelti į <ns1>, <ns2>. Prašau į .lt registrą įrašyti šį DS įrašą
(DNSSEC pasirašymas vyksta naujame DNS tiekėje):
Key tag: <tag>  Algorithm: 13  Digest type: 2  Digest: <digest>
Senas DS (key tag 8972) turi būti pašalintas (jau išjungiau DNSSEC panelėje).
```

## What can go wrong
- Changing NS while the old DS is still cached → SERVFAIL for up to 2 h. Hence step 2.
- Orange cloud on a Vercel record → Vercel TLS/redirect trouble. Grey cloud only.
- DKIM TXT pasted with line breaks or split quotes → Resend verification fails. Paste the single string.
- Typo in a nameserver name at iv.lt → the registry may reject or the domain goes dark; copy-paste from the host.
