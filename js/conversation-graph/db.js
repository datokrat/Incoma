define(['promise', 'model', 'webtext'], function(Promise, Model, webtextModule) { //TODO: remove Model dependency!!!
	var Db = {};

	Db.loadAndReturnConversationModel = function(conv) {
		var promise = $.Deferred();
		
		conversation = conv;
		Db.getmodel(function() { promise.reject('no conversation') });
		promise.resolve(modelfromdb);
		return promise;
	}

	Db.getConversations = function(done){
	//Get the list of conversations (shown in Participate)
		$.ajax({
			dataType: 'json',
			url: 'php/getconversations.php',
			async: false,
			}).done(function(data) {
			data.conversations.pop();
			done && done(data);
		});

	}
	
	Db.getinfo = function(onNoConversation){
		$.ajax({
		dataType: 'json',
		url: 'php/getinfo.php',
		data: { conversation: conversation},
		async: false,
		}).done(function(data) {
			if (typeof data.title[0].title == "undefined") {
				onNoConversation(); //opennoconversationpanel();
				return;
			}
			data.title.pop()
			data.editable.pop()
			Model.title = data.title[0].title;
			Model.editable = data.editable[0].editable;
		});
	}
	
	
	Db.gettags = function(){

        $.ajax({
        dataType: 'json',
        url: 'php/gettags.php',
        data: { conversation: conversation},
        async: false,
        }).done(function(data) {
        data.tags.pop()
        Model.tags = data.tags[0].tags;
        });

    }

	
	Db.getmodel = function(onNoConversation){
	//Get the conversation from the DB
		$.ajax({
		dataType: 'json',
		url: 'php/getmodel.php',
		data: { conversation: conversation},
		async: false,
		}).done(function(data) {

		//data.nodes.pop();
		//data.links.pop();
            
        if (data.nodes == ""){
			onNoConversation(); //opennoconversationpanel();
			return;
		}
		modelfromdb =  { nodes: data.nodes, links: data.links, incomingGlobalLinks: data.incomingGlobalLinks, outgoingGlobalLinks: data.outgoingGlobalLinks };
		}).fail(function(data) {
	    });
	}
	
	
	Db.generatemodel = function(){
	//From the previous DB conversation generate a valid JS conversation
	
		var nodesjs=modelfromdb.nodes;
		var linksjs=modelfromdb.links;
		var numnodesdb=modelfromdb.nodes.length;
		var numlinksdb=modelfromdb.links.length;
		
		var nodeslist = [];

		for (var i=0; i<numnodesdb; i++) {

			var tempadvevalby=(nodesjs[i]['advevalby']).split("$$$$");

			onenodedb = {"hash":parseInt(nodesjs[i]['hash']),"content":nodesjs[i]['content'],"contentsum":nodesjs[i]['contentsum'],"evalpos":parseInt(nodesjs[i]['evalpos']),"evalneg":parseInt(nodesjs[i]['evalneg']),"evaluatedby":(nodesjs[i]['evaluatedby']).split("@@@@"),"adveval":(nodesjs[i]['adveval']).split("@@@@").map(Number),"advevalby":[tempadvevalby[0].split("@@@@"),tempadvevalby[1].split("@@@@"),tempadvevalby[2].split("@@@@"),tempadvevalby[3].split("@@@@")],"type":parseInt(nodesjs[i]['type']),"author":nodesjs[i]['author'],"seed":parseInt(nodesjs[i]['seed']),"time":parseInt(nodesjs[i]['time'])};
	

			nodeslist.push(onenodedb);
		}

		var linkslist = [];
		
		for (var i=0; i<numlinksdb; i++) {
	
			var tempadvevalby=(linksjs[i]['advevalby']).split("$$$$");

			onelinkdb = {"hash":parseInt(linksjs[i]['hash']),"source":parseInt(linksjs[i]['source']),"target":parseInt(linksjs[i]['target']),"direct":parseInt(linksjs[i]['direct']),"evalpos":parseInt(linksjs[i]['evalpos']),"evalneg":parseInt(linksjs[i]['evalneg']),"evaluatedby":(linksjs[i]['evaluatedby']).split("@@@@"),"adveval":(linksjs[i]['adveval']).split("@@@@").map(Number),"advevalby":[tempadvevalby[0].split("@@@@"),tempadvevalby[1].split("@@@@"),tempadvevalby[2].split("@@@@"),tempadvevalby[3].split("@@@@"),tempadvevalby[4].split("@@@@"),tempadvevalby[5].split("@@@@")],"type":linksjs[i]['type'],"author":linksjs[i]['author'],"time":parseInt(linksjs[i]['time'])};

			linkslist.push(onelinkdb);
		}

		modeldb = { nodes: nodeslist, links: linkslist, authors: []};	
	}
    
	function safejstringsfordb(text){
	    return text.replace(/\\/g,"\\\\").replace(/"/g,'\\"');
	}


	Db.saveNode = function(newnode){
	    if(conversation != "sandbox" && conversation != "sandbox_es"){
			var newnodejs = ["hash",newnode.hash,"content",safejstringsfordb(newnode.content),"contentsum",safejstringsfordb(newnode.contentsum),"evalpos",newnode.evalpos,"evalneg",newnode.evalneg,"evaluatedby",(newnode.evaluatedby).join("@@@@"),"adveval",(newnode.adveval).join("@@@@"),"advevalby",(newnode.advevalby[0]).join("@@@@")+'$$$$'+(newnode.advevalby[1]).join("@@@@")+'$$$$'+(newnode.advevalby[2]).join("@@@@")+'$$$$'+(newnode.advevalby[3]).join("@@@@"),"type",newnode.type,"author",newnode.author,"seed",newnode.seed,"time",newnode.time];
			newnodestring = newnodejs.join('####');
			var promise = $.Deferred();
			$.post("php/savenode.php", {newnodephp: newnodestring, conversation: conversation}, null, 'json')
				.done(function(res) {
					if(res.success) promise.resolve();
					else promise.reject(res.error);
				})
				.fail(function(err) {
					promise.reject(err);
				});
			return promise;
		}
        else return (new $.Deferred()).resolve();
	}

	Db.saveInnerLinkAppendInfo = function(link){
	    if(link.conversation != "sandbox" && link.conversation != "sandbox_es") {
	    	var time = Math.floor((new Date()).getTime() / 1000);
	    	var linkData = JSON.stringify({
	    		conversation: link.conversation.hash,
	    		source: link.source.hash,
	    		target: link.target.hash,
	    		direct: link.direct,
	    		type: link.type,
	    		author: link.author
	    	});
	    	
	    	console.log('saveInnerLinkAppendInfo', linkData);
			var promise = new $.Deferred();
            $.post("php/conversation-graph/savelink.php", { data: linkData }, null, 'json')
            	.done(function(res) {
            		console.log('done', res);
            		if(res.success) {
            			link.hash = res.hash;
            			link.time = res.time;
            			link.evalpos = res.evalpos;
            			link.evalneg = res.evalneg;
            			link.evaluatedby = res.evaluatedby;
            			link.adveval = res.adveval;
            			link.advevalby = res.advevalby;
            			promise.resolve(link);
            		}
            		else promise.reject(res.error);
            	})
            	.fail(function(err) {
            		promise.reject(err);
            	});
            return promise;
        }
        else return (new $.Deferred()).resolve();
	}

	Db.update_public_conv = function(){
	//Update the list of conversations in Participate from the DB list
			$.post("php/updatepublicconv.php");
			return false;
	}
	return Db;
});
