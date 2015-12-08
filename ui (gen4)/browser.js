/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/

module.launchFullScreen = function(elem) {
	if(elem.requestFullscreen) {
		elem.requestFullscreen();
	} else if(elem.mozRequestFullScreen) {
		elem.mozRequestFullScreen();
	} else if(elem.webkitRequestFullscreen) {
		elem.webkitRequestFullscreen();
	} else if(elem.msRequestFullscreen) {
		elem.msRequestFullscreen();
	}
}

module.exitFullscreen = function() {
	if(document.exitFullscreen) {
		document.exitFullscreen();
	} else if(document.mozCancelFullScreen) {
		document.mozCancelFullScreen();
	} else if(document.webkitExitFullscreen) {
		document.webkitExitFullscreen();
	}
}



window.toggleFullscreenMode = 
module.toggleFullscreenMode = CSSClassToggler(
		document.body, 
		'.full-screen-mode',
		function(action){
			if(action == 'on'){
				module.launchFullScreen(document.documentElement)
			} else {
				module.exitFullscreen()
			}
		})



window.setWindowTitle = 
module.setWindowTitle = function(text){
	var title = text +' - '+ CONFIG.app_name
	$('.title-bar .title').text(title)
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
