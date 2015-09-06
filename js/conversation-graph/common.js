define(["require", "exports"], function(require, exports) {

    var Counter = (function () {
        function Counter() {
            this.data = {};
        }
        Counter.prototype.inc = function (key) {
            this.data[key] ? ++this.data[key] : this.data[key] = 1;
        };

        Counter.prototype.get = function (key) {
            return this.data[key] || 0;
        };
        return Counter;
    })();
    exports.Counter = Counter;

    var NumberCounter = (function () {
        function NumberCounter() {
            this.data = [];
        }
        NumberCounter.prototype.inc = function (key) {
            this.data[key] ? ++this.data[key] : this.data[key] = 1;
        };

        NumberCounter.prototype.get = function (key) {
            return this.data[key] || 0;
        };

        NumberCounter.prototype.getAll = function () {
            return this.data;
        };
        return NumberCounter;
    })();
    exports.NumberCounter = NumberCounter;

    var Coll = (function () {
        function Coll() {
        }
        Coll.single = function (collection, predicate) {
            for (var i = 0; i < collection.length; ++i) {
                if (predicate(collection[i], i))
                    return collection[i];
            }
            return undefined;
        };

        Coll.has = function (collection, predicate) {
            return Coll.single(collection, predicate);
        };

        Coll.where = function (collection, predicate) {
            var ret = [];
            for (var i = 0; i < collection.length; ++i) {
                if (predicate(collection[i], i))
                    ret.push(collection[i]);
            }
            return ret;
        };

        Coll.count = function (collection, predicate) {
            return Coll.where(collection, predicate).length;
        };

        Coll.removeOneByPredicate = function (collection, predicate) {
            var first = collection.filter(predicate)[0];
            if (first) {
                collection.splice(collection.indexOf(first), 1);
                return true;
            } else {
                return false;
            }
        };

        Coll.removeByPredicate = function (collection, predicate) {
            var filtered = collection.filter(predicate).reverse();
            filtered.forEach(function (value, index) {
                return collection.splice(index, 1);
            });
        };

        Coll.koRemoveWhere = function (collection, predicate) {
            var where = Coll.where(collection(), predicate);
            if (where.length > 0)
                collection.removeAll(where);
            return where;
        };

        Coll.randomChoice = function (collection, amount) {
            var coll = collection.slice(0);
            var ret = [];
            for (var i = 0; i < amount; ++i) {
                if (coll.length == 0)
                    break;
                var index = Math.floor(Math.random() * coll.length);
                ret.push(coll[index]);
                coll.splice(index, 1);
            }
            return ret;
        };
        return Coll;
    })();
    exports.Coll = Coll;

    var Comp = (function () {
        function Comp() {
        }
        Comp.jsonEq = function (x, y) {
            return JSON.stringify(x) == JSON.stringify(y);
        };

        Comp.genericEq = function (x, y) {
            return x.eq(y);
        };
        return Comp;
    })();
    exports.Comp = Comp;

    var Callbacks = (function () {
        function Callbacks() {
        }
        Callbacks.atOnce = function (callbacks, onSuccess) {
            var ctr = callbacks.length;

            var onReady = function () {
                --ctr;
                if (ctr <= 0)
                    onSuccess && onSuccess();
            };
            for (var i = 0; i < callbacks.length; ++i)
                callbacks[i](onReady);
        };

        Callbacks.batch = function (callbacks, then) {
            var createHandler = function (handler) {
                return function (err) {
                    if (!err)
                        handler();
                    else
                        then(err);
                };
            };
            var func = function (i) {
                if (i >= callbacks.length)
                    then();
                else {
                    try  {
                        if (i >= callbacks.length - 1)
                            callbacks[i](createHandler(then));
                        else
                            callbacks[i](createHandler(func.bind(null, i + 1)));
                    } catch (e) {
                        then(e);
                    }
                }
            };
            func(0);
        };
        return Callbacks;
    })();
    exports.Callbacks = Callbacks;

    var Obj = (function () {
        function Obj() {
        }
        Obj.props = function (obj) {
            var ret = [];
            for (var prop in obj) {
                ret.push(prop);
            }
            return ret;
        };
        return Obj;
    })();
    exports.Obj = Obj;
});
