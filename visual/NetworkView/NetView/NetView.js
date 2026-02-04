import '../../../libraries/pulse.js'
import './tsne.js'
import Draw from './Draw.js'
import Layouts from './Layouts.js'
//import Element from '../../Elements/Element.js'
import Tooltip from '../Elements/Tooltip.js'

export default class NetView {

	constructor(k, callBackSendData, config) {//extends View
		//super(...args) //when extending View


		const font = new FontFace("myfont", "url(https://fonts.gstatic.com/s/bitter/v7/HEpP8tJXlWaYHimsnXgfCOvvDin1pK8aKteLpeZ5c0A.woff2)", {
			style: "italic",
			weight: "400",
			stretch: "condensed",
		});

		font.load();


		document.fonts.add(font)

		//k.context.font = "80px myfont"

		document.fonts.ready.then(() => {
			//console.log("font ready", font)
		})


		this.k = k

		this.drawMethods = new Draw(this)
		this.layouts = new Layouts(this)

		this.callBackSendData = callBackSendData

		this.forces = new _.Forces()

		let defaultC = JSON.parse(JSON.stringify(NetView.defaultConfig))

		this.config = config ? Object.assign(defaultC, config) : defaultC
		this.setConfiguration(this.config)

		////params


		this.OVER_CLOSEST = false
		this._FORCES_ACTIVE = true
		this.ZOOM_TO_CURSOR = true

		this.zoomPoint = new _.P(k.cX, k.cY)

		this.pairSelected
		this.layout_value

		this.N_LEVELS_TREE
		this.N_LEVELS_INFLUENCE

		this.net
	}

	static defaultConfig = {
		nodes: {
			text_size: 14,
			text_color: 'white',
			text_border_color: 'white',
			box_color: 'black',
			box_border_color: 'black',
			box_padding: 2,
			fixed_width: 100,
			draw_mode: 'box',//'image_with_frame', //'image' //'image_circle' //circle //'box',//text, box, categories
			download_images_automatically: true, //requires property urlImage on nodes
			font: "Arial",
			size_property: "weight",
			draggable: true,
			tooltip: false,
			tooltip_property: 'description',
			tooltip_width: 200,
			tooltip_font_size: 16,
			useColorsTable: false, //requires that node has property colorsTable
			maxSize: 1,
			minSize: 0.05
		},
		relations: {
			//draw:'node_over',//node_over,always
			show_mode: 'over',//all,over,close_all,close_few
			show_mode_on_layout: 'context',//all,
			selectRelations: true,
			curvature: 0,//inactive if 0
			arrow_size: 0,//inactive if 0
			color: "black",
			size_property: "weight",
			tooltip: false,
			tooltip_property: 'name',
			max_thick: 2
		},
		physics: {
			friction: 0.9,
			frictionDecay: 0.995,
			minFriction: 0.2,
			k: 0.01,
			dEqSprings: 100,
			dEqRepulsors: 500,
			equilibrimDistance: 100,
			attractionToCenter: false,
			attractionToCenterFactor: 0.000004
		},
		view: {
			background: 'white',
			zoom_min: 0.1,
			zoom_max: 20,
			nodes_zoom_min: 0.2,
			nodes_zoom_max: 5,
			detect_mouse_out_tile: true
		},
		interaction: {
			nodes_zoom: 'close',//static,close
			shift_nodes_zoom: true,
			node_unselection: "anywhere",//"over_selected"
			milliseconds_for_superpressing: 300 //time elapsed when pressing a node to start conencting to another node
		},
		layout: {
			selection_mode: 'spanning_tree',//impact_from,impact_to,spanning_tree, center
			r_spanning_circles: 120,
			dx_impact_columns: 180,
			dy_impact_columns: 50,
			margin_for_visibility: 170,
			savesNodesPositionsOnBrowser: false,
			draw_loops: 0,
			draw_grid: true,
			simulation: false,
			clusters_circles_margin: 4
		}
	}

