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
			.then(initForce);
		}
		
		this.destroy = function() {
			style.remove();
		}
		
		function onConversationSelected(d) {
			if(d != null)
				showSelectedConversationDetails(d);
			else 
				clearConversationDetails();
		}
		
		function onMouseOverConversation(d) { //TODO: move to ABSTR?
		console.log('over');
			if(mouseOverNode == d || ABSTR.selectedConversation == d) return;
			
			mouseOverNode = d;
			var domNode = $(nodes.filter(function(d) { return d.hash == mouseOverNode.hash })[0]);
			tooltip.text(d.title);
			showTooltipAtJQueryNode(domNode);
		}
		
		function onMouseOutConversation(d) {
			console.log('out');
			if(mouseOverNode == d) {
				mouseOverNode = null;
				hideTooltip();
			}
		}
		
		function showTooltipAtJQueryNode(node) {
			tooltip.css('left', node.offset().left - tooltip.width()/2);
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
				.charge(-500)
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
			nodes.call(force.drag);
			force.on('tick', onTick);
			force.start();
		}
	
		function onTick() {
			links
				.attr('x1', function(d) { return d.source.x })
				.attr('y1', function(d) { return d.source.y })
				.attr('x2', function(d) { return d.target.x })
				.attr('y2', function(d) { return d.target.y });
			nodes
				.attr('transform', function(d) { return 'translate('+d.x +','+d.y+')' });
		}
		
		function appendConversationSymbolTo(parent) {
			parent
	            .append("circle")
	            .attr("class", "conv node")
	            .attr("r", 15)
	            .attr('cx', 0)
	            .attr('cy', 0)
	        parent
	            .append("circle")
	            .attr("class", "sub node")
	            .attr('data-filled', '1')
	            .attr("r", 3)
	            .attr('cx', 7)
	            .attr('cy', 0)
	        parent
	            .append("circle")
	            .attr("class", "sub node")
	            .attr('data-filled', function(d) { return (d.thoughtnum >= 4) ? '2' : 'false' })
	            .attr("r", 3)
	            .attr('cx', 7*Math.cos(2*1/3*Math.PI))
	            .attr('cy', 7*Math.sin(2*1/3*Math.PI))
	        parent
	            .append("circle")
	            .attr("class", "sub node")
	            .attr('data-filled',  function(d) { return (d.thoughtnum >= 10) ? '3' : 'false' })
	            .attr("r", 3)
	            .attr('cx', 7*Math.cos(2*2/3*Math.PI))
	            .attr('cy', 7*Math.sin(2*2/3*Math.PI))
	            
	        //put an invisible circle layer on top of everything so that the mouseover event is only raised once when moving the mouse over the node
	        parent
	        	.append('circle')
	        	.attr('class', 'invisible node')
	            .attr("r", 15)
	            .attr('cx', 0)
	            .attr('cy', 0)
		}
		
		var style;
		var width = $(window).width();
		var height = $(window).height();
		var svg, svgContainer, bg;
		var force;
		var nodes, links;
		var graph = { nodes: [], links: [] };
		var mouseOverNode = null;
		var tooltip;
	}
	
	function ConversationGraph_Control() {
		this.init = function() {}
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