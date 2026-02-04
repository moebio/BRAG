//import '../../pulse.js'
export default class Draw {

	constructor(view) {
		this.view = view
		this.k = view.k

		this.zoom = 1
		this.nodes_zoom = 1//static, given by configuration
		this.nodesSize = 1//dynamic, affected by zoom
		this.x0 = 0
		this.y0 = 0

		this.iCircle

		this.drawNode = this.drawNode
		this.loadImage = this.loadImage
	}

	///////GENERAL

	draw() {


		let view = this.view
		if (this.k == null || view.net == null) return


		this.k.fill(view.config.view.background)
		//this.k._fRect(0,0,this.k.W,this.k.H)
		this.k.fRect(0, 0, this.k.W, this.k.H)

		if (view._FORCES_ACTIVE) {
			//if(view.config.physics.maxAcceleration){}
			if (view.forces.friction > view.config.physics.minFriction) {
				view.forces.friction *= view.config.physics.frictionDecay//0.995
				view.forces.calculateAndApplyForces()
			}
		}

		view.someLayout = (view.selectedNode != null && view.config.layout.selection_mode != "center") || view.pairSelected != null || view.layoutClusters

		if (view.someLayout) view.net.nodes.forEach(n => { n.x = 0.95 * n.x + 0.05 * n.xF; n.y = 0.95 * n.y + 0.05 * n.yF })

		let cursor_level
		if (view.selectedNode && view.config.layout.selection_mode == "spanning_tree") cursor_level = this._drawSpanningCircles()
		if (view.selectedNode && view.config.layout.selection_mode == "impact_from") this._drawFromToVerticalLines(false)
		if (view.selectedNode && view.config.layout.selection_mode == "impact_to") this._drawFromToVerticalLines(true)

		if (view.layoutClusters) this._drawClustersCircles()
		if (view.fixedX && view.config.layout.draw_grid && !view.selectedNode) this._drawGrid(view.fixedX, "x", view.fixedY)
		if (view.fixedY && view.config.layout.draw_grid && !view.selectedNode) this._drawGrid(view.fixedY, "y", view.fixedX)

		view.someLayout = view.someLayout || view.fixedX != null || view.fixedY != null

		this.nodesSize = this.nodes_zoom * (view.NODES_DYNAMIC_ZOOM ? this.zoom : 1)

		let prevNodeOver = view.overNode
		let prevRelationOver = view.overRelation
		view.overNode = null
		view.overRelation = null
		view.d2MinToCursor = 99999999
		view.closestNode = null
		view.drawTooltip = false

		//bakckground (normally does nothing, except when container overrides this function)
		this.drawBackground()

		///////////projection and draw

		//projection
		view.net.nodes.forEach(nd => this.projectAndPrepareNode(nd))



		//draw relations
		view.net.relations.forEach(r => {
			const over = this.drawRelation(r, prevNodeOver, cursor_level)
			if (over) view.overRelation = r
		})

		//draw nodes
		view.net.nodes.forEach(nd => { if (nd._visible) this.drawNode(nd) })


		//draw relations after (if function exists, injected from outside)
		if (this.drawRelationAfter) {
			view.net.relations.forEach(r => {
				const over = this.drawRelationAfter(r, prevNodeOver, cursor_level)
				if (over) view.overRelation = r
			})
		}

		//draw superpressed (including when connecting a superpressed node with another to be hovered)
		if (view.pairSelected) {
			this.drawSuperPressedNode(view.pairSelected.node0, view.pairSelected.node1)
		} else if (this.superPressedNode0) {
			this.drawSuperPressedNode(this.superPressedNode0, this.superPressedNode1)
		}


		if (view.overNode) view.overRelation = null

		if (view.OVER_CLOSEST) {
			view.overNode = view.closestNode
		}

		if (view.overNode) {
			this.drawNodeOver(view.overNode)
			if (view.config.nodes.tooltip) {
				const text = view.overNode[view.config.nodes.tooltip_property]
				this.k.setCursor('pointer')
				if (text) {
					view.tooltip.setData(text)
					view.drawTooltip = true
				}
			}
		}
		if (view.selectedNode) this.drawNodeSelected(view.selectedNode)

		if (view.config.layout.draw_loops) this._drawLoops(view.net.loops[view.config.layout.draw_loops])

		if (view.config.layout.simulation) this._drawImpacts()

		//interaction 1
		if (this.pressedNode && (this.k.SHIFT_PRESSED || view.config.nodes.draggable)) {
			this.pressedNode.x = this.invfX(this.k.mX)
			this.pressedNode.y = this.invfY(this.k.mY)

			this.pressedNode._px = this.k.mX
			this.pressedNode._py = this.k.mY

			this.pressedNode.vx = 0
			this.pressedNode.vy = 0

			this.pressedNode.fixed_x = this.pressedNode.x
			this.pressedNode.fixed_y = this.pressedNode.y

			view._FORCES_ACTIVE = true
			view.forces.friction = view.config.physics.friction
		} else {
			if (this.superPressedNode0) {
				if (!view.overNode) this.superPressedNode1 = null
			}
		}

		//interaction 2
		if (view.overNode && this.k.MOUSE_DOWN && !view.someLayout) {
			this.pressedNode = view.overNode
			this.pressedNode._xWhenPressed = this.k.mX
			this.pressedNode._yWhenPressed = this.k.mY
		}

		//super pressing a node for connecting with another
		if (this.pressedNode && view.overNode && this.k.T_MOUSE_PRESSED > view.config.interaction.milliseconds_for_superpressing) {
			let dx_sincepressed = Math.abs(this.pressedNode._xWhenPressed - this.k.mX)
			let dy_sincepressed = Math.abs(this.pressedNode._yWhenPressed - this.k.mY)
			if (dx_sincepressed < 2 && dy_sincepressed < 2) {
				this.superPressedNode0 = this.pressedNode
				this.pressedNode = null
				//better to isolate an unLayout function
				if (view.layoutClusters) view.callBackSendData({ type: 'layout', value: "clusters off" })
				view.layoutClusters = false
				view.layout_value = null
			}

		}
		//console.log(this.superPressedNode0!=null, view.overNode!=null, this.k.T_MOUSE_PRESSED>100, this.k.DX_MOUSE_DRAGGED<20,this.k.DY_MOUSE_DRAGGED<20)
		if (this.superPressedNode0 && view.overNode && view.overNode != this.superPressedNode0) this.superPressedNode1 = view.overNode

		if (this.k.MOUSE_UP) {
			if (this.pressedNode) {
				this.pressedNode.fixed_x = null
				this.pressedNode.fixed_y = null
				this.pressedNode = null
			}
			if (this.superPressedNode1) {
				view.selectPair(this.superPressedNode0, this.superPressedNode1)
			}
			this.superPressedNode0 = null
			this.superPressedNode1 = null
		}

		if (this.k.MOUSE_UP_FAST) {
			if (view.overRelation && view.config.relations.selectRelations) {
				view.relationSelected(view.overRelation)
				view.selectPair(view.overRelation.node0, view.overRelation.node1, false)
			} else if (view.selectedNode && view.config.interaction.node_unselection == "anywhere" && (!view.overNode || view.overNode == view.selectedNode)) {
				view.nodeUnSelected()
			} else if (view.overNode && view.overNode == view.selectedNode && view.config.interaction.node_unselection == "over_selected") {
				view.nodeUnSelected()
			} else if (view.overNode) {
				view.nodeSelected(view.overNode)
			} else if (view.pairSelected) {
				view.pairUnSelected()
			} else if (view.layoutClusters) {
				view._FORCES_ACTIVE = true
				view.forces.friction = view.config.physics.friction
				view._resetThickFactor()
			}
			if (view.layoutClusters) view.callBackSendData({ type: 'layout', value: "clusters off" })
			view.layoutClusters = false
			view.layout_value = null
		}

		if (this.k.WHEEL_CHANGE && !this.k.SHIFT_PRESSED) {
			let zoomChange = 1 + 0.1 * this.k.WHEEL_CHANGE
			if (this.zoom * zoomChange >= view.config.view.zoom_max || this.zoom * zoomChange <= view.config.view.zoom_min) zoomChange = 1;
			this.zoom *= zoomChange;
			this.zoom = Math.max(Math.min(this.zoom, view.config.view.zoom_max), view.config.view.zoom_min);
			this.x0 = (this.x0 - this.k.mX) * zoomChange + this.k.mX
			this.y0 = (this.y0 - this.k.mY) * zoomChange + this.k.mY

			view.positionChanged({ x0: this.x0, y0: this.y0, zoom: this.zoom, trigger: "zoom" })
		}
		if (!this.pressedNode && !this.superPressedNode0 && this.k.MOUSE_PRESSED) {
			this.x0 += this.k.DX_MOUSE_PRESSED
			this.y0 += this.k.DY_MOUSE_PRESSED

			view.positionChanged({ x0: this.x0, y0: this.y0, zoom: this.zoom, trigger: "position" })
		}

		if (this.k.SHIFT_PRESSED && view.config.interaction.shift_nodes_zoom) {
			this.nodes_zoom *= (1 + this.k.WHEEL_CHANGE * 0.05)
			this.nodes_zoom = Math.max(Math.min(this.nodes_zoom, view.config.view.nodes_zoom_max), view.config.view.nodes_zoom_min);
			view.nodesZoomChanged(this.nodes_zoom)
		}

		if (view.overNode != prevNodeOver && !view.overNode) view.nodeOut()
		if (view.overNode != prevNodeOver && view.overNode) view.nodeOver(view.overNode)
		if (view.overRelation != prevRelationOver && !view.overRelation) view.relationOut()
		if (view.overRelation != prevRelationOver && view.overRelation) view.relationOver(view.overRelation)

		//top (normally does nothing, except when container overrides this function)
		this.drawTop()

		//tooltip
		if (view.overRelation && view.config.relations.tooltip) {
			this.k.setCursor('pointer')
			view.tooltip.setData(view.overRelation[view.config.relations.tooltip_property])
			view.drawTooltip = true
		}
		if (view.drawTooltip) view.tooltip.draw()


		//keys
		if (this.k.KEY_PRESSED == "c") {
			view.nodeUnSelected()
			view.layouts.placeNodesInClusters()
		}
	}

