/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var keyboard = require('lib/keyboard')
var toggler = require('lib/toggler')
var actions = require('lib/actions')
var features = require('lib/features')

var data = require('imagegrid/data')
var images = require('imagegrid/images')
var ribbons = require('imagegrid/ribbons')

var core = require('features/core')
var base = require('features/base')

var widget = require('lib/widget/widget')
var browse = require('lib/widget/browse')
var overlay = require('lib/widget/overlay')
var drawer = require('lib/widget/drawer')

var browseWalk = require('lib/widget/browse-walk')



/*********************************************************************/

// Format:
// 	{
// 		<button-text>: [
// 			<class>, // optional
// 			<info>, // optional
// 			<code>,
// 		],
//
// 		<button-text>: [
// 			<class>, // optional
// 			<info>, // optional
// 			[
// 				// primary action (click / tap)...
// 				<primary>,
// 				// secondary action (contextmenu -- right-clock / long-tap)...
// 				<secondary>,
// 			]
// 		],
// 		...
// 	}
var makeButtonControls =
module.makeButtonControls =
function(context, cls, data){
	cls = cls instanceof Array ? cls : cls.split(/\s+/g)

	// remove old versions...
	context.dom.find('.'+ cls.join('.')).remove()

	// make container...
	var controls = $('<div>')
		.addClass('buttons '+ cls.join('.'))
		.on('mouseover', function(){
			var t = $(event.target)

			var info = t.attr('info') || t.parents('[info]').attr('info') || ''

			context.showStatusBarInfo
				&& context.showStatusBarInfo(info)
		})
		.on('mouseout', function(){
			context.showStatusBarInfo
				&& context.showStatusBarInfo()
		})

	// make buttons...
	Object.keys(data).forEach(function(k){
		// spacer...
		if(typeof(data[k]) == typeof('str') 
				&& /--+/.test(data[k])){
			k = '&nbsp;'
			var cls = 'spacer'
			var doc = ''
			var click = function(){}
			var menu = function(){}

		// normal element...
		} else {
			var e = data[k].slice()
			var primary = e.pop()
			primary = primary instanceof Array ? primary.slice() : primary
			var secondary = (primary instanceof Array && primary.length > 1) ? 
				primary.pop() 
				: null
			secondary = typeof(secondary) == typeof('str') ?
				keyboard.parseActionCall(secondary, context) 
				: secondary
			primary = primary instanceof Array ? primary.shift() : primary
			primary = typeof(primary) == typeof('str') ?
				keyboard.parseActionCall(primary, context) 
				: primary

			var click = primary instanceof Function ? 
				primary 
				: function(evt){ 
					evt.stopPropagation()
					evt.preventDefault()
					context[primary.action].apply(context, primary.arguments) }
			var menu = secondary instanceof Function ?
					secondary
				: secondary ? 
					function(evt){ 
						evt.stopPropagation()
						evt.preventDefault()
						context[secondary.action].apply(context, secondary.arguments) }
				: click

			var cls = e[0] 
				|| primary.action 
				|| '' 
			var doc = e[1] 
				|| (primary.doc 
					+ (secondary ? ' / '+ secondary.doc : ''))
				|| e[0] 
				|| ''
		}

		controls
			.append($('<div>')
				.addClass('button ' + cls)
				.html(k)
				.attr('info', doc)
				.click('click', function(){
					context.showStatusBarInfo
						&& context.showStatusBarInfo()
				})
				.click(click)
				.on('contextmenu', menu))
	})

	controls
		.appendTo(context.dom)
}

// XXX write docs:
// 		- cls can be 
// 			- a single class (str)
// 			- space separated multiple classes (str)
// 			- list of classes
// 		- if cfg is not given then cls[0] is used for it
// 		- parent can be an element, a getter function or null (defaults to viewer)
var makeButtonControlsToggler =
module.makeButtonControlsToggler =
function(cls, cfg, parent){
	cls = cls instanceof Array ? cls : cls.split(/\s+/g)
	cfg = cfg || cls[0]

	return toggler.Toggler(null,
		function(){ 
			parent = parent == null ? this.dom
				: parent instanceof Function ? parent.call(this) 
				: parent
			return parent.find('.'+ cls.join('.')).length > 0 ? 'on' : 'off' 
		},
		['off', 'on'],
		function(state){
			if(state == 'on'){
				var config = this.config[cfg]

				config 
					&& makeButtonControls(this, cls, config)

			} else {
				this.dom.find('.'+ cls.join('.')).remove()
			}
		})
}



// XXX make the selector more accurate...
// 		...at this point this will select the first elem with text which
// 		can be a different elem...
var editItem =
module.editItem =
function(list, elem, callback, options){
	return elem
		.makeEditable(options 
			|| {
				activate: true,
				clear_on_edit: true,
				blur_on_abort: false,
				blur_on_commit: false,
			})
		.on('edit-commit', callback || function(){})
		.on('edit-abort edit-commit', function(_, text){
			list.update()
				// XXX make the selector more accurate...
				// 		...at this point this will select the first elem
				// 		with text which can be a different elem...
				.then(function(){ list.select(elem.text()) })
		})
}



//---------------------------------------------------------------------

// Edit list in .config...
//
// This will update value_path in .config with the opened item value.
// 
var makeConfigListEditor = 
module.makeConfigListEditor =
function(actions, path, value_path, options, setup){
	path = path.split('.')
	var key = path.pop()

	options = options ? Object.create(options) : {}

	var stateValue = function(value){
		var path = value_path instanceof Function ?
			value_path(value)
			: value_path.split('.')

		var key = path.pop()

		var target = actions.config
		path.forEach(function(p){
			target = target[p] = target[p] || {}
		})

		if(value){
			target[key] = value

		} else {
			return target[key]
		}
	}
	var save = function(value){
		stateValue(value)
		dialog.close()
	}

	if(value_path 
			&& (options.overflow == null 
				|| options.overflow == 'save')){
		options.overflow = save
	}

	// set the path...
	if(value_path && !options.path){
		options.path = stateValue()
	}

	var dialog = browse.makeListEditor(function(lst){
			var target = actions.config
			path.forEach(function(p){
				target = target[p] = target[p] || {}
			})

			// get...
			if(lst === undefined){
				return target[key]

			// set...
			} else {
				target[key] = lst
			}
		}, options)


	value_path
		&& dialog.open(function(){
			save(dialog.selected)
		})

	setup
		&& setup.call(dialog, dialog)

	return dialog
}


// Wrapper around makeListEditor(..) enabling it to be used as an event
// item handler...
//
// For example this returns a function directly usable as list item event
// handler...
//
// NOTE: this will select the element in the parent dialog via it's first 
// 		.text element...
var makeNestedConfigListEditor = 
module.makeNestedConfigListEditor =
function(actions, list, list_key, value_key, options, setup){
	options = options || {}

	return function(){
		var txt = $(this).find('.text').first().text()

		var dfl_options = {
			path: value_key instanceof Function ?
				value_key()
				: actions.config[value_key],
			// NOTE: this is called when adding a new value and 
			// 		list maximum length is reached...
			overflow: 'save', 
		}
		options.__proto__ = dfl_options

		var o = makeConfigListEditor(actions, list_key, value_key, options, setup)
			// update parent menu...
			.open(function(){
				list 
					&& list.update()
						.then(function(){ 
							txt != ''
								&& list.select(txt) 
						})
			})

		actions.Overlay(o)

		return o
	}
}



