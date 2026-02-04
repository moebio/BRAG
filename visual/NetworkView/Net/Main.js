import '../../../libraries/pulse.js'
import NetView from '../NetView/NetView.js'


export default class Net {

  constructor() {
    this.k = new _.MetaCanvas({
      cycle: this.cycle.bind(this)
    })

    this.view = new NetView(this.k, this.receiveDataFromView.bind(this))
  }

  receiveDataFromView(ob) {
    //console.log("receiveDataFromView:", ob)
    this.sendData(ob)
  }

  cycle() {
    this.view?.draw()
  }

  receiveData(dataObj) {
    this.view.receiveData(dataObj)
  }

  ////////////////////////////////////////////////

  //will be overriden by however loads the module
  sendData() { }

}

var net = new Net()

//window.receiveData = net.receiveData
window.instance = net