	//////Back and Top
	drawBackground() {

	}
	drawTop() {

	}

	///////NODES
	drawNodeBeforeRelations(nd) {
		//if(Math.random()<0.1) console.log("[NV Dr] drawNodeBeforeRelations")
	}

	loadImage(nd) {
		nd._loadingImage = true
		_.loadImage(nd.urlImage, o => {
			if (!o.result) return
			nd.image = o.result
			nd._w_base = 0.8 * this.view.config.nodes.fixed_width
			//nd._h_base_no_image = nd._h_base
			nd._h_base_image = (nd.image.height / nd.image.width) * nd._w_base
		})
	}

	drawNode(nd) {
		let view = this.view
		let k = this.k

		let mode = view.config.nodes.draw_mode//||view.config.nodes.color_mode

		let mode_with_image = mode == "image" || mode == "image_with_frame" || mode == "image_circle" || mode == "image_circle_with_frame"

		if (mode_with_image && nd.image) nd._h = nd._h_base_image * nd._s

		if (mode_with_image && !nd.image) {
			mode = "box"

			//starts loading image if it has not yet
			if (nd.urlImage && !nd._loadingImage && view.config.nodes.download_images_automatically) {
				this.loadImage(nd)
			}
		}

		//console.log("draw node | mode, nd._px, nd._py", mode, nd._px, nd._py)
		switch (mode) {
			case 'circle':
				k.fill(nd.color)
				k.fCircle(nd._px, nd._py, nd._w * 0.5)
				break
			case 'image_circle_with_frame':
				k.fill(nd.color)
				k.fCircle(nd._px, nd._py, nd._w * 0.5 + 2)
				k.drawImageCircle(nd.image, nd._px, nd._py, nd._h * 0.5)
				break
			case 'image_circle':
				k.fill(nd.color)
				k.fCircle(nd._px, nd._py, nd._w * 0.5)
				k.drawImageCircle(nd.image, nd._px, nd._py, nd._h * 0.5)
				break
			case 'image_with_frame':
				k.fill(nd.color)
				k.fRect(nd._px - nd._w * 0.5 - 2, nd._py - nd._h * 0.5 - 2, nd._w + 4, nd._h + 4)
			case 'image':
				k.drawImage(nd.image, nd._px - nd._w * 0.5, nd._py - nd._h * 0.5, nd._w, nd._h)
				break
			case 'text':
				if (nd._ts < 4) return
				k.setText(nd.color ?? view.config.nodes.text_color, nd._ts, null, 'center', 'middle')
				k.stroke(view.config.nodes.text_border_color, 3)
				k.context.font = nd._ts + "px " + view.config.nodes.font
				k.fsText(nd.name, nd._px, nd._py, 3)
				return
			case 'box':
				k.setText(nd.color ?? view.config.nodes.text_color, nd._ts, null, 'center', 'middle') //doesn't do anything
			case 'underline':
				let x = nd._px - nd._w * 0.5

				if (mode == "underline") {
					k.setText(view.config.nodes.text_color)
				}

				if (view.config.nodes.useColorsTable && nd.colorsTable && nd.colorsTable[0].length > 0) {

					let w
					//console.log(nd.colorsTable[0].length)
					nd.colorsTable[0].forEach((color, i) => {
						k.fill(color)
						w = nd._w * nd.colorsTable[1][i]
						//k._fRect(x, nd._py-nd._h*0.5, w, nd._h)
						k.fRect(x, nd._py - nd._h * 0.5, w, nd._h)
						x += w
					})
				} else {
					//k._fRect(nd._px-nd._w*0.5, nd._py-nd._h*0.5, nd._w, nd._h)
					k.fRect(nd._px - nd._w * 0.5, nd._py - nd._h * 0.5, nd._w, nd._h)
				}

				if (nd._ts < 4) return

				if (view.config.nodes.fixed_width > 0) {
					k.setText(view.config.nodes.box_color, nd._ts, null, "center", "middle")
					k.context.font = nd._ts + "px " + view.config.nodes.font
					k.fTextWidth(nd.name, nd._px, nd._py + nd._dyText * nd._ts, view.config.nodes.fixed_width, nd._ts)
				} else {
					k.fill(view.config.nodes.box_color)
					k.context.font = nd._ts + "px " + view.config.nodes.font
					k.fText(nd.name, nd._px, nd._py)//, 3)
				}

				if (mode == "underline") {
					k.stroke(nd.color ?? view.config.nodes.text_color, 2)
					k.line(x + 2, nd._py + nd._h * 0.5 - 3, x + nd._w - 4, nd._py + nd._h * 0.5 - 3)
				}

				return
		}

	}

