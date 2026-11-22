// 망상 일본행: 실제 항공권 가격 가져오기
//
// GitHub Actions가 매일 한 번 실행해서 data/prices.json 을 갱신합니다.
// 사이트는 그 파일을 읽어서 "추정 가격" 대신 실제 최근 최저가를 보여줍니다.
//
// 가격 출처 (둘 다 없어도 동작하고, 있는 것만 씁니다)
//   TRAVELPAYOUTS_TOKEN  Aviasales(Travelpayouts) 데이터 API. 무료.
//                        최근 2~7일 동안 사람들이 검색한 가격 중 최저가를 날짜별로 줍니다.
//                        → 앞으로 4달 동안 2박·3박 일정의 날짜별 최저가 달력
//   SERPAPI_KEY          SerpApi의 구글 항공편 검색. 무료 250회/월.
//                        → 여행지마다 가장 싼 날짜 하나를 구글 항공편으로 다시 확인하고,
//                          구글이 판단한 "지금 가격이 싼지 비싼지"를 가져옵니다. (하루 3회)
//   GOOGLE_ALERTS_URL    구글 항공권 가격 추적 알림 메일을 모아둔 구글 시트의 웹 앱 주소.
//                        google-apps-script/Code.gs 를 설치하면 생겨요. API 키가 아니라
//                        구글이 내 지메일로 보내준 가격을 그대로 씁니다.
//
// 실행: node scripts/fetch-prices.mjs
// 키는 절대 코드나 저장소에 넣지 말고 GitHub 저장소의 Secrets에만 넣으세요.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import vm from "node:vm";

const ROOT = new URL("..", import.meta.url);
const OUT = new URL("data/prices.json", ROOT);
const MONTHS_AHEAD = 4;
const KEEP_PER_NIGHTS = 60; // 여행지·박수별로 저장할 날짜 수

const TP_TOKEN = process.env.TRAVELPAYOUTS_TOKEN || "";
const SERP_KEY = process.env.SERPAPI_KEY || "";
const ALERTS_URL = process.env.GOOGLE_ALERTS_URL || "";

async function loadTripData() {
  const src = await readFile(new URL("js/data.js", ROOT), "utf8");
  const ctx = { window: {} };
  vm.runInNewContext(src, ctx);
  return ctx.window.TRIP_DATA;
}

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

function nextMonths(n) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { Accept: "application/json", ...headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

// ---------- Travelpayouts (Aviasales) ----------
async function travelpayouts(origin, dest) {
  const today = ymd(new Date());
  /** @type {Record<string, any>} key = "출발일|박수" */
  const best = {};
  for (const month of nextMonths(MONTHS_AHEAD)) {
    const q = new URLSearchParams({
      origin,
      destination: dest,
      departure_at: month,
      one_way: "false",
      unique: "false",
      sorting: "price",
      direct: "false",
      currency: "krw",
      limit: "1000",
      page: "1",
    });
    const json = await getJson(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${q}`, {
      "X-Access-Token": TP_TOKEN,
    });
    for (const o of json.data || []) {
      if (!o.departure_at || !o.return_at) continue;
      const depart = o.departure_at.slice(0, 10);
      const ret = o.return_at.slice(0, 10);
      const nights = daysBetween(depart, ret);
      if (nights < 2 || nights > 3 || depart < today) continue;
      const key = `${depart}|${nights}`;
      if (!best[key] || o.price < best[key].price) {
        best[key] = {
          depart,
          return: ret,
          nights,
          price: Math.round(o.price),
          airline: o.airline || "",
          transfers: (o.transfers || 0) + (o.return_transfers || 0),
          link: o.link ? `https://www.aviasales.com${o.link}` : "",
        };
      }
    }
  }
  const all = Object.values(best);
  const offers = [];
  for (const n of [2, 3]) {
    offers.push(
      ...all
        .filter((o) => o.nights === n)
        .sort((a, b) => a.price - b.price)
        .slice(0, KEEP_PER_NIGHTS)
    );
  }
  return offers.sort((a, b) => (a.depart < b.depart ? -1 : a.depart > b.depart ? 1 : a.nights - b.nights));
}

