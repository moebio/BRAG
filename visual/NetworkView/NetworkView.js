let netView

window.FONT_FAMILY = 'Google Sans'
window.FONT_URL = 'https://fonts.googleapis.com/css?family=Google+Sans:400,500,700'

window.getFontStack = function () {
    return ` '${window.FONT_FAMILY}', sans-serif`;
}

const netView_config = {
    nodes: {
        size_property: "weight",
        maxSize: 1.3,
        minSize: 1,
        tooltip: true,
        tooltip_property: 'description',
        tooltip_width: 500,
        download_images_automatically: true,
        draw_mode: "image"
    },
    relations: {
        //draw:'node_over',//node_over,always
        // show_mode:'over',//all,over,close_all,close_few
        // show_mode_on_layout:'context',//all,
        // selectRelations:true,
        // curvature: 0.02,//inactive if 0
        // arrow_size: 1.2,//inactive if 0
        color: "white",
        size_property: "weight",
        // tooltip: true,
        // tooltip_property: 'description',
        max_thick: 8
    },

    view: {
        background: 'rgba(140, 138, 138, 1)',
        nodes_zoom_max: 4,
        nodes_zoom_min: 0.1,
        zoom_min: 0.04,
        zoom_max: 20,
    },

    physics: {
        friction: 0.99,
        frictionDecay: 0.997,
        minFriction: 0.4,
        k: 0.05,
        attractionToCenter: true,
        attractionToCenterFactor: 0.00001
    },
}

let loadsNetworkView = function () {
    loadTile(
        URL_VIEW_BASE + "Net",
        vw => {
            netView = vw
            netView.sendData({ value: netView_config, type: "configuration" })

            k = netView.scope.view.k
            netView.scope.view.drawMethods.drawBackground = function () { networkViewDrawBackground(k, netView.scope.view) }
            netView.scope.view.drawMethods.drawTop = function () { networkViewDrawTop(k, netView.scope.view) }

            netView.scope.view.drawMethods._drawNode = netView.scope.view.drawMethods.drawNode
            netView.scope.view.drawMethods.drawNode = drawNode

            // Apply drag and drop listeners to the iframe
            if (netView.iframe && netView.iframe.contentWindow) {
                applyDragAndDrop(netView.iframe.contentWindow)
            } else {
                // Fallback if iframe is not immediately ready
                netView.iframe.addEventListener("load", () => {
                    applyDragAndDrop(netView.iframe.contentWindow)
                })
            }

            net = new _.Net()
            //netView.sendData({ value: net, type: "network" })

            if (text_test) loadExample()

            // Check for URL query parameter after UI is ready
            if (window.checkParameters) {
                window.checkParameters();
            }

            let link = netView.iframe.contentDocument.createElement("link")
            link.href = window.FONT_URL
            link.rel = "stylesheet"
            netView.iframe.contentDocument.head.appendChild(link)
            document.fonts.load(`16px '${window.FONT_FAMILY}'`)

            console.log("NetworkView loaded")

            setInterval(() => {
                net.nodes.forEach(nd => {
                    if (isNaN(nd.x)) nd.x = 100 * Math.random() - 50
                    if (isNaN(nd.y)) nd.y = 100 * Math.random() - 50

                    if (isNaN(nd.vx)) nd.vx = 0
                    if (isNaN(nd.vy)) nd.vy = 0

                    if (isNaN(nd.ax)) nd.ax = 0
                    if (isNaN(nd.ay)) nd.ay = 0

                    nd.vx = Math.min(nd.vx, 0.005)
                    nd.vx = Math.max(nd.vx, -0.005)
                    nd.ax = Math.min(nd.vx, 0.001)
                    nd.ax = Math.max(nd.vx, -0.001)
                })
            }, 100)
        },
        receiveDataFromNetView,
        "net",
    )
}


let drawNode = function (node, ...args) {
    if (node.isTag) {
        k.fill("white")
        k.setText("rgba(255,255,255,0.6)", node._ts, null, "center", "middle")
        k.context.font = node._ts + "px" + window.getFontStack()
        k.fText(node.name, node._px, node._py)
        return
    }



    k.setText(netView.scope.view.config.nodes.box_color, node._ts, null, "center", "middle")
    //k.context.font = node._ts + "px " + netView.scope.view.config.nodes.font
    k.context.font = node._ts + "px" + window.getFontStack()

    const lines = k.nLinesTextWidth(node.name, node._w * 0.96, true).map(line => line.trim()).filter(line => line.length > 0)

    node._h = node._ts * lines.length * 1.2

    const x = node._px - node._w * 0.5
    const y = node._py - node._h * 0.5

    k.fill(_.addAlpha(node.color, 0.9))
    k.fRect(x, y, node._w, node._h)


    if (node.side_color && node.side_color != node.color) {
        k.fill(node.side_color)
        k.fRect(x - 4, y, 6, node._h)
    }

    k.fill("black")
    lines.forEach((line, index) => {
        k.fText(line, node._px, node._py - lines.length * node._ts * 0.5 + (index + 0.5) * node._ts)
    })

    //k.fTextWidth(node.name, node._px, node._py + node._dyText * node._ts, node._w, node._ts)



    //netView.scope.view.drawMethods._drawNode(node, ...args)
}

