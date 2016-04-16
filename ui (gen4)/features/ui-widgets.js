/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var keyboard = require('lib/keyboard')
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

//
// Options format:
// 	{
// 		new_button: <text>|<bool>,
//
// 		length_limit: <number>,
//
// 		// check input value...
// 		check: function(value){ ... },
//
// 		// if true only unique values will be stored...
// 		// if a function this will be used to normalize the values before
// 		// uniqueness check is performed...
// 		unique: <bool>|function(value){ ... },
//
// 		// if true sort values...
// 		// if function will be used as cmp for sorting...
// 		sort: <bool> || function(a, b){ ... },
//
// 		// this is called when a new value is added via new_button but 
// 		// list length limit is reached...
// 		callback: function(selected){ ... },
//
// 		// see: itemButtons doc in browse.js for more info...
// 		itemButtons: [..]
// 	}
//
// XXX add sort buttons: up/down/top/bottom...
// XXX make this more generic...
var makeConfigListEditor = 
module.makeConfigListEditor =
function(actions, list_key, options){
	options = options || {}

	var new_button = options.new_button
	new_button = new_button === true ? 'New...' : new_button

	var _makeEditable = function(elem){
		$(elem).find('.text')
			.prop('contenteditable', true)
			.text('')
			.selectText()
			.keydown(function(){ 
				event.stopPropagation() 

				var n = keyboard.toKeyName(event.keyCode)

				// reset to original value...
				if(n == 'Esc'){
					list.update()

				// save value...
				} else if(n == 'Enter'){
					event.preventDefault()
					var txt = $(this).text()

					// invalid format...
					if(options.check && !options.check(txt)){
						list.update()
						return
					}

					// list length limit
					if(options.length_limit 
						&& (lst.length >= options.length_limit)){

						options.callback && options.callback.call(list, txt)

						return
					}

					// prevent editing non-arrays...
					if(!(actions.config[list_key] instanceof Array)){
						return
					}

					// save the new version...
					actions.config[list_key] = actions.config[list_key].slice()
					// add new value and sort list...
					actions.config[list_key]
						.push(txt)

					// unique...
					if(options.unique == null || options.unique){
						actions.config[list_key] = actions.config[list_key]
							.unique(typeof(options.unique) == typeof(function(){}) ?
								options.unique 
								: undefined)
					}

					// sort...
					if(options.sort){
						actions.config[list_key] = actions.config[list_key]
							.sort(typeof(options.sort) == typeof(function(){}) ? 
								options.sort 
								: undefined)
					}

					// update the list data...
					list.options.data 
						= actions.config[list_key]
							.concat(new_button ? [ new_button ] : [])

					// update list and select new value...
					list.update()
						.done(function(){
							list.select('"'+txt+'"')
						})
				}
			})
		return $(elem)
	}

	var to_remove = []

	var lst = actions.config[list_key]
	lst = lst instanceof Array ? lst : Object.keys(lst)

	var list = browse.makeList( null, 
		lst.concat(new_button ? [ new_button ] : []), 
		{itemButtons: options.itemButtons || [
			// mark for removal...
			['&times;', 
				function(p){
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
			// XXX add shift up/down/top/bottom and other buttons (optional)...
		]})
		// select the new_button item...
		.on('select', function(evt, elem){
			if(new_button && $(elem).find('.text').text() == new_button){
				_makeEditable(elem)
			}
		})
		.open(function(evt, path){
			// we clicked the 'New' button -- select it...
			if(new_button && (path == new_button || path == '')){
				list.select(new_button)

			} else {
				options.callback && options.callback.call(list, path)
			}
		})

	var o = overlay.Overlay(actions.ribbons.viewer, list)
		.close(function(){
			// prevent editing non-arrays...
			if(!(actions.config[list_key] instanceof Array)){
				return
			}

			// remove striked items...
			to_remove.forEach(function(e){
				var lst = actions.config[list_key].slice()
				lst.splice(lst.indexOf(e), 1)

				actions.config[list_key] = lst
			})

			// sort...
			if(options.sort){
				actions.config[list_key] = actions.config[list_key]
					.sort(options.sort !== true ? options.sort : undefined)
			}
		})
	
	new_button && list.dom.addClass('tail-action')

	return o
}


// XXX should this be more generic...
var makeNestedConfigListEditor = 
module.makeNestedConfigListEditor =
function(actions, parent, list_key, value_key, options){
	return function(){
		var txt = $(this).find('.text').first().text()

		options = options || {}
		var dfl_options = {
			new_button: 'New...',
			length_limit: 10,
			// NOTE: this is called when adding a new value and 
			// 		list maximum length is reached...
			callback: function(value){
				actions.config[value_key] = value

				o.close()
			},
		}
		options.__proto__ = dfl_options

		var o = makeConfigListEditor(actions, list_key, options) 

		// update slideshow menu...
		o.client.open(function(){
			parent.client.update()
			parent.client.select(txt)
		})

		o.close(function(){
			// XXX this is ugly...
			parent.focus()
		})

		o.client.select(actions.config[value_key])
	}
}



/*********************************************************************/

// NOTE: if the action returns an instance of overlay.Overlay this will
// 		not close right away but rather bind to:
// 			overlay.close			-> self.focus()
// 			overlay.client.open		-> self.close()
var makeActionLister = function(list, filter, pre_order){
	pre_order = typeof(filter) == typeof(true) ? filter : pre_order
	filter = typeof(filter) == typeof(true) ? null : filter

	return function(path, inline_state){
		inline_state = inline_state == null ? 
			this.config['actions-list-show-toggler-state-inline']
			: inline_state

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

			// prepare for toggler stuff...
			var isToggler = that.isToggler && that.isToggler(n) || false
			if(isToggler){
				var cur_state = that[n]('?')
				k = k +(inline_state ? (' ('+ cur_state +')') : '')
			}

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
			if(isToggler){
				var states = that[n]('??')

				// bool toggler...
				if(cur_state == 'on' || cur_state == 'off'){
					states = ['off', 'on']
				}

				states.forEach(function(state){
					actions[k +'/'+ state + (cur_state == state ? ' *': '')] =
						function(){ 
							that[n](state) 

							// XXX this works but is not yet usable...
							// 		reason: not being able to update path
							// 			components without reconstructing
							// 			the whole list...
							/*
							closingPrevented = true
							// XXX need to re-render the overlay paths...
							that.getOverlay().client
								.pop()
							*/
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

		'actions-list-show-toggler-state-inline': true,

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

var ContextActionMenu = 
module.ContextActionMenu = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-context-action-menu',
	depends: [
		'ui-browse-actions',
	],

	handlers: [
		['updateImage',
			function(){
				var that = this
				var img = this.ribbons.getImage(gid)

				!img.data('context-menu') 
					&& img
						.data('context-menu', true)
						.on('contextmenu', function(){
							event.preventDefault()
							event.stopPropagation()

							that.browseActions('/Image/')
						})
			}],
		['load',
			function(){
				var that = this
				var viewer = this.ribbons.viewer

				!viewer.data('context-menu') 
					&& viewer
						.data('context-menu', true)
						.on('contextmenu', function(){
							event.preventDefault()
							event.stopPropagation()

							that.browseActions()
						})
			}],
	],
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
			core.ImageGridFeatures.setup(b, [
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
