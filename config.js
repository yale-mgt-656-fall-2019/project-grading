const yaml = require('js-yaml');
const fs = require('fs');
const yup = require('yup');

const testSchema = yup.object().shape({
    it: yup.string().required(),
    slug: yup.string().required(),
    desc: yup.string().required(),
});
const testGroupSchema = yup.object().shape({
    when: yup.string().required(),
    slug: yup.string().required(),
    tests: yup.array().of(testSchema),
});
const configSchema = yup.object().shape({
    name: yup.string().required(),
    tests: yup.array().of(testGroupSchema),
});

function load(filePath) {
    const doc = yaml.safeLoad(fs.readFileSync(filePath, 'utf8'));
    configSchema.validateSync(doc);
    return doc;
}

module.exports = {
    load,
};
