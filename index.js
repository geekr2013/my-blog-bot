const { chromium } = require('playwright');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateBlogContent(keyword) {
    console.log("AI가 블로그 포스팅 내용을 작성하고 있어요...");
    const prompt = `실시간 트렌드 키워드인 '${keyword}'를 주제로 블로그 포스팅을 작성해줘.
    - 페르소나: 공감 능력이 뛰어나고 트렌드에 민감한 2030 여성/남성 어조.
    - 문체: 다정한 "해요체". 옆에서 친구가 말하는 것처럼 친근하게.
    - 구성: 흥미로운 서론(Hook) -> 상세 정보와 팁이 담긴 본론 -> 따뜻한 결론.
    - 가독성: 문단은 짧게 끊고, 불렛포인트(*)와 볼드체(**)를 적극 활용해줘.
    - 마지막에 관련 해시태그 10개 이상 포함해줘.`;

    const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [{ role: "user", content: prompt }],
    });
    return response.choices[0].message.content;
}

async function generateImage(keyword) {
    console.log("AI 이미지를 생성하고 있어요...");
    const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: `A cozy and stylish lifestyle photography related to ${keyword}, 16:9 aspect ratio, natural lighting, high resolution.`,
        size: "1024x1024", // DALL-E 3는 비율 조절 가능
    });
    return response.data[0].url;
}

async function runMoltbot() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        // 1. 키워드 수집
        await page.goto('https://www.trendwidget.app/app');
        const hotKeyword = await page.evaluate(() => {
            return document.querySelector('.keyword-list-item')?.innerText.split('\n')[0] || '요즘 핫한 이슈';
        });

        // 2. 콘텐츠 및 이미지 생성
        const postContent = await generateBlogContent(hotKeyword);
        const imageUrl = await generateImage(hotKeyword);

        // 3. 네이버 로그인 및 글쓰기
        await page.goto('https://nid.naver.com/nidlogin.login');
        await page.fill('#id', process.env.NAVER_ID);
        await page.fill('#pw', process.env.NAVER_PW);
        await page.click('.btn_login');
        await page.waitForTimeout(3000);

        // 블로그 에디터 진입 (PM님이 주신 URL)
        await page.goto(`https://blog.naver.com/${process.env.NAVER_ID}?Redirect=Write&categoryNo=1`);
        await page.waitForTimeout(5000);

        // 4. 에디터 조작 (핵심: 팝업 닫기 및 입력)
        console.log("에디터에 글을 입력합니다.");
        await page.keyboard.press('Escape'); // 혹시 모를 팝업 닫기
        
        await page.click('.se-placeholder__text'); // 제목
        await page.keyboard.type(`[트렌드 소식] 요즘 난리난 ${hotKeyword}, 알고 계셨나요? ✨`);
        
        await page.keyboard.press('Tab'); // 본문으로 이동
        await page.keyboard.type(postContent);
        
        // 이미지의 경우 URL을 본문에 링크하거나 직접 업로드하는 지침 추가 가능
        console.log("포스팅 초안 작성 완료!");

    } catch (error) {
        console.error("오류 발생:", error);
    } finally {
        await browser.close();
    }
}

runMoltbot();
