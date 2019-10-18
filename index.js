const puppeteer = require('puppeteer');
const nunjucks = require('nunjucks');
const argv = require('minimist')(process.argv.slice(2));
const validator = require('validator');
const htmlValidator = require('html-validator');
const config = require('./config.js');
const events = require('./events.js');

// Static Width (Plain Regex)
const wrap = (s) => s
    .replace(/\s+/g, ' ')
    .replace(/(?![^\n]{1,70}$)([^\n]{1,70})\s/g, '$1\n')
    .replace(/^/g, '     ')
    .replace(/\n/g, '\n     ');

function showOutput(testSuite, course, nickname, url) {
    let output = '';
    testSuite.scenarios.forEach((scenario) => {
        const when = nunjucks.renderString(scenario.when, {
            ...testSuite.context,
            ...scenario.context,
            testSuite,
            url,
            course,
            nickname,
        });
        output += `When ${when}\n`;
        scenario.tests.forEach((test) => {
            const contextData = {
                ...testSuite.context,
                ...scenario.context,
                ...test.context,
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
        output += '\n';
    });
    return output;
}

function cloneObject(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function rand(myArray) {
    return myArray[Math.floor(Math.random() * myArray.length)];
}

function recordTestStatus(status, testSuite, whenKey, itKey, context) {
    const testSuiteCopy = cloneObject(testSuite);
    testSuiteCopy.scenarios = testSuiteCopy.scenarios.map((scenario) => {
        const newScenario = cloneObject(scenario);
        const tests = scenario.tests.map((t) => {
            const test = cloneObject(t);
            if (scenario.key === whenKey && test.key === itKey) {
                test.passed = status;
                test.context = Object.assign(context || {}, test.context);
            }
            return test;
        });
        newScenario.tests = tests;
        return newScenario;
    });
    return testSuiteCopy;
}

function addContextToWhen(testSuite, whenKey, context) {
    const testSuiteCopy = cloneObject(testSuite);
    for (let index = 0; index < testSuiteCopy.scenarios.length; index += 1) {
        const scenario = testSuiteCopy.scenarios[index];
        if (scenario.key === whenKey) {
            scenario.context = { ...scenario.context, ...context };
        }
    }
    return testSuiteCopy;
}

function usage(msg) {
    console.warn(`${msg}\n`);
    console.log('index.js COURSE TEAM_NICKNAME URL');
}

const urlOptions = {
    protocols: ['http', 'https'],
    require_tld: true,
    require_protocol: true,
    require_host: true,
    require_valid_protocol: true,
    allow_underscores: false,
    host_whitelist: false,
    host_blacklist: false,
    allow_trailing_dot: false,
    allow_protocol_relative_urls: false,
    disallow_auth: false,
};

async function validatePageMarkup(url) {
    const result = await htmlValidator({ url });
    if ('messages' in result) {
        return result.messages.every((a) => a.type !== 'error');
    }
    return false;
}

async function countSelectors(page, selectors) {
    const elements = await Promise.all(selectors.map((s) => page.$$(s)));
    const elementCounts = elements.map((e) => e.length);
    // console.log(elementCounts);
    return elementCounts;
}

async function checkSelectors(testSuite, thePage, whenKey, itKey, cssSelectors, evalFunc) {
    let passed;
    try {
        const linkCounts = await countSelectors(thePage, cssSelectors);
        passed = evalFunc(linkCounts);
    } catch (e) {
        passed = false;
    }
    return recordTestStatus(passed, testSuite, whenKey, itKey);
}

(async () => {
    if (argv._.length !== 3) {
        return usage('Invalid number of inputs!');
    }
    if (/(656|660)/.test(argv._[0]) === false) {
        return usage(`Invalid class ${argv._[0]}. Must be 656 or 660.`);
    }
    if (/[a-z]-[a-z]/.test(argv._[1]) === false) {
        return usage(`Invalid team nickname ${argv._[1]}`);
    }
    if (validator.isURL(argv._[2], urlOptions) === false) {
        return usage(`Invalid URL ${argv._[1]}`);
    }
    const [course, nickname, url] = argv._;

    // Load test descriptions
    let testSuite = config.load('./config.yaml');
    testSuite.context.events = events;

    // Start browser
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        args: [
            '--disable-dev-shm-usage',
            '--no-sandbox',
            "--proxy-server='direct://'",
            '--proxy-bypass-list=*',
        ],
    });

    const finish = async () => {
        console.log(showOutput(testSuite, course, nickname, url));
        await browser.close();
        return true;
    };
    const page = await browser.newPage();

    // ###################################
    // ################################### Homepage tests
    // ###################################

    // ---------------------------------------------------------- up
    try {
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 15000,
        });
    } catch (e) {
        return finish();
    }
    testSuite = recordTestStatus(true, testSuite, 'homepage', 'up');

    // ---------------------------------------------------------- title
    const homePageTitle = await page.title();
    if (typeof homePageTitle === 'string' || homePageTitle.length > 0) {
        testSuite = recordTestStatus(true, testSuite, 'homepage', 'title', {
            title: homePageTitle,
        });
    }

    // ---------------------------------------------------------- valid
    let markupValidates;
    try {
        markupValidates = await validatePageMarkup(url);
    } catch (e) {
        markupValidates = false;
    }
    testSuite = recordTestStatus(markupValidates, testSuite, 'homepage', 'valid');

    const doTest = (whenKey, itKey, cssSelectors, evalFunc) => checkSelectors(testSuite, page, whenKey, itKey, cssSelectors, evalFunc);
    const oneOrMore = (x) => x[0] >= 1;

    // ---------------------------------------------------------- cssFrameworks
    const frameworks = ['bootstrap', 'bulma', 'material', 'foundation', 'semantic'];
    testSuite = await doTest(
        'homepage',
        'cssFramework',
        frameworks.map((f) => `head > link[href*="${f}"]`),
        (x) => x.some((e) => e > 0),
    );

    // ---------------------------------------------------------- eventLinks
    testSuite = await doTest(
        'homepage',
        'eventLinks',
        events.map((e) => e.id).map((event) => `a[href*="/events/${event}"]`),
        (x) => x.every((e) => e > 0),
    );

    testSuite = await doTest('homepage', 'eventTimes', ['time'], (x) => x[0] >= 3);
    testSuite = await doTest('homepage', 'aboutPageLink', ['footer a[href*="/about"]'], oneOrMore);
    testSuite = await doTest('homepage', 'homePageLink', ['footer a[href="/"]'], oneOrMore);
    testSuite = await doTest('homepage', 'logo', ['header img[id="logo"]'], oneOrMore);
    testSuite = await doTest('homepage', 'createEventLink', ['a[href*="/events/new"]'], oneOrMore);

    // ###################################
    // ################################### About tests
    // ###################################
    let aboutPageExists = false;
    try {
        await page.goto(`${url}/about`, {
            waitUntil: 'networkidle2',
            timeout: 5000,
        });
        aboutPageExists = true;
    } catch (e) {
        aboutPageExists = false;
    }
    testSuite = recordTestStatus(aboutPageExists, testSuite, 'about', 'exists');

    let foundNickname = false;
    try {
        // eslint-disable-next-line no-undef
        foundNickname = await page.evaluate((x) => window.find(x), nickname);
    } catch (e) {
        foundNickname = false;
    }
    testSuite = recordTestStatus(foundNickname, testSuite, 'about', 'nickname');

    // ###################################
    // ################################### Event tests
    // ###################################
    const event = rand(events);
    testSuite = addContextToWhen(testSuite, 'eventDetail', { event });
    let eventDetailPageExists = false;
    try {
        await page.goto(`${url}/events/${event.id}`, {
            waitUntil: 'networkidle2',
            timeout: 5000,
        });
        eventDetailPageExists = true;
    } catch (e) {
        eventDetailPageExists = false;
    }
    testSuite = recordTestStatus(eventDetailPageExists, testSuite, 'eventDetail', 'exists');
    testSuite = await doTest(
        'eventDetail',
        'aboutPageLink',
        ['footer a[href*="/about"]'],
        oneOrMore,
    );
    testSuite = await doTest('eventDetail', 'homePageLink', ['footer a[href="/"]'], oneOrMore);

    // ###################################
    // ################################### DONE
    // ###################################
    finish();
    return true;
})();
