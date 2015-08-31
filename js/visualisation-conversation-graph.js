define(['pac-builder', 'db', 'event', 'webtext', 'datetime'], function(PacBuilder, Db, Events, Webtext, DateTime) {
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
		this.conversationSelected = new Events.EventImpl();
		
		this.selectedConversation = null;
		
		this.init = function() {
			loadConversationList().done(ready);
		}
		
		this.waitUntilReady = function() {
			return ready;
		}
		
		function ready() {
			readyPromise.resolve();
		}
		
		this.selectConversation = function(d) {
			_this.selectedConversation = d;
			_this.conversationSelected.raise(_this.selectedConversation);
		}
		
		this.clearConversationSelection = function() {
			_this.selectConversation(null);
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
			Db.loadAndReturnConversationModel(d.hash)
			.then(function(model) {
				d.loading = false;
				d.error = false;
				promise.resolve({ nodes: model.nodes })
			})
			.fail(function(error) {
				d.loading = false;
				d.error = error;
				promise.reject(error);
			});
			//promise.resolve({ nodes: [{ hash: "a", content: "content", contentsum: "contentsum" }], links: [] });
			return promise;
		}
		
		var conversationList = [];
		var readyPromise = $.Deferred();
	}
	
	function ConversationGraph_Presentation(ABSTR) {
		var _this = this;
		
		this.init = function(html5node) {
			ABSTR.conversationSelected.subscribe(onConversationSelected);
			
			initConstants();
			
			insertStyle();
			insertHtml(html5node)
			.then(initSvg)
			.then(ABSTR.waitUntilReady)
			.then(initForce)
			.then(initThoughtPresentation);
		}
		
		this.destroy = function() {
			style.remove();
		}
		
		function initThoughtPresentation() {
			thoughtPresentation = new ConversationGraph_ThoughtPresentation(ABSTR, { container: svgContainer });
			thoughtPresentation.init();
		}
		
		function onConversationSelected(d) {
			if(d != null)
				showSelectedConversationDetails(d);
			else 
				clearConversationDetails();
		}
		
		function onDblClickConversation(d) {
				d.expanded = !d.expanded;
				d.loading = d.expanded ? true : false;
				updateGraph();
				
				if(d.expanded) {
					ABSTR.loadConversation(d)
					.done(onConversationLoaded.bind(_this, d))
					.fail(onConversationError.bind(_this, d));
				}
				else {
					thoughtPresentation.removeConversationItems(d);
				}
		}
		
		function onConversationLoaded(conv, data) {
			updateGraph();
			
			thoughtPresentation.addConversationItems(conv, data.nodes, data.links);
		}
		
		function onConversationError(conv, error) {
			updateGraph();
		}
		
		function onMouseOverConversation(d) { //TODO: move to ABSTR?
			if(mouseOverNode == d) return;
			mouseOverNode = d;
			var domNode = $(nodes.filter(function(d) { return d.hash == mouseOverNode.hash })[0]);
			tooltip.text(d.title);
			showTooltipAtJQueryNode(domNode);
		}
		
		function onMouseOutConversation(d) {
			if(mouseOverNode == d) {
				mouseOverNode = null;
				hideTooltip();
			}
		}
		
		function showTooltipAtJQueryNode(node) {
			console.log(node.offset(), $('svg').offset())
			tooltip.css('left', node.offset().left - tooltip.outerWidth()/2);
			tooltip.css('top', node.offset().top - tooltip.outerHeight());
			tooltip.show();
		}
		
		function hideTooltip() {
			tooltip.hide();
		}
		
		function showSelectedConversationDetails(d) {
			$('#right_bar_header #contentlabel').attr('mode', ConversationDetailsMode.Selected);
			$('#right_bar_header #contentlabel').text(d.title);
			
			$('#contbox').html('');
			appendLineToNode(d.thoughtnum + ' ' + Webtext.tx_thoughts, $('#contbox'));
			appendLineToNode('created: ' + DateTime.timeAgo(d.creationtime), $('#contbox'));
			appendLineToNode(Webtext.tx_activity +": " + DateTime.timeAgo(d.lasttime), $('#contbox'));
			appendLineToNode(Webtext.tx_language + ": " + d.language, $('#contbox'));
		}
		
		function appendLineToNode(text, node) {
			var line = $('<span></span>'); line.text(text); line.html(line.html()+'<br />');
			node.append(line);
			return node;
		}
		
		function clearConversationDetails() {
			$('#right_bar_header #contentlabel').attr('mode', ConversationDetailsMode.None);
			$('#right_bar_header #contentlabel').text('');
			$('#contbox').html('');
		}
		
		function initConstants() {
			constants = {
				borderColor: []
			};
			
			constants.borderColor[ConversationDetailsMode.Selected] = '#333';
			constants.borderColor[ConversationDetailsMode.MouseOver] = '#c32222';
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
				
				tooltip = $('#tooltip');
				
				$(".right_bar").resizable({
					handles: 'w, s',
					minWidth: 335,
		  			resize: function() {
						$(this).css("left", 0);
					}
				});
			});
		}
		
		function initSvg() {
			svg = d3.select('.svg').append('svg')
			.attr('width', width)
			.attr('height', height)
			
			bg = svg.append('svg:rect')
			.attr('width', width)
			.attr('height', height)
			.attr('fill', 'white')
			.on('click', ABSTR.clearConversationSelection);
			
			svgContainer = svg.append('svg:g')
			.append('svg:g');
		}
		
		function initForce() {
			graph.nodes = ABSTR.getConversationList();
			//graph.links = [{ source: 0, target: 1 }];
			graph.links = [];
			
			force = d3.layout.force()
				.charge(liveAttributes.charge)
				.gravity(0.15)
				.linkDistance(150)
				.theta(0.95)
				.friction(0.85)
				.size([width, height])
				.nodes(graph.nodes)
				.links(graph.links);
			
			links = svgContainer.selectAll('.link')
	            .data(graph.links)
	            .enter().append("line")
	            .attr("class", "link")
	            .style("stroke", '#444')
	            .style("stroke-width", 5)
				.style("stroke-dasharray", '8,6')
				.style("stroke-linecap", "round")
				.style("stroke-opacity", 1);
				
			nodes = svgContainer.selectAll(".node")
	            .data(graph.nodes)
	            .enter().append('g');
	            
	        appendConversationSymbolTo(nodes);
			
			nodes.on('click', ABSTR.selectConversation);
			nodes.on('mouseover', onMouseOverConversation);
			nodes.on('mouseout', onMouseOutConversation);
			nodes.on('dblclick', onDblClickConversation);
			nodes.call(force.drag);
			force.on('tick', onTick);
			force.start();
		}
		
		function updateGraph() {
			//updateLinks();
			updateNodeAttributes();
			force.start();
		}
		
		function updateNodeAttributes() {
			nodes.selectAll('*').remove();
			appendConversationSymbolTo(nodes);
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
		
		function appendConversationSymbolTo(parent) {
			parent
	            .append("circle")
	            .attr("class", "conv node")
	            .attr("r", liveAttributes.conversationRadius)
	            .attr('cx', 0)
	            .attr('cy', 0)
	        parent
	            .append("circle")
	            .attr("class", "sub node")
	            .attr('data-filled', '1')
	            .attr('data-loading', liveAttributes.conversationLoading)
	            .attr('data-visible', liveAttributes.conversationSymbolVisible)
	            .attr("r", 3)
	            .attr('cx', 7)
	            .attr('cy', 0)
	        parent
	            .append("circle")
	            .attr("class", "sub node")
	            .attr('data-filled', function(d) { return (d.thoughtnum >= 4) ? '2' : 'false' })
	            .attr('data-loading', liveAttributes.conversationLoading)
	            .attr('data-visible', liveAttributes.conversationSymbolVisible)
	            .attr("r", 3)
	            .attr('cx', 7*Math.cos(2*1/3*Math.PI))
	            .attr('cy', 7*Math.sin(2*1/3*Math.PI))
	        parent
	            .append("circle")
	            .attr("class", "sub node")
	            .attr('data-filled',  function(d) { return (d.thoughtnum >= 10) ? '3' : 'false' })
	            .attr('data-loading', liveAttributes.conversationLoading)
	            .attr('data-visible', liveAttributes.conversationSymbolVisible)
	            .attr("r", 3)
	            .attr('cx', 7*Math.cos(2*2/3*Math.PI))
	            .attr('cy', 7*Math.sin(2*2/3*Math.PI))
	            
	        parent
	        	.filter(liveAttributes.error)
	        	.append('line')
	        	.attr({ x1: 0, x2: 0, y1: -10, y2: 0 })
	        	.style('stroke-width', '3px')
	        	.style('stroke', 'red')
				.style("stroke-linecap", "round")
	        parent
	        	.filter(liveAttributes.error)
	        	.append('circle')
	        	.attr({ cx: 0, cy: 8, r: 2 })
	        	.style('stroke-opacity', '0')
	        	.style('fill', 'red')
	            
	        //put an invisible circle layer on top of everything so that the mouseover event is only raised once when moving the mouse over the node
	        parent
	        	.append('circle')
	        	.attr('class', 'invisible node')
	            .attr("r", liveAttributes.conversationRadius)
	            .attr('cx', 0)
	            .attr('cy', 0)
		}
		
		var thoughtPresentation;
		
		var style;
		var width = $(window).width();
		var height = $(window).height();
		var svg, svgContainer, bg;
		var force;
		var nodes, links;
		var graph = { nodes: [], links: [] };
		var mouseOverNode = null;
		var tooltip;
		var liveAttributes = new LiveAttributes();
	}
	
	function ConversationGraph_ThoughtPresentation(ABSTR, svgData) {
		var _this = this;
		
		this.init = function() {
			force = d3.layout.force()
				.charge(-200)
				.gravity(0)
				.linkDistance(150)
				.theta(0.95)
				.friction(0.85)
				.size([width, height])
				.nodes(graph.nodes)
				.links(graph.links);
				
			drawNodes();
				
			force.on('tick', onTick);
			force.start();
		}
		
		this.removeConversationItems = function(conv) {
			for(var i=0; i<graph.nodes.length; ++i) if(graph.nodes[i].conversation.hash == conv.hash) graph.nodes.splice(i--, 1);
			for(var i=0; i<graph.links.length; ++i) if(graph.links[i].conversation.hash == conv.hash) graph.links.splice(i--, 1);
			
			drawNodes();
			_this.startEvolution();
		}
		
		this.addConversationItems = function(conv, nodes, links) {
			for(var i in nodes) { nodes[i].conversation = conv; graph.nodes.push(nodes[i]) }
			for(var i in links) { links[i].conversation = conv; graph.links.push(links[i]) }
			
			drawNodes();
			_this.startEvolution();
		}
		
		this.startEvolution = function() {
			force.start();
		}
		
		function drawNodes() {
			if(objects.nodes) objects.nodes.remove();
			objects.nodes = svgData.container.selectAll('.thought-node')
				.data(graph.nodes)
				.enter().append('circle')
				.attr('class', 'thought-node')
				.attr('r', 15)
				.call(force.drag);
		}
		
		function onTick(e) {
			gravity(e.alpha);
			
			objects.nodes
				.attr('cx', function(d) { return d.x })
				.attr('cy', function(d) { return d.y })
		}
		
		function gravity(alpha) {
			for(var i in graph.nodes) {
				var d = graph.nodes[i];
				var factor = alpha*0.2;
				var dist = Math.pow(d.conversation.x-d.x,2)+Math.pow(d.conversation.y-d.y,2);
				var conversationRadius = liveAttributes.conversationRadius(d.conversation);
					dist = Math.sqrt(dist);
				if(dist >= conversationRadius*0.95) {
					factor += (dist-conversationRadius*0.95)/dist/2;
				}
				d.x += (d.conversation.x - d.x)*factor;
				d.y += (d.conversation.y - d.y)*factor;
			}
		}
		
		var width = $(window).width();
		var height = $(window).height();
		var graph = { nodes: [], links: [] };
		var force;
		var objects = { nodes: null, links: null };
		var liveAttributes = new LiveAttributes();
	}
	
	function ConversationGraph_Control() {
		this.init = function() {}
	}
	
	function LiveAttributes() {
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
			return 30 * Math.ceil(Math.sqrt(d.thoughtnum)) + 15;
		}
		
		this.charge = function(d) {
			return -1000 * Math.sqrt(d.thoughtnum) - 500;
		}
		
		this.conversationLoading = function(d) {
			return d.loading;
		}
		
		this.conversationSymbolVisible = function(d) {
			return d.loading;
		}
	}
	
	var ConversationDetailsMode = {
		None: 0,
		Selected: 1,
		MouseOver: 2,
	};
	
	//converts from hex color to rgba color; TODO: duplicate -> visualisation-zoomout.js
	function hex2rgb(hex, opacity) {
	        var h=hex.replace('#', '');
	        h =  h.match(new RegExp('(.{'+h.length/3+'})', 'g'));
	
	        for(var i=0; i<h.length; i++)
	            h[i] = parseInt(h[i].length==1? h[i]+h[i]:h[i], 16);
	
	        if (typeof opacity != 'undefined')  h.push(opacity);
	
	        return 'rgba('+h.join(',')+')';
	}
	
	return ConversationGraph;
});