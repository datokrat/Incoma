define(
['../event'],
function(Events) {
	function ConversationGraph_Abstraction() {
		this.conversationListChanged = new Events.EventImpl();
		this.conversationThoughtsAdded = new Events.EventImpl();
		this.conversationThoughtsRemoved = new Events.EventImpl();
		this.createdConversationThoughtAdded = new Events.EventImpl();
		
		this.graph = { links: [], nodes: [] };
		this.thoughtGraph = { links: [], nodes: [] };
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
	
	function hashEquals(x, y) {
		if(x == y) return true;
		if(!x || !y) return false;
		return x.hash == y.hash;
	}
	
	return { Abstraction: ConversationGraph_Abstraction };
});