	draw() {
		this.drawMethods.draw()
	}

	receiveData(dataObj) {
		//console.log("NetView receiveDatas:", dataObj)
		let node

		switch (dataObj.type) {
			case null:
			case undefined:
			case "net":
			case "network":
			case "data":
				this.setNetwork(dataObj.value)
				break
			case "configuration":
				this.setConfiguration(dataObj.value)
				break
			case "select":
				this.layoutClusters = false
				this.nodeSelected(dataObj.value)
				break
			case "select by name":
			case "select_by_name":
				this.layoutClusters = false
				this.nodeSelected(this.net.getByName(dataObj.value))
				break
			case "over":
				node = typeof (dataObj.value) == "string" ? this.net.get(dataObj.value) : dataObj.value
				if (node) {
					this.k.mX = node._px + 2
					this.k.mY = node._py + 2
					//this.drawMethods.draw(true)
				}
				//this.k.stop()
				break
			case "unselect":
				this.nodeUnSelected()
				break
			case "new_drawNode":
				this.setNewDrawNodeFunction(dataObj.value)
				break
			case "position":
				if (dataObj.value.type == "Nd") {
					this.layouts.gotoNode(dataObj.value)
					break
				} else if (typeof (dataObj.value) == "string") {
					const node = this.net.get(dataObj.value)
					if (node) {
						this.layouts.gotoNode(node)
						break
					}
				}
				let xF = dataObj.value.x//!=null?dataObj.value.x:this.drawMethods.invfX(this.k.cX)
				let yF = dataObj.value.y//!=null?dataObj.value.y:this.drawMethods.invfY(this.k.cY)
				let zoomF = dataObj.value.zoom//!=null?dataObj.value.zoom:this.drawMethods.zoom

				this.layouts.goto(xF, yF, zoomF, dataObj.value.smooth)

				if (dataObj.value == "center") this.receiveData({ type: "layout", value: "center" })
				break
			case "nodes zoom":
			case "nodes_zoom":
				this.drawMethods.nodes_zoom = Math.max(Math.min(dataObj.value, this.config.view.nodes_zoom_max), this.config.view.nodes_zoom_min)
				break
			case "load_image":
				node = typeof (dataObj.value) == "string" ? this.net.get(dataObj.value) : dataObj.value

				if (!node.urlImage || node._loadingImage || (node.image && node.image.width)) return

				node._loadingImage = true

				this.drawMethods.loadImage(node)
				// _.loadImage(node.urlImage, o=>{
				//    if(!o.result) return
				//    node.image=o.result
				//    node._w_base = 0.8*this.config.nodes.fixed_width
				//    node._h_base = (node.image.height/node.image.width)*node._w_base
				// })
				break
			case "x":
				switch (dataObj.value) {
					case "free":
						this.layouts.freeNodesInX()
						break
					default:
						this.layouts.placeNodesInXProperty(dataObj.value)
				}
				break
			case "y":
				switch (dataObj.value) {
					case "free":
						this.layouts.freeNodesInY()
						break
					default:
						this.layouts.placeNodesInYProperty(dataObj.value)
				}
				break
			case "tsne":
				//dataObj.value is the name of the property within the nodes
				//that stores numeric arrays
				//(typically: "embedding")
				this.layouts.tsne(dataObj.value)
				break
			case "layout":
				if (!dataObj.value.includes("free") || dataObj.value == "center") this.layout_value = dataObj.value
				switch (dataObj.value) {
					case "clusters":
						this.nodeUnSelected()
						this.layouts.placeNodesInClusters()
						break
					case "clusters category"://should be done for any property
						this.nodeUnSelected()
						this.layouts.placeNodesInClusters("category")
						break
					case "cloud"://should be done for any property
						this.nodeUnSelected()
						this.layouts.placeNodesInCloud()
						break
					case "xy":
						this.layouts.placeNodesInXY()
						break
					case "xy fixed":
						console.log("xy fixed")
						this.layouts.placeNodesInXY(true)
						break
					case "x":
						this.layouts.placeNodesInX()
						break
					case "x fixed":
						this.layouts.placeNodesInX(true)
						break
					case "y":
						this.layouts.placeNodesInY()
						break
					case "y fixed":
						this.layouts.placeNodesInY(true)
						break
					case "free":
						this.layouts.freeNodesInXY()
						break
					case "free x":
						this.layouts.freeNodesInX()
						break
					case "free y":
						this.layouts.freeNodesInY()
						break
					case "fit in window":
						this.layouts.fitInWindow()
						break
					case "center":
						if (this.selectedNode) {
							this.nodeSelected(this.selectedNode)
						} else {
							this.layouts.center()
						}
						break
					case "centroid":
						this.layouts.center(false)
						break
				}
				break
			case "mouse_out_tile":
				if (this.config.view.detect_mouse_out_tile) {
					this.k.mX = 99999
					this.k.mY = 99999
					this.nodeOut()
				}
				break
		}
	}

