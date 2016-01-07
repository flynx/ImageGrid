/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var actions = require('lib/actions')
var features = require('lib/features')

var data = require('data')
var images = require('images')
var ribbons = require('ribbons')

var core = require('features/core')
var base = require('features/base')

// widgets...
var widget = require('lib/widget/widget')
var browse = require('lib/widget/browse')
var overlay = require('lib/widget/overlay')
var drawer = require('lib/widget/drawer')

var browseWalk = require('lib/widget/browse-walk')



/*********************************************************************/

// NOTE: if the action returns an instance of overlay.Overlay this will
// 		not close right away but rather bind to:
// 			overlay.close			-> self.focus()
// 			overlay.client.open		-> self.close()
var makeActionLister = function(list, filter, pre_order){
	pre_order = typeof(filter) == typeof(true) ? filter : pre_order
	filter = typeof(filter) == typeof(true) ? null : filter

	return function(path){
		var that = this
		var paths = this.getPath()
		var actions = {}
		var o

		// pre-order the main categories...
		if(pre_order){
			this.config['action-category-order'].forEach(function(k){
				actions[k] = null
			})
		}

		var closingPrevented = false

		// build the action list...
		Object.keys(paths).forEach(function(k){
			var n = paths[k][0]
			var k = filter ? filter(k, n) : k

			// XXX this expects that .client will trigger an open event...
			var waitFor = function(child){
				// we got a widget, wait for it to close...
				if(child instanceof overlay.Overlay){
					closingPrevented = true
					child
						.on('close', function(){ o.focus() })
						.client
							.on('open', function(){ o.close() })
				}
				return child
			}

			// pass args to listers...
			if(k.slice(-1) == '*'){
				actions[k] = function(){ return waitFor(a[n].apply(a, arguments)) }

			// ignore args of actions...
			} else {
				actions[k] = function(){ return waitFor(a[n]()) }
			}

			// toggler -- add state list...
			if(that.isToggler && that.isToggler(n)){
				var states = that[n]('??')
				var cur = that[n]('?')

				// bool toggler...
				if(cur == 'on' || cur == 'off'){
					states = ['off', 'on']
				}

				states.forEach(function(state){
					actions[k +'/'+ state + (cur == state ? ' *': '')] =
						function(){ 
							that[n](state) 
						}
				})
			}
		})

		var config = Object.create(that.config['browse-actions-settings'] || {})
		config.path = path

		// XXX get the correct parent...
		o = overlay.Overlay(that.ribbons.viewer, 
			list(null, actions, config)
				.open(function(evt){ 
					if(!closingPrevented){
						o.close() 
					}
					closingPrevented = false
				}))
			// save show disabled state to .config...
			.close(function(){
				var config = that.config['browse-actions-settings'] 

				config.showDisabled = o.client.options.showDisabled
			})

		// XXX DEBUG
		//window.LIST = o.client

		//return o.client
		return o
	}
}

var BrowseActionsActions = actions.Actions({
	config: {
		// NOTE: the slashes at the end are significant, of they are not
		// 		present the .toggleNonTraversableDrawing(..) will hide 
		// 		these paths before they can get any content...
		// 		XXX not sure if this is a bug or not...
		'action-category-order': [
			'File/',
			'Edit/',
			'Navigate/',
		],

		'browse-actions-settings': {
			showDisabled: false,
		},
	},

	// XXX move this to a generic modal overlay feature...
	getOverlay: ['- Interface/Get overlay object',
		function(o){
			return overlay.getOverlay(o || this.viewer)
		}],


	browseActions: ['Interface/Browse actions',
		makeActionLister(browse.makePathList, true)],
	listActions:['Interface/List actions',
		makeActionLister(browse.makeList, 
			// format the doc to: <name> (<category>, ..)
			// NOTE: this a bit naive...
			function(k){ 
				var l = k.split(/[\\\/\|]/)
				var a = l.pop()
				return a +' ('+ l.join(', ') +')'
			})],

})

var BrowseActions = 
module.BrowseActions = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-browse-actions',
	depends: [
		'ui'
	],

	actions: BrowseActionsActions,
})



//---------------------------------------------------------------------
// XXX make this not applicable to production...

