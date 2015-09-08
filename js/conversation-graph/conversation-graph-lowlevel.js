define(
['../event', '../conversation-graph/d3-drag-with-listeners', '../conversation-graph/util'],
function(Events, Drag, Util) {
	function ConversationGraph_Abstraction() {
		this.graph = { links: [], nodes: [] };
		this.thoughtGraph = { links: [], nodes: [] };
		this.conversationListChanged = new Events.EventImpl();
		this.conversationThoughtsAdded = new Events.EventImpl();
		this.conversationThoughtsRemoved = new Events.EventImpl();
		this.createdConversationThoughtAdded = new Events.EventImpl();
		this.conversationExpanded = new Events.EventImpl();
		
		this.conversationLoadingStateChanged = new Events.EventImpl();
		this.conversationPositionsChanged = new Events.EventImpl();
		
		this.selection = new Util.Selection();
		this.mouseOver = new Util.Selection();
	}
	
	ConversationGraph_Abstraction.prototype.clearSelection = function() {
		this.selection.clear();
	}
	
	ConversationGraph_Abstraction.prototype.expandConversation = function(d) {
		d.expanded = !d.expanded;
		d.loading = d.expanded ? true : false;
		this.mouseOver.clear();
		
		if(d.expanded)
			this.conversationExpanded.raise(d);
		else
			this.removeConversationThoughts(d); //TODO: what happens when collapsing whilst loading?
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
			return hashEquals(link.sourceConversation, conv) || hashEquals(link.targetConversation, conv);
		else
			return hashEquals(link.conversation, conv);
	}
		
	ConversationGraph_Abstraction.prototype.addGlobalLink = function(sourceConv, targetConv, link) {
		link.global = true;
		link.sourceConversation = sourceConv;
		link.targetConversation = targetConv;
		this.thoughtGraph.links.push(link);
		
		this.conversationThoughtsAdded.raise();
	}
	
	
	var ConversationPresentation = function ConversationGraph_ConversationPresentation(ABSTR, args) {
		this._ABSTR = ABSTR;
		this._svg = args.svg;
		this._size = args.size;
		this._tooltip = args.tooltip;
		this._force = null;
		this._objects = { };
		this._liveAttributes = new LiveAttributes(ABSTR);
	}
	
	ConversationPresentation.prototype.init = function() {
		this._ABSTR.selection.selectionChanged.subscribe(bind(this, '_onSelectionChanged'));
		this._ABSTR.mouseOver.selectionChanged.subscribe(bind(this, '_onMouseOverSelectionChanged'));
		this._ABSTR.conversationLoadingStateChanged.subscribe(bind(this, '_onConversationLoadingStateChanged'));
		
		this._ABSTR.conversationListChanged.subscribe(bind(this, '_onConversationListChanged'));
		
		console.log(this._ABSTR);
		
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
		
		console.log(1);
			
		this._objects.links = this._svg.selectAll('.link')
            .data(this._ABSTR.graph.links)
            .enter().append("line")
            .attr("class", "link")
            .style("stroke", '#888')
            .style("stroke-width", 5)
			.style("stroke-dasharray", '8,6')
			.style("stroke-linecap", "round")
			.style("stroke-opacity", 1);
		
		this._objects.nodes = this._svg.selectAll(".node")
			.data(this._ABSTR.graph.nodes)
			.enter().append('g');
			
		console.log(2);
		
		this._bindNodeEvents();
		this._bindForceEvents();
		this._startWithFreshAttributes();
		
		console.log(3);
	}
	
	ConversationPresentation.prototype._bindNodeEvents = function() {
		var self = this;
		var drag = Drag.drag(function(dragBehavior) {
			dragBehavior.on('drag.incoma', function(d) { self._onMouseLeaveConversation(d); self._dragging = true; });
			dragBehavior.on('dragend.incoma', function(d) { self._dragging = false; });
		}, this._force);
		
		this._objects.nodes
			.on('click', this._ABSTR.selection.selectTypeFn(SelectionTypes.Conversation))
			.on('dblclick', bind(this, '_onDblClickConversation'))
			.call(mouseEnterLeave(bind(this, '_onMouseEnterConversation'), bind(this, '_onMouseLeaveConversation')))
			.call(drag);
	}
	
	ConversationPresentation.prototype._bindForceEvents = function() {
		this._force.on('tick', bind(this, '_onTick'));
	}
	
	ConversationPresentation.prototype._onConversationListChanged = function() {
		this._showWithFreshAttributes();
	}
	
	ConversationPresentation.prototype._onConversationLoadingStateChanged = function() {
		this._onNodeAttributesChanged();
	}
	
	/* === Node Events === */
	
	ConversationPresentation.prototype._onMouseEnterConversation = function(d) {
		if(this._dragging) return;
		this._ABSTR.mouseOver.select({ type: SelectionTypes.Conversation, item: d });
		
		if(!d.expanded) {
			this._tooltip.$().text(d.title);
			
			var $node = $(this._objects.nodes.filter(function(d2) { return hashEquals(d, d2) })[0]);
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
			this._startWithFreshAttributes(); //TODO: right position?
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
	
	function LiveAttributes(ABSTR) {
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
			if(hashEquals(ABSTR.selection.item(SelectionTypes.Conversation), d)) return BorderModes.Selected;
			else if(hashEquals(ABSTR.mouseOver.item(SelectionTypes.Conversation), d) && !d.expanded) return BorderModes.MouseOver;
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
	
	function hashEquals(x, y) {
		if(x == y) return true;
		if(!x || !y) return false;
		return x.hash == y.hash;
	}
	
	function bind(_this, fnName) {
		console.log(fnName);
		return _this[fnName].bind(_this);
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
	
	return {
		Abstraction: ConversationGraph_Abstraction, 
		ConversationPresentation: ConversationPresentation, 
		ConversationLiveAttributes: LiveAttributes,
		BorderModes: BorderModes,
		SelectionTypes: SelectionTypes };
});
