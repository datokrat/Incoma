define(['../webtext', '../datetime', '../event', '../conversation-graph/util', '../conversation-graph/conversation-graph-lowlevel'], function(Webtext, DateTime, Events, Util, ConversationGraph) {

	function RightPanel_Abstraction(PARENT) {
		var _this = this;
		this.inputPanelReset = new Events.EventImpl();
		this.inputPanelModeChanged = new Events.EventImpl();
		this.shownItemChanged = new Events.EventImpl();
		
		this.thoughtType = new Util.Selection();
		this.thoughtLinkType = new Util.Selection();
		
		this.saving = Util.createObservable(false);
		
		this.inputPanelMode = InputPanelModes.None;
		this.shown = { kindOfSelection: KindsOfSelection.None, type: ConversationGraph.SelectionTypes.None, item: null };
	
		this.init = function() {
			PARENT.graph.selection.selectionChanged.subscribe(onSelectionChanged);
			PARENT.graph.mouseOver.selectionChanged.subscribe(onMouseOverSelectionChanged);
		}
		
		this.openCloseReplyPanel = function(value) {
			toggleInputPanelMode(InputPanelModes.Reply, value);
		}
		
		this.openCloseLinkPanel = function(value) {
			toggleInputPanelMode(InputPanelModes.Link, value);
		}
		
		this.isInputPanelVisible = function() {
			return _this.shown.type == ConversationGraph.SelectionTypes.Thought && _this.shown.kindOfSelection == KindsOfSelection.Selected;
		}
		
		function toggleInputPanelMode(mode, value) {
			if(value === undefined) value = _this.inputPanelMode != mode;
			if(!value) _this.inputPanelMode = InputPanelModes.None;
			else _this.inputPanelMode = mode;
			_this.inputPanelModeChanged.raise();
		}
		
		this.saveThought = function(args) {
			args.thoughtType = _this.thoughtType.item();
			args.linkType = _this.thoughtLinkType.item();
			
			_this.saving(true);
			PARENT.saveThought(args)
			.done(function() {
				_this.saving(false);
				_this.openCloseReplyPanel(false);
			})
			.fail(function() {
				_this.saving(false);
				alert(Webtext.tx_an_error + ' ' + err);
			});
		}
		
		function onSelectionChanged(args) {
			setInputPanelMode(InputPanelModes.None);
			_this.inputPanelReset.raise();
			
			updateShownItem();
		}
		
		function onMouseOverSelectionChanged(args) {
			updateShownItem();
		}
		
		function updateShownItem() {
			if(isItemSelected(mouseOverSelection) && !Util.hashEquals(mouseOverSelection.item(), selection.item()) && !mouseOverSelection.item().expanded)
				showMouseOverItem();
			else if(isItemSelected(selection))
				showSelectedItem();
			else
				showNothing();
		}
		
		function showSelectedItem() {
			_this.shown = { kindOfSelection: KindsOfSelection.Selected, type: selection.type(), item: selection.item() };
			_this.shownItemChanged.raise();
		}
		
		function showMouseOverItem() {
			_this.shown = { kindOfSelection: KindsOfSelection.MouseOver, type: mouseOverSelection.type(), item: mouseOverSelection.item() };
			_this.shownItemChanged.raise();
		}
		
		function showNothing() {
			_this.shown = { kindOfSelection: KindsOfSelection.None, type: ConversationGraph.SelectionTypes.None, item: null };
			_this.shownItemChanged.raise();
		}
		
		function setInputPanelMode(value) {
			if(_this.inputPanelMode == value) return;
			_this.inputPanelMode = value;
			_this.inputPanelModeChanged.raise();
		}
		
		function isItemSelected(selection) {
			switch(selection.type()) {
				case ConversationGraph.SelectionTypes.Conversation:
				case ConversationGraph.SelectionTypes.Thought:
					return true;
				default:
					return false;
			}
		}
		
		var selection = PARENT.graph.selection, mouseOverSelection = PARENT.graph.mouseOver
	}

	function RightPanel_Presentation(ABSTR) {
		this.init = function() {
			ABSTR.inputPanelModeChanged.subscribe(showHideInputPanelControls);
			ABSTR.shownItemChanged.subscribe(onShownItemChanged);
			ABSTR.saving.changed.subscribe(onSavingStateChanged);
			
			$('#right_bar_header #contentlabel').css('background-color', 'rgb(227,226,230)');
			$(".right_bar").resizable({
				handles: 'w, s',
				minWidth: 335,
	  			resize: function() {
					$(this).css("left", 0);
				}
			});
			
			$('#saving').hide();
			
			$('#showreply').text(Webtext.tx_reply);
			$('#showreply').click(ABSTR.openCloseReplyPanel.bind(ABSTR, true));
			$('#showconnect').text(Webtext.tx_connect);
			$('#showconnect').click(ABSTR.openCloseLinkPanel.bind(ABSTR, true));
			$('#showeditnode').attr('title', Webtext.tx_edit_thought);
			
			clear();
			
			replyPanel.init();
			linkPanel.init();
		}
		
		function onShownItemChanged() {
			clear();
			showKindOfSelection();
			showContents();
			showHideInputPanelControls();
		}
		
		function showKindOfSelection() {
			$('#right_bar_header #contentlabel').attr('data-bordermode', getBorderMode());
		}
		
		function getBorderMode() {
			switch(ABSTR.shown.kindOfSelection) {
				case KindsOfSelection.Selected: return ConversationGraph.BorderModes.Selected;
				case KindsOfSelection.MouseOver: return ConversationGraph.BorderModes.MouseOver;
				default: return ConversationGraph.BorderModes.None;
			}
		}
		
		function showContents() {
			switch(ABSTR.shown.type) {
				case ConversationGraph.SelectionTypes.Conversation: showConversationContents(); break;
				case ConversationGraph.SelectionTypes.Thought: showThoughtContents(); break;
				default: clear();
			}
		}
		
		function showHideInputPanelControls() {
			if(ABSTR.isInputPanelVisible())
				applyInputPanelMode();
			else
				$('#showreply, #showconnect').hide();
		}
		
		function applyInputPanelMode() {
			var showHide = function($n, b) { b ? $n.show() : $n.hide() };
			showHide($('#showreply'), ABSTR.inputPanelMode != InputPanelModes.Reply);
			showHide($('#showconnect'), ABSTR.inputPanelMode != InputPanelModes.Link);
		}
		
		function showConversationContents() {
			var d = ABSTR.shown.item;
			
			$('#right_bar_header #contentlabel .right_bar_title_main').text(d.title);
			$('#contbox').html('');
			appendLineToContent(d.thoughtnum + ' ' + Webtext.tx_thoughts);
			appendLineToContent('created: ' + DateTime.timeAgo(d.creationtime));
			appendLineToContent(Webtext.tx_activity +": " + DateTime.timeAgo(d.lasttime));
			appendLineToContent(Webtext.tx_language + ": " + d.language);
		}
		
		function showThoughtContents() {
			var d = ABSTR.shown.item;
			
			$('#right_bar_header #contentlabel').css('background-color', thoughtLiveAttributes.nodeColor(d));
			$('#right_bar_header #contentlabel .right_bar_title_main').text(ThoughtTypeAttributes[d.type].name);
		
			$('#contbox').html('');
			appendLineToContent(URLlinks(nl2br(d.content)));
		}
		
		function clear() {
			$('#right_bar_header #contentlabel').css('background-color', 'rgb(227,226,230)');
			$('#right_bar_header #contentlabel').attr('data-bordermode', ConversationGraph.BorderModes.None);
			$('#right_bar_header #contentlabel *').html('');
			$('#contbox').html('');
			$('#showreply, #showconnect, #showeditnode').hide();
		}
		
		function onSavingStateChanged(state) {
			if(state) $('#saving').show();
			else $('#saving').fadeOut(300);
		}
		
		function appendLineToContent(text) {
			var line = $('<span></span>'); line.html(text+'<br />');
			appendNodeToContent(line);
		}
		
		function appendNodeToContent($node) {
			$('#contbox').append($node);
		}
		
		var thoughtLiveAttributes = new ConversationGraph.ThoughtLiveAttributes(ABSTR.graph);
		var replyPanel = new ReplyPanel_Presentation(ABSTR);
		var linkPanel = new LinkPanel_Presentation(ABSTR);
	}

	function ReplyPanel_Presentation(ABSTR) {
		var _this = this;
		
		this.init = function() {
			ABSTR.inputPanelModeChanged.subscribe(onInputPanelModeChanged);
			ABSTR.shownItemChanged.subscribe(onShownItemChanged);
			ABSTR.thoughtType.selectionChanged.subscribe(onThoughtTypeChanged);
			
			onInputPanelModeChanged();
			
			$('.tx_type_reply').text(Webtext.tx_type_reply);
			$('.tx_type_connection').text(Webtext.tx_type_connection);
			$('.tx_summary_reply').text(Webtext.tx_summary_reply);
			$('#savenode').text(Webtext.tx_save);
			$('#savenode').click(onClickSaveNode);
			
			initDropDowns();
		}
		
		function initDropDowns() {
			thoughtTypeDropDown = new DdSlick();
			thoughtTypeDropDown.selectionChanged.subscribe(ABSTR.thoughtType.selectTypeFn());
			setPropertiesTo({
				$nodeFn: function() { return $('#replynodetype') },
				text: Webtext.tx_type_reply,
				elementIds: Object.keys(ConversationGraph.ThoughtTypes).map(function(key) { return ConversationGraph.ThoughtTypes[key] }),
				elementAttributes: ThoughtTypeAttributes,
				selectedId: ConversationGraph.ThoughtTypes.General
			}, thoughtTypeDropDown);
			
			thoughtLinkTypeDropDown = new DdSlick();
			thoughtLinkTypeDropDown.selectionChanged.subscribe(ABSTR.thoughtLinkType.selectTypeFn());
			setPropertiesTo({
				$nodeFn: function() { return $('#replylinktype') },
				text: Webtext.tx_type_connect,
				elementIds: Object.keys(ConversationGraph.ThoughtLinkTypes).map(function(key) { return ConversationGraph.ThoughtLinkTypes[key] }),
				elementAttributes: ThoughtLinkTypeAttributes,
				selectedId: ConversationGraph.ThoughtLinkTypes.General
			}, thoughtLinkTypeDropDown);
		}
		
		function onInputPanelModeChanged() {
			if(ABSTR.inputPanelMode == InputPanelModes.Reply) open();
			else close();
		}
		
		function open() {
			thoughtTypeDropDown.prepare();
			prepareThoughtLinkTypeDropDown();
			$('#replypanel').show();
		}
		
		function close() {
			$('#replypanel').hide();
			$('#replybox').val('');
			$('#replyboxsum').val('');
		}
		
		function show() {
			$('#replypanel').show();
		}
		
		function hide() {
			$('#replypanel').hide();
		}
		
		function onShownItemChanged() {
			if(ABSTR.shown.kindOfSelection == KindsOfSelection.MouseOver) hide();
			else if(ABSTR.inputPanelMode == InputPanelModes.Reply) show();
		}
		
		function onThoughtTypeChanged() {
			prepareThoughtLinkTypeDropDown();
		}
		
		function prepareThoughtLinkTypeDropDown() {
			thoughtLinkTypeDropDown.selectedId = ConversationGraph.ThoughtLinkTypes.General;
			thoughtLinkTypeDropDown.elementIds = AllowedThoughtLinkTypes[ABSTR.thoughtType.item()];
			thoughtLinkTypeDropDown.prepare();
		}
		
		function onClickSaveNode() {
			//make sure no necessary field is empty
			if($('#replybox').val() == '') {
				replyAlert(Webtext.tx_write_something + '!');
				return;
			}
			
			ABSTR.saveThought({
				content: $('#replybox').val(),
				summary: $('#replyboxsum').val()
			})
		}
		
		function replyAlert(text) {
				var alert = $('#replyalert');
				alert(text) = text;
				$('#replybox').highlight(2000);
				setTimeout(function() { alert.html('&nbsp;') }, 2000);
		}
		
		var thoughtTypeDropDown = null;
		var thoughtLinkTypeDropDown = null;
	}
	
	function LinkPanel_Presentation(ABSTR) {
		var self = this;
		
		this.init = function() {
			ABSTR.inputPanelModeChanged.subscribe(applyInputPanelState);
			ABSTR.shownItemChanged.subscribe(onShownItemChanged);
			applyInputPanelState();
			
			initCaptions();
			initDropDowns();
		}
		
		function applyInputPanelState() {
			if(ABSTR.inputPanelMode == InputPanelModes.Link) open();
			else close();
		}
		
		function onShownItemChanged() {
			if(ABSTR.shown.kindOfSelection == KindsOfSelection.MouseOver) hide();
			else if(ABSTR.inputPanelMode == InputPanelModes.Link) show();
		}
		
		function initCaptions() {
			$('.tx_cancel').text(Webtext.tx_cancel);
		}
		
		function initDropDowns() {
			linkTypeDropDown = new DdSlick();
			linkTypeDropDown.selectionChanged.subscribe(ABSTR.thoughtLinkType.selectTypeFn());
			setPropertiesTo({
				$nodeFn: function() { return $('#connectlinktype') },
				text: Webtext.tx_type_relation,
				elementIds: Object.keys(ConversationGraph.ThoughtLinkTypes).map(function(key) { return ConversationGraph.ThoughtLinkTypes[key] }), //TODO: no "No Relation"
				elementAttributes: ThoughtLinkTypeAttributes,
				selectedId: ConversationGraph.ThoughtLinkTypes.General
			}, linkTypeDropDown);
			linkTypeDropDown.prepare();
		}
		
		function open() {
			$('#linkpanel').show();
		}
		
		function close() {
			$('#linkpanel').hide();
		}
		
		function show() {
			$('#linkpanel').show();
		}
		
		function hide() {
			$('#linkpanel').hide();
		}
		
		var linkTypeDropDown = null;
	}
	
	function DdSlick() {
		var _this = this;
		
		this.$nodeFn = null;
		this.elementIds = [];
		this.elementAttributes = [];
		this.text = null;
		
		this.selectedId = null;
		this.selectionChanged = new Events.EventImpl();
		
		this.prepare = function() {
			var data = _this.elementIds.map(function(id) {
				var elementAttributes = _this.elementAttributes[id];
				return {
					text: elementAttributes.name,
					value: elementAttributes.value,
					selected: elementAttributes.value == _this.selectedId,
					imageSrc: elementAttributes.image
				}
			});
			_this.$nodeFn().ddTslick('destroy');
			_this.$nodeFn().ddTslick({
				data: data,
				selectText: _this.text,
				width: 135,
				height:25*(_this.elementIds.length),
				background: "#fff",
				onSelected: function(args){
					_this.selectionChanged.raise(args.selectedData.value);
				}
			});
		}
	}
	
	var ThoughtTypeAttributes = {};
	ThoughtTypeAttributes[ConversationGraph.ThoughtTypes.General] = { name: Webtext.tx_general };
	ThoughtTypeAttributes[ConversationGraph.ThoughtTypes.Question] = { name: Webtext.tx_question };
	ThoughtTypeAttributes[ConversationGraph.ThoughtTypes.Proposal] = { name: Webtext.tx_proposal };
	ThoughtTypeAttributes[ConversationGraph.ThoughtTypes.Info] = { name: Webtext.tx_info };
	for(var typeId in ThoughtTypeAttributes) {
		var attributes = ThoughtTypeAttributes[typeId];
		attributes.value = typeId;
		attributes.image = 'img/node'+typeId+'.png';
	}
	
	var ThoughtLinkTypeAttributes = {};
	ThoughtLinkTypeAttributes[ConversationGraph.ThoughtLinkTypes.General] = { name: Webtext.tx_general };
	ThoughtLinkTypeAttributes[ConversationGraph.ThoughtLinkTypes.Agreement] = { name: Webtext.tx_agreement };
	ThoughtLinkTypeAttributes[ConversationGraph.ThoughtLinkTypes.Disagreement] = { name: Webtext.tx_disagreement };
	ThoughtLinkTypeAttributes[ConversationGraph.ThoughtLinkTypes.Consequence] = { name: Webtext.tx_consequence };
	ThoughtLinkTypeAttributes[ConversationGraph.ThoughtLinkTypes.Alternative] = { name: Webtext.tx_alternative };
	ThoughtLinkTypeAttributes[ConversationGraph.ThoughtLinkTypes.Equivalence] = { name: Webtext.tx_equivalence };
	ThoughtLinkTypeAttributes[ConversationGraph.ThoughtLinkTypes.None] = { name: Webtext.tx_norelation };
	for(var typeId in ThoughtLinkTypeAttributes) {
		var attributes = ThoughtLinkTypeAttributes[typeId];
		attributes.value = typeId;
		attributes.image = 'img/link'+typeId+'.png';
	}
	
	var AllowedThoughtLinkTypes = arrayToObject([
		ConversationGraph.ThoughtTypes.General, values(ConversationGraph.ThoughtLinkTypes),
		ConversationGraph.ThoughtTypes.Question, [ConversationGraph.ThoughtLinkTypes.General, ConversationGraph.ThoughtLinkTypes.None],
		ConversationGraph.ThoughtTypes.Proposal, [ConversationGraph.ThoughtLinkTypes.General, ConversationGraph.ThoughtLinkTypes.Alternative, ConversationGraph.ThoughtLinkTypes.None],
		ConversationGraph.ThoughtTypes.Info, values(ConversationGraph.ThoughtLinkTypes)
	]);
	
	function arrayToObject(arr) {
		var obj = {};
		for(var i=0; i<arr.length-1; i+=2)
			obj[arr[i]]=arr[i+1];
		return obj;
	}
	
	function values(obj) {
		return Object.keys(obj).map(function(k) { return obj[k] });
	}
	
	function mouseEnterLeave(enter, leave) {
		var over = false;
		return function(node) {
			node.on('mouseover', function(d) {
				if(over) return;
				over = true;
				enter(d);
			});
			node.on('mouseout', function(d) {
				if(!over) return;
				over = false;
				leave(d);
			});
		}
	}
	
	//replace multiple URLs inside a string in html links
	function URLlinks(text) {
	    var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9é-ú+&@#\/%?=~_|!:,.;]*[-A-Z0-9é-ú+&@#\/%=~_|])/ig;
	    return text.replace(exp,"<a href='$1' target='_blank'>$1</a>");
	}
	
	//replace line breaks with <br> html tags
	function nl2br (str, is_xhtml) {
		var breakTag = (is_xhtml || typeof is_xhtml === 'undefined') ? '<br />' : '<br>';    
		return (str + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1'+ breakTag +'$2');
	}
	
	function setPropertiesTo(props, obj) {
		for(var key in props)
			obj[key] = props[key];
	}
	
	var InputPanelModes = {
		None: 0,
		Reply: 1,
		Link: 2,
	};
	
	var KindsOfSelection = {
		None: 0,
		Selected: 1,
		MouseOver: 2,
	};
	
	return {
		Presentation: RightPanel_Presentation,
		Abstraction: RightPanel_Abstraction,
		LinkPanelPresentation: LinkPanel_Presentation,
		ReplyPanelPresentation: ReplyPanel_Presentation
	}
})
