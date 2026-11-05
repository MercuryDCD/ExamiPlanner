/**
 * ExamPlan Studio — Core API Index
 */

const parser = require('./parser');
const analyzer = require('./analyzer');
const optimizer = require('./optimizer');
const generator = require('./generator');

module.exports = {
  ...parser,
  ...analyzer,
  ...optimizer,
  ...generator
};
