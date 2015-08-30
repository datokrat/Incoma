define(['pac-builder', 'model'], function(PacBuilder) {
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
		this.init = function() {}
	}
	
	function ConversationGraph_Presentation(ABSTR) {
		var _this = this;
		
		this.init = function(html5node) {
			insertStyle();
			insertHtml(html5node)
			.done(initSvg)
			.done(initForce);
		}
		
		this.destroy = function() {
			style.remove();
		}
		
		function onBackgroundClick() {
			alert('bg');
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
				//makes the right_bar resizable
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
			.on('click', onBackgroundClick);
			
			svgContainer = svg.append('svg:g')
			.append('svg:g')
		}
		
		function initForce() {
			graph.nodes = [{},{}, {}];
			graph.links = [{ source: 0, target: 1 }];
			
			force = d3.layout.force()
				.charge(-1000)
				.gravity(0.15)
				.linkDistance(60)
				.theta(0.95)
				.friction(0.85)
				.size([width, height])
				.nodes(graph.nodes)
				.links(graph.links);
			
			links = svgContainer.selectAll('.link')
	            .data(graph.links)
	            .enter().append("line")
	            .attr("class", "link")
				//.attr("marker-start", PRES.liveAttributes.linkArrow)
	            .style("stroke", '#444')
	            .style("stroke-width", 5)
				.style("stroke-dasharray", '8,6')
				.style("stroke-linecap", "round")
				.style("stroke-opacity", 1);
				
			nodes = svgContainer.selectAll(".node")
	            .data(graph.nodes)
	            .enter().append("circle")
	            .attr("class", "node")
	            .attr("r", 15)
				.style("stroke", '#888')
				.style("stroke-width", '1px')
	            .style("fill", '#aaa')
				.style("fill-opacity",1);
			nodes
				.call(force.drag);
			
			force.on('tick', function() {
				links
					.attr('x1', function(d) { return d.source.x })
					.attr('y1', function(d) { return d.source.y })
					.attr('x2', function(d) { return d.target.x })
					.attr('y2', function(d) { return d.target.y });
				nodes
					.attr("cx", function (d) {return d.x;})
	                .attr("cy", function (d) {return d.y;});
			});
			
			force.start();
		}
		
		var style;
		var width = $(window).width();
		var height = $(window).height();
		var svg, svgContainer, bg;
		var force;
		var nodes, links;
		var graph = { nodes: [], links: [] };
	}
	
	function onMouseOverNode() {
		console.log('overnode');
	}
	
	function ConversationGraph_Control() {
		this.init = function() {}
	}
	
	return ConversationGraph;
});