/*********************************************************************/
// Dialogs and containers...

// Mark an action as a container...
//
// NOTE: the marked action must comply with the container protocol
// 		(see: makeUIContainer(..) for more info)
var uiContainer =
module.uiContainer = function(func){
	func.__container__ = true
	return func
}

// Make a container constructor wrapper...
//
// This will:
// 	- mark the action as a container
//
// The container will:
// 	- trigger the client's close event on close
//
// XXX not sure how the click is handled here...
// XXX pass options???
var makeUIContainer =
module.makeUIContainer = function(make){
	return uiContainer(function(){
		var that = this
		var o = make.apply(this, arguments)

		o
			// notify the client that we are closing...
			.close(function(evt, mode){ o.client.trigger('close', mode) })
			.client
				// NOTE: strictly this is the responsibility of the client
				// 		but it is less error prone to just in case also do
				// 		this here...
				.on('close', function(evt){ 
					evt.stopPropagation() 
					that.modal ? 
						that.modal.focus()
						// NOTE: this fixes a bug where the UI loses focus
						// 		and keys are no longer tracked...
						// 		XXX is this the right way to go???
						// 			To reproduce:
						// 			- comment this line and .focus() in return...
						// 			- alt-F
						// 			- /load	-> serach
						// 			- Enter	-> loads demo data but the viewer
						// 						is in a state where the window
						// 						is in focus but keys are not 
						// 						tracked...
						: that.dom.focus()
				})
				// Compensate for click focusing the parent dialog when
				// a child is created...
				// XXX is this the right way to go???
				.on('click', function(evt){ 
					that.modal && that.modal.focus() })

		return o
			// focus the new dialog...
			// NOTE: fixes the same bug as .client.on('close', ...) above, 
			// 		see note for that...
			.focus()
	})
}


// Mark action as a dialog...
//
var uiDialog =
module.uiDialog = function(func){
	func.__dialog__ = true
	return func
}

// Make a dialog constructor wrapper...
//
// 	Make a dialog action...
// 	 makeUIDialog(constructor)
// 	 makeUIDialog(constructor, ...)
// 		-> dialog
//
//	Make a dialog action with a specific default container...
// 	 makeUIDialog(container, constructor)
// 	 makeUIDialog(container, constructor, ...)
// 		-> dialog
//
//
// This dialog will:
// 	- consume the first action argument if it's a container name to 
// 		override the default container...
// 	- if no container defined explicitly the default container is used
//
//
// NOTE: arguments after the constructor will be passed to the container.
//
// XXX do we need a means to reuse containers, e.g. ??? 
// XXX need to revise this API as passing a container title ONLY works
// 		for actions explicitly created with makeUIDialog(..) and not 
// 		extended/overloaded...
var makeUIDialog =
module.makeUIDialog = function(a, b){
	var args = [].slice.call(arguments)

	// container name (optional)...
	var dfl = typeof(args[0]) == typeof('str') ?
			args.shift()
			: null
	// constructor...
	var make = args.shift()
	// rest of the args to be passed to the container...
	var cargs = args

	return uiDialog(function(){
		var args = [].slice.call(arguments)

		// see if the first arg is a container spec...
		var container = !(args[0] instanceof Array) && this.isUIContainer(args[0]) ?
			args.shift()
			: (dfl || this.config['ui-default-container'] || 'Overlay')

		var dialog = make.apply(this, args)

		if(!dialog){
			return dialog
		}

		return this[container].apply(this, 
				[dialog].concat(cargs))
			.client
	})
}

var makeDrawer = function(direction){
	return makeUIContainer(function(dialog, options){
		var that = this
		options = options || {}
		var parent = options.parentElement 
		parent = parent ? $(parent) : this.dom 

		options.direction = direction || 'bottom'

		var d = drawer.Drawer(parent, dialog, options)
			// focus top modal on exit...
			.on('close', function(){
				var o = that.modal
				o && o.focus()	
			})

		// we need to clear other ui elements, like the status bar...
		// XXX is this the right way to go???
		d.dom.css({
			'z-index': 5000,
		})

		return d
	})
}



//---------------------------------------------------------------------
// Higher level dialog action constructors...

// Make list editor dialog...
// 
// 	makeListEditorDialog(list[, options])
// 		-> action
// 
// 	makeListEditorDialog(function[, options])
// 		-> action
// 
// 
// Example:
// 	someAction: [
// 		makeListEditorDialog(
// 			// list of items to edit or list getter function...
// 			// NOTE: this is edited in place...
// 			[ 'item', .. ] | function(){ .. }, 
// 			// options compatible with browse's Items.EditableList(..)
// 			{ .. })],
// 			
// XXX should these replace the makeConfigListEditor/makeNestedConfigListEditor???
var makeListEditorDialog =
module.makeListEditorDialog =
function makeListEditorDialog(list, options){
	options = options || {}

	return makeUIDialog(function(){
		var lst = list instanceof Function ?
			list.call(this)
			: list

		// NOTE: this will edit the list in place...
		return browse.makeLister(null, 
			function(_, make){
				make.EditableList(lst, options)
			}, {
				cls: options.cls,
			})
	})
}

// Make .config list editor dialog...
// 
// 	makeConfigListEditorDialog(path[, options])
// 		-> action
// 		
// 
// Example:
// 	someAction: [
// 		makeConfigListEditorDialog(
// 			// path to list in .config
// 			'path.to.list',
// 			// options compatible with browse's Items.EditableList(..)
// 			{ .. })],
// 			
// NOTE: see collections.editDefaultCollections(..) for a live example.
var makeConfigListEditorDialog =
module.makeConfigListEditorDialog =
function makeConfigListEditorDialog(path, options){
	path = path.split('.')
	var key = path.pop()

	return makeListEditorDialog(function(){
		var p = path.slice()

		// get the path...
		var cur = this.config
		while(p.length > 0){
			var k = p.shift()
			cur = cur[k] = cur[k] || {}
		}

		// the actual list we'll be editing...
		var list = 
			cur[key] = 
			(cur[key] || []).slice()

		return list
	}, options)
}



//---------------------------------------------------------------------
	
