class InputText extends Element{

	/////////////////////////////////////////constructor
	constructor(callBackSendData, config){
		super({cycleFor:s=>{}}, callBackSendData, config)

		this.text

		this.textArea = this._buildTextArea()

		if(this.config){
			if(this.config.button){
				this.button = this._buildButton(this.config.buttonLabel)
				if(this.config.condition) this.button.disabled = true
			}
			if(this.config.placeholder){
				this.textArea.placeholder = this.config.placeholder
			}

			if(this.config.fontSize){
				this.textArea.style.fontSize = this.config.fontSize+"px"
			}
			if(this.config.readOnly){
				this.textArea.readOnly = true
			}
		}

		if(!this.config?.resize) this.textArea.style.resize="none"

		this.textArea.autocomplete="off"
		this.textArea.autocorrect="off"
		this.textArea.autocapitalize="off"
		this.textArea.spellcheck="false"

		/////this should be managed with configuration
		// this.textArea.style.border = "none";
		// this.textArea.style.outline = "none";
		// this.textArea.style.highlight = "none";
		//////

		this.ONLY_NUMBERS = false

		//options for returning lowerCase, delay, send button
	}

	setDimensions = function(x, y, w, h, z){
		let wB = -5;
		if(this.config.button){
			wB = 80
			this.button.style = `position:absolute; left:${w-wB}px; top:${y}px; width:${wB}px; height:${h}px; resize: none;`
		}
		//this.textArea.style = `position:absolute; left:${x}px; top:${y}px; width:${w-wB-15}px; height:${h}px; resize: none;`
		this.textArea.style.position = "absolute"
		this.textArea.style.left = x+"px"
		this.textArea.style.top = y+"px"
		this.textArea.style.width = (w-wB-6)+"px"
		this.textArea.style.height = h+"px"

		if(z) this.textArea.style.zIndex = z
	}

	setFontSize(size){
		this.textArea.style.fontSize = size
	}

	setData(text){
		this.textArea.value = text
	}

	getData(){
		return this.textArea.value
	}

	setConfig(config){
		super.setConfig(config)
	}

	control(object){
		super.control(object)
	}

	setToNumber(value){
		this.ONLY_NUMBERS = value
		// if(value){
		// 	this.textArea.type = "number"
		// } else {
		// 	this.textArea.type = null
		// }
	}

	

	draw(){
  		
	}

	checkCondition = function(){
		this.button.disabled = !this.config.condition(this.text)
	}

	
	//////private

	_buildTextArea = function(){
	  let textArea = document.createElement('textarea')
	  let main = document.getElementById('maindiv')
	  main.appendChild(textArea)

	  let callBackSendData = this.callBackSendData

	  let withButton = !this.config || !this.config.button

	  let it = this

	  textArea.addEventListener("input", function(e){
	  	if(it.ONLY_NUMBERS){
			let invalidChars = /[^0-9.]/gi
			console.log("---->change value")
			if(invalidChars.test(this.value)) {
				this.value = this.value.replace(invalidChars,"");
			}
		}

	  	it.text = this.value

	  	if(it.button && it.config.condition) it.checkCondition()
	  	//if(it.config.condition) it.button.disabled = !it.config.condition(this.value)

	    if(withButton){
	    	var callBackOb = {
				value:this.value,
				input:it
			}
	    	callBackSendData(callBackOb)
	    }
	  })

	  return textArea
	}

	_buildButton = function(){
		let button = document.createElement('button')
		let main = document.getElementById('maindiv')
		main.appendChild(button)

		button.innerHTML = this.config.buttonLabel??"send"

		let callBackSendData = this.callBackSendData
		let it = this

		button.addEventListener("click", function(e){
		  	var callBackOb = {
				value:it.text
			}
			callBackSendData(callBackOb)
		} )

	  return button
	}
}