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
			_this.selectionChanged.raise({ oldValue: old, value: sel, typeChanged: function(type) {
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
	
	return { Selection: Selection };
})
