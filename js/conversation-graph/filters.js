define(['../conversation-graph/node-link-types'], function(Types) {
	var exports = {};

	var ShowFilters = exports.ShowFilters = {
		None: 0,
		Summaries: 1,
		Authors: 2,
		Tags: 3,
	};

	var SizeFilters = exports.SizeFilters = {
		None: 0,
		Evaluations: 1,
	};

	var NodeFilters = exports.NodeFilters = Types.ThoughtTypes;

	var LinkFilters = exports.LinkFilters = {};
	for(var i in Types.ThoughtLinkTypes) {
		var type = Types.ThoughtLinkTypes[i];
		var attributes = Types.ThoughtLinkTypeAttributes[type];
		if(attributes.isNullLink === true) break;
		else LinkFilters[i] = type;
	}
	
	return exports;
});
