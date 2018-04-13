/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var toggler = require('lib/toggler')
var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')
var widgets = require('features/ui-widgets')

var widget = require('lib/widget/widget')
var browse = require('lib/widget/browse')
var overlay = require('lib/widget/overlay')
var drawer = require('lib/widget/drawer')

var browseWalk = require('lib/widget/browse-walk')



/*********************************************************************/

var ExperimentActions = actions.Actions({
	// XXX depends on ui, ...
	// XXX should we add ability to pick and chose the changes???
	// XXX would be nice to have a universal .save() action...
	browseChanges: ['Experimental/$Changes...',
		{dialogTitle: 'Unsaved changes'},
		widgets.makeUIDialog(function(path){
			var that = this
			var handlers_setup = false
			return browse.makeLister(null, function(_, make){
				var keys = Object.keys(that.changes || {})
				if(keys.length == 0){
					make.Empty('No changes...')

				} else {
					keys
						.forEach(function(key){
							make(key)
						})

					make('---')
					make('Save', {
						open: function(){
							that.saveIndexHere 
								&& that.saveIndexHere()
						},
						close: function(){
							that.off('markChanged', 'changes-dialog-updater')
						}
					})

					if(!handlers_setup){
						// XXX need to clean this up in a better way...
						// XXX this should also track .changes...
						that.on('markChanged', 'changes-dialog-updater', function(){
							make.dialog.update()
						})
						handlers_setup = true
					}
				}
			})
		})],
})

var ExperimentFeature = 
module.ExperimentFeature = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'experiments',

	//isApplicable: function(actions){ return actions.experimental },

	actions: ExperimentActions,

	handlers: [
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