	projectAndPrepareNode(nd) {
		this._projectionNode(nd)
		if (!nd._visible) return

		let view = this.view

		if (view.NODES_CLOSE_ZOOM || view.OVER_CLOSEST) {
			var d2 = (this.k.mX - nd._px) ** 2 + (this.k.mY - nd._py) ** 2
			nd._distanceToCursor2 = d2
		}

		this._dimensionsNode(nd)

		if (view.OVER_CLOSEST) {
			if (d2 < view.d2MinToCursor) {
				view.closestNode = nd
				view.d2MinToCursor = d2
			}
		} else {
			if (this.isOverNode(nd)) view.overNode = nd
		}

		this.drawNodeBeforeRelations(nd)
	}

	isOverNode(nd) {
		return this.k.mY > nd._py - nd._h * 0.5 && this.k.mY < nd._py + nd._h * 0.5 && this.k.mX > nd._px - nd._w * 0.5 && this.k.mX < nd._px + nd._w * 0.5
	}

	fX = function (x) {
		return x * this.zoom + this.x0
	}
	fY = function (y) {
		return y * this.zoom + this.y0
	}

	invfX = function (x) {
		return (x - this.x0) / this.zoom
	}
	invfY = function (y) {
		return (y - this.y0) / this.zoom
	}


