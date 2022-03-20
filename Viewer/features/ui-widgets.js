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
function(context, cls, data, unusable_draw){
	cls = cls instanceof Array ? 
		cls 
		: cls.split(/\s+/g)
	unusable_draw = unusable_draw 
		|| context.config['unusable-button-draw-mode'] 
		|| 'hidden'

	// remove old versions...
	context.dom.find('.'+ cls.join('.')).remove()

	// make container...
	var controls = $('<div>')
		.addClass('buttons '+ cls.join('.'))
		.on('mouseover', function(evt){
			evt = window.event || evt
			var t = $(evt.target)

			var info = t.attr('info') 
				|| t.parents('[info]').attr('info') 
				|| ''

			context.showStatusBarInfo
				&& context.showStatusBarInfo(info) })
		.on('mouseout', function(){
			context.showStatusBarInfo
				&& context.showStatusBarInfo() })

	// make buttons...
	Object.keys(data).forEach(function(k){
		var usable = true

		// spacer...
		if(typeof(data[k]) == typeof('str') 
				&& /--+/.test(data[k])){
			k = '&nbsp;'
			var cls = 'spacer'
			var doc = ''
			var click = function(){}
			var menu = function(){}

		// normal element...
		// XXX show button only if action available...
		} else {
			var e = data[k].slice()
			var primary = e.pop()
			primary = primary instanceof Array ? 
				primary.slice() 
				: primary
			var secondary = (primary instanceof Array && primary.length > 1) ? 
				primary.pop() 
				: null
			secondary = typeof(secondary) == typeof('str') ?
				keyboard.parseActionCall(secondary, context) 
				: secondary
			primary = primary instanceof Array ? 
				primary.shift() 
				: primary
			primary = typeof(primary) == typeof('str') ?
				keyboard.parseActionCall(primary, context) 
				: primary
			usable = primary instanceof Function
				|| context[primary.action] instanceof Function

			// do not draw if primary not usable...
			if(!usable && unusable_draw == 'none'){
				return }

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
				.on('contextmenu', menu)
				// handle unusable drawing...
				.run(function(){
					!usable 
						&& unusable_draw == 'hidden'
						&& this.css({display: 'none'})
					!usable 
						&& unusable_draw == 'disabled'
						&& this[0].setAttribute('disabled', '') }))
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
		}) }



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
		}) }



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
			value_path(...arguments)
			: value_path.split('.')

		if(value_path instanceof Function 
				&& !(path instanceof Array)){
			return path }

		var key = path.pop()
		var target = actions.config
		path.forEach(function(p){
			target = target[p] = target[p] || {} })

		// set...
		if(value){
			target[key] = value

		// get...
		} else {
			return target[key] } }
	var save = function(value){
		stateValue(value)
		dialog.close() }

	if(value_path 
			&& (options.overflow == null 
				|| options.overflow == 'save')){
		options.overflow = save }

	// set the path...
	if(value_path && !options.path){
		options.path = stateValue() }

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
				target[key] = lst } }, options)

	value_path
		&& dialog.open(function(){ save(dialog.selected) })
	setup
		&& setup.call(dialog, dialog)
	return dialog }


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
	} }



/*********************************************************************/
// Dialogs and containers...

// Mark an action as a container...
//
// NOTE: the marked action must comply with the container protocol
// 		(see: makeUIContainer(..) for more info)
var uiContainer =
module.uiContainer = function(func){
	func.__container__ = true
	return func }

// Make a container constructor wrapper...
//
// This will:
// 	- mark the action as a container
//
// The container will:
// 	- trigger client's 'attached' event when attached to container
// 	- trigger client's 'close' event on close
//
// XXX not sure how the click is handled here...
// XXX pass options???
var makeUIContainer =
module.makeUIContainer = function(make){
	return uiContainer(function(){
		var that = this

		// trigger the general modal open event...
		that.modal
			// XXX do we need to pass anything here????
			|| that.firstModalOpen() 

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

					// trigger the general modal close event...
					that.modal
						// XXX do we need to pass anything here????
						|| that.lastModalClose() 
				})
				// Compensate for click focusing the parent dialog when
				// a child is created...
				// XXX is this the right way to go???
				.on('click', function(evt){ 
					that.modal && that.modal.focus() })
				.trigger('attached', o)

		return o
			// focus the new dialog...
			// NOTE: fixes the same bug as .client.on('close', ...) above, 
			// 		see note for that...
			.focus()
	}) }


// Mark action as a dialog...
//
var uiDialog =
module.uiDialog = function(func){
	func.__dialog__ = true
	return func }

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
	var args = [...arguments]

	// container name (optional)...
	var dfl = typeof(args[0]) == typeof('str') ?
			args.shift()
			: null
	// constructor...
	var make = args.shift()
	// rest of the args to be passed to the container...
	var cargs = args

	return uiDialog(function(){
		var args = [...arguments]

		// we passed a make(..) function...
		// XXX revise...
		if(args[0] instanceof Function && args[0].constructor === browse.Make){
			return actions.ASIS(make.call(this, ...args)) }

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
	}) }

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
	}) }



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
			}) }) }

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
	}, options) }



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
			|| null },

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
				}) })],
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

	// Events...
	firstModalOpen: ['- Interface/',
		core.Event(function(gid){
			// Triggered when the first modal container is opened.
			//
			// Not for direct use.
		})],
	// XXX due to that .close() can be called a couple of times this can 
	// 		also be called a couple of times...
	lastModalClose: ['- Interface/',
		core.Event(function(gid){
			// Triggered when the last modal container is closed.
			//
			// Not for direct use.
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
	showTree: ['- Interface/',
		makeUIDialog(function(list, options){
			return browse.makePathList(null, 
				list, 
				Object.assign({
					/*
					cls: 'browse-actions',
					//path: '/',
					flat: false,
					traversable: true,
					pathPrefix: '/',
					//fullPathEdit: true,
					//*/
				}, options || {})) })],
	// XXX
	showCloud: ['- Interface/',
		makeUIDialog(function(list, options){
			throw new Error('.showCloud(..): not implemented.') })],

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
					make.EditableList(list, options) }, 
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


	listDialogs: ['Interface|System/Dialog/Dialog list...',
		{mode: 'advancedBrowseModeAction'},
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
		{mode: 'advancedBrowseModeAction'},
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
		['__actioncall__', 
			function(res, action, args){
				//if(res instanceof jQuery || res instanceof widget.Widget){
				//	var elem = (res.dom || res)
				if(res instanceof widget.Widget){
					var elem = res.dom

					var title = this.getActionAttr(action, 'dialogTitle')

					title ?
						elem.attr('dialog-title', 
							title instanceof Function ? 
								title.call(this, action, args) 
								: title)
						: !elem.attr('keep-dialog-title') 
							&& !this.getActionAttr(action, 'keepDialogTitle')
							&& elem.attr('dialog-title', this.getDocTitle(action))
				}
			}],
	],
})



