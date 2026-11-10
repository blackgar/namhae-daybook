(() => {
  'use strict';
  const guide = window.namhaeGuide;
  const routes = guide.routes;
  const $ = id => document.getElementById(id);
  const escapeText = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const icon = id => '<svg class="ico" aria-hidden="true"><use href="#' + id + '"/></svg>';
  const externalLink = (url, label, className = 'extra') => '<a class="' + className + '" target="_blank" rel="noopener noreferrer" href="' + escapeText(url) + '">' + label + '</a>';
  const categories = [['sight', '풍경과 산책'], ['exterior', '외관'], ['interior', '실내'], ['food', '음식과 음료'], ['menu', '메뉴판']];
  const tabs = [['schedule', '일정표', 'clock'], ['restaurants', '식당', 'food'], ['cafes', '카페', 'cup'], ['map', '지도', 'map']];
  const routeKeys = Object.keys(routes);
  const selections = Object.fromEntries(routeKeys.map(routeKey => [routeKey, {restaurants: 0, cafes: 0}]));
  let key = routeKeys[0];
  let tab = 'schedule';
  let detailId = '';
  let galleryFilter = 'all';
  let previousScroll = 0;
  let photoList = [];
  let photoIndex = 0;
  let mapView;
  const places = new Map();
  for (const routeKey of routeKeys) {
    for (const type of ['stops', 'restaurants', 'cafes']) {
      routes[routeKey][type].forEach((place, index) => {
        place.id = routeKey + '-' + type + '-' + index;
        place.routeKey = routeKey;
        place.type = type;
        place.index = index;
        places.set(place.id, place);
      });
    }
  }
  const photoCredit = photo => [photo.author || '사진 출처', photo.date, photo.license].filter(Boolean).join(' · ');
  const hour = minutes => String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
  const roundFive = minutes => Math.ceil(minutes / 5) * 5;
  const duration = minutes => minutes >= 60 ? Math.floor(minutes / 60) + '시간' + (minutes % 60 ? ' ' + minutes % 60 + '분' : '') : minutes + '분';
  const navigationUrl = place => 'https://map.kakao.com/link/to/' + encodeURIComponent(place.name) + ',' + place.lat + ',' + place.lng;
  const tmapUrl = place => 'tmap://route?goalname=' + encodeURIComponent(place.name) + '&goalx=' + place.lng + '&goaly=' + place.lat + '&rGoName=' + encodeURIComponent(place.name) + '&rGoX=' + place.lng + '&rGoY=' + place.lat;
  const squaredDistance = (a, b) => (a.lat - b.lat) ** 2 + ((a.lng - b.lng) * .82) ** 2;
  const indexValue = (value, length) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 && number < length ? number : 0;
  };
  function readUrl() {
    const params = new URLSearchParams(location.search);
    key = routeKeys.includes(params.get('course')) ? params.get('course') : routeKeys[0];
    tab = tabs.some(([id]) => id === params.get('view')) ? params.get('view') : 'schedule';
    selections[key].restaurants = indexValue(params.get('meal'), routes[key].restaurants.length);
    selections[key].cafes = indexValue(params.get('cafe'), routes[key].cafes.length);
    const hashId = new URLSearchParams(location.hash.slice(1)).get('place');
    detailId = places.has(hashId) ? hashId : '';
    if (detailId) key = places.get(detailId).routeKey;
  }
  function currentUrl() {
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('course', key);
    if (tab !== 'schedule') url.searchParams.set('view', tab);
    if (selections[key].restaurants) url.searchParams.set('meal', selections[key].restaurants);
    if (selections[key].cafes) url.searchParams.set('cafe', selections[key].cafes);
    if (detailId) url.hash = 'place=' + detailId;
    return url;
  }
  function syncUrl(push = false) {
    history[push ? 'pushState' : 'replaceState'](null, '', currentUrl());
  }
  function leg(from, to, route) {
    const matrix = route.matrix;
    const nearest = place => matrix.places.map(candidate => squaredDistance(place, candidate)).reduce((best, distance, index, distances) => distance < distances[best] ? index : best, 0);
    const fromIndex = nearest(from);
    const toIndex = nearest(to);
    return {minutes: Math.max(1, Math.round(matrix.durations[fromIndex][toIndex] / 60)), km: Math.round(matrix.distances[fromIndex][toIndex] / 100) / 10};
  }
  const roadText = segment => segment.km.toFixed(1) + 'km · 주행 약 ' + duration(segment.minutes);
  function plan(route) {
    const food = route.restaurants[selections[key].restaurants];
    const cafe = route.cafes[selections[key].cafes];
    const visits = [route.matrix.places[0], route.stops[0], food, cafe, route.stops[1], route.matrix.places[0]];
    const legs = visits.slice(1).map((place, index) => leg(visits[index], place, route));
    const starts = [480];
    const stays = [0, 35, 60, 60, 25];
    for (let index = 0; index < 5; index++) {
      const allowance = index === 0 || index === 4 ? 30 : 8;
      starts.push(roundFive(starts[index] + stays[index] + legs[index].minutes + allowance));
    }
    return {visits, legs, starts, stays, food, cafe};
  }
  function announce(message) {
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    clearTimeout(announce.timer);
    announce.timer = setTimeout(() => $('toast').classList.remove('visible'), 2200);
  }
  function titleLink(place, label = place.name, className = 'placeTitle') {
    if (!place.id) return escapeText(label);
    return '<a href="#place=' + place.id + '" class="' + className + '" data-place="' + place.id + '" aria-label="' + escapeText(place.name + ' 사진·상세 페이지 열기') + '"><span class="placeName">' + escapeText(label) + '</span><span class="placeLinkHint">사진·상세 보기 ' + icon('arrow') + '</span></a>';
  }
  function photoThumbnail(place, className = '', lazy = true) {
    const photo = place.photos?.[0];
    if (!photo) return '';
    return '<img referrerpolicy="no-referrer" class="' + className + '" src="' + escapeText(photo.file) + '" alt="' + escapeText(place.name + ' · ' + photo.caption) + '" ' + (lazy ? 'loading="lazy"' : '') + '>';
  }
  function addressBlock(place, compact = false) {
    return '<div class="addressBlock' + (compact ? ' compact' : '') + '"><p>' + icon('pin') + '<span>' + escapeText(place.address) + '</span></p><div class="addressActions"><button type="button" data-copy="' + escapeText(place.id || 'origin') + '">주소 복사</button>' + '<a href="' + escapeText(tmapUrl(place)) + '" class="tmap" title="TMAP이 설치된 휴대폰에서 열기">TMAP</a>' + externalLink(navigationUrl(place), '카카오맵', 'maplink') + '</div></div>';
  }
  function selectionButton(place) {
    const selected = selections[key][place.type] === place.index;
    return '<button class="sel ' + (selected ? 'chosen' : '') + '" data-select="' + place.id + '" aria-pressed="' + selected + '">' + icon(selected ? 'check' : 'pin') + (selected ? '일정에 선택됨' : '이 장소 선택') + '</button>';
  }
  function routeHeader(route) {
    $('routes').innerHTML = routeKeys.map(routeKey => {
      const candidate = routes[routeKey];
      const active = routeKey === key;
      return '<button type="button" class="route" data-route="' + routeKey + '" aria-pressed="' + active + '"><img referrerpolicy="no-referrer" src="' + escapeText(candidate.thumbnail) + '" alt=""><span class="routeText"><small>코스 ' + candidate.letter + '</small><strong>' + escapeText(candidate.short) + '</strong><span class="blurb">' + escapeText(candidate.shortDesc) + '</span></span><span class="circle">' + (active ? icon('check') : '') + '</span></button>';
    }).join('');
    window.dispatchEvent(new CustomEvent('namhae:coursechange', {detail: key}));
    $('courseNumber').textContent = '코스 ' + route.letter + ' · ' + route.region;
    $('guideTitle').textContent = route.heading;
    $('guideIntro').textContent = route.intro;
    $('tabs').innerHTML = tabs.map(([id, name, symbol]) => '<button type="button" class="tab ' + (tab === id ? 'active' : '') + '" data-tab="' + id + '" aria-pressed="' + (tab === id) + '">' + icon(symbol) + name + (Array.isArray(route[id]) ? '<small>' + route[id].length + '</small>' : '') + '</button>').join('');
  }
  function scheduleCandidates(route, itinerary, type) {
    const isFood = type === 'restaurants';
    return '<div class="scheduleCandidates"><div class="candidateLabel">' + (isFood ? '점심 후보 3곳' : '카페 후보 2곳') + ' <span>한 곳을 선택하세요</span></div>' + route[type].map(place => {
      const selected = selections[key][type] === place.index;
      const before = isFood ? route.stops[0] : itinerary.food;
      const after = isFood ? itinerary.cafe : route.stops[1];
      return '<article class="candidate ' + (selected ? 'isSelected' : '') + '"><div class="candidateHeading"><span class="candidateNumber">' + (place.index + 1) + '</span><h4>' + titleLink(place) + '</h4>' + (selected ? '<span class="selectedMark">선택</span>' : '') + '</div><p class="candidateMenu">' + escapeText(place.menu) + '</p>' + addressBlock(place, true) + '<p class="candidateDrive">이전 장소 → 약 ' + leg(before, place, route).minutes + '분 · 다음 장소 → 약 ' + leg(place, after, route).minutes + '분</p><div class="candidateBottom">' + selectionButton(place) + '<button class="extra textButton" data-place="' + place.id + '">사진·메뉴 보기 ↗</button></div></article>';
    }).join('') + '</div>';
  }
  function mapShell(title, itinerary, compact = false) {
    return '<section class="surface mapcard ' + (compact ? 'stickyMap' : 'mapfull') + '"><div class="maptop"><h3>' + icon('map') + title + '</h3></div><div id="travelMap"></div>' + mapSequence(itinerary, compact) + '</section>';
  }
  function mapSequence(itinerary, compact) {
    return '<div class="routeSequence ' + (compact ? 'sequenceCompact' : '') + '"><h3>사진으로 보는 방문 순서</h3>' + itinerary.visits.map((place, index) => {
      const photo = photoThumbnail(place);
      const name = index === 0 ? '서대구 IC 출발' : index === 5 ? '서대구 IC 복귀' : place.name;
      return '<article class="routeStep"><span class="stepIndex">' + index + '</span>' + (photo ? '<button class="stepPhoto" data-place="' + place.id + '" aria-label="' + escapeText(place.name) + ' 사진·상세">' + photo + '</button>' : '<span class="stepOrigin">' + icon('car') + '</span>') + '<div><time>' + hour(itinerary.starts[index]) + '</time><h4>' + titleLink(place, name) + '</h4><p>' + escapeText(place.address) + '</p></div></article>' + (index < 5 ? '<div class="stepLeg">' + icon('arrow') + '<span>' + roadText(itinerary.legs[index]) + '</span></div>' : '');
    }).join('') + '</div>';
  }
  function schedule(route, itinerary) {
    const rows = itinerary.visits.map((place, index) => {
      const type = index === 2 ? 'restaurants' : index === 3 ? 'cafes' : '';
      const label = index === 0 ? '서대구 IC 출발' : index === 5 ? '서대구 IC 도착 예상' : index === 2 ? '점심' : index === 3 ? '카페' : place.name;
      const description = ['고속도로 진입 전 서대구 IC에서 08:00 출발하는 기준이에요.', route.stops[0].desc, '식사 시간 60분. 아래 세 곳 중 한 곳을 고르세요.', '따뜻한 실내에서 60분 쉬어 가세요. 아래 두 곳 중 한 곳을 고르세요.', route.stops[1].desc, '서대구 IC 복귀 예상 시각이에요.'][index];
      const content = type ? scheduleCandidates(route, itinerary, type) : addressBlock(place, true);
      const move = index < 5 ? '<div class="move">' + icon('car') + '<span>' + (index === 4 ? hour(itinerary.starts[index] + itinerary.stays[index]) + ' 남해 출발 · ' : '') + roadText(itinerary.legs[index]) + '</span></div>' : '';
      return '<li><time>' + hour(itinerary.starts[index]) + '</time><span class="dot"></span><div class="stoprow"><div class="timelineTitle">' + (type ? label : titleLink(place, label)) + '</div><p>' + escapeText(description) + '</p>' + content + move + '</div></li>';
    }).join('');
    return '<div class="schedGrid upgraded"><section class="surface"><div class="subhead"><h3>하루 일정</h3><span>08:00 – ' + hour(itinerary.starts[5]) + '</span></div><ol class="timeline">' + rows + '</ol><div class="note">' + escapeText(route.tip) + ' 주말 정체가 있으면 마지막 산책을 줄이고 출발하세요.</div></section><div>' + mapShell('선택한 일정의 동선', itinerary, true) + '</div></div>';
  }
  function choices(route, itinerary, type) {
    return '<p class="placeLead">장소 이름을 누르면 외관·실내·음식·메뉴판 사진을 볼 수 있어요.</p><div class="places ' + (type === 'cafes' ? 'cafeGrid' : '') + '">' + route[type].map(place => {
      const photos = place.photos?.slice(0, 2) || [];
      const pair = '<div class="photopair">' + photos.map((photo, index) => '<button class="photofig" data-open-photo="' + place.id + ',' + index + '" aria-label="' + escapeText(place.name + ' ' + photo.caption) + ' 사진 크게 보기"><img referrerpolicy="no-referrer" src="' + escapeText(photo.file) + '" loading="lazy" alt="' + escapeText(photo.caption) + '"><span>' + escapeText(photo.caption) + '</span></button>').join('') + '</div>';
      return '<article class="surface place">' + pair + '<div><span class="tag">' + icon(type === 'restaurants' ? 'food' : 'cup') + (type === 'restaurants' ? '점심 후보 ' : '전망 카페 ') + (place.index + 1) + '</span><h3>' + titleLink(place) + '</h3><p class="placemenu">' + escapeText(place.menu) + '</p><p class="placedesc">' + escapeText(place.desc) + '</p>' + addressBlock(place) + '<div class="cardbuttons">' + selectionButton(place) + '<button class="action" data-place="' + place.id + '">사진·메뉴 상세 ' + icon('arrow') + '</button></div></div></article>';
    }).join('') + '</div>';
  }
  function galleryContent(place) {
    const photos = place.photos || [];
    const present = categories.filter(([category]) => photos.some(photo => photo.category === category));
    const filters = [['all', '전체'], ...present];
    const shown = galleryFilter === 'all' ? present : present.filter(([category]) => category === galleryFilter);
    return '<nav class="galleryFilters" aria-label="사진 종류">' + filters.map(([category, label]) => '<button data-gallery-filter="' + category + '" aria-pressed="' + (category === galleryFilter) + '">' + label + '<small>' + (category === 'all' ? photos.length : photos.filter(photo => photo.category === category).length) + '</small></button>').join('') + '</nav>' + shown.map(([category, label]) => '<section class="gallerySection"><div class="subhead"><h3>' + label + '</h3><span>' + photos.filter(photo => photo.category === category).length + '장</span></div><div class="galleryGrid ' + (category === 'menu' ? 'menuGallery' : '') + '">' + photos.map((photo, index) => photo.category !== category ? '' : '<figure><button data-open-photo="' + place.id + ',' + index + '" aria-label="' + escapeText(photo.caption) + ' 사진 크게 보기"><img referrerpolicy="no-referrer" src="' + escapeText(photo.file) + '" loading="lazy" alt="' + escapeText(place.name + ' · ' + photo.caption) + '"><span>확대 ' + icon('link') + '</span></button><figcaption>' + escapeText(photo.caption) + '</figcaption>' + externalLink(photo.source || place.source, escapeText(photoCredit(photo)) + ' ↗') + '</figure>').join('') + '</div></section>').join('');
  }
  function drawDetail() {
    const place = places.get(detailId);
    const isSight = place.type === 'stops';
    const details = [place.hours, place.phone].filter(Boolean);
    const missing = isSight ? '' : categories.filter(([category]) => category !== 'sight' && !(place.photos || []).some(photo => photo.category === category)).map(([, label]) => label);
    $('placePage').innerHTML = '<button class="backButton" data-back>' + icon('arrow') + '일정으로 돌아가기</button><div class="detailHeading"><span class="overline">코스 ' + routes[place.routeKey].letter + ' · ' + (isSight ? '관광지' : place.type === 'restaurants' ? '점심 식당' : '카페') + '</span><h1>' + escapeText(place.name) + '</h1><p>' + escapeText(place.desc) + '</p></div><div class="detailOverview"><div><h2>' + (isSight ? '방문 안내' : '추천 메뉴와 방문 안내') + '</h2>' + (place.menu ? '<p class="placemenu">' + escapeText(place.menu) + '</p>' + (place.menuNote ? '<p class="menuNote">' + escapeText(place.menuNote) + '</p>' : '') : '') + addressBlock(place) + (details.length ? '<p class="detailHours">' + escapeText(details.join(' · ')) + '</p>' : '') + '<div class="cardbuttons">' + (!isSight ? selectionButton(place) : '') + externalLink(place.source, '장소 안내 원문 ↗') + '</div></div><div class="detailPhotoLead">' + photoThumbnail(place, '', false) + '</div></div><div class="galleryIntro"><h2>' + (isSight ? '천천히 둘러볼 풍경' : '사진으로 미리 둘러보기') + '</h2><p>' + (isSight ? '전경과 산책 동선을 사진으로 확인해 보세요.' : '메뉴판은 촬영 당시 정보예요. 주문 전 매장에서 가격과 구성을 확인하세요.') + '</p>' + (missing.length ? '<p class="missingPhotos">' + escapeText(missing.join('·')) + ' 사진은 확인한 원문 자료가 부족합니다. 장소 안내 원문에서 최신 사진을 확인해 주세요.</p>' : '') + '</div><p class="galleryNotes">' + escapeText(place.galleryNotes || '') + '</p><div id="placeGallery">' + galleryContent(place) + '</div>';
  }
  function references(route) {
    $('sources').innerHTML = '<p>대구 출발·복귀 기준점은 서대구 IC입니다. 주행시간은 OpenStreetMap 도로망을 이용한 OSRM 자동차 경로 추정값이며 실시간 교통은 반영하지 않습니다. 왕복 장거리 구간마다 휴식·교통 여유 30분, 남해 안 이동마다 주차·승하차 여유 8분을 더해 5분 단위로 올렸습니다. 오전 산책 35분, 식사 60분, 카페 60분, 마지막 산책 25분으로 계산합니다.</p><p>' + externalLink(route.matrix.url, '도로거리·시간 원자료') + ' · ' + externalLink('https://www.openstreetmap.org/copyright', '© OpenStreetMap contributors') + '</p><p>사진마다 원문과 촬영자를 연결했습니다. 메뉴판·운영시간은 자료의 촬영·게시 시점에 따라 달라질 수 있어요. TMAP 버튼은 앱이 설치된 휴대폰에서 사용하는 연결입니다. 실제 휴대폰 앱 실행은 확인하지 못했습니다. 실내 좌석과 전망을 기준으로 카페를 골랐으며 온돌 좌석은 확인되지 않았습니다. 자료 확인 ' + escapeText(guide.checked) + '.</p><p>' + guide.credits.map(credit => externalLink(credit.url, escapeText(credit.label))).join(' · ') + '</p>';
  }
  function draw() {
    const route = routes[key];
    const itinerary = plan(route);
    const isDetail = Boolean(detailId);
    document.querySelectorAll('.hero,.choose,#guide').forEach(element => {element.hidden = isDetail;});
    $('placePage').hidden = !isDetail;
    routeHeader(route);
    if (isDetail) {
      drawDetail();
      document.title = places.get(detailId).name + ' · 사진과 방문 안내 | 남해 하루여행';
    } else {
      document.title = '남해 하루여행 | 서대구 IC에서 떠나는 당일치기';
      mapView?.destroy();
      const longest = Math.max(...itinerary.legs.slice(1, 4).map(segment => segment.minutes));
      $('panel').innerHTML = (tab === 'schedule' ? '<p class="navigationHint">주소를 복사하거나 TMAP 버튼으로 길찾기를 열 수 있어요. TMAP 앱이 설치된 휴대폰에서 이용해 주세요.</p><div class="summaryStrip"><span>' + icon('clock') + '서대구 IC 복귀 예상 <b>' + hour(itinerary.starts[5]) + '</b></span><span>' + icon('car') + '현지 최장 주행 <b>약 ' + longest + '분</b></span></div>' : '') + (tab === 'schedule' ? schedule(route, itinerary) : tab === 'map' ? mapShell('서대구 IC에서 남해까지 전체 경로', itinerary) : choices(route, itinerary, tab));
      if ($('travelMap')) mapView = window.renderTravelMap($('travelMap'), {stops: itinerary.visits, restaurants: route.restaurants, cafes: route.cafes, origin: itinerary.visits[0], onOpen: place => openPlace(place.id), navigationUrl: tmapUrl, wide: tab === 'map'});
    }
    references(route);
  }
  function openPlace(id) {
    if (!places.has(id)) return;
    if (!detailId) previousScroll = window.scrollY;
    detailId = id;
    key = places.get(id).routeKey;
    galleryFilter = 'all';
    syncUrl(true);
    draw();
    window.scrollTo({top: 0});
  }
  function closeDetail() {
    detailId = '';
    galleryFilter = 'all';
    syncUrl();
    draw();
    window.scrollTo({top: previousScroll});
  }
  function showPhoto(place, index) {
    photoList = place.photos;
    photoIndex = index;
    updatePhoto();
    $('lightbox').showModal();
  }
  function updatePhoto() {
    const photo = photoList[photoIndex];
    $('photoTitle').textContent = photo.caption;
    $('largePhoto').src = photo.file;
    $('largePhoto').alt = photo.caption;
    $('photoSource').href = photo.source;
    $('photoSource').textContent = photoCredit(photo) + ' ↗';
    $('photoCount').textContent = (photoIndex + 1) + ' / ' + photoList.length;
  }
  document.addEventListener('click', async event => {
    const control = event.target.closest('button,a[data-place]');
    if (!control) return;
    if (control.hasAttribute('data-back')) {closeDetail(); return;}
    if (control.dataset.place) {event.preventDefault(); openPlace(control.dataset.place); return;}
    if (control.dataset.route) {key = control.dataset.route; detailId = ''; tab = 'schedule'; syncUrl(); draw(); return;}
    if (control.dataset.tab) {tab = control.dataset.tab; syncUrl(); draw(); return;}
    if (control.dataset.select) {
      const place = places.get(control.dataset.select);
      key = place.routeKey;
      selections[key][place.type] = place.index;
      const scroll = window.scrollY;
      syncUrl();
      draw();
      window.scrollTo({top: scroll});
      announce(place.name + ' 선택됨');
      return;
    }
    if (control.dataset.copy) {
      const place = places.get(control.dataset.copy) || guide.origin;
      try {await navigator.clipboard.writeText(place.address); announce('주소를 복사했어요.');}
      catch {window.prompt('주소를 복사해 주세요.', place.address);}
      return;
    }
    if (control.dataset.galleryFilter) {galleryFilter = control.dataset.galleryFilter; $('placeGallery').innerHTML = galleryContent(places.get(detailId)); return;}
    if (control.dataset.openPhoto) {
      const [id, index] = control.dataset.openPhoto.split(',');
      showPhoto(places.get(id), Number(index));
    }
  });
  $('close').onclick = () => $('lightbox').close();
  $('previousPhoto').onclick = () => {photoIndex = (photoIndex + photoList.length - 1) % photoList.length; updatePhoto();};
  $('nextPhoto').onclick = () => {photoIndex = (photoIndex + 1) % photoList.length; updatePhoto();};
  $('lightbox').addEventListener('click', event => {if (event.target === $('lightbox')) $('lightbox').close();});
  $('lightbox').addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') $('previousPhoto').click();
    if (event.key === 'ArrowRight') $('nextPhoto').click();
  });
  $('share').onclick = async () => {
    syncUrl();
    try {
      if (navigator.share) {await navigator.share({title: document.title, url: location.href}); return;}
      await navigator.clipboard.writeText(location.href);
      announce('선택한 일정 링크를 복사했어요.');
    } catch (error) {if (error.name !== 'AbortError') window.prompt('아래 여행 링크를 복사해 주세요.', location.href);}
  };
  window.addEventListener('popstate', () => {readUrl(); galleryFilter = 'all'; draw();});
  $('heroImage').alt = guide.heroLabel;
  $('heroLoc').innerHTML = icon('pin') + escapeText(guide.heroLabel);
  readUrl();
  draw();
})();
