let TILES_LOADED = []
let TILES = []
let tileToRemove

loadTile = function(path, loadedCallBack, dataCallBack, name, detectMouse=true){
  //console.log("1 path", path)
  let iframe = _buildIframe()
  let scope = this
  // let pathParts = path.split("/")
  // console.log("pathParts[pathParts.length-1]", pathParts[pathParts.length-1])
  // let viewClass = this[pathParts[pathParts.length-1]]
  // console.log("viewClass", viewClass)
  // let isView = pathParts[pathParts.length-2]=="Views"

  // if(isView) path = pathParts.slice(0, pathParts.length-2).join("/")+"/Tiles/ViewTile"
  // console.log("2 path", path)

  if(path.substr(-5)!="html") path+="/index.html"

  let contentWindow = iframe.contentWindow

  let tile = {
    name,
    path,
    iframe,
    contentWindow,
    scope,
    loaded:false,
    appended:true,
    setDimensions:function(x,y,w=100,h=100,zIndex=1){
      if(x==null){
        x = 0
        y = 0
        w = window.innerWidth// document.getElementById('maindiv').clientWidth
        h = window.innerHeight//document.getElementById('maindiv').clientHeight
      }
      iframe.setAttribute('style', `position:absolute; top:${y}px; left:${x}px; width:${w}px; height:${h}px; display:inline; z-index:${zIndex};  overflow: hidden;`);
    },
    sendData:function(data){
      if(this.scope?._) data = _convertDataToMo(data, this.scope)
    	this.scope?.receiveData?this.scope.receiveData(data):(this.scope.__receiveData?this.scope.__receiveData(data):(this.scope.onMessageReceived?this.scope.onMessageReceived({data:[data]}):console.log("no receiveData function found in tile "+name)))
    },
    mouseIsOver:false,
    detectMouse
  }

  tile.setDimensions()
  
  //console.log("    tilee/view added listener", name)
  iframe.setAttribute('src', path)
  iframe.addEventListener('load', function(e){
    if(tile.loaded) return
    tile.loaded = true
    //console.log("    tilee/view loaded", name)
    let sendDataFunctionToInject = function(data){
    	if(data.data) data = data.data
    	data = _convertDataFromMo(data)
	    dataCallBack(
	      {
	        data,
	        tile
	      }
	     )
    }

    tile.scope = iframe.contentWindow

    //some tilees don't have the communication functions on the global namespace
    //instead, they should leave a global property instance available that will become the scope
    if(!tile.scope.receiveData && tile.scope.instance){
      tile.scope = tile.scope.instance
    }

    //3 different protocols
    tile.scope.sendData = sendDataFunctionToInject
    tile.scope.__sendData = sendDataFunctionToInject
    // tile.scope.parent = {
    // 	postMessage:sendDataFunctionToInject
    // }

    // console.log("path:", path)
    // console.log("isView:", isView)
    // if(isView) iframe.contentWindow.activateView(viewClass)
    TILES_LOADED.push(tile)
    //console.log("    tilee/view --> loadedCallBack")
    loadedCallBack(tile)
  }, false)

  
  if(detectMouse){
    iframe.addEventListener('mouseover', function(){
      TILES_LOADED.forEach(mdl=>{
        mdl.mouseIsOver = mdl==tile
        //mdl.sendData({type:mdl.mouseIsOver?"mouse_over_tile":"mouse_out_tile"})
        if(mdl.mouseIsOver){
          mdl.sendData({type:"mouse_over_tile"})
        }
      })
    })
    iframe.addEventListener('mouseout', function(){
      TILES_LOADED.forEach(mdl=>{
        mdl.mouseIsOver = mdl!=tile
        if(!mdl.mouseIsOver) mdl.sendData({type:"mouse_out_tile"})
      })
    })
  }

  TILES.push(tile)

  return tile
}

removeTileWhenNewIsLoaded = function(tile){
  tileToRemove = tile
}

removeTile = function(tile){
  if(!tile.appended) return
  //console.log("    tile/view removeTile", tile.name)
  var main = document.body
  main.removeChild(tile.iframe)
  tile.appended = false
  //main.removeChild(tile.iframe)
}

appendTile = function(tile){
  if(tile.appended) return

  //console.log("appendModul | tileToRemove?", tileToRemove)
  // if(tileToRemove) {
  //   removeModul(tileToRemove)
  //   tileToRemove = null
  // }

  let ifrm = _buildIframe()
  
  let contentWindow = ifrm.contentWindow
  tile.iframe = ifrm
  
  

  //console.log("      modul/view appendModul", modul.name)
  //var main = document.body
  //main.appendChild(modul.iframe)
  tile.appended = true
  //console.log("       ::::   tile.contentWindow", tile.contentWindow, tile.contentWindow==tile.iframe.contentWindow)
  // main.appendChild(tile.iframe)
  tile.contentWindow=tile.iframe.contentWindow

  tile.scope = iframe.contentWindow

  //some tiles don't have the communication functions on the global namespace
  //instead, they should leave a global property instance available that will become the scope
  if(!tile.scope.receiveData && tile.scope.instance){
    tile.scope = tile.scope.instance
  }
}


////////////////////////////////////////////////////////////////////////////

//useless
postMessage = function(data){}


_buildIframe = function(){
  var main = document.body//.getElementById('maindiv');
  var ifrm = document.createElement('iframe')

  //ifrm.setAttribute('scrolling', 'yes'); //why this was a yes?????

  ifrm.setAttribute('id', "id_frame");

  ifrm.setAttribute('allowtransparency', 'true');
  ifrm.setAttribute('backgroundColor', 'transparent');
  ifrm.setAttribute('frameBorder', '0');
  ifrm.style.border = "none"

  if(tileToRemove) {
    removeTile(tileToRemove)
    tileToRemove = null
  }

  main.appendChild(ifrm)

  return ifrm
}

_convertDataToMo = function(data, scope){
  if(data==null) return
	let mo = scope.mo
	if(data["isTable"]){
    let name = data.name
		data = mo.Table.fromArray(data.slice())
    data.name = name
		data.forEach((l,i)=>{
      data[i]=mo.List.fromArray(l.slice()).getImproved()
      data[i].name = l.name
    })
		data = data.getImproved()
	} else if(data["isList"]){
    let name = data.name
		data=mo.List.fromArray(data.slice()).getImproved()
    data.name = name
	}
  
	//Network
	return data
}

/**
* Converts data that comes from moebio framework into _ framework objects
* It also converts arrays
* Work to be continued (arrays of arrays --> tables, networks…)
*/
_convertDataFromMo = function(data){
  // console.log("data.isTable,", data.isTable)
  // console.log("typeof data", typeof data)
  // console.log("data.getImproved", data.getImproved)
	if(data==null) return
	if(typeof data != "object") return data
	if(data["isTable"] && data.getImproved){ //getImproved is a signature of mo framework
    data = _.toT(data.slice())
		data.forEach((l,i)=>data[i]=_.toL(data[i].slice()).downcast())
		data = data.downcast()
	} else if(data["isList"] && data.getImproved){
		data=_.toL(data.slice()).downcast()
	} else if(data?.type=="Network" && data.nodeList){
		//T
	} else if(data.nodes){ //for networks and nodes
    return data
  } else if(Array.isArray(data) && !data.downcast){
		data = data.map(e=>_convertDataFromMo(e))
		data = _.toL(data.slice())
	} else if(data["canvas"]){//ScatterPlot returns a canvas
		
	} else {
		data = Object.assign(data)
		for(let propName in data){
			data[propName] = _convertDataFromMo(data[propName])
		}
	}
  
	return data
}