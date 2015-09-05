define(function() {
	
		
	function d3_layout_forceAccumulate(quad, alpha, chargeFn) {
		//borrowed from the d3js source
		var cx = 0, cy = 0;
		quad.charge = 0;
		if (!quad.leaf) {
			var nodes = quad.nodes,
			n = nodes.length,
			i = -1,
			c;
			while (++i < n) {
				c = nodes[i];
				if (c == null) continue;
				d3_layout_forceAccumulate(c, alpha, chargeFn);
				quad.charge += c.charge;
				cx += c.charge * c.cx;
				cy += c.charge * c.cy;
			}
		}
		if (quad.point) {
			// jitter internal nodes that are coincident
			if (!quad.leaf) {
			quad.point.x += Math.random() - .5;
			quad.point.y += Math.random() - .5;
			}
			var k = alpha * chargeFn(quad.point);
			quad.charge += quad.pointCharge = k;
			cx += k * quad.point.x;
			cy += k * quad.point.y;
		}
		quad.cx = cx / quad.charge;
		quad.cy = cy / quad.charge;
	}

	function repulse(node, theta2) {
		return function(quad, x1, _, x2) {
			if (quad.point !== node) {
				var dx = quad.cx - node.x,
				dy = quad.cy - node.y,
				dw = x2 - x1,
				dn = dx * dx + dy * dy;

				/* Barnes-Hut criterion. */
				if (dw * dw / theta2 < dn) {
					if (dn < Infinity) {
						var k = quad.charge / dn;
						node.px -= dx * k;
						node.py -= dy * k;
					}
					return true;
				}

				if (quad.point && dn && dn < Infinity) {
					var k = quad.pointCharge / dn;
					node.px -= dx * k;
					node.py -= dy * k;
				}
			}
			return !quad.charge;
		};
	}
	
	function applyCharge(nodes, alpha, theta, chargeFn) {
		var qtree = d3.geom.quadtree(nodes);
		d3_layout_forceAccumulate(qtree, alpha, chargeFn);
		for(var i=0; i<nodes.length; ++i) {
			if(!nodes[i].fixed) qtree.visit(repulse(nodes[i], theta*theta));
		}
	}
	
	return { applyCharge: applyCharge }
})