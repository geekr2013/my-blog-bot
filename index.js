const { chromium } = require('playwright');
const OpenAI = require('openai');

// 1. OpenAI 설정
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateBlogContent(keyword) {
    console.log(`[AI] '${keyword}' 주제로 포스팅 생성 시작...`);
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o", // 모델명을 접근 권한이 확실한 최신 모델로 변경했습니다.
            messages: [{
                role: "user",
                content: `실시간 트렌드 키워드인 '${keyword}'를 주제로 블로그 포스팅을 작성해줘.
                - 페르소나: 공감 능력이 뛰어난 2030 세대.
                - 문체: 아주 다정한 "해요체". 친구에게 이야기하듯 친근하게.
                - 가독성: 문장을 짧게 끊고 불렛 포인트와 볼드체를 많이 써줘.
                - 마지막에 관련 해시태그 10개 이상 포함해줘.`
            }],
        });
        return response.choices[0].message.content;
    } catch (error) {
        console.error("[AI 에러] 글 생성 중 오류 발생:", error.message);
        throw error;
    }
}

async function generateImageUrl(keyword) {
    console.log(`[AI] 이미지 생성 시작...`);
    try {
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: `A cozy lifestyle photography related to ${keyword}. aesthetic and trendy mood, 16:9 ratio.`,
            size: "1024x1024",
        });
        return response.data[0].url;
    } catch (error) {
        console.error("[AI 에러] 이미지 생성 중 오류 발생:", error.message);
        return "이미지 생성 실패 (수동 업로드 필요)";
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
        console.log("1. TrendWidget 키워드 수집 중...");
        await page.goto('https://www.trendwidget.app/app', { waitUntil: 'networkidle' });
        const hotKeyword = await page.evaluate(() => {
            return document.querySelector('.keyword-list-item')?.innerText.split('\n')[0] || '요즘 핫이슈';
        });
        console.log(`추출 키워드: ${hotKeyword}`);

        // 2. AI 콘텐츠 생성
        const postBody = await generateBlogContent(hotKeyword);
        const imageUrl = await generateImageUrl(hotKeyword);

        // 3. 네이버 로그인
        console.log("2. 네이버 로그인 중...");
        await page.goto('https://nid.naver.com/nidlogin.login');
        await page.fill('#id', process.env.NAVER_ID);
        await page.fill('#pw', process.env.NAVER_PW);
        await page.click('.btn_login');
        await page.waitForTimeout(3000);

        // 로그인 성공 여부 간단 체크
        if (page.url().includes("nidlogin.login")) {
            console.log("⚠️ 로그인 실패! 보안 인증(캡차)이나 ID/PW를 확인해주세요.");
            return;
        }

        // 4. 블로그 에디터 진입
        console.log("3. 블로그 에디터 접속 중...");
        await page.goto(`https://blog.naver.com/${process.env.NAVER_ID}?Redirect=Write&categoryNo=1`);
        await page.waitForTimeout(8000);

        // 팝업 방어 (ESC)
        for(let i=0; i<3; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(500); }

        // 5. 글 작성
        console.log("4. 내용 입력 중...");
        await page.click('.se-placeholder__text'); 
        await page.keyboard.type(`✨ 요즘 핫한 ${hotKeyword}, 제가 정리해봤어요!`);
        await page.keyboard.press('Tab');
        await page.keyboard.type(`[📷 AI 생성 이미지: ${imageUrl}]\n\n${postBody}`);

        // 6. 임시 저장 버튼 클릭 (실제 블로그의 '저장' 버튼 위치 찾기)
        console.log("5. 임시 저장 시도...");
        const saveButton = await page.$('.se-help-panel-close-button, .publish_btn__save'); // 네이버 에디터 셀렉터 예시
        if (saveButton) await saveButton.click();
        
        console.log("✅ 모든 작업 완료! 블로그 '임시저장글' 목록을 확인해보세요.");

    } catch (error) {
        console.error("❌ 최종 단계 오류 발생:", error);
    } finally {
        await browser.close();
    }
}

runMoltbot();
