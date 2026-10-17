// Clima real para a janela do quarto, pela localização aproximada do IP (request.cf),
// sem pedir GPS ao usuário. Fonte: Open-Meteo (gratuita, sem chave). Cache por região.

export type Condition = "clear" | "cloudy" | "fog" | "rain" | "storm" | "snow" | "unknown";

/** Códigos WMO usados pelo Open-Meteo → condição visual do quarto. */
export function conditionFromWmo(code: number): Condition {
  if (!Number.isInteger(code) || code < 0) return "unknown";
  if (code <= 1) return "clear";
  if (code <= 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "unknown";
}

const CACHE_SECONDS = 30 * 60;

export async function weatherFor(req: Request, exec: ExecutionContext): Promise<Response> {
  const cf = (req as Request & { cf?: IncomingRequestCfProperties }).cf;
  const lat = Number(cf?.latitude);
  const lon = Number(cf?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ condition: "unknown", is_day: null });
  }
  // ~11 km de precisão: suficiente para clima e protege a privacidade.
  const rlat = lat.toFixed(1);
  const rlon = lon.toFixed(1);
  const cacheKey = new Request(`https://cache.myloom/weather/${rlat}/${rlon}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const upstream = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${rlat}&longitude=${rlon}&current=weather_code,is_day`,
  );
  if (!upstream.ok) return Response.json({ condition: "unknown", is_day: null });
  const data = (await upstream.json()) as { current?: { weather_code?: number; is_day?: number } };
  const body = {
    condition: conditionFromWmo(Number(data.current?.weather_code ?? -1)),
    is_day: data.current?.is_day === undefined ? null : data.current.is_day === 1,
  };
  const res = Response.json(body, { headers: { "cache-control": `public, max-age=${CACHE_SECONDS}` } });
  exec.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
