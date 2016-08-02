'use strict';

var _ = require('lodash'),
    util = require('util'),
    Base = require('./base'),
    Bluebird = require('bluebird');

var BatchUpdate = function(args) {
  if (args.resource.updateMethod)
    this.method = args.resource.updateMethod;
  BatchUpdate.super_.call(this, args);
};

util.inherits(BatchUpdate, Base);

BatchUpdate.prototype.action = 'batchUpdate';
BatchUpdate.prototype.method = 'put';
BatchUpdate.prototype.plurality = 'plural';

BatchUpdate.prototype.write = function(req, res, context) {
  if (!this.model) {
    return context.continue;
  }

  var self = this;

  return Bluebird.map(context.attributes, function(values) {
    return self.model.findById(values.id)
      .then(function(instance) {
        if (instance) {
          instance.setAttributes(_.omit(values, ['id']));

          // check if reload is needed
          var reloadAfter = self.resource.reloadInstances &&
                Object.keys(self.resource.associationsInfo).some(function(attr) {
                  return instance._changed.hasOwnProperty(attr);
                });

          return instance
            .save()
            .then(function(instance) {
              if (self.resource.refetchInstances) {
                return self.model.findById(instance.id);
              } else if (reloadAfter) {
                return instance.reload({include: self.include});
              } else {
                return instance;
              }
            });
        } else {
          return null;
        }
      });
  })
  .then(function(instances) {
    context.instance = _.filter(instances);
    return context.continue;
  });
};

module.exports = BatchUpdate;
