/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var actions = require('lib/actions')
var core = require('features/core')

// widgets...
var browse = require('lib/widget/browse')
var overlay = require('lib/widget/overlay')

var browseWalk = require('lib/widget/browse-walk')



/*********************************************************************/
// External editor...
// XXX need to get the resulting (edited) file and add it to the index...
// XXX make a UI for adding new editors:
// 		- enter path / browse (done)
// 		- pretty name
// 		- shortcut key
// 		- image type to open
// XXX add root button...
// XXX disable the remove button on "System default"
// XXX move the CSS out of index.html and into a correct CSS file...
// XXX move this to a separate feature...

var ExternalEditorActions = actions.Actions({
	config: {
		'external-editor-default': 'System default',
		// XXX
		'external-editors': [
			// XXX system default might be different on different systems...
			['System default|"$PATH"'],

			// XXX for some reason irfanview doesnot open a path passed 
			// 		as argument unless it uses only '\' and not '/'
			['IrfanView|"C:/Program Files (x86)/IrfanView/i_view32.exe" "$PATH"'],
		],
	},

	// XXX this still needs image type and better support for OS paths 
	// 		...irfanview for instance does not understand '/' in paths 
	// 		while windows in general have no problem...
	openInExtenalEditor: ['Edit/Open with external editor',
		function(editor, image, type){
			editor = typeof(editor) == typeof('str') ? editor 
				: this.config['external-editors'][editor == null ? 0 : editor]
			editor = editor ? editor[0] : '$PATH'

			// get the path part...
			editor = editor.split(/\|/g).pop()

			// get the image...
			var img = this.images[this.data.getImage(image)]

			if(img == null){
				return
			}

			// XXX get the correct type -- raw, preview, orig, ...

			var full_path = img.base_path +'/'+ img.path

			// XXX is this portable enough???
			var path = requirejs('path')
			full_path = path.normalize(full_path)

			editor = editor
				// XXX make '$' quotable....
				.replace(/\$PATH/, full_path)
				// XXX add other stuff???
				
			// do the actual running...
			requirejs('child_process')
				.exec(editor, function(err, res){
					err && console.log('!!!', err)
				})
		}],
})

var ExternalEditor = 
module.ExternalEditor = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'external-editor',
	depends: [
		'base',
	],
	suggested: [
		'ui-external-editor',
	],

	isApplicable: function(){ 
		return this.runtime == 'nw' || this.runtime == 'node' },

	actions: ExternalEditorActions,
})


//---------------------------------------------------------------------

var ExternalEditorUIActions = actions.Actions({
	listExtenalEditors: ['Edit/List external editors',
		function(){
			var that = this

			// build the list...
			var list = {}
			var editors = this.config['external-editors'].slice()
			editors
				.forEach(function(e, i){
					list[e[0].split(/\|/g)[0]] = function(){
						that.openInExtenalEditor(i)
					}
				})

			var closingPrevented = false

			// XXX STUB: use a top button...
			// XXX update the list...
			list['Add new editor...'] = function(){
				closingPrevented = true
				// XXX open 'new editor...' dialog...
				var b = overlay.Overlay(that.ribbons.viewer, 
					browseWalk.makeWalk(
							null, '/', 
							// XXX
							'*+(exe|cmd|ps1|sh)',
							{})
						// path selected...
						.open(function(evt, path){ 
							// XXX
							//this.parent.close()

							// add a pretty name...
							editors.push([path+'|"'+ path +'" "$PATH"'])
							that.config['external-editors'] = editors

							// XXX update the editor list...

							// is this the correct way to do this???
							b.close()
							o.close()
							that.listExtenalEditors()
						}))
						.close(function(){
							o.focus()
						})
				return b
			}

			// element index...
			var _getEditor = function(str){
				return editors
					.map(function(e){ return e[0].split(/\|/g)[0] })
					.indexOf(str)
			}

			var to_remove = []

			// build the dialog...
			var o = overlay.Overlay(this.ribbons.viewer, 
				browse.makeList(null, list, {
						// add item buttons...
						itemButtons: [
							// move to top...
							['&diams;', 
								function(p){
									var target = this.filter(0, false)
									var cur = this.filter('"'+p+'"', false)

									var i = _getEditor(p) 

									if(!target.is(cur)){
										target.before(cur)
										editors.splice(0, 0, editors.splice(i, 1)[0])

										that.config['external-editors'] = editors
									}
								}],
							// set secondary editor...
							// XXX make a simpler icon....
							['<span style="letter-spacing: -4px; margin-left: -4px;">&diams;&diams;</span>', 
								function(p){
									var target = this.filter(1, false)
									var cur = this.filter('"'+p+'"', false)

									var i = _getEditor(p) 

									if(!target.is(cur)){
										if(target.prev().is(cur)){
											target.after(cur)
										} else {
											target.before(cur)
										}
										editors.splice(1, 0, editors.splice(i, 1)[0])

										that.config['external-editors'] = editors
									}
								}],
							// mark for removal...
							['&times;', 
								function(p){
									if(p == that.config['external-editor-default']){
										return
									}

									var e = this.filter('"'+p+'"', false)
										.toggleClass('strike-out')

									if(e.hasClass('strike-out')){
										to_remove.indexOf(p) < 0 
											&& to_remove.push(p)

									} else {
										var i = to_remove.indexOf(p)
										if(i >= 0){
											to_remove.splice(i, 1)
										}
									}
								}],
						] })
					.open(function(evt){ 
						// close self if no dialog is triggered...
						if(!closingPrevented){
							o.close() 
						}
						closingPrevented = false
					}))
				.close(function(){
					// remove elements marked for removal...
					to_remove.forEach(function(e){
						if(e == that.config['external-editor-default']){
							return
						}

						editors.splice(_getEditor(e), 1)
						that.config['external-editors'] = editors
					})
				})

			o.client.select(0)
			o.client.dom.addClass('editor-list')

			return o
		}],
})

var ExternalEditorUI = 
module.ExternalEditorUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-external-editor',
	depends: [
		'ui',
		'external-editor',
	],

	actions: ExternalEditorUIActions,
})




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
