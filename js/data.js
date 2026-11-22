// 망상 일본행: 여행 데이터
// 새 지역을 추가하려면 destinations 배열에 같은 모양의 객체를 하나 더 넣으면 됩니다.
// 가격은 모두 "비수기 평일 기준 대략값"입니다. 실제 가격은 검색 링크에서 확인하세요.

/**
 * @typedef {Object} Stop       일정 안의 한 장소
 * @property {string} time      시간대 (예: "오전")
 * @property {string} place     장소 이름
 * @property {string} note      한 줄 설명
 * @property {number} yen       교통비·입장료 합계 (엔). 식비는 따로 계산
 * @property {number[]} [closedDays] 쉬는 요일 (0=일 ~ 6=토). 그날 걸리면 화면에 경고
 */

/**
 * @typedef {Object} Day
 * @property {string} title
 * @property {Stop[]} stops
 */

/**
 * @typedef {Object} Destination
 * @property {string} id            주소창 #id 로도 쓰임
 * @property {string} name
 * @property {string} kanji
 * @property {string} code          도시 코드 (표시용)
 * @property {string} concept
 * @property {string} tagline
 * @property {string[]} keywords
 * @property {{typical:number, low:number, high:number, airport:string, airlines:string[], skyscanner:string, naver:string, google:string}} flight
 *           typical/low/high: 인천 왕복 항공권 (원)
 * @property {{area:string, why:string, query:string, hostel:number, business:number}} lodging
 *           hostel/business: 1인 1박 (엔)
 * @property {{save:number, normal:number}} food  하루 식비 (엔)
 * @property {Object<string, Day[]>} plans        "2" = 2박 3일, "3" = 3박 4일
 * @property {Stop[]} extras                      여유 있을 때 넣을 옵션
 * @property {string[]} tips
 */

