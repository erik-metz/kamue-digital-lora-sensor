export async function GET(request: Request, context: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z, x, y } = await context.params;
  if (!/^[0-8]$/.test(z) || !/^\d{1,3}$/.test(x) || !/^\d{1,3}\.png$/.test(y)
    || Number(x) >= 2 ** Number(z) || Number(y.slice(0, -4)) >= 2 ** Number(z)) return new Response(null, { status: 404 });
  try {
    const upstream = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}`, {
      headers: { "User-Agent": "OpenRiedSens/1.0 (+https://github.com/erik-metz/kamue-digital-lora-sensor)",
        "Referer": new URL("/satellites", request.url).href },
      next: { revalidate: 604800 }, signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) return new Response(null, { status: 502 });
    return new Response(await upstream.arrayBuffer(), { headers: { "Content-Type": "image/png",
      "Cache-Control": "public, max-age=604800, s-maxage=604800" } });
  } catch { return new Response(null, { status: 502 }); }
}
