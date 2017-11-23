'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const Java = require('../java');

describe('Java', () => {
  let serverless;
  let java;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = {
      classes: {Error},
      service: {package: {cwd: process.env.TEST_CWD}},
      getProvider: sandbox.spy()
    };
    serverless.service.provider = {name: 'openwhisk'};
    java = new Java(serverless);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#match()', () => {
    it('should match with explicit runtime', () => {
      serverless.service.provider.runtime = 'java';
      expect(java.match({runtime: 'java'})).to.equal(true)
    });
  });

  describe('#exec()', () => {
    it('should return jar file byte for java handler', () =>
      java.exec({runtime: 'java', handler: "wow.KKK"}).then(result => {
        expect(result).to.deep.equal({main: "wow.KKK", kind: "java:default", code: "wwewewe"});
      })
    );
  });
});
