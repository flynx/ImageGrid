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



/*********************************************************************/

var CLIENT_ACTIONS = {
	// this expects the folowing attrs:
	//
	// 	.data
	//

	focusImage: doc('Focus Image',
		// XXX do we need to account for event first argument here???
		function(gid){
			this.data.focusImage(gid)
			return this
		}),

	// target can be:
	// 	- current
	// 	- base
	// 	- before
	// 	- after
	//
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
}




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
