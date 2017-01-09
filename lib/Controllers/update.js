'use strict';

var _ = require('lodash'),
    util = require('util'),
    Base = require('./base'),
    ReadController = require('./read');

var Update = function(args) {
  if (args.resource.updateMethod)
    this.method = args.resource.updateMethod;
  Update.super_.call(this, args);
};

util.inherits(Update, Base);

Update.prototype.action = 'update';
Update.prototype.method = 'put';
Update.prototype.plurality = 'singular';

Update.prototype.fetch = ReadController.prototype.fetch;

Update.prototype.write = function(req, res, context) {
  var model = context.model || this.model;

  if (!model) {
    return context.continue;
  }

  var instance = context.instance;

  this.endpoint.attributes.forEach(function(a) {
    if (req.params.hasOwnProperty(a)) {
      context.attributes[a] = req.payload[a];
    }
  });

  var self = this;

  // check associated data
  if (this.include && this.include.length) {
    _.values(self.resource.associationsInfo).forEach(function(association) {
      if (context.attributes.hasOwnProperty(association.as)) {
        var attr = context.attributes[association.as];

        if (_.isObject(attr) && attr.hasOwnProperty(association.primaryKey)) {
          context.attributes[association.identifier] = attr[association.primaryKey];
        } else if(context.attributes.hasOwnProperty(association.as) && attr === null) {
          context.attributes[association.identifier] = null;
        }
      }
    });
  }

  instance.setAttributes(context.attributes);

  // check if reload is needed
  var reloadAfter = self.resource.reloadInstances &&
    Object.keys(self.resource.associationsInfo).some(function(attr) {
      return instance._changed.hasOwnProperty(attr);
    });

  return instance
    .save()
    .then(function(instance) {
      if (self.resource.refetchInstances) {
        return model.findById(instance.id, {refetch: true});
      } else if (reloadAfter) {
        return instance.reload({ include: self.include });
      } else {
        return instance;
      }
    })
    .then(function(instance) {
      if (self.resource.associationOptions.removeForeignKeys) {
        _.values(self.resource.associationsInfo).forEach(function(info) {
          delete instance.dataValues[info.identifier];
        });
      }

      context.instance = instance;
      return context.continue;
    });
};

module.exports = Update;
