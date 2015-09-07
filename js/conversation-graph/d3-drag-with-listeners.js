define(function() {
	//borrowed from d3
	function drag(fn, force) {
	  return function() {
	    var drag = d3.behavior.drag()
	        .origin(function(d) { return d })
	        .on("dragstart.force", d3_layout_forceDragstart)
	        .on("drag.force", dragmove.bind(null, force))
	        .on("dragend.force", d3_layout_forceDragend);
	    fn(drag);
	
	    if (!arguments.length) return drag;
	    
	    this.on("mouseover.force", d3_layout_forceMouseover)
	        .on("mouseout.force", d3_layout_forceMouseout)
	        .call(drag);
	  };
	}
  
	function d3_layout_forceDragstart(d) {
	  d.fixed |= 2; // set bit 2
	}
	
	function d3_layout_forceDragend(d) {
	  d.fixed &= ~6; // unset bits 2 and 3
	}
	
	function d3_layout_forceMouseover(d) {
	  d.fixed |= 4; // set bit 3
	  d.px = d.x, d.py = d.y; // set velocity to zero
	}
	
	function d3_layout_forceMouseout(d) {
	  d.fixed &= ~4; // unset bit 3
	}

  function dragmove(force, d) {
    d.px = d3.event.x, d.py = d3.event.y;
    force.resume(); // restart annealing
  }
	return { drag: drag };
})