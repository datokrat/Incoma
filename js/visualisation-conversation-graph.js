define(['pac-builder', 'db', 'event'], function(PacBuilder, Db, Events) {
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
		
		this.init = function() {
			loadConversationList().done(ready);
		}
		
		function ready() {
			readyPromise.resolve();
		}
		
		this.waitUntilReady = function() {
			return ready;
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
			insertStyle();
			insertHtml(html5node)
			.then(initSvg)
			.then(ABSTR.waitUntilReady)
			.then(initForce);
		}
		
		this.destroy = function() {
			style.remove();
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
			.attr('id', 'bg')
			.attr('height', height)
			.attr('fill', 'white')
			.on('click', null /*TODO*/);
			
			svgContainer = svg.append('svg:g')
			.append('svg:g')
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
	            .attr("class", "node")
	            .attr("r", 15)
	            .attr('cx', 0)
	            .attr('cy', 0)
				.style("stroke", '#888')
				.style("stroke-width", '1px')
				.style("fill-opacity",0);
	        parent
	            .append("circle")
	            .attr("class", "node")
	            .attr("r", 3)
	            .attr('cx', 7)
	            .attr('cy', 0)
				.style("stroke", '#888')
				.style("stroke-width", '1px')
	            .style("fill", '#f9c8a4')
				.style("fill-opacity",1);
	        parent
	            .append("circle")
	            .attr("class", "node")
	            .attr("r", 3)
	            .attr('cx', 7*Math.cos(2*1/3*Math.PI))
	            .attr('cy', 7*Math.sin(2*1/3*Math.PI))
				.style("stroke", function(d) { return (d.thoughtnum > 3) ? '#888' : '#ddd' })
				.style("stroke-width", '1px')
	            .style("fill", '#a2b0e7')
				.style("fill-opacity",function(d) { return (d.thoughtnum > 3) ? 1 : 0 });
	        parent
	            .append("circle")
	            .attr("class", "node")
	            .attr("r", 3)
	            .attr('cx', 7*Math.cos(2*2/3*Math.PI))
	            .attr('cy', 7*Math.sin(2*2/3*Math.PI))
				.style("stroke", function(d) { return (d.thoughtnum > 9) ? '#888' : '#ddd' })
				.style("stroke-width", '1px')
	            .style("fill", '#bae59a')
				.style("fill-opacity",function(d) { return (d.thoughtnum > 9) ? 1 : 0 });
		}
		
		var style;
		var width = $(window).width();
		var height = $(window).height();
		var svg, svgContainer, bg;
		var force;
		var nodes, links;
		var graph = { nodes: [], links: [] };
	}
	
	function ConversationGraph_Control() {
		this.init = function() {}
	}
	
	return ConversationGraph;
});