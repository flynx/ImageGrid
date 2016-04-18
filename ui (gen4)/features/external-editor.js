/**********************************************************************
* 
*
*
**********************************************************************/

if(typeof(process) != 'understand'){
	var pathlib = require('path')
}

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var actions = require('lib/actions')
var core = require('features/core')

var widgets = require('features/ui-widgets')

// widgets...
var browse = require('lib/widget/browse')
var overlay = require('lib/widget/overlay')

var browseWalk = require('lib/widget/browse-walk')



/*********************************************************************/
// External editor...
// XXX need to get the resulting (edited) file and add it to the index...
// XXX disable the remove button on "System default"
// XXX move the CSS out of index.html and into a correct CSS file...
var ExternalEditorActions = actions.Actions({
	config: {
		// XXX do we actually need this????
		'external-editor-default': 'System default',

		'external-editors': [
			{
				// NOTE: empty means use app name...
				title: 'System default',
				// NOTE: empty means system to select editor...
				path: '',
				// NOTE: empty is the same as '$TARGET'...
				arguments: '',
				target: '',
			},
		],

		// XXX this is not used yet...
		'external-editor-targets': [
			'Best preview',
			//'Original image',
			// XXX
		],
	},

	// XXX this still needs image type and better support for OS paths 
	// 		...irfanview for instance does not understand '/' in paths 
	// 		while windows in general have no problem...
	// XXX target is not yet used...
	openInExtenalEditor: ['Edit/Open with external editor',
		function(editor, image, type){
			editor = editor || 0
			editor = typeof(editor) == typeof('str') ?
					this.config['external-editors']
						// XXX should we use other criteria???
						.filter(function(e){ return editor == e.title })[0]
				: this.config['external-editors'][editor]

			if(editor == null){
				// XXX ERR???
				return
			}

			// XXX
			//var target = editor.target == '' ? 'Best preview' : editor.target

			// get the path part...
			//editor = editor.split(/\|/g).pop()
			editor = (editor.path != '' ? '"'+ editor.path +'" ' : '')
				+ ((editor.arguments == '' || !editor.arguments) ? '"$PATH"' : editor.arguments)

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
	// XXX empty title -- use app name without ext...
	externalEditorDialog: ['- Edit/',
		function(editor){
			var that = this

			editor = editor || 0
			editor = typeof(editor) == typeof('str') ?
					this.config['external-editors']
						// XXX should we use other criteria???
						.filter(function(e){ 
							return editor == e.title 
								|| editor == pathlib.basename(e.path) })[0]
				: this.config['external-editors'][editor]

			// XXX STUB: get the real editor...
			editor = editor || {
				// NOTE: empty means use app name...
				title: '',
				// NOTE: empty means system to select editor...
				path: '',
				// NOTE: empty is the same as '$TARGET'...
				arguments: '',
				target: '',
			}

			var editor_i = this.config['external-editors'].indexOf(editor)

			var o = overlay.Overlay(this.ribbons.viewer, 
				browse.makeLister(null, function(_, make){
					make(['Title: ', function(){ return editor.title || '' }])
						.on('open', function(){
							event.preventDefault()
							widgets.makeEditableItem(o.client, $(this),
								$(this).find('.text').last(), 
								function(_, text){ editor.title = text }) })

					make(['Path: ', function(){ return editor.path }], { 
							buttons: [
								['browse', function(p){
									var e = this.filter('"'+p+'"', false)
									var path = e.find('.text').last().text()
									var txt = e.find('.text').first().text()

									var b = overlay.Overlay(that.ribbons.viewer, 
										browseWalk.makeWalk(null, path, 
												// XXX
												'*+(exe|cmd|ps1|sh)',
												{})
											// path selected...
											.open(function(evt, path){ 
												editor.path = path

												b.close()

												o.client.update()
													.then(function(){ o.client.select(txt+path) })
											}))
											.close(function(){
												// XXX
												that.getOverlay().focus()
											})
								}]
							]
						})
						.on('open', function(){
							event.preventDefault()
							widgets.makeEditableItem(o.client, $(this),
								$(this).find('.text').last(), 
								function(_, text){ editor.path = text }) })

					make(['Arguments: ', function(){ return editor.arguments || '' }])
						.on('open', function(){
							event.preventDefault()
							widgets.makeEditableItem(o.client, $(this),
								$(this).find('.text').last(), 
								function(_, text){ editor.arguments = text }) })

					make(['Target: ', 
							function(){ 
								return editor.target 
									|| that.config['external-editor-targets'][0] }])
						.on('open', 
							widgets.makeNestedConfigListEditor(that, o,
								'external-editor-targets',
								function(val){ 
									if(val == null){
										return editor.target
											|| that.config['external-editor-targets'][0]

									} else {
										editor.target = val 
											|| that.config['external-editor-targets'][0]
									}
								},
								{
									new_button: false,
									itemButtons: [],
								}))

					make(['Save'])
						.on('open', function(){
							var editors = that.config['external-editors']

							// updated editor...
							if(editor_i >= 0){
								that.config['external-editors'] = editors.slice()

							// new editor...
							} else {
								that.config['external-editors'] = editors.concat([editor])
							}

							o.close()
						})
				}))

			o.client.dom.addClass('metadata-view tail-action')

			return o
		}],
	// XXX need to support $TARGET in args...
	// 		...append if not present...
	listExtenalEditors: ['Edit/List external editors',
		function(){
			var that = this
			var closingPrevented = false
			var editors = this.config['external-editors'] || []

			// element index...
			var _getEditor = function(str){
				return editors
					.map(function(e){ return e.title || pathlib.basename(e.path) })
					.indexOf(str)
			}

			var to_remove = []

			// build the dialog...
			var o = overlay.Overlay(this.ribbons.viewer, 
				//browse.makeList(null, list, {
				browse.makeLister(null, 
					function(_, make){
						editors
							.forEach(function(e, i){
								make([function(){ return e.title || pathlib.basename(e.path)}])
									.on('open', function(){
										that.openInExtenalEditor(i)
									})
							})

						make(['Add new editor...'])
							.on('open', function(){
								closingPrevented = true
								var b = overlay.Overlay(that.ribbons.viewer, 
									browseWalk.makeWalk(
											null, '/', 
											// XXX
											'*+(exe|cmd|ps1|sh)',
											{})
										// path selected...
										.open(function(evt, path){ 
											// add a pretty name...
											editors.push({
												path: path,
											})
											that.config['external-editors'] = editors

											// is this the correct way to do this???
											b.close()
											o.client.update()//.close()
											//that.listExtenalEditors()
										}))
										.close(function(){
											o.focus()
										})
								return b
							})
					}, 
					{
						// add item buttons...
						itemButtons: [
							// edit...
							['edit', 
								function(p){
									that.externalEditorDialog(p)
										.close(function(){
											o.client.update()
										})
								}],
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
			o.client.dom.addClass('editor-list tail-action')

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
