'use strict';

var Endpoint = function(endpoint) {
  this.string = endpoint;
  this.attributes = (endpoint.match(/{(.*?)}/g) || [])
    .map(function(c) {
        return c.replace('{', '').replace('}', '');
    });
};

module.exports = Endpoint;
