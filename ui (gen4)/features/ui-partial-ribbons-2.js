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
// XXX update sequence:
// 		- if target is loaded more than 1 screen width off the edge:
// 			- jump (animate)
// 			- update ribbon
// 		- if target is not loaded or too close to edge:
// 			- update ribbon to place current at ~1 screen off the edge in 
// 				the opposite direction...
// 			- load target partially (1/2 ribbon) ~1 screen off the other edge
// 			- jump (animate)
// 			- update ribbon to place target at center of ribbon
// 		...this all feels a bit too complicated...
// XXX do we need to do most of the work here on in imagegrid/data.js???
// 		...another question would be if we can do this using existing 
// 		functionality?

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
		['focusImage.pre centerImage.pre', 
			function(target, list){
				// XXX
			}],
		['resizing.pre',
			function(unit, size){
				// XXX
			}],
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
