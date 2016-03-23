'use strict';

var util = require('util'),
    Base = require('./base'),
    errors = require('../Errors'),
    Read = require('./read');

var Download = function(args) {
  Download.super_.call(this, args);
};

util.inherits(Download, Base);

Download.prototype.action = 'download';
Download.prototype.method = 'get';
Download.prototype.plurality = 'singular';

Download.prototype.fetch = Read.prototype.fetch;

module.exports = Download;