	_projectionNode(nd) {
		// nd._px = this.k.fX(nd.x)
		// nd._py = this.k.fY(nd.y)
		//console.log("1.   ", nd.x, nd.y, this.fX)
		nd._px = this.fX(nd.x)
		nd._py = this.fY(nd.y)
		nd._visible = nd._py >= -this.view.config.layout.margin_for_visibility && nd._py <= this.k.H + this.view.config.layout.margin_for_visibility && nd._px >= -this.view.config.layout.margin_for_visibility && nd._px <= this.k.W + this.view.config.layout.margin_for_visibility
		//console.log("2.   ", nd._px, nd._py, nd._visible)
		// nd.ax += -0.001*nd.x
		// nd.ay += -0.001*nd.y
	}

	_dimensionsNode(nd) {

		nd._s = this.nodes_zoom * (nd._size * this.view.config.nodes._amplitudeSize + this.view.config.nodes.minSize) * (this.view.NODES_CLOSE_ZOOM ? (0.5 + 0.6 * 5000 / (4000 + nd._distanceToCursor2)) * this.nodesSize : this.nodesSize)
		nd._w = nd._w_base * nd._s
		//nd._h = (this.view.config.nodes.text_size+this.view.config.nodes.box_padding*2)*nd._s
		nd._h = nd._h_base * nd._s
		nd._ts = 12 * nd._s
	}