// ---------- SerpApi: 구글 항공편 ----------
async function googleFlights(origin, airports, outbound, inbound) {
  const q = new URLSearchParams({
    engine: "google_flights",
    departure_id: origin,
    arrival_id: airports,
    outbound_date: outbound,
    return_date: inbound,
    type: "1",
    currency: "KRW",
    hl: "ko",
    gl: "kr",
    adults: "1",
    api_key: SERP_KEY,
  });
  const json = await getJson(`https://serpapi.com/search.json?${q}`);
  const flights = [...(json.best_flights || []), ...(json.other_flights || [])].filter((f) => f.price);
  flights.sort((a, b) => a.price - b.price);
  const top = flights[0];
  const pi = json.price_insights || {};
  return {
    depart: outbound,
    return: inbound,
    nights: daysBetween(outbound, inbound),
    price: top ? top.price : pi.lowest_price ?? null,
    airline: top?.flights?.[0]?.airline || "",
    level: pi.price_level || "", // "low" | "typical" | "high"
    typicalRange: pi.typical_price_range || null, // [낮은 값, 높은 값]
    link: json.search_metadata?.google_flights_url || "",
  };
}

// ---------- 구글 항공권 가격 알림 (지메일 → 구글 시트 웹 앱) ----------
async function googleAlerts() {
  const json = await getJson(ALERTS_URL);
  const today = ymd(new Date());
  return (json.alerts || [])
    .filter((a) => a.dest && a.price > 0)
    .map((a) => ({
      dest: String(a.dest),
      price: Math.round(Number(a.price)),
      depart: a.depart || "",
      return: a.return || "",
      nights: a.depart && a.return ? daysBetween(a.depart, a.return) : null,
      receivedAt: a.receivedAt || "",
    }))
    .filter((a) => !a.depart || a.depart >= today);
}

function fallbackDate() {
  // 3주 뒤 이후 첫 화요일 (사이트 기본값과 같은 규칙, 성수기 판정은 생략)
  const d = new Date();
  d.setDate(d.getDate() + 21);
  while (d.getDay() !== 2) d.setDate(d.getDate() + 1);
  return ymd(d);
}

async function main() {
  const trip = await loadTripData();
  const origin = trip.origin.code;
  let prev = {};
  try {
    prev = JSON.parse(await readFile(OUT, "utf8"));
  } catch {}

  const result = {
    updatedAt: new Date().toISOString(),
    currency: "KRW",
    sources: { travelpayouts: Boolean(TP_TOKEN), google: Boolean(SERP_KEY), alerts: Boolean(ALERTS_URL) },
    destinations: {},
    errors: [],
  };

  let alerts = null;
  if (ALERTS_URL) {
    try {
      alerts = await googleAlerts();
      console.log(`[alerts] ${alerts.length}개 알림`);
    } catch (e) {
      result.errors.push(`alerts: ${e.message}`);
    }
  }

  for (const dest of trip.destinations) {
    const entry = { offers: [], google: null, alerts: [] };
    const old = prev.destinations?.[dest.id] || {};

    if (TP_TOKEN) {
      try {
        entry.offers = await travelpayouts(origin, dest.flight.google);
        console.log(`[travelpayouts] ${dest.id}: ${entry.offers.length}개 날짜`);
      } catch (e) {
        result.errors.push(`travelpayouts ${dest.id}: ${e.message}`);
        entry.offers = old.offers || [];
      }
    }

    if (SERP_KEY) {
      try {
        const cheapest3 = entry.offers.filter((o) => o.nights === 3).sort((a, b) => a.price - b.price)[0];
        const out = cheapest3 ? cheapest3.depart : fallbackDate();
        const back = cheapest3 ? cheapest3.return : ymd(new Date(Date.parse(out) + 3 * 86400000));
        entry.google = await googleFlights(origin, dest.flight.airports, out, back);
        console.log(`[google] ${dest.id}: ${entry.google.price}원 (${entry.google.level})`);
      } catch (e) {
        result.errors.push(`google ${dest.id}: ${e.message}`);
        entry.google = old.google || null;
      }
    }

    entry.alerts = alerts
      ? alerts.filter((a) => a.dest === dest.id).slice(0, 10)
      : old.alerts || [];

    result.destinations[dest.id] = entry;
  }

  if (!TP_TOKEN && !SERP_KEY && !ALERTS_URL) {
    console.log("TRAVELPAYOUTS_TOKEN, SERPAPI_KEY, GOOGLE_ALERTS_URL 이 모두 없어서 가격을 가져오지 않았어요.");
    result.updatedAt = null;
  }

  await mkdir(new URL("data/", ROOT), { recursive: true });
  await writeFile(OUT, JSON.stringify(result, null, 2) + "\n");
  if (result.errors.length) console.warn("일부 실패:\n" + result.errors.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