var WidgetTestActions = actions.Actions({
	// XXX this is just a test...
	embededListerTest: ['Test/Lister test (embeded)/*',
		function(path, make){
			make('a/')
			make('b/')
			make('c/')
		}],
	floatingListerTest: ['Test/Lister test (floating)...',
		function(path){
			// we got an argument and can exit...
			if(path){
				console.log('PATH:', path)
				return
			}

			// load the UI...
			var that = this
			var list = function(path, make){
				
				make('a/')
				make('b/')
				make('c/')
			}

			var o = overlay.Overlay(this.ribbons.viewer, 
				browse.makePathList(null, {
					'a/*': list,
					'b/*': list,
					'c/*': list,
				})
					.open(function(evt, path){ 
						o.close() 

						that.floatingListerTest(path)
					}))

			return o
		}],
	// XXX use this.ribbons.viewer as base...
	drawerTest: ['Test/Drawer widget test',
		function(){
			// XXX use this.ribbons.viewer as base...
			drawer.Drawer($('body'), 
				$('<div>')
					.css({
						position: 'relative',
						background: 'white',
						height: '300px',
					})
					.append($('<h1>')
						.text('Drawer test...'))
					.append($('<p>')
						.text('With some text.')),
				{
					focusable: true,
				})
		}],

	// XXX needs cleanup...
	// XXX need a clean constructor strategy -- this and ui.js are a mess...
	// XXX use this.ribbons.viewer as base...
	// XXX BUG: when using this.ribbons.viewer as base some actions leak
	// 		between the two viewers...
	showTaggedInDrawer: ['- Test/Show tagged in drawer',
		function(tag){
			tag = tag || 'bookmark'
			var that = this
			var H = '200px'

			var viewer = $('<div class="viewer">')
				.css({
					height: H,
					background: 'black',
				})
			// XXX use this.ribbons.viewer as base...
			// XXX when using viewer zoom and other stuff get leaked...
			var widget = drawer.Drawer($('body'), 
				$('<div>')
					.css({
						position: 'relative',
						height: H,
					})
					.append(viewer),
				{
					focusable: true,
				})

			var data = this.data.crop(a.data.getTaggedByAll(tag), true)

			var b = actions.Actions()

			// used switch experimental actions on (set to true) or off (unset or false)...
			//a.experimental = true

			// setup actions...
			ImageGridFeatures.setup(b, [
				'viewer-testing',
			])

			// setup the viewer...
			// XXX for some reason if we load this with data and images
			// 		the images will not show up...
			b.load({
					viewer: viewer,
				})

			// load some testing data...
			// NOTE: we can (and do) load this in parts...
			b
				.load({
					data: data,
					images: this.images, 
				})
				// this is needed when loading legacy sources that do not have tags
				// synced...
				// do not do for actual data...
				//.syncTags()
				.setEmptyMsg('No images bookmarked...')
				.fitImage(1)

				// link navigation...
				.on('focusImage', function(){
					that.focusImage(this.current)
				})

			// XXX setup keyboard...
			var keyboard = require('lib/keyboard')

			// XXX move this to the .config...
			var kb = {
				'Basic Control': {
					pattern: '*',

					Home: {
						default: 'firstImage!',
					},
					End: {
						default: 'lastImage!',
					},
					Left: {
						default: 'prevImage!',
						ctrl: 'prevScreen!',
						// XXX need to prevent default on mac + browser...
						meta: 'prevScreen!',
					},
					PgUp: 'prevScreen!',
					PgDown: 'nextScreen!',
					Right: {
						default: 'nextImage!',
						ctrl: 'nextScreen!',
						// XXX need to prevent default on mac + browser...
						meta: 'nextScreen!',
					},
				}
			}

			widget.dom
				// XXX
				.keydown(
					keyboard.dropRepeatingkeys(
						keyboard.makeKeyboardHandler(
							kb,
							function(k){
								window.DEBUG && console.log(k)
							},
							b), 
						function(){ 
							return that.config['max-key-repeat-rate']
						}))

			// XXX STUB
			window.b = b

			return b
		}],
	showBookmarkedInDrawer: ['Test/Show bookmarked in drawer',
		function(){ this.showTaggedInDrawer('bookmark') }],
	showSelectedInDrawer: ['Test/Show selected in drawer',
		function(){ this.showTaggedInDrawer('selected') }],
})

var WidgetTest = 
module.WidgetTest = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-widget-test',
	depends: [
		'ui-browse-actions',
	],

	actions: WidgetTestActions,
})




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
