const { chromium } = require('playwright');

async function generateBlogContent(keyword) {
    console.log(`[Gemini] '${keyword}' 주제로 포스팅 생성 중...`);
    const apiKey = process.env.GEMINI_API_KEY;
    // v1beta 대신 안정적인 v1 경로를 직접 사용하여 404 에러를 원천 차단합니다.
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = {
        contents: [{
            parts: [{
                text: `실시간 트렌드 키워드인 '${keyword}'를 주제로 네이버 블로그 포스팅을 작성해줘.
                - 페르소나: 트렌드에 민감하고 공감 능력이 좋은 2030 직장인.
                - 문체: 다정하고 친근한 "해요체". 친구에게 말하듯 짧게 끊어서 작성.
                - 구성: [흥미로운 도입부] -> [상세 정보 요약(불렛포인트 활용)] -> [따뜻한 마무리].
                - 마지막에 관련 해시태그 15개를 포함해줘.`
            }]
        }]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prompt)
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates[0].content.parts[0].text;
}

async function runMoltbot() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        // 1. 키워드 수집 (안정성을 위해 타임아웃 넉넉히 설정)
        console.log("1. 키워드 수집 중...");
        let hotKeyword = "요즘 핫이슈";
        try {
            await page.goto('https://www.trendwidget.app/app', { waitUntil: 'networkidle', timeout: 40000 });
            hotKeyword = await page.evaluate(() => {
                const items = document.querySelectorAll('.keyword-list-item');
                return items.length > 0 ? items[0].innerText.split('\n')[0] : '실시간 트렌드';
            });
        } catch (e) { console.log("⚠️ 수집 사이트 지연으로 기본 키워드를 사용합니다."); }
        console.log(`최종 키워드: ${hotKeyword}`);

        // 2. 글 생성
        const postBody = await generateBlogContent(hotKeyword);

        // 3. 네이버 로그인
        console.log("2. 네이버 로그인 중...");
        await page.goto('https://nid.naver.com/nidlogin.login');
        await page.fill('#id', process.env.NAVER_ID);
        await page.fill('#pw', process.env.NAVER_PW);
        await page.click('.btn_login');
        await page.waitForTimeout(4000);

        // 4. 블로그 에디터 진입 및 팝업 방어
        console.log("3. 블로그 에디터 접속 및 팝업 제거 중...");
        await page.goto(`https://blog.naver.com/${process.env.NAVER_ID}?Redirect=Write&categoryNo=1`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(7000); // 에디터 내부 스크립트 로딩 대기

        // ESC 키를 여러 번 눌러 팝업 레이어 제거
        for(let i=0; i<5; i++) {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
        }

        // 5. 내용 작성
        console.log("4. 포스팅 내용 입력 중...");
        // 제목 입력 (플레이스홀더를 정확히 타격)
        await page.click('.se-placeholder__text');
        await page.keyboard.type(`✨ 요즘 난리난 ${hotKeyword}, 제가 발빠르게 정리해봤어요!`);
        
        await page.keyboard.press('Tab');
        await page.keyboard.type(postBody);

        // 6. 저장 (임시 저장글로 보관)
        console.log("5. 임시 저장 버튼 클릭...");
        const saveButton = await page.$('.publish_btn__save');
        if (saveButton) {
            await saveButton.click();
            console.log("✅ [성공] 임시저장함에 포스팅이 보관되었습니다.");
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
