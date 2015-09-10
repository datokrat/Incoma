define(['pac-builder', 'conversation-graph/conversation-graph-lowlevel', 'conversation-graph/db', 'event', 'webtext', 'scaler', 'model', 'conversation-graph/util', 'conversation-graph/right-panel'], 
function(PacBuilder, ConversationGraph, Db, Events, Webtext, Scaler, Model, Util, RightPanel) {
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
		this.rightPanel = new RightPanel.Abstraction(this);
		
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
			_this.thoughtType.reselect({ item: ConversationGraph.ThoughtTypes.General });
		}
		
		this.openCloseLinkPanel = function(open) {
			if(open) _this.inputPanel = "link";
			else _this.inputPanel = "none";
			_this.inputPanelChanged.raise();
			_this.thoughtLinkType.reselect({ item: ConversationGraph.ThoughtLinkTypes.General });
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
					seed: (linkType == ConversationGraph.ThoughtLinkTypes.None) ? 1 : 0,
			        time: timeSeconds,
			        x: replyTo.x + randomPlusMinus()*10*(Math.random()+1),
			        y: replyTo.y + randomPlusMinus()*10*(Math.random()+1)
				};
				newNodes.push(newThought);
				
				if(linkType != ConversationGraph.ThoughtLinkTypes.None) {
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
			
			rightPanel = new RightPanel.Presentation(ABSTR.rightPanel);
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
	
	return ConversationGraphVis;
});
