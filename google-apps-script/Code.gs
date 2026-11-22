/**
 * 망상 일본행: 구글 항공권 가격 알림 메일 → 구글 시트 → 사이트
 *
 * 하는 일
 *   1. 지메일에서 구글 항공권 가격 추적 알림 메일을 찾아요.
 *   2. 메일에서 도착 도시, 가격, 여행 날짜를 뽑아 이 시트의 "알림" 탭에 한 줄씩 적어요.
 *   3. 웹 앱으로 배포하면, 그 주소가 시트 내용을 JSON으로 돌려줘요.
 *      GitHub Actions가 매일 그 주소를 읽어서 사이트의 data/prices.json 에 합쳐요.
 *
 * 설치 (README의 "구글 항공권 가격 알림 연결하기" 참고)
 *   - 구글 시트를 하나 만들고 → 확장 프로그램 → Apps Script → 이 파일 내용을 붙여넣기
 *   - 위쪽 함수 목록에서 setup 을 골라 실행 → 권한 허용 (내 지메일 읽기, 이 시트 쓰기)
 *   - 배포 → 새 배포 → 웹 앱, 실행 사용자 "나", 액세스 권한 "모든 사용자" → 웹 앱 URL 복사
 *
 * 개인정보: 웹 앱은 도시 코드, 가격, 여행 날짜, 메일 받은 시각만 내보내요.
 *          메일 본문, 제목, 링크, 이메일 주소는 내보내지 않아요.
 */

// 구글 항공권 알림 메일을 찾는 지메일 검색어. 메일이 안 잡히면 여기를 고치세요.
var GMAIL_QUERY = 'from:(noreply-travel@google.com) newer_than:60d';
var SHEET_NAME = '알림';
var MAX_THREADS = 50;

// 메일 속 도시·공항 이름 → 사이트의 여행지 id
var DEST_PATTERNS = [
  { id: 'tokyo',   code: 'TYO', words: ['NRT', 'HND', 'TYO', '도쿄', '나리타', '하네다', 'Tokyo', 'Narita', 'Haneda', '東京'] },
  { id: 'fukuoka', code: 'FUK', words: ['FUK', '후쿠오카', 'Fukuoka', '福岡'] },
  { id: 'kansai',  code: 'OSA', words: ['KIX', 'ITM', 'OSA', '오사카', '간사이', 'Osaka', 'Kansai', '大阪', '関西'] },
];

var HEADER = ['메일ID', '받은시각', '여행지', '최저가(원)', '출발일', '귀국일', '제목'];

/** 처음 한 번만 실행: 시트 준비 + 1시간마다 자동 실행 예약 + 바로 한 번 수집 */
function setup() {
  var sheet = getSheet_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'collectFlightAlerts') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('collectFlightAlerts').timeBased().everyHours(1).create();
  collectFlightAlerts();
  Logger.log('준비 완료. 지금까지 ' + (sheet.getLastRow() - 1) + '줄 기록됨');
}

/** 새 알림 메일을 읽어 시트에 추가 (이미 기록한 메일은 건너뜀) */
function collectFlightAlerts() {
  var sheet = getSheet_();
  var seen = {};
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().forEach(function (r) { seen[r[0]] = true; });
  }

  var rows = [];
  GmailApp.search(GMAIL_QUERY, 0, MAX_THREADS).forEach(function (thread) {
    thread.getMessages().forEach(function (msg) {
      var id = msg.getId();
      if (seen[id]) return;
      var parsed = parseAlert_(msg.getSubject(), msg.getPlainBody());
      parsed.forEach(function (p) {
        rows.push([id, msg.getDate(), p.dest, p.price, p.depart || '', p.ret || '', msg.getSubject().slice(0, 120)]);
      });
      if (!parsed.length) {
        rows.push([id, msg.getDate(), '', '', '', '', msg.getSubject().slice(0, 120)]); // 못 읽은 메일도 기록 (다시 안 읽게)
      }
    });
  });

  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADER.length).setValues(rows);
  Logger.log('새로 기록: ' + rows.length + '줄');
}

