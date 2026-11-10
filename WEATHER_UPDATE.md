# 남해 여행 예보 갱신

웹앱은 https://blackgar.github.io/namhae-daybook/ 이다. 일기예보 데이터는 공개 GitHub blackgar/namhae-daybook 저장소의 weather-updates 브랜치 weather.json 한 파일에서 읽는다. 이 데이터 파일만 갱신한다. main 브랜치, 사이트 코드, 다른 자료는 변경하지 않는다. 공개 날씨 자료만 기록하고 비밀정보를 저장하지 않는다. 파일 접근과 쓰기는 연결된 GitHub 도구로 할 수 있으므로 로컬 컴퓨터·파일·브라우저가 필수 의존성이 되어서는 안 된다. 공개 기상청 자료를 검색/읽기로 수집하고, 브라우저가 가능한 환경이면 공식 지역 선택 화면을 읽어 보완한다.

## 시간과 범위
Asia/Seoul 기준 출발 후보는 2026-12-05 토요일과 2026-12-06 일요일이다. 조회·갱신 허용 구간은 2026-12-01 00:00 이상 2026-12-06 18:00 미만이다. 12월 6일 18시 및 이후 실행은 예보 조회·쓰기를 종료하고 조용히 마친다. 최종 화면은 자체적으로 갱신 종료를 표시하며 기존 기록을 보존한다.
12월 1일 이전에 수동 점검 실행을 요청받으면 forecast 데이터를 만들지 않고, weather.json을 읽어 last_attempt_at과 writer_verified_at만 실제 현재시각 ISO8601(+09:00)으로 갱신해 쓰기·읽기 연결을 점검한다. status는 scheduled, daily/hourly는 기존대로 보존한다. 아직 존재하지 않는 12월 예보를 채우지 않는다.

## 지역과 출처
A east는 남해군 삼동면(독일마을) 위도34.80004746 경도128.03834018, 행정동코드4884033000이다. B west는 남해군 설천면(노량항) 위도34.941501 경도127.8749885, 행정동코드4884038000이다.
기상청 공개 예보를 우선 사용한다.
- 공식 삼동면 지역 URL (지역명과 실제 표시 위치를 재확인) https://www.weather.go.kr/w/forecast/overall/short-term.do#dong/4884033000/34.827896/128.00314/%EA%B2%BD%EC%83%81%EB%82%A8%EB%8F%84%20%EB%82%A8%ED%95%B4%EA%B5%B0%20%EC%82%BC%EB%8F%99%EB%A9%B4/SEL/%EC%82%BC%EB%8F%99%EB%A9%B4
- https://www.weather.go.kr/w/forecast/overall/short-term.do 의 지역 선택에서 경상남도→남해군→삼동면 또는 설천면을 선택한다. hash를 무시하는 정적 조회는 서울 자료를 반환할 수 있으므로 반드시 본문의 지역을 대조한다.
- 중기 일별 최저·최고는 https://www.weather.go.kr/w/forecast/overall/mid-term.do?stnId1=159&stnId2=143 의 남해 행과 정확한 날짜 열을 확인한다. 육상 날씨·강수확률은 부산·울산·경남의 해당 예보구역인지 확인한다. 남해군 대표 중기 자료만 있을 때는 source_area에 '남해군 대표 중기예보'라고 표시하고 세부 면의 정밀 예보로 주장하지 않는다.
- 공식 안내 https://www.kma.go.kr/kma/biz/forecast02.jsp 및 단기 서비스 개선 공지 https://apihub.kma.go.kr/getAttachFile.do?fileName=%2820241128%29%EB%8B%A8%EA%B8%B0%EC%98%88%EB%B3%B4+%EC%84%9C%EB%B9%84%EC%8A%A4+%EA%B0%9C%EC%84%A0%EC%97%90+%EB%94%B0%EB%A5%B8+API+%EB%B3%80%EA%B2%BD%EC%82%AC%ED%95%AD.pdf 를 참고한다. 단기 최대+5일, 먼 구간은3시간 해상도일 수 있으므로 매시간 값이 없으면 보간하지 않는다. RSS는2025-03-31종료되어 사용하지 않는다.
공식 링크가 바뀌면 weather.go.kr/kma.go.kr 도메인 검색으로 현재 원문을 찾는다. 오래된 검색 캐시, 다른 지역, 다른 달의 같은 일자를 2026년12월 예보로 오인하지 않는다. 확인할 수 없는 값은 null이며 빈 항목을 0으로 채우지 않는다. 강수확률과 강수량을 구분한다. 원문에 '~1mm', '1mm미만' 등 범위가 있으면 precipitation_text로 보존한다. 체감온도를 임의 계산하지 않는다.

