const yaml = require('js-yaml');
const fs = require('fs');
const yup = require('yup');

// Todo, test for unique keys. Can't figure this out right
// now and need to move on with writing code.
//
// Add a method to the yup array object so that we
// can test for uniqueness.
// function testUnique(message, mapper = (a) => a) {
//     console.log('woot');
//     this.test('unique', message, (list) => {
//         console.log('haha');
//         console.log(list.map(mapper));
//         return false;
//         return list.length === new Set(list.map(mapper)).size;
//     });
// }
// yup.addMethod(yup.array, 'unique', testUnique);

const itSchema = yup.object().shape({
    it: yup.string().required(),
    key: yup.string().required(),
    desc: yup.string().required(),
    wrap: yup.boolean().required().default(true),
    passed: yup
        .boolean()
        .required()
        .default(false),
    ran: yup
        .boolean()
        .required()
        .default(false),
    context: yup
        .object()
        .required()
        .default({}),
});
const whenGroupSchema = yup.object().shape({
    when: yup.string().required(),
    key: yup.string().required(),
    tests: yup
        .array()
        .of(itSchema)
        .required(),
    context: yup
        .object()
        .required()
        .default({}),
});
const configSchema = yup.object().shape({
    name: yup.string().required(),
    scenarios: yup
        .array()
        .of(whenGroupSchema)
        .required(),
    context: yup
        .object()
        .required()
        .default({}),
});

function load(filePath) {
    const doc = yaml.safeLoad(fs.readFileSync(filePath, 'utf8'));
    const doc2 = configSchema.validateSync(doc);
    return doc2;
}

module.exports = {
    load,
};
