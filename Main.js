let net


const URL_VIEW_BASE = "./visual/NetworkView/"

let CHUNKS = []


use_prompt_memory_local_storage = true

const text_test = ""// "texts/inmu.txt"

init = function () {
	loadsNetworkView()
}

loadExample = function (url_text = text_test) {
	_.loadData(url_text, function (data) {
		const chunks = chunkenizeText(data.result)

		//in Process.js
		chunksReady(chunks)
	})
}


/////

resize = function () {

}

///////////////////////////////////////////////////////////////

window.addEventListener("load", function () {
	init()
	applyDragAndDrop(window)
	if (window.checkParameters) window.checkParameters()
})

window.addEventListener("resize", function (e) {
	if (netView) netView.setDimensions(0, 0, window.innerWidth, window.innerHeight)
	resize()
})