let axis = function (axis, criteria0, criteria1) {
    console.log("axis:::", axis, criteria0, criteria1)
    if (!criteria0) {
        if (axis == "xy") {
            netView.sendData({ value: "free", type: "x" })
            netView.sendData({ value: "free", type: "y" })
        } else {
            netView.sendData({ value: "free", type: axis })
        }
        calculateCorrelation()
        return
    }
    netView.scope.view.scaleX = 4

    if (criteria0 && criteria1) {
        llmService.embedding(criteria0, ob => {
            const embedding0 = ob.embedding
            llmService.embedding(criteria1, ob => {
                const embedding1 = ob.embedding

                net.nodes.forEach((node, index) => {

                    node.similarity0 = _.cosineSimilarity(embedding0, node.embedding)
                    node.similarity1 = _.cosineSimilarity(embedding1, node.embedding)
                    node[axis + "_axis"] = (node.similarity0 - node.similarity1)

                    netView.sendData({ value: axis + "_axis", type: axis })
                    calculateCorrelation()
                })
            })
        })
        return
    } else if (criteria0 == "index") {
        net.nodes.forEach(node => {
            node[axis + "_axis"] = node.chunk.index / net.nodes.length
        })
        netView.sendData({ value: axis + "_axis", type: axis })
        calculateCorrelation()
        return
    } else if (criteria0) {
        llmService.embedding(criteria0, ob => {
            const embedding0 = ob.embedding
            net.nodes.forEach((node, index) => {
                node.similarity0 = _.cosineSimilarity(embedding0, node.embedding)
                node[axis + "_axis"] = node.similarity0
                netView.sendData({ value: axis + "_axis", type: axis })
                calculateCorrelation()
            })
        })
        return
    }
}

let color = function (criteria) {
    console.log("color:::", criteria)

    if (criteria == "index") {
        net.nodes.forEach((node, index) => {
            node.color = _.interpolateColors("rgb(255,255,255)", _.temperature(index / net.nodes.length), 0.2)
        })
        return
    } else if (criteria) {
        console.log("criteria:::[" + criteria + "]")
        console.log("net.nodes[0].chunk.criteria:::[" + net.nodes[0].chunk.criteria + "]")
        if (net.nodes[0].chunk[criteria] != undefined) {
            const freqTable = net.nodes.map(node => node.chunk[criteria]).toL().getFrequenciesTable(true, false, true)
            const colorsDictionary = {}
            freqTable[0].forEach((value, index) => {
                colorsDictionary[value] = freqTable[2][index]
            })
            net.nodes.forEach((node, index) => {
                node.color = _.interpolateColors("rgb(255,255,255)", colorsDictionary[node.chunk[criteria]], 0.3)
            })
        } else {
            llmService.embedding(criteria, ob => {
                const embedding0 = ob.embedding
                net.nodes.forEach((node, index) => {
                    node.similarity0 = _.cosineSimilarity(embedding0, node.embedding)
                    node.color = _.interpolateColors("rgb(255,255,255)", _.temperature(node.similarity0), 0.1)
                })
            })
        }
    }
}


let calculateCorrelation = function () {
    console.log(net.nodes[0].x_axis, net.nodes[0].y_axis)

    if (net.nodes[0].x_axis != undefined && net.nodes[0].y_axis != undefined) {
        const x_values = new _.nL()
        const y_values = new _.nL()
        net.nodes.forEach((node, index) => {
            x_values.push(node.x_axis)
            y_values.push(node.y_axis)
        })
        const correlation = _.numericCorrelation(x_values, y_values)
        message_for_user = "ρ: " + correlation.toFixed(2)
    }
}

let receiveDataFromNetView = function (data) {
    //console.log("receiveDataFromNetView:::", data)
}


let networkViewDrawBackground = function (k, view) {
    drawLinearOnNetworkBottom(k, view)
}


