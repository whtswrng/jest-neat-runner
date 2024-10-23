const _ = require('lodash');
const moment = require('moment');
const mui = require('@mui/material');

const deepClone = (obj) => _.cloneDeep(obj);
const getFormattedDate = (date) => moment(date).format('YYYY-MM-DD');
const Button = () => mui.Button;

module.exports = {
	getFormattedDate,
	deepClone,
	Button
}