// Text chunking functions

const SPLITTERS = [
    ".\n\n\n",
    ".\n\n",
    "?\n\n",
    "!\n\n",
    ".\r\n",
    "\n\n",
    ".\n",
    "?\n",
    "!\n",
    ".\r",
    ".\t",
    "?\t",
    "!\t",
    ". ",
    "? ",
    "! ",
    ".",
    "?",
    "!"
]

let N_EXPECTED_WORDS_PER_CHUNK_MIN = 200
let N_EXPECTED_WORDS_PER_CHUNK_MAX = 360
const n_expected_chunks_per_five_pages_text = 150


let chunkSizes = function (words_length) {
    const factor = 9 * Math.pow(words_length / N_EXPECTED_WORDS_PER_CHUNK_MIN, 0.5) / n_expected_chunks_per_five_pages_text
    console.log("factor:::", factor)
    const adjustedMin = Math.max(N_EXPECTED_WORDS_PER_CHUNK_MIN * factor, N_EXPECTED_WORDS_PER_CHUNK_MIN * 0.5)
    const adjustedMax = Math.max(N_EXPECTED_WORDS_PER_CHUNK_MAX * factor, N_EXPECTED_WORDS_PER_CHUNK_MAX * 0.5)

    return { adjustedMin, adjustedMax }
}


let chunkenizeText = function (text) {

    //short case


    let words_length = text.split(" ").length
    console.log("words_length:::", words_length)

    //short case
    if (words_length < 1500 && text.split(".").length < 150 && text.split(".").length > 2) {
        let texts = text.split(".")
        let result = []
        texts.forEach(text => {
            const cleanText = _cleanAndSimplfiyChunk(text)
            if (!cleanText) return
            result.push({
                text: cleanText,
                type: "chunk",
                index: result.length,
                words_length: cleanText.split(" ").length
            })
        })
        console.log("short case result:::", result)
        return _processTimeStamps(result)
    }


    let { adjustedMin, adjustedMax } = chunkSizes(words_length)


    // console.log("adjustedMin:::", adjustedMin)
    // console.log("adjustedMax:::", adjustedMax)

    if (!text || text.trim().length === 0) {
        return []
    }

    let initialChunks = splitChunkRecursively(text.trim(), 0, adjustedMin, adjustedMax)
    let finalChunks = mergeSmallChunks(initialChunks, adjustedMin, adjustedMax)

    // Remove splitter from the absolute last chunk only
    if (finalChunks.length > 0) {
        let lastChunk = finalChunks[finalChunks.length - 1]
        let sortedSplitters = [...SPLITTERS].sort((a, b) => b.length - a.length)
        for (let i = 0; i < sortedSplitters.length; i++) {
            let splitter = sortedSplitters[i]
            if (lastChunk.endsWith(splitter)) {
                finalChunks[finalChunks.length - 1] = lastChunk.slice(0, -splitter.length)
                break
            }
        }
        if (lastChunk.endsWith(" ") && !lastChunk.endsWith("  ")) {
            finalChunks[finalChunks.length - 1] = lastChunk.slice(0, -1)
        }
    }

    let formattedChunks = []
    finalChunks.forEach((chunkText, index) => {
        const text = _cleanAndSimplfiyChunk(chunkText)
        if (!text) return
        formattedChunks.push({
            text: text,
            type: "chunk",
            index: index,
            words_length: text.split(" ").length
        })
    })


    formattedChunks = _processTimeStamps(formattedChunks)

    console.log("formattedChunks:::", formattedChunks)

    return formattedChunks
}

//check for Youtube case, where texts might have timestamps inclusions
//such as:
//  2:30
//  organism lives or dies in vain. The ones
//  2:33
//  that live survive to tell another day.
//  2:37
//  Well, if you survive space, that's not
//  Surviving on the ISS
//  2:41
//  just, oh, we have a drought this summer
//
//the steps are:
//remove all these timestamps, replace each \nMM:SS\n (or variations) by a space 
//add params to chunk: minTimeStamp, maxTimeStamp
let _processTimeStamps = function (chunks) {
    chunks.forEach((chunk, index) => {
        const text = chunk.text
        // More flexible regex for timestamps: M:SS, MM:SS, H:MM:SS, HH:MM:SS
        const regex = /\b\d{1,2}(?::\d{2}){1,2}\b/g
        const timeStamps = text.match(regex)
        if (timeStamps && timeStamps.length > 0) {
            chunk.minTimeStamp = timeStamps[0]
            chunk.maxTimeStamp = timeStamps[timeStamps.length - 1]
            // Replace timestamps with space and then clean up whitespace
            chunk.text = text.replace(regex, " ").replace(/\s\s+/g, ' ').trim()
        }
    })
    return chunks
}