window.TRIP_DATA = {
  origin: { code: "ICN", name: "인천" },

  defaults: {
    nights: 3,
    tier: "hostel",
    food: "save",
    shopYen: 10000,
    rate: 9.5, // 1엔 = 9.5원 (100엔 = 950원). 화면에서 바꿀 수 있음
    target: 700000,
    max: 800000,
  },

  // 항공권이 비싸지는 시기. from/to 는 "MM-DD" (매년 반복) 또는 "YYYY-MM-DD" (그해만)
  peakWindows: [
    { from: "12-20", to: "01-03", label: "연말연시" },
    { from: "04-29", to: "05-06", label: "일본 골든위크" },
    { from: "07-20", to: "08-20", label: "여름 휴가철" },
    { from: "2027-02-05", to: "2027-02-09", label: "설 연휴" },
    { from: "2027-09-13", to: "2027-09-17", label: "추석 연휴" },
  ],
  peakMultiplier: 1.6,
  weekendMultiplier: 1.1, // 금·토 출발

  // 가격 비교·땡처리·저가항공 특가 사이트 모음
  dealSites: [
    {
      group: "가격 비교",
      note: "여러 항공사·여행사 가격을 한 번에 비교해요. 달력 보기로 싼 날짜를 찾기 좋아요.",
      sites: [
        { name: "스카이스캐너", href: "https://www.skyscanner.co.kr/" },
        { name: "구글 항공편", href: "https://www.google.com/travel/flights?hl=ko" },
        { name: "네이버 항공권", href: "https://flight.naver.com/" },
        { name: "카약", href: "https://www.kayak.co.kr/" },
        { name: "트립닷컴", href: "https://kr.trip.com/flights/" },
      ],
    },
    {
      group: "땡처리 · 막판 특가",
      note: "출발이 가까운 남은 좌석을 싸게 파는 곳. 날짜를 유연하게 잡을 수 있을 때 좋아요.",
      sites: [
        { name: "땡처리닷컴", href: "https://www.ttang.com/" },
        { name: "마이리얼트립", href: "https://www.myrealtrip.com/" },
      ],
    },
    {
      group: "저가항공 공식 특가",
      note: "항공사 자체 특가는 홈페이지·앱에 먼저 떠요. 앱 알림을 켜두면 놓치지 않아요.",
      sites: [
        { name: "제주항공", href: "https://www.jejuair.net/" },
        { name: "티웨이항공", href: "https://www.twayair.com/" },
        { name: "진에어", href: "https://www.jinair.com/" },
        { name: "피치항공", href: "https://www.flypeach.com/" },
        { name: "에어서울", href: "https://flyairseoul.com/" },
        { name: "이스타항공", href: "https://www.eastarjet.com/" },
        { name: "에어부산", href: "https://www.airbusan.com/" },
        { name: "ZIPAIR", href: "https://www.zipair.net/" },
      ],
    },
  ],

  /** @type {Destination[]} */
  destinations: [
    {
      id: "tokyo",
      name: "도쿄",
      kanji: "東京",
      code: "TYO",
      concept: "애니 성지 순례",
      tagline: "아키하바라에서 굿즈를 뒤지고, 너의 이름은 계단에 서 보고, 시로바코의 이자카야에서 한 잔.",
      keywords: ["아키하바라", "이케부쿠로", "스가 신사", "지브리 미술관", "시로바코 마츠테이"],
      flight: {
        typical: 270000,
        low: 200000,
        high: 350000,
        airport: "나리타(NRT)",
        airlines: ["제주항공", "티웨이항공", "진에어", "이스타항공", "에어프레미아", "ZIPAIR"],
        skyscanner: "tyoa",
        naver: "NRT",
        google: "TYO",
        airports: "NRT,HND", // 구글 항공편(SerpApi) 조회용
      },
      lodging: {
        area: "우에노 · 아사쿠사",
        why: "나리타에서 케이세이선 한 번에 오고, 아키하바라까지 JR 두 정거장. 도쿄에서 싼 숙소가 제일 많은 동네예요.",
        query: "Ueno, Tokyo",
        hostel: 4800,
        business: 10000,
      },
      food: { save: 3000, normal: 5000 },
      plans: {
        3: [
          {
            title: "도착, 그리고 첫 아키하바라",
            stops: [
              { time: "오후", place: "나리타 공항 → 우에노", note: "케이세이 본선 특급, 약 75분. 스카이라이너보다 훨씬 싸요.", yen: 1100 },
              { time: "오후", place: "우에노 · 아사쿠사 숙소 체크인", note: "짐만 두고 바로 나가요.", yen: 0 },
              { time: "저녁", place: "아키하바라 전기 거리", note: "JR로 두 정거장. 밤 간판 불빛이 제일 예쁠 때예요.", yen: 340 },
            ],
          },
          {
            title: "아키하바라에서 이케부쿠로까지 덕질 데이",
            stops: [
              { time: "오전", place: "라디오회관", note: "층마다 피규어·굿즈 가게. 오픈 직후가 한산해요.", yen: 170 },
              { time: "오전", place: "만다라케 · 스루가야", note: "중고 굿즈 성지. 같은 물건도 가게마다 가격이 달라서 비교하며 돌아요.", yen: 0 },
              { time: "점심", place: "GiGO 게임센터", note: "크레인 게임은 미리 정한 금액까지만.", yen: 500 },
              { time: "오후", place: "이케부쿠로 애니메이트 본점 · 오토메 로드", note: "JR 야마노테선 약 20분. 애니메이트 본점은 건물 전체가 굿즈예요.", yen: 210 },
              { time: "저녁", place: "선샤인시티", note: "포켓몬센터, 가챠 코너. 숙소로 돌아갈 때 JR.", yen: 210 },
            ],
          },
          {
            title: "너의 이름은 계단 → 지브리 → 시로바코의 밤",
            stops: [
              { time: "아침", place: "스가 신사 계단 (요츠야)", note: "너의 이름은 마지막 장면의 그 계단. 주택가라 조용히 보고 와요.", yen: 210 },
              { time: "점심", place: "나카노 브로드웨이", note: "레트로 만화·피규어 가게 밀집. 가게 대부분이 정오쯤 열어요.", yen: 180 },
              { time: "오후", place: "지브리 미술관 (미타카)", note: "날짜·시간 지정 사전 예약 필수. 미타카역에서 걸어서 15분.", yen: 1200 },
              { time: "해 질 녘", place: "무사시사카이 상점가", note: "시로바코의 무사시노 애니메이션이 있는 동네. 미타카에서 JR 한 정거장.", yen: 300 },
              { time: "저녁", place: "이자카야 마츠테이 (松亭, 기치조지)", note: "시로바코에서 즈카가 아르바이트하던 그 가게. 기치조지역에서 걸어서 7분. 저녁 6시 반부터 영업, 일요일 휴무로 알려져 있어요. 술 한 잔과 안주 값을 따로 잡았어요.", yen: 3500, closedDays: [0] },
              { time: "밤", place: "기치조지 → 숙소", note: "JR 주오선.", yen: 480 },
            ],
          },
          {
            title: "아사쿠사 산책 후 귀국",
            stops: [
              { time: "아침", place: "센소지 · 나카미세 거리", note: "가게 열기 전 이른 아침이 제일 고요해요.", yen: 0 },
              { time: "오전", place: "스미다 강변", note: "스카이트리를 올려다보며 산책.", yen: 0 },
              { time: "오후", place: "우에노 → 나리타 공항", note: "케이세이 본선. 출발 3시간 전 도착을 목표로.", yen: 1100 },
            ],
          },
        ],
        2: [
          {
            title: "도착, 그리고 첫 아키하바라",
            stops: [
              { time: "오후", place: "나리타 공항 → 우에노", note: "케이세이 본선 특급, 약 75분.", yen: 1100 },
              { time: "저녁", place: "아키하바라 전기 거리", note: "라디오회관만 먼저 맛보기.", yen: 340 },
            ],
          },
          {
            title: "아키하바라 굿즈 사냥 → 지브리 → 마츠테이",
            stops: [
              { time: "오전", place: "만다라케 · 스루가야", note: "핵심 중고 굿즈 가게 위주로.", yen: 170 },
              { time: "점심", place: "나카노 브로드웨이", note: "지브리 가는 길에 들르기 좋아요.", yen: 200 },
              { time: "오후", place: "지브리 미술관 (미타카)", note: "사전 예약 필수.", yen: 1200 },
              { time: "저녁", place: "이자카야 마츠테이 (松亭, 기치조지)", note: "시로바코의 그 이자카야. 미타카에서 JR 한 정거장. 저녁 6시 반부터, 일요일 휴무로 알려져 있어요.", yen: 3500, closedDays: [0] },
              { time: "밤", place: "숙소로 복귀", note: "JR 주오선.", yen: 480 },
            ],
          },
          {
            title: "스가 신사 계단 보고 귀국",
            stops: [
              { time: "아침", place: "스가 신사 계단 (요츠야)", note: "너의 이름은 그 계단. 이른 아침이라 한적해요.", yen: 210 },
              { time: "오후", place: "나리타 공항", note: "닛포리에서 케이세이 본선.", yen: 1100 },
            ],
          },
        ],
      },
      extras: [
        { time: "옵션", place: "오다이바 유니콘 건담", note: "다이버시티 앞 실물 크기 건담. 유리카모메 왕복.", yen: 800 },
        { time: "옵션", place: "가마쿠라고교마에 건널목", note: "슬램덩크 오프닝의 그 건널목. 에노덴 포함 왕복. 주민 생활 공간이니 차도에 서지 않기.", yen: 2500 },
      ],
      tips: [
        "외국인용 도쿄 서브웨이 티켓(24·48·72시간권)을 사면 지하철을 여러 번 탈 때 아낄 수 있어요. 여권이 필요해요.",
        "지브리 미술관 표는 보통 매달 10일에 다음 달 것이 열려요. 날짜를 정했으면 그날 바로 예약하세요.",
        "한 가게에서 5,000엔 넘게 사면 여권을 보여주고 면세를 받을 수 있어요.",
        "굿즈는 첫날 사지 말고 사진으로 가격만 찍어두면 과소비를 막을 수 있어요.",
      ],
    },

    {
      id: "fukuoka",
      name: "후쿠오카",
      kanji: "福岡",
      code: "FUK",
      concept: "여유로운 시골과 온천",
      tagline: "다자이후 참배길을 걷고, 뒷산 신사를 오르고, 동네 온천에서 하루를 마무리.",
      keywords: ["다자이후 텐만구", "가마도 신사", "후쓰카이치 온천", "야나기가와 뱃놀이", "야타이"],
      flight: {
        typical: 170000,
        low: 120000,
        high: 220000,
        airport: "후쿠오카(FUK)",
        airlines: ["제주항공", "티웨이항공", "진에어", "에어부산", "이스타항공"],
        skyscanner: "fuk",
        naver: "FUK",
        google: "FUK",
        airports: "FUK",
      },
      lodging: {
        area: "하카타 · 나카스",
        why: "공항에서 지하철 5분, 다자이후·야나기가와 가는 니시테츠 텐진역도 가까워요.",
        query: "Hakata, Fukuoka",
        hostel: 3500,
        business: 7500,
      },
      food: { save: 2500, normal: 4200 },
      plans: {
        3: [
          {
            title: "도착하자마자 야타이",
            stops: [
              { time: "오후", place: "후쿠오카 공항 → 하카타", note: "지하철 두 정거장, 5분. 도착부터 여행 시작이에요.", yen: 260 },
              { time: "저녁", place: "나카스 강변 야타이", note: "포장마차 라멘·꼬치. 앉기 전에 메뉴판 가격부터 확인.", yen: 0 },
              { time: "밤", place: "캐널시티 하카타", note: "무료 분수 쇼 보며 소화시키기.", yen: 0 },
            ],
          },
          {
            title: "다자이후와 뒷산, 그리고 온천",
            stops: [
              { time: "오전", place: "니시테츠 텐진 → 다자이후", note: "후쓰카이치에서 갈아타고 약 40분.", yen: 420 },
              { time: "오전", place: "다자이후 텐만구 · 참배길", note: "갓 구운 우메가에모치 하나 들고 걷기.", yen: 0 },
              { time: "오전", place: "고묘젠지", note: "이끼와 돌로 된 정원. 관광객이 적고 아주 조용해요.", yen: 200 },
              { time: "오후", place: "가마도 신사 (호만산 자락)", note: "다자이후 뒷산 신사. 귀멸의 칼날 성지로도 유명해요. 커뮤니티 버스 약 10분.", yen: 200 },
              { time: "저녁", place: "후쓰카이치 온천", note: "다자이후 바로 옆 동네 온천. 공중 목욕탕이라 입욕료가 싸요.", yen: 500 },
              { time: "밤", place: "후쓰카이치 → 텐진", note: "니시테츠로 복귀.", yen: 400 },
            ],
          },
          {
            title: "야나기가와 뱃놀이",
            stops: [
              { time: "오전", place: "니시테츠 텐진 → 야나기가와", note: "특급 약 50분.", yen: 870 },
              { time: "오전", place: "야나기가와 강 내려가기", note: "뱃사공이 노 저으며 수로를 따라 약 70분. 버드나무와 돌담 사이를 지나요.", yen: 1800 },
              { time: "점심", place: "장어 세이로무시", note: "야나기가와 명물. 한 그릇 4,000엔 정도라 짠내 모드면 패스.", yen: 0 },
              { time: "오후", place: "야나기가와 → 텐진", note: "돌아와서 텐진 지하상가 구경.", yen: 870 },
            ],
          },
          {
            title: "오호리 공원 산책 후 귀국",
            stops: [
              { time: "오전", place: "오호리 공원", note: "호수 둘레 2km를 천천히 한 바퀴.", yen: 420 },
              { time: "오후", place: "텐진 → 후쿠오카 공항", note: "지하철 약 11분. 공항이 가까워 마지막까지 여유로워요.", yen: 260 },
            ],
          },
        ],
        2: [
          {
            title: "도착하자마자 야타이",
            stops: [
              { time: "오후", place: "후쿠오카 공항 → 하카타", note: "지하철 5분.", yen: 260 },
              { time: "저녁", place: "나카스 강변 야타이", note: "포장마차 라멘·꼬치.", yen: 0 },
            ],
          },
          {
            title: "다자이후와 뒷산, 그리고 온천",
            stops: [
              { time: "오전", place: "다자이후 텐만구 · 고묘젠지", note: "참배길과 조용한 이끼 정원.", yen: 620 },
              { time: "오후", place: "가마도 신사 (호만산 자락)", note: "다자이후 뒷산 신사. 커뮤니티 버스.", yen: 200 },
              { time: "저녁", place: "후쓰카이치 온천", note: "동네 공중 목욕탕에서 몸 녹이기.", yen: 900 },
            ],
          },
          {
            title: "오호리 공원 산책 후 귀국",
            stops: [
              { time: "오전", place: "오호리 공원", note: "호숫가 산책.", yen: 420 },
              { time: "오후", place: "후쿠오카 공항", note: "지하철 약 11분.", yen: 260 },
            ],
          },
        ],
      },
      extras: [
        { time: "옵션", place: "이토시마 해변", note: "야나기가와 대신 바다. JR + 버스로 해변 카페와 바다 위 도리이.", yen: 2000 },
        { time: "옵션", place: "유후인 당일치기", note: "고속버스 왕복. 시골 온천 마을 분위기는 최고지만 예산이 빠듯해져요.", yen: 6000 },
      ],
      tips: [
        "니시테츠의 다자이후·야나기가와 관광 티켓은 전철과 뱃놀이가 묶여 있어서 따로 사는 것보다 쌀 수 있어요.",
        "후쿠오카 공항은 시내에서 지하철로 10분이라 마지막 날 오후 비행기여도 반나절을 쓸 수 있어요.",
        "야타이는 자릿세가 있는 곳도 있어서 앉기 전에 가격을 물어보세요.",
        "온천에 갈 땐 작은 수건을 챙기면 대여료를 아낄 수 있어요.",
      ],
    },

    {
      id: "kansai",
      name: "오사카 · 나라 · 교토",
      kanji: "関西",
      code: "OSA",
      concept: "고즈넉한 옛 도시",
      tagline: "숙소는 싼 오사카에 두고, 이른 아침의 나라와 교토를 걷는 조용한 여행.",
      keywords: ["나라 공원", "가스가 타이샤", "후시미 이나리", "철학의 길", "기온 시라카와"],
      flight: {
        typical: 220000,
        low: 160000,
        high: 280000,
        airport: "간사이(KIX)",
        airlines: ["제주항공", "티웨이항공", "진에어", "피치항공", "에어서울"],
        skyscanner: "osaa",
        naver: "KIX",
        google: "OSA",
        airports: "KIX",
      },
      lodging: {
        area: "난바 · 닛폰바시",
        why: "간사이공항 직행 난카이선 종점이고, 나라행 긴테쓰선도 여기서 출발해요. 교토 숙소보다 훨씬 싸요.",
        query: "Namba, Osaka",
        hostel: 3800,
        business: 8000,
      },
      food: { save: 2700, normal: 4500 },
      plans: {
        3: [
          {
            title: "난바 도착, 등불 골목",
            stops: [
              { time: "오후", place: "간사이공항 → 난바", note: "난카이 공항급행 약 45분. 라피트보다 싸요.", yen: 970 },
              { time: "저녁", place: "호젠지 요코초", note: "도톤보리 바로 옆인데 조용한 돌길 골목. 이끼 낀 부동명왕상에 물 한 바가지.", yen: 0 },
            ],
          },
          {
            title: "나라, 사슴과 석등",
            stops: [
              { time: "아침", place: "긴테쓰 난바 → 나라", note: "쾌속급행 약 40분. 일찍 갈수록 조용해요.", yen: 680 },
              { time: "오전", place: "나라 공원", note: "사슴 센베 한 묶음. 인사하면 고개 숙이는 사슴도 있어요.", yen: 200 },
              { time: "오전", place: "도다이지 대불전", note: "세계 최대급 목조 건물 안의 대불.", yen: 800 },
              { time: "오후", place: "가스가 타이샤 숲길", note: "이끼 낀 석등 수천 개가 늘어선 숲길. 바깥 경내는 무료.", yen: 0 },
              { time: "오후", place: "나라마치 골목", note: "옛 상가 골목의 작은 카페에서 쉬기.", yen: 0 },
              { time: "저녁", place: "나라 → 난바", note: "긴테쓰로 복귀.", yen: 680 },
            ],
          },
          {
            title: "교토, 이른 아침의 고요",
            stops: [
              { time: "이른 아침", place: "난바 → 후시미이나리", note: "지하철로 요도야바시, 게이한선으로 갈아타요.", yen: 700 },
              { time: "아침", place: "후시미 이나리 센본 도리이", note: "아침 7시 전후엔 붉은 도리이 길을 거의 혼자 걸을 수 있어요.", yen: 0 },
              { time: "오전", place: "기요미즈데라 · 산넨자카", note: "언덕길 옛 거리. 붐비기 전에 지나가기.", yen: 660 },
              { time: "오후", place: "철학의 길 → 난젠지 수로각", note: "수로 따라 2km 산책, 벽돌 아치 수로각.", yen: 230 },
              { time: "저녁", place: "기온 시라카와", note: "버드나무와 돌다리, 해 질 녘이 제일 고즈넉해요.", yen: 0 },
              { time: "밤", place: "교토가와라마치 → 오사카", note: "한큐선이 JR보다 싸요.", yen: 650 },
            ],
          },
          {
            title: "나카자키초 카페 골목 후 귀국",
            stops: [
              { time: "오전", place: "나카자키초", note: "오래된 목조 주택을 고친 카페와 잡화점 골목.", yen: 240 },
              { time: "오후", place: "난바 → 간사이공항", note: "난카이 공항급행.", yen: 970 },
            ],
          },
        ],
        2: [
          {
            title: "난바 도착, 등불 골목",
            stops: [
              { time: "오후", place: "간사이공항 → 난바", note: "난카이 공항급행 약 45분.", yen: 970 },
              { time: "저녁", place: "호젠지 요코초", note: "조용한 돌길 등불 골목.", yen: 0 },
            ],
          },
          {
            title: "나라 오전, 교토 오후",
            stops: [
              { time: "아침", place: "긴테쓰 난바 → 나라", note: "일찍 출발.", yen: 680 },
              { time: "오전", place: "나라 공원 · 가스가 타이샤", note: "사슴과 석등 숲길.", yen: 200 },
              { time: "점심", place: "나라 → 이나리 (JR 나라선)", note: "갈아타지 않고 한 번에 가요.", yen: 720 },
              { time: "오후", place: "후시미 이나리 센본 도리이", note: "오후 늦게 산 위쪽으로 오르면 한적해요.", yen: 0 },
              { time: "저녁", place: "기온 시라카와 → 오사카", note: "해 질 녘 골목을 걷고 한큐선으로 복귀.", yen: 860 },
            ],
          },
          {
            title: "오사카성 공원 산책 후 귀국",
            stops: [
              { time: "오전", place: "오사카성 공원", note: "성 안에는 안 들어가도 해자 산책만으로 충분해요.", yen: 480 },
              { time: "오후", place: "난바 → 간사이공항", note: "난카이 공항급행.", yen: 970 },
            ],
          },
        ],
      },
      extras: [
        { time: "옵션", place: "우지", note: "뵤도인 봉황당과 말차의 동네. 나라와 교토 사이라 하루에 묶기 좋아요.", yen: 1500 },
        { time: "옵션", place: "오하라", note: "교토 북쪽 산골 사찰 마을. 버스 왕복이라 하루를 따로 잡아야 해요.", yen: 2200 },
        { time: "옵션", place: "아라시야마 대나무숲", note: "아침 7시 전에 가야 고요해요. 낮에는 매우 붐벼요.", yen: 800 },
      ],
      tips: [
        "교통패스보다 그때그때 표를 사는 게 싼 경우가 많아요. 하루 동선의 교통비를 더해보고 패스 가격과 비교하세요.",
        "교토는 낮에 정말 붐벼요. 유명한 곳은 아침 일찍, 오후엔 철학의 길 같은 한적한 곳으로.",
        "교토 숙소는 비싸니 오사카 난바에 묵고 당일치기가 예산에 유리해요.",
        "교토 시내버스는 붐비고 느려서, 가능하면 전철(게이한·한큐·지하철)로 움직이세요.",
      ],
    },
  ],
};
