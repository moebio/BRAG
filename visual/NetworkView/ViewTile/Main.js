let k
let view

init=function(){
  console.log("loaded View Tile !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
  k = new _.MetaCanvas({
    cycle,
    resize
  })
}

receiveDataFromView=function(data){
  console.log("receive data from view", data)
}

activateView=function(viewClass){
  console.log("activateView!!!")
  console.log("viewClass", viewClass)
  view = new viewClass(k)
}

cycle=function(){
  view?.draw()
  //draw()

  // sendData({
  //   data:{
  //     data0,
  //     data1
  //   })
}

resize = function(){
  //k.W, k.H
}

receiveData = function(dataObj){
  console.dir(dataObj)
  view?.setData(dataObj)

  //processData(dataObj)
}

////////////////////////////////////////////////

//will be overriden by however loads the module
sendData = function(){}


window.addEventListener("load", function() {  
  init()
})