var DialogsActions = actions.Actions({
	config: {
		'ui-default-container': 'Overlay',

		'ui-overlay-blur': 'on',

		// used by UI to set the user confirm action timeout...
		'ui-confirm-timeout': 2000,
	},

	// introspection...
	get uiContainers(){ 
		return this.cache('uiContainers', function(d){
			return d instanceof Array ? 
				d.slice() 
				: this.actions.filter(this.isUIContainer.bind(this)) }) },
	get uiDialogs(){
		return this.cache('uiDialogs', function(d){
			return d instanceof Array ? 
				d.slice() 
				: this.actions.filter(this.isUIDialog.bind(this)) }) },
	get uiElements(){ 
		return this.cache('uiElements', function(d){
			return d instanceof Array ? 
				d.slice() 
				: this.actions.filter(this.isUIElement.bind(this)) }) },

	// XXX this knows about action priority and shortcut marker...
	// XXX should these be more like .getDoc(..) and support lists of actions???
	// XXX should these be here or someplace in base (base-introspection)???
	getDocPath: ['- Interface/',
		function(action, clean, join){
			clean = clean == null ? true : clean
			join = join == null ? '/' : join
			var path = (this.getDoc(action)[action].shift() || action)
			path = clean ? path.replace(/^- /, '') : path
			path = path
				.split(/[\\\/]/g)
				// remove priority...
				.map(function(e){
					return clean ? 
						e
							.replace(/^[-+]?[0-9]+:\s*/, '')
							.replace(/\$(\w)/g, '$1')
						: e })
			return join ? path.join('/') : path
		}],
	getDocBaseDir: ['- Interface/',
		function(action, clean, join){
			clean = clean == null ? true : clean
			join = join == null ? '/' : join
			var path = this.getDocPath(action, clean, false)
				// drop the title...
				.slice(0, -1)
			return join ? path.join('/') : path
		}],
	getDocTitle: ['- Interface/',
		function(action, clean){
			clean = clean == null ? true : clean
		   	return this.getDocPath(action, clean, false).pop() 
		}],

	// Get modal container...
	//
	// Protocol:
	// 	- get the last (top) modal widgets (CSS selector: .modal-widget)
	// 	- return one of the following:
	// 		.data('widget-controller')
	// 		element
	// 		null
	get modal(){
		var modal = this.dom
			.find('.modal-widget')
				.last()
		return modal.data('widget-controller') 
			|| (modal.length > 0 && modal) 
			|| null
	},

	// testers...
	//
	// ui elements...
	isUIContainer: function(action){
		return !!this.getActionAttr(action, '__container__') },
	isUIDialog: function(action){
		return !!this.getActionAttr(action, '__dialog__') },
	isUIElement: function(action){ 
		return this.isUIDialog(action) || this.isUIContainer(action) },
	// extended ui elements
	// ...first defined as a non-ui action and extended to a ui element.
	isUIExtendedContainer: 
		actions.doWithRootAction(function(action, name){
			return action != null
				&& !action.__container__
				&& this.isUIContainer(name) }),
	isUIExtendedDialog:
		actions.doWithRootAction(function(action, name){
			return action != null 
				&& !action.__dialog__
	   			&& this.isUIDialog(name) }),
	isUIExtendedElement:
		actions.doWithRootAction(function(action, name){
			return action != null 
				&& !action.__dialog__ 
				&& !action.__container__
				&& this.isUIElement(name) }),


	// container constructors...
	Overlay: ['- Interface/',
		makeUIContainer(function(dialog, options){
			var that = this
			return overlay.Overlay(this.dom, dialog, options)
				// focus top modal on exit...
				.on('close', function(){
					var o = that.modal
					o && o.focus()	
				})
		})],
	Drawer: ['- Interface/',
		makeDrawer('bottom')],
	BottomDrawer: ['- Interface/',
		makeDrawer('bottom')],
	TopDrawer: ['- Interface/',
		makeDrawer('top')],
	// like panel but drop down from mouse location or specified position
	DropDown: ['- Interface/',
		makeUIContainer(function(dialog, options){
			// XXX
			console.error('Not yet implemented.')
		})],
	// XXX STUB -- need a real panel with real docking and closing 
	// 		ability... 
	// XXX need to:
	// 		- dock panels
	// 		- save panel state (position, collapse, dock, ...)
	// 		- restore panel state
	Panel: ['- Interface/',
		makeUIContainer(function(dialog, options){
			// XXX
			//console.error('Not yet implemented.')

			// minimal container...
			var panel = {
				client: dialog,
				dom: $('<div>')
					.append(dialog.dom || dialog)
					.appendTo(this.dom)
					.draggable(),
				close: function(func){
					if(func instanceof Function){
						this.dom.on('close', func)
					} else {
						this.dom.trigger('close', 'reject')
						this.dom.remove()
					}
					return this
				},
				focus: function(){
				},
			}

			dialog.on('blur', function(){
				panel.close('reject')
			})

			return panel
		})],


	// Helper for creating lists fast...
	showList: ['- Interface/', 
		core.doc`Show list dialog...

			.showList(<list>, <options>)
				-> dialog

		See browse.makeList(..) / browse.Items.List(..) for more info.
		`,
		makeUIDialog(function(list, options){
			return browse.makeList(null, list, options) })],
	// XXX do we need to split the options???
	showEditableList: ['- Interface/', 
		core.doc`Show editable list dialog...

			.showEditableList(<list>, <options>)
				-> dialog

		See browse.Items.EditableList(..) for more info.

		NOTE: this passes the same options to the list item and the 
			dielog.
			XXX this may change in the future...
		`,
		makeUIDialog(function(list, options){
			options = Object.create(options || {})

			// defaults...
			options.sortable = options.sortable === undefined ? 
				true 
				: options.sortable

			return browse.makeLister(null, 
				function(path, make){
					make.EditableList(list, options)
				}, 
				options) })],
	showActionList: ['- Interface/', 
		core.doc`Show list of actions dialog...

			.showActionList(<list>, <options>)
				-> dialog

		Like .showList(..) but understands keyboard.parseActionCall(..) syntax,

		Options format:
			{
				// arguments and what to replace them with, this is used
				// to define templates in the list and pass real values 
				// via the dict.
				args_dict: {
					<arg>: <value>,
					...
				},

				// Same format .showList(..) understands...
				...
			}
		
		`,
		makeUIDialog(function(list, options){
			var that = this
			list = list instanceof Function ? list.call(this) : list
			options = options || {}
			var args_dict = options.args_dict || {}

			var loaders = {}

			list.forEach(function(m){
				var a = keyboard.parseActionCall(m, that)

				if(a.action in that){
					var args = a.arguments
						.map(function(a){ 
							return args_dict[a] !== undefined ? 
								args_dict[a] 
								: a })

					// the callback...
					loaders[a.doc != '' ? 
							a.doc 
							: that.getDocTitle(a.action)] =
						function(){
							return that[a.action].apply(that, args) }

				// non-actions...
				} else {
					loaders[m] = null
				}
			})

			return browse.makeList(null, loaders, options)
		})],


	listDialogs: ['Interface/Dialog/Dialog list...',
		makeUIDialog(function(){
			var actions = this

			return browse.makeLister(null, function(path, make){
				var that = this

				actions.uiDialogs.forEach(function(dialog){
					var doc = actions.getDoc(dialog)[dialog][0]
					var txt = ((doc
							.split(/[\\\/]/g)
							.pop() || ('.'+ dialog +'(..)'))
								// mark item as disabled...
								+ (/^- .*$/.test(doc) ? ' (disabled)' : ''))
						.replace(/^-?[0-9]+\s*:\s*/, '')
						.trim()
					make(txt == '*' ? `${dialog} (${txt})` : txt)
						.on('open', function(){
							actions[dialog]()
						})
				})

				make.done()
			})
		})],

	toggleOverlayBlur: ['Interface/Dialog overlay blur',
		toggler.CSSClassToggler(
			function(){ return this.dom }, 
			'overlay-blur-enabled',
			function(state){ this.config['ui-overlay-blur'] = state }) ],
})

