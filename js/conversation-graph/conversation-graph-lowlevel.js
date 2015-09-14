define(
['../event', '../conversation-graph/d3-drag-with-listeners', '../conversation-graph/util', '../conversation-graph/d3-group-charge'],
function(Events, Drag, Util, GroupCharge) {
	function ConversationGraph_Abstraction() {
		this.graph = { links: [], nodes: [] };
		this.thoughtGraph = { links: [], nodes: [] };
		this.conversationListChanged = new Events.EventImpl();
		this.conversationThoughtsAdded = new Events.EventImpl();
		this.conversationThoughtsRemoved = new Events.EventImpl();
		this.createdConversationThoughtAdded = new Events.EventImpl();
		this.createdThoughtLinkAdded = new Events.EventImpl();
		this.conversationExpanded = new Events.EventImpl();
		this.conversationCollapsed = new Events.EventImpl();
		
		this.conversationLoadingStateChanged = new Events.EventImpl();
		this.conversationPositionsChanged = new Events.EventImpl();
		
		this.selection = new Util.Selection();
		this.mouseOver = new Util.Selection();
		
		this.connecting = Util.createObservable(false);
		this.newLinkSource = null;
		this.newLinkTarget = null;
	}
	
	ConversationGraph_Abstraction.prototype.clearSelection = function() {
		if(!this.connecting()) {
			this.selection.clear();
			return true;
		}
		else
			return false;
	}
	
	ConversationGraph_Abstraction.prototype.expandConversation = function(d) {
		d.expanded = !d.expanded;
		d.loading = d.expanded ? true : false;
		this.mouseOver.clear();
		
		if(d.expanded)
			this.conversationExpanded.raise(d);
		else {
			this.removeConversationThoughts(d); //TODO: what happens when collapsing whilst loading?
			this.conversationCollapsed.raise(d);
		}
	}
	
	ConversationGraph_Abstraction.prototype.addToConversationGraph = function(nodes, links) {
		this.graph.nodes = this.graph.nodes.concat(nodes);
		this.graph.links = this.graph.links.concat(links);
		this.conversationListChanged.raise();
	}
		
	ConversationGraph_Abstraction.prototype.addCreatedConversationThought = function(conv, node, link) { //TODO: right class?
		this.addConversationThoughts(conv, [node], link ? [link] : []);
		++conv.thoughtnum;
		this.conversationListChanged.raise();
		this.createdConversationThoughtAdded.raise({ conversation: conv, node: node, link: link });
	}
		
	ConversationGraph_Abstraction.prototype.addCreatedThoughtLink = function(link) {
		console.log('add link', link);
		this.addConversationThoughts(link.conversation, [], [link]);
		this.createdThoughtLinkAdded.raise({ link: link });
	}
		
	ConversationGraph_Abstraction.prototype.addConversationThoughts = function(conv, nodes, links) {
		for(var i in nodes) { nodes[i].conversation = conv; this.thoughtGraph.nodes.push(nodes[i]) }
		for(var i in links) { links[i].conversation = conv; this.thoughtGraph.links.push(links[i]) }
	
		this.conversationThoughtsAdded.raise();
	}
	
	ConversationGraph_Abstraction.prototype.removeConversationThoughts = function(conv) {
		for(var i=0; i<this.thoughtGraph.nodes.length; ++i) if(this.thoughtGraph.nodes[i].conversation.hash == conv.hash) this.thoughtGraph.nodes.splice(i--, 1);
		for(var i=0; i<this.thoughtGraph.links.length; ++i) if(this.doesLinkBelongToConversation(this.thoughtGraph.links[i], conv)) this.thoughtGraph.links.splice(i--, 1);
		
		this.conversationThoughtsRemoved.raise(conv);
	}
	
	ConversationGraph_Abstraction.prototype.doesLinkBelongToConversation = function(link, conv) {
		if(link.global)
			return Util.hashEquals(link.sourceConversation, conv) || Util.hashEquals(link.targetConversation, conv);
		else
			return Util.hashEquals(link.conversation, conv);
	}
		
	ConversationGraph_Abstraction.prototype.addGlobalLink = function(sourceConv, targetConv, link) {
		link.global = true;
		link.sourceConversation = sourceConv;
		link.targetConversation = targetConv;
		this.thoughtGraph.links.push(link);
		
		this.conversationThoughtsAdded.raise();
	}
	
	ConversationGraph_Abstraction.prototype.selectConversation = function(d) {
		if(!this.connecting())
			this.selection.select({ type: SelectionTypes.Conversation, item: d });
	}
	
	ConversationGraph_Abstraction.prototype.mouseOverConversation = function(d) {
		if(!this.connecting())
			this.mouseOver.select({ type: SelectionTypes.Conversation, item: d });
	}
	
	ConversationGraph_Abstraction.prototype.selectThoughtLink = function(d) {
		if(!this.connecting())
			this.selection.select({ type: SelectionTypes.ThoughtLink, item: d });
	}
	
	ConversationGraph_Abstraction.prototype.mouseOverThoughtLink = function(d) {
		if(!this.connecting())
			this.mouseOver.select({ type: SelectionTypes.ThoughtLink, item: d });
	}
	
	var ConversationPresentation = function ConversationGraph_ConversationPresentation(ABSTR, args) {
		this._ABSTR = ABSTR;
		this._container = args.svg;
		this._size = args.size;
		this._tooltip = args.tooltip;
		this._force = null;
		this._objects = { };
		this._liveAttributes = new ConversationLiveAttributes(ABSTR);
	}
	
	ConversationPresentation.prototype.init = function() {
		this._ABSTR.selection.selectionChanged.subscribe(bind(this, '_onSelectionChanged'));
		this._ABSTR.mouseOver.selectionChanged.subscribe(bind(this, '_onMouseOverSelectionChanged'));
		this._ABSTR.conversationLoadingStateChanged.subscribe(bind(this, '_onConversationLoadingStateChanged'));
		this._ABSTR.conversationExpanded.subscribe(bind(this, '_onConversationExpanded'));
		this._ABSTR.conversationCollapsed.subscribe(bind(this, '_onConversationCollapsed'));
		
		this._ABSTR.conversationListChanged.subscribe(bind(this, '_onConversationListChanged'));
		
		this._force = d3.layout.force()
			.charge(this._liveAttributes.charge)
			.gravity(0.15)
			.linkDistance(this._liveAttributes.linkDistance)
			.linkStrength(0.2)
			.theta(0.95)
			.friction(0.85)
			.size([this._size.width, this._size.height])
			.nodes(this._ABSTR.graph.nodes)
			.links(this._ABSTR.graph.links);
			
		this._objects.links = this._container.selectAll('.link')
            .data(this._ABSTR.graph.links)
            .enter().insert("line", '.after-conversation-links')
            .attr("class", "link")
            .style("stroke", '#888')
            .style("stroke-width", 5)
			.style("stroke-dasharray", '8,6')
			.style("stroke-linecap", "round")
			.style("stroke-opacity", 1);
		
		this._container.append('g').attr('class', 'after-conversation-links');
		this._container.append('g').attr('class', 'after-expanded-conversations');
		this._container.append('g').attr('class', 'after-thought-link-borders');
		this._container.append('g').attr('class', 'after-thought-links');
		this._container.append('g').attr('class', 'after-prelink');
		this._container.append('g').attr('class', 'after-collapsed-conversations');
		this._container.append('g').attr('class', 'after-thoughts');
		
		this._objects.nodes = this._container.selectAll(".conv-node")
			.data(this._ABSTR.graph.nodes)
			.enter().insert('g', '.after-collapsed-conversations').attr('class', 'conv-node');
		
		this._bindNodeEvents();
		this._bindForceEvents();
		this._startWithFreshAttributes();
	}
	
	ConversationPresentation.prototype._onConversationExpanded = function(d) {
		this._objects.nodes = this._container.selectAll('.conv-node');
		var collapsedExit = this._container.selectAll('.conv-node:not([data-expanded=true])')
			.data(this._ABSTR.graph.nodes.filter(function(d) { return !d.expanded }))
			.exit().remove();
		var expandedEnter = this._container.selectAll('.conv-node[data-expanded=true]')
			.data(this._ABSTR.graph.nodes.filter(function(d) { return d.expanded }))
			.enter().insert('g', '.after-expanded-conversations').attr('class', 'conv-node').attr('data-expanded', true);
		
		this._bindNodeEvents(expandedEnter);
		
		this._objects.nodes = this._container.selectAll('.conv-node');
		this._startWithFreshAttributes();
		
		var out = [];
		this._objects.nodes.each(function(node) {
			var dataExpanded = this.attributes.getNamedItem('data-expanded');
			dataExpanded = dataExpanded && dataExpanded.value;
			out.push({ expanded: node.expanded, d: node, data_expanded: dataExpanded, attributes: this.attributes, node: this });
		});
	}
	
	ConversationPresentation.prototype._onConversationCollapsed = function(d) {
		this._objects.nodes = this._container.selectAll('.conv-node');
		var expandedExit = this._container.selectAll('.conv-node[data-expanded]')
			.data(this._ABSTR.graph.nodes.filter(function(d) { return d.expanded }))
			.exit().remove();
		var collapsedEnter = this._container.selectAll('.conv-node:not([data-expanded])')
			.data(this._ABSTR.graph.nodes.filter(function(d) { return !d.expanded }))
			.enter().insert('g', '.after-collapsed-conversations').attr('class', 'conv-node').attr('data-expanded', false);
		
		this._bindNodeEvents(collapsedEnter);
			
		this._objects.nodes = this._container.selectAll('.conv-node');
		this._startWithFreshAttributes();
	}
	
	ConversationPresentation.prototype._bindNodeEvents = function(nodes) {
		var self = this;
		var drag = Drag.drag(function(dragBehavior) {
			dragBehavior.on('drag.incoma', function(d) { self._onMouseLeaveConversation(d); self._dragging = true; });
			dragBehavior.on('dragend.incoma', function(d) { self._dragging = false; });
		}, this._force);
		
		nodes = nodes || this._objects.nodes;
		nodes
			.on('click', bind(this._ABSTR, 'selectConversation')/*this._ABSTR.selection.selectTypeFn(SelectionTypes.Conversation)*/)
			.on('dblclick', bind(this, '_onDblClickConversation'))
			.call(mouseEnterLeave(bind(this, '_onMouseEnterConversation'), bind(this, '_onMouseLeaveConversation')))
			.call(drag);
	}
	
	ConversationPresentation.prototype._bindForceEvents = function() {
		this._force.on('tick', bind(this, '_onTick'));
	}
	
	ConversationPresentation.prototype._onConversationListChanged = function() {
		this._startWithFreshAttributes();
	}
	
	ConversationPresentation.prototype._onConversationLoadingStateChanged = function() {
		this._onNodeAttributesChanged();
	}
	
	/* === Node Events === */
	
	ConversationPresentation.prototype._onMouseEnterConversation = function(d) {
		if(this._dragging) return;
		
		this._ABSTR.mouseOverConversation(d);
		//this._ABSTR.mouseOver.select({ type: SelectionTypes.Conversation, item: d });
		
		if(!d.expanded) {
			this._tooltip.$().text(d.title);
			
			var $node = $(this._objects.nodes.filter(function(d2) { return Util.hashEquals(d, d2) })[0]);
			this._tooltip.showTooltipAt$Node($node);
		}
	}
	
	ConversationPresentation.prototype._onMouseLeaveConversation = function(d) {
		if(this._dragging) return;
		this._ABSTR.mouseOver.clear();
		
		this._tooltip.hideTooltip();
	}
		
	ConversationPresentation.prototype._onDblClickConversation = function(d) {
			this._ABSTR.expandConversation(d);
			//this._startWithFreshAttributes(); //TODO: right position?
	}
	
	/* === End Node Events === */
	
	/* === Selection Events === */
	
	ConversationPresentation.prototype._onMouseOverSelectionChanged = function(args) {
		if(args.typeChanged(SelectionTypes.Conversation)) this._onNodeAttributesChanged();
	}
		
	ConversationPresentation.prototype._onSelectionChanged = function(args) {
		if(args.typeChanged(SelectionTypes.Conversation)) this._onNodeAttributesChanged();
	}
	
	ConversationPresentation.prototype._onNodeAttributesChanged = function() {
		this._applyNodeAttributes(this._objects.nodes);
	}
	
	/* === End Selection Events === */
	
	ConversationPresentation.prototype._startWithFreshAttributes = function() {
		this._applyNodeAttributes(this._objects.nodes);
		this._startEvolution();
	}
	
	ConversationPresentation.prototype._onTick = function(e) {
		this._collide(e.alpha);
		
		this._objects.links
			.attr('x1', function(d) { return d.source.x })
			.attr('y1', function(d) { return d.source.y })
			.attr('x2', function(d) { return d.target.x })
			.attr('y2', function(d) { return d.target.y });
		this._objects.nodes
			.attr('transform', function(d) { return 'translate('+d.x +','+d.y+')' });
			
		this._ABSTR.conversationPositionsChanged.raise();
	}
	
	ConversationPresentation.prototype._collide = function(alpha) {
		var nodes = this._ABSTR.graph.nodes;
		var conversationRadius = this._liveAttributes.conversationRadius;
	
		//source: http://bl.ocks.org/mbostock/7881887 (modified)
		var quadtree = d3.geom.quadtree(this._ABSTR.graph.nodes);
		this._ABSTR.graph.nodes.forEach(function(d) {
			var r = 2 * conversationRadius(d) + 40;
			var left = d.x - r, right = d.x + r, top = d.y - r, bottom = d.y + r;
			quadtree.visit(function(quad, x1, y1, x2, y2) {
				if(quad.point && quad.point !== d) {
					var dx = quad.point.x - d.x;
					var dy = quad.point.y - d.y;
					var distance = Math.sqrt(dx*dx+dy*dy);
					var minDistance = conversationRadius(d) + conversationRadius(quad.point) + 20;
					var forceDistance = minDistance + 40;
					var mass = conversationRadius(quad.point)*conversationRadius(quad.point);
					mass /= conversationRadius(d)*conversationRadius(d) + conversationRadius(quad.point)*conversationRadius(quad.point);
					if(distance < minDistance) {
						var factor = (distance-minDistance)/distance / 2;
						if(conversationRadius(d) == conversationRadius(quad.point)) factor /= 2;
						d.x += 2*mass*(dx *= factor);
						d.y += 2*mass*(dy *= factor);
						quad.point.x -= 2*(1-mass)*dx;
						quad.point.y -= 2*(1-mass)*dy;
					}
					else if(distance < forceDistance) {
						var factor = (distance-forceDistance)/distance * alpha / 6;
						if(conversationRadius(d) == conversationRadius(quad.point)) factor /= 2;
						d.x += (dx *= factor);
						d.y += (dy *= factor);
						quad.point.x -= dx;
						quad.point.y -= dy;
					}
				}
				return x1 > right || x2 < left || y1 > bottom || y2 < top;
			});
		})
	}
	
	ConversationPresentation.prototype._startEvolution = function() {
		this._force.start();
	}
	
	ConversationPresentation.prototype._applyNodeAttributes = function(parent) {
		parent.selectAll('*').remove();
		parent
            //.attr('data-expanded', function(d) { return d.expanded })
            .append("circle")
            .attr("class", "conv node")
            .attr("r", this._liveAttributes.conversationRadius)
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('data-bordermode', this._liveAttributes.borderMode)
        parent
            .append("circle")
            .attr("class", "sub node conversation-symbol")
            .attr('data-filled', '1')
            .attr('data-loading', this._liveAttributes.conversationLoading)
            .attr('data-visible', this._liveAttributes.conversationSymbolVisible)
            .attr("r", 3)
            .attr('cx', 7)
            .attr('cy', 0)
        parent
            .append("circle")
            .attr("class", "sub node conversation-symbol")
            .attr('data-filled', function(d) { return (d.thoughtnum >= 4) ? '2' : 'false' })
            .attr('data-loading', this._liveAttributes.conversationLoading)
            .attr('data-visible', this._liveAttributes.conversationSymbolVisible)
            .attr("r", 3)
            .attr('cx', 7*Math.cos(2*1/3*Math.PI))
            .attr('cy', 7*Math.sin(2*1/3*Math.PI))
        parent
            .append("circle")
            .attr("class", "sub node conversation-symbol")
            .attr('data-filled',  function(d) { return (d.thoughtnum >= 10) ? '3' : 'false' })
            .attr('data-loading', this._liveAttributes.conversationLoading)
            .attr('data-visible', this._liveAttributes.conversationSymbolVisible)
            .attr("r", 3)
            .attr('cx', 7*Math.cos(2*2/3*Math.PI))
            .attr('cy', 7*Math.sin(2*2/3*Math.PI))
            
        parent
        	.filter(this._liveAttributes.error)
        	.append('line')
        	.attr('class', 'conversation-symbol')
        	.attr({ x1: 0, x2: 0, y1: -10, y2: 0 })
        	.style('stroke-width', '3px')
        	.style('stroke', 'red')
			.style("stroke-linecap", "round")
        parent
        	.filter(this._liveAttributes.error)
        	.append('circle')
        	.attr('class', 'conversation-symbol')
        	.attr({ cx: 0, cy: 8, r: 2 })
        	.style('stroke-opacity', '0')
        	.style('fill', 'red')
	}
	
	var ThoughtPresentation = function ConversationGraph_ThoughtPresentation(ABSTR, args) {
		this._ABSTR = ABSTR;
		this._container = args.container;
		this._svg = args.svg;
		this._size = args.size;
		this._tooltip = args.tooltip;
		this._scaler = args.scaler;
		this._bg = args.bg;
		this._dragging = false;
		this._force = null;
		this._objects = { };
		this._liveAttributes = new ThoughtLiveAttributes(ABSTR);
		this._conversationLiveAttributes = new ConversationLiveAttributes(ABSTR);
	}
	
	ThoughtPresentation.prototype.init = function() {
		this._ABSTR.selection.selectionChanged.subscribe(bind(this, '_onSelectionChanged'));
		this._ABSTR.mouseOver.selectionChanged.subscribe(bind(this, '_onMouseOverSelectionChanged'));
		
		this._ABSTR.conversationThoughtsAdded.subscribe(bind(this, '_onConversationThoughtsAdded'));
		this._ABSTR.createdConversationThoughtAdded.subscribe(bind(this, '_onCreatedConversationThoughtAdded'));
		this._ABSTR.conversationThoughtsRemoved.subscribe(bind(this, '_onConversationThoughtsRemoved'));
		
		this._ABSTR.conversationPositionsChanged.subscribe(bind(this, '_startEvolution'));
		this._ABSTR.connecting.changed.subscribe(bind(this, '_onConnectingStateChanged'));
		
		this._force = d3.layout.force()
			.charge(0)
			.gravity(0)
			.linkDistance(this._liveAttributes.linkDistance)
			.linkStrength(this._liveAttributes.linkStrength)
			.theta(0.95)
			.friction(0.85)
			.size([this._size.width, this._size.height])
			.nodes(this._ABSTR.thoughtGraph.nodes)
			.links(this._ABSTR.thoughtGraph.links);
			
		this._initLinkArrows();
		this._initLinkBorders();
		this._initPreLink();
		
		this._drawNewLinks();
		this._drawNewNodes();
		
		this._bindSvgEvents();
		this._bindForceEvents();
	}
	
	ThoughtPresentation.prototype._startWithFreshAttributes = function() {
		this._applyNodeAttributes(this._objects.nodes);
		this._applyLinkAttributes(this._objects.links);
		this._startEvolution();
	}
		
	ThoughtPresentation.prototype._onConversationThoughtsAdded = function() {
		this._drawNewLinks();
		this._drawNewNodes();
		this._applyLinkAttributes(this._objects.newLinks);
		this._applyNodeAttributes(this._objects.newNodes);
		this._startEvolution();
	}
	
	ThoughtPresentation.prototype._onCreatedConversationThoughtAdded = function(args) {
		//args = { conversation; node; link; }
		this._explode(args.node.x, args.node.y, this._liveAttributes.nodeColor(args.node));
	}
	
	ThoughtPresentation.prototype._onConversationThoughtsRemoved = function(conv) {
		this._removeLinks(conv);
		this._removeNodes(conv);
	}
	
	ThoughtPresentation.prototype._explode = function(x, y, color) {
		var explosion = this._container.append('circle')
			.attr('class', 'explosion')
			.attr("cx", x)
	        .attr("cy", y)
	        .attr("r", 10)
			.style("stroke", color)
			.style('stroke-width', '1px')
			.style('stroke-opacity', 0.9)
		explosion.transition().ease('cubic-out').duration(1500)
			.attr('r', 450)
			.style('stroke-width', '10px')
			.style('stroke-opacity', 0)
			.remove();
	}
	
	ThoughtPresentation.prototype._removeLinks = function(conv) {
		var self = this;
		this._objects.links.filter(function(d) { return self._ABSTR.doesLinkBelongToConversation(d, conv) }).remove();
	}
	
	ThoughtPresentation.prototype._removeNodes = function(conv) {
		this._objects.nodes.filter(function(d) { return Util.hashEquals(conv, d.conversation) }).remove();
	}
	
	ThoughtPresentation.prototype._onConnectingStateChanged = function() {
	}

	ThoughtPresentation.prototype._startEvolution = function() {
		this._force.start();
	}
	
	/* === Events === */
		
		ThoughtPresentation.prototype._onLinkClicked = function(d) {
			this._ABSTR.selectThoughtLink(d);
		}
		
		ThoughtPresentation.prototype._onNodeClicked = function(d) {
			if(!this._ABSTR.connecting())
				this._ABSTR.selection.select({ type: SelectionTypes.Thought, item: d });
			else {
				this._ABSTR.newLinkTarget = d;
				this._stopConnecting();
			}
		}
		
		ThoughtPresentation.prototype._stopConnecting = function() {
			this._ABSTR.connecting(false);
			this._objects.preLink.style('stroke-opacity', 0);
		}
		
		ThoughtPresentation.prototype._onSelectionChanged = function(args) {
			if(args.value.type == SelectionTypes.Thought) this._onThoughtSelectionChanged(args.value.item);
			else if(args.oldValue.type == SelectionTypes.Thought) this._onThoughtSelectionChanged(null);
			
			if(args.value.type == SelectionTypes.ThoughtLink) this._onThoughtLinkSelectionChanged(args.value.item);
			else if(args.oldValue.type == SelectionTypes.ThoughtLink) this._onThoughtLinkSelectionChanged(null);
		}
		
		ThoughtPresentation.prototype._onThoughtSelectionChanged = function(d) {
			this._applyNodeAttributes(this._objects.nodes);
		}
		
		ThoughtPresentation.prototype._onThoughtLinkSelectionChanged = function(d) {
			this._applyLinkBorder();
		}
		
		ThoughtPresentation.prototype._onMouseEnter = function(d) {
			if(this._dragging) return;
			this._ABSTR.mouseOver.select({ type: SelectionTypes.Thought, item: d });
			this._applyNodeAttributes(this._objects.nodes);
			
			var $node = $(this._objects.nodes.filter(function(d2) { return Util.hashEquals(d, d2) })[0]);
			
			this._tooltip.$().text(this._liveAttributes.summary(d));
			this._tooltip.showTooltipAt$Node($node);
		}
		
		ThoughtPresentation.prototype._onMouseLeave = function(d) {
			if(this._dragging) return;
			this._ABSTR.mouseOver.clear();
			
			this._tooltip.hideTooltip();
			this._applyNodeAttributes(this._objects.nodes);
		}
		
		ThoughtPresentation.prototype._onMouseEnterLink = function(d) {
			this._ABSTR.mouseOverThoughtLink(d);
		}
		
		ThoughtPresentation.prototype._onMouseLeaveLink = function(d) {
			this._ABSTR.mouseOver.clear();
		}
		
		ThoughtPresentation.prototype._onMouseOverSelectionChanged = function(args) {
			if(args.value.type == SelectionTypes.ThoughtLink) this._onMouseOverLinkChanged(args.value.item);
			else if(args.oldValue.type == SelectionTypes.ThoughtLink) this._onMouseOverLinkChanged(null);
		}
		
		ThoughtPresentation.prototype._onMouseOverLinkChanged = function(d) {
			this._applyLinkBorder();
		}
	
	/* === End Events === */
	
	ThoughtPresentation.prototype._initLinkArrows = function() {
		if(!this._objects.linkArrows) this._objects.linkArrows = this._container.append("defs").append("marker")
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
			  
		if(!this._objects.invertedLinkArrows) this._objects.invertedLinkArrows = this._container.append("defs").append("marker")
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
	
	ThoughtPresentation.prototype._initLinkBorders = function() {
		if(!this._objects.mouseOverLinkBorder)
			this._objects.mouseOverLinkBorder = this._container.insert('line', '.after-thought-link-borders')
				.attr('class', 'thought-overlink')
				.style('stroke', '#c32222') //TODO: unify borderColors
		if(!this._objects.selectedLinkBorder)
			this._objects.selectedLinkBorder = this._container.insert('line', '.after-thought-link-borders')
				.attr('class', 'thought-selectedlink')
				.style('stroke', '#333') //TODO: unify borderColors
	}
	
	ThoughtPresentation.prototype._initPreLink = function() {
		if(!this._objects.preLink)
			this._objects.preLink = this._container.insert("line", '.after-prelink')
				.style("stroke-width", 3)
				.style("stroke", "black")
				.style("stroke-dasharray", "8,6")
				.style("stroke-linecap", "round")
				.style("stroke-opacity",0);
	}
		
	ThoughtPresentation.prototype._drawNewLinks = function() {
		this._objects.newLinks = this._container.selectAll('.thought-link')
			.data(this._ABSTR.thoughtGraph.links)
			.enter().insert('line', '.after-thought-links')
			.attr('class', 'thought-link')
			.on('click', bind(this, '_onLinkClicked'))
			.call(mouseEnterLeave(bind(this, '_onMouseEnterLink'), bind(this, '_onMouseLeaveLink')))
			
		this._applyLinkAttributes(this._objects.newLinks);
			
		this._objects.links = this._container.selectAll('.thought-link');
	}
	
	ThoughtPresentation.prototype._applyLinkAttributes = function(selection) {
		selection
			.style('stroke', this._liveAttributes.linkColor)
		selection.filter(this._liveAttributes.replyLink)
			.attr('marker-start', 'url(#thought-arrow)')
		selection.filter(notFn(this._liveAttributes.replyLink))
			.attr('marker-start', 'url(#thought-invertedarrow)')
		
		this._applyLinkBorder();
	}
	
	ThoughtPresentation.prototype._applyLinkBorder = function() {
		var over = this._ABSTR.mouseOver.item();
		var sel = this._ABSTR.selection.item();
		var active = [];
		
		if(this._ABSTR.selection.type() == SelectionTypes.ThoughtLink && sel)
			active.push({ linkBorder: this._objects.selectedLinkBorder, d: sel })
		if(this._ABSTR.mouseOver.type() == SelectionTypes.ThoughtLink && over /*&& !Util.hashEquals(sel, over)*/)
			active.push({ linkBorder: this._objects.mouseOverLinkBorder, d: over });
		
		[this._objects.selectedLinkBorder, this._objects.mouseOverLinkBorder].forEach(function(linkBorder) {
			linkBorder.style('stroke-opacity', 0);
		});
		active.forEach(function(item) {
			item.linkBorder
				.attr('x1', item.d.source.x)
				.attr('y1', item.d.source.y)
				.attr('x2', item.d.target.x)
				.attr('y2', item.d.target.y)
				.style('stroke-opacity', 1);
		})
	}
	
	ThoughtPresentation.prototype._drawNewNodes = function() {
		var self = this;
		var drag = Drag.drag(function(dragBehavior) {
			dragBehavior.on('drag.incoma', function(d) { self._onMouseLeave(d); self._dragging = true; });
			dragBehavior.on('dragend.incoma', function(d) { self._dragging = false; });
		}, this._force);
		
		this._objects.newNodes = this._container.selectAll('.thought-node')
			.data(this._ABSTR.thoughtGraph.nodes)
			.enter().insert('circle', '.after-thoughts')
			.attr('class', 'thought-node')
			.on('click', bind(this, '_onNodeClicked'))
			.call(mouseEnterLeave(bind(this, '_onMouseEnter'), bind(this, '_onMouseLeave')))
			.call(drag)
		this._objects.nodes = this._container.selectAll('.thought-node');
	}
	
	ThoughtPresentation.prototype._applyNodeAttributes = function(selection) {
		selection
			.attr('r', 15)
			.attr('data-bordermode', this._liveAttributes.borderMode)
			.style('fill', this._liveAttributes.nodeColor)
	}
	
	ThoughtPresentation.prototype._bindSvgEvents = function() {
		this._svg.on('mousemove', bind(this, '_onMouseMove'));
	}
	
	ThoughtPresentation.prototype._onMouseMove = function() {
		if(this._ABSTR.connecting()) {
			var p1 = [0,0], p2 = [0,0];
			p1[0] = this._ABSTR.selection.item().x;
			p1[1] = this._ABSTR.selection.item().y;
			p2 = this._scaler.translate(d3.mouse(d3.select('svg')[0][0]));
			this._objects.preLink
				.attr('x1', p1[0])
				.attr('y1', p1[1])
				.attr('x2', p2[0])
				.attr('y2', p2[1])
				.style('stroke', 'blue')
				.style('stroke-opacity', 1);
		}
	}
	
	ThoughtPresentation.prototype._bindForceEvents = function() {
		this._force.on('tick', bind(this, '_onTick'));
	}
	
	ThoughtPresentation.prototype._onTick = function(e) {
	
		this._gravity(e.alpha);
		this._charge(e.alpha, 0.95);
		this._applyNodeAndLinkPositions();
	}
	
	ThoughtPresentation.prototype._applyNodeAndLinkPositions = function() {
		this._objects.nodes
			.attr('cx', function(d) { return d.x })
			.attr('cy', function(d) { return d.y })
		this._objects.links
			.attr('x1', function(d) { return d.source.x })
			.attr('y1', function(d) { return d.source.y })
			.attr('x2', function(d) { return d.target.x })
			.attr('y2', function(d) { return d.target.y })
		this._applyLinkBorder();
	}
	
	ThoughtPresentation.prototype._gravity = function(alpha) {
		var liveAttributes = this._conversationLiveAttributes;
		for(var i in this._ABSTR.thoughtGraph.nodes) {
			var d = this._ABSTR.thoughtGraph.nodes[i];
			var factor = 0.2;
			var dist = Math.sqrt(Math.pow(d.conversation.x-d.x,2)+Math.pow(d.conversation.y-d.y,2));
			var conversationRadius = liveAttributes.conversationRadius(d.conversation) * 0.95;
			if(dist >= conversationRadius) {
				factor += (dist-conversationRadius)/dist*(2+0.2/alpha);
			}
			d.x += (d.conversation.x - d.x)*factor*alpha;
			d.y += (d.conversation.y - d.y)*factor*alpha;
		}
	}
	
	ThoughtPresentation.prototype._charge = function(alpha, theta) {
		var nodeGroups = {};
		for(var i=0; i<this._ABSTR.thoughtGraph.nodes.length; ++i) {
			var node = this._ABSTR.thoughtGraph.nodes[i];
			var group = nodeGroups[node.conversation.hash] = nodeGroups[node.conversation.hash] || [];
			group.push(node);
		}
		for(var hash in nodeGroups) {
			GroupCharge.applyCharge(nodeGroups[hash], alpha, theta, function() { return -500 });
		}
	}

	function ConversationLiveAttributes(ABSTR) {
		var self = this;
		
		expansionDependentAttribute('conversationRadius');
		expansionDependentAttribute('charge');
		expansionDependentAttribute('conversationLoading');
		expansionDependentAttribute('conversationSymbolVisible');
		
		this.linkDistance = function(d) {
			return self.conversationRadius(d.source) + self.conversationRadius(d.target) + 50;
		}
		
		this.error = function(d) {
			return d.error;
		}
		
		this.borderMode = function(d) {
			if(Util.hashEquals(ABSTR.selection.item(SelectionTypes.Conversation), d)) return BorderModes.Selected;
			else if(Util.hashEquals(ABSTR.mouseOver.item(SelectionTypes.Conversation), d) && !d.expanded) return BorderModes.MouseOver;
			else return BorderModes.None;
		}
		
		function expansionDependentAttribute(name) {
			self[name] = function(d) {
				return value(liveAttributes(d)[name], d);
			}
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
	
	function CollapsedConversationLiveAttributes(ABSTR) {
		this.conversationRadius = 15;
		this.charge = -500;
		this.conversationLoading = false;
		this.conversationSymbolVisible = function(d) {
			return !d.error;
		}
	}
	
	function ExpandedConversationLiveAttributes(ABSTR) {
		this.conversationRadius = function(d) {
			return Math.ceil(50 * Math.sqrt(d.thoughtnum)) + 15;
		}
		
		this.charge = function(d) {
			return -500 * d.thoughtnum - 200;
		}
		
		this.conversationLoading = function(d) {
			return d.loading;
		}
		
		this.conversationSymbolVisible = function(d) {
			return d.loading;
		}
	}
	
	function ThoughtLiveAttributes(ABSTR) {
		var _this = this;
		this.nodeColor = function(d) {
			return nodeColor[d.type];
		}
		
		this.linkColor = function(d) {
			return linkColor[d.type];
		}
		
		this.linkDistance = function(d) {
			return d.global ? 75 : 75;
		}
		
		this.linkStrength = function(d) {
			return d.global ? 0.5 : 1;
		}
		
		this.replyLink = function(d) {
			return d.direct == 0 || d.global;
		}
		
		this.borderMode = function(d) {
			if(Util.hashEquals(ABSTR.selection.item(),d)) return BorderModes.Selected;
			else if(Util.hashEquals(ABSTR.mouseOver.item(), d)) return BorderModes.MouseOver;
			else return BorderModes.None;
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
	
	var SelectionTypes = {
		Conversation: 0,
		Thought: 1,
		ThoughtLink: 2,
	}
	
	var BorderModes = {
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
	
	var ThoughtLinkTypes = {
		General: 1,
		Agreement: 2,
		Disagreement: 3,
		Consequence: 4,
		Alternative: 5,
		Equivalence: 6,
		None: 0,
	}
	
	function bind(_this, fnName) {
		return _this[fnName].bind(_this);
	}
	
	function mouseEnterLeave(enter, leave) {
		return function(node) {
			var over = null;
			node.on('mouseover', function(d) {
				if(over == d) return;
				over = d;
				enter(d);
			});
			node.on('mouseout', function(d) {
				if(over === null) return;
				over = null;
				leave(d);
			});
		}
	}
	
	function notFn(fn) {
		return function() { return !fn.apply(this, arguments) };
	}
	
	return {
		Abstraction: ConversationGraph_Abstraction, 
		ConversationPresentation: ConversationPresentation, 
		ThoughtPresentation: ThoughtPresentation, 
		ConversationLiveAttributes: ConversationLiveAttributes,
		ThoughtLiveAttributes: ThoughtLiveAttributes,
		BorderModes: BorderModes,
		SelectionTypes: SelectionTypes,
		ThoughtTypes: ThoughtTypes,
		ThoughtLinkTypes: ThoughtLinkTypes
	};
});
