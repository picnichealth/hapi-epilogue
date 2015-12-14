'use strict';

var _ = require('lodash');

module.exports = function(Resource, resource, association) {
  // access points
  var subResourceName = _.kebabCase(association.target.options.name.plural);

  var associatedResource = new Resource({
    app: resource.app,
    sequelize: resource.sequelize,
    model: association.target,
    endpoints: [
      resource.endpoints.plural + '/{' + association.identifierField + '}/' + subResourceName + '',
      resource.endpoints.plural + '/{' + association.identifierField + '}/' + subResourceName + '/{id}'
    ],
    actions: ['read', 'list'],
    auth: resource.routeConfig.auth
  });

  // @todo: this could be improved
  associatedResource.associationOptions = resource.associationOptions;
  associatedResource.controllers.read.includeAttributes = [ association.identifierField ];
  associatedResource.controllers.list.includeAttributes = [ association.identifierField ];

  associatedResource.list.fetch.before(function(req, res, context) {
    // Filter
    context.criteria = context.criteria || {};
    context.criteria[association.identifierField] = req.params[association.identifierField];
    context.continue();
  });

  return associatedResource;
};
