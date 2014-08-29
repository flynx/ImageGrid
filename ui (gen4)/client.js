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

	// target can be:
	// 	- current
	// 	- base
	// 	- before
	// 	- after
	//
	// XXX should this be implemented here on in data.js????
	focusRibbon: doc('Focus ribbon',
		function(target){
			var cur = this.data.getRibbonIndex()
			var ribbon = this.data.getRibbon(target)
			var t = this.data.getRibbonIndex(ribbon)

			// XXX revise this...
			var direction = t < cur ? 'before' : 'after'

			return this.focusImage(
				this.data.getImage(ribbon, direction))
		}),

	firstImage: doc('', 
		proxy('data', 'firstImage')),
	lastImage: doc('', 
		proxy('data', 'lastImage')),
}




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
