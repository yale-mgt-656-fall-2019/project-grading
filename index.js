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
const badevents = require('./badevents.js');

if (!process.env.DEVELOPMENT) {
    console.log = () => {};
    console.debug = () => {};
}

nunjucks.configure({ autoescape: false });
function confirmationHash(x) {
    return crypto
        .createHash('sha256')
        .update(x)
        .digest('hex')
        .substr(0, 7);
}

// Static Width (Plain Regex)
const wrap = (s) => s.replace(/\s+/g, ' ').replace(/(?![^\n]{1,70}$)([^\n]{1,70})\s/g, '$1\n');

const indent = (s) => s.replace(/^/g, '     ').replace(/\n/g, '\n     ');

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
            let rawDesc = test.desc;
            if (test.ran) {
                rawDesc += test.details || '';
            } else {
                rawDesc
          += '  This test was not run because one of the prior tests failed.';
            }
            const it = nunjucks.renderString(test.it.replace('\n', ' '), contextData);
            let testDesc = nunjucks.renderString(rawDesc, contextData);
            if (test.wrap) {
                testDesc = wrap(testDesc);
            }
            testDesc = indent(testDesc);
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
                test.ran = true;
                test.passed = status;
                test.context = {
                    ...test.context,
                    ...context,
                    passed: test.passed,
                    ran: test.ran,
                };
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
                ...context,
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

