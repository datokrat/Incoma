define(['../webtext'], function(Webtext) {
	var exports = {};
	
	
	var ThoughtTypes = exports.ThoughtTypes = {
		General: 1,
		Question: 2,
		Proposal: 3,
		Info: 4,
	};
	
	var ThoughtLinkTypes = exports.ThoughtLinkTypes = {
		General: 1,
		Agreement: 2,
		Disagreement: 3,
		Consequence: 4,
		Alternative: 5,
		Equivalence: 6,
		None: 0,
	}
	
	var ThoughtTypeAttributes = exports.ThoughtTypeAttributes = {};
	ThoughtTypeAttributes[ThoughtTypes.General] = { name: Webtext.tx_general };
	ThoughtTypeAttributes[ThoughtTypes.Question] = { name: Webtext.tx_question };
	ThoughtTypeAttributes[ThoughtTypes.Proposal] = { name: Webtext.tx_proposal };
	ThoughtTypeAttributes[ThoughtTypes.Info] = { name: Webtext.tx_info };
	for(var typeId in ThoughtTypeAttributes) {
		var attributes = ThoughtTypeAttributes[typeId];
		attributes.value = typeId;
		attributes.image = 'img/node'+typeId+'.png';
	}

	var ThoughtLinkTypeAttributes = exports.ThoughtLinkTypeAttributes = {};
	ThoughtLinkTypeAttributes[ThoughtLinkTypes.General] = { name: Webtext.tx_general };
	ThoughtLinkTypeAttributes[ThoughtLinkTypes.Agreement] = { name: Webtext.tx_agreement };
	ThoughtLinkTypeAttributes[ThoughtLinkTypes.Disagreement] = { name: Webtext.tx_disagreement };
	ThoughtLinkTypeAttributes[ThoughtLinkTypes.Consequence] = { name: Webtext.tx_consequence };
	ThoughtLinkTypeAttributes[ThoughtLinkTypes.Alternative] = { name: Webtext.tx_alternative };
	ThoughtLinkTypeAttributes[ThoughtLinkTypes.Equivalence] = { name: Webtext.tx_equivalence };
	ThoughtLinkTypeAttributes[ThoughtLinkTypes.None] = { name: Webtext.tx_norelation, isNullLink: true };
	for(var typeId in ThoughtLinkTypeAttributes) {
		var attributes = ThoughtLinkTypeAttributes[typeId];
		attributes.value = typeId;
		attributes.image = 'img/link'+typeId+'.png';
	}
	
	return exports;
});
