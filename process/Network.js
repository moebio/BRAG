//const SIMILARITY_THRESHOLD = 0.55
const N_CONNECTIONS_PER_NODE = 2.1

// Global variable to track whether tags should be shown in the network
window.SHOW_TAGS = true

let lastNetworkBuildTime = Date.now()
let build_network_timer = null

let buildNetwork = function (chunks, n_connections_per_node = N_CONNECTIONS_PER_NODE, sendToView = true, withTags = window.SHOW_TAGS) {
    if (window.newMessageForUser) {
        newMessageForUser("building network…")
    }

    const elapsed_time = Date.now() - lastNetworkBuildTime
    //console.log("buildNetwork::: elapsed time", elapsed_time)

    if (elapsed_time < 480) {
        //console.log("buildNetwork::: hold…")
        clearTimeout(build_network_timer)
        build_network_timer = setTimeout(() => {
            buildNetwork(chunks, n_connections_per_node)
        }, 400)
        return
    }

    console.log("buildNetwork::: go ", chunks.length)

    lastNetworkBuildTime = Date.now()

    // Show/hide download button
    const downloadBtn = document.getElementById('brag-download-btn')
    const messageDisplay = document.getElementById('brag-message-display')
    if (downloadBtn) {
        const active = (chunks && chunks.length > 0)
        downloadBtn.style.display = active ? 'flex' : 'none'
        if (messageDisplay) {
            if (active) messageDisplay.classList.add('with-download')
            else messageDisplay.classList.remove('with-download')
        }
    }

    net = new _.Net()

    chunks.forEach(chunk => {
        if (!chunk.title || !chunk.embedding) return
        addNode(chunk, net)
    })

    const potential_connections = []

    net.nodes.forEach(node => {
        if (!node.embedding.getNorm) node.embedding = node.embedding.toL()
    })

    net.nodes.forEachPair((node1, node2) => {
        const similarity = _.cosineSimilarity(node1.embedding, node2.embedding)
        potential_connections.push({ node1, node2, similarity })
    })

    potential_connections.sort((a, b) => b.similarity - a.similarity)

    const n_connections = n_connections_per_node * net.nodes.length

    const selected = potential_connections.slice(0, n_connections)
    let min_similarity = Infinity
    selected.forEach(connection => {
        if (connection.similarity < min_similarity) min_similarity = connection.similarity
    })
    selected.forEach((connection, index) => {
        const relation = net.createRelation(connection.node1, connection.node2)
        relation.weight = 10 * ((connection.similarity - min_similarity) + 0.01)
    })


    ////////tags

    if (withTags) {
        net.nodes.forEach(node => {
            node.tags = node.chunk.tags//keywords//tags
            node.tags.forEach(tag_name => {
                tag_name = tag_name.toUpperCase()
                let tagNode = net.nodes.get(tag_name)
                if (!tagNode) {
                    tagNode = net.createNode(tag_name, tag_name)
                    tagNode.color = "rgba(255,220,220,0.2)"
                    tagNode.isTag = true
                }
                const relation = net.createRelation(node, tagNode)
                relation.weight = 0.5
                relation.color = "rgba(255,200,200,0)"
            })
        })

        net.nodes.filter(n => n.isTag).forEach(tagNode => {
            if (!tagNode.chunk) tagNode.chunk = {
                index: 0
            }
            tagNode.chunk.embedding = new Array(1536).fill(0).tonL()
            tagNode.nodes.forEach(node => {
                node.chunk.embedding.forEach((v, i) => {
                    tagNode.chunk.embedding[i] += v / tagNode.nodes.length
                })
                tagNode.chunk.index += node.chunk.index / tagNode.nodes.length
            })
            tagNode.embedding = tagNode.chunk.embedding
        })

        net.nodes.filter(n => n.isTag).forEach(tagNode => {
            if (tagNode.nodes.length < 2) {
                net.removeNode(tagNode)
            }
        })
    }

    //connect loose nodes
    net.nodes.filter(n => !n.isTag).forEach(node => {
        if (node.nodes.length == 0) {
            let mostSimilarNode = null
            let mostSimilarity = -Infinity
            net.nodes.filter(n => !n.isTag).forEach(otherNode => {
                if (node == otherNode) return
                const similarity = _.cosineSimilarity(node.embedding, otherNode.embedding)
                if (similarity < min_similarity) min_similarity = similarity
                if (similarity > mostSimilarity) {
                    mostSimilarNode = otherNode
                    mostSimilarity = similarity
                }
            })
            if (mostSimilarNode) {
                const relation = net.createRelation(node, mostSimilarNode)
                relation.weight = 10 * 0.01
            }
        }
        node.weight = 1//node.nodes.length
    })

    assignBaseColors()


    if (netView && net.nodes.length > 1 && sendToView) {
        netView_config.physics.friction = 0.95// 0.9 - Math.min(50 / net.nodes.length, 0.1)
        netView_config.physics.frictionDecay = 0.98// - Math.min(5 / net.nodes.length, 0.01)
        netView_config.physics.minFriction = 0.3// + Math.min(0.1 * net.nodes.length / 200, 0.3)

        console.log(netView_config.physics.friction, netView_config.physics.friction, netView_config.physics.minFriction)

        netView.sendData({ value: netView_config, type: "configuration" })
        netView.sendData({ value: net, type: "network" })
    }

    newMessageForUser("")

    return net
}

let addNode = function (chunk, net) {
    const name = chunk.title
    const node = net.createNode(name + "_" + chunk.index, name)

    node.chunk = chunk

    node.embedding = chunk.embedding

    node.x = Math.random() * 500
    node.y = Math.random() * 500

    node.description = chunk.summary || chunk.text
    node.text = chunk.text
    node.weight = 1

    if (chunk.urlImage) {
        node.urlImage = chunk.urlImage
    }

    if (CHUNKS.length == net.nodes.length) message_for_user = ""
}


let assignBaseColors = function () {
    if (index_document > 1) {
        // net.nodes.forEach(node => {
        //     //node.color = "hsl(" + (node.chunk.index_document * 360 / index_document) + ", 50%, 90%)"
        //     node.color = _.interpolateColors("rgb(255,255,255)", _.temperature(node.chunk.index_document / index_document), 0.3)
        // })

        assignColorByIndex()
    } else {
        net.nodes.forEach(node => {
            node.color = "rgb(255,255,255)"
        })
    }
}

let assignColorByIndex = function () {
    net.nodes.forEach(node => {
        node.color = _.interpolateColors("rgb(255,255,255)", _.temperature(node.chunk.index_document / index_document), 0.1)
    })
}


let setNetworkWords = function (withTags) {
    console.log("setNetworkWords::: withTags", withTags)
    window.SHOW_TAGS = withTags
    buildNetwork(CHUNKS, N_CONNECTIONS_PER_NODE, true, withTags)
}