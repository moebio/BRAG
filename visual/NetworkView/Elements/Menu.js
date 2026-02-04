import Element from './Element.js'

export default class Menu extends Element{

	/////////////////////////////////////////constructor
	constructor(k, callBackSendData, config){
		super(k, callBackSendData, config)

		this.selectedValues
		this.selectedIndexes
		this.indexOver

		this.prevOverSome = false

		this.mode = 0
		this.setTextColor('black')

		//this.FREEZE_WHENOUT = true
	}

	setData(labels, colors, values, colorsUnSelected, selectionMode){
		if(values==null) values = labels

		this.labels = labels

		if(this.labels==null) return

		this.colors = colors
		this.values = values
		this.colorsUnSelected = colorsUnSelected
		this.selectionMode = selectionMode //single, multi

		if(this.colors==null){

		}

		if(this.colorsUnSelected==null){

		}
		
		if(this.selectedValues==null){
			this._resetActive()
		}
	}

	setConfig(){
		
	}

	/**
	modes:
	0:rectangles
	1:circles
	**/
	setMode(mode){
		this.mode = mode
	}

	setTextColor(txtColor){
		this.textColor = txtColor
		this.textColorTransparent = _.addAlpha(this.textColor, 0.5)
	}

	control(object){
		
		switch(object?.type){
			case 'select':
				if(this.selectionMode=="single") this._resetActive()
				let indexes = Array.isArray(object.value)?object.value:[Number(object.value)]
				this._setIndexesActive(indexes)
				break
			case 'select_values':
				if(this.selectionMode=="single") this._resetActive()
				let values = Array.isArray(object.value)?object.value:[object.value]
				this._setValuesActive(values)
				break
			case 'highlight':
				this.highlightIndex = object.value
				break
			case 'highlight_value':
				this.highlightIndex = this.values.indexOf(object.value)
				break
			case 'unhighlight':
				this.highlightIndex = null
				break
		}

		super.control(object)
	}

	

	draw(){
  		if(this.labels==null) return
  		super.draw()

		let color
		let y0 = this.y
		let dy = this.h/this.labels.length
		let over
		let indexOverPrev = this.indexOver
		this.indexOver = null

		let xText = this.x+(this.mode==0?10:dy*1.2)

		let overSome = false

		for(let i=0; i<this.labels.length; i++){
			color = this.active[i]?this.colors[i]:this.colorsUnSelected[i]
			this.k.fill(color)
			switch(this.mode){
				case 0:
					over = this.k.fRectM(this.x, y0, this.w, dy)
					break
				case 1:
					this.k.fCircle(this.x+dy*0.5, y0+dy*0.5, dy*0.4)
					over = this.k.mY>y0 && this.k.mY<y0+dy && this.k.mX>this.x && this.k.mX<this.x+this.w
					break
			}
			
			this.k.setText(this.active[i]?this.textColor:this.textColorTransparent, 16, undefined, 'ledt', 'middle', 'bold')
			this.k.fText(this.labels[i], xText, y0+dy*0.5)
			y0+=dy
			if(over) {
				overSome = true
				this.k.setCursor('pointer')
				this.indexOver = i
				
			}

			if(over && this.k.MOUSE_UP){
				if(this.selectionMode=="single" && !this.active[i]) this._resetActive()
				this.active[i] = !this.active[i]

				var callBackOb = {
					value:this.values[i],
					index:i,
					selectedValues:this.selectedValues,
					selectedIndexes:this.selectedIndexes
				}

				if(this.active[i]){
					this.selectedValues.push(this.values[i])
					this.selectedIndexes.push(i)
					callBackOb.type = 'select'
				} else {

					
					this.selectedValues.getWithoutElement(this.values[i]) //problematic when values repeat
					this.selectedIndexes.getWithoutElement(i)
					callBackOb.type = 'unselect'
				}
				
				this.callBackSendData(callBackOb)
			}
		}

		let iOver = this.indexOver!=null?this.indexOver:this.highlightIndex

		if(overSome){
			// if(!this.prevOverSome){
			// 	this.callBackSendData({
			// 		type:"over",
			// 		value:this.values[iOver],
			// 		index:iOver,
			// 		selectedValues:this.selectedValues,
			// 		selectedIndexes:this.selectedIndexes
			// 	})
			// }
		} else if(this.prevOverSome){
			this.callBackSendData({
				type:"out",
				selectedValues:this.selectedValues,
				selectedIndexes:this.selectedIndexes
			})
		}

		
		if(iOver!=null){
			this.k.stroke('black', 2)
			switch(this.mode){
				case 0:
					this.k.sRect(this.x+1,this.y+iOver*dy+1,this.w-2,dy-2)
					break
				case 1:
					this.k.sCircle(this.x+dy*0.5, this.y+iOver*dy+dy*0.5, dy*0.4)
					break
			}
			
		} 

		this.prevOverSome = overSome

		if(this.indexOver!=null && this.indexOver != indexOverPrev) this.callBackSendData({type:'over', value:this.values[this.indexOver], index:this.indexOver, active:this.active[this.indexOver]})
	}


	
	//////private

	_resetActive(){
		this.active = new Array(this.labels.length).fill(false).toL()
		this.selectedValues = new _.L()
		this.selectedIndexes = new _.nL()
	}
	_setValuesActive(valuesToActive){
		this._resetActive()
		this.values.forEach((val,i)=>{
			if(valuesToActive.includes(val)){
				this.active[i] = true
				this.selectedValues.push(val)
				this.selectedIndexes.push(i)
			}
		})
	}
	_setIndexesActive(indexesToActive){
		this._resetActive()
		indexesToActive.forEach(i=>{
			this.active[i] = true
			this.selectedIndexes.push(i)
			this.selectedValues.push(this.values[i])
		})
	}
}