//---------------------------------------------------------------------
// Universal editor...


// XXX EXPERIMENTAL...
//
// Make a nested context...
//
//	Make a nested context object...
//	.makeSubContext(name[, obj])
//		-> context
//
//	Make a nested context function...
//	.makeSubContext(name, func[, obj])
//		-> context
//
//
// The context inherits from .items / make(..)
//
// If the context is callable it will be called in the context of make(..)
//
// If the context is constructed recursively it will return self
//
//
// XXX move this to browse.js/browse2.js???
// 		...there seems to be no way to make this generic...
// XXX think of a better name... (???)
// XXX should the client be able to override shorthands???
// XXX is there a way to access the parent context???
browse.items.makeSubContext = function(name, obj){
	// arse args...
	var args = [...arguments].slice(1)
	var func = args[0] instanceof Function ?
		args.shift()
		: null
	obj = args.shift()

	var n = '__'+ name
    Object.defineProperty(this, name, {
        get: function(){
			var that = this
			if(!this.hasOwnProperty(n)){
				// build the context object...
				var nested =
					func ?
						// NOTE: we always call func(..) in the root context...
						function(){
							// XXX should the client be able to override shorthands???
							var shorthands = (that.dialog.options || {}).elementShorthand || {}
							return arguments[0] in shorthands ?
								that.call(that, ...arguments)
								: func.call(that, ...arguments) }
							//return func.call(that, ...arguments) }
					: this instanceof Function ?
						function(){
							return that.call(this, ...arguments) }
					: {}
				nested.__proto__ = this

				// mixin parent/obj...
				Object.assign(nested, 
					this[n] || obj || {})

				// NOTE: this will prevent constructing a nested context
				//		(see test above)...
				this[n] = nested[n] = nested
			}
			return this[n] }, 
	})
	return this[name] }


//
// 	.field(title[, options])
// 	.field(title, value[, options])
//
//
// NOTE: essentially make.field(..) is almost identical to make(..), the
// 		later is needed to provide context for field items and a transparent
// 		fallback for make(..) calls from within their context...
//
//
// XXX Q: should we add an ImageGrid context to make(..)???
// 		...something like .app for making it generic-ish for example...
// 		....a different approach to this would be to create a list editor 
// 		within the current dialog independently of the outer context...
// 		...this could either be done as:
// 			- a popup/modal sub dialog
// 				...problematic as the wrapper is external to the browser...
// 			- as a sub-path...
// 				...this is hard without side-effects...
browse.items.makeSubContext('field',
	function(title, value, options){
		// parse arguments...
		var args = [...arguments].slice(1)
		value = (args[0] instanceof Function 
				|| !(args[0] instanceof Object)) ?
			args.shift()
			: undefined
		options = args.shift() || {}
		value = value || options.value
		Object.assign(
			options, 
			{
				title, 
				value,
			})
		return this([
			title, 
			options.value instanceof Function ?
				options.value(this)
				: options.value 
		], options) })


// XXX revise naming...
// XXX do we actually need this???
// 		....showList(..) seems too trivial...
// 		need to make the upstream version to accept both signatures...
// XXX these will not work as-is as they need to attach the resulting 
// 		dialog to a container (see: makeUIDialog(..))...
// 		...as-is these simply create a DOM object and return it...
// 		is this feasible???
// XXX another way to try is to make an inline list editor/selector...
// XXX the whole thing needs a re-think....
browse.showList = function(list, options){
	return browse.makeList(null, list, options) }
browse.showEditableList = function(list, options){
	options = Object.create(options || {})
	// defaults...
	options.sortable = options.sortable === undefined ? 
		true 
		: options.sortable
	return browse.makeLister(null, 
		function(path, make){
			make.EditableList(list, options) }, 
		options) }


