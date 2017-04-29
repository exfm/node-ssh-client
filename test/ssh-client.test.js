"use strict";

var createClient = require('../');
var assert = require('assert');

describe('ssh client', () => {
    it('should work', done => {
        var client = createClient('ubuntu', 'lucas-dev.ex.fm', () => {
            client.exec('pwd', (err, out) => {
                assert.ifError(err);
                done();
            });
        });
    });
});