	setNetwork(net) {
		//random network
		if (net.nodes && typeof (net.nodes) == "number" && net.relations && typeof (net.relations) == "number") {
			net = _.createRandomNetwork(net.nodes, net.relations)
		}

		//network to be parsed
		if (net["type"] != "Net" && net["type"] != "Tr") net = _.parseNet(net)

		let firstNet = net && this.net == null

		if (this.net != net && net) {
			var previous = this.net;
			var previousSelected = this.selectedNode

			var previousLayoutValue = this.layout_value// && this.layout_value!="center"
			this.layoutClusters = false

			this.net = net

			this.__callBackSendData = this.callBackSendData
			this.callBackSendData = () => { }
			this.nodeUnSelected()
			this.callBackSendData = this.__callBackSendData

			let nodesHaveCoordinates = true
			let allCoordinatesZero = true
			net.nodes.forEach(nd => {
				if (!nd._fixed) {
					nd.x = null
					nd.y = null
				}
				if (nd.x == null || nd.y == null) nodesHaveCoordinates = false
				if (nd.x || nd.y) allCoordinatesZero = false
				this.assignSizeToNode(nd)
			})

			net.relations.forEach(r => r._size = r[this.config.relations.size_property] || 1)

			if (allCoordinatesZero) nodesHaveCoordinates = false
			//console.log("--_>>>> forces, nodesHaveCoordinates", nodesHaveCoordinates)
			this.forces.forcesForNetwork(net, nodesHaveCoordinates ? 0 : 200, new _.P(500, 400), undefined, undefined, this.config.physics.attractionToCenter)
			this.forces.attractionToCenterFactor = this.config.physics.attractionToCenterFactor

			this.k.context.font = "12px " + this.config.nodes.font
			this.net.nodes.forEach(nd => {
				if (this.config.nodes.draw_mode == "circle") {//probably others
					nd._w_base = nd._h_base = 100
				} else if (this.config.nodes.fixed_width > 0) {
					this.k.setText(this.config.nodes.box_color, 12, null, "center", "middle")
					this.k.context.font = "12px " + this.config.nodes.font
					let textInfo = this.k._textWidthSectionsInfo(nd.name, this.config.nodes.fixed_width)
					let nLines = textInfo.nLines// this.k.nLines(nd.name, this.config.nodes.fixed_width)
					//nd._w_base = this.config.nodes.fixed_width+this.config.nodes.box_padding*2
					nd._w_base = textInfo.maxWidth + this.config.nodes.box_padding * 2
					nd._h_base = 12 * nLines + this.config.nodes.box_padding * 2
					nd._dyText = -0.5 * (nLines - 1)
				} else {
					nd._w_base = this.k.getTextW(nd.name) + this.config.nodes.box_padding * 2
					nd._h_base = 12 + this.config.nodes.box_padding * 2
				}

				//console.log("         --_>>>> forces, nd.x, nd.y",nd.x, nd.y)

				//images
				//console.log("||| 1 this.config.nodes.download_images_automatically, nd.urlImage", this.config.nodes.download_images_automatically, nd.urlImage)
				if (this.config.nodes.download_images_automatically && nd.urlImage && !nd._loadingImage) {

					//in case the node had already a loaded image

					if (nd.image && nd.image.width) {
						nd._w_base = 0.8 * this.config.nodes.fixed_width
						nd._h_base = (nd.image.height / nd.image.width) * nd._w_base
					}

				}
			})

			if (this.config.layout.draw_loops) this.calculateLoops(net)



			if (!previous && !nodesHaveCoordinates) {

				if (this.config.savesNodesPositionsOnBrowser && localStorage.NetViewNodesPositions) {
					let array = localStorage.NetViewNodesPositions.split("|")
					array.forEach(ndpos => {
						if (ndpos.length == 0) return
						let parts = ndpos.split("#")
						let node = this.net.nodes.get(parts[0])
						//console.log(parts[0], node, Number(parts[1]), Number(parts[2]))
						if (node) {
							node.x = node.xF = Number(parts[1])
							node.y = node.yF = Number(parts[2])
						}
					})



				} else {

					//this.net.nodes.forEach(n=>{console.log("1", n.x)})
					//this.forces.friction = 0.52
					this.forces.iterate(200)

					//this.net.nodes.forEach(n=>{console.log("2", n.x)})

					if (this.config.savesNodesPositionsOnBrowser) {
						localStorage.NetViewNodesPositions = ''
						this.net.nodes.forEach(n => {
							localStorage.NetViewNodesPositions += "|" + n.id + "#" + n.x.toFixed(2) + "#" + n.y.toFixed(2)
						})
					}
				}

			}




			if (previousSelected) {
				let selectedInNewNet = net.get(previousSelected.id)
				if (selectedInNewNet) this.nodeSelected(selectedInNewNet)
			}

			if (previousLayoutValue) {
				//this should be different,
				//Layout should manage all this
				//this.layout.setLayout(previousLayoutValue)
				this.receiveData({ type: "layout", value: previousLayoutValue })
			}
		}

		if (firstNet) {
			this.callBackSendData({ type: 'report', value: 'first' })
		} else {
			this.callBackSendData({ type: 'report', value: 'new' })
		}


	}

