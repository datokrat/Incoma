define(['../event'], function(Events) {
	function Selection() {
		var _this = this;
		this.selectionChanged = new Events.EventImpl();
		
		this.select = function(_sel) {
			if(!Selection.equals(sel, _sel))
				_this.reselect(_sel);
		}
		
		this.reselect = function(_sel) {
			var old = Selection.clone(sel);
			Selection.clone(_sel, sel);
			_this.selectionChanged.raise({ oldValue: old, value: sel, somethingSelected: sel.item != null, typeChanged: function(type) {
				return sel.type == type || old.type == type;
			} });
		}
		
		this.clear = function() {
			_this.select({ type: null, item: null });
		}
		
		this.selectTypeFn = function(type) {
			return function(item) { return _this.select({ item: item, type: type }) };
		}
		
		this.type = function() {
			return sel.type;
		}
		
		this.item = function(type) {
			if(type === undefined || _this.type() == type) return sel.item;
			else return null;
		}
		
		var sel = { item: null, type: null };
	}
	Selection.clone = function(from, to) {
		to = to || {};
		to.type = from.type;
		to.item = from.item;
		return to;
	}
	Selection.equals = function(x, y) {
		return x.type == y.type && x.item == y.item;
	}
	
	function hashEquals(x, y) {
		if(x == y) return true;
		if(!x || !y) return false;
		return x.hash == y.hash;
	}
	
	function createObservable(value) {
		var savedValue = value;
		var obs = function(val) {
			if(val !== undefined && val !== savedValue) {
				savedValue = val;
				obs.changed.raise(savedValue);
			}
			return savedValue;
		};
		obs.changed = new Events.EventImpl();
		return obs;
	}
	
	return { Selection: Selection, hashEquals: hashEquals, createObservable: createObservable };
})