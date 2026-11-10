(() => {
  'use strict';
  const host = document.getElementById('travelWeather');
  if (!host) return;
  const FEED = 'https://raw.githubusercontent.com/blackgar/namhae-daybook/weather-updates/weather.json';
  const START = Date.parse('2026-12-01T00:00:00+09:00');
  const STOP = Date.parse('2026-12-06T18:00:00+09:00');
  const TARGETS = ['2026-12-05', '2026-12-06'];
  const WEEK = Array.from({length: 6}, (_, index) => '2026-12-0' + (index + 1));
  const CACHE = 'namhae-weather-december-v1';
  let region = new URLSearchParams(location.search).get('course') === 'west' ? 'west' : 'east';
  let selectedDate = TARGETS[0];
  let fullDay = false;
  let requestFailed = false;
  let loading = false;
  let data = window.namhaeWeatherSeed;
  const escapeText = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const numeric = value => typeof value === 'number' && Number.isFinite(value);
  const degree = value => numeric(value) ? Math.round(value * 10) / 10 + '°' : '—';
  const percent = value => numeric(value) ? value + '%' : '—';
  const measurement = (value, unit) => numeric(value) ? value + unit : '—';
  const labelDate = date => new Intl.DateTimeFormat('ko-KR', {timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short'}).format(new Date(date + 'T12:00:00+09:00'));
  const timestamp = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('ko-KR', {timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false}).format(new Date(value)) : '아직 확인 전';
  const hourOf = value => new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false}).format(new Date(value));
  function dateOf(value) {
    return new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(value));
  }
  function symbol(weather) {
    if (!weather) return '—';
    if (/비.*눈|눈.*비|진눈깨비/.test(weather)) return '🌨️';
    if (/눈/.test(weather)) return '❄️';
    if (/천둥|번개/.test(weather)) return '⛈️';
    if (/비|소나기/.test(weather)) return '🌧️';
    if (/안개/.test(weather)) return '🌫️';
    if (/흐림/.test(weather)) return '☁️';
    if (/구름/.test(weather)) return '⛅';
    if (/맑음/.test(weather)) return '☀️';
    return '🌤️';
  }
  function getDaily(date) {
    return (data.locations[region]?.daily || []).find(day => day.date === date);
  }
  function dailyCards(now) {
    const dates = now < START ? TARGETS : WEEK;
    return '<div class="wxDays ' + (dates.length === 2 ? 'wxTwoDays' : '') + '">' + dates.map(date => {
      const day = getDaily(date);
      const weather = day?.weather || (day?.am_weather && day?.pm_weather && day.am_weather !== day.pm_weather ? day.am_weather + ' → ' + day.pm_weather : day?.pm_weather || day?.am_weather);
      const target = TARGETS.includes(date);
      return '<button class="wxDay ' + (target ? 'wxTarget' : '') + '" data-wx-date="' + date + '" aria-pressed="' + (selectedDate === date) + '"><span class="wxDayDate">' + escapeText(labelDate(date)) + (target ? '<small>출발 후보</small>' : '') + '</span><span class="wxDayIcon" aria-hidden="true">' + symbol(weather) + '</span><span class="wxDayWeather">' + escapeText(weather || (now < START ? '예보 발표 전' : '예보 확인 대기')) + '</span><span class="wxTemps"><b>' + degree(day?.low) + '</b><i>/</i><strong>' + degree(day?.high) + '</strong></span><span class="wxDayRain">강수확률 ' + percent(day?.rain_probability ?? day?.pm_rain_probability) + '</span></button>';
    }).join('') + '</div>';
  }
  function graph(hours) {
    const temperatures = hours.map(hour => hour?.temperature).filter(numeric);
    if (!temperatures.length) return '<div class="wxGraphEmpty">시간별 기온 발표를 기다리고 있어요.</div>';
    const low = Math.min(...temperatures) - 2;
    const high = Math.max(...temperatures) + 2;
    const x = index => index * 64 + 32;
    const y = temperature => 86 - (temperature - low) / (high - low) * 60;
    let path = '';
    let connected = false;
    const labels = [];
    hours.forEach((hour, index) => {
      if (!numeric(hour?.temperature)) {connected = false; return;}
      const px = x(index);
      const py = y(hour.temperature);
      path += (connected ? 'L' : 'M') + px + ' ' + py.toFixed(1) + ' ';
      connected = true;
      labels.push('<circle cx="' + px + '" cy="' + py.toFixed(1) + '" r="3"/><text x="' + px + '" y="' + (py - 10).toFixed(1) + '">' + degree(hour.temperature) + '</text>');
    });
    return '<svg class="wxGraph" role="img" aria-label="시간별 기온 변화" viewBox="0 0 ' + hours.length * 64 + ' 105" width="' + hours.length * 64 + '" height="105"><line x1="0" x2="' + hours.length * 64 + '" y1="92" y2="92"/><path d="' + path + '"/>' + labels.join('') + '</svg>';
  }
  function precipitation(hour) {
    if (hour?.precipitation_text) return escapeText(hour.precipitation_text);
    return measurement(hour?.precipitation_mm, 'mm');
  }
  function hourlyPanel(now) {
    const unlock = Date.parse(selectedDate + 'T00:00:00+09:00') - 86400000;
    const available = (data.locations[region]?.hourly || []).filter(hour => Number.isFinite(Date.parse(hour.time)) && dateOf(hour.time) === selectedDate);
    const header = '<div class="wxHourlyHeading"><div><h4>' + escapeText(labelDate(selectedDate)) + ' 시간별 예보</h4><p>기온 · 날씨 · 강수확률 · 강수량 · 바람 · 습도</p></div></div>';
    if (now < unlock) return header + '<div class="wxHourlyWaiting"><span aria-hidden="true">◷</span><p>출발 전날부터 시간별 예보를 자세히 보여드려요.<br><b>' + escapeText(labelDate(dateOf(unlock))) + ' 이후</b>, 발표된 자료부터 표시합니다.</p></div>';
    if (!available.length) return header + '<div class="wxHourlyWaiting"><p>이 날짜의 시간별 예보를 아직 확인하지 못했어요.<br>다음 갱신에서 기상청 발표 자료를 다시 확인합니다.</p></div>';
    const range = Array.from({length: fullDay ? 24 : 11}, (_, index) => index + (fullDay ? 0 : 8));
    const hours = range.map(hour => available.find(item => Number(hourOf(item.time)) === hour));
    const row = (name, cells, className = '') => '<div class="wxTableRow ' + className + '"><b class="wxRowName">' + name + '</b><div class="wxCells">' + cells.map(cell => '<span>' + cell + '</span>').join('') + '</div></div>';
    const rows = [
      row('시각', range.map(hour => hour + '시'), 'wxHourRow'),
      row('날씨', hours.map(hour => '<i aria-hidden="true">' + symbol(hour?.weather) + '</i><small>' + escapeText(hour?.weather || '—') + '</small>'), 'wxIconRow'),
      '<div class="wxTableRow wxTempRow"><b class="wxRowName">기온</b><div class="wxCells">' + graph(hours) + '</div></div>',
      row('체감', hours.map(hour => degree(hour?.feels_like))),
      row('강수확률', hours.map(hour => percent(hour?.rain_probability)), 'wxRainRow'),
      row('강수량', hours.map(precipitation)),
      row('바람', hours.map(hour => measurement(hour?.wind_ms, 'm/s'))),
      row('습도', hours.map(hour => percent(hour?.humidity)))
    ].join('');
    const issued = available.map(hour => hour.issued_at).filter(Boolean).sort().at(-1);
    return header + '<div class="wxRange"><button data-wx-range="trip" aria-pressed="' + !fullDay + '">여행 시간 08–18시</button><button data-wx-range="full" aria-pressed="' + fullDay + '">하루 전체</button><span>좌우로 밀어서 확인하세요 →</span></div><div class="wxTableScroll" tabindex="0" aria-label="시간별 날씨 표, 좌우로 스크롤"><div class="wxTable" style="--wx-columns:' + range.length + '">' + rows + '</div></div><p class="wxIssued">시간별 자료 발표 ' + timestamp(issued) + ' · 빈 항목은 발표 자료에서 확인되지 않은 값입니다.</p>';
  }
  function status(now) {
    if (now >= STOP) return ['종료', '12월 6일 18시에 갱신을 종료했습니다. 마지막으로 확인한 예보를 보관합니다.'];
    if (now < START) return ['예약', '12월 1일부터 발표된 예보를 확인해 표시합니다.'];
    if (requestFailed) return ['연결 확인', (data.locations[region]?.daily || []).length ? '최근 저장된 예보를 표시합니다. 최신 갱신 확인은 잠시 후 다시 시도합니다.' : '예보 데이터 연결을 확인하지 못했어요. 잠시 후 다시 시도합니다.'];
    if (['unavailable', 'error'].includes(data.status)) return ['확인 지연', data.message || '예보를 가져오지 못해 기존 자료를 유지합니다.'];
    const last = Date.parse(data.last_success_at || data.updated_at || '');
    const threshold = now >= Date.parse('2026-12-04T00:00:00+09:00') ? 2 * 3600000 : 36 * 3600000;
    if (Number.isFinite(last) && now - last > threshold) return ['갱신 지연', '표시된 확인 시각 이후의 새 예보는 아직 반영되지 않았습니다.'];
    if (data.status === 'partial') return ['일부 확인', data.message || '확인된 자료부터 표시합니다.'];
    if (!(data.locations[region]?.daily || []).length) return ['확인 중', '예보가 발표되면 날짜별 날씨와 기온을 표시합니다.'];
    return ['예보', '발표 시각에 따라 예보가 바뀔 수 있어요. 출발 전에 한 번 더 확인해 주세요.'];
  }
  function render() {
    const now = Date.now();
    const [badge, message] = status(now);
    const day = getDaily(selectedDate);
    host.innerHTML = '<div class="wxHeading"><div><span class="wxEyebrow">12월 5일·6일 출발 후보</span><h3>남해 여행 날씨 <span class="wxBadge">' + badge + '</span></h3></div><a href="https://www.weather.go.kr/w/forecast/overall/short-term.do" target="_blank" rel="noopener noreferrer">기상청 원문 ↗</a></div><div class="wxRegions" aria-label="날씨 지역"><button data-wx-region="east" aria-pressed="' + (region === 'east') + '">A · 삼동면</button><button data-wx-region="west" aria-pressed="' + (region === 'west') + '">B · 설천면</button><span>한국시간 기준</span></div><p class="wxMessage" role="status">' + escapeText(message) + '</p>' + dailyCards(now) + (day && (day.am_weather || day.pm_weather) ? '<p class="wxHalfDay">선택 날짜 오전 <b>' + escapeText(day.am_weather || '—') + '</b> ' + percent(day.am_rain_probability) + ' <span>·</span> 오후 <b>' + escapeText(day.pm_weather || '—') + '</b> ' + percent(day.pm_rain_probability) + '</p>' : '') + '<div class="wxHourly">' + hourlyPanel(now) + '</div><p class="wxArea">자료 기준 ' + escapeText(data.locations[region]?.source_area || data.locations[region]?.name) + '</p><div class="wxFooter"><p>' + (now >= STOP ? '마지막 확인 ' : '예보 확인 ') + timestamp(data.last_success_at || data.updated_at) + '</p><p>12/1–3 매일 아침 · 12/4부터 매시간 · 12/6 18:00 종료</p></div>' + (data.sources?.length ? '<div class="wxSources">' + data.sources.filter(source => source.url?.startsWith('https://')).map(source => '<a href="' + escapeText(source.url) + '" target="_blank" rel="noopener noreferrer">' + escapeText(source.name || '예보 출처') + ' ↗</a>').join(' · ') + '</div>' : '');
  }
  function valid(value) {
    return value?.schema_version === 1 && value.timezone === 'Asia/Seoul' && value.locations?.east && value.locations?.west && ['east','west'].every(key => Array.isArray(value.locations[key].daily) && Array.isArray(value.locations[key].hourly));
  }
  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      const response = await fetch(FEED + '?_=' + Math.floor(Date.now() / 300000), {cache: 'no-store', signal: AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('Feed HTTP ' + response.status);
      const incoming = await response.json();
      if (!valid(incoming)) throw new Error('Forecast schema');
      data = incoming;
      requestFailed = false;
      try {localStorage.setItem(CACHE, JSON.stringify(data));} catch {}
    } catch {requestFailed = true;}
    finally {loading = false; render();}
  }
  host.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.wxDate) selectedDate = button.dataset.wxDate;
    if (button.dataset.wxRegion) region = button.dataset.wxRegion;
    if (button.dataset.wxRange) fullDay = button.dataset.wxRange === 'full';
    render();
  });
  window.addEventListener('namhae:coursechange', event => {
    if (['east','west'].includes(event.detail)) {region = event.detail; render();}
  });
  document.addEventListener('visibilitychange', () => {if (!document.hidden && Date.now() >= START && Date.now() <= STOP) refresh();});
  try {const saved = JSON.parse(localStorage.getItem(CACHE)); if (valid(saved)) data = saved;} catch {}
  render();
  refresh();
  setInterval(() => {if (Date.now() >= START && Date.now() <= STOP && !document.hidden) refresh();}, 300000);
})();
