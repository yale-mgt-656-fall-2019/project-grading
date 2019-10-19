const puppeteer = require('puppeteer');
const nunjucks = require('nunjucks');
const argv = require('minimist')(process.argv.slice(2));
const validator = require('validator');
const htmlValidator = require('html-validator');
const nodeUrl = require('url');
const chance = require('chance').Chance();
const crypto = require('crypto');
const config = require('./config.js');
const events = require('./events.js');

function confirmationHash(x) {
    return crypto.createHash('sha256').update(x).digest('hex').substr(0, 7);
}

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
            output += `${status} - it ${it}\n${testDesc}\n\n`;
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
            scenario.context = {
                ...scenario.context,
                ...context
            };
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
    const result = await htmlValidator({
        url
    });
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

async function checkSelectors(testSuite, thePage, whenKey, itKey, cssSelectors, evalFunc, context) {
    let passed;
    try {
        const linkCounts = await countSelectors(thePage, cssSelectors);
        passed = evalFunc(linkCounts);
    } catch (e) {
        passed = false;
    }
    return recordTestStatus(passed, testSuite, whenKey, itKey, context);
}

async function findStrings(page, strings) {
    // eslint-disable-next-line no-undef
    return Promise.all(strings.map((s) => page.evaluate((x) => window.find(x), s)));
}

async function checkStrings(testSuite, thePage, whenKey, itKey, strings, evalFunc, context) {
    let passed;
    try {
        // console.log(`going to search for ${strings}`);
        const stringsFound = await findStrings(thePage, strings);
        // await thePage.screenshot({
        //     path: `screenshot-${strings[0]}.png`,
        //     fullPage: true
        // });

        // console.log(`stringsFound = ${stringsFound}`);
        passed = evalFunc(stringsFound);
        // console.log(`passed = ${passed}`);
    } catch (e) {
        passed = false;
    }
    return recordTestStatus(passed, testSuite, whenKey, itKey, context);
}

const none = (x) => x[0] === 0;
const oneOrMore = (x) => x[0] >= 1;
const allTrue = (f) => f.every((x) => x === true);
const allFalse = (f) => f.every((x) => x === false);
const rsvpSubmitButtonSelector = 'form input[type="submit"], form button[type="submit"]';
const formErrorSelector = '.error, .errors, .form-error, .form-errors';

async function novalidate(page) {
    // Add novalidate to all forms on the page
    return page.$$eval('form', (forms) => {
        for (let index = 0; index < forms.length; index += 1) {
            const form = forms[index];
            form.setAttribute('novalidate', true);
        }
    });
}

async function selectorExists(thePage, selector) {
    return (await countSelectors(thePage, [selector]))[0] >= 1;
}
async function stringExists(thePage, string) {
    return (await findStrings(thePage, [string]))[0];
}

