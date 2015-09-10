define(['pac-builder', 'conversation-graph/conversation-graph-lowlevel', 'conversation-graph/db', 'event', 'webtext', 'datetime', 'scaler', 'model', 'conversation-graph/util'], 
function(PacBuilder, ConversationGraph, Db, Events, Webtext, DateTime, Scaler, Model, Util) {
	function ConversationGraphVis() {
		this.name = "conversation graph";
		PacBuilder(this, ConversationGraph_Presentation, ConversationGraph_Abstraction, ConversationGraph_Control);
	
	    this.init = function (html5node) {
	        this.abstraction.init();
	        this.presentation.init(html5node);
	        this.control.init();
	    }
	
	    this.destroy = function () {
	    	this.presentation.destroy();
	    }
	}
	
	function ConversationGraph_Abstraction() {
		var _this = this;
		this.graph = new ConversationGraph.Abstraction();
		
		this.inputPanelChanged = new Events.EventImpl();
		
		this.thoughtType = new Util.Selection();
		this.thoughtLinkType = new Util.Selection();
		
		this.inputPanel = "none";
		this.saving = createObservable(false);
		
		this.init = function() {
			this.graph.conversationExpanded.subscribe(onConversationExpanded);
			
			loadConversationList()
			.then(applyConversationListToGraphData);
		}
		
		function applyConversationListToGraphData() {
			var nodes = conversationList;
			var links = globalLinkList.map(function(l) {
				return { source: conversationHashLookup[l.source_conv], target: conversationHashLookup[l.target_conv], type: l.type };
			});
			
			_this.graph.addToConversationGraph(nodes, links);
		}
		
		this.openCloseReplyPanel = function(open) {
			if(open) _this.inputPanel = "reply";
			else _this.inputPanel = "none";
			_this.inputPanelChanged.raise();
			_this.thoughtType.reselect({ item: ThoughtTypes.General });
		}
		
		this.saveThought = function(args) {
			if(_this.graph.selection.type() != ConversationGraph.SelectionTypes.Thought) return;
			
			_this.saving(true);
			var savePromise;
			var error = function(err) { _this.saving(false); alert(Webtext.tx_an_error + ' ' + err) };
			
			var replyTo = _this.graph.selection.item();
			var thoughtType = _this.thoughtType.item();
			var linkType = _this.thoughtLinkType.item();
			
			var newLinks = [];
			var newNodes = [];
			
			//make sure a name is specified
			requestUserName()
			.done(function() {
				//create thought and link data objects
				var time = new Date().getTime(); var timeSeconds = Math.floor(time/1000);
				var randomPlusMinus = function() { return Math.random() < 0.5 ? -1 : 1 };
				var unhashed = args.content + args.summary + thoughtType + _this.userName + time; //TODO: security?
				var hash = parseInt(Model.nodehashit(unhashed));
				var newThought = {
			        hash: hash,
			        content: args.content,
			        contentsum: args.summary,
			        evalpos: 1,
					evalneg: 0,
			        evaluatedby: [_this.userName],
			        adveval: [0,0,0,0],
			        advevalby: [[],[],[],[]],
			        type: thoughtType,
			        author: _this.userName,
					seed: (linkType == ThoughtLinkTypes.None) ? 1 : 0,
			        time: timeSeconds,
			        x: replyTo.x + randomPlusMinus()*10*(Math.random()+1),
			        y: replyTo.y + randomPlusMinus()*10*(Math.random()+1)
				};
				newNodes.push(newThought);
				
				if(linkType != ThoughtLinkTypes.None) {
					var newLink = {
						hash: hash, 
						source: newThought, 
						target: replyTo,
						direct: 0,
						evalpos: 1,
						evalneg: 0,
						evaluatedby: [_this.userName],
			   		    adveval: [0,0,0,0,0,0],
					    advevalby: [[],[],[],[],[],[]],
						type: linkType,
						author: _this.userName,
						time: timeSeconds
					};
					var newLinkDbData = cloneObj(newLink);
					newLinkDbData.source = newThought.hash;
					newLinkDbData.target = replyTo.hash;
					
					newLinks.push(newLink);
					
					savePromise = Db.saveNode(newThought)
					.then(function() { return Db.saveLink(newLinkDbData) }, error );
					savePromise.fail(error);
				}
				else {
					savePromise = Db.saveNode(newThought);
					savePromise.fail(error);
				}
				
				_this.graph.addCreatedConversationThought(replyTo.conversation, newThought, newLink);
				
				_this.openCloseReplyPanel(false);
				
				savePromise.done(function() {
					_this.saving(false);
				});
				
				//TODO: elastic?
				//TODO: hash_lookup
			})
			.fail(function() {
				//TODO
			});
		}
		
		function cloneObj(obj) {
			var ret = {};
			for(var k in obj) ret[k] = obj[k];
			return ret;
		}
		
		function requestUserName() {
			var promise = new $.Deferred();
			
			//TODO
			//if(_this.userName && _this.userName != '') promise.resolve();
			//else _this.nameNeeded.raise(function() { promise.resolve() }, function() { promise.reject() });
			_this.userName = 'anonymous';
			promise.resolve();
			
			return promise;
		}
		
		function loadConversationList() {
			var promise = $.Deferred();
			Db.getConversations(function(result) {
				conversationList = result.conversations;
				conversationList.forEach(function(c) { conversationHashLookup[c.hash] = c });
				globalLinkList = result.links;
				promise.resolve();
			});
			return promise;
		}
		
		this.loadConversation = function(d) {
			var promise = $.Deferred();
			
			d.loading = true;
			d.error = false;
			_this.graph.conversationLoadingStateChanged.raise(d);
			Db.loadAndReturnConversationModel(d.hash)
			.then(function(model) {
				d.loading = false;
				d.error = false;
				_this.graph.conversationLoadingStateChanged.raise(d);
				for(var i=0; i<model.nodes.length; ++i) hashLookup[model.nodes[i].hash] = model.nodes[i];
				var links = model.links.map(function(l) { return { 
					source: hashLookup[l.source], 
					target: hashLookup[l.target],
					type: l.type,
					direct: l.direct,
				} });
				//TODO: global links hash lookup
				promise.resolve({ nodes: model.nodes, links: links, incomingGlobalLinks: model.incomingGlobalLinks, outgoingGlobalLinks: model.outgoingGlobalLinks  })
			})
			.fail(function(error) {
				console.log(error, d);
				d.loading = false;
				d.error = error;
				_this.graph.conversationLoadingStateChanged.raise(d);
				promise.reject(error);
			});
			return promise;
		}
		
		function onConversationExpanded(d) {
			_this.loadConversation(d)
			.done(function(result) {
				result.incomingGlobalLinks.forEach(function(rawLink) {
					var sourceConv = conversationHashLookup[rawLink.source_conv];
					if(sourceConv.expanded) {
						var link = { source: hashLookup[rawLink.source], target: hashLookup[rawLink.target], type: rawLink.type };
						_this.graph.addGlobalLink(sourceConv, d, link);
					}
				});
				result.outgoingGlobalLinks.forEach(function(rawLink) {
					var targetConv = conversationHashLookup[rawLink.target_conv];
					if(targetConv.expanded) {
						var link = { source: hashLookup[rawLink.source], target: hashLookup[rawLink.target], type: rawLink.type };
						_this.graph.addGlobalLink(d, targetConv, link);
					}
				});
				_this.graph.addConversationThoughts(d, result.nodes, result.links);
			});
		}
		
		var conversationList = [], globalLinkList = [];
		var hashLookup = [];
		var conversationHashLookup = [];
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
	
	function ConversationGraph_Presentation(ABSTR) {
		var _this = this;
		
		this.init = function(html5node) {
			scaler = new Scaler();
			scaler.viewPortChanged.subscribe(onViewPortDragged);
			
			insertStyle();
			insertHtml(html5node)
			.then(initHtmlBoundObjects)
			.then(initSvg)
			.then(initConversationPresentation)
			.then(initThoughtPresentation);
		}
		
		this.destroy = function() {
			style.remove();
		}
		
		function onViewPortDragged(args) {
			if(args.transitionTime) updateViewPort(args.translate.x, args.translate.y, args.zoom, true, args.transitionTime);
			else updateViewPort(args.translate.x, args.translate.y, args.zoom, false);
		}
	    
	    function updateViewPort(tx, ty, zoom, isAnimation, transitionTime) {
	    	var object = isAnimation ? svgContainer.transition().ease("cubic-out").duration(transitionTime) : svgContainer;
	        object.attr("transform","translate(" + tx + ',' + ty + ") scale(" + zoom + ")");
	    };
		
		function initConversationPresentation() {
			conversationPresentation = new ConversationGraph.ConversationPresentation(ABSTR.graph, { svg: svgContainer, tooltip: tooltip, size: { width: width, height: height } });
			conversationPresentation.init();
		}
		
		function initThoughtPresentation() {
			thoughtPresentation = new ConversationGraph.ThoughtPresentation(ABSTR.graph, { svg: svgContainer, tooltip: tooltip, size: { width: width, height: height } });
			thoughtPresentation.init();
		}
		
		function insertStyle() {
			style = $('<link>');
			style.attr({ type: 'text/css', rel: 'stylesheet', href: './css/conversation-graph.css' });
			$('head').append(style);
		}
		
		function insertHtml(html5node) {
			return $.ajax({ url: './templates/conversation-graph.html', dataType: 'html' })
			.done(function(template) {
				$(html5node).html(template);
			});
		}
		
		function initHtmlBoundObjects() {
			tooltip = new Tooltip($('#tooltip'));
			
			rightPanel = new RightPanel_Presentation(ABSTR);
			rightPanel.init();
		}
		
		function initSvg() {
			svg = d3.select('.svg').append('svg')
			.attr('width', width)
			.attr('height', height)
			
			bg = svg.append('svg:rect')
			.attr('width', width)
			.attr('height', height)
			.attr('fill', 'white')
			.on('click', ABSTR.graph.clearSelection.bind(ABSTR.graph))
			.call(d3.behavior.zoom().scaleExtent([1,8]).on('zoom', scaler.rescale));
			
			svgContainer = svg.append('svg:g');
		}
		
		var thoughtPresentation;
		
		var style;
		var width = $(window).width();
		var height = $(window).height();
		var svg, svgContainer, bg;
		var force;
		var scaler;
		var nodes, links;
		var tooltip, rightPanel;
		var dragging = false;
	}
	
	function Tooltip($tooltip) {
		this.showTooltipAt$Node = function(node) {
			$tooltip.css('left', node.offset().left - $tooltip.outerWidth()/2);
			$tooltip.css('top', node.offset().top - $tooltip.outerHeight());
			$tooltip.show();
		}
		
		this.hideTooltip = function() {
			$tooltip.hide();
		}
		
		this.$ = function() {
			return $tooltip;
		}
	}
	
	function ConversationGraph_Control() {
		this.init = function() {}
	}
	
	function RightPanel_Presentation(ABSTR) {
		this.init = function() {
			ABSTR.graph.selection.selectionChanged.subscribe(onSelectionChanged);
			ABSTR.graph.mouseOver.selectionChanged.subscribe(onMouseOverSelectionChanged);
			ABSTR.inputPanelChanged.subscribe(onInputPanelChanged);
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
			$('#showeditnode').attr('title', Webtext.tx_edit_thought);
			
			clear();
			
			replyOrLinkPanel.init();
		}
		
		function onInputPanelChanged() {
			var showHide = function($n, b) { b ? $n.show() : $n.hide() };
			showHide($('#showreply'), ABSTR.inputPanel != 'reply');
			showHide($('#showconnect'), ABSTR.inputPanel != 'connect');
		}
		
		function onSelectionChanged(args) {
			if(args.value.type == ConversationGraph.SelectionTypes.Conversation) onConversationSelected(args.value.item);
			else if(args.value.type == ConversationGraph.SelectionTypes.Thought) onThoughtSelected(args.value.item);
			else if(args.value.type == null) clear();
		}
		
		function onConversationSelected(d) {
			clear();
			if(d) {
				onSomethingSelected();
				$('#right_bar_header #contentlabel .right_bar_title_main').text(d.title);
			
				$('#contbox').html('');
				appendLineToContent(d.thoughtnum + ' ' + Webtext.tx_thoughts);
				appendLineToContent('created: ' + DateTime.timeAgo(d.creationtime));
				appendLineToContent(Webtext.tx_activity +": " + DateTime.timeAgo(d.lasttime));
				appendLineToContent(Webtext.tx_language + ": " + d.language);
			}
		}
		
		function onThoughtSelected(d) {
			clear();
			if(d) {
				onSomethingSelected();
				$('#right_bar_header #contentlabel').css('background-color', thoughtLiveAttributes.nodeColor(d));
				$('#right_bar_header #contentlabel .right_bar_title_main').text(ThoughtTypeAttributes[d.type].name);
			
				$('#contbox').html('');
				appendLineToContent(URLlinks(nl2br(d.content)));
				
				$('#showreply, #showconnect').show();
			}
		}
		
		function onMouseOverSelectionChanged(args) {
			if(args.value.type == ConversationGraph.SelectionTypes.Thought) onMouseOverThoughtChanged(args.value.item);
			else if(args.oldValue.type == ConversationGraph.SelectionTypes.Thought) onMouseOverThoughtChanged(null);
		}
		
		function onMouseOverThoughtChanged(d) {
			if(d && !hashEquals(ABSTR.graph.selection.item(), d)) {
				clear();
				$('#right_bar_header #contentlabel').attr('data-bordermode', ConversationGraph.BorderModes.MouseOver);
				$('#right_bar_header #contentlabel').css('background-color', thoughtLiveAttributes.nodeColor(d));
				$('#right_bar_header #contentlabel .right_bar_title_main').text(ThoughtTypeAttributes[d.type].name);
			
				$('#contbox').html('');
				appendLineToContent(URLlinks(nl2br(d.content)));
			}
			else {
				showSelected();
			}
		}
		
		function showSelected() {
			clear();
			if(ABSTR.graph.selection.type() == ConversationGraph.SelectionTypes.Conversation) onConversationSelected(ABSTR.graph.selection.item());
			else if(ABSTR.graph.selection.type() == ConversationGraph.SelectionTypes.Thought) onThoughtSelected(ABSTR.graph.selection.item());
		}
		
		function onSomethingSelected() {
			$('#right_bar_header #contentlabel').attr('data-bordermode', ConversationGraph.BorderModes.Selected);
		}
		
		function clear() {
			$('#right_bar_header #contentlabel').css('background-color', 'rgb(227,226,230)');
			$('#right_bar_header #contentlabel').attr('data-bordermode', ConversationGraph.BorderModes.None);
			$('#right_bar_header #contentlabel *').html('');
			$('#contbox').html('');
			$('#showreply, #showconnect, #showeditnode').hide();
		}
		
		function onSavingStateChanged(state) {
			if(state) {
				$('#saving').show();
			}
			else {
				$('#saving').fadeOut(300);
			}
		}
		
		function appendLineToContent(text) {
			var line = $('<span></span>'); line.html(text+'<br />');
			appendNodeToContent(line);
		}
		
		function appendNodeToContent($node) {
			$('#contbox').append($node);
		}
		
		var thoughtLiveAttributes = new ConversationGraph.ThoughtLiveAttributes(ABSTR.graph);
		var replyOrLinkPanel = new ReplyOrLinkPanel_Presentation(ABSTR);
	}
	
	function ReplyOrLinkPanel_Presentation(ABSTR) {
		var _this = this;
		
		this.init = function() {
			ABSTR.inputPanelChanged.subscribe(onChanged);
			ABSTR.thoughtType.selectionChanged.subscribe(onThoughtTypeChanged);
			
			onChanged();
			
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
				elementIds: Object.keys(ThoughtTypes).map(function(key) { return ThoughtTypes[key] }),
				elementAttributes: ThoughtTypeAttributes,
				selectedId: ThoughtTypes.General
			}, thoughtTypeDropDown);
			
			thoughtLinkTypeDropDown = new DdSlick();
			thoughtLinkTypeDropDown.selectionChanged.subscribe(ABSTR.thoughtLinkType.selectTypeFn());
			setPropertiesTo({
				$nodeFn: function() { return $('#replylinktype') },
				text: Webtext.tx_type_connect,
				elementIds: Object.keys(ThoughtLinkTypes).map(function(key) { return ThoughtLinkTypes[key] }),
				elementAttributes: ThoughtLinkTypeAttributes,
				selectedId: ThoughtLinkTypes.General
			}, thoughtLinkTypeDropDown);
		}
		
		function onChanged() {
			if(ABSTR.inputPanel == "reply") openReplyPanel();
			else closeReplyPanel();
		}
		
		function openReplyPanel() {
			thoughtTypeDropDown.prepare();
			$('#replypanel').show();
		}
		
		function closeReplyPanel() {
			$('#replypanel').hide();
			$('#replybox').val('');
			$('#replyboxsum').val('');
		}
		
		function onThoughtTypeChanged() {
			prepareThoughtLinkTypeDropDown();
		}
		
		function prepareThoughtLinkTypeDropDown() {
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
	
	var ThoughtTypes = {
		General: 1,
		Question: 2,
		Proposal: 3,
		Info: 4,
	};
	var ThoughtTypeAttributes = {};
	ThoughtTypeAttributes[ThoughtTypes.General] = { name: Webtext.tx_general };
	ThoughtTypeAttributes[ThoughtTypes.Question] = { name: Webtext.tx_question };
	ThoughtTypeAttributes[ThoughtTypes.Proposal] = { name: Webtext.tx_proposal };
	ThoughtTypeAttributes[ThoughtTypes.Info] = { name: Webtext.tx_info };
	for(var typeId in ThoughtTypeAttributes) {
		var attributes = ThoughtTypeAttributes[typeId];
		attributes.value = typeId;
		attributes.image = 'img/node'+typeId+'.png';
	}
	
	var ThoughtLinkTypes = {
		General: 1,
		Agreement: 2,
		Disagreement: 3,
		Consequence: 4,
		Alternative: 5,
		Equivalence: 6,
		None: 0,
	}
	var ThoughtLinkTypeAttributes = {};
	ThoughtLinkTypeAttributes[ThoughtLinkTypes.General] = { name: Webtext.tx_general };
	ThoughtLinkTypeAttributes[ThoughtLinkTypes.Agreement] = { name: Webtext.tx_agreement };
	ThoughtLinkTypeAttributes[ThoughtLinkTypes.Disagreement] = { name: Webtext.tx_disagreement };
	ThoughtLinkTypeAttributes[ThoughtLinkTypes.Consequence] = { name: Webtext.tx_consequence };
	ThoughtLinkTypeAttributes[ThoughtLinkTypes.Alternative] = { name: Webtext.tx_alternative };
	ThoughtLinkTypeAttributes[ThoughtLinkTypes.Equivalence] = { name: Webtext.tx_equivalence };
	ThoughtLinkTypeAttributes[ThoughtLinkTypes.None] = { name: Webtext.tx_norelation };
	for(var typeId in ThoughtLinkTypeAttributes) {
		var attributes = ThoughtLinkTypeAttributes[typeId];
		attributes.value = typeId;
		attributes.image = 'img/link'+typeId+'.png';
	}
	
	var AllowedThoughtLinkTypes = arrayToObject([
		ThoughtTypes.General, values(ThoughtLinkTypes),
		ThoughtTypes.Question, [ThoughtLinkTypes.General, ThoughtLinkTypes.None],
		ThoughtTypes.Proposal, [ThoughtLinkTypes.General, ThoughtLinkTypes.Alternative, ThoughtLinkTypes.None],
		ThoughtTypes.Info, values(ThoughtLinkTypes)
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
	
	//converts from hex color to rgba color; TODO: duplicate -> visualisation-zoomout.js
	function hex2rgb(hex, opacity) {
	        var h=hex.replace('#', '');
	        h =  h.match(new RegExp('(.{'+h.length/3+'})', 'g'));
	
	        for(var i=0; i<h.length; i++)
	            h[i] = parseInt(h[i].length==1? h[i]+h[i]:h[i], 16);
	
	        if (typeof opacity != 'undefined')  h.push(opacity);
	
	        return 'rgba('+h.join(',')+')';
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
	
	function hashEquals(x, y) {
		if(x == y) return true;
		if(!x || !y) return false;
		return x.hash == y.hash;
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
	
	return ConversationGraphVis;
});
