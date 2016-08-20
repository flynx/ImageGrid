/**********************************************************************
* 
*
*
**********************************************************************/
(typeof(define)[0]=='u'?function(f){module.exports=f(require)}:define)(
function(require){ var module={} // makes module AMD/node compatible...
/*********************************************************************/

var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')



/*********************************************************************/

var ExperimentActions = actions.Actions({
	/* trying an argument mutation method... (FAILED: arguments is mutable)
	argumentMutation: [
		function(a, b){
			console.log('ACTIONS ARGS:', a, b)
		}],
	*/
})

var ExperimentFeature = 
module.ExperimentFeature = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'experiments',

	isApplicable: function(actions){ return actions.experimental },

	actions: ExperimentActions,

	handlers: [
		/* trying an argument mutation method... (FAILED: arguments is mutable)
		['argumentMutation.pre', 
			function(a, b){
				console.log('EVENT ARGS:', a, b)
				arguments[0] += 1
				arguments[1] += 1
			}],
		*/
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
