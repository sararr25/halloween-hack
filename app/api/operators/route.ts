import { cleanName, cleanOpenedAt, isToken, newToken, registry } from "@/lib/registry/db";

// The case registry. POST at the name screen (S10) files the operator and returns the token
// for their "pass it on" link; GET ?invite=<token> tells a new player who passed it to them.

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "bad body" }, { status: 400 });
  const { name: rawName, openedAt: rawOpened, invite } = body as Record<string, unknown>;
  const name = cleanName(rawName);
  const openedAt = cleanOpenedAt(rawOpened);
  if (!name) return Response.json({ error: "bad name" }, { status: 400 });
  if (openedAt === null) return Response.json({ error: "bad openedAt" }, { status: 400 });

  const sql = registry();
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
  const rows = await registry()`SELECT name FROM operators WHERE token = ${invite}`;
  if (!rows.length) return Response.json({ error: "unknown invite" }, { status: 404 });
  return Response.json({ name: rows[0].name as string });
}
