/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

define(function(require){ var module = {}
console.log('>>> ui')

doc = require('keyboard').doc

data = require('data')



function proxy(attr, name){
	return function(){
		this[attr][name].apply(this[attr], arguments)
		return this
	}
}



/*********************************************************************/

var CLIENT_ACTIONS = {
	// this expects the folowing attrs:
	//
	// 	.data
	//

	focusImage: doc('Focus Image', 
		proxy('data', 'focusImage')),
	focusRibbon: doc('Focus ribbon',
		proxy('data', 'focusRibbon')),
	firstImage: doc('', 
		proxy('data', 'firstImage')),
	lastImage: doc('', 
		proxy('data', 'lastImage')),
}




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