let _cleanAndSimplfiyChunk = function (text) {
    // Use a more robust regex to collapse 3+ line breaks (even with spaces in between) to exactly 2
    let simplified = text.replace(/(\s*\n){3,}/g, "\n\n")
    // Replace multiple horizontal spaces/tabs with a single space
    simplified = simplified.replace(/[ \t]+/g, " ")
    return simplified.trim()
}

function countWords(text) {
    if (!text || text.trim().length === 0) return 0
    return text.trim().split(/\s+/).filter(word => word.length > 0).length
}

function forceSplitByWordCount(chunk, adjustedMax) {
    let words = chunk.trim().split(/\s+/).filter(word => word.length > 0)
    let result = []
    let currentChunk = []
    let currentWordCount = 0

    words.forEach(word => {
        currentChunk.push(word)
        currentWordCount++

        if (currentWordCount >= adjustedMax) {
            result.push(currentChunk.join(" ") + " ")
            currentChunk = []
            currentWordCount = 0
        }
    })

    if (currentChunk.length > 0) {
        result.push(currentChunk.join(" ") + " ")
    }

    return result
}

function splitChunkRecursively(chunk, splitterIndex, adjustedMin, adjustedMax) {
    let wordCount = countWords(chunk)

    if (wordCount >= adjustedMin && wordCount <= adjustedMax) {
        return [chunk]
    }

    if (wordCount < adjustedMin) {
        return [chunk]
    }

    if (splitterIndex >= SPLITTERS.length) {
        return forceSplitByWordCount(chunk, adjustedMax)
    }

    let splitter = SPLITTERS[splitterIndex]
    let parts = chunk.split(splitter)

    let subChunks = []
    for (let i = 0; i < parts.length; i++) {
        let part = parts[i].trim()
        if (part.length > 0) {
            subChunks.push(part + splitter)
        } else if (i < parts.length - 1) {
            subChunks.push(splitter)
        }
    }

    subChunks = subChunks.filter(c => c.trim().length > 0)

    if (subChunks.length <= 1) {
        return splitChunkRecursively(chunk, splitterIndex + 1, adjustedMin, adjustedMax)
    }

    let result = []
    subChunks.forEach(subChunk => {
        let splitResult = splitChunkRecursively(subChunk, splitterIndex + 1, adjustedMin, adjustedMax)
        result = result.concat(splitResult)
    })

    return result.filter(c => c.trim().length > 0)
}

function mergeSmallChunks(chunks, adjustedMin, adjustedMax) {
    if (chunks.length === 0) return chunks

    let merged = []
    let i = 0

    while (i < chunks.length) {
        let currentChunk = chunks[i]
        let wordCount = countWords(currentChunk)

        if (wordCount < adjustedMin) {
            let accumulatedChunk = currentChunk
            let accumulatedWordCount = wordCount
            let j = i + 1

            while (j < chunks.length && accumulatedWordCount < adjustedMin) {
                let nextChunk = chunks[j]
                let separator = (accumulatedChunk.match(/\s+$/) || accumulatedChunk.length === 0) ? "" : " "
                let potentialMerged = accumulatedChunk + separator + nextChunk
                let potentialWordCount = countWords(potentialMerged)

                if (potentialWordCount > adjustedMax) {
                    break
                }

                accumulatedChunk = potentialMerged
                accumulatedWordCount = potentialWordCount
                j++
            }

            if (accumulatedWordCount < adjustedMin && merged.length > 0) {
                let lastMerged = merged[merged.length - 1]
                let separator = (lastMerged.match(/\s+$/) || lastMerged.length === 0) ? "" : " "
                let backwardMerged = lastMerged + separator + accumulatedChunk
                let backwardWordCount = countWords(backwardMerged)

                if (backwardWordCount <= adjustedMax) {
                    merged[merged.length - 1] = backwardMerged
                    i = j
                    continue
                }
            }

            merged.push(accumulatedChunk)
            i = j
            continue
        }

        merged.push(currentChunk)
        i++
    }

    return merged
}

