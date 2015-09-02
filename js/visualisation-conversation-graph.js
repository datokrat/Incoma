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
		this.conversationSelected = new Events.EventImpl();
		this.mouseOverConversationChanged = new Events.EventImpl();
		this.thoughtSelectionChanged = new Events.EventImpl();
		
		this.selectedConversation = null;
		this.selectedThought = null;
		this.mouseOverConversation = null;
		
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
			if(_this.selectedConversation != d) {
				_this.selectedConversation = null;
				_this.selectThought(null);
				_this.selectedConversation = d;
				_this.conversationSelected.raise(_this.selectedConversation);
			}
		}
		
		this.mouseEnterConversation = function(d) {
			if(_this.mouseOverConversation != d) {
				_this.mouseOverConversation = d;
				_this.mouseOverConversationChanged.raise(_this.mouseOverConversation);
			}
		}
		
		this.clearSelection = function() {
			_this.selectConversation(null);
			_this.selectThought(null);
		}
		
		this.selectThought = function(d) {
			if(_this.selectedThought != d) {
				var old = _this.selectedThought;
				_this.selectedThought = null;
				_this.selectConversation(null);
				_this.selectedThought = d;
				_this.thoughtSelectionChanged.raise(_this.selectedThought);
			}
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
				for(var i=0; i<model.nodes.length; ++i) hashLookup[model.nodes[i].hash] = model.nodes[i];
				var links = model.links.map(function(l) { return { 
					source: hashLookup[l.source], 
					target: hashLookup[l.target],
					type: l.type,
				} });
				promise.resolve({ nodes: model.nodes, links: links })
			})
			.fail(function(error) {
				d.loading = false;
				d.error = error;
				promise.reject(error);
			});
			return promise;
		}
		
		var conversationList = [];
		var hashLookup = [];
		var readyPromise = $.Deferred();
	}
	
	function ConversationGraph_Presentation(ABSTR) {
		var _this = this;
		
		this.init = function(html5node) {
			scaler = new Scaler();
			scaler.viewPortChanged.subscribe(onViewPortChanged);
			ABSTR.conversationSelected.subscribe(onConversationSelected);
			ABSTR.mouseOverConversationChanged.subscribe(onMouseOverConversationChanged);
			
			initConstants();
			
			insertStyle();
			insertHtml(html5node)
			.then(initSvg)
			.then(ABSTR.waitUntilReady)
			.then(initForce)
			.then(initThoughtPresentation);
		}
		
		function onViewPortChanged(args) {
			if(args.transitionTime) setViewPort(args.translate.x, args.translate.y, args.zoom, true, args.transitionTime);
			else setViewPort(args.translate.x, args.translate.y, args.zoom, false);
		}
		
		this.destroy = function() {
			style.remove();
		}
	    
	    function setViewPort(tx, ty, zoom, isAnimation, transitionTime) {
	    	var object = isAnimation ? svgContainer.transition().ease("cubic-out").duration(transitionTime) : svgContainer;
	        object.attr("transform","translate(" + tx + ',' + ty + ") scale(" + zoom + ")");
	    };
		
		function initThoughtPresentation() {
			thoughtPresentation = new ConversationGraph_ThoughtPresentation(ABSTR, { container: svgContainer });
			thoughtPresentation.init();
		}
		
		function onConversationSelected(d) {
			updateNodeAttributes();
		}
		
		function onDblClickConversation(d) {
				d.expanded = !d.expanded;
				d.loading = d.expanded ? true : false;
				ABSTR.mouseEnterConversation(null);
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
		
		function onMouseEnterConversation(d) {
			ABSTR.mouseEnterConversation(d);
			
			if(d.expanded) return;
			var domNode = $(nodes.filter(function(d2) { return d2.hash == d.hash })[0]);
			tooltip.$().text(d.title);
			tooltip.showTooltipAt$Node(domNode);
		}
		
		function onMouseLeaveConversation(d) {
			ABSTR.mouseEnterConversation(null);
			
			tooltip.hideTooltip();
		}
		
		function onMouseOverConversationChanged(d) {
			updateNodeAttributes();
		}
		
		function clearRightPanel() {
			$('#right_bar_header #contentlabel').attr('data-bordermode', BorderMode.None);
			$('#right_bar_header #contentlabel').text('');
			$('#contbox').html('');
		}
		
		function initConstants() {
			constants = {
				borderColor: []
			};
			
			constants.borderColor[BorderMode.Selected] = '#333';
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
				
				tooltip = new Tooltip($('#tooltip'));
				rightPanel = new RightPanel_Presentation(ABSTR);
				rightPanel.init();
				
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
			.on('click', ABSTR.clearSelection)
			
			var tmp = svg.append('svg:g');
			bg.call(d3.behavior.zoom().scaleExtent([1,8]).on('zoom', scaler.rescale));
			svgContainer = tmp.append('svg:g');
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
			nodes.call(mouseEnterLeave(onMouseEnterConversation, onMouseLeaveConversation));
			//nodes.on('mouseover', onMouseOverConversation);
			//nodes.on('mouseout', onMouseOutConversation);
			nodes.on('dblclick', onDblClickConversation);
			nodes.call(force.drag);
			force.on('tick', onTick);
			force.start();
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
	            .attr('data-bordermode', liveAttributes.borderMode)
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
		var scaler;
		var nodes, links;
		var graph = { nodes: [], links: [] };
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
			ABSTR.thoughtSelectionChanged.subscribe(onThoughtSelectionChanged);
			tooltip = new Tooltip($('#tooltip'));
			
			force = d3.layout.force()
				.charge(-200)
				.gravity(0)
				.linkDistance(75)
				.theta(0.95)
				.friction(0.85)
				.size([width, height])
				.nodes(graph.nodes)
				.links(graph.links);
				
			drawLinks();
			drawNodes();
				
			force.on('tick', onTick);
			_this.startEvolution();
		}
		
		this.removeConversationItems = function(conv) {
			for(var i=0; i<graph.nodes.length; ++i) if(graph.nodes[i].conversation.hash == conv.hash) graph.nodes.splice(i--, 1);
			for(var i=0; i<graph.links.length; ++i) if(graph.links[i].conversation.hash == conv.hash) graph.links.splice(i--, 1);
			
			drawLinks();
			drawNodes();
			_this.startEvolution();
		}
		
		this.addConversationItems = function(conv, nodes, links) {
			for(var i in nodes) { nodes[i].conversation = conv; graph.nodes.push(nodes[i]) }
			for(var i in links) { links[i].conversation = conv; graph.links.push(links[i]) }
			
			drawLinks();
			drawNodes();
			_this.startEvolution();
		}
		
		this.startEvolution = function() {
			force.start();
		}
		
		function onNodeClicked(d) {
			ABSTR.selectThought(d);
		}
		
		function onThoughtSelectionChanged(args) {
			updateNodeAttributes();
		}
		
		function onMouseEnter(d) {
			d.mouseOver = true;
			
			var $node = $(objects.nodes.filter(function(d2) { return d.hash == d2.hash })[0]);
			
			tooltip.$().text(thoughtLiveAttributes.summary(d));
			tooltip.showTooltipAt$Node($node);
			
			updateNodeAttributes();
		}
		
		function onMouseLeave(d) {
			d.mouseOver = false;
			
			tooltip.hideTooltip();
			updateNodeAttributes();
		}
		
		function drawLinks() {
			if(objects.links) objects.links.remove();
			objects.links = svgData.container.selectAll('.thought-link')
				.data(graph.links)
				.enter().append('line')
				.attr('class', 'thought-link')
			updateLinkAttributes();
		}
		
		function updateLinkAttributes() {
			objects.links
				.style('stroke', thoughtLiveAttributes.linkColor)
		}
		
		function drawNodes() {
			if(objects.nodes) objects.nodes.remove();
			objects.nodes = svgData.container.selectAll('.thought-node')
				.data(graph.nodes)
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
		}
		
		function gravity(alpha) {
			for(var i in graph.nodes) {
				var d = graph.nodes[i];
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
		var graph = { nodes: [], links: [] };
		var force;
		var objects = { nodes: null, links: null };
		var tooltip;
		var liveAttributes = new LiveAttributes(ABSTR);
		var thoughtLiveAttributes = new ThoughtLiveAttributes(ABSTR);
	}
	
	function ConversationGraph_Control() {
		this.init = function() {}
	}
	
	function RightPanel_Presentation(ABSTR) { //TODO integrate
		this.init = function() {
			ABSTR.conversationSelected.subscribe(onConversationSelected);
			ABSTR.thoughtSelectionChanged.subscribe(onThoughtSelected);
			$('#right_bar_header #contentlabel').css('background-color', 'rgb(227,226,230)');
		}
		
		function onConversationSelected(d) {
			clear();
			if(d) {
				onSomethingSelected();
				console.log('selected', d);
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
				console.log('selected', d);
				$('#right_bar_header #contentlabel').css('background-color', thoughtLiveAttributes.nodeColor(d));
				$('#right_bar_header #contentlabel .right_bar_title_main').text(ThoughtTypeAttributes[d.type].name);
				//$('#right_bar_header #contentlabel .right_bar_title_details').text(d.title);
			
				$('#contbox').html('');
				appendLineToContent(URLlinks(nl2br(d.content)));
			}
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
			if(hashEquals(ABSTR.selectedConversation, d)) return BorderMode.Selected;
			else if(hashEquals(ABSTR.mouseOverConversation, d) && !d.expanded) return BorderMode.MouseOver;
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
		
		this.borderMode = function(d) {
			if(hashEquals(ABSTR.selectedThought,d)) return BorderMode.Selected;
			else if(d.mouseOver) return BorderMode.MouseOver; //TODO move mouseOver to ABSTR
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
	
	return ConversationGraph;
});