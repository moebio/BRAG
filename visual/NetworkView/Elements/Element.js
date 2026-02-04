// Element.prototype = {};
// Element.prototype.constructor = Element;

export default class Element{
	constructor(k, callBackSendData, config = {freeze_when_out:true}) {
		this.k = k
		this.callBackSendData = callBackSendData
		this.config = config
		this.cursorIn = false

		//config
		this.FREEZE_WHENOUT = config.freeze_when_out

		//private
		this._frozenImage
	}

	setData(){
		this.k.cycleFor(100)
	}

	setConfig(configObj){
		this.FREEZE_WHENOUT = configObj.freeze_when_out
	}

	control(controlObj){
		this._frozenImage = null;
		this.k.cycleFor(200)
		// this.k.MOUSE_IN_DOCUMENT = true
		// this.draw()
		// this.k.MOUSE_IN_DOCUMENT = false
		// this.draw()
		//setTimeout(()=>this.k.MOUSE_IN_DOCUMENT = false, 100)
	}

	setDimensions(x, y, w, h){
		this.x = x
		this.y = y
		this.w = w
		this.h = h
		this.k.cycleFor(100)
	}

	draw(){
		//console.log("draw")
		let startFreezing = this._checkCursor()
		if(!this.cursorIn && this._frozenImage && !startFreezing){
			this.k.drawImage(this._frozenImage, this.x, this.y, this.w, this.h)
		}
	}


	///private

	_drawFrozen(){
		this._checkCursor()
		if(this._frozenImage==null){ 
			this._oldDraw()
		} else {
			this.k.drawImage(this._frozenImage, this.x, this.y, this.w, this.h)
		}
		//console.log("_drawFrozen")
	}

	_checkCursor(){
		//check if cursor is on Canvas

		var prevCursorIn = this.cursorIn
		this.cursorIn = this.k.mX>this.x && this.k.mX<this.x + this.w && this.k.mY>this.y && this.k.mY<this.y + this.h
		
		if(this.cursorIn && !prevCursorIn) this.callBackSendData({type:'in'})
		if(!this.cursorIn && prevCursorIn){
			this.callBackSendData({type:'out'})
			if(this.FREEZE_WHENOUT){
				this._frozenImage = null
				//this.draw()
				let k2 = new _.MetaCanvas({cycle:null, resize:null})
				k2.name = "transitory canvas"
				let prev_k = this.k
				this.k = k2
				this.draw()
			 	this._frozenImage = k2.captureCanvas(this.x, this.y, this.w, this.h)
			 	this.k = prev_k
			 	this._oldDraw = this.draw
			 	this.draw = this._drawFrozen
			 	return true
			}
		} else if(this.cursorIn && !prevCursorIn){
			if(this._oldDraw) this.draw = this._oldDraw;
		}
	}
}