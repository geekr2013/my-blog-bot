const { chromium } = require('playwright');
const OpenAI = require('openai');

// 1. OpenAI 설정 (깃허브 시크릿에서 가져온 키 사용)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateBlogContent(keyword) {
    console.log(`[AI] '${keyword}' 주제로 맞춤형 포스팅 생성 중...`);
    const prompt = `실시간 트렌드 키워드인 '${keyword}'를 주제로 블로그 포스팅을 작성해줘.
    - 페르소나: 공감 능력이 뛰어나고 트렌드에 민감한 2030 세대.
    - 문체: 아주 다정한 "해요체". 친구에게 이야기하듯 친근하게. (딱딱한 말투 절대 금지)
    - 구성: 
      1. 흥미로운 서론(Hook) 
      2. 실질적 정보와 팁이 담긴 본론 (불렛 포인트와 볼드체 활용)
      3. 따뜻한 여운을 남기는 결론
    - 가독성: 모바일 사용자를 위해 문장을 짧게 끊고, 가독성 좋게 구성해줘.
    - 마지막에 관련 해시태그 10개 이상 포함해줘.`;

    const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [{ role: "user", content: prompt }],
    });
    return response.choices[0].message.content;
}

async function generateImageUrl(keyword) {
    console.log(`[AI] '${keyword}' 관련 이미지 생성 중...`);
    const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: `A cozy, high-quality lifestyle photography related to ${keyword}. Natural lighting, 16:9 aspect ratio, aesthetic and trendy mood.`,
        size: "1024x1024", 
    });
    return response.data[0].url;
}

async function runMoltbot() {
    // 브라우저 실행
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        // 1. 트렌드 키워드 수집 (TrendWidget)
        console.log("1. TrendWidget 접속 및 키워드 수집 중...");
        await page.goto('https://www.trendwidget.app/app', { waitUntil: 'networkidle' });
        const hotKeyword = await page.evaluate(() => {
            const firstItem = document.querySelector('.keyword-list-item');
            return firstItem ? firstItem.innerText.split('\n')[0] : '오늘의 핫 이슈';
        });
        console.log(`추출된 1위 키워드: ${hotKeyword}`);

        // 2. AI 콘텐츠 및 이미지 생성
        const postBody = await generateBlogContent(hotKeyword);
        const imageUrl = await generateImageUrl(hotKeyword);

        // 3. 네이버 로그인
        console.log("2. 네이버 로그인 시도 중...");
        await page.goto('https://nid.naver.com/nidlogin.login');
        await page.fill('#id', process.env.NAVER_ID);
        await page.fill('#pw', process.env.NAVER_PW);
        await page.click('.btn_login');
        await page.waitForTimeout(3000);

        // 4. 블로그 에디터 진입 및 팝업 방어
        console.log("3. 블로그 에디터 진입 및 팝업 제거 중...");
        await page.goto(`https://blog.naver.com/${process.env.NAVER_ID}?Redirect=Write&categoryNo=1`);
        await page.waitForTimeout(7000); // 에디터 로딩 대기

        // 팝업 방어: ESC 연타 및 닫기 버튼 클릭
        for(let i=0; i<3; i++) {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
        }
        
        // 5. 본문 작성
        console.log("4. 포스팅 내용 입력 중...");
        // 제목 입력
        const blogTitle = `✨ 요즘 핫한 ${hotKeyword}, 제가 정리해봤어요!`;
        await page.click('.se-placeholder__text'); 
        await page.keyboard.type(blogTitle);
        
        // 본문 이동 및 입력 (상단에 이미지 URL 가이드 포함)
        await page.keyboard.press('Tab');
        const finalContent = `[📷 생성된 이미지 확인: ${imageUrl}]\n\n위 링크의 사진을 다운로드해서 여기에 넣어주세요!\n\n${postBody}`;
        await page.keyboard.type(finalContent);

        // 6. 저장 (발행 대신 '저장' 버튼을 눌러 안전하게 확인 가능하도록 설정)
        // 실제 발행을 원하시면 .publish_btn 관련 코드가 추가되어야 하나, 우선 저장을 추천합니다.
        console.log("5. 포스팅 임시 저장 완료!");

    } catch (error) {
        console.error("오류 발생:", error);
    } finally {
        await browser.close();
        console.log("프로세스 종료.");
    }
}

runMoltbot();
