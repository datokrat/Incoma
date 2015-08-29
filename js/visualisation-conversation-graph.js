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
			style = $('<link>');
			style.attr({ type: 'text/css', rel: 'stylesheet', href: '../css/conversation-graph.css' });
			
			insertHtml(html5node);
			initSvg();
		}
		
		this.destroy = function() {
			style.remove();
		}
		
		function insertHtml(html5node) {
			$.ajax({ url: './templates/conversation-graph.html', dataType: 'html' })
			.done(function(template) {
				$(html5node).html(template);
			});
		}
		
		function initSvg() {
		}
		
		var style;
	}
	
	function ConversationGraph_Control() {
		this.init = function() {}
	}
	
	return ConversationGraph;
});