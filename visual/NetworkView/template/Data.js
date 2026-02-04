//the embeder calls this function to send data
receiveData = function(dataObj){
  switch(dataObj.type){
    case "data":
      setData(dataObj.value)
      break
    case "configuration":
      setConfiguration(dataObj.value)
      break
  }
}

//optional:
askData = function(type){
  switch(type){
    
  }
}



setData = function(data){

}

setConfiguration = function(confObject){

}

//this function will be overriden by the emebeder, so the module can send data to the embedder
sendData = function(){}