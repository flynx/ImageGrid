/**********************************************************************
* 
*
*
* XXX still thinking on how to package this correctly...
* XXX add worker support...
*
**********************************************************************/

// var htmlCanvas = document.getElementById("canvas")
// var offscreen = htmlCanvas.transferControlToOffscreen()
// 
// var worker = new Worker("offscreencanvas.js")
// worker.postMessage({canvas: offscreen}, [offscreen])
//
// XXX also test for OffscreenWorker(..)...
onmessage = function(evt){
	var canvas = evt.data.canvas


	// XXX
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