/**
 * 메일 한 통에서 여행지별 최저가 뽑기.
 * 구글 메일 형식이 바뀔 수 있어서, 특정 문장 대신 "도시 이름 근처의 원화 가격"을 찾는 느슨한 방식이에요.
 */
function parseAlert_(subject, body) {
  var text = (subject + '\n' + body).replace(/ /g, ' ');
  var lines = text.split(/\n+/);
  var results = {};

  lines.forEach(function (line, i) {
    var dest = findDest_(line);
    if (!dest) return;
    // 같은 줄부터 아래 4줄까지, 다른 여행지 이름이 나오기 전까지만 보고 가격 찾기
    var chunk = [line];
    for (var k = i + 1; k < Math.min(lines.length, i + 5); k++) {
      var other = findDest_(lines[k]);
      if (other && other.id !== dest.id) break;
      chunk.push(lines[k]);
    }
    var windowText = chunk.join(' ');
    var prices = findPrices_(windowText);
    if (!prices.length) return;
    var price = Math.min.apply(null, prices);
    var dates = findDates_(windowText);
    if (!results[dest.id] || price < results[dest.id].price) {
      results[dest.id] = { dest: dest.id, price: price, depart: dates[0] || '', ret: dates[1] || '' };
    }
  });

  return Object.keys(results).map(function (k) { return results[k]; });
}

function findDest_(line) {
  for (var i = 0; i < DEST_PATTERNS.length; i++) {
    var d = DEST_PATTERNS[i];
    for (var j = 0; j < d.words.length; j++) {
      var w = d.words[j];
      var re = /^[A-Z]{3}$/.test(w) ? new RegExp('\\b' + w + '\\b') : new RegExp(w, 'i');
      if (re.test(line)) return d;
    }
  }
  return null;
}

/** ₩123,456 / 123,456원 / KRW 123,456 형태의 금액. 항공권으로 보기 어려운 값(3만 원 미만, 300만 원 초과)은 버림 */
function findPrices_(s) {
  var out = [];
  var re = /(?:₩|KRW\s?)\s?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,7})|([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,7})\s?원/g;
  var m;
  while ((m = re.exec(s))) {
    var n = Number((m[1] || m[2]).replace(/,/g, ''));
    if (n >= 30000 && n <= 3000000) out.push(n);
  }
  return out;
}

/** "1월 19일", "2027. 1. 19.", "Jan 19", "2027-01-19" 형태의 날짜 → YYYY-MM-DD */
function findDates_(s) {
  var out = [];
  var now = new Date();
  var months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  var re = /(\d{4})[.\-\/]\s?(\d{1,2})[.\-\/]\s?(\d{1,2})|(\d{1,2})월\s?(\d{1,2})일|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/gi;
  var m;
  while ((m = re.exec(s)) && out.length < 2) {
    var y, mo, d;
    if (m[1]) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if (m[4]) { mo = +m[4]; d = +m[5]; }
    else { mo = months[m[6].slice(0, 3).toLowerCase()]; d = +m[7]; }
    if (!y) {
      y = now.getFullYear();
      if (mo < now.getMonth() + 1 - 1) y += 1; // 지난 달보다 이전이면 내년
    }
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      out.push(y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2));
    }
  }
  return out;
}

/** 웹 앱 주소로 들어오면 최근 기록을 JSON으로 돌려줌 */
function doGet() {
  var sheet = getSheet_();
  var values = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADER.length).getValues() : [];
  var alerts = values
    .filter(function (r) { return r[2] && r[3]; })
    .map(function (r) {
      return {
        dest: r[2],
        price: Number(r[3]),
        depart: fmtDate_(r[4]),
        return: fmtDate_(r[5]),
        receivedAt: new Date(r[1]).toISOString(),
      };
    })
    .sort(function (a, b) { return a.receivedAt < b.receivedAt ? 1 : -1; })
    .slice(0, 100);
  return ContentService
    .createTextOutput(JSON.stringify({ updatedAt: new Date().toISOString(), alerts: alerts }))
    .setMimeType(ContentService.MimeType.JSON);
}

function fmtDate_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
  return String(v);
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