// Toggler field...
//
// 	.field.Toggle(title, value[, options])
// 	.field.Toggle(title, options)
//
//
// XXX need to open a list (ro/editable) dialog (currently context is used)...
// 		...IMO the way to go here is to move the non-generic editors to browse...
// 		this can't be done though, because of the need to wrap the dialog 
// 		in a container which is done by ImageGrid.Viewer...
// XXX if options.open is defined it will fully override the default open
// 		behavior...
browse.items.field.Toggle = 
function(title, options){
	var that = this
	// parse args...
	var args = [...arguments].slice(1)
	var value = args[0] instanceof Object ? 
		(args[0].value 
			|| (args[0].values || [])[0] 
			|| 'off')
		: args.shift()
	options = args.shift() || {}

	return this.field(title, value,
		Object.assign(
			options,
			options.__toggle_setup ?
				{}
				: {
					__toggler_setup: true,

					// XXX do we need a .type ???
					//type: options.type || 'toggle',

					open: function(evt){
						// XXX CONTEXT...
						var context = options.context || that.dialog

						var getValues = function(){
							return options.values instanceof Function ?
								options.values.call(context)
							: options.values ?
								options.values	
							: ['off', 'on'] }
						var set = function(v){
							// get current value...
							v = arguments.length > 0 ? 
									v
								: options.value instanceof Function ?
									options.value.call(context)
								: options.value 
							// normalize...
							// NOTE: we are re-getting the values here 
							// 		as it can get updated in options.list(..)
							// 		or via options.values(..)...
							if(!options.nonstrict){
								var values = getValues()
								v = values.includes(v) ?
									v
									: values[0] }
							// update the value...
							// NOTE: we update the local value iff set(..)
							// 		got an explicit value argument...
							// 		calling set(..) will not store anything,
							// 		just update the current state, either to
							// 		the already stored value or to the output
							// 		of .value(..)...
							arguments.length > 0
								&& (options.value instanceof Function ?
									(v = options.value.call(context, v))
									: (options.value = v))
							elem.text(v)
							// update dialog...
							options.doNotAutoUpdateDialog
								|| that.dialog.update() }


						var elem = $(this).find('.text').last()
						var current = elem.text()
						var values = getValues()

						// editable list or more than 2 values -> show value list...
						if(options.list_editable 
								|| (values.length > 2 
									&& options.list !== false)){
							// call options.list(..)
							if(options.list instanceof Function){
								options.list.call(context, current, set)

							// normal list...
							} else {
								// XXX search several contexts here... 
								// XXX mark the current value???
								//var o = context[
								var o = browse[
										options.list_editable ? 
											'showEditableList' 
											: 'showList'](
									values, 
									Object.assign({
											path: current,
											// XXX need to call the user .open(..) if defined...
											// 		...need to take care to make this stable to 
											// 		multiple calls...
											open: function(v){
												// update value...
												// XXX current is [[value]], check 
												// 		the upstream if this is correct...
												current = v[0][0]
												// NOTE: this is done first 
												// 		to update values...
												o.close()
												// update callable values...
												options.list_editable 
													&& options.values instanceof Function 
													&& options.values.call(context, values) },
											close: function(){
												// NOTE: set(..) should be 
												// 		called after all the
												// 		dialog stuff is done...
												setTimeout(function(){ set(current) }) },
										}, 
										options.list !== true ? 
											options.list 
											: {}) ) }

						// directly toggle next value...
						} else {
							// XXX should we be able to toggle values back???
							set(values[(values.indexOf(current) + 1) % values.length]) }
					} },
			options
				// normalize value...
				.run(function(){
					// XXX CONTEXT...
					var context = options.app || that.app

					if(!(this.value instanceof Function)){
						var values = options.values instanceof Function ?
								options.values.call(context)
							: options.values ?
								options.values	
							: ['off', 'on']
						this.value = 
							this.value === undefined ?
								values[0]
							: values.includes(this.value) ?
								this.value
							: this.value ?
								'on'
							: 'off' } }))) }


// XXX docs!!!
// 		...do not forget to document the callback(..)...
browse.items.batch =
function(spec, callback){
	var that = this
	// build the fields...
	spec
		.forEach(function(field){
			// array...
			field instanceof Array ?
				that(...field)
			// spec...
			: field instanceof Object ?
				(field.type || 'field')
					// handle field paths...
					.split('.')
					.reduce(function(res, cur){
						that = res
						return res[cur] }, that)
					.call(that, field.title || field.id, field)
			// other...
			: that(field) })
	// batch callback...
	var cb
	callback
		&& this.dialog
			// XXX STUB .one(..) vs. .on(..) get's us around the close 
			// 		event getting triggered multiple times...
			// 		...change to .close(..) when fixed...
			.one('close', cb = function(mode){
				callback(
					// get the field-value pairs...
					spec.reduce(function(res, e){
						var id = e.id || e.title
						id != undefined
							&& (res[id] = e.value instanceof Function ? 
								e.value.call(that) 
								: e.value)
						return res }, {}), 
					// full spec...
					// NOTE: technically we do not need to pass this
					// 		through as we are mutating the data inside
					// 		but passing it here is cleaner than forcing
					// 		the user to get it via closure...
					spec,
					mode) })
			// reset the callback on update...
			.one('update', function(){
				// NOTE: we need to skip the initial update or it will 
				// 		.off(..) the handler right after it got bound...
				// 		...this will effectively shift the .off(..) stage
				// 		by one iteration...
				// XXX feels hacky -- revise...
				this.one('update', function(){
					this.off('close', cb) }) })
	return this }



// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var EditorActions = actions.Actions({

	// format:
	// 	{
	// 		<type>: function(id, make, options){},
	// 		...
	// 	}
	//
	// NOTE: we are not supporting aliases here as we need to pass strings
	// 		as-is into .makeEditorBlock(..)'s spec to be able to create things
	// 		like '---' -> <hr> and other stuff...
	//
	// XXX should we support dialog.close(..)'s reject mode???
	__editor_fields__: {
		// Generic field...
		//
		// options format:
		// 	{
		// 		type: <type>,
		//
		// 		// NOTE: if this is not set then the id is used...
		// 		title: <str>,
		//
		// 		// value...
		// 		//
		// 		value: <value> | <func([value])>,
		//
		// 		// XXX not implemented...
		// 		doc: <str> | <func>, 
		//
		// 		...
		// 	}
		//
		field: function(actions, make, options){
			return make([
				options.title, 
				options.value instanceof Function ?
					options.value.call(actions)
					// NOTE: when .field(..) is called indirectly via one of 
					// 		the other field constructors this will not affect
					// 		the actual .value as options is cloned at this 
					// 		point.
					// 		This is an intended side-effect as setup should 
					// 		not have any effect on the value...
					// 		XXX revise...
					: options.value
			], options) },

		// Editable field...
		//
		// XXX need to set .value...
		//editable: function(actions, make, options){},

		// value toggle...
		//
		// options format:
		// 	{
		// 		values: <array> | <func([values])>,
		//
		// 		// if true this will only alow setting .value from .values...
		// 		nonstrict: <bool>,
		//
		// 		// XXX not implemented...
		// 		value_editable: <bool>,
		//
		//
		// 		// value list dialog...
		// 		//
		// 		// NOTE: <opts> is a .showList(..) / .showEditableList(..) 
		// 		//		compatible options object...
		// 		list: false | <opts> | <func(cur, callback(val))>,
		//
		// 		list_editable: <bool>,
		//
		// 		// XXX not implemented...
		// 		list_button: <str>,
		//
		//
		//		// if true will not call make.dialog.update() on value 
		//		// update...
		//		// XXX revise...
		//		doNotAutoUpdateDialog: <bool>,
		//
		//		...
		// 	}
		//
		//
		// NOTE: this extends .filed(..)
		toggle: function(actions, make, options){
			return this.field(actions, make, 
				Object.assign(
					options,
					{
						type: 'toggle',

						open: function(evt){
							var getValues = function(){
								return options.values instanceof Function ?
									options.values.call(actions)
								: options.values ?
									options.values	
								: ['off', 'on'] }
							var set = function(v){
								// get current value...
								v = arguments.length > 0 ? 
										v
									: options.value instanceof Function ?
										options.value.call(actions)
									: options.value 
								// normalize...
								// NOTE: we are re-getting the values here 
								// 		as it can get updated in options.list(..)
								// 		or via options.values(..)...
								if(!options.nonstrict){
									var values = getValues()
									v = values.includes(v) ?
										v
										: values[0] }
								// update the value...
								// NOTE: we update the local value iff set(..)
								// 		got an explicit value argument...
								// 		calling set(..) will not store anything,
								// 		just update the current state, either to
								// 		the already stored value or to the output
								// 		of .value(..)...
								arguments.length > 0
									&& (options.value instanceof Function ?
										(v = options.value.call(actions, v))
										: (options.value = v))
								elem.text(v)
								// update dialog...
								options.doNotAutoUpdateDialog
									|| make.dialog.update() }


							var elem = $(this).find('.text').last()
							var current = elem.text()
							var values = getValues()

							// editable list or more than 2 values -> show value list...
							if(options.list_editable 
									|| (values.length > 2 
										&& options.list !== false)){
								// call options.list(..)
								if(options.list instanceof Function){
									options.list.call(actions, current, set)

								// normal list...
								} else {
									// XXX mark the current value???
									var o = actions[
											options.list_editable ? 
												'showEditableList' 
												: 'showList'](
										values, 
										Object.assign({
												path: current,
												open: function(v){
													// update value...
													// XXX current is [[value]], check 
													// 		the upstream if this is correct...
													current = v[0][0]
													// NOTE: this is done first 
													// 		to update values...
													o.close()
													// update callable values...
													options.list_editable 
														&& options.values instanceof Function 
														&& options.values.call(actions, values) },
												close: function(){
													// NOTE: set(..) should be 
													// 		called after all the
													// 		dialog stuff is done...
													setTimeout(function(){ set(current) }) },
											}, 
											options.list !== true ? 
												options.list 
												: {}) ) }

							// directly toggle next value...
							} else {
								// XXX should we be able to toggle values back???
								set(values[(values.indexOf(current) + 1) % values.length]) }
						},
					},
					options
						// normalize value...
						.run(function(){
							if(!(this.value instanceof Function)){
								var values = options.values instanceof Function ?
										options.values.call(actions)
									: options.values ?
										options.values	
									: ['off', 'on']
								this.value = 
									this.value === undefined ?
										values[0]
									: values.includes(this.value) ?
										this.value
									: this.value ?
										'on'
									: 'off' } }))) },

		// attribute value toggle...
		//
		// options format:
		// 	{
		// 		// object on which the attribute manipulations are done...
		// 		obj: <obj> | <func>,
		//
		// 		// attribute name/key...
		// 		key: <str>,
		//
		// 		// attribute values source attribute/key...
		// 		values_key: <key>,
		//
		//
		// 		// attribute value translation dict/func...
		// 		value_translate: 
		// 			<func(value)> 
		// 			| {
		// 				<key>: <value>,
		// 				...
		// 			},
		//
		//
		// 		// if true the update is made on value change...
		// 		live_update: <bool>,
		//
		//
		// 		// callback if set, called after an update is made...
		// 		callback: <func(value, values)>,
		//
		//
		// 		// if set this will not update the config...
		// 		//
		// 		// NOTE: callback(..) is still called so the user can take
		// 		//		care of updating manually...
		// 		read_only: <bool>,
		//
		// 		...
		// 	}
		//
		//
		// NOTE: this extends .toggle(..)
		attrToggle: function(actions, make, options){
			var update = function(){
				if(!options.read_only){
					var obj = options.obj instanceof Function ?
						options.obj.call(actions)
						: options.obj
					'__value' in options
						&& (obj[options.key] = options.__value)
					'__values' in options
						&& (obj[options.values_key] = options.__values) }
				options.callback
					&& options.callback.call(actions, obj, options.__value, options.__values) }

			make.dialog
				.close(function(){
					options.live_update
						|| update() })

			return this.toggle(actions, make, 
				Object.assign(
					options,
					{
						//__value: null,
						value: function(value){
							var obj = options.obj instanceof Function ?
								options.obj.call(actions)
								: options.obj
							var d = options.value_translate
							// get...
							value = arguments.length > 0 ?
									value
								: '__value' in options ?
									options.__value
								: d instanceof Function ?
									d.call(actions, obj[options.key])
								: d ?
									d[obj[options.key]]
								: obj[options.key]
							// set...
							arguments.length != 0
								&& (options.__value = value)
								// live mode...
								&& options.live_update
									&& update()
							return value },

						//__values: null,
						values: function(value){
							var obj = options.obj instanceof Function ?
								options.obj.call(actions)
								: options.obj
							return arguments.length == 0 ?
									('__values' in options ?
										options.__values
										: obj[options.values_key].slice())
								: (options.__values = value) },
					},
					options)) },


		// Toggler-based field...
		//
		// options format:
		// 	{
		//		toggler: <toggler-name>,
		//
		//		...
		// 	}
		//
		toggler: function(actions, make, options){
			var update = function(){
				'__value' in options
					&& actions[options.toggler](options.__value) }

			make.dialog
				.close(function(){
					options.live_update
						|| update() })

			return this.toggle(actions, make, 
				Object.assign(
					options,
					{
						//__value: null,
						value: function(value){
							// get...
							value = arguments.length > 0 ?
									value
								: '__value' in options ?
									options.__value
								: actions[options.toggler]('?')
							// set...
							arguments.length > 0
								&& (options.__value = value)
							// live...
							options.live_update
								&& update() 
							return value },
						values: function(value){
							return actions[options.toggler]('??') },
						list_editable: false,
					},
					options)) },



		// Config editable value...
		//
		// XXX 
		//configEditable: function(){},


		// Config value toggle...
		//
		// NOTE: this is the same as .attrToggle(..) but sets options.obj
		// 		to actions.config...
		configToggle: function(actions, make, options){
			return this.attrToggle(actions, make, 
				Object.assign(
					options,
					{ obj: function(){
							return actions.config } },
					options)) },



		// XXX todo:
		// 		- date
		//		- ...
	},

	showEditor: ['- Interface/',
		core.doc`Make editor dialog or editor section...

			Make an editor dialog...
			.showEditor(spec)
			.showEditor(spec, callback)
				-> dialog
			
			Make an editor dialog section...
			.showEditor(make, spec)
			.showEditor(make, spec, callback)
				-> make


		 spec format:
			[
				// make a simple text element...
				//
				// same as: make(<text>)
				<text>,
				[<text>],
		
				// call make(..) with args...
				//
				// same as: make(...[ .. ])
				//
				// NOTE: to explicitly pass an array object to make wrap it 
				//		in an array, e.g. [['text', 'value']]
				[ .. ],
		

				// make a field...
				{
					type: <type>,
		
					id: <str>,
					title: <str>,
		
					value: <str>,
		
					...
				},
		
				...
			]


		
		NOTE: for examples see: .exampleEditor(..) and .exampleEmbededEditor(..)
			of 'ui-action-examples' feature...
		`,
		makeUIDialog(function(spec, callback){
			var that = this

			var _build = function(make, spec, cb){
				var that = this
				callback = cb
				var fields = this.__editor_fields__ 
					|| EditorActions.__editor_fields__
					|| {}
				;(spec || [])
					.forEach(function(field){
						// array...
						field instanceof Array ?
							make(...field)
						// spec...
						: field instanceof Object ?
							fields[field.type || 'field'](that, make, field)
						// other...
						: make(field) }) 
				return make }
			var _callback = callback
				&& function(spec){
					return callback(
						// get the field-value pairs...
						spec.reduce(function(res, e){
							var id = e.id || e.title
							id != undefined
								&& (res[id] = e.value instanceof Function ? 
									e.value.call(that) 
									: e.value)
							return res }, {}), 
						// NOTE: technically we do not need to pass this
						// 		through as we are mutating the data inside
						// 		but passing it here is cleaner than forcing
						// 		the user to get it via closure...
						spec) } 

			return arguments[0] instanceof Function ?
				// inline...
				_build.call(this, ...arguments)
				// dialog...
				: browse.makeLister(null, 
					function(p, make){
						_build.call(that, make, spec, callback) 
					}, { 
						cls: 'table-view',
						close: function(){
							_callback
								&& _callback(spec)
							// prevent calling the callback more than once...
							// XXX fixing a double .close() bug...
							_callback = null 
						},
					}) })],
})