	drawNodeOver(nd, color, thick) {
		this.drawNode(nd)//, dim)
		this.k.stroke(color ? color : this.view.config.nodes.box_border_color, thick ? thick : 2 * this.nodesSize)
		//this.k._sRect(nd._px-nd._w*.5, nd._py-nd._h*.5, nd._w, nd._h)

		let isCircular = (this.view.config.nodes.draw_mode == "image_circle_with_frame" && nd.image) || this.view.config.nodes.draw_mode == "image_circle" || this.view.config.nodes.draw_mode == "circle"

		if (isCircular) {
			this.k.sCircle(nd._px, nd._py, nd._w * 0.5)
		} else {
			this.k.sRect(nd._px - nd._w * .5, nd._py - nd._h * .5, nd._w, nd._h)
		}

	}

	drawNodeSelected(nd) {
	}

	drawSuperPressedNode(spNd, spNd2) {
		this.drawNodeOver(spNd, 'black', 8)

		this.k.stroke('rgba(255,255,255,0.8)', 5)
		this.k.context.setLineDash([11, 6])

		if (spNd2) {
			this.k.line(spNd._px, spNd._py, spNd2._px, spNd2._py)
			this.k.stroke('rgba(0,0,0,0.8)', 5)
			this.k.context.setLineDash([7, 10])
			this.k.line(spNd._px, spNd._py, spNd2._px, spNd2._py)

			this.k.context.setLineDash([])
			this.drawNodeOver(spNd2, 'black', 6)
		} else {
			//this.k._line(spNd._px, spNd._py, this.k.mX, this.k.mY)
			this.k.line(spNd._px, spNd._py, this.k.mX, this.k.mY)
			this.k.stroke('rgba(0,0,0,0.8)', 5)
			this.k.context.setLineDash([7, 10])
			this.k.line(spNd._px, spNd._py, this.k.mX, this.k.mY)

			this.k.context.setLineDash([])
		}


	}


	///////RELATIONS

