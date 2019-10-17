const puppeteer = require('puppeteer');
const nunjucks = require('nunjucks');
const config = require('./config.js');
// const { produce } = require('immer');

// Static Width (Plain Regex)
const wrap = (s, w) => s
    .replace(/(?![^\n]{1,70}$)([^\n]{1,70})\s/g, '$1\n')
    .replace(/^/g, '     ')
    .replace('\n', '\n     ');

async function showOutput(testSuite, url, course, nickname) {
    let output = '';
    testSuite.scenarios.forEach((scenario) => {
        const when = nunjucks.renderString(scenario.when, {
            testSuite,
            url,
            course,
            nickname,
        });
        output += `When ${when}\n`;
        scenario.tests.forEach((test) => {
            const contextData = {
                testSuite,
                test,
                url,
                course,
                nickname,
            };
            const status = test.passed ? '✅' : '❌';
            const it = nunjucks.renderString(test.it, contextData);
            const testDesc = wrap(nunjucks.renderString(test.desc, contextData));
            output += `${status} - it ${it}\n${testDesc}\n`;
        });
    });
    return output;
}

(async () => {
    const testSuite = config.load('./config.yaml');
    console.log(testSuite);
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        args: ['--disable-dev-shm-usage', '--no-sandbox'],
    });
    const page = await browser.newPage();
    await page.goto('https://news.ycombinator.com', {
        waitUntil: 'networkidle2',
    });
    await page.pdf({ path: 'hn.pdf', format: 'A4' });

    const output = await showOutput(testSuite);
    console.log(output);
    await browser.close();
})();
