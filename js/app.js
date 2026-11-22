// 망상 일본행: 화면 그리기와 경비 계산
(function () {
  "use strict";

  const DATA = window.TRIP_DATA;
  const DESTS = DATA.destinations;
  const STORE_KEY = "mangsang-settings-v1";
  const MEMO_KEY = "mangsang-memos-v1";

  // ---------- 저장 (실패해도 화면은 정상 동작) ----------
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 저장 불가: 무시 */ }
  }

  // ---------- 날짜 ----------
  /** @param {Date} d */
  function ymd(d) {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }
  /** @param {string} s YYYY-MM-DD */
  function parseYmd(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  /** 날짜가 성수기 구간에 들어가는지 */
  function peakLabels(d) {
    const labels = [];
    const md = ymd(d).slice(5);
    const full = ymd(d);
    for (const w of DATA.peakWindows) {
      let hit;
      if (w.from.length === 10) {
        hit = full >= w.from && full <= w.to;
      } else if (w.from <= w.to) {
        hit = md >= w.from && md <= w.to;
      } else {
        hit = md >= w.from || md <= w.to; // 연말연시처럼 해를 넘기는 구간
      }
      if (hit) labels.push(w.label);
    }
    return labels;
  }

  /** 오늘부터 3주 뒤 이후, 성수기가 아닌 첫 화요일 */
  function defaultDate() {
    let d = addDays(new Date(), 21);
    for (let i = 0; i < 120; i++) {
      if (d.getDay() === 2 && peakLabels(d).length === 0) return ymd(d);
      d = addDays(d, 1);
    }
    return ymd(addDays(new Date(), 21));
  }

  // ---------- 상태 ----------
  const saved = load(STORE_KEY, {});
  const state = Object.assign({}, DATA.defaults, { date: defaultDate() }, saved);
  if (!state.date || parseYmd(state.date) < new Date(new Date().toDateString())) state.date = defaultDate();
  state.selected = DESTS.some((d) => d.id === location.hash.slice(1)) ? location.hash.slice(1) : (state.selected || DESTS[0].id);

  function persist() {
    const { date, nights, tier, food, shopYen, rate, target, max, selected } = state;
    save(STORE_KEY, { date, nights, tier, food, shopYen, rate, target, max, selected });
  }

  // ---------- 계산 ----------
  const won = (n) => Math.round(n).toLocaleString("ko-KR");
  const man = (n) => {
    const v = Math.round(n / 1000) / 10;
    return (Number.isInteger(v) ? v : v.toFixed(1)) + "만";
  };
  const yen = (n) => "¥" + Math.round(n).toLocaleString("ja-JP");

  function flightFactor() {
    const d = parseYmd(state.date);
    const labels = peakLabels(d).concat(peakLabels(addDays(d, Number(state.nights))));
    const uniq = [...new Set(labels)];
    let f = uniq.length ? DATA.peakMultiplier : 1;
    const dow = d.getDay();
    const weekend = dow === 5 || dow === 6;
    if (weekend) f *= DATA.weekendMultiplier;
    return { factor: f, peak: uniq, weekend };
  }

  /** @param {import('./data.js').Destination} dest */
  function estimate(dest) {
    const n = Number(state.nights);
    const rate = Number(state.rate) / 100; // 1엔당 원
    const ff = flightFactor();
    const plan = dest.plans[n];
    const flight = Math.round((dest.flight.typical * ff.factor) / 1000) * 1000;
    const lodgingYen = dest.lodging[state.tier] * n;
    const localYen = plan.reduce((s, day) => s + day.stops.reduce((a, st) => a + st.yen, 0), 0);
    const foodYen = dest.food[state.food] * (n + 1);
    const shopYen = Number(state.shopYen) || 0;
    const parts = {
      flight,
      lodging: lodgingYen * rate,
      local: localYen * rate,
      food: foodYen * rate,
      shop: shopYen * rate,
    };
    const total = parts.flight + parts.lodging + parts.local + parts.food + parts.shop;
    const status = total <= state.target ? "ok" : total <= state.max ? "tight" : "over";
    return { parts, total, status, plan, lodgingYen, localYen, foodYen, shopYen, ff };
  }

  const STATUS_TEXT = {
    ok: ["예산 안", "WITHIN"],
    tight: ["빠듯", "TIGHT"],
    over: ["초과", "OVER"],
  };

  // ---------- 링크 ----------
  function links(dest) {
    const out = parseYmd(state.date);
    const back = addDays(out, Number(state.nights));
    const s = (d) => ymd(d).slice(2).replace(/-/g, "");
    const c = (d) => ymd(d).replace(/-/g, "");
    const f = dest.flight;
    const o = DATA.origin.code;
    return {
      flights: [
        { label: "스카이스캐너", href: `https://www.skyscanner.co.kr/transport/flights/${o.toLowerCase()}/${f.skyscanner}/${s(out)}/${s(back)}/?adultsv2=1&cabinclass=economy&rtn=1&preferdirects=true` },
        { label: "네이버 항공권", href: `https://flight.naver.com/flights/international/${o}-${f.naver}-${c(out)}/${f.naver}-${o}-${c(back)}?adult=1&fareType=Y` },
        { label: "구글 항공편", href: `https://www.google.com/travel/flights?hl=ko&q=${encodeURIComponent(`Flights from ${o} to ${f.google} on ${ymd(out)} through ${ymd(back)}`)}` },
      ],
      hotels: [
        { label: "부킹닷컴 (싼 순)", href: `https://www.booking.com/searchresults.ko.html?ss=${encodeURIComponent(dest.lodging.query)}&checkin=${ymd(out)}&checkout=${ymd(back)}&group_adults=1&no_rooms=1&group_children=0&order=price` },
        { label: "구글 호텔", href: `https://www.google.com/travel/hotels?hl=ko&q=${encodeURIComponent(`${dest.lodging.query} ${state.tier === "hostel" ? "hostel" : "business hotel"}`)}` },
      ],
    };
  }

  // ---------- 그리기 ----------
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  function renderSeason() {
    const ff = flightFactor();
    const el = $("#season-note");
    const notes = [];
    if (ff.peak.length) notes.push(`${ff.peak.join(", ")} 기간이라 항공권이 비쌀 수 있어요`);
    if (ff.weekend) notes.push("금·토 출발은 조금 더 비싸요");
    if (!notes.length) notes.push("비수기 평일 출발, 좋은 날짜예요");
    el.textContent = notes.join(" · ");
    el.classList.toggle("peak", ff.peak.length > 0);
  }

  function renderTickets() {
    const ests = DESTS.map((d) => ({ d, e: estimate(d) }));
    const minTotal = Math.min(...ests.map((x) => x.e.total));
    const scale = Math.max(state.max * 1.25, ...ests.map((x) => x.e.total));
    const pct = (v) => Math.min(100, (v / scale) * 100).toFixed(1) + "%";
    const n = Number(state.nights);

    $("#tickets").innerHTML = ests.map(({ d, e }) => {
      const [stTxt, stEn] = STATUS_TEXT[e.status];
      const selected = d.id === state.selected;
      return `
      <article class="ticket${selected ? " is-selected" : ""}" data-id="${d.id}" data-status="${e.status}">
        <div class="t-band"><span>${n}박 ${n + 1}일 · 1인</span><span class="jp">${esc(d.kanji)}</span></div>
        <div class="t-head">
          <div class="route">${DATA.origin.code}<span class="arrow" aria-hidden="true">→</span>${d.code}</div>
          <p class="t-name">${esc(d.name)} · <span class="t-concept">${esc(d.concept)}</span></p>
          <p class="t-tag">${esc(d.tagline)}</p>
          <div class="stamp" role="img" aria-label="예산 판정: ${stTxt}">${stTxt}<small>${stEn}</small></div>
        </div>
        <ul class="chips">${d.keywords.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>
        <div class="t-body">
          <div class="perf" aria-hidden="true"></div>
          <div class="total">
            <span class="label">예상 총 경비 ${e.total === minTotal ? '<span class="cheapest">· 가장 저렴</span>' : ""}</span>
            <span class="num">${man(e.total)}<small>원</small></span>
          </div>
          <div>
            <div class="meter" role="img" aria-label="최대 예산 ${man(state.max)}원 대비 ${Math.round((e.total / state.max) * 100)}%">
              <div class="fill" style="width:${pct(e.total)}"></div>
              <div class="tick" style="left:${pct(state.target)}"></div>
              <div class="tick" style="left:${pct(state.max)}"></div>
            </div>
          </div>
          <div class="meter-legend"><span>목표 ${man(state.target)}</span><span>최대 ${man(state.max)}</span></div>
          <dl class="breakdown">
            <dt>항공권 왕복</dt><dd>${won(e.parts.flight)}원</dd>
            <dt>숙소 ${n}박</dt><dd>${won(e.parts.lodging)}원</dd>
            <dt>교통·입장료</dt><dd>${won(e.parts.local)}원</dd>
            <dt>식비 ${n + 1}일</dt><dd>${won(e.parts.food)}원</dd>
            <dt>쇼핑·굿즈</dt><dd>${won(e.parts.shop)}원</dd>
          </dl>
        </div>
        <div class="t-foot"><a class="btn" href="#${d.id}" data-pick="${d.id}">${selected ? "아래에서 일정 보는 중" : "이 여행 일정 보기"}</a></div>
      </article>`;
    }).join("");
  }

  function stopRow(st) {
    return `<li class="stop">
      <span class="when">${esc(st.time)}</span>
      <span class="what"><strong>${esc(st.place)}</strong><span>${esc(st.note)}</span></span>
      <span class="yen${st.yen ? "" : " free"}">${st.yen ? yen(st.yen) : "무료"}</span>
    </li>`;
  }

  function renderDetail() {
    const d = DESTS.find((x) => x.id === state.selected) || DESTS[0];
    const e = estimate(d);
    const L = links(d);
    const n = Number(state.nights);
    const out = parseYmd(state.date);
    const back = addDays(out, n);
    const fmt = (x) => `${x.getMonth() + 1}월 ${x.getDate()}일(${"일월화수목금토"[x.getDay()]})`;
    const lodgeLabel = state.tier === "hostel" ? "게스트하우스·캡슐" : "비즈니스호텔";

    const el = $("#detail");
    el.dataset.id = d.id;
    el.innerHTML = `
      <div class="detail-head">
        <span class="kicker">${DATA.origin.code} → ${d.code} · ${fmt(out)} ~ ${fmt(back)}</span>
        <h2>${esc(d.name)}, ${esc(d.concept)}</h2>
        <p>${esc(d.tagline)} 예상 총 경비는 <strong>${won(e.total)}원</strong>이에요.</p>
      </div>

      <div class="book">
        <div class="book-card">
          <h3>항공권 찾기</h3>
          <p class="meta">인천 → ${esc(d.flight.airport)} · 대표 저가항공: ${d.flight.airlines.map(esc).join(", ")} (시기마다 달라요)</p>
          <p class="price">평소 왕복 ${man(d.flight.low)} ~ ${man(d.flight.high)}원 · 계산에 쓴 값 ${man(e.parts.flight)}원</p>
          <div class="links">${L.flights.map((l) => `<a class="btn ghost" href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`).join("")}</div>
        </div>
        <div class="book-card">
          <h3>숙소 찾기 · ${esc(d.lodging.area)}</h3>
          <p class="meta">${esc(d.lodging.why)}</p>
          <p class="price">${lodgeLabel} 1박 약 ${yen(d.lodging[state.tier])} (${won(d.lodging[state.tier] * state.rate / 100)}원)</p>
          <div class="links">${L.hotels.map((l) => `<a class="btn ghost" href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`).join("")}</div>
        </div>
      </div>

      <div class="days">
        ${e.plan.map((day, i) => {
          const dayYen = day.stops.reduce((a, s) => a + s.yen, 0);
          return `<section class="day">
            <div class="day-head">
              <h3><span class="day-no">DAY ${i + 1}</span>${esc(day.title)}</h3>
              <span class="day-cost">교통·입장 ${yen(dayYen)} + 식비 ${yen(d.food[state.food])}</span>
            </div>
            <ol class="stops">${day.stops.map(stopRow).join("")}</ol>
          </section>`;
        }).join("")}
      </div>

      <div class="two-col">
        <div class="box">
          <h3>돈이 남으면 넣을 옵션</h3>
          <ul class="stops">${d.extras.map(stopRow).join("")}</ul>
        </div>
        <div class="box">
          <h3>돈 아끼는 팁</h3>
          <ul>${d.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        </div>
      </div>`;
  }

  // ---------- 메모 ----------
  let memos = load(MEMO_KEY, []);
  function renderMemos() {
    const list = $("#memo-list");
    if (!memos.length) {
      list.innerHTML = `<li class="memo-empty">아직 적어둔 망상이 없어요. 위 칸에 하나 적고 "적어두기"를 눌러보세요.</li>`;
      return;
    }
    list.innerHTML = memos.map((m, i) => {
      const d = DESTS.find((x) => x.id === m.dest);
      return `<li>
        <span class="tag" data-id="${esc(m.dest)}">${esc(d ? d.name : "어디든")}</span>
        <span class="txt">${esc(m.text)}</span>
        <button type="button" data-del="${i}" aria-label="이 메모 지우기">지우기</button>
      </li>`;
    }).join("");
  }

  // ---------- 폼 연결 ----------
  function syncForm() {
    $("#f-date").value = state.date;
    $("#f-date").min = ymd(new Date());
    document.querySelector(`input[name="nights"][value="${state.nights}"]`).checked = true;
    document.querySelector(`input[name="tier"][value="${state.tier}"]`).checked = true;
    document.querySelector(`input[name="food"][value="${state.food}"]`).checked = true;
    $("#f-shop").value = state.shopYen;
    $("#f-rate").value = state.rate;
    $("#f-target").value = state.target;
    $("#f-max").value = state.max;
    $("#m-dest").innerHTML = DESTS.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("") + `<option value="any">어디든</option>`;
  }

  function readForm() {
    const v = $("#f-date").value;
    if (v) state.date = v;
    state.nights = Number(document.querySelector('input[name="nights"]:checked').value);
    state.tier = document.querySelector('input[name="tier"]:checked').value;
    state.food = document.querySelector('input[name="food"]:checked').value;
    state.shopYen = Math.max(0, Number($("#f-shop").value) || 0);
    const r = Number($("#f-rate").value);
    if (r >= 500 && r <= 1500) state.rate = r;
    const t = Number($("#f-target").value);
    const m = Number($("#f-max").value);
    if (t > 0) state.target = t;
    if (m > 0) state.max = Math.max(m, state.target);
  }

  function renderAll() {
    renderSeason();
    renderTickets();
    renderDetail();
  }

  function select(id, scroll) {
    if (!DESTS.some((d) => d.id === id)) return;
    state.selected = id;
    persist();
    renderTickets();
    renderDetail();
    if (scroll) $("#detail").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  function init() {
    // 환율은 데이터에 "1엔당 원"(9.5)으로 들어있고, 화면에선 "100엔당 원"(950)으로 보여줌
    if (state.rate < 50) state.rate = Math.round(state.rate * 100);
    syncForm();
    renderAll();
    renderMemos();

    $("#conditions").addEventListener("input", () => { readForm(); persist(); renderAll(); });
    $("#conditions").addEventListener("submit", (ev) => ev.preventDefault());

    $("#tickets").addEventListener("click", (ev) => {
      const a = ev.target.closest("[data-pick]");
      if (!a) return;
      ev.preventDefault();
      if (location.hash !== "#" + a.dataset.pick) history.replaceState(null, "", "#" + a.dataset.pick);
      select(a.dataset.pick, true);
    });
    window.addEventListener("hashchange", () => select(location.hash.slice(1), true));

    $("#memo-form").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const text = $("#m-text").value.trim();
      if (!text) { $("#m-text").focus(); return; }
      memos.unshift({ dest: $("#m-dest").value, text, at: Date.now() });
      save(MEMO_KEY, memos);
      $("#m-text").value = "";
      renderMemos();
    });
    $("#memo-list").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-del]");
      if (!b) return;
      memos.splice(Number(b.dataset.del), 1);
      save(MEMO_KEY, memos);
      renderMemos();
    });
  }

  init();
})();
