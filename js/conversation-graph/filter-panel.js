define(['../webtext', '../event', '../filtercategory', '../conversation-graph/conversation-graph-lowlevel', '../conversation-graph/node-link-types', '../conversation-graph/filters'], 
function(Webtext, Events, FilterCategories, ConversationGraph, Types, Filters) {
	
	function FilterPanel_Abstraction() {
		var _this = this;
		this.control = new FilterPanel_Control(this);
		this.panelAndHelpVisibilityChanged = new Events.EventImpl();
		this.shownNodesAndLinksChanged = new Events.EventImpl();
		
		this.init = function() {
			initState();
			initFilters();
			this.control.init();
		}
		
		this.raiseInitialEvents = function() {
			_this.sizeFilterCategory.raiseInitialEvents();
			_this.showFilterCategory.raiseInitialEvents();
		}
		
		function initState() {
			_this.helpText = true;
			_this.expanded = false;
			
			_this.remainingNodes = [];
			_this.remainingLinks = [];
		}
		
		function initFilters() {
			_this.linkFilters = {};
			for(var i in Types.ThoughtLinkTypes) {
				var type = Types.ThoughtLinkTypes[i];
				var attributes = Types.ThoughtLinkTypeAttributes[type];
				if(attributes.isNullLink === true) break;
				_this.linkFilters[type] = {
					name: attributes.name,
					image: attributes.image,
					state: true,
					typeId: type
				};
			}
			
			_this.nodeFilters = {};
			for(var i in Types.ThoughtTypes) {
				var type = Types.ThoughtTypes[i];
				var attributes = Types.ThoughtTypeAttributes[type];
				_this.nodeFilters[type] = {
					name: attributes.name,
					image: attributes.image,
					state: true,
					typeId: type,
				};
			}
			
			var initState = [];
			for(var id in Filters.NodeFilters) initState[Filters.NodeFilters[id]] = true;
			_this.nodeFilterCategory = new FilterCategories.MultiSelect_Abstraction({
				itemIds: Filters.NodeFilters,
				initState: initState,
			});
			
			initState = [];
			for(var id in Filters.LinkFilters) initState[Filters.LinkFilters[id]] = true;
			_this.linkFilterCategory = new FilterCategories.MultiSelect_Abstraction({
				itemIds: Filters.LinkFilters,
				initState: initState,
			});
			
			_this.showFilterCategory = new FilterCategories.SingleSelect_Abstraction({
				possibleStates: Filters.ShowFilters,
				initState: Filters.ShowFilters.None,
			});
			_this.sizeFilterCategory = new FilterCategories.SingleSelect_Abstraction({
				possibleStates: Filters.SizeFilters,
				initState: Filters.SizeFilters.Evaluations,
			});
			
			_this.nodeEvalFilter = {
				value: 0,
				old: -1000,
			};
			
			_this.linkEvalFilter = {
				value: 0,
				old: -1000,
			};
		}
		
		function disableAllFilters(list) {
			var keys = Object.keys(list);
			keys.forEach(function(key) { list[key].state = false });
		}
		
		/*_this.nodeEvalFilterChanged = function(newValue) {
			_this.nodeEvalFilter.value = newValue;
			if ((_this.nodeEvalFilter.value == _this.nodeEvalFilter.old)) return;
			_this.nodeEvalFilter.old = _this.nodeEvalFilter.new;
			
			var nodes = Model.model.nodes;
		    var links = Model.model.links;
		
			_this.remainingNodes = [];
			_this.remainingLinks = [];
			
			nodes.forEach(function(d) {
				if ((d.evalpos-d.evalneg)>=_this.nodeEvalFilter.value){
					_this.remainingNodes.push(d);
				};
			});
		
			var nodesign = (_this.nodeEvalFilter.value>0) ? "+" : "";
		
			document.getElementById("handle1").innerHTML = nodesign + _this.nodeEvalFilter.value;
			
		    if (isNaN(_this.linkEvalFilter.value)) _this.remainingLinks = links.slice(); //TODO: is this correct - no filtering?
		    else {
		    	links.forEach(function(d) {
					if ((d.evalpos-d.evalneg)>=_this.linkEvalFilter.value && $.inArray(d.source, _this.remainingNodes)>=0 && $.inArray(d.target, _this.remainingNodes)>=0){
						_this.remainingLinks.push(d);
					};
				});
		    }
		    
		    _this.shownNodesAndLinksChanged.raise({ nodes: _this.remainingNodes, links: _this.remainingLinks });
		}
		
		_this.linkEvalFilterChanged = function(newValue) {
			_this.linkEvalFilter.value = newValue;
			if (!(_this.nodeEvalFilter.value == _this.nodeEvalFilter.old)) return;
			_this.nodeEvalFilter.old = _this.nodeEvalFilter.new;
			
			var links = Model.model.links;
			_this.remainingLinks = [];
			
			if(isNaN(_this.linkEvalFilter.value)) _this.remainingLinks = links.slice(); //TODO: is this correct - no filtering?
		    else {
		    	links.forEach(function(d) {
					if ((d.evalpos-d.evalneg)>=_this.linkEvalFilter.value && $.inArray(d.source, _this.remainingNodes)>=0 && $.inArray(d.target, _this.remainingNodes)>=0){
						_this.remainingLinks.push(d);
					};
				});
		    }
		 	
		    _this.shownNodesAndLinksChanged.raise({ nodes: [], links: _this.remainingLinks });
		}*/
		
		function toggleFilterPanelVisibility() {
			_this.expanded = !_this.expanded;
			_this.panelAndHelpVisibilityChanged.raise();
			
			_this.helpText = false;
		};
		_this.toggleFilterPanelVisibility = toggleFilterPanelVisibility;
		
		_this.clickFilterItem = function() {
			_this.helpText = false;
			_this.panelAndHelpVisibilityChanged.raise();
		}
	}
	
	function FilterPanel_Presentation(ABSTR) {
		var _this = this;
		
		this.init = function() {
			ABSTR.panelAndHelpVisibilityChanged.subscribe(onPanelAndHelpVisibilityChanged);
		
	        $('#filters_text').fadeOut(0);
	        $( "#cmd_hideshowfilters" ).click(ABSTR.toggleFilterPanelVisibility);
	        $( "#filters_title" ).click(ABSTR.toggleFilterPanelVisibility);
	        
	        function showWebtext(text) { $('.'+text).text(Webtext[text]) }
	        ['tx_legend', 'tx_click_hide_show', 'tx_thoughts', 'tx_connections', 'tx_sizes', 'tx_show'].forEach(function(tx) { showWebtext(tx) });
	        
	        //initSliders();
	        
	        initNodeFilters();
	        initLinkFilters();
			initShowFilters();
	        initSizeFilters();
		}
		
		/*function initSliders() {
			setTimeout(function() { 
				new Dragdealer('slider1', { animationCallback: nodeslider });
				new Dragdealer('slider2', { animationCallback: linkslider });
			}, 0);
		}*/
		
		// Start of initNodeFilters = create the html from the filters, appending it (appendChild) to the right div tags
	    function initNodeFilters() {
			var filterItems = [];
			for(var key in Filters.NodeFilters) {
				var id = Filters.NodeFilters[key];
				filterItems[id] = {
					id: id, name: ABSTR.nodeFilters[id].name, imageWidth: '32px', onClick: onClickFilterItem, 
					getImagePath: function() { return ABSTR.nodeFilters[this.id].image },
				};
			}
			
			// 4 filters with 2 per column for the nodes
	        var numFilts = 4;
	        var filtsPerCol = 2;
	        var filtsPerRow = Math.ceil(numFilts/filtsPerCol);
			_this.nodeFilterCategory = new FilterCategories.MultiSelect_Presentation(ABSTR.nodeFilterCategory, filterItems, {
				itemsPerRow: filtsPerRow,
				useImages: true,
				parent: $('#filt_nodes')[0]
			});
	    }
		
		function initShowFilters() {
			var showFilterInfo = [];
			//showFilterInfo[Filters.ShowFilters.Tags] = { id: Filters.ShowFilters.Tags, name: Webtext.tx_tags, onClick: onClickFilterItem };
			showFilterInfo[Filters.ShowFilters.Summaries] = { id: Filters.ShowFilters.Summaries, name: Webtext.tx_summaries, onClick: onClickFilterItem };
			showFilterInfo[Filters.ShowFilters.Authors] = { id: Filters.ShowFilters.Authors, name: Webtext.tx_authors, onClick: onClickFilterItem };
			
			_this.showFilter = new FilterCategories.SingleSelect_Presentation(ABSTR.showFilterCategory, showFilterInfo, {
				itemsPerRow: 1,
				useImages: false,
				parent: $('#filt_show')[0]
			});
		}
		
	    function initLinkFilters() {
			// 6 filters with 2 per column for the links
	        var numFilts = 6 ;
	        var filtsPerCol = 2 ;
	        var filtsPerRow = Math.ceil(numFilts/filtsPerCol);
	        var cellsPerRow = filtsPerRow * 3;
			
			var filterItems = [];
			for(var key in Filters.LinkFilters) {
				var id = Filters.LinkFilters[key];
				filterItems[id] = {
					id: id, name: ABSTR.linkFilters[id].name, onClick: onClickFilterItem, imageWidth: '20px',
					getImagePath: function() { return ABSTR.linkFilters[this.id].image },
				};
			}
			_this.linkFilterCategory = new FilterCategories.MultiSelect_Presentation(ABSTR.linkFilterCategory, filterItems, {
				itemsPerRow: filtsPerRow,
				useImages: true,
				parent: $('#filt_links')[0]
			});
	    };
		
	    function initSizeFilters() {
	    	var sizeFilterInfo = [];
	    	sizeFilterInfo[Filters.SizeFilters.Evaluations] = 
	    		{ name: Webtext.tx_evaluations, id: Filters.SizeFilters.Evaluations, onClick: onClickFilterItem };
			
			_this.sizeFilter = new FilterCategories.SingleSelect_Presentation(ABSTR.sizeFilterCategory, sizeFilterInfo, {
				itemsPerRow: 1,
				useImages: false,
				parent: $('#filt_sizes')[0]
			});
	    };
	    
	    function onClickFilterItem() {
	    	ABSTR.clickFilterItem();
	    }
	    
		/*function nodeslider (x){
			console.log('nodeslider');
			var nodesdifevalarray = Model.model.nodes.map(function(e){return e.evalpos-e.evalneg;});
		
			var nodesmaxeval = d3.max(nodesdifevalarray);
			var nodesmineval = d3.min(nodesdifevalarray);
			
			var nodesCutValue = Math.ceil(nodesmineval + (nodesmaxeval-nodesmineval)*x);
			
			ABSTR.nodeEvalFilterChanged(nodesCutValue);
		}
	
		function linkslider (x){
			var linksdifevalarray = Model.model.links.map(function(e){return e.evalpos-e.evalneg;});
			
			var linksmaxeval = d3.max(linksdifevalarray);
			var linksmineval = d3.min(linksdifevalarray);
		
			var linksCutValue = Math.ceil(linksmineval + (linksmaxeval-linksmineval)*x);
			
			var linkSign = (linksCutValue>0) ? "+" : "";
		    
		    if(isNaN(linksCutValue)) {
		 		document.getElementById("slider2").setAttribute("style","visibility:hidden;");
		 	}
		    else {
		 		document.getElementById("slider2").setAttribute("style","visibility:visible;");
				document.getElementById("handle2").innerHTML = linkSign + linksCutValue;
		 	}
			
			ABSTR.linkEvalFilterChanged(linksCutValue);
		}*/
		
		function updateFiltersHelpVisibility() {
			if (ABSTR.helpText){ 
				$("#filters_text").show();
		    } else {
				$("#filters_text").delay(300).fadeOut(600);
		    };
		}
		
		function updateFilterPanelVisibility() {
		    var height = (ABSTR.expanded) ? "105px" : "25px";
		    var arrowstr = (ABSTR.expanded) ? "&#8681;" : "&#8679;" ;
		    $("#lower_bar").css("height", height);
			$("#legendarrow").html(arrowstr);
		};
		
		function onPanelAndHelpVisibilityChanged() {
			updateFiltersHelpVisibility();
			updateFilterPanelVisibility();
		}
	}
	
	function FilterPanel_Control(abstraction) {
		var _this = this;
		
		this.init = function() {
			
			_this.nodeFilterChanged = abstraction.nodeFilterCategory.itemChanged;
			_this.linkFilterChanged = abstraction.linkFilterCategory.itemChanged;
			_this.showFilterChanged = abstraction.showFilterCategory.stateChanged;
			_this.sizeFilterChanged = abstraction.sizeFilterCategory.stateChanged;
			
			_this.shownNodesAndLinksChanged = abstraction.shownNodesAndLinksChanged;
			_this.hideShowFilters = abstraction.toggleFilterPanelVisibility;
		};
		
		
		function pipeEvent(name, parent, parentPropertyName) {
			_this[name] = function() {};
			if(parent[parentPropertyName || name])
				parent[parentPropertyName || name] = function() { _this[name].apply(_this, arguments) };
			else {
				console.log("error information", parent, parentPropertyName || name);
				throw new Error("pipeEvent: property does not exist");
			}
		}
	}
	
	return { 
		Abstraction: FilterPanel_Abstraction, 
		Presentation: FilterPanel_Presentation,
	};
});
