'use strict';

var _ = require('lodash'),
    util = require('util'),
    Base = require('./base'),
    Bluebird = require('bluebird');

var Create = function(args) {
  Create.super_.call(this, args);
};

util.inherits(Create, Base);

Create.prototype.action = 'create';
Create.prototype.method = 'post';
Create.prototype.plurality = 'plural';

Create.prototype.write = function(req, res, context) {
  if (!this.model) {
    return context.continue;
  }

  var self = this;

  if (!_.isArray(context.attributes)) {
    // Check associated data
    // TODO: do this on the list also
    if (this.include && this.include.length) {
      _.values(self.resource.associationsInfo).forEach(function(association) {
        if (context.attributes.hasOwnProperty(association.as)) {
          var attr = context.attributes[association.as];

          if (_.isObject(attr) && attr.hasOwnProperty(association.primaryKey)) {
            context.attributes[association.identifier] = attr[association.primaryKey];
            delete context.attributes[association.as];
          }
        }
      });
    }
  }

  var attributesList = _.isArray(context.attributes) ?
        context.attributes : [context.attributes];

  return Bluebird.map(attributesList, function(attributes) {
    // TODO: use transaction
    // but do not use bulkcreate here since it does not support associations
    return self.model.create(attributes, context.createOptions);
  })
    .map(function(instance) {
      if (self.resource.refetchInstances === true) {
        return self.model.findById(instance.id);
      } else if (self.resource.reloadInstances === true) {
        var reloadOptions = {};
        if (Array.isArray(self.include) && self.include.length)
          reloadOptions.include = self.include;
        if (!!self.resource.excludeAttributes)
          reloadOptions.attributes = { exclude: self.resource.excludeAttributes };
        return instance.reload(reloadOptions);
      }

      if (!!self.resource.excludeAttributes) {
        self.resource.excludeAttributes.forEach(function(attr) {
          delete instance.dataValues[attr];
        });
      }

      return instance;
    })
    .then(function(instances) {
      var endpoint = self.resource.endpoints.singular;

      if (_.isArray(context.attributes)) {
        var locations = _.map(instances, instance => {
          return endpoint.replace(/{(\w+)}/g, function(match, $1) {
            return instance[$1];
          });
        });

        res.created(locations.join(','));
        context.instance = instances;
      } else {
        var instance = _.first(instances);
        var location = endpoint.replace(/{(\w+)}/g, function(match, $1) {
          return instance[$1];
        });

        res.created(location);
        context.instance = instance;
      }
      return context.continue;
    });
};

module.exports = Create;