	drawRelation(rel, prevNodeOver, cursor_level) {
		//console.log(!rel.node0._visible, !rel.node1._visible, rel._thickFactor==0)
		/////////relation visibility

		//nodes are not visible
		if ((!rel.node0._visible && !rel.node1._visible) || rel._thickFactor == 0) return

		let view = this.view

		//over node not in relation
		if (view.DRAW_ONLY_NODE_RELATIONS_ON_ROLLOVER && prevNodeOver && prevNodeOver != rel.node0 && prevNodeOver != rel.node1) return

		if (view.selectedNode) {

			switch (view.config.layout.selection_mode) {
				case "center":
					//return
					break
				case "spanning_tree":
					//relation not in spanning tree
					if (view.selectedNode && !rel._onTree) return
					//cursor out of level in spanning tree
					if (view.config.relations.show_mode_on_layout == "context" && cursor_level != null && Math.abs(rel._minLevelOnTree - cursor_level) > 0.5) return
					break
				case "impact_to":
					//relation not in impact to
					if (!rel._onImpactTo && (rel.node0 != prevNodeOver && rel.node1 != prevNodeOver)) return
					break
			}

		}


		/////////


		if (view.DRAW_RELATION_CENTER) {
			rel._pcenterx = (rel.node0._px + rel.node1._px) * 0.5
			rel._pcentery = (rel.node0._py + rel.node1._py) * 0.5
		}

		let weight = 0.5 * (rel._size || 1)

		if (view.DRAW_CLOSE_RELATIONS) {
			let minDistance2 = Math.min(rel.node0._distanceToCursor2 || 99999, rel.node1._distanceToCursor2 || 99999)
			if (view.DRAW_RELATION_CENTER) minDistance2 = Math.min(minDistance2, (this.k.mX - rel._pcenterx) ** 2 + (this.k.mY - rel._pcentery) ** 2)
			weight *= (0.2 + 0.8 * 7000 / (500 + minDistance2))
		}

		//projected position pre-calculated in nodes

		//weight different if this.DRAW_RELATION_CENTER

		if (view.config.relations.show_mode == 'close_few' && weight < 0.25) return

		let color = rel.color ?? view.config.relations.color ?? 'black'
		this.k.stroke(color, weight * rel._thickFactor)
		let over
		if (view.config.relations.curvature > 0) {
			let a = Math.atan2(rel.node1._py - rel.node0._py, rel.node1._px - rel.node0._px) + 1.5708;
			let r = view.config.relations.curvature * Math.sqrt(Math.pow(rel.node0._px - rel.node1._px, 2) + Math.pow(rel.node0._py - rel.node1._py, 2));
			let pMx = (rel.node0._px + rel.node1._px) * 0.5 + r * Math.cos(a);
			let pMy = (rel.node0._py + rel.node1._py) * 0.5 + r * Math.sin(a);
			this._drawArc(rel.node0._px, rel.node0._py, pMx, pMy, rel.node1._px, rel.node1._py)
			if (view.config.relations.arrow_size > 0) {
				this.k.fill(color)
				var triangleCenter = this._drawTriangleOnArc(
					rel.node0._px, rel.node0._py,
					pMx, pMy,
					pMx, pMy,
					rel.node1._px, rel.node1._py,
					a - 1.5708,
					(view.config.relations.arrow_size * this.zoom * rel._thickFactor * 0.8 + 1) * rel._size
				)
			}
			if (view.config.relations.tooltip) {
				over = (triangleCenter.x - this.k.mX) ** 2 + (triangleCenter.y - this.k.mY) ** 2 < 80
				if (over) {
					this._drawTriangleOnArc(
						rel.node0._px, rel.node0._py,
						pMx, pMy,
						pMx, pMy,
						rel.node1._px, rel.node1._py,
						a - 1.5708,
						(view.config.relations.arrow_size * this.zoom * rel._thickFactor * 0.8 + 1) * rel._size
					)
				}
			}
		} else {

			if (view.config.relations.tooltip) {
				over = this.k.lineM(rel.node0._px, rel.node0._py, rel.node1._px, rel.node1._py);
				//let line_center = new _.P((rel.node0._px+rel.node1._px)*0.5, (rel.node0._py+rel.node1._py)*0.5)
				//over = (line_center.x-this.k.mX)**2+(line_center.y-this.k.mY)**2<80
				if (over) { // this should be done after drawing all relations
					this.k.stroke(color, weight * rel._thickFactor * 3)
					this.k.line(rel.node0._px, rel.node0._py, rel.node1._px, rel.node1._py)
				}
			} else {
				this.k.line(rel.node0._px, rel.node0._py, rel.node1._px, rel.node1._py)
			}
			if (view.config.relations.arrow_size > 0) {
				//repeated code!!
				let pMx = (rel.node0._px + rel.node1._px) * 0.5
				let pMy = (rel.node0._py + rel.node1._py) * 0.5
				let a = Math.atan2(rel.node1._py - rel.node0._py, rel.node1._px - rel.node0._px);
				this.k.fill(color)
				this._drawTriangleOnArc(
					rel.node0._px, rel.node0._py,
					pMx, pMy,
					pMx, pMy,
					rel.node1._px, rel.node1._py,
					a,
					(view.config.relations.arrow_size * this.zoom * rel._thickFactor * 0.8 + 1) * rel._size
				)
			}
		}

		if (view.DRAW_RELATION_CENTER && weight > 0.8) {
			this.k.fill(color)
			over = this.k.fCircleM(rel._pcenterx, rel._pcentery, Math.min(weight * 2, 7))
		}
		//if(over) view.overRelation = rel
		// if(over && view.config.relations.tooltip){
		// 	this.k.setCursor('pointer')
		// 	view.tooltip.setData(rel[view.config.relations.tooltip_property])
		// 	view.drawTooltip = true
		// 	view.overRelation = rel
		// }
		return over
	}


	///////OTHER

	_drawArc(x0, y0, pMx, pMy, x1, y1) {
		this.k.bezier(
			x0, y0,
			pMx, pMy,
			pMx, pMy,
			x1, y1
		);
	}

