const { chromium } = require('playwright');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 1. 제미나이 설정
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// 모델명을 가장 표준적인 형식으로 변경했습니다.
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function generateBlogContent(keyword) {
    console.log(`[Gemini] '${keyword}' 주제로 포스팅 생성 중...`);
    const prompt = `실시간 트렌드 키워드인 '${keyword}'를 주제로 네이버 블로그 포스팅을 작성해줘.
    - 페르소나: 트렌드에 민감한 2030 직장인.
    - 문체: 아주 다정한 "해요체". 친구에게 말하듯 친근하게.
    - 구성: [서론: 훅] -> [본론: 상세 정보(불렛포인트 활용)] -> [결론: 마무리 인사].
    - 마지막에 해시태그 15개를 넣어줘.`;

    try {
        // v1beta가 아닌 표준 경로로 호출되도록 라이브러리 기본 기능을 사용합니다.
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("[Gemini 에러] 글 생성 실패:", error.message);
        throw error;
    }
}

async function runMoltbot() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        // 1. 키워드 수집 (수집 실패 시 대체 키워드 사용)
        console.log("1. TrendWidget 접속 및 키워드 수집...");
        let hotKeyword = "요즘 핫한 트렌드";
        try {
            await page.goto('https://www.trendwidget.app/app', { waitUntil: 'networkidle', timeout: 30000 });
            hotKeyword = await page.evaluate(() => {
                const items = document.querySelectorAll('.keyword-list-item');
                return items.length > 0 ? items[0].innerText.split('\n')[0] : '오늘의 핫이슈';
            });
        } catch (e) {
            console.log("⚠️ 키워드 수집 중 타임아웃 발생, 기본 키워드로 진행합니다.");
        }
        console.log(`최종 키워드: ${hotKeyword}`);

        // 2. 콘텐츠 생성
        const postBody = await generateBlogContent(hotKeyword);

        // 3. 네이버 로그인
        console.log("2. 네이버 로그인 중...");
        await page.goto('https://nid.naver.com/nidlogin.login');
        await page.fill('#id', process.env.NAVER_ID);
        await page.fill('#pw', process.env.NAVER_PW);
        await page.click('.btn_login');
        await page.waitForTimeout(3000);

        // 4. 블로그 에디터 진입
        console.log("3. 블로그 에디터 진입 중...");
        await page.goto(`https://blog.naver.com/${process.env.NAVER_ID}?Redirect=Write&categoryNo=1`);
        await page.waitForTimeout(10000);

        // 팝업 제거
        for(let i=0; i<5; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(500); }

        // 5. 내용 입력
        console.log("4. 내용 타이핑 중...");
        await page.click('.se-placeholder__text'); 
        await page.keyboard.type(`✨ 요즘 난리난 ${hotKeyword}, 깔끔하게 정리해봤어요!`);
        await page.keyboard.press('Tab');
        await page.keyboard.type(postBody);

        // 6. 임시 저장 버튼 클릭 (실제 클래스명 기준)
        console.log("5. 임시 저장 시도...");
        const saveBtn = await page.$('.publish_btn__save');
        if (saveBtn) await saveBtn.click();
        
        console.log("✅ [최종 성공] 네이버 블로그 임시저장함에 글이 들어갔습니다!");

    } catch (error) {
        console.error("❌ 오류 발생:", error.message);
    } finally {
        await browser.close();
        console.log("프로세스 종료.");
    }
}

runMoltbot();
