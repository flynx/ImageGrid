/**********************************************************************
* 
*
*
**********************************************************************/
if(window.nodejs != null){

define(function(require){ var module = {}

var toggler = require('lib/toggler')

var browser = require('browser')
//var DEBUG = DEBUG != null ? DEBUG : true

var walk = require('lib/widget/browse-walk')


/*********************************************************************/

//var data = require('data')

window.listDirBrowser = walk.listDirBrowser

window.toggleFullscreenMode = 
module.toggleFullscreenMode = toggler.CSSClassToggler(
		document.body, 
		'.full-screen-mode',
		function(action){
			nw.Window.get().toggleFullscreen()
		})


window.showDevTools = 
module.showDevTools = function(){
	nw.Window.get().showDevTools()
}


window.setWindowTitle = 
module.setWindowTitle = function(text){
	browser.setWindowTitle(test)
	nw.Window.get().title = title
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })}
