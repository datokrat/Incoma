define(['pac-builder', 'conversation-graph/db', 'event', 'webtext', 'datetime', 'scaler', 'model', 'conversation-graph/d3-group-charge', 'conversation-graph/d3-drag-with-listeners'], 
function(PacBuilder, Db, Events, Webtext, DateTime, Scaler, Model, GroupCharge, Drag) {
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
		this.conversationThoughtsAdded = new Events.EventImpl();
		this.createdConversationThoughtAdded = new Events.EventImpl();
		this.conversationThoughtsRemoved = new Events.EventImpl();
		this.inputPanelChanged = new Events.EventImpl();
		
		this.selection = new Selection();
		this.mouseOver = new Selection();
		this.thoughtType = new Selection();
		this.thoughtLinkType = new Selection();
		
		this.graph = { nodes: [], links: [] };
		this.thoughtGraph = { nodes: [], links: [] };
		
		this.inputPanel = "none";
		this.saving = createObservable(false);
		
		this.init = function() {
			loadConversationList()
			.then(applyConversationListToGraphData)
			.then(ready);
		}
		
		function applyConversationListToGraphData() {
			_this.graph.nodes = conversationList;
			_this.graph.links = globalLinkList.map(function(l) {
				return { source: conversationHashLookup[l.source_conv], target: conversationHashLookup[l.target_conv], type: l.type };
			});
			
			console.log(_this.graph.link);
		}
		
		this.waitUntilReady = function() {
			return ready;
		}
		
		function ready() {
			readyPromise.resolve();
		}
		
		this.openCloseReplyPanel = function(open) {
			if(open) _this.inputPanel = "reply";
			else _this.inputPanel = "none";
			_this.inputPanelChanged.raise();
			_this.thoughtType.reselect({ item: ThoughtTypes.General });
		}
		
		this.saveThought = function(args) {
			if(_this.selection.type() != SelectionTypes.Thought) return;
			
			_this.saving(true);
			var savePromise;
			var error = function(err) { _this.saving(false); alert(Webtext.tx_an_error + ' ' + err) };
			
			var replyTo = _this.selection.item();
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
				
				++replyTo.conversation.thoughtnum;
				_this.conversationListChanged.raise(conversationList);
				
				//addConversationThoughts(replyTo.conversation, newNodes, newLinks, { created: true });
				addCreatedConversationThought(replyTo.conversation, newThought, newLink);
				
				_this.openCloseReplyPanel(false);
				
				savePromise.done(function() {
					_this.saving(false);
				});
				
				//TODO: elastic?
				//TODO: hash_lookup
				//TODO: db calls
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
		
		this.getConversationList = function() {
			return conversationList;
		}
		
		function loadConversationList() {
			var promise = $.Deferred();
			Db.getConversations(function(result) {
				conversationList = result.conversations;
				conversationList.forEach(function(c) { conversationHashLookup[c.hash] = c });
				globalLinkList = result.links;
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
				//TODO: global links hash lookup
				promise.resolve({ nodes: model.nodes, links: links, incomingGlobalLinks: model.incomingGlobalLinks, outgoingGlobalLinks: model.outgoingGlobalLinks  })
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
						console.log(result);
						result.incomingGlobalLinks.forEach(function(rawLink) {
							var sourceConv = conversationHashLookup[rawLink.source_conv];
							if(sourceConv.expanded) {
								var link = { source: hashLookup[rawLink.source], target: hashLookup[rawLink.target], type: rawLink.type };
								addGlobalLink(sourceConv, d, link);
							}
						});
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
			
			_this.conversationThoughtsRemoved.raise(conv);
		}
		
		function addConversationThoughts(conv, nodes, links) {
			for(var i in nodes) { nodes[i].conversation = conv; _this.thoughtGraph.nodes.push(nodes[i]) }
			for(var i in links) { links[i].conversation = conv; _this.thoughtGraph.links.push(links[i]) }
			
			_this.conversationThoughtsAdded.raise();
		}
		
		function addGlobalLink(sourceConv, targetConv, link) {
			console.log('global');
			link.global = true;
			link.sourceConversation = sourceConv;
			link.targetConversation = targetConv;
			_this.thoughtGraph.links.push(link);
			
			_this.conversationThoughtsAdded.raise();
		}
		
		function addCreatedConversationThought(conv, node, link) {
			addConversationThoughts(conv, [node], link ? [link] : []);
			_this.createdConversationThoughtAdded.raise({ conversation: conv, node: node, link: link });
		}
		
		var conversationList = [], globalLinkList = [];
		var hashLookup = [];
		var conversationHashLookup = [];
		var readyPromise = $.Deferred();
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
			
			ABSTR.conversationListChanged.subscribe(updateGraph);
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
			if(dragging) return;
			ABSTR.mouseOver.select({ type: SelectionTypes.Conversation, item: d });
			
			if(!d.expanded) {
				tooltip.$().text(d.title);
				
				var $node = $(nodes.filter(function(d2) { return d2.hash == d.hash })[0]);
				tooltip.showTooltipAt$Node($node);
			}
		}
		
		function onMouseLeaveConversation(d) {
			if(dragging) return;
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
				.linkDistance(function(d) { return liveAttributes.conversationRadius(d.source) + liveAttributes.conversationRadius(d.target) + 50 })
				.linkStrength(0.2)
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
			var drag = Drag.drag(function(dragBehavior) {
				dragBehavior.on('drag.incoma', function(d) { onMouseLeaveConversation(d); dragging = true; });
				dragBehavior.on('dragend.incoma', function(d) { dragging = false; });
			}, force);
			
			nodes.on('click', ABSTR.selection.selectTypeFn(SelectionTypes.Conversation));
			nodes.call(mouseEnterLeave(onMouseEnterConversation, onMouseLeaveConversation));
			nodes.on('dblclick', onDblClickConversation);
			nodes.call(drag);
		}
	
		function onTick(e) {
			collide(e.alpha);
			
			links
				.attr('x1', function(d) { return d.source.x })
				.attr('y1', function(d) { return d.source.y })
				.attr('x2', function(d) { return d.target.x })
				.attr('y2', function(d) { return d.target.y });
			nodes
				.attr('transform', function(d) { return 'translate('+d.x +','+d.y+')' });
				
			thoughtPresentation.startEvolution();
		}
		
		function collide(alpha) {
			//source: http://bl.ocks.org/mbostock/7881887
			var quadtree = d3.geom.quadtree(ABSTR.graph.nodes);
			ABSTR.graph.nodes.forEach(function(d) {
				var r = 2 * liveAttributes.conversationRadius(d) + 20;
				var left = d.x - r, right = d.x + r, top = d.y - r, bottom = d.y + r;
				quadtree.visit(function(quad, x1, y1, x2, y2) {
					if(quad.point && quad.point !== d) {
						var dx = quad.point.x - d.x;
						var dy = quad.point.y - d.y;
						var distance = Math.sqrt(dx*dx+dy*dy);
						var minDistance = liveAttributes.conversationRadius(d) + liveAttributes.conversationRadius(quad.point) + 20;
						var forceDistance = minDistance;
						if(distance < minDistance) {
							var factor = (distance-minDistance)/distance / 2;
							if(liveAttributes.conversationRadius(d) == liveAttributes.conversationRadius(quad.point)) factor /= 2;
							d.x += (dx *= factor);
							d.y += (dy *= factor);
							quad.point.x -= dx;
							quad.point.y -= dy;
						}
						else if(distance < forceDistance) {
							var factor = (distance-forceDistance)/distance * alpha / 6;
							if(liveAttributes.conversationRadius(d) == liveAttributes.conversationRadius(quad.point)) factor /= 2;
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
	
	function ConversationGraph_ThoughtPresentation(ABSTR, svgData) {
		var _this = this;
		
		this.init = function() {
			ABSTR.selection.selectionChanged.subscribe(onSelectionChanged);
			ABSTR.mouseOver.selectionChanged.subscribe(onMouseOverSelectionChanged);
			
			ABSTR.conversationThoughtsAdded.subscribe(onConversationThoughtsAdded);
			ABSTR.createdConversationThoughtAdded.subscribe(onCreatedConversationThoughtAdded);
			ABSTR.conversationThoughtsRemoved.subscribe(onConversationThoughtsRemoved);
			
			tooltip = new Tooltip($('#tooltip'));
			
			force = d3.layout.force()
				.charge(0)
				.gravity(0)
				.linkDistance(thoughtLiveAttributes.linkDistance)
				.linkStrength(thoughtLiveAttributes.linkStrength)
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
		
		function onConversationThoughtsAdded() {
			drawLinks();
			drawNodes();
			_this.startEvolution();
		}
		
		function onCreatedConversationThoughtAdded(args) {
			//args = { conversation; node; link; }
			explode(args.node.x, args.node.y, thoughtLiveAttributes.nodeColor(args.node));
		}
		
		function onConversationThoughtsRemoved(conv) {
			removeLinks(conv);
			removeNodes(conv);
		}
		
		function explode(x, y, color) {
			explosion = svgData.container.append('circle')
				.attr('class', 'explosion')
				.attr("cx", x)
		        .attr("cy", y)
		        .attr("r", 10)
				.style("stroke",color)
				.style('stroke-width', '1px')
				.style('stroke-opacity', 0.9)
			explosion.transition().ease('cubic-out').duration(1500)
				.attr('r', 450)
				.style('stroke-width', '10px')
				.style('stroke-opacity', 0)
				.remove();
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
			if(dragging) return;
			ABSTR.mouseOver.select({ type: SelectionTypes.Thought, item: d });
			updateNodeAttributes();
			
			var $node = $(objects.nodes.filter(function(d2) { return d.hash == d2.hash })[0]);
			
			tooltip.$().text(thoughtLiveAttributes.summary(d));
			tooltip.showTooltipAt$Node($node);
		}
		
		function onMouseLeave(d) {
			if(dragging) return;
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
		
		function removeLinks(conv) {
			objects.links.filter(function(d) { return hashEquals(conv, d.conversation) }).remove();
		}
		
		function removeNodes(conv) {
			objects.nodes.filter(function(d) { return hashEquals(conv, d.conversation) }).remove();
		}
		
		function drawLinks() {
			if(!objects.mouseOverLinkBorder)
				objects.mouseOverLinkBorder = svgData.container.append('line')
					.attr('class', 'thought-overlink')
					.style('stroke', '#c32222') //TODO: unify borderColors
			if(!objects.selectedLinkBorder)
				objects.selectedLinkBorder = svgData.container.append('line')
					.attr('class', 'thought-selectedlink')
					.style('stroke', '#333') //TODO: unify borderColors
			
			//if(objects.links) objects.links.remove();
			objects.newLinks = svgData.container.selectAll('.thought-link')
				.data(ABSTR.thoughtGraph.links)
				.enter().insert('line', '.thought-node')
				.attr('class', 'thought-link')
				.on('click', onLinkClicked)
				.call(mouseEnterLeave(onMouseEnterLink, onMouseLeaveLink))
			objects.newLinks
				.filter(thoughtLiveAttributes.replyLink)
				.attr('marker-start', 'url(#thought-arrow)')
			objects.newLinks
				.filter(notFn(thoughtLiveAttributes.replyLink))
				.attr('marker-start', 'url(#thought-invertedarrow)')
			objects.links = svgData.container.selectAll('.thought-link');
				
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
			var drag = Drag.drag(function(dragBehavior) {
				dragBehavior.on('drag.incoma', function(d) { onMouseLeave(d); dragging = true; });
				dragBehavior.on('dragend.incoma', function(d) { dragging = false; });
			}, force);
			
			//if(objects.nodes) objects.nodes.remove();
			objects.newNodes = svgData.container.selectAll('.thought-node')
				.data(ABSTR.thoughtGraph.nodes)
				.enter().append('circle')
				.attr('class', 'thought-node')
				.on('click', onNodeClicked)
				.call(mouseEnterLeave(onMouseEnter, onMouseLeave))
				.call(drag)
			objects.nodes = svgData.container.selectAll('.thought-node');
			updateNodeAttributes();
		}
		
		function updateNodeAttributes() {
			objects.nodes
				.attr('r', 15)
				.attr('data-bordermode', thoughtLiveAttributes.borderMode)
				.style('fill', thoughtLiveAttributes.nodeColor)
		}
		
		function onTick(e) {
			gravity(e.alpha);
			charge(e.alpha, 0.95);
			
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
				var factor = 0.2;
				var dist = Math.pow(d.conversation.x-d.x,2)+Math.pow(d.conversation.y-d.y,2);
				var conversationRadius = liveAttributes.conversationRadius(d.conversation) * 0.95;
					dist = Math.sqrt(dist);
				if(dist >= conversationRadius) {
					factor += (dist-conversationRadius)/dist*(2+0.2/alpha);
				}
				d.x += (d.conversation.x - d.x)*factor*(alpha);
				d.y += (d.conversation.y - d.y)*factor*(alpha);
			}
		}
		
		function charge(alpha, theta) {
			var nodeGroups = {};
			for(var i=0; i<ABSTR.thoughtGraph.nodes.length; ++i) {
				var node = ABSTR.thoughtGraph.nodes[i];
				var group = nodeGroups[node.conversation.hash] = nodeGroups[node.conversation.hash] || [];
				group.push(node);
			}
			for(var hash in nodeGroups) {
				GroupCharge.applyCharge(nodeGroups[hash], alpha, theta, function() { return -500 });
			}
		}
		
		var width = $(window).width();
		var height = $(window).height();
		var force;
		var objects = { nodes: null, links: null };
		var tooltip;
		var liveAttributes = new LiveAttributes(ABSTR);
		var thoughtLiveAttributes = new ThoughtLiveAttributes(ABSTR);
		var dragging = false;
	}
	
	function ConversationGraph_Control() {
		this.init = function() {}
	}
	
	function RightPanel_Presentation(ABSTR) {
		this.init = function() {
			ABSTR.selection.selectionChanged.subscribe(onSelectionChanged);
			ABSTR.mouseOver.selectionChanged.subscribe(onMouseOverSelectionChanged);
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
				
				$('#showreply, #showconnect').show();
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
		
		var thoughtLiveAttributes = new ThoughtLiveAttributes(ABSTR);
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
			return d.global ? 100 : 75;
		}
		
		this.linkStrength = function(d) {
			return d.global ? 0.5 : 1;
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
	
	function notFn(fn) {
		return function() { return !fn.apply(this, arguments) };
	}
	
	function setPropertiesTo(props, obj) {
		for(var key in props)
			obj[key] = props[key];
	}
	
	return ConversationGraph;
});
