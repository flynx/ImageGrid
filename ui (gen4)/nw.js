/**********************************************************************
* 
*
*
**********************************************************************/
if(window.nodejs != null){

// node-webkit specific modules...
var gui = require('nw.gui')

define(function(require){ var module = {}
console.log('>>> nw')

var browser = require('browser')
//var DEBUG = DEBUG != null ? DEBUG : true


var walk = require('lib/widget/browse-walk')


/*********************************************************************/

//var data = require('data')

window.listDirBrowser = walk.listDirBrowser

window.toggleFullscreenMode = 
module.toggleFullscreenMode = CSSClassToggler(
		document.body, 
		'.full-screen-mode',
		function(action){
			gui.Window.get().toggleFullscreen()
		})


window.showDevTools = 
module.showDevTools = function(){
	gui.Window.get().showDevTools()
}


window.setWindowTitle = 
module.setWindowTitle = function(text){
	browser.setWindowTitle(test)
	gui.Window.get().title = title
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })}
