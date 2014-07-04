(function() {
  var Promise = function() {
    // 2.1 A Promise must be in one of three states: pending, fulfilled or
    //     rejected
    var PENDING = 0, FULFILLED = 1, REJECTED = 2;
    var promiseState = PENDING;


    // 2.1.2.2 When fulfilled, a promise must have a value, which must not
    //         change
    // 2.1.3.2 When rejected, a promise must have a reason, which must not
    //         change
    var promiseValue = null;


    // 2.2.2.1 If onFulfilled is a function, it must not be called before
    //         promise is fulfilled
    // 2.2.3.1 If onRejected is a function, it must not be called before
    //         promise is rejected
    var fulfilledCallbacks = [];
    var rejectedCallbacks = [];


    // 2.2.2.3 If onFulfilled is a function, it must not be called more than
    //         once
    // 2.2.3.3 If onRejected is a function, it must not be called more than
    //         once
    var runningCallbacks = null;
    var callbackIndex = 0;
    var currentlyExecutingCallbacks = false;


    var scheduleCallbacks = function() {
      if (runningCallbacks === null) {
        currentlyExecutingCallbacks = false;
        return;
      }

      if (callbackIndex >= runningCallbacks.length) {
        currentlyExecutingCallbacks = false;
        return;
      }

      currentlyExecutingCallbacks = true;

      // 2.2.4 onFulfilled or onRejected must not be called until the execution
      //       context stack contains only platform code
      // (Per note 3.2, the Promise code is considered platform code)
      setTimeout(runCallback, 0);
    };


    // 2.2.1 Both onFulfilled and onRejected are optional arguments:
    // 2.2.1.1 If onFulfilled is not a function, it must be ignored
    // 2.2.1.2 If onRejected is not a function, it must be ignored
    var fnOrNull = function(f) {
      return typeof(f) === 'function' ? f : null;
    };

    
    var isPromise = function(maybePromise) {
      return isPromise instanceof Promise;
    };


    var isPropContainer = function(maybeContainer) {
      var t = typeof(maybeContainer);
      return t === 'function' || (t === 'object' && maybeContainer !== null);
    };


    var handleThenable = function(promise, value, then) {
      var resolvePromise = function(val) {
        // 2.3.3.3.3 If both resolvePromise and rejectPromise are called, or
        //           multiple calls to the same argument are made, the first
        //           call takes precedence, and any further calls are ignored
        if (resolvePromise.called || rejectPromise.called)
          return;

        resolvePromise.called = true;

        // 2.3.3.3.1 If/when resolvePromise is called with a value y,
        //           run [[Resolve]](promise, y)
        resolve(promise, val);
      };
      resolvePromise.called = false;

      var rejectPromise = function(reason) {
        // 2.3.3.3.3 If both resolvePromise and rejectPromise are called, or
        //           multiple calls to the same argument are made, the first
        //           call takes precedence, and any further calls are ignored
        if (resolvePromise.called || rejectPromise.called)
          return;

        rejectPromise.called = true;

        // 2.3.3.3.2 If/when rejectPromise is called with a reason r,
        //           reject promise with r
        promise.reject(reason);
      };
      rejectPromise.called = false;

      try {
        // 2.3.3.3 If then is a function, call it with x as this, first
        //         argument resolvePromise, and second argument rejectPromise
        then.call(value, resolvePromise, rejectPromise);
      } catch (e) {
        // 2.3.3.4 If calling then throws an exception e,
        // 2.3.3.4.1 If resolvePromise or rejectPromise have been called,
        //           ignore it
        if (!resolvePromise.called && !rejectPromise.called) {
          // 2.3.3.4.2 Otherwise, reject promise with e as the reason
          promise.reject(e);
        }
      }
    };


    var resolve = function(promise, value) {
      // 2.3.1 If promise and x refer to the same object, reject promise with
      //       a TypeError as the reason
      if (promise === value) {
        promise.reject(new TypeError('Value returned by callback was this promise'));
        return;
      }

      // 2.3.2 If x is a promise, adopt its state
      if (isPromise(value)) {
        // 2.3.2.1 If x is pending, promise must remain pending until x is
        //         fulfilled or rejected
        // 2.3.2.2 If/when x is fulfilled, fulfill promise with the same value
        // 2.3.2.3 If/when x is rejected, reject promise with the same reason
        var onFulfillCB = function(val) {
          promise.fulfill(val);
        };
        var onRejectCB = function(reason) {
          promise.reject(reason);
        };

        value.then(onFulfillCB, onRejectCB);
      } else if (isPropContainer(value)) {
        // 2.3.3 Otherwise, if x is an object or function
        var valueThen;

        try {
          // 2.3.3.1 Let then be x.then
          valueThen = value.then;
        } catch (e) {
          // 2.3.3.3 If retrieving the property x.then results in a thrown
          //         exception e, reject promise with e as the reason
          promise.reject(e);
          return;
        }

        if (typeof(valueThen) === 'function') {
          // 2.3.3.3 If then is a function, call it with x as this, first
          //         argument resolvePromise, and second argument rejectPromise
          handleThenable(promise, value, valueThen);
        } else {
          // 2.3.3.4 If then is not a function, fulfill promise with x
          promise.fulfill(value);
        }
      } else {
        // 2.3.4 If x is not an object or function, fulfill promise with x
        promise.fulfill(value);
      }
    };


    var runCallback = function() {
      // Assumes callbackIndex points to a valid index in runningCallbacks

      // 2.2.1 Both onFulfilled and onRejected are optional arguments:
      // 2.2.1.1 If onFulfilled is not a function, it must be ignored
      // 2.2.1.2 If onRejected is not a function, it must be ignored
      var cbEntry = runningCallbacks[callbackIndex];
      var callback = fnOrNull(cbEntry.callback); 

      var result;
      var exceptionCaught = false;

      if (callback !== null) {
        try {
          // 2.2.5 onFulfilled and onRejected must be called as functions
          //       (i.e. with no this value)
          result = callback(promiseValue);
        } catch (e) {
          // 2.2.7.2 If either onFulfilled or onRejected throws an exception e,
          //         promise2 must be rejected with e as the reason 
          exceptionCaught = true;
          cbEntry.promiseFunction = function(p) {
            p.reject(e);
          };
        }

        if (!exceptionCaught) {
          // 2.2.7.1 If either onFulfilled or onRejected returns a value x, run
          //         the Promise Resolution Procedure [[Resolve]](promise2, x)
          cbEntry.promiseFunction = function(p) {
            resolve(p, result);
          };
        }
      } else {
        // 2.2.7.3 If onFulfilled is not a function and promise1 is fulfilled,
        //         promise2 must be fulfilled with the same value as promise1
        // 2.2.7.4 If onRejected is not a function and promise1 is rejected,
        //         promise2 must be rejected with the same reason as promise1
        cbEntry.promiseFunction = function(p) {
          if (promiseState === FULFILLED)
            p.fulfill(promiseValue);
          else
            p.reject(promiseValue);
        };
      }

      // Iterate over the promises that were added when then was called with this
      // callback
      if (cbEntry.promiseFunction !== undefined)
        cbEntry.promises.forEach(function(p) {
            cbEntry.promiseFunction(p);
        });

      // 2.2.6.1 If/when promise is fulfilled, all respective onFulfilled callbacks
      //         must execute in the order of their originating calls to then
      // 2.2.6.2 If/when promise is rejected, all respective onRejected callbacks
      //         must execute in the order of their originating calls to then
      callbackIndex += 1;
      scheduleCallbacks();
    };


    var fulfill = function(value) {
      // 2.1.2 When fulfilled, a promise:
      // 2.1.2.1 must not transition to any other state
      // 2.1.2.2 must have a value, which must not change
      // 2.1.3 When rejected, a promise:
      // 2.1.3.1 must not transition to any other state
      // 2.1.3.2 must have a reason, which must not change
      if (promiseState !== PENDING)
        return;

      promiseValue = value;
      promiseState = FULFILLED;

      // Allow the rejected callbacks to be garbage-collected: we will never call them
      rejectedCallbacks = null;

      runningCallbacks = fulfilledCallbacks;
      callbackIndex = 0;

      scheduleCallbacks();
    };


    var reject = function(reason) {
      // 2.1.2 When fulfilled, a promise:
      // 2.1.2.1 must not transition to any other state
      // 2.1.2.2 must have a value, which must not change
      // 2.1.3 When rejected, a promise:
      // 2.1.3.1 must not transition to any other state
      // 2.1.3.2 must have a reason, which must not change
      if (promiseState !== PENDING)
        return;

      promiseValue = reason;
      promiseState = REJECTED;

      // Allow the fulfilled callbacks to be garbage-collected: we will never call them
      fulfilledCallbacks = null;

      runningCallbacks = rejectedCallbacks;
      callbackIndex = 0;

      scheduleCallbacks();
    };


    var getCallbackIndex = function(callback, callbackArray) {
      var index = -1;

      callbackArray.some(function(cbEntry, i) {
        if (cbEntry.callback === callback) {
          index = i;
          return true;
        }

        return false;
      });

      return index;
    };


    var addCallback = function(callback, promise, callbackArray) {
      // 2.2.2.3 If onFulfilled is a function, it must not be called more than
      //         once
      // 2.2.3.3 If onRejected is a function, it must not be called more than
      //         once
      var index = getCallbackIndex(callback, callbackArray);
      if (index !== -1) {
        var promiseArray = callbackArray[callbackIndex].promises;
        if (promiseArray.indexOf(promise) === -1)
          promiseArray.push(promise);

        return index;
      }

      // 2.2.6.1 If/when promise is fulfilled, all respective onFulfilled
      //         callbacks must execute in the order of their originating
      //         calls to then
      // 2.2.6.2 If/when promise is rejected, all respective onRejected
      //         callbacks must execute in the order of their originating
      //         calls to then
      return callbackArray.push({callback: callback, promises: [promise]}) - 1;
    };


    // 2.2 A promise must provide a "then" method to access its current or
    //     eventual value or reason
    var then = function(onFulfilled, onRejected) {
      // 2.2.7 then must return a promise
      var p = Promise();

      if (promiseState === PENDING) {
        // 2.2.2.1 If onFulfilled is a function, it must not be called before
        //         promise is fulfilled
        // 2.2.3.1 If onRejected is a function, it must not be called before
        //         promise is rejected
        addCallback(onFulfilled, p, fulfilledCallbacks);
        addCallback(onRejected, p, rejectedCallbacks);
      } else {
        var callbackToUse = promiseState === FULFILLED ? onFulfilled : onRejected;
        var index = addCallback(callbackToUse, p, runningCallbacks);

        if (index === runningCallbacks.length - 1) {
          // If we're already iterating through the callbacks, there is nothing to
          // be done
          if (currentlyExecutingCallbacks)
            return p;

          // Otherwise, manually restart callback execution
          scheduleCallbacks();
          return p;
        }

        // This must be a callback we have seen before. We might need to schedule
        // an out-of-band update for the new promise if we've already iterated
        // beyond this callback
        if (callbackIndex > index) {
          var promiseFunc = runningCallbacks[index].promiseFunction;
 
          if (promiseFunc)
            setTimeout(function() {promiseFunc(p);}, 0);
        }
      }

      // 2.2.7 then must return a promise
      return p;
    };

    var defineConst = function(obj, prop, val) {
      Object.defineProperty(obj, prop,
       {configurable: false, enumerable: true, writable: false, value: val});
    };

    // Use the right proto to allow instanceof checks
    var promiseObj = Object.create(Object.getPrototypeOf(Promise));
    defineConst(promiseObj, 'then', then);
    defineConst(promiseObj, 'fulfill', fulfill);
    defineConst(promiseObj, 'resolve', fulfill);
    defineConst(promiseObj, 'reject', reject);


    return promiseObj;
  };


  module.exports = Promise;
})();
