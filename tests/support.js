'use strict';

var Sequelize = require('sequelize'),
    hapi = require('hapi'),
    chai = require('chai'),
    Bluebird = require('bluebird');

var TestFixture = {
  models: {},
  Sequelize: Sequelize,

  initializeDatabase: function() {
    return TestFixture.db.sync({ force: true });
  },

  initializeServer: function() {
    TestFixture.server = TestFixture.app = new hapi.Server();

    TestFixture.server.connection({
      host: 'localhost',
      port: 8000
    });

    TestFixture.baseUrl = TestFixture.server.info.uri;

    return Bluebird.fromCallback(function(cb) { TestFixture.server.start(cb); });
  },

  clearDatabase: function() {
    return TestFixture.db
      .getQueryInterface()
      .dropAllTables();
  },

  closeServer: function() {
    return Bluebird.fromCallback(function(cb) { TestFixture.server.stop(cb); });
  }
};

before(function() {
  TestFixture.db = new Sequelize('main', null, null, {
    dialect: 'sqlite',
    storage: ':memory:',
    logging: (process.env.SEQ_LOG ? console.log : false)
  });
});

// always print stack traces when an error occurs
chai.config.includeStack = true;

module.exports = TestFixture;
