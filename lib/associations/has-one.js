'use strict';

var _ = require('lodash');

module.exports = function(Resource, resource, association) {
  // access points
  var subResourceName = _.kebabCase(association.target.options.name.singular);

  var associatedResource = new Resource({
    app: resource.app,
    sequelize: resource.sequelize,
    model: association.target,
    endpoints: [resource.endpoints.plural + '/{' + association.identifierField + '}/' + subResourceName],
    actions: ['read'],
    auth: resource.routeConfig.auth
  });

  // @todo: this could be improved
  associatedResource.associationOptions = resource.associationOptions;
  associatedResource.controllers.read.includeAttributes = [ association.identifierField ];
  return associatedResource;
};