var Editor =
module.Editor = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-editor',
	depends: [
		'ui',
		'ui-dialogs',
	],

	actions: EditorActions,
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
			return a + feature2lnk(b) + c }) }

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
		.replace(/XXX/g, '<span class="warning">XXX</span>') }
	
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
					: `${a}<a href="#" onclick="ig.showDoc('${c}')">${b}</a>` }) }


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
			actions = 
				(actions instanceof Array ? 
					actions 
					: [actions])
				// resolve action objects...
				.map(function(action){
					return typeof(action) == 'function' ?
						action.name
						: action })

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
	// XXX add specific action doc if available....
	showCode: ['- Help/Show action code...',
		makeUIDialog(function(action){
			action = action instanceof Array ? 
				action[0] 
				: action
			action = typeof(action) == 'function' ?
				action.name
				: action
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
								.flat()
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
		// XXX need to define an interface verb/keyword language and use
		// 		it to sort an prioritize stuff...
		'action-category-order': [
			'99:$File',
				// ...
				// We can order any sub-tree we want in the same manner 
				// as the root...
				'File/-80:Clear viewer',
				'File/-90:Close viewer',
				// Non existing elements will not get drawn...
				//'File/-99:moo',
			'99:$Edit',
				'Edit/90:Undo',
				'Edit/90:Redo',
				'Edit/85:$Copy image',
				'Edit/85:.*copy.*',
				'Edit/85:.*paste.*',
				'Edit/85:.*base.*',
				'Edit/80:.*sort.*',
				'Edit/80:.*order.*',
				'Edit/75:.*group.*',
				'Edit/70:.*shift.*marked.*',
				'Edit/70:.*shift.*',
				'Edit/60:.*rotate.*',
				'Edit/50:.*flip.*',
				// ...
			'$Navigate',
				'Navigate/90:.*image.*',
				'Navigate/80:.*screen.*',
				'Navigate/70:.*ribbon.*',
				// ...
			'$Image',
				'Image/99:$Copy image',
				'Image/99:.*copy.*',
				'Image/99:.*paste.*',
				'Image/98:.*editor.*',
				'Image/98:.*folder.*',
				'Image/95:.*metadata.*',
				'Image/90:.*image mark.*',
				'Image/85:.*image bookmark.*',
				'Image/80:.*tags.*',
				'Image/75:.*image.*collection.*',
				'Image/70:.*shift.*marked.*',
				'Image/65:.*shift.*',
				'Image/60:.*rotate.*',
				'Image/55:.*flip.*',
				// ...
				'Image/-70:---',
				'Image/-70:.*remove.*',
			'$Virtual block',
				'Virtual block/90:.*add.*',
				'Virtual block/80:.*clone.*',
				'Virtual block/70:.*edit.*',
				'Virtual block/60:.*mark.*',
				'Virtual block/50:---',
				'Virtual block/40:.*crop.*',
				// ...
			'$Ribbon',
				'Ribbon/80:set.*',
				'Ribbon/70:.*shift.*',
				'Ribbon/60:.*merge.*',
				'Ribbon/50:Flatten',
				'Ribbon/40:.*split.*',
				'Ribbon/30:.*crop.*',
				'Ribbon/20:.*order.*',
				'Ribbon/20:.*align.*',
				// ...
				'Ribbon/-60:Add.*collection.*',
				'Ribbon/-70:---',
				'Ribbon/-70:.*remove.*',
			'$Crop',
				'Crop/80:Crop $marked images',
				'Crop/80:Crop $bookmarked images',
				'Crop/70:$Crop',
				'Crop/70:Crop $flatten',

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

				'Crop/60:.*tag.*',

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

				// ...
				'Crop/-50:---',
				'Crop/-60:Remove from crop',
				'Crop/-70:Remove ribbon.*',
				'Crop/-71:Remove marked.*',
				'Crop/-72:.*remove.*',
				'Crop/-75:---',
				'Crop/-80:Uncrop keeping image order',
				'Crop/-81:Uncrop all',
				'Crop/-82:$Uncrop',
			'Co$llections',
				// ...
				'Collections/-50:.*exit.*',
				'Collections/-60:.*edit.*',
				'Collections/-70:---',
				'Collections/-70:.*remove.*',
			'$Tag',
				// ...
				// XXX revise...
				'Tag/-80:---',
				'Tag/-90:.*remove.*',
			'$Mark',
				// ...
				'Mark/-75:.*collection...',
				'Mark/-80:---',
				'Mark/-80:.*remove.*',
				'Mark/-90:.*unmark.*',
			'$Bookmark',
				// ...
				'Bookmark/-80:---',
				'Bookmark/-80:.*remove.*',

			// ...

			'-40:Interface',
				'Interface/90:Theme',
				// ...
			'-50:$Workspace',
			'-60:System',
			'-70:$Help',
			'-80:---',
			'-90:Development',
			'-90:Experimental',
			'-90:Test',
		],

		'browse-actions-settings': {
			showDisabled: true,
			showHidden: false,
			showEmpty: false,
		},

		'browse-actions-keys': 'on',

		'browse-actions-shortcut-marker': '\\$(\\w)',

		//'browse-advanced-mode': undefined, 
	},

	// Hide .alias(..) action from the browser...
	//
	// NOTE: we need to do this as .alias(..) is defined in actions and
	// 		has no concept of the naming protocols used in ImageGrid.Viewer
	// NOTE: this essentially defines and empty alias and puts it in
	// 		'System/' hidden...
	alias: ['- System/', ''],

	// NOTE: we are avoiding handling the lister actions here (action 
	// 		paths ending with '*') as they are active while .getActions(..)
	// 		should be as independent as possible and never trigger any 
	// 		side-effects...
	// 		...the same can be said about handling visibility tests.
	// 		XXX REVISE:
	// 			...considering that listers should have no side-effects 
	// 			(on list), not listing here may be too "defensive"...
	// 			...on the other hand this could be done via an extra 
	// 			action/function that would expand active stuff (renaming
	// 			this to .getActionsPassive(..) and that to .getActionsActive(..))
	getActions: ['- System/',
		core.doc`List actions in action tree...

			Build tree and return it...
			.getActions('raw'[, tree])
				-> tree

			Get sup-tree/action at path...
			.getActions(path[, tree])
				-> sub-tree
				-> action


		This is used by .browseActions(..) to list the actions to be 
		drawn in the action menu.
		

		Action tree format:
			{
				// sub-tree...
				<name>: <tree>,
		
				// action...
				<name>: [
					<action-name>,
					// mode...
					'disabled' | 'hidden',
				],
		
				...
			}
		`,
		function(path, tree){
			var actions = this

			var PRIORITY = /^(-?[0-9]+)\s*:\s*/
			var MARKER = RegExp(this.config['browse-actions-shortcut-marker'], 'g')

			// Sort tree level in-place...
			//
			// NOTE: this will remove the priority unless raw_keys is set...
			var sortTree = function(tree, raw_keys){
				var level = Object.keys(tree)
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
						var text = !raw_keys ? 
							key.replace(PRIORITY, '').trim()
							: key 

						// remove the key form old position...
						var value = tree[key]
						delete tree[key]

						// skip patterns...
						if(!raw_keys && /\.\*/.test(key)){
							return
						}

						// place the key in correct order...
						tree[text] = value

						// go down the tree...
						value 
							&& !(value instanceof Array)
							&& sortTree(value, raw_keys)
					}) 
				return tree
			}

			// Get item from tree level taking into account additional 
			// syntax like prioority...
			//
			// returns:
			// 	[<existing-text>, <new-level>]
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

			// Tree builder...
			//
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

			// if no tree is given, build one...
			if(tree == null){
				tree = {}

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

				// sort the tree...
				sortTree(tree, path == 'raw')
			}

			// return the raw tree...
			if(path == 'raw'){
				return tree
			}

			// prepare path...
			path = path || '/'
			path = (path instanceof Array ? path : path.split(/[\\\/]/g))
				.filter(function(e){ return e.trim() != '' })

			// get the tree node...
			var cur = tree
			var rest = path.slice()
			while(rest.length > 0 && !('*' in cur)){
				cur = getItem(cur, rest.shift()).pop() || {}
			}

			return cur
		}],

	// XXX can we do a deep search on '/' -- find any nested action???
	// 		...or rather a search from this level and down...
	// XXX can this also do a flat mode???
	// 		...this would help with the (global) search -- switch to 
	// 		flat if searching in root mode...
	browseActions: ['Interface/Dialog/Actions...',
		{mode: 'advancedBrowseModeAction'},
		core.doc`Browse actions dialog...

		This uses action definition to build and present an action tree.

		This supports the following element (action doc) syntax:
			- '/' separated action path (action short doc) to indicate the
			  path to action.

			- leading path element number followed by colon to indicate 
			  element priority on level.
				Example:
					'Path/99: To/50:Element'
			  NOTE: multiple path elements may have multiple priorities.
			  NOTE: an item with positive priority will be above and item 
					with less or no priority.
			  NOTE: an item with negative priority will be below any item 
					with greater or no priority.

			- leading '-' in path to indicate a hidden/disabled element.
				Example: 
					'- Path/To/Element'			(disabled/hidden)
					'- 99:Path/To/Element'		(disabled/hidden)
					'Path/To/Other element'		(enabled)



		Action mode (disabled/hidden) and also be controlled dynamically:

		Expected modes:
			'hidden'		- hide the action from dialog
			'disabled'		- disable the action in dialog
			...				- other values are ignored

		NOTE: disabling in path has priority over .mode(), thus
			it is possible to hide/disable an enabled item but not
			possible to enable a disabled by default path.
		NOTE: .mode() can be defined in any action in chain,
			though only the last one is called...

		For more info see .getActionMode(..)



		options format:
			{
				callback: <function>,
				no_disabled: false,
				no_hidden: false,

				// if true then the action tree will get rebuilt live on
				// each list navigation... 
				live_tree: true,
			}


		NOTE: if the action returns an instance of overlay.Overlay this
				will not close right away but rather bind to:
					overlay.close			-> self.focus()
					overlay.client.open		-> self.close()
		NOTE: we are not using the browse.PathList(..) here as we need 
				custom controls and special path handling...
		NOTE: this will keep the first instance title it encounters, this
				if a later instance includes a priority, it will be ignored.
				This may happen if several actions are in the same path and
				each one set a different priority in that path...
				...to avoid this use .config['action-category-order'] to set
				base order/priorities...
		`,
		makeUIDialog(function(path, options){
			var actions = this
			options = Object.assign({
				// defaults...
				no_disabled: false,
				no_hidden: false,
				live_tree: true,
			}, options || {})

			var MARKER = RegExp(this.config['browse-actions-shortcut-marker'], 'g')

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

			// Get action browse mode (disabled or hidden)...
			//
			// NOTE: this will cache and reuse action's mode, this
			// 		will make things faster when lots of actions use the 
			// 		same mode test (alias)...
			var mode_cache = {}
			var getMode = function(action){
				return actions.getActionMode(action, mode_cache) }

			// Wait for dialog...
			var waitFor = function(dialog, child){
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
			}.bind(this)

			// pre-cache the action tree... 
			var tree = !options.live_tree ? 
				actions.getActions('/')
				: null 

			// now for the dialog...
			return browse.makeLister(null, function(path, make){
				var that = this
				var cur = actions.getActions(path.slice(), tree)

				// reset mode cache...
				// NOTE: we reset the cache to allow state changes while
				// 		navigating...
				mode_cache = {}

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
					Object.keys(cur)
						.forEach(function(key){
							// Item: action...
							if(cur[key] instanceof Array){
								var action = cur[key][0]
								var mode = cur[key][1]

								// handle live modes...
								mode = mode || getMode(action)

								// Action: toggler -> add toggle button...
								if(actions.isToggler && actions.isToggler(action)){
									make(key + '/', { 
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
													that.select('"'+ key +'"')
												}],
											//[getKeys(action)],
										],
										open: function(){
											options.callback ?
												options.callback.call(actions, action)
												: actions[action]()

											that.update()
											that.select('"'+ key +'"')
										},
									})

								// Action: normal...
								} else {
									make(key, {
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
													: waitFor(make.dialog, actions[action]())
											},
										})
								}

							// Item: dir...
							// XXX need to check if this is empty...
							// 		...do not draw if nothing will be visible inside...
							// XXX this will hide non-empty dirs containing only hidden stuff
							// 		...should such dirs still be treated as empty???
							} else if(actions.config['browse-actions-settings'].showEmpty 
									|| (cur[key] != null
										&& Object.keys(cur[key]).length > 0)){
								var p = '/'+ path.concat([key]).join('/') +'/'
								p = MARKER ? p.replace(MARKER, '$1') : p
								make(key + '/', { 
									push_on_open: true,
									attrs: {
										keys: [
											getKeys('browseActions: "'+ p +'"'), 
											getKeys('browseActions!: "'+ p +'"'), 
										].filter(function(e){ return e.trim() != '' }).join(' / '),
									},
									// hide dirs containing only hidden stuff...
									// XXX this will only check statically hidden stuff...
									// 		...the rest may still get dynamically hidden...
									hidden: options.no_hidden ? 
										false
										// hide dirs containing only (statically) 
										// hidden items...
										// NOTE: we are not checking mode 
										// 		of other items actively here at 
										// 		this point to avoid side-effects...
										: Object.keys(cur[key])
											.filter(function(k){ 
												return (cur[key][k] || [])[1] != 'hidden' })
								   			.length == 0,
								})

							// item: line...
							} else if(/---+/.test(key)){
								make('---')
							}
						})
				}
			},
			 cfg)
			// save show disabled state to .config...
			.on('close', function(){
				var config = actions.config['browse-actions-settings'] 

				config.showDisabled = this.options.showDisabled
				config.showHidden = this.options.showHidden
			})
			.run(function(){
				actions.config['browse-actions-keys'] 
					&& this.dom.addClass('show-keys')

				// handle '?' -- show doc...
				var showDoc = this.showDoc = function(){
					var action = this.select('!').attr('action')
					action 
						&& actions.showDoc(action)
				}
				this.keyboard.handler('General', '?', 'showDoc')
				this.menu(showDoc.bind(this))

				// handle ctrl-a -- toggle advanced mode...
				var toggleAdvanced = this.toggleAdvanced = function(){
					actions.toggleBrowseAdvanced() 
					this.update() 
				}
				this.keyboard.handler('General', 'ctrl-a', 'toggleAdvanced')
			}) })],

	// XXX revise...
	advancedBrowseModeAction: ['- System/',
		core.doc`advanced action (placeholder)

		This is mainly used to indicate other actions as advanced mode only.
		
		Example:
			someAction: ['Menu/Path/Some action',
				// show up only in advanced browse mode...
				{mode: 'advancedBrowseModeAction'},
				function(){
					...
				}],
		`,
		{mode: function(){ 
			return this.advancedBrowseModeAction() }},
		function(){
			// Placeholder action, not for direct use...
			//
			// See doc for more info: 
			// 	.showDoc('advancedBrowseModeAction')
			return this.config['browse-advanced-mode'] != 'on' 
				&& 'hidden' 
				|| 'visible' }],

	toggleBrowseAdvanced: ['System|Interface/-99: Advanced menu items',
		core.doc`Toggle advanced menu items...

		An item can:
			- define a .mode() mothod
			- check .config['browse-advanced-mode'] to be 'on' / 'off'
			- return 'hidden' when needed
		or:
			- link to an action that behaves in a desired way:
				{mode: 'advancedBrowseModeAction',}

		See .toggleBrowseActionKeys(..) for an example.
		`,
		core.makeConfigToggler(
			'browse-advanced-mode', 
			['off', 'on'])],

	toggleBrowseActionKeys: ['Interface/Show keys in menu',
		{mode: 'advancedBrowseModeAction'},
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
			{mode: 'advancedBrowseModeAction'},
			uiDialog(function(){
				return this.current ?
					this.browseActions('/Image/')
					: this.browseActions() })],
	}),

	handlers: [
		// XXX FireFox: get actual event...
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
						.on('contextmenu', function(evt){
							evt = window.event || evt
							evt.preventDefault()
							evt.stopPropagation()

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

// XXX show button iff the action is present...
// XXX add context menu action to buttons...
var ButtonsActions = actions.Actions({
	config: {
		// can be:
		// 	'hidden'	- draw hidden
		// 	'disabled'	- draw disabled (XXX needs propper CSS)
		// 	'none'		- do not draw
		// 	'visible'	- force draw
		//
		// XXX should this be more granular???
		'unusable-button-draw-mode': 'none',

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
				'slideshowButtonAction -- Slideshow',
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
			[SETTINGS_ICON]: ['ui-settings always-shown', [
				'browseActions: "Interface/" -- Interface settings...',
				'toggleSideButtons -- Toggle touch controls',
			]],
			'_': ['minimize always-shown', 
				'minimize -- Minimize'],
			'&#8601;': ['fullscreen always-shown', 
				'toggleFullScreen -- Toggle fullscreen'],
			'&times;': ['close always-shown', 
				'close -- Quit'],
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
	},

	toggleMainButtons: ['Interface/Main buttons',
		{mode: 'advancedBrowseModeAction'},
		makeButtonControlsToggler('main-buttons')],
	toggleSecondaryButtons: ['Interface/Secondary buttons',
		{mode: 'advancedBrowseModeAction'},
		makeButtonControlsToggler('secondary-buttons')],
	toggleAppButtons: ['Interface/App buttons',
		{mode: 'advancedBrowseModeAction'},
		makeButtonControlsToggler('app-buttons')],

	toggleMinimizeButton: ['Interface/Minimize button',
		core.makeConfigToggler('minimize-button',
			['on', 'off'],
			function(state){
				this.dom
					&& (state == 'on' ?
						this.dom.find('.buttons .minimize').css('display', '')
						: this.dom.find('.buttons .minimize').css('display', 'none')) })],

	toggleSideButtons: ['Interface/70: Touch buttons', 
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
				this.toggleAppButtons('on') }],
		// NOTE: these need to be loaded AFTER the .config has been loaded...
		['start', 
			function(){ 
				this.toggleMainButtons(this.config['main-buttons-state'] || 'on')
				this.toggleSecondaryButtons(this.config['secondary-buttons-state'] || 'on')
				this.toggleSideButtons(this.config['side-buttons-state'] || 'on')

				this.toggleMinimizeButton('!') }],

		// update crop button status...
		[[
			'load',
			'clear',
			'reload',
		], 
			function(){
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
						: l) }],
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
					.text(l > 99 ? 
							'99+' 
						: l == 0 ? 
							''
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
		[['toggleSlideshow', 'toggleSlideshowTimer'],
			function(){
				var mode = this.toggleSlideshow('?')
				mode = (mode == 'on' 
						&& this.toggleSlideshowTimer('?') == 'paused') ?
					'paused'
					: mode
				// update the button icon...
				$('.main-buttons.buttons .slideshow.button')
					.html(mode == 'on' ? 
							'&#9724;' 
						: mode == 'paused' ?
							'&#10074;&#10074;'
						//'&#9723;'
						: '&#9655;') 
					.run(function(){
						mode == 'paused' ?
							this.addClass('visible')
							: this.removeClass('visible') }) }],
		// update zoom button status...
		['viewScale', 
			function(){
				$('.secondary-buttons.buttons .zoom.button sub')
					.text(Math.round(this.screenwidth)) }],
		// update fullscreen button...
		['start toggleFullScreen', 
			function(){
				if(this.toggleFullScreen){
					var fullscreen = this.toggleFullScreen('?')
					var buttons = this.dom.find('.app-buttons')
					
					// fullscreen button...
					buttons.find('.fullscreen.button')
						.html(fullscreen == 'on' ? '&#8601;' : '&#8599;')
						.attr('info', fullscreen == 'on' ? 'Exit fullscreen' : 'Fullscreen')

					// XXX should this be done by css???
					if(fullscreen == 'on'){
						buttons.find('.button:not(.always-shown)').show()

					} else {
						buttons.find('.button:not(.always-shown)').hide()
					}

					//this.toggleFullScreenControls(fullScreen)
				} }],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
