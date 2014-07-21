define(function(require){ var module = {}
/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/


// proof of run...
console.log('111')

// this is global (F*CK!!)...
GLOBAL = 123

// this is not global...
// XXX did I say I hate this CommonJS dance?
var func =
module.func = 
function func(){
	console.log('>>> func!')
}

var func =
module._func = 
function _func(){
	// closure test...
	console.log('>>> func!', func)
}




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
