class Enricher {
    constructor() {
        this.nStepsEnrich = 0
        this.array_being_enriched = null
        this.llm_delay = 5000
        this.alternativeTextPropertyNames = ["text", "description", "content", "body", "body_text", "bodyText", "description_text", "descriptionText", "description_content", "descriptionContent", "description_body", "descriptionBody", "description_body_text", "descriptionBodyText", "description_body_content", "descriptionBodyContent", "collection_description"]
        this.alternativeTitlePropertyNames = ["title", "name", "label", "artist_name"]

        this.enrichFunctions = {
            embedding: {
                func: this.addEmbedding.bind(this),
            },
            title: {
                func: this.addTitle.bind(this),
            },
            category: {
                func: this.addCategory.bind(this),
            },
            tags: {
                func: this.addTags.bind(this),
            },
            keywords: {
                func: this.extractKeyWords.bind(this),
            },
            summary: {
                func: this.addSummary.bind(this),
            },
            image: {
                func: this.loadImage.bind(this),
            },
            imageDescription: {
                func: this.addImageDescription.bind(this),
            },
            imageElements: {
                func: this.addImageElements.bind(this),
            },
            type: {
                func: this.addType.bind(this),
            },
            cluster_category: {
                func: this.addClusterCategory.bind(this),
                collective: true
            },
            array_title: {
                func: this.addArrayTitle.bind(this),
                collective: true
            },
        }
    }

    /**
     * 
     * @param {*} array 
     * @param {*} config options: {
     *  embedding:true, 
     *  title:true, 
     *  category:true, 
     *  tags:true, 
     *  keywords:true,
     *  summary:true, 
     *  image:true,
     *  imageDescription:true,
     *  imageElements:true,
     *  type:true,
     *  cluster_category:true,
     *  array_title:true,
     * }
     */
    enrich(array, config, onDone) {
        console.log("enrich:::", array)
        this.array_being_enriched = array

        this.llm_delay = array.length * 50

        for (let enrichPropertyName in this.enrichFunctions) {
            if (config[enrichPropertyName] && this.enrichFunctions[enrichPropertyName].collective) {
                this.nStepsEnrich++
                this.enrichFunctions[enrichPropertyName].func(array, () => this._oneStepLess(onDone))
            }
        }
        array.forEach(element => {
            for (let enrichPropertyName in this.enrichFunctions) {
                if (this.enrichFunctions[enrichPropertyName].collective) {
                    continue
                }
                if (config[enrichPropertyName]) {
                    if (element[enrichPropertyName]) {
                        continue
                    }
                    this.nStepsEnrich++
                    this.enrichFunctions[enrichPropertyName].func(element, () => this._oneStepLess(onDone))
                }
            }
        })

        if (this.nStepsEnrich === 0) {
            onDone()
        }
    }

    /*
    complete enrichment, except for image enrichment
    */
    enrichComplete(array, onDone) {
        console.log("enrichComplete:::", array)
        //searches for text and titles candidates
        array.forEach(element => {

            //text
            if (!element.text) {
                for (let alternativeTextPropertyName of this.alternativeTextPropertyNames) {
                    if (element[alternativeTextPropertyName]) {
                        element.text = element[alternativeTextPropertyName]
                        break
                    }
                }
                const includesFlagsForText = ["description", "content", "body", "body_text", "bodytext", "description_text", "descriptiontext", "description_content", "descriptioncontent", "description_body", "descriptionbody", "description_body_text", "descriptionbodytext", "description_body_content", "descriptionbodycontent", "collection_description"]
                if (!element.text && includesFlagsForText.some(flag => element[flag])) {
                    for (let propertyName in element) {
                        if (includesFlagsForText.includes(propertyName.toLowerCase()) && typeof element[propertyName] === "string") {
                            element.text = element[propertyName]
                            break
                        }
                    }
                }
            }
            if (element.text) element.text = element.text.trim()


            //title
            if (!element.title) {
                for (let alternativeTitlePropertyName of this.alternativeTitlePropertyNames) {
                    if (element[alternativeTitlePropertyName] && typeof element[alternativeTitlePropertyName] === "string") {
                        element.title = element[alternativeTitlePropertyName]
                        break
                    }
                }
            }
        })

        console.log("first part of enriching")
        this.enrich(array, {
            embedding: true,
            title: true,
            category: true,
            tags: true,
            keywords: true,
            summary: false,
            image: false,
            imageDescription: false,
            imageElements: false,
            type: false,
            cluster_category: false,
            array_title: false
        }, () => {
            console.log("second part of enriching")
            this.enrich(array, {
                embedding: false,
                title: false,
                category: false,
                tags: false,
                keywords: false,
                summary: false,
                image: false,
                imageDescription: false,
                imageElements: false,
                type: false,
                cluster_category: true,
                array_title: true
            }, onDone)
        })
    }

    _oneStepLess(onDone) {
        this.nStepsEnrich--
        console.log("(•)steps left:", this.nStepsEnrich)
        if (this.nStepsEnrich === 0) {
            console.log("(•) All chunks processed")
            onDone()
        }
    }

    /////////////enrich functions

    addEmbedding(element, onDone) {
        this.llm_embedding_with_delay(element.text, (response) => {
            element.embedding = response.embedding
            onDone()
        })
    }

    addTitle(element, onDone) {
        const promptObject = {
            prompt: "create a very short title for this text: " + element.text + ". \n\n return only the title, no explanation, headers, etc.",
            onLoad: (response) => {
                const content = response.content || ""
                const title = content.replaceAll("\n", "").replaceAll('"', "").replaceAll("'", "").trim()
                element.title = title
                onDone()
            }
        }
        this.llm_completion_with_delay(promptObject)
    }

