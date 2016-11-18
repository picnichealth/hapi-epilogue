'use strict';

var _ = require('lodash'),
    Endpoint = require('../Endpoint'),
    Promise = require('bluebird'),
    errors = require('../Errors');

var Controller = function(args) {
  this.initialize(args);
};

Controller.prototype.initialize = function(options) {
  options = options || {};
  this.endpoint = new Endpoint(options.endpoint);
  this.model = options.model;
  this.app = options.app;
  this.resource = options.resource;
  this.include = options.include;

  if (options.include.length) {
    var includeAttributes = [], includeModels = [];
    options.include.forEach(function(include) {
      includeModels.push(!!include.model ? include.model : include);
    });

    _.forEach(this.model.associations, function(association) {
      if (_.contains(includeModels, association.target))
        includeAttributes.push(association.identifier);
    });
    this.includeAttributes = includeAttributes;
  }

  this.route();
};

Controller.milestones = [
  'start',
  'auth',
  'fetch',
  'data',
  'write',
  'send',
  'complete'
];

Controller.hooks = Controller.milestones.reduce(function(hooks, milestone) {
  ['_before', '', '_after'].forEach(function(modifier) {
    hooks.push(milestone + modifier);
  });

  return hooks;
}, []);

Controller.prototype.error = function(req, res, err) {
  res.statusCode = err.status;
  res.source = {
    message: err.message,
    errors: err.errors
  };
};

Controller.prototype.send = function(req, res, context) {
  if (context.stream) {
    res.source = context.stream;
    res.variety = 'stream';
  } else {
    res.source = context.instance;
  }

  return context.continue;
};

Controller.prototype.route = function() {
  var app = this.app,
      endpoint = this.endpoint,
      self = this;

  var routeConfig = {
    handler: function(req, reply) {
      self._control(req, reply);
    }
  };

  if (this.resource.routeConfig) {
    routeConfig.auth = this.resource.routeConfig.auth[this.action];
    routeConfig.description = this.resource.routeConfig.description[this.action];
    routeConfig.notes = this.resource.routeConfig.notes[this.action];
    routeConfig.timeout = this.resource.routeConfig.timeout;
    if (this.resource.routeConfig.payload && this.resource.routeConfig.payload[self.action] ) {
      routeConfig.payload = this.resource.routeConfig.payload[self.action];
    }

    if (this.resource.routeConfig.validate && this.resource.routeConfig.validate[self.action]) {
      routeConfig.validate = this.resource.routeConfig.validate[self.action];
    }

    if (this.resource.routeConfig.response && this.resource.routeConfig.response[self.action]) {
      routeConfig.response = this.resource.routeConfig.response[self.action];
    }

    if (this.resource.routeConfig.tags && this.resource.routeConfig.tags[self.action]) {
      routeConfig.tags = this.resource.routeConfig.tags[self.action];
    }

    if (this.resource.routeConfig.plugins && this.resource.routeConfig.plugins[self.action]) {
      routeConfig.plugins = this.resource.routeConfig.plugins[self.action];
    }
  }

  var endpointString = endpoint.string;
  if (this.action === 'search' || this.action === 'download') {
    endpointString += '/' + this.action;
  }

  app.route({
    method: self.method,
    path: endpointString,
    config: routeConfig
  });
};

Controller.prototype._control = function(req, reply) {
  var hookChain = Promise.resolve(false),
      self = this,
      context = {
        instance: undefined,
        criteria: {},
        attributes: {},
        options: {},
        reply: reply
      };

  var res = reply().hold();

  Controller.milestones.forEach(function(milestone) {
    if (!self[milestone]) {
      return;
    }

    [milestone + '_before', milestone, milestone + '_after'].forEach(function(hook) {
      if (!self[hook]) {
        return;
      }

      hookChain = hookChain.then(function runHook(skip) {
        if (skip) return true;
        var functions = Array.isArray(self[hook]) ? self[hook] : [self[hook]];

        // return the function chain. This means if the function chain resolved
        // to skip then all the remaining hooks on this milestone will also be
        // skipped and we will go to the next milestone
        return functions.reduce(function(prev, current) {
          return prev.then(function runHookFunction(skipNext) {
            // if any asked to skip keep returning true to avoid calling further
            // functions inside this hook
            if (skipNext) return true;

            var decisionPromise = new Promise(function(resolve) {
              _.assign(context, {
                skip: function() {
                  resolve(context.skip);
                },
                stop: function() {
                  resolve(new errors.RequestCompleted());
                },
                continue: function() {
                  resolve(context.continue);
                },
                error: function(status, message, errorList, cause) {
                  // if the second parameter is undefined then we are being
                  // passed an error to rethrow, otherwise build an EpilogueError
                  if (_.isUndefined(message) || status instanceof errors.EpilogueError) {
                    resolve(status);
                  } else {
                    resolve(new errors.EpilogueError(status, message, errorList, cause));
                  }
                }
              });
            });

            return Promise.resolve(current.call(self, req, res, context))
              .then(function(result) {
                // if they were returned directly or as a result of a promise
                if (_.includes([context.skip, context.continue, context.stop], result)) {
                  // call it to resolve the decision
                  result();
                }

                return decisionPromise.then(function(decision) {
                  if (decision === context.continue) return false;
                  if (decision === context.skip) return true;

                  // must be an error/context.stop, throw the decision for error handling
                  if (process.domain) {
                    // restify wraps the server in domain and sets error handlers that get in the way of mocha
                    // https://github.com/dchester/epilogue/issues/83
                    return Promise.reject(decision);
                  }
                  throw decision;
                });
              });
          });
        }, Promise.resolve(false));
      });
    });

    hookChain = hookChain.then(function() {
      // clear any passed results so the next milestone will run even if a
      // _after said to skip
      return false;
    });
  });

  hookChain
    .catch(errors.RequestCompleted, _.noop)
    .catch(self.model ? self.model.sequelize.ValidationError : errors.RequestCompleted, function(err) {
      var errorList = _.reduce(err.errors, function(result, error) {
        result.push({ field: error.path, message: error.message });
        return result;
      }, []);
      self.error(req, res, new errors.BadRequestError(err.message, errorList, err));
    })
    .catch(errors.EpilogueError, function(err) {
      self.error(req, res, err);
    })
    .catch(function(err) {
      if (err.isBoom) { // support for boom
        self.error(req, res, new errors.EpilogueError(
          err.output.statusCode,
          err.output.payload.error,
          [err.output.payload.message],
          err
        ));
      } else {
        self.error(req, res, new errors.EpilogueError(500, 'internal error', [err.message], err));
      }

    })
    .then(function() {
      res.send();
    });
};

Controller.prototype.milestone = function(name, callback) {
  if (!_.includes(Controller.hooks, name))
    throw new Error('invalid milestone: ' + name);

  if (!this[name]) {
    this[name] = [];
  } else if (!Array.isArray(this[name])) {
    this[name] = [ this[name] ];
  }

  this[name].push(callback);

};

module.exports = Controller;
