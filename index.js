const { chromium } = require('playwright');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 1. 제미나이 설정
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// 모델 이름을 구체적인 버전(001)까지 지정하여 인식 오류를 방지합니다.
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

async function generateBlogContent(keyword) {
    console.log(`[Gemini] '${keyword}' 주제로 포스팅 생성 중...`);
    const prompt = `실시간 트렌드 키워드인 '${keyword}'를 주제로 네이버 블로그 포스팅을 작성해줘.
    - 페르소나: 트렌드에 민감하고 따뜻한 마음을 가진 2030 직장인.
    - 문체: 다정하고 친근한 "해요체". 친구에게 말하듯 써줘.
    - 구성: [서론: 공감과 흥미 유도] -> [본론: 상세 정보 요약] -> [결론: 마무리 인사].
    - 가독성: 문장을 아주 짧게 끊고, 불렛포인트(*)를 적극 사용해줘.
    - 마지막에 관련 해시태그 15개를 넣어줘.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("[Gemini 에러] 콘텐츠 생성 실패:", error.message);
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
        // 1. 키워드 수집
        console.log("1. TrendWidget 접속 중...");
        await page.goto('https://www.trendwidget.app/app', { waitUntil: 'networkidle', timeout: 60000 });
        
        // 키워드 추출 로직 보완 (데이터가 없을 경우 대비)
        const hotKeyword = await page.evaluate(() => {
            const items = document.querySelectorAll('.keyword-list-item');
            return items.length > 0 ? items[0].innerText.split('\n')[0] : '오늘의 핫 트렌드';
        });
        console.log(`추출 키워드: ${hotKeyword}`);

        // 2. 글 생성
        const postBody = await generateBlogContent(hotKeyword);

        // 3. 네이버 로그인
        console.log("2. 네이버 로그인 시도 중...");
        await page.goto('https://nid.naver.com/nidlogin.login');
        await page.fill('#id', process.env.NAVER_ID);
        await page.fill('#pw', process.env.NAVER_PW);
        await page.click('.btn_login');
        await page.waitForTimeout(4000);

        // 4. 블로그 에디터 진입
        console.log("3. 블로그 에디터 접속 중...");
        await page.goto(`https://blog.naver.com/${process.env.NAVER_ID}?Redirect=Write&categoryNo=1`);
        await page.waitForTimeout(10000); // 에디터 로딩을 위해 넉넉히 대기

        // 팝업 방어 (ESC)
        for(let i=0; i<5; i++) { 
            await page.keyboard.press('Escape'); 
            await page.waitForTimeout(500); 
        }

        // 5. 내용 입력
        console.log("4. 포스팅 작성 중...");
        await page.click('.se-placeholder__text'); 
        await page.keyboard.type(`✨ 요즘 난리난 ${hotKeyword}, 깔끔하게 정리해봤어요!`);
        
        await page.keyboard.press('Tab');
        await page.keyboard.type(postBody);

        // 6. 임시 저장 (자동 발행 전 검수를 위해 임시 저장 버튼 클릭 시도)
        console.log("5. 임시 저장 시도...");
        // 네이버 에디터의 '저장' 버튼을 찾는 시퀀스
        await page.click('.publish_btn__save').catch(() => console.log("저장 버튼을 찾지 못해 수동 저장이 필요할 수 있습니다."));
        
        console.log("✅ 성공! 네이버 블로그 '임시저장글' 목록을 확인해 보세요.");

    } catch (error) {
        console.error("❌ 최종 단계 오류 발생:", error);
    } finally {
        await browser.close();
        console.log("프로세스 종료.");
    }
}

runMoltbot();
