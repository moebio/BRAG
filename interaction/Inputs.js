const OVERLOOK_EMBEDDINGS = false //set true on the console when loading jsons with non compatible embeddings

let last_content



// Drag and Drop implementation
const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
}

const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer.files

    console.log("handleDrop:::", e)
    console.log("files:::", files)

    if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            console.log("file:::", file)
            console.log("file.type:::", file.type)
            console.log("file.name:::", file.name)
            if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
                const reader = new FileReader()
                reader.onload = (event) => {
                    const content = event.target.result
                    contentIn(content)
                }
                reader.readAsText(file)
            } else if (file.name.endsWith(".docx")) {
                const reader = new FileReader()
                reader.onload = (event) => {
                    const arrayBuffer = event.target.result
                    mammoth.extractRawText({ arrayBuffer: arrayBuffer })
                        .then((result) => {
                            contentIn(result.value)
                        })
                        .catch((err) => {
                            console.error("Mammoth error:", err)
                        })
                }
                reader.readAsArrayBuffer(file)
            } else if (file.name.endsWith(".pdf")) {
                const reader = new FileReader()
                reader.onload = async (event) => {
                    const typedarray = new Uint8Array(event.target.result)
                    try {
                        const loadingTask = pdfjsLib.getDocument(typedarray)
                        const pdf = await loadingTask.promise
                        let fullText = ""
                        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                            const page = await pdf.getPage(pageNum)
                            const textContent = await page.getTextContent()
                            const pageText = textContent.items.map(item => item.str).join(" ")
                            fullText += pageText + "\n"
                        }
                        contentIn(fullText)
                    } catch (error) {
                        console.error("PDF.js error:", error)
                    }
                }
                reader.readAsArrayBuffer(file)
            } else {
                console.log("not text")
                const reader = new FileReader()
                reader.onload = (event) => {
                    console.log("loaded:::", event)
                    const content = event.target.result
                    inputJSON(content)
                }
                reader.readAsText(file)
            }
        }
    }
}

let inputed_json
inputJSON = function (json_or_txt) {
    let chunks = null

    if (typeof json_or_txt === "string") {
        try {
            chunks = JSON.parse(json_or_txt)

        } catch (e) {
            console.log("Invalid JSON content")
        }
    } else {
        chunks = json_or_txt
    }

    inputed_json = chunks

    if (chunks[0]) chunks[0].text = chunks[0].text || chunks[0].description || chunks[0].content || chunks[0].collection_description

    if (chunks && Array.isArray(chunks) && chunks.length > 0 && chunks[0].text) {
        console.log("chunks:::", chunks)

        //let index_document_for_these_chunks = index_document

        chunks.forEach(chunk => {

            if (!chunk.embedding && chunk.embedding_compressed) {
                chunk.embedding = llmService.decodeEmbeddingBase64ToInt8(chunk.embedding_compressed)
            }

            chunk.text = chunk.text || chunk.description || chunk.content || chunk.collection_description

            //chunk.embedding = chunk.embedding ? chunk.embedding.toL() : new Array(1536).fill(0)
            if (!chunk.text) return
            chunk.index_document = index_document
            chunk.title = chunk.title || chunk.name || chunk.label || chunk.artist_name

            if (chunk.tags) {
                chunk.tags = chunk.tags.map(tag => tag.toLowerCase()).toL().getWithoutRepetitions()
                chunk.tags = chunk.tags.filter(tag => tag.length > 2 && tag != "n/a" && tag != "nan" && tag != "null" && tag != "undefined")
            }


            chunk.urlImage = chunk.urlImage || chunk.image || chunk.url_image || chunk.image_url || chunk.imageUrl || chunk.collection_image

            //console.log("chunk:::", chunk)
            if (!chunk.title) {
                chunk.title = chunk.text.split(" ").slice(0, 4).join(" ") + "…"
            }

            console.log("chunk.embedding:::", chunk.embedding)

            if (!chunk.embedding && !OVERLOOK_EMBEDDINGS) {
                // console.log("adding embedding")
                // addEmbedding(chunk, function () {
                //     //chunk.index_document = index_document_for_these_chunks
                //     // CHUNKS.push(chunk)
                //     // buildNetwork(CHUNKS)
                //     endStep(chunk, chunk.embedding, chunk.title)
                // })
            } else {
                CHUNKS.push(chunk)
            }
        })


        if (CHUNKS.length == 0) {
            CHUNKS = chunks
        }

        console.log("enrichComplete-->, CHUNKS:::", CHUNKS)

        enricher.enrichComplete(CHUNKS, function () {
            buildNetwork(CHUNKS)
            index_document++
        })

    } else {
        //searches an array of objects in the object
        console.log("searching for chunks in:::", chunks)
        for (let key in chunks) {
            console.log("key:::", key)
            console.log("chunks[key]:::", chunks[key])
            console.log("Array.isArray(chunks[key]):::", Array.isArray(chunks[key]))
            if (Array.isArray(chunks[key])) {
                if (chunks[key][0].text) {
                    console.log("found chunks in:::", chunks[key])
                    inputJSON(chunks[key])
                }
            }
        }
    }
}


