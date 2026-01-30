const { chromium } = require('playwright');

async function runMoltbot() {
  // 1. 브라우저 실행 (화면이 보이지 않는 모드)
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    // 2. 트렌드 키워드 수집 (TrendWidget)
    console.log("시작: TrendWidget에서 1위 키워드 수집 중...");
    await page.goto('https://www.trendwidget.app/app', { waitUntil: 'networkidle' });
    
    // 1위 키워드 추출 (사이트 구조에 따라 셀렉터는 변경될 수 있음)
    const hotKeyword = await page.evaluate(() => {
      const firstItem = document.querySelector('.keyword-list-item'); // 예시 셀렉터
      return firstItem ? firstItem.innerText.split('\n')[0] : '오늘의 핫 이슈';
    });
    console.log(`현재 1위 키워드: ${hotKeyword}`);

    // 3. 네이버 로그인
    console.log("네이버 로그인 시도 중...");
    await page.goto('https://nid.naver.com/nidlogin.login');
    await page.fill('#id', process.env.NAVER_ID);
    await page.fill('#pw', process.env.NAVER_PW);
    await page.click('.btn_login');
    await page.waitForTimeout(3000);

    // 4. 블로그 글쓰기 페이지 진입 (전달해주신 URL 활용)
    console.log("블로그 에디터 진입...");
    await page.goto(`https://blog.naver.com/${process.env.NAVER_ID}?Redirect=Write&categoryNo=1`);
    await page.waitForTimeout(5000); // 에디터 로딩 대기

    // 5. 글 작성 (몰트 봇의 '에이전트'다운 동작)
    // 네이버 에디터는 iframe 내부나 복잡한 div 구조이므로 직접 타이핑 명령을 내립니다.
    const blogTitle = `[실시간 트렌드] ${hotKeyword}에 대해 알아보기`;
    const blogBody = `${hotKeyword}가 현재 실시간 검색어 1위를 기록하며 화제가 되고 있습니다. 관련 내용을 정리해 드립니다... (몰트 봇 생성 내용)`;

    // 제목 입력
    await page.click('.se-placeholder__text'); // 제목 칸 클릭
    await page.keyboard.type(blogTitle);
    
    // 본문 입력 (네이버 에디터 특성에 맞춘 본문 포커싱)
    await page.keyboard.press('Tab');
    await page.keyboard.type(blogBody);

    // 6. 발행 (처음에는 '저장' 버튼을 누르게 하거나, 수동 확인을 위해 주석처리 권장)
    // await page.click('.publish_btn_클래스명'); 
    
    console.log("성공: 포스팅 초안 작성이 완료되었습니다.");

  } catch (error) {
    console.error("오류 발생:", error);
    // 실패 시 스크린샷을 찍어서 로그에서 확인 가능하게 하면 좋습니다.
    await page.screenshot({ path: 'error_screenshot.png' });
  } finally {
    await browser.close();
  }
}

runMoltbot();