    addCategory(element, onDone) {
        const promptObject = {
            prompt: "assign a thematical category for this text: " + element.text + ". \n\n return only the category, no explanation, headers, etc.",
            onLoad: (response) => {
                const content = response.content || ""
                const category = content.replaceAll("\n", "").replaceAll('"', "").replaceAll("'", "").trim()
                element.category = category
                onDone()
            }
        }
        this.llm_completion_with_delay(promptObject)
    }

    addClusterCategory(elements, onDone) {
        if (elements[0] && elements[0].cluster_category) {
            onDone()
            return
        }

        console.log("-- addClusterCategory")

        const net = buildNetwork(elements, N_CONNECTIONS_PER_NODE, false)
        const clusters = _.buildNetworkClusters(net)

        console.log("clusters:::", clusters)

        let nClustersToProcess = clusters.length
        if (nClustersToProcess === 0) {
            onDone()
            return
        }

        clusters.forEach((nodes, index) => {
            let text = ""
            nodes.forEach(node => {
                if (node.isTag) {
                    node.chunk = {}
                    node.chunk.cluster_category = "tags"
                } else {
                    node.chunk.cluster_category = "cluster_" + index
                    text += node.chunk.title + "\n\n"
                }
            })
            const promptObject = {
                prompt: "assign a thematical category for this text: " + text.trim() + ". \n\n return only the category, no explanation, headers, etc.",
                onLoad: (response) => {
                    const content = response.content || ""
                    const category = content.replaceAll("\n", "").replaceAll('"', "").replaceAll("'", "").trim()
                    nodes.forEach(node => {
                        node.chunk.cluster_category_name = category
                    })
                    this.nStepsEnrich--
                    nClustersToProcess--
                    console.log("    nClustersToProcess:::", nClustersToProcess)
                    if (nClustersToProcess === 0) onDone()
                }
            }
            this.nStepsEnrich++
            this.llm_completion_with_delay(promptObject)
        })
    }

    addArrayTitle(elements, onDone) {
        if (elements[0] && elements[0].array_title) {
            onDone()
            return
        }

        let elements_titles = ""
        let nTitles = 0
        const maxTitles = 20
        elements.forEach((element, i) => {
            elements_titles += element.title + "\n"
            nTitles++
            if (nTitles >= maxTitles) return
            if (element.index == 0 && i > 0) nTitles = Math.max(nTitles - 5, 0)
        })

        const prompt = "these are titles from a few parts of a text, please provide a very short title (needs to work as file name as well) for the whole text:\n\n" + elements_titles.trim() + "\n\n return only the title, no explanation, headers, etc."

        const promptObject = {
            prompt: prompt,
            onLoad: (response) => {
                const content = response.content || ""
                const array_title = content.replaceAll("\n", "").replaceAll('"', "").replaceAll("'", "").trim()
                elements[0].array_title = array_title
                onDone()
            }
        }
        this.llm_completion_with_delay(promptObject)
    }

    addTags(element, onDone) {
        const promptObject = {
            prompt: "assign a few categorical tags for this text (between 1 and 3): " + element.text + ". \n\n return only the tags separated by comma, no explanation, headers, etc.",
            onLoad: (response) => {
                const content = response.content || ""
                const tags = content.replaceAll("\n", "").replaceAll('"', "").replaceAll("'", "").trim().split(",").map(k => k.trim())
                element.tags = tags
                onDone()
            }
        }
        this.llm_completion_with_delay(promptObject)
    }

    extractKeyWords(element, onDone) {
        const promptObject = {
            prompt: "extract the most relevant keywords from this text: " + element.text + ". \n\n return only the keywords separated by comma, no explanation, headers, etc.",
            onLoad: (response) => {
                const content = response.content || ""
                const keywords = content.replaceAll("\n", "").replaceAll('"', "").replaceAll("'", "").trim().split(",").map(k => k.trim())
                element.keywords = keywords
                onDone()
            }
        }
        this.llm_completion_with_delay(promptObject)
    }

    addSummary(element, onDone) {
        const promptObject = {
            prompt: "create a very short summary for this text: " + element.text + ". \n\n Do not say 'this text…' or any other external/meta remark, just write the sumamry as if it was the text. Return only the summary, no explanation, headers, etc.",
            onLoad: (response) => {
                const content = response.content || ""
                const summary = content.replaceAll("\n", "").replaceAll('"', "").replaceAll("'", "").trim()
                element.summary = summary
                onDone()
            }
        }
        this.llm_completion_with_delay(promptObject)
    }

    loadImage(element, onDone) {
        const url = element.url_image || element.urlImage || element.imageUrl || element.image_url || element.urlImg || element.imgUrl || element.img_url || element.img_url
        if (!url) {
            onDone()
            return
        }
        _.loadImage(url, (ob) => {
            element.image = ob.result
            onDone()
        })
    }

    addImageDescription(element, onDone) {
        onDone()
    }

    addImageElements(element, onDone) {
        onDone()
    }

    addType(element, onDone) {
        element.type = "entity"
        onDone()
    }

    llm_embedding_with_delay(text, onDone) {
        setTimeout(() => {
            llmService.embedding(text, onDone)
        }, Math.random() * this.llm_delay)
    }

    llm_completion_with_delay(promptObject) {
        setTimeout(() => {
            llmService.llm_completion(promptObject)
        }, Math.random() * this.llm_delay)
    }
}

const enricher = new Enricher()

// Global entry points for backward compatibility
const enrich = (array, config, onDone) => enricher.enrich(array, config, onDone)
const enrichComplete = (array, onDone) => enricher.enrichComplete(array, onDone)
// To allow access to nStepsEnrich from Process.js without changing it too much yet
// But it's better to update Process.js to use enricher.nStepsEnrich