	_resetThickFactor = function (thickness = 1) {
		//console.log("this.net", this.net)
		//_thickFactor is used to draw thicker relations in special cases
		this.net.relations.forEach(r => { r._thickFactor = thickness * this.config.relations.max_thick })
	}

	assignSizeToNode = function (node) {
		let sizeByProperty

		switch (this.config.nodes.size_property) {
			case null:
				sizeByProperty = 1
				break
			case "degree":
				sizeByProperty = node.relations.length / 5
				break
			case "to degree":
				sizeByProperty = node.to.length / 5
				break
			case "from degree":
				sizeByProperty = node.from.length / 5
				break
			default:
				sizeByProperty = node[this.config.nodes.size_property]
				if (sizeByProperty == null) sizeByProperty = 1
				break

		}

		node._size = this.config.nodes.maxSize * sizeByProperty
	}


	setConfiguration(config) {
		if (config == null) return

		if (config == "default") {
			config = JSON.parse(JSON.stringify(NetView.defaultConfig))
		}


		if (config.nodes?.color_mode && !config.nodes?.draw_mode) config.nodes.draw_mode = config.nodes.color_mode

		if (config.physics?.friction) this._FORCES_ACTIVE = true

		let change_in_nodes_size_property = this.config.nodes.size_property != config.nodes?.size_property || this.config.nodes.maxSize != config.nodes?.maxSize || this.config.nodes.minSize != config.nodes?.minSize
		let change_in_relations_size_property = this.config.relations.size_property != config.relations?.size_property

		//this.config = JSON.parse(JSON.stringify(NetView.defaultConfig))//Object.assign(NetView.defaultConfig)//config?Object.assign(NetView.defaultConfig, config):NetView.defaultConfig
		_.deepAssign(this.config, config)

		if (change_in_nodes_size_property && this.net) this.net.nodes.forEach(n => this.assignSizeToNode(n))
		if (change_in_relations_size_property && this.net) this.net.relations.forEach(r => r._size = r[this.config.relations.size_property])
		if (this.config.layout.draw_loops && this.net) this.calculateLoops(this.net)

		this.config.nodes._amplitudeSize = this.config.nodes.maxSize - this.config.nodes.minSize

		this.ZOOM_MIN = this.config.view.zoom_min
		this.ZOOM_MAX = this.config.view.zoom_max

		this.forces.k = this.config.physics.k
		this.forces.friction = this.config.physics.friction

		// this.forces.dEqSprings = this.config.physics.dEqSprings
		// this.forces.dEqRepulsors = this.config.physics.dEqRepulsors


		this.forces.setEquilibriumDistances(this.config.physics.dEqSprings, this.config.physics.dEqRepulsors)

		this.forces.dEqRepulsors = this.config.physics.dEqRepulsors
		this.forces.attractionToCenter = this.config.physics.attractionToCenter

		let changeInDEqSprings = this.forces.dEqSprings != this.config.physics.dEqSprings
		if (changeInDEqSprings) {
			this.forces.dEqSprings = this.config.physics.dEqSprings
			//this.forces.equilibriumDistances = Array(this.forces.equilibriumDistances.length).fill(this.forces.dEqSprings).tonL()
			//this.forces.equilibriumDistances = Array(this.forces.equilibriumDistances.length).fill(this.forces.dEqSprings).tonL()
			this.forces.forces.forEach(f => f.equilibriumDistance = this.forces.dEqSprings)
		}



		this.NODES_DYNAMIC_ZOOM = this.config.interaction.nodes_zoom == 'dynamic' || this.config.interaction.nodes_zoom == 'close'
		this.NODES_CLOSE_ZOOM = this.config.interaction.nodes_zoom == 'close'

		this.DRAW_ONLY_NODE_RELATIONS_ON_ROLLOVER = this.config.relations.show_mode == 'over'
		this.DRAW_CLOSE_RELATIONS = this.config.relations.show_mode == 'close_few' || this.config.relations.show_mode == 'close_all'
		this.DRAW_RELATION_CENTER = this.config.relations.tooltip && !this.config.relations.curvature > 0

		if (this.forces && this.config?.physics) {
			this.forces.dEqSprings = this.config.physics.dEqSprings
			this.forces.dEqRepulsors = this.config.physics.dEqRepulsors
		}

		if ((this.config.relations.tooltip || this.config.nodes.tooltip) && this.tooltip == null) {
			this.tooltip = new Tooltip(this.k)
			this.tooltip.config.fixedWidth = this.config.nodes.tooltip_width
			this.tooltip.config.font_size = this.config.nodes.tooltip_font_size
		}

		//unselect and select to trigger changes such as layout
		if (this.selectedNode) {
			let prevSelected = this.selectedNode
			this.nodeUnSelected()
			this.nodeSelected(prevSelected)
		}
	}

