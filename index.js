const { chromium } = require('playwright');
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function generateBlogContent(keyword) {
    console.log(`[Gemini] '${keyword}' 주제로 포스팅 생성 중...`);
    // 라이브러리 방식을 사용하여 API 주소 문제를 해결합니다.
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `실시간 트렌드 키워드인 '${keyword}'를 주제로 네이버 블로그 포스팅을 작성해줘.
    - 페르소나: 트렌드에 민감한 2030 직장인.
    - 문체: 아주 다정한 "해요체". 친구에게 말하듯 친근하게.
    - 구성: [서론] -> [본론(불렛포인트 활용)] -> [결론].
    - 마지막에 관련 해시태그 15개를 넣어줘.`;

    try {
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
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        // 1. 키워드 수집
        console.log("1. TrendWidget 접속 및 키워드 수집...");
        let hotKeyword = "요즘 핫이슈";
        try {
            await page.goto('https://www.trendwidget.app/app', { waitUntil: 'networkidle', timeout: 30000 });
            hotKeyword = await page.evaluate(() => {
                const items = document.querySelectorAll('.keyword-list-item');
                return items.length > 0 ? items[0].innerText.split('\n')[0] : '실시간 트렌드';
            });
        } catch (e) { console.log("⚠️ 수집 사이트 지연으로 기본 키워드를 사용합니다."); }
        console.log(`최종 키워드: ${hotKeyword}`);

        // 2. 콘텐츠 생성
        const postBody = await generateBlogContent(hotKeyword);

        // 3. 네이버 로그인 (캡차 대응을 위해 시간 지연 추가)
        console.log("2. 네이버 로그인 중...");
        await page.goto('https://nid.naver.com/nidlogin.login');
        await page.waitForTimeout(1000);
        await page.fill('#id', process.env.NAVER_ID);
        await page.waitForTimeout(500);
        await page.fill('#pw', process.env.NAVER_PW);
        await page.waitForTimeout(500);
        await page.click('.btn_login');
        await page.waitForTimeout(5000);

        // 4. 블로그 에디터 진입 및 팝업 방어
        console.log("3. 블로그 에디터 접속...");
        await page.goto(`https://blog.naver.com/${process.env.NAVER_ID}?Redirect=Write&categoryNo=1`);
        await page.waitForTimeout(10000); 

        // 팝업 제거 (ESC)
        for(let i=0; i<5; i++) {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
        }

        // 5. 내용 작성
        console.log("4. 포스팅 내용 입력 중...");
        await page.click('.se-placeholder__text'); 
        await page.keyboard.type(`✨ 요즘 핫한 ${hotKeyword}, 제가 정리해봤어요!`);
        await page.keyboard.press('Tab');
        await page.keyboard.type(postBody);

        // 6. 임시 저장
        console.log("5. 임시 저장 버튼 클릭...");
        const saveButton = await page.$('.publish_btn__save');
        if (saveButton) {
            await saveButton.click();
            await page.waitForTimeout(2000);
            console.log("✅ [최종 성공] 임시저장함에 포스팅이 보관되었습니다.");
        } else {
            console.log("⚠️ 저장 버튼을 찾지 못했습니다. 수동 확인이 필요합니다.");
        }

    } catch (error) {
        console.error("❌ 오류 발생:", error.message);
    } finally {
        await browser.close();
        console.log("프로세스 종료.");
    }
}

runMoltbot();