	_drawTriangleOnArc(x0, y0, c0x, c0y, c1x, c1y, x1, y1, angle, scale) {
		var p = _.bezierCurvePoints(x0, y0, c0x, c0y, c1x, c1y, x1, y1, 0.5);
		this.k.fEqTriangle(p.x, p.y, angle, scale)
		return p
	}


	/////////////////////////////layout special drawings

	_drawSpanningCircles() {

		for (let i = 1; i < this.view.layouts.N_LEVELS_TREE; i++) {
			this._drawDashedCircle(this.view.selectedNode._px, this.view.selectedNode._py, this.zoom * this.view.config.layout.r_spanning_circles * i)
		}
		let r_cursor = Math.sqrt((this.k.mX - this.view.selectedNode?._px) ** 2 + (this.k.mY - this.view.selectedNode?._py) ** 2) / this.zoom

		return Math.floor(r_cursor / this.view.config.layout.r_spanning_circles)
	}

	_drawFromToVerticalLines(to) {
		let x0 = this.view.selectedNode._px

		let direction = to ? 1 : -1


		//this.k.stroke("black", 0.3)
		this.k.stroke(this.view.config.relations.color || 'black', 0.3)


		let x = x0 - direction * 0.5 * this.view.config.layout.dx_impact_columns * this.zoom
		this.k.context.setLineDash([6, 2])
		this.k.line(x, 20, x, this.k.H - 20)

		this.k.context.setLineDash([4, 6])
		for (let i = 0; i < this.view.layouts.N_LEVELS_INFLUENCE; i++) {
			x = x0 + direction * (i + 0.5) * this.view.config.layout.dx_impact_columns * this.zoom
			this.k.line(x, 20, x, this.k.H - 20)
		}

		this.k.context.setLineDash([]);
	}

	_drawClustersCircles() {
		if (!this.view.net.lastClusters) this.view.layouts.placeNodesInClusters()
		let prev_iCircle = this.iCircle
		this.iCircle = -1
		let x, y, r
		let inCluster
		let xIn, yIn, rIn
		let inClusterInterior = false
		this.view.net.lastClusters.circles.forEach((circle, i) => {
			x = this.fX(circle.x)
			y = this.fY(circle.y)
			r = circle.z * this.zoom
			this._drawDashedCircle(x, y, r)
			if ((this.k.mX - x) ** 2 + (this.k.mY - y) ** 2 < r ** 2) {
				this.iCircle = i
				xIn = x
				yIn = y
				rIn = r
				inCluster = this.view.net.lastClusters[i]
				inClusterInterior = (this.k.mX - x) ** 2 + (this.k.mY - y) ** 2 < (r * 0.7) ** 2
				if (inClusterInterior) this.iCircle += 0.5
			}
		})

		//change relations thickness
		if (prev_iCircle != this.iCircle) {
			this.view.net.relations.forEach(r => r._thickFactor = 0)
			inCluster?.forEach(n => {
				n.relations.forEach(r => {
					//either cursor is niot in the interior, either the relation is all contained in cluster
					if (!inClusterInterior || (inCluster.includes(r.node0) && inCluster.includes(r.node1))) {
						r._thickFactor = this.view.config.relations.max_thick
					}
				})
			})
		}
	}

	_drawDashedCircle(x, y, r) {
		//console.log("this.view.config.relations.color", this.view.config.relations.color)
		this.k.stroke(this.view.config.relations.color || 'black', 1)
		this.k.context.setLineDash([5, 10])
		//for(let i=0; i<this.view.layouts.N_LEVELS_TREE; i++){
		this.k.sCircle(x, y, r);
		//}
		this.k.context.setLineDash([]);
	}

	_drawLoops = function (loops) {
		loops.forEach(loop => {
			let pol = new _.Pol()
			let drawIt = !this.view.overNode && !this.view.overRelation
			loop.forEach((node, i) => {
				pol.push(new _.P(node._px, node._py))
				if (this.view.overNode == node) drawIt = true
			})
			if (this.view.overRelation) drawIt = loop.includes(this.view.overRelation.node0) && loop.includes(this.view.overRelation.node1)
			if (!drawIt) return
			this.k.stroke(loop.color, 24)
			this.k.drawSmoothPolygon(pol, true, 60 * this.zoom)
		})
	}