	setNewDrawNodeFunction(drawNodeFunction) {
		this.drawMethods.drawNode = drawNodeFunction
	}


	//actions that send data

	nodeSelected(selectedNode) {
		if (typeof (selectedNode) == "string") {
			selectedNode = this.net.get(selectedNode)
		}

		this._FORCES_ACTIVE = false
		if (this.pairSelected) {
			this.pairSelected = null
			this._resetThickFactor()
		}
		this.selectedNode = selectedNode
		switch (this.config.layout.selection_mode) {
			case 'center':
				//this.layouts.placeNodesInSpanningTree(selectedNode)
				this.layouts.gotoNode(selectedNode)
				//this.nodeUnSelected()

				break
			case 'spanning_tree':
				this.layouts.placeNodesInSpanningTree(selectedNode)
				break
			case 'impact_to':
			case 'impact_from':
				this.layouts.placeNodesInImpact(selectedNode)
				break
		}

		if (this.pairSelected) this.pairUnSelected()

		this.callBackSendData({ type: 'selected', value: selectedNode })
	}
	nodeUnSelected() {
		this._FORCES_ACTIVE = true
		this.forces.friction = this.config.physics.friction

		this.selectedNode = null
		this.callBackSendData({ type: 'unselected', value: "" })
		this._resetThickFactor()
	}
	nodeOver(overNode) {
		this.callBackSendData({ type: 'over', value: overNode })
	}