async function checkRSVP(testSuite, thePage, whenKey, itKey, eventURL, email, isOK) {
    let testSuiteCopy = cloneObject(testSuite);
    try {
        console.log(`Trying to RSVP: ${email}`);
        await novalidate(thePage);
        await thePage.type('form input[type="email"]', email);

        const rsvpSubmitButton = await thePage.$(rsvpSubmitButtonSelector);
        await rsvpSubmitButton.click();
        await thePage.waitForNavigation();

        // Type some random string into the email field so that we don't
        // get false positives when we check whether or not the person
        // was RSVP'd. We don't want to find the email address in the
        // input, we want to find it on the page (or not).
        // await thePage.type('form input[type="email"]', chance.string());
        await thePage.$eval('form input[type="email"]', (el) => {
            // eslint-disable-next-line no-param-reassign
            el.value = '';
        });
        let context = {
            email,
        };
        if (isOK) {
            const hasEmail = await stringExists(thePage, email);
            const confirmationCode = confirmationHash(email);
            const hasConfirmationHash = await stringExists(thePage, confirmationCode);
            context = {
                ...context,
                confirmationCode,
            };
            testSuiteCopy = recordTestStatus(
                hasEmail && hasConfirmationHash,
                testSuiteCopy,
                whenKey,
                itKey,
                context,
            );
        } else {
            const hasEmail = await stringExists(thePage, email);
            const hasError = await selectorExists(thePage, formErrorSelector);
            testSuiteCopy = recordTestStatus(
                !hasEmail && hasError,
                testSuiteCopy,
                whenKey,
                itKey,
                context,
            );
        }
    } catch (e) {
        console.log(`caught error ${e}`);
    }
    return testSuiteCopy;
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
    if (typeof homePageTitle === 'string' && homePageTitle.length > 0) {
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

    const doTest = (whenKey, itKey, cssSelectors, evalFunc, context) => checkSelectors(testSuite, page, whenKey, itKey, cssSelectors, evalFunc, context);

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
        await page.goto(nodeUrl.resolve(url, '/about'), {
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
    const eventURL = nodeUrl.resolve(url, `/events/${event.id}`);
    testSuite = addContextToWhen(testSuite, 'eventDetail', {
        event,
    });
    let eventDetailPageExists = false;
    try {
        await page.goto(eventURL, {
            waitUntil: 'networkidle2',
            timeout: 5000,
        });
        eventDetailPageExists = true;
    } catch (e) {
        eventDetailPageExists = false;
    }
    console.log(page.url());
    testSuite = recordTestStatus(eventDetailPageExists, testSuite, 'eventDetail', 'exists');
    testSuite = await doTest(
        'eventDetail',
        'aboutPageLink',
        ['footer a[href*="/about"]'],
        oneOrMore,
    );

    testSuite = await doTest(
        'eventDetail',
        'title',
        ['h1'],
        oneOrMore,
    );

    testSuite = await doTest(
        'eventDetail',
        'noError',
        [formErrorSelector],
        none, {
            errorClasses: formErrorSelector.replace(/\./g, ''),
        },
    );

    testSuite = await doTest(
        'eventDetail',
        'donateLink',
        [`a[href*="/events/${event.id}/donate"]`],
        oneOrMore, {
            link: `/events/${event.id}/donate`,
        },
    );

    testSuite = await checkStrings(
        testSuite,
        page,
        'eventDetail',
        'attending',
        event.attending,
        allTrue,
    );

    testSuite = await doTest('eventDetail', 'homePageLink', ['footer a[href="/"]'], oneOrMore);
    testSuite = await doTest('eventDetail', 'rsvpForm', ['form[method="post"]'], oneOrMore);
    testSuite = await doTest(
        'eventDetail',
        'rsvpFormEmail',
        ['form input[type="email"]'],
        oneOrMore,
    );
    testSuite = await doTest(
        'eventDetail',
        'rsvpFormSubmit',
        [rsvpSubmitButtonSelector],
        oneOrMore,
    );

    testSuite = await checkRSVP(
        testSuite,
        page,
        'eventDetail',
        'validRSVP',
        eventURL,
        chance.email({
            domain: 'yale.edu',
        }),
        true,
    );
    testSuite = await checkRSVP(
        testSuite,
        page,
        'eventDetail',
        'invalidRSVP',
        eventURL,
        chance.email(),
        false,
    );

    // ###################################
    // ################################### API tests
    // ###################################
    const apiURL = nodeUrl.resolve(url, '/api/events/');
    let apiExists = false;
    try {
        await page.goto(apiURL, {
            waitUntil: 'networkidle2',
            timeout: 5000,
        });
        apiExists = true;
    } catch (e) {
        apiExists = false;
    }
    testSuite = recordTestStatus(apiExists, testSuite, 'api', 'exists');

    let apiEvents = {};
    let apiEventsParsed = false;
    try {
        // eslint-disable-next-line no-undef
        const content = await page.evaluate(() => document.querySelector('body').innerText);
        console.log(content);
        apiEvents = JSON.parse(content);
        apiEventsParsed = true;
    } catch (e) {
        console.log(`caught exception ${e}`);
        apiEvents = {};
    }
    testSuite = recordTestStatus(apiEventsParsed, testSuite, 'api', 'json');

    let apiEventsPresent = false;
    try {
        // Get all the event ids from the API
        const eventIDs = apiEvents.events.map((e) => e.id);
        // See if all the events we expect are in there
        apiEventsPresent = events.map((e) => eventIDs.includes(e.id)).every((x) => x === true);
        console.log(`eventIDs = ${eventIDs}`);
        console.log(`apiEventsPresent = ${apiEventsPresent}`);
    } catch (e) {
        console.log(`caught exception ${e}`);
    }
    testSuite = recordTestStatus(apiEventsPresent, testSuite, 'api', 'defaultEvents');


    // ###################################
    // ################################### DONE
    // ###################################
    finish();
    return true;
})();