window.processUrl = async (url) => {
    if (window.newMessageForUser) {
        newMessageForUser("loading page")
    } else {
        message_for_user = "loading page"
    }
    console.log("BRAG::processUrl::start::", url);
    const proxies = [
        null, // Direct fetch
        "https://api.allorigins.win/raw?url=",
        "https://api.codetabs.com/v1/proxy?quest=",
        "https://corsproxy.io/?"
    ];

    let success = false;
    let html = "";

    for (const proxy of proxies) {
        if (success) break;

        const fetchUrl = proxy ? `${proxy}${encodeURIComponent(url)}` : url;
        console.log(`BRAG::processUrl::trying ${proxy ? 'proxy: ' + proxy : 'direct fetch'}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

            const response = await fetch(fetchUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                html = await response.text();
                if (html && html.length > 200) { // Simple sanity check for content length
                    success = true;
                    console.log(`BRAG::processUrl::success with ${proxy ? 'proxy' : 'direct'}`);
                }
            } else {
                console.warn(`BRAG::processUrl::${proxy ? 'proxy' : 'direct'} failed with status: ${response.status}`);
            }
        } catch (e) {
            console.warn(`BRAG::processUrl::${proxy ? 'proxy' : 'direct'} error:`, e.message);
        }
    }

    if (success) {
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            doc.querySelectorAll('script, style, nav, footer, header, iframe').forEach(el => el.remove());
            const text = doc.body.innerText.trim();
            console.log("BRAG::processUrl::text extracted, length:", text.length);

            if (text.length > 0) {
                contentIn(text);
            } else {
                console.warn("BRAG::processUrl::extracted text is empty, falling back to URL string");
                contentIn(url);
            }
        } catch (err) {
            console.error("BRAG::processUrl::extraction error::", err);
            contentIn(url);
        }
    } else {
        console.error("BRAG::processUrl::all fetch attempts failed");
        contentIn(url);
    }
}


const handlePaste = async (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Prevent default to ensure we handle the data
    e.preventDefault();

    // Get text from clipboard
    const content = (e.clipboardData || window.clipboardData).getData('text');

    if (content) {
        console.log("pasted content length:", content.length);
        const urlRegex = /^(http|https):\/\/[^ "]+$/;

        if (urlRegex.test(content.trim())) {
            processUrl(content.trim())
        } else {
            contentIn(content);
        }
    }
}

const applyDragAndDrop = (win) => {
    win.addEventListener("dragover", handleDragOver)
    win.addEventListener("dragleave", handleDragOver) // Reuse same prevDefault
    win.addEventListener("drop", handleDrop)
    win.addEventListener("paste", handlePaste)
}



const contentIn = function (content) {
    last_content = content
    if (window.newMessageForUser) {
        newMessageForUser("processing content…")
    } else {
        message_for_user = "processing content…"
    }
    const chunks = chunkenizeText(content)
    chunksReady(chunks)
}

// Cross-tab coordination simplified: Removed auto-close logic
// (BroadcastChannel coordination was causing "instant closing" issues for some users)


// Support for tab reuse / navigation via fragment (#url=)
window.checkParameters = function () {
    console.log("BRAG::checkParameters:: checking search and hash...");

    let urlToProcess = null;

    // 1. Check search params (?url=)
    const urlParams = new URLSearchParams(window.location.search);
    urlToProcess = urlParams.get('url');

    // 2. Check fragment params (#url= or #...&url=)
    if (!urlToProcess && window.location.hash) {
        // Remove the leading # and parse as search params
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        urlToProcess = hashParams.get('url');
    }

    if (urlToProcess) {
        console.log("BRAG::URL found to process:", urlToProcess);
        if (window.processUrl) {
            window.processUrl(urlToProcess);
            // Clear the hash after a short delay to ensure browser state is settled
            setTimeout(() => {
                history.replaceState(null, document.title, window.location.pathname + window.location.search);
                window.focus();
            }, 100);
        } else {
            console.error("BRAG::processUrl is not defined yet!");
        }
    } else {
        console.log("BRAG::No URL parameter found in search or hash.");
    }
}

window.addEventListener("hashchange", () => {
    console.log("BRAG::Hash change event triggered");
    window.checkParameters();
});