	nodeOut() {
		this.callBackSendData({ type: 'out', value: "" })
	}

	relationOver(overRelation) {
		this.callBackSendData({ type: 'over relation', value: overRelation })
	}

	relationOut() {
		this.callBackSendData({ type: 'out relation', value: "" })
	}

	relationSelected(selectedRelation) {
		this.callBackSendData({ type: 'selected relation', value: selectedRelation })
	}

	positionChanged(object) {
		this.callBackSendData({ type: 'position change', value: object })
	}

	nodesZoomChanged(zoom) {
		this.callBackSendData({ type: 'nodes zoom change', value: zoom })
	}

	selectPair(node0, node1, sendData = true) {
		let path = _.shortestPath(this.net, node0, node1, true)
		this.selectedNode = null

		this.pairSelected = {
			node0: node0,
			node1: node1,
			path,
			path_relations: _.getRelationsBetweenNodeLists(this.net, path, path, false) || []
		}

		this.net.relations.forEach(r => r._thickFactor = 0.3)

		let paths = _.shortestPaths(this.net, node0, node1) || []

		if (paths.length == 0) {
			this.pairSelected = null
			this._FORCES_ACTIVE = true
			this.forces.friction = this.config.physics.friction
			this._resetThickFactor()
			return
		}

		let paths_combined = new _.ndL()
		paths.forEach(nl => paths_combined = paths_combined.concat(nl))//.getWithoutRepetitions()

		//console.log("paths_combined:", paths_combined.map(n=>n.name).join(","))

		paths_combined = paths_combined.getWithoutRepetitions()

		//console.log("paths_combined:", paths_combined.map(n=>n.name).join(","))

		let relations = _.getRelationsBetweenNodeLists(this.net, paths_combined, paths_combined, false)

		//console.log("relations.length:", relations.length)
		//console.log("relations:", relations.map(n=>n.name).join(","))



		//relations.forEach(r=>r._thickFactor=2.5)

		this.pairSelected.path_relations.forEach(r => r._thickFactor = 3.2)

		this._FORCES_ACTIVE = false

		this.layouts.placeNodesInShortestPaths(node0, node1, paths)

		if (this.selectedNode) this.nodeUnSelected()

		if (sendData) this.callBackSendData({ type: 'selected pair', value: { node0, node1 } })
	}

	pairUnSelected() {
		this.pairSelected = null
		this._FORCES_ACTIVE = true
		this.forces.friction = this.config.physics.friction
		this._resetThickFactor()
		this.callBackSendData({ type: 'unselected pair', value: "" })
	}

	calculateLoops = function (net) {
		console.log(net)
		if (net.loops) console.log("this.config.layout.draw_loops", this.config.layout.draw_loops, net.loops)
		if (net.loops?.[this.config.layout.draw_loops]) return
		if (!net.loops) net.loops = []
		let loops = _.loops(net, this.config.layout.draw_loops)

		let loop_colors = _.createCategoricalColors(0, loops.length + 2, null, 0.1).slice(1)
		loops.forEach((loop, i) => loop.color = loop_colors[i])

		net.loops[this.config.layout.draw_loops] = loops
	}


	///////

	resize(k) {
	}
}