var Dialogs = 
module.Dialogs = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-dialogs',
	depends: [
		'cache',
		'ui',
	],

	actions: DialogsActions,

	handlers: [
		['start',
			function(){
				this.config['ui-overlay-blur']
					&& this.toggleOverlayBlur(this.config['ui-overlay-blur'])
			}],
		['__call__', 
			function(res, action){
				//if(res instanceof jQuery || res instanceof widget.Widget){
				//	var elem = (res.dom || res)
				if(res instanceof widget.Widget){
					var elem = res.dom

					var title = this.getActionAttr(action, 'dialogTitle')

					title ?
						elem.attr('dialog-title', title)
						: !elem.attr('keep-dialog-title') 
							&& !this.getActionAttr(action, 'keepDialogTitle')
							&& elem.attr('dialog-title', this.getDocTitle(action))
				}
			}],
	],
})



/*********************************************************************/

// XXX do not use the global ig for link click handling...
var action2lnk =
module.action2lnk =
function(action){
   return `<a href="#" onclick="ig.showDoc('${action}')">${action}</a>` }

// XXX do not use the global ig for link click handling...
var feature2lnk =
module.feature2lnk =
function(tag){
   return `<a href="#" onclick="ig.showFeatureDoc('${tag}')">${tag}</a>` }

// XXX needs more cleanup...
var features2lnk =
module.features2lnk =
function(features, text){
	features = new RegExp(
			'(\\s)('
			+(features
				.sort(function(a, b){ return b.length - a.length })
				.join('|'))
			+')([,\\s]?)', 
		'g')
	return text
		.replace(features, function(match, a, b, c){
			return a + feature2lnk(b) + c
		})
}

var js2html =
module.js2html =
function(doc, skip_linking){
	skip_linking = skip_linking || []
	return doc
		// html stuff...
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		// normalize tabs -- convert tabs and tabbed 
		// spaces into 4 spaces...
		// NOTE: the code internally uses only tabs, 
		// 		but this will help make the view 
		// 		consistent.
		.replace(/ {0,3}\t/g, '    ')
		// comments...
		.replace(/(\/\/.*)\n/g, '<span class="comment">$1</span>\n')
		// notes...
		.replace(/NOTE:/g, '<b>NOTE:</b>')
		.replace(/XXX/g, '<span class="warning">XXX</span>')
}
	
// XXX do not use the global ig for link click handling...
var doc2html =
module.doc2html =
function(doc, skip_linking){
	skip_linking = skip_linking || []
	return js2html(doc)
		// action links...
		.replace(/(\s)(\.([\w_]+[\w\d_]*)\([^)]*\))/g, 
			function(match, a, b, c){
				return (skip_linking == '*' || skip_linking.indexOf(c) >= 0) ?
					`${a}<i>${b}</i>`
					: `${a}<a href="#" onclick="ig.showDoc('${c}')">${b}</a>`
			})
}


var UIIntrospectionActions = actions.Actions({
	// Show doc for action...
	//
	// XXX STUB...
	// XXX handle non-action methods...
	// XXX this needs to:
	// 		- be a widget
	// 		- handle focus
	// 		- handle keyboard
	// 		- handle search...
	// 		- format action links/references...
	// 		- markdown???
	// 		- ...
	// XXX use pWiki???
	// XXX should we have navigation???
	// 		...i.e. opening links is done in the viewer and we have 
	// 		ability to go back and forth...
	// XXX might be a good idea to also show feature doc...
	showDoc: ['Help/Action help...',
		makeUIDialog(function(actions){
			var that = this
			actions = actions || this.actions.sort()
			actions = actions instanceof Array ? actions : [actions]

			var doc = this.getDoc(actions)

			var res = $('<div>')
				.addClass('help-dialog')

			actions.forEach(function(action){
				var toggler = that.isToggler(action)
				res.append($('<div class="action doc">')
					.prop('tabindex', true)
					.append($('<h2>')
						.text(doc[action][2]))
					.append($('<i>')
						.text(doc[action][0]))
					.append($('<div>')
						.html(
							// features...
							'Features: ' + that.getHandlerSourceTags(action)
								.map(feature2lnk)
								.join(', ')
							// toggler states...
							+ (toggler ? 
								('<br>Toggler states: '+ that[action]('??').join(', '))
								: '')))
					.append($('<hr>'))
					// parse the action doc...
					.append($('<pre>')
						.html(doc2html(doc[action][1] || '', [action]))) 
					// NOTE: we are quoting action in an array here to prevent
					// 		dialog actions from messing up the call...
					.append($(`<a href="#" onclick="ig.showCode(['${action}'])">code...</a>`)) )
			})

			return res
		})],
	// XXX make hypertext...
	showCode: ['- Help/Show action code...',
		makeUIDialog(function(action){
			action = action instanceof Array ? action[0] : action
			var features = this.features.FeatureSet.features 
					|| this.features.features 
					|| []
			return $('<div>')
				.addClass('help-dialog')
				.append($('<div class="action">')
					.append($('<pre>')
						//.text(this.getHandlerDocStr(action))) )
						.html(features2lnk(features, js2html(this.getHandlerDocStr(action))))) ) 
		})],
	showFeatureDoc: ['Help/Feature help...',
		makeUIDialog(function(features){
			features = features || this.features.features
			features = features == '*' ? this.features.FeatureSet.features
				: features instanceof Array ? features
				: [features]

			var that = this
			var featureset = this.features.FeatureSet
			var res = $('<div>')
				.addClass('help-dialog')

			var tag2lnk = function(tag){
				return tag != '-'? feature2lnk(tag) : '-' }

			features.forEach(function(tag){
				var feature = featureset[tag.startsWith('-') ? tag.slice(1) : tag]

				// skip unknown tags...
				if(feature == null){
					return
				}

				var exclusive = feature.exclusive
				exclusive = exclusive 
					&& (exclusive instanceof Array ? 
						exclusive 
						: [exclusive])

				res.append($('<div class="feature">')
					.prop('tabindex', true)
					.append($('<h2>')
						.text(feature.title || tag))
					.append($('<i>')
						.html(that.features.features.indexOf(tag) < 0 ? 
								'not loaded' 
								: 'loaded')) 
					.append($('<div>')
						.html('Tag: '+ tag2lnk(tag) )) 

					.append($('<div>')
						.html('Priority: '+ (feature.getPriority ? 
							feature.getPriority(true)
							: (feature.priority || 'normal') )))
					// list exclusive features...
					.append($('<div>')
						.html('Exclusive tag: ' 
							+ (exclusive || ['-'])
								.map(function(tag){
									if(tag == '-'){
										return tag
									}
									var tags = featureset.getExclusive(tag)[tag].join('\', \'')
									return `<a href="#" onclick="ig.showFeatureDoc(['${tags}'])">${tag}</a>`
								})
								.join(', ')))
					.append($('<div>')
						.html('Depends: ' 
							+ (feature.depends || ['-'])
								.map(tag2lnk)
								.join(', ')))
					.append($('<div>')
						.html('Suggests: ' 
							+ (feature.suggested || ['-'])
								.map(tag2lnk)
								.join(', ')))

					// list actions, props and handlers...
					.append($('<hr>'))
					.append($('<div>')
						.html('Props: <i>not implemented</i>'))
					.append($('<div>')
						.html('Actions: ' 
							+ Object.keys(feature.actions || {'-': null})
								.filter(function(n){ 
									return n == '-' 
										|| (Object.getOwnPropertyDescriptor(feature.actions, n) || {}).value instanceof actions.Action })
								.map(function(n){
									return n == '-' ? n : action2lnk(n) })
								.join(', ')))
					.append($('<div>')
						.html('Handlers: '
							+ (feature.handlers || [['-']])
								.map(function(h){ return h[0] instanceof Array ? h[0] : [h[0]] })
								.reduce(function(a, b){ return a.concat(b) }, [])
								.unique()
								.map(function(n){
									return n == '-' ? n : action2lnk(n) })
								.join(', ')))

					// doc...
					.append($('<hr>'))
					.append($('<pre>')
						.html(doc2html(feature.doc || ''))) )
			})

			return res
		})],

	// XXX might be a good idea to add feature doc/help browser like showDoc(..)
	// XXX show more info about features...
	// 		.title
	// 		.doc (short)
	// XXX might be nice to load/unload features from here...
	// 		this can be done by add explicitly to input (with or without
	// 		the '-' prefix and) and reloading (re-running setup(..))...
	// XXX not sure where to put this -- help or system?
	// 		...if we add feature doc browsing it's help, of feature 
	// 		loading/unloading then system...
	// 		...might be a good idea to split the two functions, like the 
	// 		keyboard help/edit UI's...
	showFeatures: ['Help|System/Features...',
		core.doc`Show feature load information...`,
		makeUIDialog(function(){
			var that = this

			return browse
				.makeLister(null, function(path, make){
					var features = that.features || {}

					// XXX get feature doc...
					var draw = function(heading, list){
						make.Heading(heading)
						;(list || [])
							.forEach(function(tag){
								make(tag, {
									attrs: { 
										feature: tag, 
										root: no_deps.indexOf(tag) >= 0 ? 'true' : '',
									},
									open: function(){ that.showFeatureDoc(tag) },
								})
							}) }

					// features that have no direct dependencies...
					var no_deps = that.features.features.filter(function(f){ 
						return (that.features.depends[f] || []).length == 0 })

					draw('Loaded (in order)', that.features.features)
					draw('Excluded', that.features.excluded)
					draw('Disabled', that.features.disabled)
					draw('Not applicable', that.features.unapplicable)

					if(features.error){
						var error = features.error
						error.missing_suggested && error.missing_suggested.length > 0
							&& draw('Missing (non-critical)', error.missing_suggested)
						error.missing && error.missing.length > 0
							&& draw('Missing (critical)', error.missing)
						// XXX loops...
						// XXX conflicts...
					}
				}, {
					cls: 'feature-list',
				})
				.run(function(){
					// handle '?' button to browse path...
					this.showDoc = function(){
						var feature = this.select('!').attr('feature')
						feature 
							&& that.showFeatureDoc(feature)
					}
					this.keyboard.handler('General', '?', 'showDoc')
				})
		})],

	// XXX is this the right way to go???
	// XXX should this pe a separate feature???
	about: ['Help/$About...',
		{'dialogTitle': 'ImageGrid.Viewer'},
		makeUIDialog(function(path, options){
			return browse.makeList(
				null,
				[
					// XXX add  basic description (About)...

					['Version:', this.version],
					// XXX
					['Build:', '-'],

					'---',

					// XXX load the license file...
					['License:', 'Pre Release'],

					// XXX include other lib list and license info...
					// XXX

					// XXX include nw credits.html...
					// XXX
				], {
					cls: 'table-view'
				})
		})],


	// XXX EXPERIMENTAL...
	featureGraph: ['- Help/Generate feature graph (graphviz format)',
		core.doc`Generate feature dependency graph in the graphviz format.`,
		function(){
			return this.features.FeatureSet.gvGraph(this.features.features) }],
})

