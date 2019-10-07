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
	// NOTE: we do not want to pick and chose changes as that might lead 
	// 		to inconsistencies...
	// 		...a better way would be to go would be to:
	// 			- reset
	// 			- undo / redo
	// XXX depends on ui, ...
	// XXX would be nice to have a universal .save() action...
	// XXX can we make this into a dialog that would stop a certain 
	// 		action until the user confirms or aborts... e.g. warn of 
	// 		unsaved changes when navigating away...
	// XXX move this to ui-widgets...
	browseChanges: ['Experimental/$Changes...',
		core.doc`
		`,
		{dialogTitle: 'Unsaved changes'},
		widgets.makeUIDialog(function(path){
			var that = this
			var comment
			var handlers_setup = false
			return browse.makeLister(null, function(_, make){
				var keys = Object.keys(that.changes || {})
				if(keys.length == 0){
					make.Empty('No changes...')

				// list changes...
				} else {
					keys
						.forEach(function(key){
							var opts = {}
							if(that.changes[key] instanceof Array){
								opts.attrs = {
									count: that.changes[key].length
								}
							}

							// XXX show human-readable info... (???)
							make(key, opts)
						})

					// save comment...
					if(that.getSaveComment){
						make('---')
						comment = comment 
							|| that.getSaveComment()
						// XXX this behaves in an odd manner...
						make.Editable(['$Comment: ', comment], 
							{
								multiline: true,
								abort_keys: [
									'Esc',
								],
							})
							.on('edit-commit', function(_, text){
								that.setSaveComment(
									$(this)
										.find('.text')
										.last()
										.text())
							})
							.on('edit-abort', function(){
								$(this)
									.find('.text')
									.last()
									.text(comment)
							})
					}

					make('---')
					make('Save', {
						open: function(){
							that.setSaveComment 
								&& that.setSaveComment(comment)
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

	unsavedChanges: ['- Experimental/',
		function(){
		}],



	// construction of new "virtual images"...
	//
	// XXX should this be restricted to collections???
	// XXX should these be importable???
	// 		i.e. exported as json to <title>.virt and imported back...
	// 		...might be a good idea to add custom import/export handlers...
	// 
	// XXX do better arg processing -- handle metadata correctly...
	// XXX add export support for this type of stuff...
	// XXX add default named templates...
	// XXX add svg templates...
	// 		- blank (white/black/gray/...)
	// 		- title
	// 		- text
	// XXX move to 'virtual-images' feature...
	makeVirtualImage: ['Experimental/',
		function(ref, offset, metadata){
			ref = ref || 'current'
			offset = offset || 'after'	
			offset = offset == 'after' ? 
					1 
				: offset == 'before' ? 
					0
				: typeof(offset) == typeof(123) ?
					offset
				: 0
			// XXX revise...
			metadata = arguments[arguments.length-1] instanceof Object ?
				arguments[arguments.length-1]
				: null

			var data = this.data

			ref = data.getImage(ref)
			var r = data.getRibbon(ref)

			var gid = data.newGID()

			// place image into data...
			var order = data.order
			order.splice(order.indexOf(ref)+offset,0, gid)
			var ribbon = data.ribbons[r]
			ribbon.splice(ribbon.indexOf(ref)+offset,0, gid)

			// update data...
			data.updateImagePositions()

			// update metadata...
			metadata
				&& (this.images[gid] = metadata)

			// focus new image...
			// NOTE: this should update the view too...
			this.focusImage(gid)
		}],
	// XXX
	makeVirtualBlank: ['Experimental/',
		function(){
		}],
	// XXX
	makeVirtualText: ['Experimental/',
		function(){
		}],
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