let networkViewDrawTop = function (k, view) {
    k.setText("rgba(255,255,255,0.4)", 13, null, "left", "top")
    k.fText("drag and zoom", 42, 11)
    k.fText("nodes: SHIFT+zoom", 42, 24)

    drawLinearOnNetworkTop(k, view)

    //console.log(view.overNode, k.BACKSPACE_PRESSED)

    if (view.overNode && k.BACKSPACE_PRESSED) {
        console.log("1 BACKSPACE_PRESSED", CHUNKS.length)
        CHUNKS = CHUNKS.filter(chunk => chunk.text != view.overNode.chunk.text)
        console.log("2 BACKSPACE_PRESSED", CHUNKS.length)
        buildNetwork(CHUNKS)
    }
}

let drawLinearOnNetworkBottom = function (k, view) {
    const chunk_nodes = net.nodes.filter(node => !node.isTag)
    let x = 315
    let W = getQuestionsX() - x - 8
    let y = k.H - 62
    let h = 40

    let sumWeights = 0
    chunk_nodes.forEach(node => {
        node.similarityWWeight = Math.pow(node.similarityNormalized || (1 / net.nodes.length), 2)
        sumWeights += node.similarityWWeight
        node.wFollow = node.wFollow || W / net.nodes.length

        node.color = node.color || "rgb(255,255,255)"
        node.colorFollow = node.colorFollow || node.color
        if (!node.colorFollowRGB) node.colorFollowRGB = _.colorStringToRGB(node.colorFollow)
        node.colorRGB = _.colorStringToRGB(node.color)

        node.sideColorFollow = node.side_color || node.color
        node.sideColorRGB = _.colorStringToRGB(node.side_color || "rgb(255,255,255)")
        node.sideColorFollowRGB = _.colorStringToRGB(node.sideColorFollow)

    })

    chunk_nodes.forEach(node => {
        w = W * node.similarityWWeightNormalizedToSum
        node.wFollow = node.wFollow * 0.95 + w * 0.05
        node.similarityWWeightNormalizedToSum = node.similarityWWeight / sumWeights
        node.colorFollowRGB[0] = node.colorFollowRGB[0] * 0.95 + node.colorRGB[0] * 0.05
        node.colorFollowRGB[1] = node.colorFollowRGB[1] * 0.95 + node.colorRGB[1] * 0.05
        node.colorFollowRGB[2] = node.colorFollowRGB[2] * 0.95 + node.colorRGB[2] * 0.05
        node.colorFollow = "rgb(" + Math.floor(node.colorFollowRGB[0]) + "," + Math.floor(node.colorFollowRGB[1]) + "," + Math.floor(node.colorFollowRGB[2]) + ")"
        node.sideColorFollowRGB[0] = node.sideColorFollowRGB[0] * 0.95 + node.sideColorRGB[0] * 0.05
        node.sideColorFollowRGB[1] = node.sideColorFollowRGB[1] * 0.95 + node.sideColorRGB[1] * 0.05
        node.sideColorFollowRGB[2] = node.sideColorFollowRGB[2] * 0.95 + node.sideColorRGB[2] * 0.05
        node.sideColorFollow = "rgb(" + Math.floor(node.sideColorFollowRGB[0]) + "," + Math.floor(node.sideColorFollowRGB[1]) + "," + Math.floor(node.sideColorFollowRGB[2]) + ")"
        node.xLinear = x
        const over = k.mX >= node.xLinear && k.mX <= node.xLinear + node.wFollow && k.mY >= y && k.mY <= y + h
        if (over) {
            k.pointer()
            view.receiveData({ value: node.id, type: "over" })
        }
        x += node.wFollow
    })

}

let drawLinearOnNetworkTop = function (k, view) {
    const chunk_nodes = net.nodes.filter(node => !node.isTag)
    let y = k.H - 62
    let h = 40

    k.stroke("rgba(0,0,0,0.2)", 0.5)
    chunk_nodes.forEach(node => {
        k.fill(node.colorFollow)
        const over = k.fsRectM(node.xLinear, y, node.wFollow, h)
        if (over) {
            k.pointer()
            console.log("over:::", node.name)
            view.receiveData({ value: node.id, type: "over" })
        }

        k.fill(node.sideColorFollow)
        k.fRect(node.xLinear, y + h, node.wFollow, 4)
    })

    if (view.overNode) {
        k.stroke("black", 1)
        k.sRect(view.overNode.xLinear - 1, y - 1, view.overNode.wFollow + 2, h + 2)
    }
}
