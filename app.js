(() => {
  'use strict';
  const guide = window.namhaeGuide;
  const routes = guide.routes;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const icon = id => '<svg class="ico" aria-hidden="true"><use href="#'+id+'"/></svg>';
  const ext = (url,label,cls='extra') => '<a class="'+cls+'" target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+label+'</a>';
  const params = new URLSearchParams(location.search);
  const indexValue = (value,len) => {const n = Number(value); return Number.isInteger(n) && n>=0 && n<len ? n : 0;};
  const tabs = [['schedule','일정표','clock'],['restaurants','식당','food'],['cafes','카페','cup'],['map','지도','map']];
  const routeKeys = Object.keys(routes);
  let key = routeKeys.includes(params.get('course')) ? params.get('course') : routeKeys[0];
  let tab = tabs.some(([id])=>id===params.get('view')) ? params.get('view') : 'schedule';
  const selections = Object.fromEntries(routeKeys.map(k=>[k,{restaurants:0,cafes:0}]));
  selections[key].restaurants = indexValue(params.get('meal'),routes[key].restaurants.length);
  selections[key].cafes = indexValue(params.get('cafe'),routes[key].cafes.length);
  const hour = m => String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  const round5 = m => Math.ceil(m/5)*5;
  const duration = m => m>=60 ? Math.floor(m/60)+'시간'+(m%60?' '+m%60+'분':'') : m+'분';
  const nav = p => 'https://map.kakao.com/link/to/'+encodeURIComponent(p.name)+','+p.lat+','+p.lng;
  const geoDistance = (a,b) => (a.lat-b.lat)**2 + ((a.lng-b.lng)*.82)**2;
  function leg(a,b,r) {
    const matrix=r.matrix;
    const idx=p=>matrix.places.map(v=>geoDistance(p,v)).reduce((best,n,i,arr)=>n<arr[best]?i:best,0);
    const i=idx(a), j=idx(b);
    return {minutes:Math.max(1,Math.round(matrix.durations[i][j]/60)),km:Math.round(matrix.distances[i][j]/100)/10};
  }
  const roadText = l => l.km.toFixed(1)+'km · 주행 약 '+duration(l.minutes);
  function plan(r) {
    const food=r.restaurants[selections[key].restaurants], cafe=r.cafes[selections[key].cafes];
    const visits=[r.matrix.places[0],r.stops[0],food,cafe,r.stops[1],r.matrix.places[0]];
    const legs=visits.slice(1).map((v,i)=>leg(visits[i],v,r));
    const starts=[480],stays=[0,35,60,60,25];
    for(let i=0;i<5;i++) {
      const allowance=i===0||i===4 ? 30 : 8;
      starts.push(round5(starts[i]+stays[i]+legs[i].minutes+allowance));
    }
    return {visits,legs,starts,stays,food,cafe};
  }
  function syncUrl() {
    const url=new URL(location.href);url.search='';url.hash='';
    url.searchParams.set('course',key);
    if(tab!=='schedule')url.searchParams.set('view',tab);
    if(selections[key].restaurants)url.searchParams.set('meal',selections[key].restaurants);
    if(selections[key].cafes)url.searchParams.set('cafe',selections[key].cafes);
    history.replaceState(null,'',url);
  }
  function announce(msg) {
    $('toast').textContent=msg;$('toast').classList.add('visible');
    clearTimeout(announce.timer);announce.timer=setTimeout(()=>$('toast').classList.remove('visible'),2000);
  }
  function updateRoute(k) {key=k;tab='schedule';syncUrl();draw();}
  function changeTab(t,scroll=false) {tab=t;syncUrl();draw();if(scroll)$('guide').scrollIntoView({block:'start'});}
  function routeHeader(r) {
    $('routes').innerHTML=routeKeys.map(k=>{
      const x=routes[k],active=k===key;
      return '<button type="button" class="route" data-route="'+k+'" aria-pressed="'+active+'"><img src="'+esc(x.thumbnail)+'" alt=""><span class="routeText"><small>코스 '+esc(x.letter)+'</small><strong>'+esc(x.short)+'</strong><span class="blurb">'+esc(x.shortDesc)+'</span></span><span class="circle">'+(active?icon('check'):'')+'</span></button>';
    }).join('');
    $('courseNumber').textContent='코스 '+r.letter+' · '+r.region;
    $('guideTitle').textContent=r.heading;
    $('guideIntro').textContent=r.intro;
    $('tabs').innerHTML=tabs.map(([id,name,ic])=>'<button type="button" class="tab '+(tab===id?'active':'')+'" data-tab="'+id+'" aria-pressed="'+(tab===id)+'">'+icon(ic)+name+(Array.isArray(r[id])?'<small>'+r[id].length+'</small>':'')+'</button>').join('');
  }
  function schedule(r,p) {
    const rows=p.visits.map((v,i)=>{
      const switchType=i===2?'restaurants':i===3?'cafes':'';
      const detail=[
        '대구시청 동인청사 기준. 중간에 휴게소에서 한 번 쉬어 가세요.',
        r.stops[0].desc,
        p.food.menu+' · 식사 60분',
        p.cafe.menu+' · 실내에서 쉬어 가는 시간 60분',
        r.stops[1].desc,
        '대구시청 동인청사 도착 예상. 집까지의 이동시간은 별도예요.'
      ][i];
      const name=['대구 출발',v.name,'점심 · '+v.name,'카페 · '+v.name,v.name,'대구 도착 예정'][i];
      const placeLink=(i===1||i===4)?' · '+ext(nav(v),'길찾기 ↗'):'';
      const after=i<5?'<div class="move">'+icon('car')+'<span>'+(i===4?hour(p.starts[i]+p.stays[i])+' 남해 출발 · ':'')+roadText(p.legs[i])+'</span></div>':'';
      return '<li><time>'+hour(p.starts[i])+'</time><span class="dot"></span><div class="stoprow"><div class="timelineTitle">'+esc(name)+'</div><p>'+esc(detail)+placeLink+(switchType?' · <button class="switch" data-tab="'+switchType+'">변경</button>':'')+'</p>'+after+'</div></li>';
    }).join('');
    return '<div class="schedGrid"><section class="surface"><div class="subhead"><h3>하루 일정</h3><span>08:00 – '+hour(p.starts[5])+'</span></div><ol class="timeline">'+rows+'</ol><div class="note"><strong>귀가 시간 맞추기</strong> '+esc(r.tip)+' 주말 정체 때는 마지막 산책을 줄이고 출발하세요.</div></section><div><section class="surface mapcard"><div class="maptop"><h3>'+icon('map')+'여행 동선</h3></div><div id="travelMap"></div></section><div class="mininav"><button class="quick" data-tab="restaurants">'+icon('food')+'식당 고르기'+icon('arrow')+'</button><button class="quick" data-tab="cafes">'+icon('cup')+'카페 고르기'+icon('arrow')+'</button></div></div></div>';
  }
  function photos(v,type,i) {
    if(!v.photos?.length)return '';
    return '<div class="photopair">'+v.photos.map((img,j)=>'<button class="photofig" data-photo="'+[type,i,j].join(',')+'" aria-label="'+esc(v.name+' '+img.caption+' 사진 크게 보기')+'"><img src="'+esc(img.file)+'" loading="lazy" alt="'+esc(v.name+' · '+img.caption)+'"><span>'+esc(img.caption)+'</span></button>').join('')+'</div>';
  }
  function choices(r,p,type) {
    const isFood=type==='restaurants';
    const intro=isFood?'음식과 매장 사진을 눌러 크게 보세요. 한 곳을 고르면 점심과 다음 카페까지의 이동시간이 바뀝니다.':'실내 좌석이 있고 전망을 즐길 수 있는 카페예요. 온돌 좌석은 확인되지 않았어요. 따뜻한 자리나 창가 좌석이 중요하면 방문 전에 전화해 보세요.';
    return '<p class="placeLead">'+intro+'</p><div class="places '+(isFood?'':'cafeGrid')+'">'+r[type].map((v,i)=>{
      const selected=selections[key][type]===i;
      const before=isFood?r.stops[0]:p.food,after=isFood?p.cafe:r.stops[1];
      const localLeg=[leg(before,v,r),leg(v,after,r)];
      const note=[v.notes,v.hours,v.phone].filter(Boolean).map(esc).join(' · ');
      return '<article class="surface place '+(v.photos?.length?'':'noimg')+'">'+photos(v,type,i)+'<div class="placeinfo"><span class="tag">'+icon(isFood?'food':'cup')+(isFood?'점심 후보':'실내 전망 카페')+' '+(i+1)+'</span><h3>'+esc(v.name)+'</h3><p class="placemenu">'+esc(v.menu)+'</p><p class="placedesc">'+esc(v.desc)+'</p><div class="placeMeta">'+icon('pin')+esc(v.address)+'</div><p class="placeDrive">'+esc(before.name)+' → 여기 약 '+localLeg[0].minutes+'분 · 여기 → '+esc(after.name)+' 약 '+localLeg[1].minutes+'분</p>'+(note?'<p class="detailNote">'+note+'</p>':'')+'<div class="cardbuttons"><button class="sel '+(selected?'chosen':'')+'" data-select="'+type+','+i+'" aria-pressed="'+selected+'">'+icon(selected?'check':'pin')+(selected?'일정에 선택됨':'내 일정에 담기')+'</button>'+ext(nav(v),icon('map')+'길찾기','action')+ext(v.source,'장소 정보 ↗')+'</div></div></article>';
    }).join('')+'</div>';
  }
  function references(r) {
    const entries=[...r.stops,...r.restaurants,...r.cafes];
    const links=entries.map(v=>ext(v.source,esc(v.name))).join(' · ');
    $('sources').innerHTML='<p>대구 출발·복귀 기준점은 대구시청 동인청사입니다. 표의 주행시간은 OpenStreetMap 도로망을 이용한 OSRM 자동차 경로 추정값이며 실시간 교통은 반영하지 않습니다. 일정표는 왕복 장거리 구간에 각각 30분, 남해 안 이동에 각각 8분을 더해 5분 단위로 올렸습니다. 머무는 시간은 오전 산책 35분, 식사 60분, 카페 60분, 마지막 산책 25분입니다.</p><p>50~60대 연령별 이용 순위는 확인되지 않아 식사 형태, 실내 좌석, 경사와 이동 부담을 기준으로 골랐습니다. 메뉴·휴무·재료 수급은 달라질 수 있어요.</p><p>'+ext(r.matrix.url,'선택 코스 도로거리·시간 원자료')+' · '+ext('https://www.openstreetmap.org/copyright','© OpenStreetMap contributors')+' · '+ext('https://www.rome2rio.com/s/Daegu/Namhae-German-Village','대구–독일마을 경로 참고')+'</p><p>'+links+'</p><p>'+guide.credits.map(c=>ext(c.url,esc(c.label))).join(' · ')+'</p><p>식당 사진은 각 사진의 확대 화면에 원문 출처를 표시했습니다. 자료 확인 '+esc(guide.checked)+'.</p>';
  }
  function draw() {
    const r=routes[key],p=plan(r);
    routeHeader(r);
    const longest=Math.max(...p.legs.slice(1,4).map(l=>l.minutes));
    $('panel').innerHTML=(tab==='schedule'?'<div class="summaryStrip"><span>'+icon('clock')+'대구 도착 예상 <b>'+hour(p.starts[5])+'</b></span><span>'+icon('car')+'현지 최장 주행 <b>약 '+longest+'분</b></span></div>':'')+(tab==='schedule'?schedule(r,p):tab==='map'?'<section class="surface mapfull"><div class="maptop"><h3>'+icon('map')+'전체 일정 지도</h3></div><div id="travelMap"></div></section>':choices(r,p,tab));
    const map=$('travelMap');
    if(map && window.renderTravelMap)window.renderTravelMap(map,{stops:p.visits,restaurants:r.restaurants,cafes:r.cafes});
    references(r);
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.route){updateRoute(b.dataset.route);return;}
    if(b.dataset.tab){changeTab(b.dataset.tab,!b.classList.contains('tab'));return;}
    if(b.dataset.select){const [type,val]=b.dataset.select.split(',');selections[key][type]=Number(val);syncUrl();draw();announce(routes[key][type][Number(val)].name+' 선택됨');document.querySelector('[data-select="'+type+','+val+'"]')?.focus({preventScroll:true});return;}
    if(b.dataset.photo){const [type,i,j]=b.dataset.photo.split(',');const v=routes[key][type][i],img=v.photos[j];$('photoTitle').textContent=v.name+' · '+img.caption;$('largePhoto').src=img.file;$('largePhoto').alt=$('photoTitle').textContent;$('photoSource').href=img.source||v.source;$('lightbox').showModal();}
  });
  $('close').onclick=()=>$('lightbox').close();$('lightbox').addEventListener('click',e=>{if(e.target===$('lightbox'))$('lightbox').close();});
  $('share').onclick=async()=>{
    syncUrl();
    try{if(navigator.share){await navigator.share({title:'남해 하루여행',url:location.href});return;}await navigator.clipboard.writeText(location.href);announce('선택한 일정 링크를 복사했어요.');}
    catch(e){if(e.name!=='AbortError')window.prompt('아래 여행 링크를 복사해 주세요.',location.href);}
  };
  $('heroImage').alt=guide.heroLabel;
  $('heroLoc').innerHTML=icon('pin')+esc(guide.heroLabel);
  draw();
})();
