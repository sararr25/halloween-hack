import { cleanName, cleanOpenedAt, isToken, newToken, registry } from "@/lib/registry/db";
import { passedCase } from "@/lib/story/caseno";

// a chain longer than this is not followed further (and a broken one cannot loop)
const MAX_DEPTH = 1000;

// The case registry. POST at the name screen (S10) files the operator and returns the token
// for their "pass it on" link; GET ?invite=<token> tells a new player who passed it to them
// and which case is theirs now (lib/story/caseno.ts: each link down the chain is two cases on).

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "bad body" }, { status: 400 });
  const { name: rawName, openedAt: rawOpened, invite } = body as Record<string, unknown>;
  const name = cleanName(rawName);
  const openedAt = cleanOpenedAt(rawOpened);
  if (!name) return Response.json({ error: "bad name" }, { status: 400 });
  if (openedAt === null) return Response.json({ error: "bad openedAt" }, { status: 400 });

  const sql = registry();
  // the privacy page promises 12 months: anything older goes before anything new comes in
  await sql`DELETE FROM operators WHERE closed_at < now() - interval '12 months'`;
  const token = newToken();
  const by = isToken(invite) ? invite : null;
  await sql`
    INSERT INTO operators (name, opened_at, token, invited_by)
    VALUES (${name}, ${new Date(openedAt).toISOString()}, ${token},
            (SELECT id FROM operators WHERE token = ${by}))`;
  return Response.json({ token });
}

export async function GET(request: Request) {
  const invite = new URL(request.url).searchParams.get("invite");
  if (!isToken(invite)) return Response.json({ error: "bad invite" }, { status: 400 });
  // the inviter, then whoever invited them, and so on up: the inviter's place in the chain
  const rows = await registry()`
    WITH RECURSIVE chain AS (
      SELECT id, invited_by, name, 0 AS depth FROM operators WHERE token = ${invite}
      UNION ALL
      SELECT o.id, o.invited_by, o.name, c.depth + 1 FROM operators o JOIN chain c ON o.id = c.invited_by
      WHERE c.depth < ${MAX_DEPTH}
    )
    SELECT (SELECT name FROM chain WHERE depth = 0) AS name, max(depth) AS depth FROM chain`;
  if (!rows.length || rows[0].name === null) return Response.json({ error: "unknown invite" }, { status: 404 });
  return Response.json({ name: rows[0].name as string, caseNo: passedCase(Number(rows[0].depth)) });
}
