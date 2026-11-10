/* Local geography: Statistics Korea municipal boundaries and MOLIT national road centerlines. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const base = window.travelMapBase;
  if (!base) return;
  const bounds = points => points.reduce((a,p) => [Math.min(a[0],p[0]),Math.min(a[1],p[1]),Math.max(a[2],p[0]),Math.max(a[3],p[1])], [Infinity,Infinity,-Infinity,-Infinity]);
  const pack = lines => lines.map(points => ({points, box:bounds(points)}));
  const land = pack(base.land);
  const roads = pack(base.roads);
  const activeMaps = new WeakMap();
  const overlaps = (a,b) => a[0]<=b[2] && a[1]<=b[3] && a[2]>=b[0] && a[3]>=b[1];
  const valid = p => p && p.lat != null && p.lng != null && Number.isFinite(+p.lat) && Number.isFinite(+p.lng);
  const point = p => [+p.lng,+p.lat];
  const isLocal = p => +p.lng>=127.55 && +p.lng<=128.38 && +p.lat>=34.52 && +p.lat<=35.13;
  const clean = n => String(n).replace(/\s+/g,'');
  const el = (tag,cls,txt) => {const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;};
  const svg = (tag,attrs,txt) => {const e=document.createElementNS(NS,tag);Object.entries(attrs||{}).forEach(([k,v])=>e.setAttribute(k,String(v)));if(txt!=null)e.textContent=txt;return e;};
  const types = {sight:'관광',food:'식당',cafe:'카페',start:'출발'};
  const cols = {sight:'#176454',food:'#aa542d',cafe:'#715182',start:'#354b68'};
  function distance(a,b) {return Math.hypot((a[0]-b[0])*91,(a[1]-b[1])*111);}
  function roadFor(a,b) {
    let nearest = null, best = Infinity;
    for (const r of window.travelRoadRoutes || []) {
      if (!r.from || !r.to || !r.line?.length) continue;
      for (const reverse of [false,true]) {
        const d1=distance(a,reverse?r.to:r.from), d2=distance(b,reverse?r.from:r.to);
        const score=d1+d2+(reverse?.0001:0);
        if (Math.max(d1,d2) <= .52 && score < best) {
          nearest=reverse ? r.line.slice().reverse() : r.line; best=score;
        }
      }
    }
    return nearest;
  }
  function renderTravelMap(container,data) {
    if(typeof container==='string')container=document.querySelector(container);
    if(!container)return;
    activeMaps.get(container)?.disconnect();
    container.replaceChildren();
    const places = [], byName=new Map();
    const stops=(data?.stops||[]).filter(valid);
    const foods=(data?.restaurants||[]).filter(valid), cafes=(data?.cafes||[]).filter(valid);
    function add(p,type,number) {
      const key=clean(p.name);
      if(byName.has(key))return byName.get(key);
      const v={...p,type,number,xy:point(p)}; places.push(v);byName.set(key,v);return v;
    }
    let seq=0;
    function getType(p) {
      if(foods.some(x=>clean(x.name)===clean(p.name))||['food','restaurant','meal','lunch','식당'].includes(p.kind))return 'food';
      if(cafes.some(x=>clean(x.name)===clean(p.name))||['cafe','coffee','카페'].includes(p.kind))return 'cafe';
      return isLocal(p)?'sight':'start';
    }
    const itinerary=stops.map(p=>add(p,getType(p),isLocal(p)?++seq:null));
    foods.forEach(p=>add(p,'food',null));cafes.forEach(p=>add(p,'cafe',null));
    if (!places.length) {container.append(el('p','','장소 좌표를 확인하는 중입니다.'));return;}
    const locals=places.filter(isLocal);
    const first=itinerary.find(isLocal)||locals[0]||places[0];
    let origin=itinerary.find(p=>!isLocal(p));
    if(!origin&&data.origin&&valid(data.origin))origin=add(data.origin,'start',null);
    if(!origin)origin=add({name:'서대구IC',lat:35.8779,lng:128.5310306},'start',null);
    let wide=Boolean(data.wide),zoom=1,center=null,selected=first,observer;
    const wrap=el('div','nm-map'), top=el('div','nm-controls'), region=el('div','nm-modes');
    const localBtn=el('button','','남해 상세'), wideBtn=el('button','','대구 왕복');
    for(const b of [localBtn,wideBtn]) {b.type='button';region.append(b);}
    top.append(region);
    const frame=el('div','nm-frame');
    const geo=svg('svg',{role:'group','aria-label':'남해 여행 일정 지도'});
    const zpanel=el('div','nm-zoom');
    for(const [label,sign] of [['확대',1],['축소',-1]]) {
      const btn=el('button','',sign===1?'+':'−'); btn.type='button';btn.setAttribute('aria-label','지도 '+label);
      btn.onclick=()=>{const next=Math.min(14,Math.max(1,zoom*(sign>0?1.7:1/1.7)));if(next===zoom)return;zoom=next;center=zoom===1?null:(wide?center:(selected && isLocal(selected)?selected.xy:center));draw();};zpanel.append(btn);
    }
    const compass=el('span','nm-north','▲ N');
    frame.append(geo,zpanel,compass);
    const legend=el('div','nm-legend');for(const [k,label] of [['sight','관광'],['food','식당'],['cafe','카페']]){let l=el('span','',label),i=el('i');i.style.background=cols[k];l.prepend(i);legend.append(l);}
    const lineNote=el('span','nm-line-note');legend.append(lineNote);
    const location=el('div','nm-location'), choose=el('select','nm-picker');
    choose.setAttribute('aria-label','지도에서 확인할 장소');
    places.forEach((p,i)=>{const opt=el('option','',(p.number?p.number+'. ':'')+p.name+' · '+types[p.type]);opt.value=String(i);choose.append(opt);});
    const link=el('a','nm-nav','TMAP ↗');link.setAttribute('title','TMAP이 설치된 휴대폰에서 열기');
    location.append(choose,link);
    const credit=el('div','nm-credit');credit.append(document.createTextNode('지도 자료 '));
    for(const [i,name,href] of [[0,'통계청 행정경계','https://github.com/southkorea/southkorea-maps'],[1,'국토교통부 일반국도','https://www.data.go.kr/data/15122482/fileData.do'],[2,'© OpenStreetMap contributors','https://www.openstreetmap.org/copyright']]){if(i)credit.append(document.createTextNode(' · '));const a=el('a','',name);a.href=href;a.rel='noopener noreferrer';a.target='_blank';credit.append(a);}
    const summary=el('div','nm-placeSummary'), legLegend=el('div','nm-legs');
    wrap.append(top,frame,legend,location,summary,legLegend,credit);container.append(wrap);
    function select(p,move=false) {
      selected=p;choose.value=String(places.indexOf(p));
      link.href=data.navigationUrl ? data.navigationUrl(p) : 'https://map.kakao.com/link/to/'+encodeURIComponent(p.name)+','+p.lat+','+p.lng;
      link.setAttribute('aria-label',p.name+' TMAP 앱에서 열기');
      summary.replaceChildren();
      const photo=p.photos?.[0];
      if(photo){const img=el('img');img.referrerPolicy='no-referrer';img.src=photo.file;img.alt=p.name+' · '+photo.caption;img.loading='lazy';summary.append(img);}
      const text=el('div');
      if(p.id&&data.onOpen){
        const detail=el('button','placeTitle');detail.type='button';
        detail.setAttribute('aria-label',p.name+' 사진·상세 페이지 열기');
        detail.append(el('strong','placeName',p.name),el('span','placeLinkHint','사진·상세 보기 →'));
        detail.onclick=()=>data.onOpen(p);text.append(detail);
      }else{text.append(el('strong','',p.name));}
      if(p.address)text.append(el('p','',p.address));
      summary.append(text);
      if(move){if(!isLocal(p)&&!wide){wide=true;zoom=1;center=null;}else if(isLocal(p)&&wide){wide=false;zoom=1;center=null;}else if(zoom>1){center=p.xy;}}
      draw();
    }
    choose.onchange=()=>select(places[+choose.value],true);
    function changeMode(mode){wide=mode;zoom=1;center=null;draw();}
    localBtn.onclick=()=>changeMode(false);wideBtn.onclick=()=>changeMode(true);
    function draw(){
      const w=Math.max(230,Math.round(frame.clientWidth||580)), h=Math.max(265,Math.min(400,Math.round(w*.59)));
      geo.setAttribute('viewBox','0 0 '+w+' '+h);geo.setAttribute('height',h);
      localBtn.setAttribute('aria-pressed',String(!wide)); wideBtn.setAttribute('aria-pressed',String(wide));
      const viewPlaces=wide?[origin,...(locals.length?locals:places)]:locals.length?locals:places;
      let ordered=wide?itinerary:itinerary.filter(isLocal);
      if(wide){if(!ordered.length||isLocal(ordered[0]))ordered=[origin,...ordered];if(isLocal(ordered.at(-1)))ordered=[...ordered,origin];}
      const segments=[];
      const legColors=['#236d9c','#a96831','#806090','#25856a','#4962a2'];
      legLegend.replaceChildren();
      for(let i=1;i<ordered.length;i++){
        const a=ordered[i-1].xy,b=ordered[i].xy;if(distance(a,b)<.01)continue;
        const road=roadFor(a,b);const number=wide?i:i+1;
        segments.push({road:!!road,points:road||[a,b],number,color:legColors[number-1]||legColors[0]});
        const legLabel=el('span','',number+' · '+ordered[i-1].name+' → '+ordered[i].name);legLabel.style.color=legColors[number-1]||legColors[0];legLegend.append(legLabel);
      }
      let [xmin,ymin,xmax,ymax]=bounds(viewPlaces.map(p=>p.xy).concat(segments.flatMap(s=>s.points)));
      const mid=center||[(xmin+xmax)/2,(ymin+ymax)/2];
      const xFactor=Math.cos(mid[1]*Math.PI/180);
      const minimum=wide?.55:.028;
      const sx=(w-76)/(Math.max(minimum,xmax-xmin)*xFactor),sy=(h-86)/(Math.max(minimum*.58,ymax-ymin));
      const scale=Math.min(sx,sy)*zoom;
      const proj=([x,y])=>[(x-mid[0])*xFactor*scale+w/2,(mid[1]-y)*scale+h/2];
      const inv=(x,y)=>[(x-w/2)/scale/xFactor+mid[0],mid[1]-(y-h/2)/scale];
      const box=[...inv(0,h),...inv(w,0)];
      const drawPath=(p,closed=false)=>p.map((z,i)=>{let [x,y]=proj(z);return(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1);}).join('')+(closed?'Z':'');
      geo.replaceChildren();
      const features=svg('g',{'aria-hidden':'true'});geo.append(features);
      features.append(svg('path',{d:land.filter(o=>overlaps(o.box,box)).map(o=>drawPath(o.points,true)).join(''),class:'nm-land'}));
      if(!wide)features.append(svg('path',{d:roads.filter(o=>overlaps(o.box,box)).map(o=>drawPath(o.points)).join(''),class:'nm-roads'}));
      const labels=wide?[['진주시',128.08,35.18],['합천군',128.15,35.56],['창원시',128.64,35.23],['남해',127.95,34.69]]:base.towns;
      for(const [text,x,y] of labels){let [xx,yy]=proj([x,y]);if(xx<24||xx>w-24||yy<20||yy>h-13)continue;features.append(svg('text',{x:xx,y:yy,class:'nm-town','text-anchor':'middle'},text));}
      let real=false,sequence=false;
      for(const s of segments){
        if(s.road)real=true;else sequence=true;
        features.append(svg('path',{d:drawPath(s.points),class:s.road?'nm-route real':'nm-route seq',style:'stroke:'+s.color}));
        if(s.points.length>1){const mid=Math.floor((s.points.length-1)*.55),a=proj(s.points[mid]),b=proj(s.points[Math.min(mid+1,s.points.length-1)]);
          const angle=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
          features.append(svg('path',{d:'M-6 -4 L1 0 L-6 4',transform:'translate('+b[0]+' '+b[1]+') rotate('+angle+')',fill:'none',stroke:s.color,'stroke-width':2.5,'stroke-linejoin':'round'}));}
      }
      lineNote.textContent=[real?'실선 · 도로 경로':'',sequence?'점선 · 방문 순서':''].filter(Boolean).join(' / ');
      const visible=wide&&zoom<2?[origin,first]:viewPlaces;
      const spots=visible.map(p=>{const q=proj(p.xy);return {p,x:q[0],y:q[1],px:q[0],py:q[1]};}).filter(s=>s.x>-14&&s.y>-14&&s.x<w+14&&s.y<h+14);
      // Keep nearby alternatives independently tappable. Hairlines retain their geographic anchor.
      for(let step=0;step<75;step++){
        let moved=false;
        for(let i=0;i<spots.length;i++)for(let j=i+1;j<spots.length;j++){
          const a=spots[i],b=spots[j];let dx=b.px-a.px,dy=b.py-a.py,d=Math.hypot(dx,dy);
          if(d>=30)continue;if(d<.001){dx=.62;dy=.78;d=1;}let push=(30-d)*.51;
          a.px-=push*dx/d;a.py-=push*dy/d;b.px+=push*dx/d;b.py+=push*dy/d;moved=true;
        }
        for(const a of spots){a.px=Math.min(w-17,Math.max(17,a.px));a.py=Math.min(h-17,Math.max(17,a.py));}
        if(!moved)break;
      }
      spots.forEach(s=>{if(Math.hypot(s.px-s.x,s.py-s.y)>3){features.append(svg('line',{x1:s.x,y1:s.y,x2:s.px,y2:s.py,class:'nm-leader'}));features.append(svg('circle',{cx:s.x,cy:s.y,r:2,fill:'#56685d'}));}});
      spots.sort((a,b)=>Number(a.p===selected)-Number(b.p===selected)).forEach(({p,px,py})=>{
        const group=svg('g',{transform:'translate('+px.toFixed(2)+' '+py.toFixed(2)+')',class:'nm-pin',role:'button',tabindex:0,'aria-label':p.name+' '+types[p.type],'aria-pressed':p===selected});
        const mini=wide&&zoom<2;
        group.append(svg('title',{},mini&&isLocal(p)?'남해 일정 상세 보기':p.name));
        group.append(svg('circle',{r:16,fill:'transparent'}));
        if(p===selected)group.append(svg('circle',{r:15.7,fill:'none',stroke:cols[p.type],'stroke-width':1.6}));
        group.append(svg('circle',{r:12.7,fill:cols[p.type],stroke:'#fff','stroke-width':2}));
        const symbol=mini?(isLocal(p)?'남':'대'):(p.number||({food:'식',cafe:'차',sight:'●',start:'대'}[p.type]));
        group.append(svg('text',{x:0,y:4.4,'text-anchor':'middle',class:'nm-pintext'},symbol));
        if(mini){let tx=px>w*.64?-18:18; group.append(svg('text',{x:tx,y:4,'text-anchor':tx<0?'end':'start',class:'nm-rlabel'},isLocal(p)?'남해':'대구'));}
        const hit=()=>{if(mini&&isLocal(p)){wide=false;zoom=1;center=null;}select(p);};
        group.addEventListener('click',hit);group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();hit();choose.focus();}});
        geo.append(group);
      });
      const km=scale/111;
      const bar=([.1,.25,.5,1,2,5,10,20,50,100].filter(n=>n*km<w*.17).at(-1)||.1);
      const length=bar*km;
      const sc=svg('g',{'aria-hidden':'true'});sc.append(svg('path',{d:'M12 '+(h-15)+'v4h'+length.toFixed(2)+'v-4',class:'nm-scale'}));
      sc.append(svg('text',{x:12,y:h-19,class:'nm-scale-label'},bar<1?(bar*1000)+' m':bar+' km'));
      geo.append(sc);
    }
    select(first);
    if(typeof ResizeObserver!=='undefined'){
      let last=0;observer=new ResizeObserver(()=>{if(!container.isConnected){observer.disconnect();return;}if(frame.clientWidth!==last){last=frame.clientWidth;draw();}});observer.observe(frame);activeMaps.set(container,observer);
    }
    return {focus(name){const p=byName.get(clean(name));if(p)select(p,true);},destroy(){observer?.disconnect();container.replaceChildren();}};
  }
  window.renderTravelMap=renderTravelMap;
})();
