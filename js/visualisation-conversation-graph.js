define(['pac-builder', 'db', 'event', 'webtext', 'datetime', 'scaler'], function(PacBuilder, Db, Events, Webtext, DateTime, Scaler) {
	function ConversationGraph() {
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
		this.conversationListChanged = new Events.EventImpl();
		this.conversationLoadingStateChanged = new Events.EventImpl();
		this.conversationThoughtsChanged = new Events.EventImpl();
		
		this.selection = new Selection();
		this.mouseOver = new Selection();
		this.graph = { nodes: [], links: [] };
		this.thoughtGraph = { nodes: [], links: [] };
		
		this.init = function() {
			loadConversationList()
			.then(function() { _this.graph.nodes = conversationList })
			.then(ready);
		}
		
		this.waitUntilReady = function() {
			return ready;
		}
		
		function ready() {
			readyPromise.resolve();
		}
		
		this.getConversationList = function() {
			return conversationList;
		}
		
		function loadConversationList() {
			var promise = $.Deferred();
			Db.getconversations(function(resultList) {
				conversationList = resultList;
				_this.conversationListChanged.raise(conversationList);
				promise.resolve();
			});
			return promise;
		}
		
		this.loadConversation = function(d) {
			var promise = $.Deferred();
			
			d.loading = true;
			d.error = false;
			_this.conversationLoadingStateChanged.raise(d);
			Db.loadAndReturnConversationModel(d.hash)
			.then(function(model) {
				d.loading = false;
				d.error = false;
				_this.conversationLoadingStateChanged.raise(d);
				for(var i=0; i<model.nodes.length; ++i) hashLookup[model.nodes[i].hash] = model.nodes[i];
				var links = model.links.map(function(l) { return { 
					source: hashLookup[l.source], 
					target: hashLookup[l.target],
					type: l.type,
					direct: l.direct,
				} });
				promise.resolve({ nodes: model.nodes, links: links })
			})
			.fail(function(error) {
				d.loading = false;
				d.error = error;
				_this.conversationLoadingStateChanged.raise(d);
				promise.reject(error);
			});
			return promise;
		}
		
		this.expandConversation = function(d) {
				d.expanded = !d.expanded;
				d.loading = d.expanded ? true : false;
				_this.mouseOver.clear();
				
				if(d.expanded) {
					_this.loadConversation(d)
					.done(function(result) {
						addConversationThoughts(d, result.nodes, result.links);
					});
				}
				else {
					removeConversationThoughts(d); //TODO: what happens when collapsing whilst loading?
				}
		}
		
		function removeConversationThoughts(conv) {
			for(var i=0; i<_this.thoughtGraph.nodes.length; ++i) if(_this.thoughtGraph.nodes[i].conversation.hash == conv.hash) _this.thoughtGraph.nodes.splice(i--, 1);
			for(var i=0; i<_this.thoughtGraph.links.length; ++i) if(_this.thoughtGraph.links[i].conversation.hash == conv.hash) _this.thoughtGraph.links.splice(i--, 1);
			
			_this.conversationThoughtsChanged.raise();
		}
		
		function addConversationThoughts(conv, nodes, links) {
			for(var i in nodes) { nodes[i].conversation = conv; _this.thoughtGraph.nodes.push(nodes[i]) }
			for(var i in links) { links[i].conversation = conv; _this.thoughtGraph.links.push(links[i]) }
			
			_this.conversationThoughtsChanged.raise();
		}
		
		var conversationList = [];
		var hashLookup = [];
		var readyPromise = $.Deferred();
	}
	
	function Selection() {
		var _this = this;
		this.selectionChanged = new Events.EventImpl();
		
		this.select = function(_sel) {
			if(!Selection.equals(sel, _sel)) {
				var old = Selection.clone(sel);
				Selection.clone(_sel, sel);
				_this.selectionChanged.raise({ oldValue: old, value: sel, typeChanged: function(type) {
					return sel.type == type || old.type == type;
				} });
			}
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
	
	var SelectionTypes = {
		Conversation: 0,
		Thought: 1,
		ThoughtLink: 2,
	}
	
	function ConversationGraph_Presentation(ABSTR) {
		var _this = this;
		
		this.init = function(html5node) {
			scaler = new Scaler();
			scaler.viewPortChanged.subscribe(onViewPortDragged);
			ABSTR.selection.selectionChanged.subscribe(onSelectionChanged);
			ABSTR.mouseOver.selectionChanged.subscribe(onMouseOverSelectionChanged);
			
			ABSTR.conversationLoadingStateChanged.subscribe(onConversationLoadingStateChanged);
			
			initConstants();
			
			insertStyle();
			insertHtml(html5node)
			.then(initHtmlBoundObjects)
			.then(initSvg)
			.then(ABSTR.waitUntilReady)
			.then(initForce)
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
		
		function initThoughtPresentation() {
			thoughtPresentation = new ConversationGraph_ThoughtPresentation(ABSTR, { container: svgContainer });
			thoughtPresentation.init();
		}
		
		function onSelectionChanged(args) {
			if(args.typeChanged(SelectionTypes.Conversation)) updateNodeAttributes();
		}
		
		function onDblClickConversation(d) {
				ABSTR.expandConversation(d);
				updateGraph(); //TODO: right position?
		}
		
		function onConversationLoadingStateChanged() {
			updateGraph();
		}
		
		function onMouseEnterConversation(d) {
			ABSTR.mouseOver.select({ type: SelectionTypes.Conversation, item: d });
			
			if(!d.expanded) {
				tooltip.$().text(d.title);
				
				var $node = $(nodes.filter(function(d2) { return d2.hash == d.hash })[0]);
				tooltip.showTooltipAt$Node($node);
			}
		}
		
		function onMouseLeaveConversation(d) {
			ABSTR.mouseOver.clear();
			
			tooltip.hideTooltip();
		}
		
		function onMouseOverSelectionChanged(args) {
			if(args.typeChanged(SelectionTypes.Conversation)) updateNodeAttributes();
		}
		
		function onMouseOverConversationChanged() {
			updateNodeAttributes();
		}
		
		function initConstants() {
			constants = {
				borderColor: []
			};
			
			constants.borderColor[BorderMode.Selected] = '#333';  //TODO: liveAttributes?
			constants.borderColor[BorderMode.MouseOver] = '#c32222';
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
			.on('click', ABSTR.selection.clear)
			.call(d3.behavior.zoom().scaleExtent([1,8]).on('zoom', scaler.rescale));
			
			svgContainer = svg.append('svg:g');
		}
		
		function initForce() {
			force = d3.layout.force()
				.charge(liveAttributes.charge)
				.gravity(0.15)
				.linkDistance(150)
				.theta(0.95)
				.friction(0.85)
				.size([width, height])
				.nodes(ABSTR.graph.nodes)
				.links(ABSTR.graph.links);
			
			links = svgContainer.selectAll('.link')
	            .data(ABSTR.graph.links)
	            .enter().append("line")
	            .attr("class", "link")
	            .style("stroke", '#444')
	            .style("stroke-width", 5)
				.style("stroke-dasharray", '8,6')
				.style("stroke-linecap", "round")
				.style("stroke-opacity", 1);
				
			nodes = svgContainer.selectAll(".node")
	            .data(ABSTR.graph.nodes)
	            .enter().append('g');
	            
	        appendConversationSymbolTo(nodes);
			registerConversationNodeEvents();
			
			force.on('tick', onTick);
			force.start();
		}
		
		function registerConversationNodeEvents() {
			nodes.on('click', ABSTR.selection.selectTypeFn(SelectionTypes.Conversation));
			nodes.call(mouseEnterLeave(onMouseEnterConversation, onMouseLeaveConversation));
			nodes.on('dblclick', onDblClickConversation);
			nodes.call(force.drag);
		}
	
		function onTick() {
			links
				.attr('x1', function(d) { return d.source.x })
				.attr('y1', function(d) { return d.source.y })
				.attr('x2', function(d) { return d.target.x })
				.attr('y2', function(d) { return d.target.y });
			nodes
				.attr('transform', function(d) { return 'translate('+d.x +','+d.y+')' });
				
			thoughtPresentation.startEvolution();
		}
		
		function updateGraph() {
			//updateLinkAttributes();
			updateNodeAttributes();
			force.start();
		}
		
		function updateNodeAttributes() {
			nodes.selectAll('*').remove();
			appendConversationSymbolTo(nodes);
		}
		
		function appendConversationSymbolTo(parent) {
			parent
	            .append("circle")
	            .attr("class", "conv node")
	            .attr("r", liveAttributes.conversationRadius)
	            .attr('cx', 0)
	            .attr('cy', 0)
	            .attr('data-bordermode', liveAttributes.borderMode)
	        parent
	            .append("circle")
	            .attr("class", "sub node conversation-symbol")
	            .attr('data-filled', '1')
	            .attr('data-loading', liveAttributes.conversationLoading)
	            .attr('data-visible', liveAttributes.conversationSymbolVisible)
	            .attr("r", 3)
	            .attr('cx', 7)
	            .attr('cy', 0)
	        parent
	            .append("circle")
	            .attr("class", "sub node conversation-symbol")
	            .attr('data-filled', function(d) { return (d.thoughtnum >= 4) ? '2' : 'false' })
	            .attr('data-loading', liveAttributes.conversationLoading)
	            .attr('data-visible', liveAttributes.conversationSymbolVisible)
	            .attr("r", 3)
	            .attr('cx', 7*Math.cos(2*1/3*Math.PI))
	            .attr('cy', 7*Math.sin(2*1/3*Math.PI))
	        parent
	            .append("circle")
	            .attr("class", "sub node conversation-symbol")
	            .attr('data-filled',  function(d) { return (d.thoughtnum >= 10) ? '3' : 'false' })
	            .attr('data-loading', liveAttributes.conversationLoading)
	            .attr('data-visible', liveAttributes.conversationSymbolVisible)
	            .attr("r", 3)
	            .attr('cx', 7*Math.cos(2*2/3*Math.PI))
	            .attr('cy', 7*Math.sin(2*2/3*Math.PI))
	            
	        parent
	        	.filter(liveAttributes.error)
	        	.append('line')
	        	.attr('class', 'conversation-symbol')
	        	.attr({ x1: 0, x2: 0, y1: -10, y2: 0 })
	        	.style('stroke-width', '3px')
	        	.style('stroke', 'red')
				.style("stroke-linecap", "round")
	        parent
	        	.filter(liveAttributes.error)
	        	.append('circle')
	        	.attr('class', 'conversation-symbol')
	        	.attr({ cx: 0, cy: 8, r: 2 })
	        	.style('stroke-opacity', '0')
	        	.style('fill', 'red')
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
		var liveAttributes = new LiveAttributes(ABSTR);
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
	
	function ConversationGraph_ThoughtPresentation(ABSTR, svgData) {
		var _this = this;
		
		this.init = function() {
			ABSTR.selection.selectionChanged.subscribe(onSelectionChanged);
			ABSTR.mouseOver.selectionChanged.subscribe(onMouseOverSelectionChanged);
			
			ABSTR.conversationThoughtsChanged.subscribe(onConversationThoughtsChanged);
			
			tooltip = new Tooltip($('#tooltip'));
			
			force = d3.layout.force()
				.charge(-200)
				.gravity(0)
				.linkDistance(75)
				.theta(0.95)
				.friction(0.85)
				.size([width, height])
				.nodes(ABSTR.thoughtGraph.nodes)
				.links(ABSTR.thoughtGraph.links);
				
			drawLinks();
			drawLinkArrows();
			drawNodes();
				
			force.on('tick', onTick);
			_this.startEvolution();
		}
		
		function onConversationThoughtsChanged() {
			drawLinks();
			drawNodes();
			_this.startEvolution();
		}
		
		this.startEvolution = function() {
			force.start();
		}
		
		function onLinkClicked(d) {
			ABSTR.selection.select({ type: SelectionTypes.ThoughtLink, item: d });
		}
		
		function onNodeClicked(d) {
			ABSTR.selection.select({ type: SelectionTypes.Thought, item: d });
		}
		
		function onSelectionChanged(args) {
			if(args.value.type == SelectionTypes.Thought) onThoughtSelectionChanged(args.value.item);
			else if(args.oldValue.type == SelectionTypes.Thought) onThoughtSelectionChanged(null);
			
			if(args.value.type == SelectionTypes.ThoughtLink) onThoughtLinkSelectionChanged(args.value.item);
			else if(args.oldValue.type == SelectionTypes.ThoughtLink) onThoughtLinkSelectionChanged(null);
		}
		
		function onThoughtSelectionChanged(d) {
			updateNodeAttributes();
		}
		
		function onThoughtLinkSelectionChanged(d) {
			updateLinkBorder();
		}
		
		function onMouseEnter(d) {
			ABSTR.mouseOver.select({ type: SelectionTypes.Thought, item: d });
			updateNodeAttributes();
			
			var $node = $(objects.nodes.filter(function(d2) { return d.hash == d2.hash })[0]);
			
			tooltip.$().text(thoughtLiveAttributes.summary(d));
			tooltip.showTooltipAt$Node($node);
		}
		
		function onMouseLeave(d) {
			ABSTR.mouseOver.clear();
			
			tooltip.hideTooltip();
			updateNodeAttributes();
		}
		
		function onMouseEnterLink(d) {
			ABSTR.mouseOver.select({ type: SelectionTypes.ThoughtLink, item: d });
		}
		
		function onMouseLeaveLink(d) {
			ABSTR.mouseOver.clear();
		}
		
		function onMouseOverSelectionChanged(args) {
			if(args.value.type == SelectionTypes.ThoughtLink) onMouseOverLinkChanged(args.value.item);
			else if(args.oldValue.type == SelectionTypes.ThoughtLink) onMouseOverLinkChanged(null);
		}
		
		function onMouseOverLinkChanged(d) {
			updateLinkBorder();
		}
		
		function updateLinkBorder() {
			var over = ABSTR.mouseOver.item();
			var sel = ABSTR.selection.item();
			var active = [];
			var inactive = [];
			if(ABSTR.selection.type() == SelectionTypes.ThoughtLink && sel)
				active.push({ linkBorder: objects.selectedLinkBorder, d: sel })
			else inactive.push(objects.selectedLinkBorder);
			if(ABSTR.mouseOver.type() == SelectionTypes.ThoughtLink && over && !hashEquals(sel, over))
				active.push({ linkBorder: objects.mouseOverLinkBorder, d: over });
			else inactive.push(objects.mouseOverLinkBorder);
			
			
			active.forEach(function(item) {
				item.linkBorder
					.attr('x1', item.d.source.x)
					.attr('y1', item.d.source.y)
					.attr('x2', item.d.target.x)
					.attr('y2', item.d.target.y)
			})
			inactive.forEach(function(linkBorder) {
				linkBorder
					.attr('x1', 0)
					.attr('y1', 0)
					.attr('x2', 0)
					.attr('y2', 0)
			});
		}
		
		function drawLinks() {
			if(objects.mouseOverLinkBorder) objects.mouseOverLinkBorder.remove();
			objects.mouseOverLinkBorder = svgData.container.append('line')
				.attr('class', 'thought-overlink')
				.style('stroke', '#c32222') //TODO: unify borderColors
			if(objects.selectedLinkBorder) objects.selectedLinkBorder.remove();
			objects.selectedLinkBorder = svgData.container.append('line')
				.attr('class', 'thought-selectedlink')
				.style('stroke', '#333') //TODO: unify borderColors
			
			if(objects.links) objects.links.remove();
			objects.links = svgData.container.selectAll('.thought-link')
				.data(ABSTR.thoughtGraph.links)
				.enter().append('line')
				.attr('class', 'thought-link')
				.on('click', onLinkClicked)
				.call(mouseEnterLeave(onMouseEnterLink, onMouseLeaveLink))
			objects.links
				.filter(thoughtLiveAttributes.replyLink)
				.attr('marker-start', 'url(#thought-arrow)')
			objects.links
				.filter(notFn(thoughtLiveAttributes.replyLink))
				.attr('marker-start', 'url(#thought-invertedarrow)')
				
			updateLinkAttributes();
		}
		
		function drawLinkArrows() {
			if(objects.linkArrows) objects.linkArrows.remove();
			if(objects.invertedLinkArrows) objects.invertedLinkArrows.remove();
			objects.linkArrows = svgData.container.append("defs").append("marker")
				.attr("id", "thought-arrow")
				.attr("class", "thought-arrowmarker")
				// Displacement to put the arrow in the middle of the link
				.attr("refX", -3)
				.attr("refY", 0.45)
				.attr("markerWidth", 5)
				.attr("markerHeight", 5)
				.attr("orient", "auto")
				.append("path")
				.attr("d", " M 4 0 Q 0 0.45 4 0.9 Q 0.8 0.45 4 0");
				  // This is the form of the arrow. It starts in the point (y,x)=(4,0), it draws a quadratic Bézier curve to (4,0.9) with control point (0,0.45)
				  // and then another Bézier back to (4,0) with (0.8,0.45) as the control point
				  
			objects.invertedLinkArrows = svgData.container.append("defs").append("marker")
				.attr("id", "thought-invertedarrow")
				.attr("class", "thought-arrowmarker")
				.attr("refX", -6) 
				.attr("refY", 0.45)
				.attr("markerWidth", 5)
				.attr("markerHeight", 5)
				.attr("orient", "auto")
				.append("path")
				.attr("d", " M 0 0 Q 4 0.45 0 0.9 Q 3.2 0.45 0 0");
		}
		
		function updateLinkAttributes() {
			objects.links
				.style('stroke', thoughtLiveAttributes.linkColor)
		}
		
		function drawNodes() {
			if(objects.nodes) objects.nodes.remove();
			objects.nodes = svgData.container.selectAll('.thought-node')
				.data(ABSTR.thoughtGraph.nodes)
				.enter().append('circle')
				.on('click', onNodeClicked)
				.call(mouseEnterLeave(onMouseEnter, onMouseLeave))
				.call(force.drag)
			updateNodeAttributes();
		}
		
		function updateNodeAttributes() {
			objects.nodes
				.attr('class', 'thought-node')
				.attr('r', 15)
				.attr('data-bordermode', thoughtLiveAttributes.borderMode)
				.style('fill', thoughtLiveAttributes.nodeColor)
		}
		
		function onTick(e) {
			gravity(e.alpha);
			
			objects.nodes
				.attr('cx', function(d) { return d.x })
				.attr('cy', function(d) { return d.y })
			objects.links
				.attr('x1', function(d) { return d.source.x })
				.attr('y1', function(d) { return d.source.y })
				.attr('x2', function(d) { return d.target.x })
				.attr('y2', function(d) { return d.target.y })
				
			updateLinkBorder();
		}
		
		function gravity(alpha) {
			for(var i in ABSTR.thoughtGraph.nodes) {
				var d = ABSTR.thoughtGraph.nodes[i];
				var factor = 0.1;
				var dist = Math.pow(d.conversation.x-d.x,2)+Math.pow(d.conversation.y-d.y,2);
				var conversationRadius = liveAttributes.conversationRadius(d.conversation);
					dist = Math.sqrt(dist);
				if(dist >= conversationRadius) {
					factor += (dist-conversationRadius)/dist/2;
				}
				d.x += (d.conversation.x - d.x)*factor*alpha;
				d.y += (d.conversation.y - d.y)*factor*alpha;
			}
		}
		
		var width = $(window).width();
		var height = $(window).height();
		var force;
		var objects = { nodes: null, links: null };
		var tooltip;
		var liveAttributes = new LiveAttributes(ABSTR);
		var thoughtLiveAttributes = new ThoughtLiveAttributes(ABSTR);
	}
	
	function ConversationGraph_Control() {
		this.init = function() {}
	}
	
	function RightPanel_Presentation(ABSTR) {
		this.init = function() {
			ABSTR.selection.selectionChanged.subscribe(onSelectionChanged);
			ABSTR.mouseOver.selectionChanged.subscribe(onMouseOverSelectionChanged);
			$('#right_bar_header #contentlabel').css('background-color', 'rgb(227,226,230)');
			$(".right_bar").resizable({
				handles: 'w, s',
				minWidth: 335,
	  			resize: function() {
					$(this).css("left", 0);
				}
			});
			
			$('#showreply').text(Webtext.tx_reply);
			$('#showconnect').text(Webtext.tx_connect);
			$('#showeditnode').attr('title', Webtext.tx_edit_thought);
		}
		
		function onSelectionChanged(args) {
			if(args.value.type == SelectionTypes.Conversation) onConversationSelected(args.value.item);
			else if(args.value.type == SelectionTypes.Thought) onThoughtSelected(args.value.item);
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
			}
		}
		
		function onMouseOverSelectionChanged(args) {
			if(args.value.type == SelectionTypes.Thought) onMouseOverThoughtChanged(args.value.item);
			else if(args.oldValue.type == SelectionTypes.Thought) onMouseOverThoughtChanged(null);
		}
		
		function onMouseOverThoughtChanged(d) {
			if(d) {
				clear();
				$('#right_bar_header #contentlabel').attr('data-bordermode', BorderMode.MouseOver);
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
			if(ABSTR.selection.type() == SelectionTypes.Conversation) onConversationSelected(ABSTR.selection.item());
			else if(ABSTR.selection.type() == SelectionTypes.Thought) onThoughtSelected(ABSTR.selection.item());
		}
		
		function onSomethingSelected() {
			$('#right_bar_header #contentlabel').attr('data-bordermode', BorderMode.Selected);
		}
		
		function clear() {
			$('#right_bar_header #contentlabel').css('background-color', 'rgb(227,226,230)');
			$('#right_bar_header #contentlabel').attr('data-bordermode', BorderMode.None);
			$('#right_bar_header #contentlabel *').html('');
			$('#contbox').html('');
		}
		
		function appendLineToContent(text) {
			var line = $('<span></span>'); line.text(text); line.html(line.html()+'<br />');
			appendNodeToContent(line);
		}
		
		function appendNodeToContent($node) {
			$('#contbox').append($node);
		}
		
		var thoughtLiveAttributes = new ThoughtLiveAttributes(ABSTR);
	}
	
	function LiveAttributes(ABSTR) {
		this.conversationRadius = function(d) {
			return value(liveAttributes(d).conversationRadius, d);
		}
		
		this.charge = function(d) {
			return value(liveAttributes(d).charge, d);
		}
		
		this.conversationLoading = function(d) {
			return value(liveAttributes(d).conversationLoading, d);
		}
		
		this.conversationSymbolVisible = function(d) {
			return value(liveAttributes(d).conversationSymbolVisible, d);
		}
		
		this.error = function(d) {
			return d.error;
		}
		
		this.borderMode = function(d) {
			if(hashEquals(ABSTR.selection.item(SelectionTypes.Conversation), d)) return BorderMode.Selected;
			else if(hashEquals(ABSTR.mouseOver.item(SelectionTypes.Conversation), d) && !d.expanded) return BorderMode.MouseOver;
			else return BorderMode.None;
		}
		
		function liveAttributes(d) {
			return d.expanded ? expanded : collapsed;
		}
		
		function value(valueOrFunction, d) {
			if(typeof valueOrFunction == 'function') return valueOrFunction(d);
			else return valueOrFunction;
		}
		
		var collapsed = new CollapsedConversationLiveAttributes();
		var expanded = new ExpandedConversationLiveAttributes();
	}
	
	function CollapsedConversationLiveAttributes() {
		this.conversationRadius = 15;
		this.charge = -500;
		this.conversationLoading = false;
		this.conversationSymbolVisible = function(d) {
			return !d.error;
		}
	}
	
	function ExpandedConversationLiveAttributes() {
		this.conversationRadius = function(d) {
			return 50 * Math.ceil(Math.sqrt(d.thoughtnum)) + 15;
		}
		
		this.charge = function(d) {
			return -1500 * d.thoughtnum - 200;
		}
		
		this.conversationLoading = function(d) {
			return d.loading;
		}
		
		this.conversationSymbolVisible = function(d) {
			return d.loading;
		}
	}
	
	function ThoughtLiveAttributes(ABSTR) {
		this.nodeColor = function(d) {
			return nodeColor[d.type];
		}
		
		this.linkColor = function(d) {
			return linkColor[d.type];
		}
		
		this.replyLink = function(d) {
			return d.direct == 0;
		}
		
		this.borderMode = function(d) {
			if(hashEquals(ABSTR.selection.item(),d)) return BorderMode.Selected;
			else if(hashEquals(ABSTR.mouseOver.item(), d)) return BorderMode.MouseOver;
			else return BorderMode.None;
		}
		
		this.summary = function(d) {
			//TODO: fontStyle -> zoomout:3740
			if(d.contentsum) return d.contentsum;
			else {
				if(d.content.length > 60) return '[' + d.content.slice(0, 60) + '...]';
				else return '[' + d.content + ']';
			}
		}
		
		//CODE        = ["#000000", "General", "Questio", "Proposa", "Info   "];
		var nodeColor = ["#000000", "#f9c8a4", "#a2b0e7", "#e7a2dd", "#bae59a"];
		//CODE        = ["#000000", "General", "Agreeme", "Disagre", "Consequ", "Alterna", "Equival"]; 
		var linkColor = ["#000000", "#f9c8a4", "#7adc7c", "#e85959", "#b27de8", "#c87b37", "#ecaa41"];
	}
	
	var BorderMode = {
		None: 'normal',
		Selected: 'selected',
		MouseOver: 'mouseover',
	};
	
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
	
	function notFn(fn) {
		return function() { return !fn.apply(this, arguments) };
	}
	
	return ConversationGraph;
});