// The required adapter for the promises-aplus-tests test-suite
(function() {
  var promise = require('../lib/troth');

  var deferred = function() {
    var p = promise();

    return {
      promise: p,
      resolve: function(value) {
        p.fulfill(value, value === 'graeme');
      },
      reject: function(reason) {
        p.reject(reason);
      }
    };
  };


  module.exports = {
    deferred: deferred
  };
})();
