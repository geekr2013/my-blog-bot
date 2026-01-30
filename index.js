const { chromium } = require('playwright');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 1. 제미나이 설정
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function generateBlogContent(keyword) {
    console.log(`[Gemini] '${keyword}' 주제로 다정한 포스팅 생성 중...`);
    const prompt = `실시간 트렌드 키워드인 '${keyword}'를 주제로 네이버 블로그 포스팅을 작성해줘.
    - 페르소나: 트렌드에 민감한 2030 직장인.
    - 문체: 아주 친근하고 다정한 "해요체". 친구랑 수다 떨듯 써줘.
    - 구성: [서론: 훅] -> [본론: 상세 정보(불렛포인트 활용)] -> [결론: 마무리 인사].
    - 가독성: 모바일 가독성을 위해 문장을 아주 짧게 끊어줘.
    - 마지막에 해시태그 15개를 넣어줘.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
}

async function runMoltbot() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        // 1. 키워드 수집
        console.log("1. TrendWidget에서 키워드 수집 중...");
        await page.goto('https://www.trendwidget.app/app', { waitUntil: 'networkidle' });
        const hotKeyword = await page.evaluate(() => {
            return document.querySelector('.keyword-list-item')?.innerText.split('\n')[0] || '요즘 핫이슈';
        });
        console.log(`추출 키워드: ${hotKeyword}`);

        // 2. 제미나이 글 생성
        const postBody = await generateBlogContent(hotKeyword);

        // 3. 네이버 로그인
        console.log("2. 네이버 로그인 중...");
        await page.goto('https://nid.naver.com/nidlogin.login');
        await page.fill('#id', process.env.NAVER_ID);
        await page.fill('#pw', process.env.NAVER_PW);
        await page.click('.btn_login');
        await page.waitForTimeout(3000);

        // 4. 블로그 에디터 진입 및 글쓰기
        console.log("3. 블로그 에디터 접속 및 팝업 방어...");
        await page.goto(`https://blog.naver.com/${process.env.NAVER_ID}?Redirect=Write&categoryNo=1`);
        await page.waitForTimeout(8000);

        for(let i=0; i<3; i++) { 
            await page.keyboard.press('Escape'); 
            await page.waitForTimeout(500); 
        }

        // 5. 내용 입력
        console.log("4. 포스팅 내용 입력 중...");
        await page.click('.se-placeholder__text'); 
        await page.keyboard.type(`✨ 요즘 난리난 ${hotKeyword}, 제가 발빠르게 정리해봤어요!`);
        await page.keyboard.press('Tab');
        await page.keyboard.type(postBody);

        console.log("✅ 모든 작업 완료! 블로그의 '임시저장글' 목록을 확인하세요.");

    } catch (error) {
        console.error("❌ 오류 발생:", error);
    } finally {
        await browser.close();
    }
}

runMoltbot();
