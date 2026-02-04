
let nSteps = 0
let index_document = 0

let chunksReady = function (chunks) {
    CHUNKS = CHUNKS.concat(chunks)

    if (!chunks || chunks.length === 0) {
        console.warn("chunksReady::: No chunks to process");
        return;
    }

    chunks.forEach(chunk => {
        chunk.index_document = index_document
        chunk.category_index_document = "doc_" + index_document
    })

    //when the mic is active the chunks are probably individual
    //and considered to be from the same document

    if (!isMicActive) {
        index_document++
    } else {
        if (CHUNKS.length > 1 && index_document == CHUNKS.at(-2).index_document) {
            CHUNKS.at(-1).index = CHUNKS.at(-2).index + 1
        }
    }




    //testing a new way of enriching chunks

    let time_interval_enriching = setInterval(() => {
        if (enricher.nStepsEnrich == 0) {
            clearInterval(time_interval_enriching)
            return
        }
        console.log("chunksReady::: Enriching chunks...")
        if (window.newMessageForUser) {
            newMessageForUser("enriching " + enricher.nStepsEnrich)
        }
    }, 200)

    enricher.enrichComplete(chunks, () => {
        console.log("chunksReady::: All chunks processed")
        buildNetwork(CHUNKS)
    })
    return
    // console.log("chunksReady:::", chunks)
    // console.log("average text length:", chunks.map(chunk => chunk.text.length).reduce((a, b) => a + b) / chunks.length)

    chunks.forEach(chunk => {

        const chunkWithSameText = CHUNKS.find(c => c.text === chunk.text)
        if (chunkWithSameText) {
            console.log("chunk with same text found, skipping")
            return
        }

        chunk.index_document = index_document

        const hash = _hashFromObject(chunk)

        nSteps++

        const obj = JSON.parse(localStorage.getItem(hash))

        if (obj) {
            console.log("chunk already processed, using cached data")
            console.log(obj)

            setTimeout(() => {
                endStep(chunk, obj.embedding.toL(), obj.title, chunks)
            }, Math.sqrt(chunks.length) * Math.random() * 100)
            return
        }


        llmService.embedding(chunk.text, function (response) {
            const embedding = response.embedding
            const promptObject = {
                prompt: "create a very short title for this text: " + chunk.text + ". \n\n return only the title, no explanation, headers, etc.",
                onLoad: function (response) {
                    const title = response.content.replaceAll("\n", "").replaceAll('"', "").replaceAll("'", "").trim()

                    endStep(chunk, embedding, title, chunks)

                    localStorage.setItem(hash, JSON.stringify({ embedding: chunk.embedding, title: chunk.title }))
                }
            }
            setTimeout(() => {
                llmService.llm_completion(promptObject)
            }, chunks.length * Math.random() * 100)
        })
    })
    console.log("nSteps total :::", nSteps)
    index_document++
}


let intervalBuildNetwork
let prevNChunks = 0

endStep = function (chunk, embedding, title) {
    CHUNKS.push(chunk)

    chunk.title = title
    chunk.embedding = embedding

    if (CHUNKS.length < 100) {
        buildNetwork(CHUNKS)
    } else {
        clearInterval(intervalBuildNetwork)
        if (prevNChunks != CHUNKS.length) {
            prevNChunks = CHUNKS.length
            console.log("… delay …")
            intervalBuildNetwork = setTimeout(() => {
                buildNetwork(CHUNKS)
            }, 300)
        }
    }

    // nSteps--
    // //console.log(nSteps)

    // if (nSteps === 0) {
    //     // console.log("All chunks processed")
    //     // console.log(chunks)
    //     // console.log(JSON.stringify(chunks))
    // }
}

cleanStorage = function () {
    for (let keyName in localStorage) {
        const obj = JSON.parse(localStorage.getItem(keyName))
        console.log(keyName, obj)
        if (obj && obj.title && obj.embedding) {
            localStorage.removeItem(keyName)
        }
    }
}