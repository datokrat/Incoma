define(['webtext'], function(webtextModule) {
	var Model = {};
	
	/*
	    This module stores the data of a debate in Model.model and
	    provides methods for loading, saving and editing it.
	    It also defines lists of known node/link types and fields.
	    The current author is stored in Model.currentAuthor.
	    
	    This module must be kept independent of any visualisations.    
	*/
	
	// anonymous helper functions:
	
	var cleanArray = function(oldArray, objectFields, fn) {
	    var result = [];
	    for (var i = 0; i < oldArray.length; ++i) {
	        var newObj = cleanObject(oldArray[i], objectFields, fn);
	        result.push(newObj);
	    };
	    return result;
	};
	
	var cleanObject = function(obj, fields, cleanUp) {
	    var cleanObject = {};
	    for (var i = 0; i < fields.length; ++i) {
	        var f = fields[i];
	        cleanObject[f] = obj[f];
	    };
	    if (cleanUp) {
	        cleanUp(cleanObject);
	    }
	    return cleanObject;
	};
	
	(function() { // create anonymous namespace
	
	// some static information
	
	Model.nodeTypesArray = ["General", "Question", "Proposal", "Info"];
	
	Model.linkTypesArray = ["General", "Agreement", "Disagreement", "Consequence", "Alternative", "Equivalence", "No relation"];
	
	Model.linkConnectTypesArray = ["General", "Consequence", "Agreement", "Disagreement", "Alternative" , "Equivalence"];
	
	Model.nodeTypes = {
	    "General" : {text: webtextModule.tx_general, value: 1, image: "img/node1.png"},
	    "Question" : {text: webtextModule.tx_question, value: 2, image: "img/node2.png"},
	    "Proposal" : {text: webtextModule.tx_proposal, value: 3, image: "img/node3.png"},
	    "Info" : {text: webtextModule.tx_info, value: 4, image: "img/node4.png"},
	};
	
	Model.linkTypes = {
	    "General" : {text: webtextModule.tx_general, value: 1, image: "img/link1.png"}, 
	    "Agreement" : {text: webtextModule.tx_agreement, value: 2, image: "img/link2.png"},
	    "Disagreement" : {text: webtextModule.tx_disagreement, value: 3, image: "img/link3.png"}, 
	    "Consequence" : {text: webtextModule.tx_consequence, value: 4, image: "img/link4.png"}, 
	    "Alternative" : {text: webtextModule.tx_alternative, value: 5, image: "img/link5.png"},
		"Equivalence": {text: webtextModule.tx_equivalence, value: 6, image: "img/link6.png"},
	    "No relation": {text: webtextModule.tx_norelation, value: 0, image: "img/link0.png"},
	};
	
	
	function optionList(linkNames) {
	    result = [];
	    for (var i=0; i < linkNames.length; ++i) {
	        result.push(Model.linkTypes[linkNames[i]]);
	    };
	    return result;
	};
	
	
	Model.connectionList = function(nodeType) {
	    switch(nodeType) {
	        // 1 = General
	        case 1: 
		//************************************
		return optionList( ["General", "Agreement", "Disagreement", "Consequence", "Alternative", "Equivalence", "No relation"] );
		//************************************
	        // 2 = Question
	        case 2: 
	            return optionList( ["General", "No relation"] );
	        // 3 = Proposal
	        case 3: 
		//***************
		return optionList( ["General", "Alternative", "No relation"] );
		//***************
	        // 4 = Info
	        case 4: 
	            return optionList( ["General", "Agreement", "Disagreement", "Consequence", "Alternative", "Equivalence", "No relation"] );
	        default:
	            return [];
	    }
	};
	
	//*****************
	Model.nodeFields = [ 
			    "hash", "content", "contentsum",
	    "evalpos", "evalneg", "evaluatedby",
	    "adveval", "advevalby",
	    "type", "author", "seed", "time"
	];
	
	Model.linkFields = [
	    "hash", "source", "target", "direct", 
	    "evalpos", "evalneg", "evaluatedby",
	    "adveval", "advevalby",
	    "type", "author", "time"
	];
	//*******************
	
	// dynamic information:
	
	Model.model = null;
	
	Model.currentAuthor = null;
	
	Model.currentAuthor = function(name) {
	    if(name || name === null)
	        Model._currentAuthor = name;
	    return Model._currentAuthor || "anonymous";
	};
	
	Model.clear = function(model) {
		console.log('clear');
	    this.model = model || { nodes: [], links: [], authors: author};
	};
	
	
	//*************************
	Model.createNode = function(nodetype, content, contentsum, author, seed, time) {
	
	    var newHash = parseInt(this.nodehashit(content + contentsum + nodetype + author + time));
	    
	   var newNode = {
	        "hash": newHash,
	        "content": content,
	        "contentsum": contentsum,
	        "evalpos": 1,
			"evalneg": 0,
	        "evaluatedby": [author],
	        "adveval": [0,0,0,0],
	        "advevalby": [[],[],[],[]],
	        "type": nodetype,
	        "author":  author,
			"seed":seed,
	        "time": (time || Math.floor((new Date()).getTime() / 1000)),
	  };
	  Model.model.nodes.push(newNode);
	};
	
	Model.createLink = function(linktype, source, target, author, time) {
	
	  var hash = hashit(source + target + author + linktype + time);
	
	  var newLink = {
	"hash": hash, 
	      "source": source, 
	      "target": target,
		"direct": 1, 
		"evalpos": 1, 
	        "evalneg": 0,
	      "evaluatedby": [author],
	      "adveval": [0,0,0,0,0,0],
	      "advevalby": [[],[],[],[],[],[]],
	      "type": linktype,
	      "author": author,
	      "time": (time || Math.floor((new Date()).getTime() / 1000)),
	  };
	  Model.model.links.push(newLink);
	};
	//*************************    
	    
	Model.importFile = function(text, mime) {
	    // TODO: check mime for other formats
	    switch (mime) {
	        case "application/x-incoma+json":
	        default:
	            this.model = JSON.parse(text);
	    }
	};
	    
	Model.exportFile = function() {
	    return { text: JSON.stringify(Model.cleanModel()),
	             mime: "application/x-incoma+json" };
	};
	       
	Model.cleanModel = function(old) {
	    if (!old) {
	        old = Model.model;
	    };
	    var rplHash = function(obj) {
	        obj.source = obj.source.hash;
	        obj.target = obj.target.hash;
	    };
	    return { nodes:   cleanArray(old.nodes, Model.nodeFields), 
	             links:   cleanArray(old.links, Model.linkFields, rplHash), 
	             authors: old.authors };
	};
	
	Model.nodehashit = function(string){
	// Create a hash to identify a node
		///var PRES = Visualisations.current().presentation;
		///nodes = PRES.force.nodes();
		var nodes = this.model.nodes;
		///
		var current_model = this.model;
		var current_model_nodeshashlist = [];
		
		for (var i=0;i<current_model.nodes.length;i++){	
			current_model_nodeshashlist.push(current_model.nodes[i].hash);
		}
				
		var temphash = hashit(string);

	    while($.inArray(temphash, current_model_nodeshashlist) > -1){
			var newstring = string + Date.now();
	        temphash = hashit(newstring);
	    }
	
	    return temphash;
	}


	Model.linkhashit = function(string){
		// Create a hash to identify a link
		///var PRES = Visualisations.current().presentation;
		///links = PRES.force.links();
		var links = this.model.links;
		var current_model = this.model;
		var current_model_linkshashlist = [];
		
		for (var i=0;i<current_model.links.length;i++){	
			current_model_linkshashlist.push(current_model.links[i].hash);
		}
				
		var temphash = hashit(string);

	    while($.inArray(temphash, current_model_linkshashlist) > -1){
			var newstring = string + Date.now();
	        temphash = hashit(newstring);
	    }
	
	    return temphash;
	}


	function hashit(str){
		// Generate a hash from a string (v1)
		var hash = 5381;
		for (i = 0; i < str.length; i++) {
			char = str.charCodeAt(i);
			hash = ((hash << 5) + hash) + char; /* hash * 33 + c */
		}
		return Math.abs(parseInt(hash));
	}
	                            
	})(); // end anonymous namespace
	return Model;
});