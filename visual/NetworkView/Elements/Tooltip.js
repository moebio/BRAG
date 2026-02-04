import Element from './Element.js'

export default class Tooltip extends Element{

	/////////////////////////////////////////constructor
	constructor(k, callBackSendData, config={font_size:16, marginW:10, marginH:6, fixedWidth:200}){
		super(k, callBackSendData, config)

		this.text
		this.W
		this.H
	}

	setData(text){
		if(text==null) return
		this.text = text
		this.k.setText('white', this.config.font_size)
		if(this.config.fixedWidth){
			this.W = this.config.fixedWidth
			let nLines = this.k.fTextWidth(text,-1000,-1000,this.config.fixedWidth-2*this.config.marginW)// this.k.nLines(text, this.config.fixedWidth-2*this.config.marginW)
			this.H = nLines*this.config.font_size + 2*this.config.marginH
		} else {
			let w = this.k.getTextW(text)
			this.W = w + 2*this.config.marginW
			this.H = this.config.font_size + 2*this.config.marginH
		}
	}

	setConfig(){
		
	}

	control(){
	}

	

	draw(){
		if(!this.text) return
		
  		super.draw()

  		let k = this.k

  		let above = k.mY>k.cY*0.6

  		let x = Math.min( Math.max(k.mX - this.W*0.5, 4), k.W - this.W - 4 )
  		let y = above?(k.mY - this.H - 16):(k.mY+16)

  		y = Math.max(5, Math.min(k.H-5, y))

  		k.fill('rgba(0,0,0,0.2)')
  		k.fRect(x+6, y+4, this.W, this.H)
  		if(above){
	  		k.fLines(k.mX, k.mY, k.mX-8+6, k.mY-16+4, k.mX+8+6, k.mY-16+4)
	  	} else {
	  		k.fLines(k.mX, k.mY, k.mX-8+6, k.mY+16+4, k.mX+8+6, k.mY+16+4)
	  	}


  		k.fill('rgba(70,70,70,0.8)')
  		k.fRect(x, y, this.W, this.H)
  		if(above){
	  		k.fLines(k.mX, k.mY, k.mX-8, k.mY-16, k.mX+8, k.mY-16)
	  	} else {
	  		k.fLines(k.mX, k.mY, k.mX-8, k.mY+16, k.mX+8, k.mY+16)
	  	}

  		k.setText('white', this.config.font_size)
  		
  		if(this.config.fixedWidth){
  			k.fTextWidth(this.text, x+this.config.marginW, y+this.config.marginH, this.config.fixedWidth-2*this.config.marginW, this.config.font_size)
  		} else {
  			k.fText(this.text, x+this.config.marginW, y+this.config.marginH)
  		}
  		
	}
}