let MAX_TOKENS = 8000

let sendQuestion = function (question) {
    console.log("Questions::sendQuestion:", question)

    const isXAxis = question.indexOf("x:") == 0
    const isYAxis = question.indexOf("y:") == 0
    const isColor = question.indexOf("color:") == 0
    const isBothAxis = question.indexOf("xy:") == 0
    const generative = question.indexOf("generate:") == 0
    const isTest = question == "test"

    let prompt
    if (isBothAxis) {
        const params = question.substring("xy:".length).trim().split("-").map(p => p.trim())
        axis("xy", ...params)
        return
    } else if (isXAxis) {
        const params = question.substring("x:".length).trim().split("-").map(p => p.trim())
        axis("x", ...params)
        return
    } else if (isYAxis) {
        const params = question.substring("y:".length).trim().split("-").map(p => p.trim())
        axis("y", ...params)
        return
    } else if (isColor) {
        const params = question.substring("color:".length).trim().split("-").map(p => p.trim())
        color(...params)
        return
    } else if (isTest) {
        loadExample("texts/telescope.txt")
        return
    } else if (generative) {
        prompt = question.substring("generate:".length).trim()
    } else {
        prompt = buildQuestionPrompt(question)
    }

    const promptObject = {
        prompt,
        model: "gpt-4.1-mini",
        onLoad: function (response) {
            console.log("Questions::sendQuestion::onLoaded:", response.content)

            waiting_answer = false
            if (window.updateSendButtonState) window.updateSendButtonState()
            if (generative) {
                contentIn(response.content)
            } else {
                showAnswer(processAnswer(response.content))
            }
        }
    }
    waiting_answer = true
    if (window.updateSendButtonState) window.updateSendButtonState()
    llmService.llm_completion(promptObject)
}

let buildQuestionPrompt = function (question) {
    const contextText = extractContext()
    const prompt = "These are some excerpts from a document (each with an index, like {13}):\n\n" + contextText + "\n\nAnd this is a question I have: " + question + ".\n\nAnswer the question based on the given context (and nothing else). Please use rich format, your answer will be an html (it will be placed over a dark background, but you leave the background as it is). Quote verbatim from original sources as much as possible, add the index (e.g. {7}) to each reference. Titles in white. Each quote should appear within the text in orange (orange only for verbatim quotes), and the end of it the index. Finally, end your answer with a summary table of ideas and their sources (using the described anchor format)."
    console.log(prompt)
    return prompt
}

let processAnswer = function (answer) {
    //clean
    const lines = answer.split("\n")
    answer = lines.filter(line => line[0] !== "`").join("\n")
    answer = answer.replaceAll("\n", "").replaceAll("\t", "").trim()

    //replace node referenes (e.g. {13}) with call to function overAnchor
    answer = answer.replace(/\{(\d+)\}/g, (match, p1) => {
        return `<span class="node-index-ref" 
                     onmouseover="overAnchor(${p1})" 
                     onmouseout="outAnchor(${p1})" 
                     style="cursor: pointer; 
                            background-color: #e06a6a; 
                            color: white; 
                            padding: 1px 6px; 
                            border-radius: 4px; 
                            font-size: 11px; 
                            font-weight: bold; 
                            margin: 0 2px; 
                            display: inline-block; 
                            line-height: 1.4;
                            vertical-align: middle;">${p1}</span>`
    })

    return answer
}

overAnchor = function (index) {
    const node = net.nodes[index]
    if (node) {
        node._originalColor = node.color
        node._originalWeight = node.weight
        node.color = "#ffff00" // Bright yellow highlight
        node.weight = (node._originalWeight || 1) * 3 // Make it stand out
        console.log("overAnchor:::", node)
    }
    netView.scope.view.receiveData({ value: node.id, type: "over" })
}

outAnchor = function (index) {
    const node = net.nodes[index]
    if (node) {
        node.color = node._originalColor || node.color
        node.weight = node._originalWeight || node.weight
    }
}



let extractContext = function () {
    let similarities = []
    net.nodes.forEach(node => {
        node.onContext = false
        similarities.push({
            similarity: node.similarity,
            node
        })
    })
    similarities.sort((a, b) => b.similarity - a.similarity)

    let average_chunk_size = CHUNKS.reduce((a, b) => a + b.text.split(" ").length, 0) / CHUNKS.length

    let max_tokens = MAX_TOKENS * (1 + average_chunk_size / 1000)
    console.log("MAX_TOKENS, average_chunk_size, max_tokens", MAX_TOKENS, average_chunk_size, max_tokens)

    let contextText = ""
    similarities.forEach(similarity => {
        if (contextText.split(" ").length * 4 / 3 > max_tokens) return
        contextText += similarity.node.description + "\n"
        similarity.node.onContext = true
    })

    contextText = ""

    net.nodes.forEach((node, index) => {
        if (node.onContext) {
            contextText += "{" + index + "} " + node.description + "\n______________________\n"
        } else {
            node.color = "white"
        }
    })

    console.log("Used " + net.nodes.filter(node => node.onContext).length + "/" + net.nodes.length + " nodes, # tokens: " + contextText.split(" ").length * 4 / 3)

    return contextText
}






///////////////////Alchemy Text

let schema_description = `{
    "index_chunk": "int",
    "index_document": "int",
    "title": "string",
    "text": "string (one or few paragraphs)",
    "key_words": "array (list of key words)",
    "embedding": "array (1539 integer values, range -100 to 100)"
}`

let sendQuestionAlchemy = function (question) {
    console.log("Questions::sendQuestion:", question)
    const prompt = ""
    const promptObject = {
        prompt,
        model: "gpt-4.1",
        onLoad: function (response) {
            console.log("Questions::sendQuestion::onLoaded:", response.content)

            waiting_answer = false
            //execute code
        }
    }
    waiting_answer = true
    if (window.updateSendButtonState) window.updateSendButtonState()
    llmService.llm_completion(promptObject)
}

