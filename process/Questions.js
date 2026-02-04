let timeOutEmbedding = null
let lastEmbedding = null

let waiting_answer = false

let prev_text = ""

let changedText = function (text) {
    text = text.trim()
    if (text == prev_text) return
    prev_text = text

    if (text == "") {
        assignBaseColors()
        return
    }
    if (timeOutEmbedding) clearTimeout(timeOutEmbedding)
    timeOutEmbedding = setTimeout(() => {
        llmService.embedding(text, function (response) {
            lastEmbedding = response.embedding
            showSimilarityOnNodes(lastEmbedding)
        })
    }, 200)
}

window.cancelChangedText = function () {
    if (timeOutEmbedding) {
        clearTimeout(timeOutEmbedding)
        timeOutEmbedding = null
    }
}


let showAnswer = function (answer) {
    let answerArea = document.getElementById('questions-answer-area')

    if (!answerArea) {
        answerArea = document.createElement('div')
        answerArea.id = 'questions-answer-area'

        // Styling for the answer area (premium look, glassmorphism)
        Object.assign(answerArea.style, {
            position: 'fixed',
            bottom: '85px', // Above the input container (20px bottom + 45px height + 20px gap)
            right: '20px',
            width: '445px',
            maxHeight: '60vh',
            backgroundColor: 'rgba(30, 30, 30, 0.9)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '15px',
            padding: '20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(15px)',
            zIndex: '1000',
            overflowY: 'auto',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '15px',
            lineHeight: '1.5',
            transition: 'all 0.3s ease',
            display: 'none'
        })

        // Close button for the answer area
        const closeBtn = document.createElement('button')
        closeBtn.innerHTML = '&times;'
        Object.assign(closeBtn.style, {
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'none',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '5px',
            lineHeight: '1'
        })
        closeBtn.onclick = () => {
            answerArea.style.display = 'none'
            assignBaseColors()
            if (window.netView && window.net) {
                netView.sendData({ value: net, type: "network" })
            }
        }
        answerArea.appendChild(closeBtn)

        // Content container (for the actual HTML)
        const content = document.createElement('div')
        content.id = 'questions-answer-content'
        answerArea.appendChild(content)

        document.body.appendChild(answerArea)
    }

    const content = document.getElementById('questions-answer-content')
    content.innerHTML = answer
    answerArea.style.display = 'block'
    answerArea.scrollTop = 0 // Reset scroll to top for new answers
}


const showSimilarityOnNodes = (embedding) => {
    let minSimilarity = Infinity
    let maxSimilarity = -Infinity
    net.nodes.forEach(node => {
        node.similarity = _.cosineSimilarity(embedding, node.embedding)
        if (node.similarity < minSimilarity) minSimilarity = node.similarity
        if (node.similarity > maxSimilarity) maxSimilarity = node.similarity
    })
    net.nodes.forEach(node => {
        node.similarityNormalized = (node.similarity - minSimilarity) / (maxSimilarity - minSimilarity)
        node.side_color = _.interpolateColors("rgb(255,255,255)", "rgba(224, 80, 80, 1)", Math.pow(node.similarityNormalized, 2))
        node.weight = 0.01 * node.nodes.length + node.similarityNormalized
    })
}
