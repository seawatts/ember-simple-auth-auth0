import { assign } from '@ember/polyfills';
import EmberObject, { set, get } from '@ember/object';
import Evented from '@ember/object/evented';
import test from 'ember-sinon-qunit/test-support/test';
import sinon from 'sinon';
import createSessionDataObject from 'ember-simple-auth-auth0/utils/create-session-data-object';

import { module } from 'qunit';

import {
  setupTest,
} from 'ember-qunit';

const StubLock = EmberObject.extend(Evented, {
  profile: null,
  shouldThrowGetUserInfoError: false,
  getUserInfo(idToken, callback) {
    if (get(this, 'shouldThrowGetUserInfoError')) {
      callback(new Error('failed to get profile'));
    } else {
      callback(null, get(this, 'profile'));
    }
  },
  show: sinon.stub(),
});

module('Unit | Service | auth0', function(hooks) {
  setupTest(hooks);

  hooks.beforeEach(function() {
    this.registerConfig = function(config) {
      const defaultConfig = {
        rootURL: '/test',
        ['ember-simple-auth']: {
          auth0: {}
        }
      };

      config = assign(defaultConfig, config);
      this.owner.register('config:environment', config);
      return config;
    };

    this.stubLock = function(stubbedLock) {
      stubbedLock = stubbedLock || StubLock.create();
      return this.stub().returns(stubbedLock);
    };

    this.windowLocation = function() {
      return [
        window.location.protocol,
        '//',
        window.location.host,
      ].join('');
    };
  });

  test('it calculates the logoutURL correctly giving logoutReturnToURL precedence', function(assert) {
    const config = this.registerConfig({
      ['ember-simple-auth']: {
        auth0: {
          logoutReturnToURL: `${this.windowLocation()}/my-login`
        }
      }
    });

    let service = this.owner.lookup('service:auth0');
    assert.equal(get(service, 'logoutReturnToURL'),
      config['ember-simple-auth'].auth0.logoutReturnToURL);
  });

  test('it calculates the logoutURL from logoutReturnToPath correctly', function(assert) {
    const config = this.registerConfig({
      ['ember-simple-auth']: {
        auth0: {
          logoutReturnToPath: '/my-login'
        }
      }
    });

    let service = this.owner.lookup('service:auth0');
    let path = config['ember-simple-auth'].auth0.logoutReturnToPath
    assert.equal(get(service, 'logoutReturnToURL'), `${this.windowLocation()}${path}`);
  });

  test('showLock calls getUserInfo', function(assert) {
    assert.expect(1);
    const done = assert.async();
    const stubbedLock = StubLock.create();
    const profile = {
      user_id: '1',
    };
    const authenticatedData = {
      idToken: '1.2.3',
    };

    const expectedData = createSessionDataObject(profile, authenticatedData);

    set(stubbedLock, 'profile', profile);
    const subject = this.owner.factoryFor('service:auth0').create({
      getAuth0LockInstance: this.stubLock(stubbedLock)
    });

    subject.showLock()
      .then((data) => assert.deepEqual(data, expectedData))
      .catch(() => assert.notOk(true))
      .finally(done);

    stubbedLock.trigger('authenticated', authenticatedData);
  });

  test('showLock rejects when authenticatedData does not exist', function(assert) {
    assert.expect(1);
    const done = assert.async();
    const stubbedLock = StubLock.create();
    const subject = this.owner.factoryFor('service:auth0').create({
      getAuth0LockInstance: this.stubLock(stubbedLock)
    });

    subject.showLock()
      .then(() => assert.notOk(true))
      .catch(() => assert.ok(true))
      .finally(done);

    stubbedLock.trigger('authenticated');
  });

  test('showLock rejects when getUserInfo returns an error', function(assert) {
    assert.expect(1);
    const done = assert.async();
    const stubbedLock = StubLock.create({
      shouldThrowGetUserInfoError: true
    });

    const subject = this.owner.factoryFor('service:auth0').create({
      getAuth0LockInstance: this.stubLock(stubbedLock)
    });

    subject.showLock()
      .then(() => assert.notOk(true))
      .catch(() => assert.ok(true))
      .finally(done);

    stubbedLock.trigger('authenticated', { idToken: '1.2.3' });
  });
});