async function validatePageMarkup(data) {
    const result = JSON.parse(
        await htmlValidator({
            data,
        }),
    );
    // console.log(`validation result= ${JSON.stringify(result.messages, ' ', 4)}`);
    if (Array.isArray(result.messages)) {
        if (result.messages.length === 0) {
            return true;
        }
        console.log(JSON.stringify(result, ' ', 4));
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

async function checkSelectors(
    testSuite,
    thePage,
    whenKey,
    itKey,
    cssSelectors,
    evalFunc,
    context,
) {
    let passed;
    try {
        const counts = await countSelectors(thePage, cssSelectors);
        // console.log(`selectors = ${cssSelectors}`);
        // console.log(`counts = ${counts}`);
        passed = evalFunc(counts);
    // console.log(`passed = ${passed}`);
    } catch (e) {
        passed = false;
    }
    return recordTestStatus(passed, testSuite, whenKey, itKey, context);
}

async function findStrings(page, strings) {
    return Promise.all(
    // eslint-disable-next-line no-undef
        strings.map((s) => page.evaluate((x) => window.find(x, false, false, true), s)),
    );
}

async function checkStrings(
    testSuite,
    thePage,
    whenKey,
    itKey,
    strings,
    evalFunc,
    context,
) {
    let passed;
    try {
        const stringsFound = await findStrings(thePage, strings);
        passed = evalFunc(stringsFound);
    } catch (e) {
        passed = false;
    }
    return recordTestStatus(passed, testSuite, whenKey, itKey, context);
}

const none = (x) => x[0] === 0;
const oneOrMore = (x) => x[0] >= 1;
const allOnes = (f) => f.every((x) => x === 1);
const allTrue = (f) => f.every((x) => x === true);
const allFalse = (f) => f.every((x) => x === false);
const submitButtonSelector =  'form input[type="submit"], form button[type="submit"]';
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

let screenshotNumber = 0;
async function takeScreenshot(thePage) {
    screenshotNumber += 1;
    console.log(`Taking screenshot ${screenshotNumber}`);
    return thePage.screenshot({
        path: `screenshot-${screenshotNumber}.png`,
        fullPage: true,
    });
}

async function createNewEvent(
    testSuite,
    thePage,
    eventCreationURL,
    whenKey,
    eventDetails,
) {
    let testSuiteCopy = cloneObject(testSuite);
    try {
        const orginalURL = thePage.url();
        await novalidate(thePage);
        const e = eventDetails.event;
        const formTitleSelector = 'form input[type="text"][name="title"]';
        // Sometimes people's sites will have a brain fart under the
        // load, including mine. Not sure WTF. Here, I'm trying to reload
        // page if the form doesn't appear in a timely fashion.
        console.log(`Testing with flaw: ${eventDetails.flaw}...`);
        // $('form').each(function() { this.reset() }); //Ensure form inputs are clear before entering text
        try {
            console.log('...waiting for selector ', new Date());
            await thePage.waitForSelector(formTitleSelector, { timeout: 5000 });
            console.log('...found ', new Date());
        } catch (err) {
            console.log('...Did not find selector, reloading page ', new Date());
            await thePage.goto(eventCreationURL, {
                timeout: 5000,
                waitUntil: 'networkidle2',
            });
            console.log('...done waiting ', new Date());
        }
        const rsvpSubmitButton = await thePage.$(submitButtonSelector);
        // Clear input fields
        await thePage.$eval(formTitleSelector, (el) => (el.value = ''));
        await thePage.$eval(
            'form input[type="text"][name="location"]',
            (el) => (el.value = ''),
        );
        await thePage.$eval(
            'form input[type="url"][name="image"]',
            (el) => (el.value = ''),
        );
        // Add new values
        await thePage.type(formTitleSelector, e.title);
        await thePage.type('form input[type="text"][name="location"]', e.location);
        await thePage.type('form input[type="url"][name="image"]', e.image);
        await thePage.$eval(
            'form input[type="datetime-local"][name="date"]',
            (el, d) => {
                // eslint-disable-next-line no-param-reassign
                el.value = d;
            },
            e.date,
        );
        // await takeScreenshot(thePage);

        const navPromise = thePage.waitForNavigation({ timeout: 5000 });
        await rsvpSubmitButton.click();
        console.log('...submitting event creation form', new Date());
        await navPromise;
        const hasError = await selectorExists(thePage, formErrorSelector);
        const url = thePage.url();
        const context = {
            event: e,
            errorClasses: formErrorSelector.replace(/\./g, ''),
        };
        // await takeScreenshot(thePage);
        if (eventDetails.flaw) {
            console.log(`hasError = ${hasError}, url = ${url}`);
            testSuiteCopy = recordTestStatus(
                hasError && url === orginalURL,
                testSuiteCopy,
                whenKey,
                eventDetails.key,
                context,
            );
        } else {
            const urlObj = new URL(url);
            const correctPath = /^\/events\/[0-9]+/.test(urlObj.pathname);
            const titleExists = await stringExists(thePage, e.title);
            // console.log(`hasError = ${hasError}`);
            // console.log(`correctPath = ${correctPath}`);
            // console.log(`titleExists = ${titleExists}`);
            testSuiteCopy = recordTestStatus(
                !hasError && correctPath && titleExists,
                testSuiteCopy,
                whenKey,
                'validEvent',
                context,
            );
        }
    } catch (e) {
        console.debug(`wtf caught error ${e}. Flaw is ${eventDetails.flaw}`);
    }
    return testSuiteCopy;
}

async function checkRSVP(
    testSuite,
    thePage,
    whenKey,
    itKey,
    eventURL,
    email,
    isOK,
) {
    let testSuiteCopy = cloneObject(testSuite);
    try {
        await novalidate(thePage);
        await thePage.type('form input[type="email"][name="email"]', email);

        const rsvpSubmitButton = await thePage.$(submitButtonSelector);
        const navPromise = thePage.waitForNavigation();
        await rsvpSubmitButton.click();
        await navPromise;

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
        console.debug(`caught error ${e}`);
    }
    return testSuiteCopy;
}

async function parsePageJSON(page) {
    // eslint-disable-next-line no-undef
    const content = await page.evaluate(
        () => document.querySelector('body').innerText,
    );
    return JSON.parse(content);
}

function getTestSuiteResult(testSuite, whenKey, itKey) {
    for (let i = 0; i < testSuite.scenarios.length; i += 1) {
        const scenario = testSuite.scenarios[i];
        if (scenario.key === whenKey) {
            for (let j = 0; j < scenario.tests.length; j += 1) {
                const test = scenario.tests[j];
                if (test.key === itKey) {
                    return test.passed;
                }
            }
        }
    }
    return null;
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
        process.stdout.write(showOutput(testSuite, course, nickname, url));
        await browser.close();
        return true;
    };
    const page = await browser.newPage();

    // ###################################
    // ################################### Homepage tests
    // ###################################

    // ---------------------------------------------------------- up
    let homePageUp = false;
    try {
        const response = await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 15000,
        });
        homePageUp = response.status() === 200;
        testSuite = recordTestStatus(homePageUp, testSuite, 'homepage', 'up');
    } catch (e) {
        return finish();
    }
    const doTest = (whenKey, itKey, cssSelectors, evalFunc, context) => checkSelectors(
            testSuite,
            page,
            whenKey,
            itKey,
            cssSelectors,
            evalFunc,
            context,
        );

    if (homePageUp) {
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
            const markup = await page.content();
            markupValidates = await validatePageMarkup(markup);
        } catch (e) {
            // console.log(`caught exception doing validation: ${e}`);
            markupValidates = false;
        }
        testSuite = recordTestStatus(
            markupValidates,
            testSuite,
            'homepage',
            'valid',
        );

        // ---------------------------------------------------------- cssFrameworks
        const frameworks = [
            'bootstrap',
            'bulma',
            'material',
            'foundation',
            'semantic',
        ];
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

        testSuite = await doTest(
            'homepage',
            'eventTimes',
            ['time'],
            (x) => x[0] >= 3,
        );
        testSuite = await doTest(
            'homepage',
            'aboutPageLink',
            ['footer a[href*="/about"]'],
            oneOrMore,
        );
        testSuite = await doTest(
            'homepage',
            'homePageLink',
            ['footer a[href="/"]'],
            oneOrMore,
        );
        testSuite = await doTest(
            'homepage',
            'logo',
            ['header img[id="logo"]'],
            oneOrMore,
        );
        testSuite = await doTest(
            'homepage',
            'createEventLink',
            ['a[href*="/events/new"]'],
            oneOrMore,
        );
    }

    // ###################################
    // ################################### About tests
    // ###################################
    let aboutPageExists = false;
    try {
        const response = await page.goto(nodeUrl.resolve(url, '/about'), {
            waitUntil: 'networkidle2',
            timeout: 5000,
        });
        if (response.status() === 200) {
            aboutPageExists = true;
        }
    } catch (e) {
        aboutPageExists = false;
    }
    testSuite = recordTestStatus(aboutPageExists, testSuite, 'about', 'exists');

    if (aboutPageExists) {
        let foundNickname = false;
        try {
            // eslint-disable-next-line no-undef
            foundNickname = await page.evaluate((x) => window.find(x), nickname);
        } catch (e) {
            foundNickname = false;
        }
        testSuite = recordTestStatus(foundNickname, testSuite, 'about', 'nickname');
    }

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
    testSuite = recordTestStatus(
        eventDetailPageExists,
        testSuite,
        'eventDetail',
        'exists',
    );
    testSuite = await doTest(
        'eventDetail',
        'aboutPageLink',
        ['footer a[href*="/about"]'],
        oneOrMore,
    );

    testSuite = await doTest('eventDetail', 'title', ['h1'], oneOrMore);

    testSuite = await doTest(
        'eventDetail',
        'noError',
        [formErrorSelector],
        none,
        {
            errorClasses: formErrorSelector.replace(/\./g, ''),
        },
    );

    testSuite = await doTest(
        'eventDetail',
        'donateLink',
        [`a[href*="/events/${event.id}/donate"]`],
        oneOrMore,
        {
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

    testSuite = await doTest(
        'eventDetail',
        'homePageLink',
        ['footer a[href="/"]'],
        oneOrMore,
    );
    testSuite = await doTest(
        'eventDetail',
        'rsvpForm',
        ['form[method="post"]'],
        oneOrMore,
    );
    testSuite = await doTest(
        'eventDetail',
        'rsvpFormEmail',
        ['form input[type="email"]'],
        oneOrMore,
    );
    testSuite = await doTest(
        'eventDetail',
        'rsvpFormSubmit',
        [submitButtonSelector],
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
    const apiURL = nodeUrl.resolve(url, '/api/events');
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

    let apiEventListResponse = {};
    let apiEventListResponseParsed = false;
    try {
        apiEventListResponse = await parsePageJSON(page);
        apiEventListResponseParsed = true;
    } catch (e) {
        console.debug(`caught exception ${e}`);
        apiEventListResponse = {};
    }
    testSuite = recordTestStatus(
        apiEventListResponseParsed,
        testSuite,
        'api',
        'json',
    );

    let apiEventListResponsePresent = false;
    try {
    // Get all the event ids from the API
        let apiEvents;
        if (Array.isArray(apiEventListResponse)) {
            apiEvents = apiEventListResponse;
        } else {
            apiEvents = apiEventListResponse.events || apiEventListResponse.Events;
        }
        const eventIDs = apiEvents.map((e) => e.id);
        // See if all the events we expect are in there
        apiEventListResponsePresent = events
            .map((e) => eventIDs.includes(e.id))
            .every((x) => x === true);
    // console.log(`eventIDs = ${eventIDs}`);
    // console.log(`apiEventListResponsePresent = ${apiEventListResponsePresent}`);
    } catch (e) {
        console.debug(`caught exception ${e}`);
    }
    testSuite = recordTestStatus(
        apiEventListResponsePresent,
        testSuite,
        'api',
        'defaultEvents',
    );

    // ###################################
    // ################################### API EventDetail tests
    // ###################################
    const eventAPIURL = nodeUrl.resolve(url, `/api/events/${event.id}`);
    testSuite = addContextToWhen(testSuite, 'apiEventDetail', {
        event,
    });
    let apiEventDetailExists = false;
    try {
        const response = await page.goto(eventAPIURL, {
            waitUntil: 'networkidle2',
            timeout: 5000,
        });
        if (response.status() === 200) {
            apiEventDetailExists = true;
        }
    } catch (e) {
        console.debug(`Caught exception ${e}`);
    }
    testSuite = recordTestStatus(
        apiEventDetailExists,
        testSuite,
        'apiEventDetail',
        'exists',
    );

    if (apiEventDetailExists) {
        let apiEventDetailParsed = false;
        let apiEventDetail = {};
        try {
            apiEventDetail = await parsePageJSON(page);
            apiEventDetailParsed = true;
        } catch (e) {
            // console.log(`caught exception ${e}`);
            apiEventDetail = {};
        }
        testSuite = recordTestStatus(
            apiEventDetailParsed,
            testSuite,
            'apiEventDetail',
            'json',
        );
        if (apiEventDetailParsed) {
            testSuite = recordTestStatus(
                apiEventDetail.title === event.title,
                testSuite,
                'apiEventDetail',
                'info',
                {
                    event,
                },
            );
        }
    }
    // ###################################
    // ################################### Event creation tests
    // ###################################
    const eventCreationURL = nodeUrl.resolve(url, '/events/new');
    let eventCreationPageExists = false;
    try {
        await page.goto(eventCreationURL, {
            waitUntil: 'networkidle2',
            timeout: 5000,
        });
        eventCreationPageExists = true;
    } catch (e) {
        eventCreationPageExists = false;
    }
    testSuite = recordTestStatus(
        eventCreationPageExists,
        testSuite,
        'eventCreation',
        'exists',
    );

    let eventCreationFormOK = false;
    if (eventCreationPageExists) {
        testSuite = await doTest('eventCreation', 'form', ['form'], oneOrMore);
        testSuite = await doTest(
            'eventCreation',
            'noError',
            [formErrorSelector],
            none,
            {
                errorClasses: formErrorSelector.replace(/\./g, ''),
            },
        );
        const formSelectors = [
            'form input[type="text"][name="title"]',
            'form input[type="text"][name="location"]',
            'form input[type="url"][name="image"]',
            'form input[type="datetime-local"][name="date"]',
            submitButtonSelector,
        ];
        testSuite = await doTest(
            'eventCreation',
            'formFields',
            formSelectors,
            allOnes,
            {
                selectors: formSelectors,
            },
        );
        eventCreationFormOK = getTestSuiteResult(
            testSuite,
            'eventCreation',
            'formFields',
        );
    }

    if (eventCreationFormOK) {
        const theBadEvents = badevents.get();
        for (let i = 0; i < theBadEvents.length; i += 1) {
            const e = theBadEvents[i];
            // eslint-disable-next-line no-await-in-loop
            testSuite = await createNewEvent(
                testSuite,
                page,
                eventCreationURL,
                'eventCreation',
                e,
            );
        }
    }

    // ###################################
    // ################################### DONE
    // ###################################
    finish();
    return true;
})();
