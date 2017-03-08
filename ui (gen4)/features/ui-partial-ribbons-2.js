/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')



/*********************************************************************/

var PartialRibbonsActions = actions.Actions({
	updateRibbon: ['- Interface/Update partial ribbon size', 
		function(target, w, size, threshold){
			// XXX
		}],
	resizeRibbon: ['- Interface/Resize ribbon to n images',
		function(target, size){
			// XXX
		}],
})

var PartialRibbons = 
module.PartialRibbons = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	priority: 'high',

	tag: 'ui-partial-ribbons-2',
	exclusive: ['ui-partial-ribbons'],
	depends: [
		'ui',
	],

	actions: PartialRibbonsActions, 

	handlers: [
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