var UIIntrospection = 
module.UIIntrospection = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-introspection',
	depends: [
		'ui',
		'ui-dialogs',
	],

	actions: UIIntrospectionActions,
})



//---------------------------------------------------------------------
// NOTE: yes, this is a funny name ;)
//
// XXX should we also add a hide-path config feature???
var BrowseActionsActions = actions.Actions({
	config: {
		'action-category-order': [
			'99:$File',
				// We can order any sub-tree we want in the same manner 
				// as the root...
				'File/-80:Clear viewer',
				'File/-90:Close viewer',
				// Non existing elements will not get drawn...
				//'File/-99:moo',
			'99:$Edit',
				'Edit/Undo',
				'Edit/Redo',
			'$Navigate',
			'$Image',
				'Image/-70:---',
				'Image/-70:.*remove.*',
			'$Ribbon',
				'Ribbon/-70:---',
				'Ribbon/-70:.*remove.*',
			'$Crop',
				'Crop/80:Crop $marked images',
				'Crop/80:Crop $bookmarked images',
				'Crop/70:$Crop',
				'Crop/70:$Flatten',

				// Path patterns...
				// 
				// Patters must contain ".*" and are case-insensitive...
				// 
				// NOTE: patterns are used to override priorities of all
				// 		the matching paths...
				// NOTE: intersecting patterns are handled in order of 
				// 		occurrence thus a more general pattern may 
				// 		"shadow" all the compatible but less general 
				// 		patterns after it...
				// 		XXX this may get fixed in the future, but currently
				// 			this is not a bug...
				'Crop/60:crop .*ribbon.*',

				// The rest of the elements in the path will get added 
				// between the positive and negative prioritized items...
				// ...
			
				/*/ We can also add separators here...
				// NOTE: the separator is the only element in a level 
				// 		that can be used multiple times.
				// 		...any other elements with identical text will 
				// 		get overwritten by the last occurrence...
				'Crop/-50:---',

				'Crop/-60:.*collection.*',

				'Crop/-70:---',
				//*/

				'Crop/-70:---',
				'Crop/-70:.*remove.*',

				'Crop/-80:Uncrop and keep crop image order',
				'Crop/-81:Uncrop all',
				'Crop/-82:$Uncrop',
			'Collec$tions',
				'Collections/-50:.*exit.*',
				'Collections/-60:.*edit.*',
				'Collections/-70:---',
				'Collections/-70:.*remove.*',
			'$Mark',
				'Mark/-75:.*collection...',
				'Mark/-80:---',
				'Mark/-80:.*remove.*',
				'Mark/-90:.*unmark.*',
			'$Bookmark',
				'Bookmark/-80:---',
				'Bookmark/-80:.*remove.*',

			// ...

			'-40:Interface',
			'-50:$Workspace',
			'-60:System',
			'-70:$Help',
			'-80:---',
			'-90:Development',
			'-90:Test',
		],

		'browse-actions-settings': {
			showDisabled: true,
			showHidden: false,
			showEmpty: false,
		},

		'browse-actions-keys': 'on',

		'browse-actions-shortcut-marker': '\\$(\\w)',
	},

	// Hide .alias(..) action from the browser...
	//
	// NOTE: we need to do this as .alias(..) is defined in actions and
	// 		has no concept of the naming protocols used in ImageGrid.Viewer
	alias: ['- System/', ''],


	// Browse actions dialog...
	//
	// This uses action definition to build and present an action tree.
	//
	// This supports the following element (action doc) syntax:
	// 	- '/' separated action path (action short doc) to indicate the
	// 	  path to action.
	//
	// 	- leading path element number followed by colon to indicate 
	// 	  element priority on level.
	// 		Example:
	// 			'Path/99: To/50:Element'
	// 	  NOTE: multiple path elements may have multiple priorities.
	// 	  NOTE: an item with positive priority will be above and item 
	// 	  		with less or no priority.
	// 	  NOTE: an item with negative priority will be below any item 
	// 	  		with greater or no priority.
	//
	// 	- leading '-' in path to indicate a hidden/disabled element.
	// 		Example: 
	// 			'- Path/To/Element'			(disabled/hidden)
	// 			'- 99:Path/To/Element'		(disabled/hidden)
	// 			'Path/To/Other element'		(enabled)
	//
	//
	//
	// Action mode (disabled/hidden) and also be controlled dynamically:
	// 	- .browseMode() action method is called with actions as base.
	//		Example:
	//			someAction: ['Path/To/Some action',
	//				{browseMode: function(){ ... }},
	//				function(){
	//					...
	//				}],
	//			someOtherAction: ['Path/To/Some action',
	//				// alias
	//				{browseMode: 'someAction'},
	//				function(){
	//					...
	//				}],
	//
	//		.browseMode can be:
	//			<function>			- action method.
	//			<action-name>		- alias, name of action to get the
	//									method from.
	//
	//		.browseMode() can return:
	//			'disabled'		- item will be disabled.
	//			'hidden'		- item will be both hidden and disabled.
	//
	//		NOTE: disabling in path has priority over .browseMode(), thus
	//			it is possible to hide/disable an enabled item but not
	//			possible to enable a disabled by default path.
	//		NOTE: .browseMode() can be defined in any action in chain,
	//			though only the last one is called...
	//
	//
	// options format:
	// 	{
	// 		callback: <function>,
	// 		no_disabled: false,
	// 		no_hidden: false,
	// 	}
	//
	//
	// NOTE: if the action returns an instance of overlay.Overlay this
	// 		will not close right away but rather bind to:
	// 			overlay.close			-> self.focus()
	// 			overlay.client.open		-> self.close()
	// NOTE: we are not using the browse.PathList(..) here as we need 
	// 		custom controls and special path handling...
	// NOTE: this will keep the first instance title it encounters, this
	// 		if a later instance includes a priority, it will be ignored.
	// 		This may happen if several actions are in the same path and
	// 		each one set a different priority in that path...
	// 		...to avoid this use .config['action-category-order'] to set
	// 		base order/priorities...
	//
	// XXX can we do a deep search on '/' -- find any nested action???
	// XXX can this also do a flat mode???
	// 		...this would help with the (global) search -- switch to 
	// 		flat if searching in root mode...
	browseActions: ['Interface/Dialog/Actions...',
		makeUIDialog(function(path, options){
			var actions = this

			var PRIORITY = /^(-?[0-9]+)\s*:\s*/

			var MARKER = RegExp(this.config['browse-actions-shortcut-marker'], 'g')
			MARKER = MARKER || RegExp(MARKER, 'g')

			var dialog
			options = options || {}

			// prepare the config...
			var cfg = {
				cls: 'browse-actions',

				path: path,

				flat: false,
				traversable: true,
				pathPrefix: '/',
				fullPathEdit: true,

				item_shortcut_marker: MARKER,
			}
			cfg.__proto__ = this.config['browse-actions-settings']

			// get keys for each action...
			var keys = this.getKeysForAction ? this.getKeysForAction() : {}
			// Get keys for action...
			var getKeys = function(action){
				return (keys[action] || []).join(' / ') }

			// Get item from tree level taking into account additional 
			// syntax like prioority...
			// returns:
			// 	[<existing-text>, <new-level>]
			//
			// XXX this may mess up the ordering of items when using 
			// 		item patterns...
			var getItem = function(level, text){
				// direct match...
				if(text in level){
					return [text, level[text]]

				// check if it's a priority path or a pattern... 
				} else {
					var t = text.replace(PRIORITY, '')
					t = (MARKER ? t.replace(MARKER, '$1') : t).trim()

					for(var e in level){
						var n = e.replace(PRIORITY, '')
						n = (MARKER ? n.replace(MARKER, '$1') : n).trim()

						if(n == t){
							return [e, level[e]]
						}

						// check pattern...
						var p = /\.\*/.test(n) ? new RegExp('^'+ n +'$', 'i') : null

						if(p && p.test(t)){
							// override item priority from pattern...
							var pr = PRIORITY.exec(e)
							pr = pr ? pr.pop() + ':' : ''

							return [pr + text.replace(PRIORITY, ''), level[e]]
						}
					}
				}
				return []
			}

			// Get action browse mode (disabled or hidden)...
			var getMode = function(action){
				var m = action
				var visited = [m]

				// handle aliases...
				do {
					m = actions.getActionAttr(m, 'browseMode')
					// check for loops...
					if(m && visited[m] != null){
						m = null
						break
					}
					visited.push(m)
				} while(typeof(m) == typeof('str'))

				return m ? m.call(actions) : undefined
			}

			// Wait for dialog...
			var waitFor = (function(child){
				// we got a widget, wait for it to close...
				if(child instanceof widget.Widget){
					child
						.on('close', function(evt, reason){ 
							reason != 'reject'
								&& dialog.close(reason) })

				// if it's not a dialog, don't wait...
				} else {
					dialog.close()
				}

				return child
			}).bind(this)

			// Tree builder...
			// XXX normalize actions -- whitespace, '!', args...
			var buildTree = function(path, leaf, action, mode, tree){
				path = path.slice()
				// build leaf...
				if(path.length == 0){
					// handle "|" in leavs...
					leaf.split(/\|/g)
						.forEach(function(leaf){
							var l = getItem(tree, leaf)[0]
							tree[l || leaf] = action != null ? [action, mode] : action
						})
					return
				}
				// build alternative paths...
				var p = path.shift() || ''
				p.split(/\|/g)
					.forEach(function(e){
						// build branch element...
						var branch = getItem(tree, e)
						branch = tree[branch[0] || e] = branch[1] || {}

						// build sub-branch...
						buildTree(path, leaf, action, mode, branch)
					})
			}

			// Action tree...
			//
			// Format:
			// 	{
			// 		<name>: <tree>,
			//
			// 		<name>: [
			// 			<action-name>,
			// 			// mode...
			// 			'disabled' | 'hidden',
			// 		],
			//
			// 		...
			// 	}
			//
			// NOTE: this is created once per call, so to refresh the 
			// 		actions tree we'll need to re-open the dialog...
			var tree = {}

			// pre-order the main categories...
			// NOTE: pre_order can be a list of long paths...
			var s = ''
			var pre_order = (this.config['action-category-order'] || [])
				.map(function(p, i){
					// make all separators unique...
					// ...this will prevent us from losing or merging them.
					if(p.trimRight().endsWith('---')){
						s += '-'
						p = p.trimRight() + s
					}
					return p
				})
			pre_order.forEach(function(key){
				var path = key.split(/[\\\/]/g)
				var leaf = path.pop()

				buildTree(path, leaf, null, null, tree)
			})

			// build the tree...
			var paths = this.getPath()
			Object.keys(paths).forEach(function(key){
				// handle mode flag...
				var action = paths[key][0]
				var mode = key.split(/^-\s*/)
				var path = mode.pop()
				mode = mode.length > 0 ? 'hidden' : null

				path = path.split(/[\\\/]/g)
				var leaf = path.pop()

				buildTree(path, leaf, action, mode, tree)
			})

			//console.log('!!!!', tree)

			// now for the dialog...
			dialog = browse.makeLister(null, function(path, make){
				var that = this
				var cur = tree

				// get level...
				// NOTE: we need to get the level till first '*'...
				// NOTE: this needs to account for leading priority of 
				// 		an element...
				var rest = path.slice()
				while(rest.length > 0 && !('*' in cur)){
					cur = getItem(cur, rest.shift()).pop() || {}
				}

				// render current level...
				// NOTE: we can be at one of several level types, each 
				// 		is rendered in a different way...

				// Level: toggler states -- get states and list them...
				if(cur instanceof Array 
						&& actions.isToggler && actions.isToggler(cur[0])){
					var action = cur[0]
					var mode = cur[1]

					// handle live modes...
					mode = mode || getMode(action)

					var cur_state = actions[action]('?')
					var states = actions[action]('??')

					// handle on/off togglers...
					// XXX should the toggler directly return 'on'/'off'???
					if(states.length == 2 
							&& states.indexOf('none') >= 0 
							&& (cur_state == 'on' || cur_state == 'off')){
						states = ['on', 'off']
					}

					// build toggler states...
					states.forEach(function(state){
						make(state, { 
							// NOTE: if something is hidden 
							// 		it is also disabled...
							// 		...this is by design.
							disabled: options.no_disabled ? 
								false 
								: (mode == 'hidden' || mode == 'disabled'),
							hidden: options.no_hidden ? 
								false
								: mode == 'hidden',

							cls: [
								state == cur_state ? 'selected highlighted' : '',
								mode == 'hidden' ? mode : ''
							].join(' '),

							attrs: {
								// XXX need to normalize state -- comments, whitespace, etc...
								keys: getKeys(action +': "'+ state +'"'),
							},

							events: {
								open: function(){
									options.callback ?
										options.callback.call(actions, action)
										: actions[action](state)
									that.pop()
								},
							},
						})
					})

				// Level: lister -- hand control to lister...
				// NOTE: path might be a partial path, the rest of it is
				// 		handled by the lister...
				} else if('*' in cur){
					actions[cur['*'][0]](path, make)

				// Level: normal -- list actions...
				} else {
					var level = Object.keys(cur)
					level
						.slice()
						// sort according to item priority: 'NN: <text>'
						//	NN > 0		- is sorted above the non-prioritized
						//					elements, the greater the number 
						//					the higher the element
						//	NN < 0		- is sorted below the non-prioritized
						//					elements, the lower the number 
						//					the lower the element
						// other		- keep order
						.sort(function(a, b){
							var ai = PRIORITY.exec(a)
							ai = ai ? ai.pop()*1 : null
							ai = ai > 0 ? -ai
								: ai < 0 ? -ai + level.length
								: 0

							var bi = PRIORITY.exec(b)
							bi = bi ? bi.pop()*1 : null
							bi = bi > 0 ? -bi
								: bi < 0 ? -bi + level.length
								: 0

							return ai == bi ? 
								level.indexOf(a) - level.indexOf(b) 
								: ai - bi
						})
						.forEach(function(key){
							// remove the order...
							var text = key.replace(PRIORITY, '').trim()

							// Item: action...
							if(cur[key] instanceof Array){
								var action = cur[key][0]
								var mode = cur[key][1]

								// handle live modes...
								mode = mode || getMode(action)

								// Action: toggler -> add toggle button...
								if(actions.isToggler && actions.isToggler(action)){
									make(text + '/', { 
										cls: mode == 'hidden' ? mode : '',
										// NOTE: if something is hidden 
										// 		it is also disabled...
										// 		...this is by design.
										disabled: options.no_disabled ? 
											false 
											: (mode == 'hidden' || mode == 'disabled'),
										hidden: options.no_hidden ? 
											false
											: mode == 'hidden',
										attrs: {
											keys: getKeys(action),
											action: action,
										},
										buttons: [
											[actions[action]('?'), 
												function(){
													actions[action]()
													that.update()
													that.select('"'+ text +'"')
												}],
											//[getKeys(action)],
										],
										open: function(){
											options.callback ?
												options.callback.call(actions, action)
												: actions[action]()

											that.update()
											that.select('"'+ text +'"')
										},
									})

								// Action: normal...
								} else {
									make(text, {
											// NOTE: if something is hidden 
											// 		it is also disabled...
											// 		...this is by design.
											disabled: options.no_disabled ? 
												false 
												: (mode == 'hidden' || mode == 'disabled'),
									   		hidden: options.no_hidden ? 
												false
												: mode == 'hidden',
											attrs: {
												keys: getKeys(action),
												action: action,
											},
											open: function(){
												options.callback ?
													options.callback.call(actions, action)
													: waitFor(actions[action]())
											},
										})
								}

							// Item: dir...
							} else if(actions.config['browse-actions-settings'].showEmpty 
									|| (cur[key] != null
										&& Object.keys(cur[key]).length > 0)){
								var p = '/'+ path.concat([text]).join('/') +'/'
								p = MARKER ? p.replace(MARKER, '$1') : p
								make(text + '/', { 
									push_on_open: true,
									attrs: {
										keys: [
											getKeys('browseActions: "'+ p +'"'), 
											getKeys('browseActions!: "'+ p +'"'), 
										].filter(function(e){ return e.trim() != '' }).join(' / '),
									},
								})

							// item: line...
							} else if(/---+/.test(text)){
								make('---')
							}
						})
				}
			},
			 cfg)
			// save show disabled state to .config...
			.on('close', function(){
				var config = actions.config['browse-actions-settings'] 

				config.showDisabled = dialog.options.showDisabled
				config.showHidden = dialog.options.showHidden
			})
			.run(function(){
				actions.config['browse-actions-keys'] 
					&& this.dom.addClass('show-keys')

				// handle '?' button to browse path...
				var showDoc = this.showDoc = function(){
					var action = this.select('!').attr('action')
					action 
						&& actions.showDoc(action)
				}
				this.keyboard.handler('General', '?', 'showDoc')
				this.menu(showDoc.bind(this))
			})

			return dialog
		})],

	toggleBrowseActionKeys: ['Interface/Show keys in menu',
		core.makeConfigToggler(
			'browse-actions-keys', 
			['on', 'off'],
			function(state){
				this.modal.client.dom.hasClass('browse-actions')
					&& this.modal.client.dom[state == 'on' ? 'addClass' : 'removeClass']('show-keys')
			})],
})

