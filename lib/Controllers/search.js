'use strict';

var util = require('util'),
    Base = require('./base'),
    errors = require('../Errors');

var Search = function(args) {
  Search.super_.call(this, args);
};

util.inherits(Search, Base);

Search.prototype.action = 'search';
Search.prototype.method = 'post';
Search.prototype.plurality = 'plural';

module.exports = Search;
