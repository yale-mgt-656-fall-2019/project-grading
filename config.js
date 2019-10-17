const yaml = require('js-yaml');
const fs = require('fs');
const yup = require('yup');

// Todo, test for unique slugs. Can't figure this out right
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

const testSchema = yup.object().shape({
    it: yup.string().required(),
    slug: yup.string().required(),
    desc: yup.string().required(),
    passed: yup
        .boolean()
        .required()
        .default(false),
    context: yup
        .object()
        .required()
        .default({}),
});
const testGroupSchema = yup.object().shape({
    when: yup.string().required(),
    slug: yup.string().required(),
    tests: yup
        .array()
        .of(testSchema)
        .required(),
});
const configSchema = yup.object().shape({
    name: yup.string().required(),
    scenarios: yup
        .array()
        .of(testGroupSchema)
        .required(),
});

function load(filePath) {
    const doc = yaml.safeLoad(fs.readFileSync(filePath, 'utf8'));
    const doc2 = configSchema.validateSync(doc);
    return doc2;
}

module.exports = {
    load,
};