var BrowseActions = 
module.BrowseActions = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-browse-actions',
	depends: [
		'ui',
		'ui-dialogs',
		'ui-introspection',
	],
	suggested: [
		'keyboard',
	],

	actions: BrowseActionsActions,
})



//---------------------------------------------------------------------

// XXX use image instead of image block in single image mode...
var ContextActionMenu = 
module.ContextActionMenu = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-context-action-menu',
	depends: [
		'ui-browse-actions',
	],

	actions: actions.Actions({
		showContextMenu: ['Interface/Show context menu...',
			uiDialog(function(){
				return this.current ?
					this.browseActions('/Image/')
					: this.browseActions() })],
	}),

	handlers: [
		['imageMenu.pre',
			function(gid){
				event.preventDefault()
				event.stopPropagation()

				this
					.focusImage(gid)
					.browseActions('/Image/')
			}],
		['imageOuterBlockMenu.pre',
			function(gid){
				// only show image menu in ribbon mode...
				if(this.toggleSingleImage && this.toggleSingleImage('?') == 'on'){
					return
				}

				event.preventDefault()
				event.stopPropagation()

				this
					.focusImage(gid)
					.browseActions('/Image/')
			}],

		// NOTE: we are using load here and not 'start' because at start
		// 		there may be no viewer yet...
		// 		XXX is this a bug???
		['load',
			function(){
				var that = this
				var viewer = this.dom

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
	
// mac seems not to have the utf gear icon...
var SETTINGS_ICON = 
	typeof(navigator) == 'undefined' ? 'settings'
	: navigator.platform == 'Win32' ?  '&#9965;'
	: '<span class="material-icons">settings</span>'

// XXX add context menu action to buttons...
var ButtonsActions = actions.Actions({
	config: {
		'main-buttons-state': 'on',
		// Format:
		// 	{
		// 		<html>: [
		// 			<css-class>,
		// 			// Button info (optional)
		// 			<info>,
		// 			<code>,
		// 		],
		//
		// 		<html>: [
		// 			<css-class>,
		// 			// Button info (optional)
		// 			<info>,
		// 			[
		// 				<primary>,
		// 				<secondary>,
		// 			]
		// 		],
		// 		...
		// 	}
		//
		'main-buttons': {
			'&#x2630;': ['menu', 'browseActions -- Action menu...'],
			'&#9714;<sub/><sup/>': ['collections', [
				'browseCollections -- Collections...',
				'browseActions: "/Collections/" -- Collection menu...',
			]],
			'C<sub/>': ['crop', 'browseActions: "Crop/" -- Crop menu...'],
			'&#9655;': ['slideshow', [
				'toggleSlideshow -- Slideshow',
				'slideshowDialog -- Slideshow menu...',
			]],
		},

		// XXX not sure about these yet...
		'secondary-buttons-state': 'off',
		'secondary-buttons': {
			//'<span/>': ['touch-controls', 'toggleSideButtons -- Toggle touch controls'],
			//'Z<sub/>': ['zoom', 'browseActions: "Zoom/" -- Zoom menu...'],
			//'+': ['zoom-in', 'zoomIn -- Zoom in'],
			//'-': ['zoom-out', 'zoomOut -- Zoom out'],
			//'&#9965;': ['ui-settings', 'browseActions: "Interface/" -- Interface settings...'],
		},

		'app-buttons': {
			[SETTINGS_ICON]: ['ui-settings', [
				'browseActions: "Interface/" -- Interface settings...',
				'toggleSideButtons -- Toggle touch controls',
			]],
		},

		'side-buttons-state': 'off',

		'side-buttons-left': {
			'-': ['zoom-out', 'zoomOut -- Zoom out'],
			'&#8613;': ['up', 'shiftImageUp -- Shift image up'],
			'&#10633;': ['left', 'prevImage -- Previous image'],
			'&#8615;': ['down', 'shiftImageDown -- Shift image down'],
		},
		'side-buttons-right': {
			'+': ['zoom-in', 'zoomIn -- Zoom in'],
			'&#8613;': ['up', 'shiftImageUp -- Shift image up'],
			'&#10634;': ['right', 'nextImage -- Next image'],
			'&#8615;': ['down', 'shiftImageDown -- Shift image down'],
		},

		'button-highlight-color': 'white',
		'button-highlight-colors': [ 
			'white',
			'yellow',
		],
	},

	toggleMainButtons: ['Interface/Main buttons',
		makeButtonControlsToggler('main-buttons')],
	toggleSecondaryButtons: ['Interface/Secondary buttons',
		makeButtonControlsToggler('secondary-buttons')],
	toggleAppButtons: ['Interface/App buttons',
		makeButtonControlsToggler('app-buttons')],
	toggleSideButtons: ['Interface/99: Touch buttons', 
		(function(){
			var left = makeButtonControlsToggler('side-buttons-left')
			var right = makeButtonControlsToggler('side-buttons-right')

			return core.makeConfigToggler('side-buttons-state', 
				['on', 'off'], 
				function(){
					left.apply(this, arguments) 
					right.apply(this, arguments) 
				})
		})()],

	toggleButtonHighlightColor: ['Interface/Button highlight color',
		core.makeConfigToggler(
			'button-highlight-color',
			function(){ return this.config['button-highlight-colors'] },
			// update the buttons...
			function(){ this.reload() })],
})

var Buttons = 
module.Buttons = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-buttons',
	depends: [
		'ui',
	],
	suggested: [
		// needed for reporting info in .makeButtonControls(..)
		'ui-status-bar',
	],

	actions: ButtonsActions,

	handlers: [
		['start.pre', 
			function(){ 
				this.toggleAppButtons('on')
		   	}],
		// NOTE: these need to be loaded AFTER the .config has been loaded...
		['start', 
			function(){ 
				this.toggleMainButtons(this.config['main-buttons-state'] || 'on')
				this.toggleSecondaryButtons(this.config['secondary-buttons-state'] || 'on')
				this.toggleSideButtons(this.config['side-buttons-state'] || 'on')
		   	}],

		// update crop button status...
		[[
			'load',
			'clear',
			'reload',
		], 
			function(){
				// XXX is this the right way to go???
				$('.main-buttons.buttons .crop.button')
					.css({ 'color': this.cropped ? 
						(this.config['button-highlight-color'] || 'white')
						: '', })

				var l = (this.crop_stack || []).length

				$('.main-buttons.buttons .crop.button sub')
					// XXX should this be here or in CSS???
					.css({
						'display': 'inline-block',
						'width': '0px',
						'overflow': 'visible',
					})
					.text(l == 0 ? ''
						: l > 99 ? '99+'
						: l) 
			}],
		// update collection button status...
		[[
			'load', 
			'clear', 
			'reload', 
			'saveCollection',
			'removeCollection',
			'collectionLoaded', 
			'collectionUnloaded', 
		], 
			function(){
				// XXX is this the right way to go???
				$('.main-buttons.buttons .collections.button')
					.css({ 'color': this.collection ?
						(this.config['button-highlight-color'] || 'white')
						: '', })

				var l = this.collections_length

				// current collection unsaved indicator...
				$('.main-buttons.buttons .collections.button sup')
					.css({
						'display': 'inline-block',
						'position': 'absolute',
						'margin-top': '-0.3em',
						'overflow': 'visible',
					})
					.text((this.collection && !(this.collection in this.collections)) ? 
						'*' 
						: '')

				// collection count... 
				$('.main-buttons.buttons .collections.button sub')
					.css({
						'display': 'inline-block',
						'width': '0px',
						'overflow': 'visible',
					})
					.text(l > 99 ?  '99+' 
						: l == 0 ? ''
						: l)
				/*
				$('.main-buttons.buttons .collections.button sub')
					// XXX should this be here or in CSS???
					.css({
						'display': 'inline-block',
						'width': '0px',
						'overflow': 'visible',
						'color': 'yellow',
					})
					.html(this.collection ? '&#9679;' : '')
				//*/
		   	}],
		// update slideshow status...
		['toggleSlideshow',
			function(){
				$('.main-buttons.buttons .slideshow.button')
					.html(this.toggleSlideshow('?') == 'on' ? 
						'&#9724;' 
						//'&#9723;'
						: '&#9655;')
			}],
		// update zoom button status...
		['viewScale', 
			function(){
				$('.secondary-buttons.buttons .zoom.button sub')
					.text(Math.round(this.screenwidth)) }],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
