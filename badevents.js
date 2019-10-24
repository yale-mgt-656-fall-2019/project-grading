const chance = require('chance').Chance();
const moment = require('moment');

if (!process.env.DEVELOPMENT) {
    console.log = () => {};
    console.debug = () => {};
}

function rand(myArray) {
    return myArray[Math.floor(Math.random() * myArray.length)];
}

function newTitle() {
    const game = rand([
        'Fortnite',
        'Overwatch',
        'Minecraft',
        'Settlers of Catan',
        'Magic the Gathering',
        'Arm wrestling',
    ]);

    const kindOfParty = rand([
        'Cocktail',
        'Toga',
        'Dance',
        'Costume',
        'Masquerade ball',
        'Dinner',
        'Board game',
        'Murder mystery',
        '80s dance',
        'Ugly sweater',
        'Pool',
    ]);
    return rand([
        `${game} tournament`,
        rand(['Rave', 'BBQ', 'Luau', 'Karaoke', 'High tea', 'Intervention']),
        `${kindOfParty} party`,
    ]);
}

// Returns a date in the next six months
function randomDate() {
    function getRandomArbitrary(min, max) {
        return Math.random() * (max - min) + min;
    }
    let date1 = moment();
    let date2 = moment().add(6, 'months');
    date1 = new Date(date1).getTime();
    date2 = new Date(date2).getTime();
    if (date1 > date2) {
        return new Date(getRandomArbitrary(date2, date1));
    }
    return new Date(getRandomArbitrary(date1, date2));
}

function newDatetime() {
    const d = moment(randomDate());
    return d.format('YYYY-MM-DDTHH:mm');
}


function randomGif() {
    const gifs = [
        'https://i.imgur.com/71297O5.gifv',
        'https://i.imgur.com/yxLpNLG.gifv',
        'https://i.imgur.com/OnFZ3c4.gif',
        'https://i.imgur.com/CMK7Z.gif',
        'https://i.imgur.com/JuENEz4.gif',
        'https://i.imgur.com/XeDGfMl.gif',
    ];
    return rand(gifs);
}

function randomFacultyLocation() {
    const faculty = rand([
        'Kyle Jensen',
        'Sharon Oster',
        'Judy Chevalier',
        'Fiona Scott-Morton',
        'Thomas Steffen',
        'Heather Tookes',
        'Kerwin Charles',
        'Teresa Chahine',
        'Zoë Chance',
        'Anjani Jain',
    ]);
    const location = rand([
        'party yacht',
        'private island',
        'house',
        'underground bunker',
        'offgrid warehouse',
        'lair',
        'Manhattan penthouse',
        'roofdeck',
        'abandoned warehouse',
        'panic room',
    ]);
    let possessive = '\'s';
    if (faculty.endsWith('s')) {
        possessive = '\'';
    }
    return `${faculty}${possessive} ${location}`;
}

function getLongSentence(minLength) {
    let title = '';
    let min = 5;
    while (title.length < minLength) {
        min += 1;
        title = chance.sentence({ words: chance.integer({ min, max: 3 * min }) });
    }
    return title;
}
function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}
function getBadDate() {
    const flaw = rand([
        'past',
        'invalid month',
        'invalid day',
        'invalid hour',
        'invalid minute',
        'invalid format',
    ]);
    let randomMoment = moment().add(getRandomInt(600) + 366, 'days');
    const getEventTime = () => ({
        year: randomMoment.year().toString(),
        month: randomMoment.month().toString(),
        day: randomMoment.date().toString(),
        hour: randomMoment.hour().toString(),
        minute: randomMoment.minute().toString(),
    });
    let e = getEventTime();
    const randi = (min, max) => (getRandomInt(max - min) + min).toString();
    switch (flaw) {
    case 'past':
        randomMoment = moment().add(-getRandomInt(600), 'days');
        e = getEventTime();
        break;
    case 'invalid month':
        e.month = randi(13, 44);
        break;
    case 'invalid day':
        e.day = randi(45, 80);
        break;
    case 'invalid hour':
        e.hour = randi(25, 400);
        break;
    case 'invalid minute':
        e.minute = randi(61, 300);
        break;
    case 'invalid format':
        return {
            flaw,
            date: rand([
                'tomorrow',
                'next week',
                'sometime',
                'whatever',
                'never!',
                '2018-06-12F19:30',
                'FOO-06-12F19:30',
                '',
            ]),
        };
    default:
        console.debug('no flaw');
    }
    const p = (x) => x.padStart(2, '0');
    return {
        flaw,
        date: `${e.year}-${p(e.month)}-${p(e.month)}T${p(e.hour)}:${p(e.minute)}`,
    };
}
function capitalize(s) {
    if (typeof s !== 'string') return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function newEvent(flaw) {
    const event = {
        title: newTitle(),
        date: newDatetime(),
        image: randomGif(),
        location: randomFacultyLocation(),
    };

    switch (flaw) {
    case 'title':
        event.title = getLongSentence(150);
        break;
    case 'date':
        event.date = getBadDate().date;
        break;
    case 'image':
        event.image = rand([
            `https://${chance.domain()}/${chance.word()}`,
            chance.sentence(),
            chance.string({ length: 200 }),
        ]);
        break;
    case 'location':
        event.location = getLongSentence(150);
        break;
    default:
        console.debug('no flaw');
    }

    let key;
    if (flaw) {
        key = `bad${capitalize(flaw)}`;
    } else {
        key = 'validEvent';
    }

    const eventInfo = {
        event,
        flaw,
        key,
    };
    return eventInfo;
}

function get() {
    return [
        newEvent('title'),
        newEvent('date'),
        newEvent('image'),
        newEvent('location'),
        newEvent(),
    ];
}
module.exports = { get };