	_drawImpacts = function () {
		let r_base = 35 * this.zoom
		let thick_factor = 6
		let r, dr
		this.view.net.nodes.forEach(n => {
			r = r_base * n.impact

			if (n.impact > 1) {
				dr = r - r_base
				// + r_base*(n.impact-1)
				this.k.stroke("rgba(0,0,255,0.2)", dr)
				this.k.sCircle(n._px, n._py, r + dr * 0.5)
			} else if (n.impact < 1) {
				dr = r_base - r
				r = r_base * n.impact// + r_base*(n.impact-1)
				this.k.stroke("rgba(255,0,0,0.2)", dr)
				//console.log(n.name, (1-n.impact)*r_base)
				this.k.sCircle(n._px, n._py, r - dr * 0.5)
			} else {
				this.k.stroke("rgba(255,0,255,0.2)", 1)
				//console.log(n.name, (1-n.impact)*r_base)
				this.k.sCircle(n._px, n._py, r_base)
			}

			let d = Math.sqrt((this.k.mX - n._px) ** 2 + (this.k.mY - n._py) ** 2)
			if (Math.abs(d - r) < 15) {
				this.k.setCursor("pointer")
				if (this.k.MOUSE_DOWN) {
					this.k.MOUSE_DOWN = false
					this.k.MOUSE_PRESSED = false
					this.nodeChangingImpact = n
				}
			}

			if (n == this.nodeChangingImpact) {
				this.k.setCursor("pointer")
				n.impact = 1 + (d - r_base) / r_base
				n.impact = Math.min(Math.max(n.impact, 0.1), 1.9)
			}
		})
		if (this.k.MOUSE_UP && this.nodeChangingImpact) {
			let impact = this.nodeChangingImpact.impact
			this.view.net.nodes.forEach(n => n.impact = 1)
			_.modelInfluence(this.view.net, this.nodeChangingImpact, impact)
			this.nodeChangingImpact = null
		}
	}

	_drawGrid = function (axis, type, other_axis) {
		let dx = axis.dx
		let px, mx, my
		this.k.setText("rgb(100,100,100)", 12, null, "right", "bottom")
		for (var x = axis.x0; x <= axis.x1; x += dx) {
			let bold = (Math.round(x * 100000) / (dx * 1000000)) == Math.floor(Math.round(x * 100000) / (dx * 1000000))
			this.k.stroke("rgb(200,200,200)", bold ? 2 : 1)
			if (type == "x") {
				px = this.fX(axis.projection(x))
				mx = axis.inv_projection(this.invfX(this.k.mX))
				if (other_axis) {
					this.k.line(px, this.fY(other_axis.projection(other_axis.x0)), px, this.fY(other_axis.projection(other_axis.x1)))
					this.k.stroke("rgb(200,200,200)", 0.2)
					this.k.line(this.k.mX, this.fY(other_axis.projection(other_axis.x0)), this.k.mX, this.fY(other_axis.projection(other_axis.x1)))
					my = other_axis.inv_projection(this.invfY(this.k.mY))
					this.k.fText(mx.toFixed(2) + "," + my.toFixed(2), this.k.mX, this.k.mY)
				} else {
					this.k.line(px, 0, px, this.k.H)
					this.k.stroke("rgb(200,200,200)", 0.2)
					this.k.line(this.k.mX, 0, this.k.mX, this.k.H)
					this.k.fText(mx.toFixed(2), this.k.mX, this.k.mY)
				}
			} else {
				px = this.fY(axis.projection(x))
				if (other_axis) {
					this.k.line(this.fX(other_axis.projection(other_axis.x0)), px, this.fX(other_axis.projection(other_axis.x1)), px)
					this.k.stroke("rgb(200,200,200)", 0.2)
					this.k.line(this.fX(other_axis.projection(other_axis.x0)), this.k.mY, this.fX(other_axis.projection(other_axis.x1)), this.k.mY)
				} else {
					this.k.line(0, px, this.k.W, px)
					this.k.stroke("rgb(200,200,200)", 0.2)
					this.k.line(0, this.k.mY, this.k.W, this.k.mY)
					my = axis.inv_projection(this.invfY(this.k.mY))
					this.k.fText(my.toFixed(2), this.k.mX, this.k.mY)
				}
			}
		}
	}

}