## JSON 계약(schema_version1)
기존 weather.json을 먼저 읽고 현재 blob sha를 확보한다. timezone은 Asia/Seoul, start_at/stop_at과 두 지역의 name/lat/lng를 보존한다.
- status는 scheduled/ok/partial/unavailable 중 하나. message에는 실제 확인한 상태를 짧게 쓴다. last_attempt_at은 모든 시도시각, last_success_at은 최신 자료를 실제로 확인한 시각, updated_at은 데이터 변경시각이다. 조회 실패를 성공시각으로 기록하지 않는다.
- locations.east와 locations.west는 {name,lat,lng,source_area,daily:[],hourly:[]}.
- daily 항목은 {date:'2026-12-05',weather:문자열|null,am_weather:문자열|null,pm_weather:문자열|null,low:숫자|null,high:숫자|null,rain_probability:숫자|null,am_rain_probability:숫자|null,pm_rain_probability:숫자|null,source_url:검증한httpsURL,issued_at:발표시각ISO|null}. 날짜는2026-12-01~06이며 출발후보5/6을 우선 채운다. 오전/오후 확률만 있는 경우 rain_probability는 null로 두어도 된다. 낮은 기온은 섭씨, 바람 m/s, 확률0~100, 강수량mm, 습도0~100이다.
- hourly 항목은 {time:'2026-12-05T08:00:00+09:00',weather:문자열|null,temperature:숫자|null,feels_like:숫자|null,rain_probability:숫자|null,precipitation_mm:숫자|null,precipitation_text:문자열|null,wind_ms:숫자|null,humidity:숫자|null,source_url:검증한httpsURL,issued_at:발표시각ISO|null}. 12/5·6의 실제 발표된 시간만 기록한다. 여행시간08~18시 우선, 가능한 전체24시간을 포함한다. 웹앱은 각 후보일 전날부터 시간별 표를 공개한다.
- sources는 [{name:'기상청 남해 예보',url:검증한공식httpsURL,issued_at:발표시각ISO|null,retrieved_at:조회시각ISO,area:실제자료지역}].
발표시각을 조회시각으로 조작하지 않는다. 두 시각이 다르면 각각 실제값을 쓴다. 예보가 아직 없으면 scheduled 또는 partial로 대기한다. 특정 필드/지역만 실패하면 검증된 새 항목은 반영하고 기존의 더 최신 자료를 보존한다. 전체 수집 실패시 기존 daily/hourly/sources와 last_success_at을 보존하고 status unavailable, last_attempt_at과 오류 요지를 기록한다. 성공 데이터가 아닌데 최신 예보라고 알리지 않는다.

## 쓰기와 검증
기존 daily는 날짜, hourly는 time 기준으로 병합해 같은 시점 항목을 중복하지 않는다. 이미 지난 날짜의 마지막 예보는 보존하고 과거 관측값으로 바꾸지 않는다. 다른 실행이 기록한 더 최신 issued_at을 오래된 예보로 덮어쓰지 않는다.
GitHub update_file을 repository_full_name blackgar/namhae-daybook, branch weather-updates, path weather.json, sha는 방금 fetch_file에서 받은 현재 blob sha, content는 완전한 JSON 문자열로 호출한다. 충돌이면 한번 다시 읽고 최신 자료와 병합해 재시도한다. 실패한 동일 요청을 무한 반복하지 않는다. 소스 코드 배포나 main push는 필요 없다. 완료 후 같은 브랜치 파일을 다시 읽어 지역·예보 날짜·시각·자료 값이 쓰인 것과 일치하는지 확인한다. 파일 읽기/쓰기가 거부되면 성공을 주장하지 않는다.
성공하면 웹앱 데이터만 갱신하고 별도 정기 채팅 알림은 생략한다. 지속적인 수집·저장 실패가 있어 사용자의 조치가 필요한 경우에만 이 채팅에 짧게 원인을 알린다. 이메일이나 Slack은 사용하지 않는다.
