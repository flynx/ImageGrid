/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var toggler = require('../toggler')
var keyboard = require('../keyboard')
var object = require('../object')
var widget = require('./widget')



/*********************************************************************/



//---------------------------------------------------------------------
// Helpers...

// Collect a list of literal values and "make(..) calls" into an array...
//
//	collectItems(context, items)
//		-> values
//
//
// items format:
// 	[
// 		// explicit value...
// 		value,
//
// 		// literal make call...
// 		make(..),
//
// 		...
// 	]
//
// NOTE: this will remove the made via make(..) items from .items thus the
// 		caller is responsible for adding them back...
// NOTE: this uses the make(..) return value to implicitly infer the items
// 		to collect, thus the items must already be constructed and in 
// 		the same order as they are present in .items
// 		...also, considering that this implicitly identifies the items 
// 		passing the make function without calling it can trick the system
// 		and lead to unexpected results.
// NOTE: for examples see: Item.nest(..) and Item.group(..)
//
// XXX would be nice to have a better check/test...
// 		...this could be done by chaining instances of make instead of 
// 		returning an actual function, i.e. each make call would return 
// 		a "new" function that would reference the actual item (.item())
// 		and the previous item created (.prevItem()), ... etc.
// 		...this would enable us to uniquely identify the actual items 
// 		and prevent allot of specific errors...
var collectItems = function(make, items){
	items = items instanceof Array ? 
		items 
		: [items]
	var made = items
		.filter(function(e){
			return e === make })
	// constructed item list...
	// ...remove each instance from .items
	made = make.items.splice(
		make.items.length - made.length, 
		made.length)
	// get the actual item values...
	return items
		.map(function(e){
			return e === make ?
				made.shift()
				// raw item -> make(..)
				: (make(e) 
					&& make.items.pop()) }) }



//---------------------------------------------------------------------
// Item constructors...

var Items =
object.mixinFlat(function(){}, {
	dialog: null,
	called: false,


	// Props...
	//
	// NOTE: writing to .items will reset .called to false...
	__items: undefined,
	get items(){
		return this.__items },
	set items(value){
		this.called = false
		this.__items = value },

	
	// Bottons...
	//
	// Format:
	// 	{
	// 		// Button generator...
	// 		<name>: function(item, attr),
	//
	// 		<name>: [
	// 			// text...
	// 			//
	// 			// NOTE: code is resolved to .buttons[action](..), i.e.
	// 			//		a button can reuse other buttons to generate its
	// 			//		text...
	// 			<code> | <html> | function(item),
	//
	// 			// action (optional)...
	// 			//
	// 			// NOTE: code is resolved to .dialog[action](..)
	// 			<code> | function(item),
	//
	// 			// disabled predicate (optional)...
	// 			function(item),
	//
	// 			// attrs (optional)...
	// 			{
	// 				<name>: <value> | function(item),
	// 				...
	// 			},
	// 		],
	//
	// 		...
	// 	}
	//
	buttons: {
		//
		// 	Draw checked checkboz is <attr> is true...
		// 	Checkbox('attr')
		//
		// 	Draw checked checkboz is <attr> is false...
		// 	Checkbox('!attr')
		//
		// XXX rename -- distinguish from actual button...
		Checkbox: function(item, attr=''){
			return (attr[0] == '!' 
						&& !item[attr.slice(1)]) 
					|| item[attr] ? 
				'&#9744;' 
				: '&#9745;' },

		// XXX can we make these not use the same icon...
		ToggleDisabled: [
			'Checkbox: "disabled"',
			'toggleDisabled: item',
			true,
			{
				alt: 'Disable/enable item',
				cls: 'toggle-disabled',
			}],
		ToggleHidden: [
			'Checkbox: "hidden"',
			'toggleHidden: item',
			{
				alt: 'Show/hide item',
				cls: 'toggle-hidden',
			}],
		ToggleSelected: [
			'Checkbox: "selected"',
			'toggleSelect: item',
			{
				alt: 'Select/deselect item',
				cls: 'toggle-select',
			}],
		// NOTE: this button is disabled for all items but the ones with .children...
		ToggleCollapse: [
			function(item){
				return !item.children ?
						// placeholder...
						'&nbsp;'
					: item.collapsed ?
						'+'
					: '-' },
			'toggleCollapse: item',
			// disable button for all items that do not have children...
			function(item){ 
				return 'children' in item },
			{
				alt: 'Collapse/expand item',
				cls: function(item){ 
					return 'children' in item ? 
						'toggle-collapse' 
						: ['toggle-collapse', 'blank'] },
			}],

		// NOTE: this requires .markDelete(..) action...
		Delete: [
			'&times;',
			'markDelete: item',
			{
				alt: 'Mark item for deletion',
				cls: 'toggle-delete',
				//keys: ['Delete', 'd'],
			}],
	},


	// Utils...

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
	// XXX doc: instruct access to the parent context...
	// 		this.__proto__.* ???
	// XXX TEST...
	makeSubContext: function(name, obj){
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
		return this[name] },



	// Getters...

	// Last item created...
	// XXX not sure about this...
	// XXX should this be a prop???
	last: function(){
		return (this.items || [])[this.items.length - 1] },


	// Constructors/modifiers...

	// Group a set of items...
	//
	//	.group(make(..), ..)
	//	.group([make(..), ..])
	//		-> make
	//
	//
	// Example:
	// 	make.group(
	// 		make('made item'),
	// 		'literal item',
	// 		...)
	//
	//
	// NOTE: see notes to collectItems(..) for more info...
	//
	// XXX should groups have options??
	group: function(...items){
		var that = this
		items = items.length == 1 && items[0] instanceof Array ?
			items[0]
			: items
		// replace the items with the group...
		this.items.splice(this.items.length, 0, collectItems(this, items))
		return this },

	// Place list in a sub-list of item...
	//
	// Examples:
	// 	make.nest('literal header', [
	// 		'literal item',
	// 		make('item'),
	// 		...
	// 	])
	//
	// 	make.nest(make('header'), [
	// 		'literal item',
	// 		make('item'),
	// 		...
	// 	])
	// 	
	// XXX should options.collapsed and friends be set in item or in 
	// 		options???
	// 		...options does not work but seems obvious...
	// 		XXX BUG???
	// XXX this should accept the results of list constructors like 
	// 		.EditableList(..) and friends...
	nest: function(item, list, options){
		options = Object.flatCopy(options || {})
		//options = Object.assign(Object.create(this.options || {}), options || {})
		options = Object.assign({},
			{ children: list instanceof Array ?
				collectItems(this, list)
				: list },
			Object.flatCopy(options || {}))
		return item === this ?
			((this.last().children = options.children), this)
			: this(item, options) },

	// XXX doc...
	// XXX REVISE callback mechanics...
	// XXX TEST...
	batch: function(spec, callback){
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
		return this },



	// Wrappers...

	// this is here for uniformity...
	Item: function(value, options){ 
		return this(...arguments) },

	Empty: function(options){
		return this('', options) },

	Separator: function(){ 
		return this('---') },
	Spinner: function(){ 
		return this('...') },

	Heading: function(value, options){
		var cls = 'heading'
		options = options || {}
		options.cls = options.cls instanceof Array ? 
				options.cls.concat([cls])
			: typeof(options.cls) == typeof('str') ?
				options.cls +' '+ cls
			: [cls]
		options.buttons = options.buttons 
			|| this.dialog.options.headingButtons
		return this(value, options) },
	// XXX multi-line text....
	Text: function(value, options){},

	Action: function(value, options){},
	// XXX for list value edit only the last element as default...
	Editable: function(value){},

	// lists...
	// XXX how is this different from .group(..) or .batch(..)???
	// 		...or is this just the following???
	// 			function(...args){
	// 				return this.group(
	// 					this.batch(...args)) }
	//List: function(values){},

	// XXX actions:
	// 		- add/remove
	// 		- place
	EditableList: function(values){},
	EditablePinnedList: function(values){},

	// Special list components...
	//Items.ListPath = function(){},
	//Items.ListTitle = function(){},

	// XXX EXPERIMENTAL...
	//
	// options:
	// 	{
	// 		showOKButton: <bool>,
	//
	// 	}
	//
	Confirm: function(message, accept, reject, options){
		return this(message, 
			Object.assign({
				// XXX should the user be able to merge buttons from options???
				buttons: [
					...(reject instanceof Function ?
						[['$Cancel', reject]]
						: []),
					...(accept instanceof Function 
							&& (options || {}).showOKButton ?
						[['$OK', accept]]
						: []), ], 
				},
				accept ? 
					{open: accept}
					: {},
				options || {})) },


	// Generators...
	//
	// A generator is a function that creates 1 or more elements and sets up
	// the appropriate interactions...
	//
	// NOTE: these can work both as item generators called from inside 
	// 		.make(..), i.e. as methods of the make constructor, or as
	// 		generators assigned to .__header__ / .__items__ / .__footer__
	// 		attributes...
	// NOTE: when re-using these options.id needs to be set so as not to 
	// 		overwrite existing instances data and handlers...

	// Make item generator...
	//
	makeDisplayItem: function(text, options){
		var args = [...arguments]
		return function(make, options){
			make(...args) } },

	// Make confirm item generator...
	//
	// XXX move this to Item.Confirm(..) and reuse that...
	makeDisplayConfirm: function(message, accept, reject){
		return this.makeDisplayItem(message, {
			buttons: [
				...[reject instanceof Function ?
					['Cancel', reject]
					: []],
				...[accept instanceof Function ?
					['OK', accept]
					: []], ], }) },

	// Focused item path...
	//
	// NOTE: this can be called as section generators, so they must 
	// 		comply the func(make, options) signature...
	//
	// XXX add search/filter field...
	// XXX add path navigation...
	DisplayFocusedPath: function(make, options){
		options = make instanceof Function ?
			options
			: make
		options = options || {}
		make = make instanceof Function ?
			make
			: this
		var dialog = this.dialog || this
		var tag = options.id || 'item_path_display'
		// indicator...
		var e = make('CURRENT_PATH', 
				Object.assign(
					{
						id: tag,
						cls: 'path', 
					},
					options))
			.last()
		// event handlers...
		dialog 
			.off('*', tag)
			.on('focus', 
				function(){
					e.value = this.pathArray
					e.update() },
				tag) 
		return make },

	// Item info...
	//
	// Show item .info or .alt text.
	//
	// This will show info for items that are:
	// 	- focused
	// 	- hovered (not yet implemented)
	//
	// NOTE: this can be called as section generators, so they must 
	// 		comply the func(make, options) signature...
	//
	// XXX use focused elements and not just item...
	// XXX add on mouse over...
	DisplayItemInfo: function(make, options){
		options = make instanceof Function ?
			options
			: make
		options = options || {}
		make = make instanceof Function ?
			make
			: this
		var dialog = this.dialog || this
		var tag = options.id || 'item_info_display'

		// indicator...
		var e = make('INFO', 
				Object.assign(
					{
						id: tag,
						cls: 'info',
					},
					options))
			.last()
		// event handlers...
		dialog
			.off('*', tag)
			.on('focus',
				function(){
					var focused = this.focused
					e.value = focused.doc
						|| focused.alt
						|| '&nbsp;'
					e.update() },
			tag) 
		return make },


	// Instance constructors...
	//
	__new__: function(_, dialog, constructor){
		var that = function(){
			that.called = true
			constructor.call(that, ...arguments)
			return that }
		return that },
	__init__: function(dialog){
		this.items = []
		this.dialog = dialog },
})



// XXX do we need a custom handler here???
// XXX do we add defaults to options???
var makeFieldWrapper = function(name){
	return function(title, value, options){
		return this.__proto__[name]([title, value], options) } }


// Sub-context: .field
//
// 	[ title		value		... ]
//
// A field is an item that contains a title and a value...
//
Items.makeSubContext('field', 
	// base field handler...
	//
	//	.field(title, value[, options])
	//
	// NOTE: this is a shorthand to:
	// 		make([title, value], ..)
	Object.assign(function(title, value, options){
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
		], options) }, 
	{
		// Shorthands...
		Text: makeFieldWrapper('Text'),
		// XXX would be nice to force the title to be on a separate line 
		// 		from the text...
		Editable: makeFieldWrapper('Editable'),

		// XXX test...
		EditableList: function(title, ...args){
			this.nest(
				this.__proto__(title),
				this.__proto__.EditableList(...args)) },

		// Togglable field value...
		//
		// XXX should we have a version of this with the value in a button
		// 		a-la how toggler values are handled in .browseActions(..)
		// 		...this can also be an option...
		// 		......should this be a generic toggle (outside of .field)???
		// XXX would be nice to be able to expand the options in several 
		// 		modes:
		// 			- new dialog -- need a wrapper...
		// 			- nested dialog
		// 				collapse on exit
		// 			- nested dialog (exclusive)
		// 				focus locked
		// 				accept or abort closes nested dialog
		// 			- redraw the whole dialog...
		// XXX
		Toggle: function(title, options){
		},
	}))


var Make = 
module.Make = 
	object.Constructor('Make', Items)



//---------------------------------------------------------------------
// Base Item...

var BaseItemClassPrototype = {
	text: function(elem){
		return elem.value instanceof Array ?
				elem.value.join(' ')	
			: elem.value == null || elem.value instanceof Object ?
				elem.alt || elem.__id 
			: elem.value },
}

var BaseItemPrototype = {
	parent: null,
	
	// children: null,
	//
	// id: null,
	// value: null,
	// alt: null,
	//
	// dom: null,
	//
	// focused: null,
	// disabled: null,
	// selected: null,
	// collapsed: null,
	
	// item id if explicitly set otherwise its .text...
	//
	// NOTE: this will not fall into infinite recursion with .text as 
	// 		the later accesses .__id directly...
	get id(){
		return this.__id || this.text },
	set id(value){
		this.__id = value },

	// normalized .value, .alt or .__id
	get text(){
		return this.constructor.text(this) },

	// NOTE: we are intentionally not including .index here as there are 
	// 		multiple ways to get and index...

	get pathArray(){
		var r = (this.parent || {}).root
		return r ? 
			r.pathOf(this)
			: undefined },
	get path(){
		return (this.pathArray || []).join('/') },

	get index(){
		var r = (this.parent || {}).root
		return r ? 
			r.indexOf(this)
			: undefined },


	// NOTE: these should not clash with user-supplied handlers ('update' does not)...
	//
	// XXX BUG: calling this on a nested/inlined browser will mess things up...
	// 		...the issue seems to be with root options not being available
	// 		for partial render in a nested context...
	// 		...one way to fix this would be to make the options inheritance
	// 		protocol more strict:
	// 			- if no options given use defaults (i.e. this.options)
	// 			- if options given use as-is
	// 			- defaults are taken from this.options if not present 
	//
	// 		to reproduce:
	//			dialog.disable('2')	
	//		or:
	//			dialog.disable('B/C/D/a')	
	//
	//		...in both cases the whole nested browser disappears...
	//
	//		but this works OK:
	//			dialog.disable('nested/2')
	//
	//		This issue seems to go away after expanding/collapsing the
	//		nested item several times, the buttons are gone but the 
	//		subtrees stop vanishing on update -- could this be related 
	//		to .dom/.elem again???
	//
	//		...there are likely two issues at play here:
	//			1) the options related stuff -- non-rendered buttons...
	//				...try and rework all the option handling to either 
	//				avoid inheritance (via .flatCopy(..)) or to work it 
	//				into recursion correctly...
	//			2) .dom/.elem related stuff -- .update() removes buttons...
	update: function(options){
		this.parent
			&& this.parent.render(this, options)
		return this },
	/* XXX this is disabled to avoid user confusion when a user item 
	// 		event handler would not call/replicate the top-level (this)
	// 		functionality and this break code relying on it...
	// 		...for this to work well need to either:
	// 			- separate item options form the item object,
	// 			- force the user to follow strict protocols,
	// 			- use a proxy when accessing items (reverse of #1) 
	// 		XXX this also applies to .update(..) above...
	focus: function(){ 
		arguments.length == 0 
			&& this.parent
			&& this.parent.focus(this)
		return this },
	//*/


	__init__(...state){
		Object.assign(this, ...state) },
}

var BaseItem = 
module.BaseItem = 
object.Constructor('BaseItem', 
	BaseItemClassPrototype,
	BaseItemPrototype)



//---------------------------------------------------------------------
// View mixin...
//
// This is used as a basis for Browser object wrappers (views) generated
// via .view(..)
//
// NOTE: this is not intended for direct use.
// NOTE: to call .source methods from inside a view's <method> you can 
// 		do one of the following:
// 			// for isolated calls, i.e. calls that may not affect the 
// 			// view object directly...
// 			this.source.<method>(..)
// 			this.__proto__.<method>(..)
//
// 			// for proper super calls...
// 			this.__proto__.<method>.call(this, ..)
//
// XXX care must be taken with attribute assignment through the proxy/view 
// 		object, most of the state of the Browser is stored in mutable 
// 		objects/props, some are intentionally overwritten by the proxy
// 		(like .items / .__items, ...) and some are not, but any attribute 
// 		assignment through the proxy/view if not transferred to the .source
// 		will not reach it.
//
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 


// Get the view/mixin source root...
//
//	Get .source root...
// 	getSource(object)
// 		-> object
//
// 	Get closest object in .source chain containing attr...
// 	getSource(object, attr)
// 		-> object
//
// NOTE: a view can be created from a view and so on, so .source may not
// 		necessarily point to the actual root object...
var getSource = function(o, attr){
	var cur = o
	while(cur.source 
			&& (!attr 
				|| !cur.hasOwnProperty(attr))){
		cur = cur.source }
	return cur }


// View mixin...
//
// This adds the following attrs/props:
// 	.source
// 	.rootSource
// 	.query
//
// This adds the following methods:
// 	.isView()
// 		-> true	
// 	.sync()
// 		-> this			
// 	.end()
// 		-> source
//
//
// NOTE: options changes are isolated to the view, to change the source 
// 		options use:
// 			// to change the parent's options...
// 			.source.options.x = ...
//
// 			// to change the root options...
// 			.rootSource.options.x = ...
//
// XXX can/should we use a Proxy object for this???
// XXX would be nice to be able to thread a set of options into the view 
// 		when constructing via .search(..) and friends...
var BrowserViewMixin = {
	//
	// source: <object>,
	//
	// query: [ .. ],
	
	// NOTE: this is not live, changes to this will take effect on next 
	// 		view instance creation, to change options assign to .options
	// 		or .source.options...
	__view_options_defaults__: {
		// Views are flat by default...
		//
		// NOTE: if false with .renderUnique also false and including an
		// 		item with .children, the view will render nested elements
		// 		twice, once in their respective sub-tree and for the 
		// 		second time in the list...
		skipNested: true,
	
		// XXX should we have an ability to skip children if the parent is
		// 		not selected???
		// XXX might also be a good idea to be able to disable sub-trees...
		//skipDisabledTree: true,
	},
	
	// Construct options by merging option defaults with .source options...
	get options(){
		return (this.__options = 
			this.__options 
				|| this.query[2]
				|| Object.assign(
					{ __proto__: this.source.options || {} },
					this.__view_options_defaults__ || {}) ) },
	set options(value){
		this.__options = value },

	//source: null,
	get rootSource(){
		return getSource(this) },

	// keep the DOM data in one place (.source)...
	//
	// NOTE: this is in contrast to the rest of the props that 
	// 		are explicitly local...
	// NOTE: these will affect the source only when .render(..) 
	// 		is called...
	get dom(){
		return getSource(this, '__dom').dom },
	set dom(value){
		getSource(this, '__dom').dom = value },
	get container(){
		return getSource(this, '__container').container },
	set container(value){
		getSource(this, '__container').container = value },

	// refresh local items if/when diverging from .source...
	get items(){
		return this.hasOwnProperty('__items') 
				&& this.isCurrent() ?
			this.__items
			: this.sync() },

	// check if we are current with .source...
	isCurrent: function(){
		return new Set(Object.values(this.source.index)).has(this.__items[0]) },

	isView: function(){
		return true },
	end: function(){
		return this.source },

	// NOTE: we are not simply doing this in .make(..) as we need to be 
	// 		able to refresh the data without triggering .make(..) on the 
	// 		source object...
	// XXX should this be .refresh()???
	// 		...if yes what's going to be the difference between it here 
	// 		and in the source object???
	// 		rename to .sync()??
	// XXX how do we handle sections???
	sync: function(){
		var source = this.source
		var [action, args, options] = this.query

		this.clearCache()

		return (this.items = 
			action == 'as-is' ?
				args
			: action instanceof Array ?
				action
					.map(function(e){ 
						return source.get(e) })
			: action ?
				source[action](...args) 
			: source.items.slice())
	},
	make: function(){
		var res = this.__proto__.make(...arguments)
		this.sync()
		return res
	},
}



// XXX if this is the common case shouldn't we set the args as defaults 
// 		to .View(..) ???
var viewWrap =
function(context, lst, options){
	return context.view(
		'as-is', 
		lst, 
		{
			__proto__: context.options || {},
			skipNested: 'skipNested' in (options || {}) ? 
				options.skipNested 
				: true,
		}) }

// Make a View wrapper function for use in .run(..)...
//
var makeFlatRunViewWrapper = 
function(context, options){
	return function(){
		return (options || {}).rawResults === true ?
			this
			: viewWrap(context, this, options) } } 

//
// options format:
// 	{
// 		// if true this will overwrite the wrapper with false...
//		//
// 		// default: undefined
// 		rawResults: <bool>,
//
// 		// If present it will be returned...
// 		wrapper: null | <function>,
//
// 		// default: true
// 		skipNested: <bool>,
// 	}
//
var makeFlatViewWrapper = 
function(options){
	return (options || {}).rawResults === true ?
		false
		: (options.wrapper 
			|| function(res){
				return viewWrap(this, res, options) }) }



//---------------------------------------------------------------------
// Renderers...

var BaseRenderer =
module.BaseRenderer = 
object.Constructor('BaseRenderer', {
	// placeholders...
	root: null,

	isRendered: function(){
		throw new Error('.isRendered(..): Not implemented.') },

	// component renderers...
	elem: function(item, index, path, options){
		throw new Error('.elem(..): Not implemented.') },
	// NOTE: if this gets an empty list this should return an empty list...
	inline: function(item, lst, index, path, options){
		throw new Error('.inline(..): Not implemented.') },
	nest: function(header, lst, index, path, options){
		throw new Error('.nest(..): Not implemented.') },

	// render life-cycle...
	finalize: function(sections, options){
		return sections },
	__init__: function(root, options){
		this.root = root
		// XXX do we do anything with options here???
	},
})


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
var TextRenderer =
module.TextRenderer = 
object.Constructor('TextRenderer', BaseRenderer, {
	// always render...
	isRendered: function(){ return false },

	elem: function(item, index, path, options){
		return path
			.slice(0, -1)
			.map(function(e){ return '    '})
			.join('') + item.id },
	inline: function(item, lst, index, path, options){
		return lst },
	// XXX if header is null then render a headless nested block... 
	nest: function(header, lst, index, path, options){
		return [
			...(header ?
				[ this.elem(header, index, path) ]
				: []),
			...lst ] },

	// XXX should we skip empty sections???
	finalize: function(sections, options){
		return Object.entries(sections)
			.reduce(function(res, [section, lst]){
				return res.concat(lst.join('\n')) }, [])
			.join('\n===\n') },
})


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
var PathRenderer =
module.PathRenderer = 
object.Constructor('PathRenderer', TextRenderer, {
	// always render...
	isRendered: function(){ return false },

	elem: function(item, index, path, options){
		return path.join('/') },
	inline: function(item, lst, index, path, options){
		return lst },
	// XXX if header is null then render a headless nested block... 
	nest: function(header, lst, index, path, options){
		return [
			...(header ?
				[ this.elem(header, index, path) ]
				: []),
			...lst ] },
})



//---------------------------------------------------------------------
// Event system parts and helpers...
//
// XXX might be a good idea to make this a generic module...

// Base event object...
//
var BrowserEvent =
module.BrowserEvent = 
object.Constructor('BrowserEvent', {
	// event name...
	name: undefined,

	data: undefined,

	propagationStopped: false,
	stopPropagation: function(){
		this.propagationStopped = true },

	// XXX not used....
	defaultPrevented: false,
	preventDefault: function(){
		this.defaultPrevented = true },

	__init__: function(name, ...data){
		// sanity check...
		if(arguments.length < 1){
			throw new Error('new BrowserEvent(..): '
				+'at least event name must be passed as argument.') }

		this.name = name
		this.data = data.length > 0 ? 
			data 
			: undefined
	},
})


// Make a method comply with the event spec...
//
// This is mainly for use in overloading event methods.
//
// Example:
// 	someEvent: eventMethod('someEvent', function(..){
// 		// call the original handler...
// 		...
//
// 		...
// 	})
//
var eventMethod = 
module.eventMethod =
function(event, func){
	func.event = event
	return func
}


// Generate an event method...
//
// 	Make and event method...
// 	makeEventMethod(event_name)
// 	makeEventMethod(event_name, handler[, retrigger])
// 	makeEventMethod(event_name, handler, action[, retrigger])
// 		-> event_method
//
// This will produce an event method that supports binding handlers to the
// event (shorthand to: .on(event, handler, ...)) and triggering the 
// said event (similar to: .trigger(event, ..) )...
//
//	Trigger an event
//	.event()
//	.event(arg, ..)
//		-> this
//
//	Bind an event handler...
//	.event(func)
//		-> this
//
var makeEventMethod = 
module.makeEventMethod =
function(event, handler, action, retrigger){
	var args = [...arguments].slice(2)
	action = (args[0] !== true && args[0] !== false) ? 
		args.shift() 
		: null
	retrigger = args.pop() !== false

	return eventMethod(event, function(item){
		// register handler...
		if(item instanceof Function){
			return this.on(event, item) 
		}

		var evt = new BrowserEvent(event)

		// main handler...
		handler
			&& handler.call(this, evt, ...arguments)

		// trigger the bound handlers...
		retrigger
			&& this.trigger(evt, ...arguments)

		// default action...
		action
			&& !evt.defaultPrevented
			&& action.call(this, evt, ...arguments)

		return this
	}) }


// Call item event handlers...
//
// 	callItemEventHandlers(item, event_name, event_object, ...)
// 		-> null
//
var callItemEventHandlers = 
function(item, event, evt, ...args){
	evt = evt || new BrowserEvent(event)
	// get the relevant handlers...
	;(item[event] ?
			[item[event]]
			: [])
		.concat((item.events || {})[event] || [])
		// call the handlers...
		.forEach(function(handler){
			handler.call(item, evt, item, ...args) })
	// propagate the event...
	// NOTE: .parent of items in an array container is the first actual
	// 		browser container up the tree, so we do not need to skip
	// 		non-browser parents...
	item.parent
		&& item.parent.trigger
		&& item.parent.trigger(evt, item, ...args) }


// Generate item event method...
//
// 	makeItemEventMethod(event_name)
// 	makeItemEventMethod(event_name, {handler, default_getter, filter, options, getter})
// 		-> event_method
//
//
// This extends makeEventMethod(..) by adding an option to pass an item
// when triggering the event and if no item is passed to produce a default,
// the rest of the signature is identical...
//
// 	Trigger an event on item(s)...
// 	.event(item, ..)
// 	.event([item, ..], ..)
// 		-> this
//
// 	Trigger event on empty list of items...
// 	.event(null, ..)
// 	.event([], ..)
// 		-> this
//
//
// 	Handle event action...
// 	handler(event_object, items, ...)
//
//
// 	Get default item if none are given...
// 	default_getter()
// 		-> item
//
// 	Check item applicability...
// 	filter(item)
// 		-> bool
//
//
// options format:
// 	{
// 		// if true unresolved items will not trigger the event unless the
// 		// input was null/undefined...
// 		// default: true
// 		skipUnresolved: <bool>,
//
// 		...
// 	}
//
//
// NOTE: item is compatible to .search(item, ..) spec, see that for more 
// 		details...
// NOTE: triggering an event that matches several items will handle each 
// 		item-parent chain individually, and independently when propagating
// 		the event up...
// NOTE: a parent that contains multiple items will get triggered multiple 
// 		times, once per each item...
// NOTE: item events do not directly trigger the original caller's handlers
// 		those will get celled recursively when the events are propagated
// 		up the tree.
//
// XXX destructuring: should default_item get .focused??? 
var makeItemEventMethod = 
module.makeItemEventMethod =
function(event, {handler, action, default_item, filter, options={}, getter='search'}={}){
	var filterItems = function(items){
		items = items instanceof Array ? 
				items 
			: items === undefined ?
				[]
			: [items]
		return filter ? 
			items.filter(filter.bind(this)) 
			: items }
	// options constructor...
	var makeOptions = function(){
		return Object.assign(
			{ 
				// NOTE: we need to be able to pass item objects, so we can not
				// 		use queries at the same time as there is not way to 
				// 		distinguish one from the other...
				noQueryCheck: true, 
				skipDisabled: true,
				// XXX should this be the default...
				skipUnresolved: true,
				rawResults: true,
			},
			options instanceof Function ? 
				options.call(this) 
				: options) }
	// base event method...
	// NOTE: this is not returned directly as we need to query the items
	// 		and pass those on to the handlers rather than the arguments 
	// 		as-is...
	var base = makeEventMethod(event, 
		function(evt, item, ...args){
			handler
				&& handler.call(this, evt, item.slice(), ...args)
			item.forEach(function(item){
				// NOTE: we ignore the root event here and force each 
				// 		item chain to create it's own new event object...
				// 		this will isolate each chain from the others in 
				// 		state and handling propagation...
				callItemEventHandlers(item, event, evt, ...args) }) },
		...(action ? [action] : []),
		false) 

	// build the options statically if we can...
	options = options instanceof Function ?
		options
		: makeOptions()

	return Object.assign(
		// the actual method we return...
		function(item, ...args){
			var that = this
			// build the options dynamically if needed...
			var opts = options instanceof Function ?
				makeOptions.call(this)
				: options
			var skipUnresolved = opts.skipUnresolved
			var resolved = 
				// event handler...
				item instanceof Function ?
					item
				// array of queries...
				: item instanceof Array ?
					filterItems.call(this, item
						.map(function(e){
							return that.search(e, opts) })
						.flat()
						.unique())
				// explicit item or query...
				: item != null ? 
					filterItems.call(this, this[getter](item, opts))
				// item is undefined -- get default...
				: item !== null && default_item instanceof Function ?
					[default_item.call(that) || []].flat()
				// item is null (explicitly) or other...
				: []
			return (skipUnresolved 
					// handler registration...
					&& !(resolved instanceof Function)
					&& resolved.length == 0 
					&& item != null) ?
				// skip unresolved...
				this
				: base.call(this, 
					resolved,
					...args) },
			// get base method attributes -- keep the event method format...
   			base) }


// Make event method edit item...
//
// XXX should this .update()
var makeItemEditEventMethod =
module.makeItemEditEventMethod =
function(event, edit, {handler, default_item, filter, options}={}){
	return makeItemEventMethod(event, {
		handler: function(evt, items){
			var that = this
			items.forEach(function(item){
				edit(item)
				handler
					&& handler.call(that, item) }) },
		default_item: 
			default_item 
				|| function(){ return this.focused },
		filter,
		options, }) }

// Make event method to toggle item attr on/off...
//
var makeItemOptionOnEventMethod =
module.makeItemOptionOnEventMethod =
function(event, attr, {handler, default_item, filter, options}={}){
	return makeItemEditEventMethod(event,
		function(item){
			return item[attr] = true },
		{ handler, default_item, filter, options }) }
var makeItemOptionOffEventMethod =
module.makeItemOptionOffEventMethod =
function(event, attr, {handler, default_item, filter, options}={}){
	return makeItemEditEventMethod(event,
		function(item){
			change = !!item[attr]
			delete item[attr]
			return change },
		{ handler, default_item, filter, options }) }


// Generate item event/state toggler...
//
// XXX should this make a toggler.Toggler???
// XXX BUG: the generated toggler in multi mode handles query arrays inconsistently...
// 		- [] is always returned...
// 		- .toggleSelect([1, 2, 10, 20]) -- toggles items on only, returns []
// 		- .toggleSelect([1, 2, 10, 20], 'next') -- toggles items on only, returns []
// 		- .toggleSelect([1, 2, 10, 20], 'on') -- works but returns []
// 		- .toggleSelect([1, 2, 10, 20], 'off') -- works but returns []
var makeItemEventToggler = 
module.makeItemEventToggler = 
function(get_state, set_state, unset_state, default_item, multi, options){
	var _get_state = get_state instanceof Function ?
		get_state
		: function(e){ return !!e[get_state] }
	var _set_state = set_state instanceof Function ?
		set_state
		: function(e){ return !!this[set_state](e) }
	var _unset_state = unset_state instanceof Function ?
		unset_state
		: function(e){ return !this[unset_state](e) }
	var _default_item = default_item instanceof Function ?
		default_item
		: function(){ return this[default_item] }
	// filter/multi...
	var filter = multi instanceof Function
		&& multi
	var filterItems = function(items){
		return filter ? 
			items.filter(filter.bind(this)) 
			: items }
	multi = multi !== false
	var getter = multi ? 'search' : 'get'
	options = Object.assign(
		// NOTE: we need to be able to pass item objects, so we can not
		// 		use queries at the same time as there is not way to 
		// 		distinguish one from the other...
		{ noQueryCheck: true },
		options || {})

	// state normalization lookup table...
	var states = {
		true: true, 
		on: true,
		false: false, 
		off: false,
		// only two states, so next/prev are the same...
		prev: 'next', 
		next: 'next',
		'?': '?', 
		'??': '??', 
		'!': '!',
	}

	return (function eventToggler(item, state){
		var that = this
		// normalize/parse args...
		state = item in states ?
			item 
			: state
		item = state === item ? 
				undefined 
				: item 
		item = item === undefined ?
			_default_item.call(this)
			: item
		state = state in states ? 
			states[state] 
			: 'next'

		return [ 
				state == '??' ?
					[true, false]
				: item == null ?
					false	
				: state == '?' ?
					filterItems.call(this,
						[this[getter](item, options)]
							.flat())
							.map(_get_state)
				: state === true ?
					_set_state.call(this, item)
				: state == false ? 
					_unset_state.call(this, item)
				// 'next' or '!'...
				// NOTE: 'next' and '!' are opposites of each other...
				: filterItems.call(this,
					[this[getter](item, options)]
						.flat())
						.map(function(e){
							return (state == 'next' ? 
									_get_state(e)
									: !_get_state(e)) ?
								_unset_state.call(that, e)
								: _set_state.call(that, e) }) 
			]
			.flat()
			// normalize for single item results -> return item and array...
			.run(function(){
				return this.length == 1 ? 
					this[0] 
					: this }) })
		// support instanceof Toggler tests...
		.run(function(){
			this.__proto__ = toggler.Toggler.prototype
			this.constructor = toggler.Toggler })}


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
// Base Browser...

var BaseBrowserClassPrototype = {
}

// XXX Q: should we be able to add/remove/change items outside of .__items__(..)???
// 		...only some item updates (how .collapsed is handled) make 
// 		sense at this time -- need to think about this more 
// 		carefully + strictly document the result...
var BaseBrowserPrototype = {
	options: {
		// List of sections to make...
		//
		// default: ['header', 'items', 'footer']
		sections: [
			'header',
			'items',
			'footer',
		],

		// If true allows disabled items to be focused...
		focusDisabledItems: false,

		// If true allows focus to shift into header/footer...
		//
		// XXX needs more work and testing....
		allowSecondaySectionFocus: false,

		// If true item keys must be unique...
		//
		// If false and two items have the same key but no .id set a unique
		// .id will be generated to distinguish the items.
		//
		// NOTE: item.id is still required to be unique.
		// NOTE: see .__key__(..) and .__id__(..) for key/id generation
		// 		specifics.
		//
		// default: false
		uniqueKeys: false,

		// if true do not render an item more than once... 
		//
		// default: true
		renderUnique: true,


		// Controls how the disabled sub-tree root elements are skipped...
		//
		// Can be:
		// 	'node'		- skip only the disabled node (default)
		// 	'branch'	- skip whole branch, i.e. all nested elements.
		//
		// XXX if this is 'branch' we should also either show all the 
		// 		nested elements as disabled or outright disable them,
		// 		otherwise they can still be focused via clicking and other
		// 		means...
		//skipDisabledMode: 'node',

		// Minimum number of milliseconds between updates...
		//
		// This works in the following manner:
		// 	- for 10 consecutive calls:
		// 		- call (first) 
		// 			-> triggered right away
		// 		- call (within timeout)
		// 			-> schedule after timeout
		// 		- call (within timeout)
		// 			-> drop previous scheduled call
		// 			-> schedule after timeout
		// 		- ...
		//
		// Essentially this prevents more than one call to .update(..) 
		// within the timeout and more than two calls within a fast call
		// sequence...
		//
		// NOTE: the full options to .update(..) is remembered even if the
		// 		update was deferred the next update either after the timeout
		// 		or max timeout will be full retaining the passed options...
		// NOTE: the delayed update is called with the same set of arguments
		// 		as the last update call of that type (full / non-full).
		// NOTE: this does not care about other semantics of the .update(..)
		// 		calls it drops (i.e. the options passed), only the first 
		// 		and last call in sequence get actually called.
		updateTimeout: 30,

		// Maximum time between .update(..) calls when calling updates 
		// in sequence...
		updateMaxDelay: 200,

		// Item templates...
		//
		// Format:
		// 	{
		// 		// Default item template...
		// 		//
		// 		// This will be added to all items, including ones that
		// 		// directly match another template template...
		// 		'*': <item>,
		//
		// 		// Normal item template...
		// 		<key>: <item>,
		// 		...
		// 	}
		//
		// If make(..) gets passed <key> it will construct the base element
		// via <item> and merge the item options into that.
		//
		// <item> format is the same as the format passed to make(..)
		//
		// XXX should we have an ability to "blank-out" some items?
		// 		...i.e. do not create an item matching a template in 
		// 		certain context...
		// 		No, currently this is not needed.
		itemTemplate: {},

		// If not null these indicate the name of the generator to use, 
		// when  the client does not supply the corresponding function 
		// (i.e. Items[name])
		defaultHeader: null,
		defaultFooter: null,
	},


	// Props and introspection...

	// parent widget object...
	//
	// NOTE: this may or may not be a Browser object.
	parent: null,

	// Root dialog...
	//
	get root(){
		var cur = this
		while(cur.parent instanceof BaseBrowser){
			cur = cur.parent
		}
		return cur },

	// Section containers...
	//
	// Format:
	// 	[
	// 		<item> | <browser>,
	// 		...
	// 	]
	//
	// <item> format:
	// 	{
	// 		value: ...,
	//
	// 		children: ...,
	//
	// 		...
	// 	}
	//
	// NOTE: this can't be a map/dict as we need both order manipulation 
	// 		and nested structures which would overcomplicate things, as 
	// 		a compromise we use .index below for item identification.
	// XXX should we use .hasOwnProperty(..)???
	__header: null,
	get header(){
		this.__header
			|| ((this.__header__ 
					|| Items[this.options.defaultHeader])
				&& this.make({section: 'header'}))
		return this.__header || [] },
	set header(value){
		this.__header = value },
	__items: null,
	get items(){
		this.__items
			|| this.make()
		return this.__items },
	set items(value){
		this.__items = value },
	__footer: null,
	get footer(){
		this.__footer
			|| ((this.__footer__ 
					|| Items[this.options.defaultFooter])
				&& this.make({section: 'footer'}))
		return this.__footer || [] },
	set footer(value){
		this.__footer = value },


	// Clear cached data...
	//
	// 	Clear all cache data...
	// 	.clearCache()
	// 		-> this
	//
	// 	Clear specific cache data...
	// 	.clearCache(title)
	// 	.clearCache(title, ..)
	// 	.clearCache([title, ..])
	// 		-> this
	//
	//
	// This will delete all attributes of the format:
	// 	.__<title>_cache
	//
	//
	// 	Clear all cache data including generated items...
	// 	.clearCache(true)
	// 		-> this
	//
	// NOTE: .clearCache(true) will yield a state that would require at 
	// 		least a .update() call to be usable...
	clearCache: function(title){
		if(title == null || title === true){
			Object.keys(this)
				.forEach(function(key){
					if(key.startsWith('__') && key.endsWith('_cache')){
						delete this[key]
					}
				}.bind(this)) 
		} else {
			[...arguments].flat()
				.forEach(function(title){
					delete this[`__${title}_cache`]
				}.bind(this))
		}
		if(title === true){
			delete this.__header
			delete this.__items
			delete this.__footer
		}
		return this },


	// Item index...
	//
	// Format:
	// 	{
	// 		"<path>": <item>,
	// 		// repeating path...
	// 		"<path>:<count>": <item>,
	// 		...
	// 	}
	//
	// NOTE: this will get overwritten each time .make(..) is called.
	// NOTE: .make(..) will also set item's .id where this will add a 
	// 		count to the path...
	// 		This will also make re-generating the indexes and searching
	// 		stable...
	//
	// XXX for some odd reason this is sorted wrong...
	// 		...keys that are numbers for some reason are first and sorted 
	// 		by value and not by position...
	// XXX should we use .hasOwnProperty(..)???
	__item_index_cache: null,
	get index(){
		var that = this
		return (this.__item_index_cache = 
			(this.hasOwnProperty('__item_index_cache') && this.__item_index_cache)
				|| this
					.reduce(function(index, e, i, p){
						var id = p = p.join('/')
						var c = 0

						// make id unique...
						// NOTE: no need to check if e.id is unique as we already 
						// 		did this in make(..)...
						while(id in index){
							id = this.__id__(p, ++c) }
						index[id] = e

						return index
					}.bind(this), {}, 
					{ 
						iterateAll: true, 
					})) },

	// Flat item index...
	//
	// Format:
	// 	{
	// 		"<key>": <item>,
	// 		// repeating keys...
	// 		"<key>:<count>": <item>,
	// 		...
	// 	}
	//
	// XXX should this be cached???
	get flatIndex(){
		return this
			.reduce(function(index, e, i, p){
				var id = p = this.__key__(e)
				var c = 0
				while(id in index){
					id = this.__id__(p, ++c)
				}
				index[id] = e
				return index
			}.bind(this), {}, {iterateAll: true, includeInlinedBlocks: true}) },

	// Shorthands for common item queries...
	//
	// XXX should these be cached???
	get focused(){
		return this.get('focused') },
	set focused(value){
		this.focus(value) },
	get selected(){
		return this.search('selected') },
	set selected(value){
		this
			.deselect('selected')
			.select(value) },


	// XXX should this return a list or a string???
	// XXX should this be cached???
	// XXX should this set .options???
	// XXX need to normalizePath(..)
	// 		...array .value is not compliant with POLS
	get path(){
		return (this.pathArray || []).join('/') },
	set path(value){
		this.load(value) },
	// XXX do we make this writable???
	get pathArray(){
		return this.__items != null ?
			this.get('focused', 
				function(e, i, p){ return p }) 
			// XXX do we use .options.path???
			// XXX is this an array???
			: (this.options || {}).path },

	// Length...
	//
	// visible only...
	get length(){
		return this.toArray().length },
	// include collapsed elements...
	get lengthTree(){
		return this.map({iterateCollapsed: true, rawResults: true}).length },
	// include non-iterable elements...
	get lengthAll(){
		return this.map({iterateAll: true, rawResults: true}).length },


	// Configuration / Extension...
	
	// Key getter/generator...
	__key__: function(item){
		return item.id 
			|| item.text 
			|| this.__id__() },

	// ID generator...
	//
	// 	.__id__()
	// 	.__id__(prefix)
	// 	.__id__(prefix, count)
	// 		-> id
	//
	// Format:
	// 	"<date>"
	// 	"<prefix>:<count>"
	// 	"<prefix>:<date>"
	//
	// XXX not sure about the logic of this, should this take an item as 
	// 		input and return an id???
	// 		...should this check for uniqueness???
	// 		think merging this with any of the actual ID generators would be best...
	__id__: function(prefix, count){
		return prefix ?
			// id prefix...
			//`${prefix} (${count || Date.now()})`
			`${prefix}:${typeof(count) == typeof(123) ? count : Date.now()}`
			// plain id...
			: `item${Date.now()}` },


	// Data generation (make)...
	
	__item__: BaseItem,

	// Section item list constructor...
	//
	// 	.__header__(make, options)
	// 	.__items__(make, options)
	// 	.__footer__(make, options)
	// 		-> undefined
	// 		-> list
	//
	//
	// 	Item constructor:
	// 		make(value)
	// 		make(value, options)
	// 			-> make
	//
	//
	// There are two modes of operation:
	// 	1) call make(..) to create items
	// 	2) return a list of items
	//
	//
	// The if make(..) is called at least once the return value is 
	// ignored (mode #1), otherwise, the returned list is used as the 
	// .items structure.
	//
	//
	// When calling make(..) (mode #1) the item is built by combining 
	// the following in order:
	// 	- original item (.items[key]) if present,
	// 	- options passed to .make(<options>) method calling .__items__(..),
	// 	- options passed to make(.., <options>) constructing the item,
	// 	- {value: <value>} where <value> passed to make(<value>, ..)
	//
	// Each of the above will override values of the previous sections.
	//
	// The resulting item is stored in:
	// 	.header, .items or .footer
	// 	.index (keyed via .id or JSONified .value)
	//
	// Each of the above structures is reset on each call to .make(..)
	//
	// options format:
	// 	{
	// 		id: <string>,
	// 		value: <string> | <array>,
	//
	// 		children: <browser> | <array>,
	//
	// 		focused: <bool>,
	// 		selected: <bool>,
	// 		disabled: <bool>,
	// 		noniterable: <bool>,
	//
	// 		// Set automatically...
	// 		parent: <browser>,
	// 		// XXX move this to the appropriate object...
	// 		dom: <dom>,
	//
	//		...
	// 	}
	//
	//
	// Example:
	// 	XXX
	//
	//
	// In mode #2 XXX
	//
	//
	// NOTE: this is not designed to be called directly...
	__header__: null,
	__items__: function(make, options){
		throw new Error('.__items__(..): Not implemented.') },
	__footer__: null,



	// Make extension...
	//
	// This is called per item created by make(..) in .__items__(..)
	//
	// NOTE: this can update/modify the item but it can not replace it.
	//__make__: function(section, item){
	//},


	// Make .items and .index...
	//
	// 	.make()
	// 	.make(options)
	// 		-> this
	//
	// The items are constructed by passing a make function to .__items__(..)
	// which in turn will call this make(..) per item created.
	//
	// For more doc on item construction see: .__init__(..)
	//
	//
	// NOTE: each call to this will reset both .items and .index
	// NOTE: for items with repeating values there is no way to correctly 
	// 		identify an item thus no state is maintained between .make(..)
	// 		calls for such items...
	//
	// XXX revise options handling for .__items__(..)
	// XXX might be a good idea to enable the user to merge the state 
	// 		manually...
	// 		one way to go:
	// 			- get the previous item via an index, 
	// 			- update it
	// 			- pass it to make(..)
	// 		Example:
	// 			// just a rough example in .__items__(..)...
	// 			make(value, 
	// 				value in this.index ? 
	// 					Object.assign(
	// 						this.index[value], 
	// 						opts) 
	// 					: opts)
	// XXX revise if stage 2 is applicable to sections other than .items
	make: function(options){
		var that = this
		options = Object.assign(
			Object.create(this.options || {}), 
			Object.flatCopy(options || {}))

		// sections to make...
		var sections = options.section == '*' ?
			(options.sections || ['header', 'items', 'footer'])
			: (options.section || 'items')
		sections = (sections instanceof Array ? 
				sections 
				: [sections])
			.map(function(name){
				return [
					name,
					that[`__${name}__`] 
						|| Items[options[`default${name.capitalize()}`]],
				] })
			// keep only sections we know how to make...
			.filter(function([_, handler]){
				return !!handler })

		// item constructor...
		//
		// 	Make an item...
		// 	make(value[, options])
		// 	make(value, func[, options])
		// 		-> make
		//
		// 	Inline a browser instance...
		// 	make(browser)
		// 		-> make
		//
		//
		// NOTE: when inlining a browser, options are ignored.
		// NOTE: when inlining a browser it's .parent will be set this 
		// 		reusing the inlined object browser may mess up this 
		// 		property...
		//
		// XXX problem: make(Browser(..), ..) and make.group(...) produce 
		// 		different formats -- the first stores {value: browser, ...}
		// 		while the latter stores a list of items.
		// 		...would be more logical to store the object (i.e. browser/list)
		// 		directly as the element...
		var section
		var ids = new Set()
		var keys = options.uniqueKeys ? 
			new Set() 
			: null
		var make = new Make(this, 
			function(value, opts){
				var dialog = this.dialog

				// special-case: inlined browser...
				//
				// NOTE: we ignore opts here...
				// XXX not sure if this is the right way to go...
				// 		...for removal just remove the if statement and its
				// 		first branch...
				if(value instanceof BaseBrowser){
					var item = value
					item.parent = dialog
					item.section = section

				// normal item...
				} else {
					var args = [...arguments]
					opts = opts || {}
					// handle: make(.., func, ..)
					opts = opts instanceof Function ?
						{open: opts}
						: opts
					// handle trailing options...
					opts = args.length > 2 ?
						Object.assign({},
							args.pop(),
							opts)
						: opts
					opts = Object.assign(
						{},
						opts, 
						{value: value})

					// item id...
					var key = dialog.__key__(opts)

					// duplicate keys (if .options.uniqueKeys is set)...
					if(keys){
						if(keys.has(key)){
							throw new Error(`make(..): duplicate key "${key}": `
								+`can't create multiple items with the same key `
								+`when .options.uniqueKeys is set.`) 
						}
						keys.add(key)
					}
					// duplicate ids...
					if(opts.id && ids.has(opts.id)){
						throw new Error(`make(..): duplicate id "${opts.id}": `
							+`can't create multiple items with the same id.`) }

					// build the item...
					// NOTE: we intentionally isolate the item object from 
					// 		the input opts here, yes, having a ref to a mutable
					// 		object may be convenient in some cases but in this
					// 		case it would promote going around the main API...
					var item = new dialog.__item__(
						// default item template...
						(options.itemTemplate || {})['*'] || {},
						// item template...
						(options.itemTemplate || {})[opts.value] || {},
						opts,
						{ 
							parent: dialog, 
							section,
						})

					// XXX do we need both this and the above ref???
					item.children instanceof BaseBrowser
						&& (item.children.parent = dialog)
				}

				// user extended make...
				// XXX differentiate this for header and list...
				dialog.__make__
					&& dialog.__make__(section, item)

				// store the item...
				this.items.push(item)
				ids.add(key) 
			})

		// build the sections...
		var reset_index = false
		sections
			.forEach(function([name, handler]){
				// setup state/closure for make(..)...
				ids = new Set()
				section = name
				make.items = that[name] = []

				// prepare for index reset...
				reset_index = reset_index || name == 'items'

				// build list...
				var res = handler.call(that, 
					make,
					// XXX not sure about this -- revise options handling...
					options ? 
						Object.assign(
							Object.create(that.options || {}), 
							Object.flatCopy(options || {}))
						: null)

				// if make was not called use the .__items__(..) return value...
				that[name] = make.called ? 
					that[name]
					: res })

		// reset the index/cache...
		// XXX should this be only for .items???
		// 		...should this be global (all items?)
		if(reset_index){
			var old_index = this.__item_index_cache || {}
			this.clearCache()

			// 2'nd pass -> make item index (unique id's)...
			// NOTE: we are doing this in a separate pass as items can get 
			// 		rearranged during the make phase (Items.nest(..) ...),
			// 		thus avoiding odd duplicate index numbering...
			var index = this.__item_index_cache = this.index

			// post process the items...
			Object.entries(index)
				.forEach(function([id, e]){
					// update item.id of items with duplicate keys...
					!id.endsWith(that.__key__(e))
						&& (e.id = id.split(/[\/]/g).pop())
					// merge old item state...
					id in old_index
						// XXX this is not very elegant(???), revise... 
						&& Object.assign(e,
							old_index[id],
							e) }) }

		return this
	},


	// Data views...
	//
	// For View object specifics see: BrowserViewMixin
	
	//
	// TODO:
	// 	- set correct isolation boundary between this and .source...
	// 	- make this a real instance (???)
	// 		...do we need this for anything other than doc???
	// 	- return from selectors...
	// 	- treat .items as cache 
	// 		-> reset on parent .make(..)
	// 		-> re-acquire data (???)
	// 	- take control (optionally), i.e. handle keyboard
	//
	// XXX BUG?: .update(..) from events resolves to the .source...
	// 		to reproduce:
	// 			dialog
	//				.clone([7, 8, 9])
	//				.update()
	//				.focus()
	//				// XXX this will render the base dialog...
	//				//		...likely due to that the handler's context 
	//				//		resolves to the root and not the clone...
	//				.disable()
	view: function(action, args, options){
		var that = this
		return object
			.mixinFlat(
				{
					__proto__: this,
					source: this,
					query: [...arguments],
				},
				BrowserViewMixin) },
	isView: function(){
		return false },


	// Data access and iteration...

	// Walk the browser...
	//
	// 	Get list of nodes...
	// 	.walk()
	// 	.walk(null[, options])
	// 		-> list
	//
	//
	//	Walk the tree passing each elem to func(..)
	// 	.walk(func(..))
	// 	.walk(func(..)[, options])
	// 		-> list
	// 		-> res
	//
	//	Walk a list of items matching query (compatible with .search(..))...
	//	.walk(query, func(..))
	//	.walk(query, func(..), options)
	// 		-> list
	// 		-> res
	//
	//	Walk a custom list of items...
	//	.walk([item, ...], func(..))
	//	.walk([item, ...], func(..), options)
	// 		-> list
	// 		-> res
	//
	//
	// 		Handle elem...
	// 		 func(elem, index, path, next(..), stop(..))
	// 			-> [item, ..]
	//	 		-> item
	//
	//
	// 			Ignore current .children...
	// 			 next()
	// 			 next(false)
	// 			 	-> [] 
	//
	// 			Force children processing synchronously...
	// 			 next(true)
	// 			 	-> res
	//
	// 			Explicitly pass children to be handled...
	// 			 next(browser)
	// 			 next([elem, ...])
	// 			 	-> input
	//
	// 			Explicitly pass children to be handled and process them sync...
	// 			 next(browser, true)
	// 			 next([elem, ...], true)
	// 			 	-> input
	//
	//
	// 			Stop walking (return undefined)...
	// 			 stop()
	//
	// 			Stop walking and return res...
	// 			 stop(res)
	//
	//
	// NOTE: stop(..) breaks execution so nothing after it is called
	// 		in the function will get reached.
	// NOTE: if func(..) returns an array it's content is merged (.flat()) 
	// 		into .walk(..)'s return value, this enables it to:
	// 			- return more than one value per item by returning an 
	// 				array of values
	// 			- return no values for an item by returning []
	// NOTE: to explicitly return an array from func(..) wrap it in 
	// 		another array.
	//
	//
	//
	// options format:
	// 	{
	// 		// reverse walking...
	//		//
	// 		// modes:
	// 		//	true				- use .defaultReverse
	// 		//	'mixed'				- results reversed,
	// 		//							handlers called topologically 
	// 		//							(i.e. container handled before children 
	// 		//							but its return value is placed after)
	// 		//	'full'				- results reversed
	// 		//							(i.e. container handled after children)
	// 		//	'tree'				- results reversed topologically
	// 		//							(i.e. container handled after children)
	// 		//
	// 		// NOTE: in 'full' mode, next(..) has no effect, as when the 
	// 		//		container handler is called the children have already 
	// 		//		been processed...
	// 		reverse: <bool> | 'mixed' | 'full' | 'tree',
	//
	//		defaultReverse: 'mixed',
	//
	// 		// if true iterate collapsed children...
	// 		iterateCollapsed: <bool>,
	//
	// 		// if true iterate non-iterable elements... 
	// 		iterateNonIterable: <bool>,
	//
	//
	//		// shorthand for:
	//		//	iterateCollapsed: true, iterateNonIterable: true
	// 		iterateAll: <bool>,
	//
	// 		// if true call func(..) on inline block containers...
	// 		includeInlinedBlocks: <bool>,
	//
	// 		skipDisabledMode: 'node' | 'branch',
	// 		skipDisabled: <bool> | 'node' | 'branch',
	//
	// 		// skip nested/inlined elements (children)...
	// 		skipNested: <bool>,
	// 		skipInlined: <bool>,
	//
	//
	// 		// list of sections to iterate...
	// 		section: '*' | [ <section>, ... ],
	//
	// 		// list of iterable sections...
	// 		//
	// 		// used when options.section is '*'
	// 		sections: [ <section>, ... ]
	//
	// 		...
	// 	}
	//
	//
	// XXX might be good to be able to return the partial result being 
	// 		constructed via stop(..) in some way...
	// 			stop()				-> returns current partial state...
	// 			stop(undefined)		-> returns explicit undefined
	// 			stop(..)
	walk: function(func, options){
		var that = this

		var args = [...arguments]
		var list = !(args[0] instanceof Function || args[0] == null) ?
			args.shift()
			: false
		list = list instanceof BaseItem ? 
			[list] 
			: list
		var [func=null, options={}, path=[], context={}] = args

		// context...
		context.root = context.root || this
		context.index = context.index || 0
		// stop...
		var res, StopException
		var stop = context.stop = 
			context.stop 
				|| function(r){ 
						res = r
						throw StopException }
					.run(function(){
						StopException = new Error('StopException.') })

		// options...
		options = Object.assign(
			Object.create(this.options || {}),
			Object.flatCopy(options))
		// options.reverse...
		var reverse = options.reverse === true ? 
			(options.defaultReverse || 'mixed') 
			: options.reverse
		var handleReverse = function(lst){
			return reverse ?
				lst.slice().reverse()
				: lst }
		// options.section...
		var sections = options.section == '*' ?
			(options.sections 
				|| ['header', 'items', 'footer'])
			: [options.section || 'items'].flat() 
		// NOTE: sections other than 'items' are included only for the root context...
		sections = (context.root !== this
				&& sections.includes('items')) ?
			['items']
			: sections
		// iteration filtering...
		var iterateNonIterable = !!(options.iterateAll || options.iterateNonIterable)
		var iterateCollapsed = !!(options.iterateAll || options.iterateCollapsed)
		var includeInlinedBlocks = !!options.includeInlinedBlocks
		var skipDisabled = options.skipDisabled === true ?
			options.skipDisabledMode || 'node'
			: options.skipDisabled

		// item handler generator...
		var makeMap = function(path){
			return function(elem){
				var p = path

				// item...
				var inlined = elem instanceof Array 
					|| elem instanceof BaseBrowser
				var skipItem = 
					(skipDisabled && elem.disabled)
					|| (!iterateNonIterable && elem.noniterable) 
					|| (!includeInlinedBlocks && inlined)
				var p = !skipItem ?
					// XXX get id of inlined item...
					// XXX should we skip id of inlined item???
					path.concat(elem.id)
					: p
				var item
				// NOTE: this will calc the value once and return it cached next...
				var processItem = function(){
					return (item = 
						item !== undefined ?
							item
						: !skipItem ?
							[ func ? 
								func.call(that, elem, 
									inlined ? 
										// NOTE: we do not increment index for 
										// 		inlined block containers as they 
										// 		do not occupy and space...
										context.index 
										: context.index++, 
									p, next, stop) 
								: elem ].flat()
						: []) }

				// children...
				var children = (
						// skip...
						((!iterateCollapsed && elem.collapsed) 
								|| (skipDisabled == 'branch')) ?
							false
						// inlined...
						: !options.skipInlined
								&& (elem instanceof BaseBrowser || elem instanceof Array) ?
							elem
						// nested...
						: (!options.skipNested && elem.children) ) 
					|| []
				var next = function(elems, now){
					return (children = 
						// skip...
						elems == null ?
							[]
						// force processing now...
						: now === true || elems === true ?
							processChildren(now && elems)
						// set elems as children...
						: elems) }
				var processed
				var processChildren = function(elems){
					elems = elems instanceof Array ? 
						elems 
						: children
					return (processed = 
						// nodes processed via next(true), no need to re-process...
						elems === processed ?
							[]
						// cached value...
						: processed !== undefined ?
							processed
						: elems instanceof Array ?
							handleReverse(elems)
								.map(makeMap(p))
								.flat()
						: elems instanceof BaseBrowser ?
							// NOTE: this will never return non-array as 
							// 		when stop(..) is called it will break
							// 		execution and get handled in the catch 
							// 		clause below...
							elems
								.walk(func, options, p, context)
						: []) }

				// pre-call the item if reverse is not 'full'...
				reverse == 'full'
					|| processItem()

				// build the result...
				return [
					// item (normal order)...
					...!(reverse && reverse != 'tree') ? 
						processItem() 
						: [],
					// children...
					...processChildren(),
					// item (in reverse)...
					...(reverse && reverse != 'tree') ? 
						processItem() 
						: [], ] } }

		try {
			return handleReverse(
					list ?
						(list instanceof Array ?
							list
							: this.search(list, options))
						: sections
							.map(function(section){
								return that[section] || [] })
							.flat())
				.map(makeMap(path))
				.flat() 

		// handle stop(..) and propagate errors...
		} catch(e){
			if(e === StopException){
				return res }
			throw e } },


	// Extended map...
	//
	//	Get all items...
	//	.map([options])
	//		-> items
	//
	//	Map func to items...
	//	.map(func[, options])
	//		-> items
	//
	//
	//		func(item, index, path, browser)
	//			-> result
	//
	//
	//
	// options format:
	// 	{
	// 		// The value used if .reverse is set to true...
	// 		//
	// 		// NOTE: the default is different from .walk(..)
	// 		defaultReverse: 'full' (default) | 'tree',
	//
	// 		rawResults: <bool>,
	//
	// 		// For other supported options see docs for .walk(..)
	// 		...
	// 	}
	//
	//
	// By default this will not iterate items that are:
	// 	- non-iterable (item.noniterable is true)
	// 	- collapsed sub-items (item.collapsed is true)
	//
	// This extends the Array .map(..) by adding:
	// 	- ability to run without arguments
	// 	- support for options
	// 	- the handler will also get item path in addition to its index
	//
	//
	// NOTE: we do not inherit options from this.options here as it 
	// 		will be done in .walk(..)
	map: function(func, options){
		var that = this
		var args = [...arguments]
		func = (args[0] instanceof Function 
				|| args[0] == null) ? 
			args.shift() 
			: undefined
		options = args.shift() || {}
		options = !options.defaultReverse ?
			Object.assign({},
				options, 
				{ defaultReverse: 'full' })
			: options
		return this.walk(
				function(e, i, p){
					return [func ?
						func.call(that, e, i, p)
						: e] }, 
				options) 
			.run(makeFlatRunViewWrapper(this, options)) },
	// XXX do we need a non-flat version of this???
	// 		...would need a way to maintain parent if at least one item 
	// 		is present...
	filter: function(func, options){ 
		var that = this
		options = !(options || {}).defaultReverse ?
			Object.assign({},
				options || {}, 
				{ defaultReverse: 'full' })
			: options
		return this.walk(
			function(e, i, p){
				return func.call(that, e, i, p) ? [e] : [] }, 
			options)
			.run(makeFlatRunViewWrapper(this, options)) },
	reduce: function(func, start, options){
		var that = this
		options = !(options || {}).defaultReverse ?
			Object.assign({},
				options || {}, 
				{ defaultReverse: 'full' })
			: options
		this.walk(
			function(e, i, p){
				start = func.call(that, start, e, i, p) }, 
			options) 
		return start },
	forEach: function(func, options){ 
		this.map(...arguments)
		return this },

	toArray: function(options){
		return this.map(null,
			Object.assign({},
				options || {}, 
				{rawResults: true})) },


	// Search items...
	//
	// 	Get list of matching elements...
	// 	NOTE: this is similar to .filter(..)
	// 	.search(test[, options])
	// 		-> items
	//
	// 	Map func to list of matching elements and return results...
	// 	NOTE: this is similar to .filter(..).map(func)
	// 	.search(test, func[, options])
	// 		-> items
	//
	//
	// test can be:
	// 	predicate(..)	- function returning true or false
	// 	index			- element index
	// 						NOTE: index can be positive or negative to 
	// 							access items from the end.
	// 	path			- array of path elements or '*' (matches any element)
	// 	regexp			- regexp object to test item path
	// 	query			- object to test against the element 
	// 	keyword			- 
	//
	//
	// 	predicate(elem, i, path)
	// 		-> bool
	//
	//
	// query format:
	// 	{
	// 		// match if <attr-name> exists and is true...
	// 		// XXX revise...
	// 		<attr-name>: true,
	//
	// 		// match if <attr-name> does not exist or is false...
	// 		// XXX revise...
	// 		<attr-name>: false,
	//
	// 		// match if <attr-name> equals value...
	// 		<attr-name>: <value>,
	//
	// 		// match if func(<attr-value>) return true...
	// 		<attr-name>: <func>,
	//
	// 		...
	// 	}
	//
	//
	// supported keywords:
	// 	'first'		- get first item (same as 0)
	// 	'last'		- get last item (same as -1)
	// 	'selected'	- get selected items (shorthand to {selected: true})
	// 	'focused'	- get focused items (shorthand to {focused: true})
	//
	//
	// options format:
	// 	{
	// 		noQueryCheck: <bool>,
	//
	// 		...
	// 	}
	//
	//
	//
	// __search_test_generators__ format:
	// 	{
	// 		// NOTE: generator order is significant as patterns are testen 
	// 		//		in order the generators are defined...
	// 		// NOTE: testGenerator(..) is called in the context of 
	// 		//		__search_test_generators__ (XXX ???)
	// 		// NOTE: <key> is only used for documentation...
	// 		<key>: testGenerator(..),
	//
	// 		...
	// 	}
	//
	//	testGenerator(pattern)
	//		-> test(elem, i, path)
	//		-> false
	//
	//
	// NOTE: search is self-applicable, e.g. 
	// 			x.search(x.search(..), {noQueryCheck: true})
	// 		should yield the same result as:
	// 			x.search(..)
	// 		this is very fast as we shortcut by simply checking of an 
	// 		item exists...
	// NOTE: if .search(..) is passed a list of items (e.g. a result of 
	// 		another .search(..)) it will return the items that are in
	// 		.index as-is regardless of what is set in options...
	// 		given options in this case will be applied only to list items
	// 		that are searched i.e. the non-items in the input list...
	//
	// XXX REVISE...
	// XXX can .search(..) of a non-path array as a pattern be done in 
	// 		a single pass???
	// XXX add support for fuzzy match search -- match substring by default 
	// 		and exact title if using quotes...
	// XXX add diff support...
	// XXX should this check hidden items when doing an identity check???
	__search_test_generators__: {
		// regexp path test...
		regexp: function(pattern){
			return pattern instanceof RegExp
				&& function(elem, i, path){
					return pattern.test(elem.text)
						|| pattern.test('/'+ path.join('/')) } },
		// string path test...
		// XXX should 'B' be equivalent to '/B' or should it be more like '**/B'?
		strPath: function(pattern){
			if(typeof(pattern) == typeof('str')){
				pattern = pattern instanceof Array ?
					pattern
					: pattern
						.split(/[\\\/]/g)
						.filter(function(e){ return e.trim().length > 0 })
				return this.path(pattern)
			}
			return false
		},
		// path test...
		// NOTE: this does not go down branches that do not match the path...
		// XXX add support for '**' ???
		path: function(pattern){
			if(pattern instanceof Array){
				var cmp = function(a, b){
					return a.length == b.length
						&& !a
							.reduce(function(res, e, i){
								return res || !(
									e == '*' 
										|| (e instanceof RegExp 
											&& e.test(b[i]))
										|| e == b[i]) }, false) }
				var onPath = function(path){
					return pattern.length >= path.length 
						&& cmp(
							pattern.slice(0, path.length), 
							path) }

				return function(elem, i, path, next){
					// do not go down branches beyond pattern length or 
					// ones that are not on path...
					// XXX BUG: this messes up i...
					// 		...can we do this while maintaining i correctly???
					//;(pattern.length == path.length
					//		|| !onPath(path))
					//	&& next(false)
					// do the test...
					return path.length > 0
						&& pattern.length == path.length
						&& cmp(pattern, path) } 
			}
			return false
		},
		// item index test...
		index: function(pattern){
			return typeof(pattern) == typeof(123)
				&& function(elem, i, path){
					return i == pattern } },
		// XXX add diff support...
		// object query..
		// NOTE: this must be last as it will return a test unconditionally...
		query: function(pattern){ 
			var that = this
			return function(elem){
				return Object.entries(pattern)
					.reduce(function(res, [key, pattern]){
						return res 
							&& (elem[key] == pattern
								// bool...
								|| ((pattern === true || pattern === false)
									&& pattern === !!elem[key])
								// predicate...
								|| (pattern instanceof Function 
									&& pattern.call(that, elem[key]))
								// regexp...
								|| (pattern instanceof RegExp
									&& pattern.test(elem[key]))
								// type...
								// XXX problem, we can't distinguish this 
								// 		and a predicate...
								// 		...so for now use:
								// 			.search(v => v instanceof Array)
								//|| (typeof(pattern) == typeof({})
								//	&& pattern instanceof Function
								//	&& elem[key] instanceof pattern)
							) }, true) } },
	},
	search: function(pattern, func, options){
		var that = this

		// parse args...
		var args = [...arguments]
		pattern = args.length == 0 ? 
			true 
			: args.shift() 
		func = (args[0] instanceof Function 
				|| args[0] == null) ? 
			args.shift() 
			: undefined
		// NOTE: we do not inherit options from this.options here is it 
		// 		will be done in .walk(..)
		options = args.shift() || {}
		var context = args.shift()

		// non-path array or item as-is...
		//
		// here we'll do one of the following for pattern / each element of pattern:
		// 	- pattern is an explicitly given item
		// 		-> pass to func(..) if given, else return as-is
		// 	- call .search(pattern, ..)
		//
		// NOTE: a non-path array is one where at least one element is 
		// 		an object...
		// NOTE: this might get expensive as we call .search(..) per item...
		// XXX needs refactoring -- feels overcomplicated...
		if(pattern instanceof BaseItem 
				|| (pattern instanceof Array
					&& !pattern
						.reduce(function(r, e){ 
							return r && typeof(e) != typeof({}) }, true))){
			// reverse index...
			index = this
				.reduce(
					function(res, e, i, p){
						res.set(e, [i, p])
						return res }, 
					new Map(), 
					Object.assign(
						Object.flatCopy(options || {}),
						{iterateAll: true}))
			var res
			var Stop = new Error('Stop iteration')
			try {
				return (pattern instanceof Array ? 
						pattern 
						: [pattern])
					.map(function(pattern){ 
						return index.has(pattern) ? 
							// pattern is an explicit item...
							[ func ?
								func.call(this, pattern, 
									...index.get(pattern), 
									// stop(..)
									function stop(v){
										res = v
										throw Stop })
								: pattern ]
							// search...
							: !(pattern instanceof BaseItem) ?
								that.search(pattern, ...args.slice(1)) 
							// not found...
							: [] })
					.flat()
					.unique() 
			} catch(e){
				if(e === Stop){
					return res }
				throw e } }

		// pattern -- normalize and do pattern keywords...
		pattern = options.ignoreKeywords ?
				pattern
			: typeof(pattern) == typeof('str') ?
				((pattern === 'all' || pattern == '*') ?
					true
				: pattern == 'first' ?
					0
				: pattern == 'last' ?
					-1
				: pattern == 'selected' ?
					function(e){ return !!e.selected }
				: pattern == 'focused' ?
					function(e){ return !!e.focused }
				: pattern)
			: pattern
		// normalize negative index...
		if(typeof(pattern) == typeof(123) && pattern < 0){
			pattern = -pattern - 1
			options = Object.assign({},
				options,
				{reverse: 'full'})
		}
		// normalize/build the test predicate...
		var test = (
			// all...
			pattern === true ?
				pattern
			// predicate...
			: pattern instanceof Function ?
				pattern
			// other -> get a compatible test function...
			: Object.entries(this.__search_test_generators__)
				.filter(function([key, _]){
					return !(options.noQueryCheck 
						&& key == 'query') })
				.reduce(function(res, [_, get]){
					return res 
						|| get.call(that.__search_test_generators__, pattern) }, false) )

		return this.walk(
			function(elem, i, path, next, stop){
				// match...
				var res = (elem
						&& (test === true 
							// identity check...
							|| (pattern instanceof BaseItem
								&& pattern === elem)
							// test...
							|| (test 
								// NOTE: we pass next here to provide the 
								// 		test with the option to filter out
								// 		branches that it knows will not 
								// 		match...
								&& test.call(this, elem, i, path, next)))) ?
					// handle the passed items...
					[ func ?
						func.call(this, elem, i, path, stop)
						: elem ]
					: [] 
				return ((options.firstMatch 
							|| typeof(pattern) == typeof(123)) 
						&& res.length > 0) ? 
					stop(res)
					: res },
			options) },


	// Get item... 
	//
	// 	Get focused item...
	// 	.get()
	// 	.get('focused'[, func])
	// 		-> item
	// 		-> undefined
	//
	// 	Get next/prev item relative to focused...
	// 	.get('prev'[, offset][, func][, options])
	// 	.get('next'[, offset][, func][, options])
	// 		-> item
	// 		-> undefined
	//
	// 	Get parent element relative to focused...
	// 	.get('parent'[, func][, options])
	// 		-> item
	// 		-> undefined
	//
	// 	Get first item matching pattern...
	// 	.get(pattern[, func][, options])
	// 		-> item
	// 		-> undefined
	//
	// pattern mostly follows the same scheme as in .select(..) so see 
	// docs for that for more info.
	//
	//
	// NOTE: this is just like a lazy .search(..) that will return the 
	// 		first result only.
	//
	// XXX should we be able to get offset values relative to any match?
	get: function(pattern, options){
		var args = [...arguments]
		pattern = args.shift()
		pattern = pattern === undefined ? 
			'focused' 
			: pattern
		var offset = (pattern == 'next' || pattern == 'prev')
				&& typeof(args[0]) == typeof(123) ?
			args.shift() + 1
			: 1
		var func = args[0] instanceof Function ?
			args.shift() 
			// XXX return format...
			: function(e, i, p){ return e }
		// NOTE: we do not inherit options from this.options here is it 
		// 		will be done in .walk(..)
		options = Object.assign(
			{},
			args.pop() || {},
			{rawResults: true})

		// special case: path pattern -> include collapsed elements... 
		// XXX use something like .isPath(..)
		if(((typeof(pattern) == typeof('str') 
						&& pattern.split(/[\\\/]/g).length > 1)
					// array path...
					|| (pattern instanceof Array 
						&& !pattern
							.reduce(function(r, e){ 
								return r || typeof(e) != typeof('str') }, false)))
				&& !('iterateCollapsed' in options)){
			options.iterateCollapsed = true 
		}

		// sanity checks...
		if(offset <= 0){
			throw new Error(`.get(..): offset must be a positive number, got: ${offset}.`) }

		// NOTE: we do not care about return values here as we'll return 
		// 		via stop(..)...
		var b = pattern == 'prev' ? [] : null
		return [
			// next + offset...
			pattern == 'next' ?
				this.search(true, 
					function(elem, i, path, stop){
						if(elem.focused == true){
							b = offset

						// get the offset item...
						} else if(b != null && b <= 0){
							stop([func(elem, i, path)])
						}
						// countdown to offset...
						b = typeof(b) == typeof(123) ? 
							b - 1 
							: b },
					options)
			// prev + offset...
			: pattern == 'prev' ?
				this.search(true, 
					function(elem, i, path, stop){
						elem.focused == true
							&& stop([func(...(b.length >= offset ? 
								b[0]
								: [undefined]))])
						// buffer the previous offset items...
						b.push([elem, i, path])
						b.length > offset
							&& b.shift() },
					options)
			// get parent element...
			: pattern == 'parent' ?
				this.parentOf()
			// base case -> get first match...
			: this.search(pattern, 
				function(elem, i, path, stop){
					stop([func(elem, i, path)]) }, 
				options) ].flat()[0] },

	// 	
	// 	Get parent of .focused
	// 	.parentOf()
	// 	.parentOf('focused'[, ..])
	// 		-> parent
	// 		-> this
	// 		-> undefined
	//
	// 	Get parent of elem
	// 	.parentOf(elem[, ..])
	// 		-> parent
	// 		-> this
	// 		-> undefined
	//
	//
	// Return values:
	// 	- element		- actual parent element
	// 	- this			- input element is at root of browser
	// 	- undefined		- element not found
	//
	//
	// NOTE: this is signature compatible with .get(..) see that for more
	// 		docs...
	parentOf: function(item, options){
		item = item == null ? this.focused : item
		if(item == null){
			return undefined }
		var path = this.pathOf(item)
		return path.length == 1 ?
			this
			: this.get(path.slice(0, -1), options) },
	positionOf: function(item, options){
		return this.search(
			item == null ? 
				this.focused 
				: item, 
			function(_, i, p){ 
				return [i, p] }, 
			Object.assign(
				{
					firstMatch: true, 
					noQueryCheck: true,
				},
				options || {})).concat([[-1, undefined]]).shift() },
	indexOf: function(item, options){
		return this.positionOf(item, options)[0] },
	pathOf: function(item, options){
		return this.positionOf(item, options)[1] },


	// Like .select(.., {iterateCollapsed: true}) but will expand all the 
	// path items to reveal the target...
	// XXX should this return the matched item(s), expanded item(s) or this???
	reveal: function(key, options){
		var that = this
		var nodes = new Set()
		return this.search(key, 
				function(e, i, path){
					return [path, e] }, 
				Object.assign(
					{ iterateCollapsed: true }, 
					options || {}))
			// NOTE: we expand individual items so the order here is not relevant...
			.map(function([path, e]){
				// get all collapsed items in path...
				path
					.slice(0, -1)
					.forEach(function(_, i){
						var p = that.index[path.slice(0, i+1).join('/')]
						p.collapsed
							&& nodes.add(p) })
				return e })
			// do the actual expansion...
			.run(function(){
				nodes.size > 0
					&& that.expand([...nodes]) }) },


	// Renderer...

	__renderer__: TextRenderer,

	isRendered: function(renderer){
		var render = renderer || this.__renderer__
		render = render.root == null ?
			new render(this, this.options) 
			: render
		return render.isRendered() },

	//
	//	Render browser...
	//	.render([options])
	//		-> data
	//
	//	Render browser using specific renderer...
	//	.render(options, renderer)
	//	.render(options, RendererConstructor)
	//		-> data
	//
	//	Re-render specific items...
	//	.render(item[, options, ...])
	//	.render(items[, options, ...])
	//		// XXX
	//		-> [data, ...]
	//
	//
	//
	// Partial rendering...
	//
	// 	Render items between A and B...
	// 	.render({from: A, to: B, ...}, ...)
	// 		-> data
	//
	// 	Render C items from A...
	// 	.render({from: A, count: C, ...}, ...)
	// 		-> data
	//
	// 	Render C items to A...
	// 	.render({to: A, count: , ...}, ...)
	// 		-> data
	//
	// 	Render C items around A...
	// 	.render({around: A, count: , ...}, ...)
	// 		-> data
	//
	// NOTE: In the signatures below A and B can either be an index or 
	// 		a query compatible with .get(..)
	//
	//
	//
	// options format:
	// 	{
	// 		// Partial render parameters...
	//		//
	// 		// supported combinations:
	// 		//	- from, to
	// 		//	- from, count
	// 		//	- to, count
	// 		//	- around, count
	// 		//
	// 		// NOTE: the only constrain on to/from is that from must be 
	// 		//		less or equal to to, other than that it's fair game,
	// 		//		i.e. overflowing values (<0 or >length) are allowed.
	// 		// NOTE: these are not inherited from .options...
	// 		from: <index> | <query>,
	// 		to: <index> | <query>,
	// 		around: <index> | <query>,
	// 		count: <number>,
	//
	// 		nonFinalized: <bool>,
	//
	//		// for more supported options see: .walk(..)
	// 		...
	// 	}
	//
	// NOTE: there is no need to explicitly .make(..) the state before
	// 		calling this as first access to .items will do so automatically...
	// NOTE: calling this will re-render the existing state. to re-make 
	// 		the state anew that use .update(..)...
	// NOTE: it is not recommended to extend this. all the responsibility
	// 		of actual rendering should lay on the renderer methods...
	//
	//
	// NOTE: we do not need filtering here as it is best handled via:
	// 			this
	// 				.filter(..)
	// 				.render()
	// 		this approach will maintain all the functionality but lose 
	// 		topology, doing this via .render(..) directly will maintain 
	// 		topology but will break control and other data-driven stuff...
	//
	// XXX revise... 
	render: function(options, renderer){
		var that = this
		var args = [...arguments]

		// parse args...
		var list = (args[0] instanceof BaseItem || args[0] instanceof Array) ?
			[args.shift()].flat()
			: null
		var [options, renderer] = 
			(args[0] instanceof BaseRenderer || args[0] instanceof Function) ?
				[null, args.shift()]
				: args
		// NOTE: these only apply to the 'items' section...
		var base_path = args[args.length-1] instanceof Array ?
		   	args.pop() 
			: []
		var base_index = typeof(args[args.length-1]) == typeof(123)?
		   	args.pop() 
			: 0

		options = Object.assign(
			Object.create(this.options || {}),
			{ 
				iterateNonIterable: true,
				includeInlinedBlocks: true,
			}, 
			// NOTE: we need to get all the keys from options, including 
			// 		inherited defaults...
			Object.flatCopy(options || {}))
		var render = renderer || this.__renderer__
		render = render.root == null ?
			new render(this, options) 
			: render

		var section = options.section || '*'
		section = section == '*' ?
			options.sections
			: section
		section = (section instanceof Array && section.length == 1) ?
			section[0]
			: section

		// from/to/around/count...
		var get_opts = Object.assign(
			Object.create(options),
			// prevent hitting inlined block containers as render start/end points...
			{includeInlinedBlocks: false})
		var get = function(x){
			return options[x] instanceof BaseItem ?
				[undefined, undefined, options[x]]
			: options[x] != null ?
				that.get(options[x], function(e, i, p){ return [i, p, e] }, get_opts) || []
			: [undefined, undefined, undefined] }
		var [f, from_path, from] = get('from')
		var [t, _, to] = get('to')
		var a = get('around')[0]
		var count = options.count || null
		// complete to/from based on count and/or around...
		if(count != null){
			from = from 
				|| this.get(
					(f = Math.max(0, 
						t != null ?
							t - count
						: a != null ?
							a - Math.floor(count/2)
						: 0)), 
					get_opts)
			to = to 
				|| this.get(
					(t = f != null ?
							f + count
						: a != null ?
							a + Math.ceil(count/2)
						: -1), 
					get_opts) }
		;[options.from, options.to] = [from, to]
		// partial render start path...
		// NOTE: used to check if an item is on the path to <from> and 
		// 		pass it to the skipped topology constructor...
		from_path = options.from_path = 
			options.from_path
				|| from && this.pathOf(from, get_opts)
		from_path = from_path instanceof Array && from_path


		// used as a means to calculate lengths of nested blocks rendered 
		// via .render(..)
		var l
		// rendering state for partial renders...
		// NOTE: when this is null then rendering is done...
		var rendering = render.rendering =
			'rendering' in render ?
				render.rendering
				: !from
		return ((list == null && render.root === this && section instanceof Array) ?
				// render list of sections...
				// NOTE: we will only render the section list on the top 
				// 		level on all lower levels only the specific section
				// 		is rendered for all nested browsers...
				section
					.reduce(function(res, name){
						res[name] = that.render(
							Object.assign({},
								options,
								{
									section: name,
									nonFinalized: true,
								},
								// ignore partial render options in sections 
								// other than items...
								name != 'items' ?
									{ to: undefined, from: undefined }
									: {}), 
							render, 
							// NOTE: base_index and base_path only apply 
							// 		to the 'items' section...
							...(name == 'items' ?
								[base_index, base_path]
								: [])) 
						return res }, {})

				// render single section...
				: this.walk(
					...(list || []),
					function(e, i, p, children){
						// maintain rendering state....
						// NOTE: render ranges are supported only in 'items' section...
						rendering = section != 'items'
							|| (render.rendering = 
								!rendering && from === e ?
									true
								: rendering && to === e ?
									null
								: render.rendering)
						// XXX should we stop here?
						// 		...we'll need stop() to return the incomplete list...
						//rendering === null 
						//	&& stop()

						// index...
						// NOTE: since we let the nested browsers render sections
						// 		of the list, we also need to compensate for the 
						// 		number of elements they render...
						base_index += (l || []).length
						i += base_index
						l = []

						// path...
						// remove inlined item id from path...
						;(e instanceof BaseBrowser || e instanceof Array)
							&& p.pop()
						p = base_path.concat(p)

						// children...
						// do not go down child browsers -- use their .render(..) 
						// NOTE: doing so will require us to manually handle some 
						// 		of the options that would otherwise be handled 
						// 		by .walk(..)...
						var inlined = (e instanceof BaseBrowser 
								|| e.children instanceof BaseBrowser)
							&& !children(false)
						// get children either via .walk(..) or .render(..) 
						// depending on item type...
						var getChildren = function(){
							return inlined ?
								(l = (e.children instanceof BaseBrowser ? 
										e.children 
										: e)
									.render(options, render, i+1, p))
								: children(true) }

						// do the actual rendering...
						return (
							// special case: nested from -> render topology...
							(from_path 
									&& rendering === false
									// only for nested...
									&& e.children
									// only sub-path...
									&& p.cmp(from_path.slice(0, p.length))) ?
								render.nest(null, getChildren(), i, p, options)
							// skip out of range items...
							: (rendering == null
									// but keep inlined blocks before the rendering starts...
									// NOTE: they will not render anything if no 
									// 		items are provided...
									|| (!rendering
										&& !(e instanceof BaseBrowser || e instanceof Array))) ?
								[]
							// inlined...
							: (e instanceof BaseBrowser || e instanceof Array) ?
								render.inline(e,
									// handling non-propageted options...
									!options.skipInlined ?
										getChildren()
										: [], 
									i, p, options)
							// nested...
							: 'children' in e ?
								render.nest(e, 
									// handling non-propageted options...
									(!options.skipNested 
											&& (options.iterateCollapsed || !e.collapsed)) ?
										getChildren()
										: [],
									i, p, options)
							// basic item...
							: render.elem(e, i, p, options) )
						}, options))
			// finalize render...
			.run(function(){
				return (list == null 
						&& !options.nonFinalized 
						&& render.root === that) ?
					render.finalize(this instanceof Array ?
						{[section]: this}
							: this, options)
					// XXX should we call render.finalize(..) for list???
					: this }) }, 


	// Events...
	//
	// Format:
	// 	{
	// 		<event-name>: [
	// 			<handler>,
	// 			...
	// 		],
	// 		...
	// 	}
	//
	//
	// NOTE: event handlers may have a .tag attribute that stores the tag
	// 		it was created with, this is used by .off(..) to unbind handlers
	// 		tagged with specific tags...
	__event_handlers: null,

	// List events...
	get events(){
		var that = this
		// props to skip...
		// XXX should we just skip any prop???
		var skip = new Set([
			'events'
		])
		return Object.deepKeys(this)
			.map(function(key){
				return (!skip.has(key) 
						&& that[key] instanceof Function 
						&& that[key].event) ? 
					that[key].event 
					: [] })
			.flat() },

	// Generic event infrastructure...
	//
	//	Bind a handler to an event...
	// 	.on(event, func)
	// 	.on(event, func, tag)
	// 		-> this
	//
	// tag can be used to unregister several handlers in a single operation,
	// see .off(..) for more info...
	//
	//
	// NOTE: .one(..) has the same signature as .on(..) but will unregister 
	// 		the handler as soon as it is done...
	//
	// XXX should we be able to trigger events from the item directly???
	// 		i.e. .get(42).on('open', ...) instead of .get(42).open = ...
	// 		...might be a good idea to create an item wrapper object...
	on: function(evt, handler, tag){
		var handlers = this.__event_handlers = this.__event_handlers || {}
		handlers = handlers[evt] = handlers[evt] || []
		handlers.push(handler)
		tag
			&& (handler.tag = tag)
		return this
	},
	one: function(evt, handler, tag){
		var func = function(...args){
			handler.call(this, ...args)
			this.off(evt, func)
		}
		this.on(evt, func, tag)
		return this
	},
	//
	//	Clear all event handlers...
	//	.off('*')
	//
	//	Clear all event handlers from evt(s)...
	//	.off(evt)
	//	.off([evt, ..])
	//	.off(evt, '*')
	//	.off([evt, ..], '*')
	//
	//	Clear handler of evt(s)...
	//	.off(evt, handler)
	//	.off([evt, ..], handler)
	//
	//	Clear all handlers tagged with tag of evt(s)...
	//	.off(evt, tag)
	//	.off([evt, ..], tag)
	//
	// NOTE: evt can be '*' or 'all' to indicate all events.
	off: function(evt, handler){
		if(arguments.length == 0){
			return
		}

		var handlers = this.__event_handlers || {}

		// parse args...
		handler = handler || '*'
		evt = 
			// all events / direct handler...
			(!(evt in handlers) 
					|| evt == '*' 
					|| evt == 'all') ? 
				Object.keys(handlers) 
			// list of events...
			: evt instanceof Array ?
				evt
			// explicit event...
			: [evt]

		// remove all handlers
		handler == '*' || handler == 'all' ?
			evt
				.forEach(function(evt){
					delete handlers[evt] })

		// remove tagged handlers...
		: typeof(handler) == typeof('str') ?
			evt
				.forEach(function(evt){
					var h = handlers[evt] || []
					var l = h.length
					h
						.slice()
						.reverse()
						.forEach(function(e, i){ 
							e.tag == handler
								&& h.splice(l-i-1, 1) }) })

		// remove only the specific handler...
		: evt
			.forEach(function(evt){
				var h = handlers[evt] || []
				do{
					var i = h.indexOf(handler)
					i > -1
						&& h.splice(i, 1)
				} while(i > -1) })
		return this
	},
	// 
	// 	Trigger an event by name...
	// 	.trigger(<event-name>, ..)
	// 		-> this
	//
	// 	Trigger an event...
	// 	.trigger(<event-object>, ..)
	// 		-> this
	//
	//
	// Optional event extension methods:
	// 	Event shorthand 
	// 	.<event-name>(..)
	// 		called by .trigger(<event-name>, ..)
	// 		...
	// 		create <event-object>
	// 		call .trigger(<event-object>, ..)
	//
	// 		Used for:
	// 			- shorthand to .trigger(<event-name>, ..)
	// 			- shorthand to .on(<event-name>, ..) 
	// 			- base event functionality
	//
	// 		See: makeEventMethod(..) and makeItemEventMethod(..) for docs.
	//
	//
	// 	Base event handler
	// 	.__<event-name>__(event, ..)
	// 		called by .trigger(<event-object>, ..) as the first handler
	//
	// 		Used as system event handler that can not be removed via 
	// 		.off(..)
	//
	//
	// for docs on <event-object> see BrowserEvent(..)
	trigger: function(evt, ...args){
		var that = this

		// trigger the appropriate event handler if available...
		// NOTE: this makes .someEvent(..) and .trigger('someEvent', ..)
		// 		do the same thing by always triggering .someEvent(..) 
		// 		first and letting it decide how to call .trigger(..)...
		// NOTE: the event method should pass a fully formed event object
		// 		into trigger when it requires to call the handlers...
		if(typeof(evt) == typeof('str') 
				&& this[evt] instanceof Function
				&& this[evt].event == evt){
			this[evt](...args)
			return this
		}
		// propagation is stopped...
		// XXX expand this check to support DOM events...
		if(evt.propagationStopped || evt.cancelBubble){
			return this
		}

		var evt = typeof(evt) == typeof('str') ?
			new BrowserEvent(evt)
			: evt

		// call the main set of handlers...
		;((this.__event_handlers || {})[evt.name] || [])
			// prevent .off(..) from affecting the call loop...
			.slice()
			// add the static .__<event>__(..) handler if present...
			.concat([this[`__${evt.name}__`] || []].flat())
			// call handlers...
			.forEach(function(handler){
				handler.call(that, evt, ...args) })

		// trigger the parent's event...
		!(evt.propagationStopped || evt.cancelBubble)
			&& this.parent
			&& this.parent.trigger instanceof Function
			// XXX should we pass trigger and event object or event name???
			&& this.parent.trigger(evt, ...args)

		return this
	},


	// domain events/actions...
	//
	// 	Bind a handler to an event...
	// 	.focus(func)
	// 		-> this
	//
	// 	Trigger an event...
	// 	.focus(query[, ...])
	// 		-> this
	//
	//
	// NOTE: this will ignore disabled items.
	// NOTE: .focus('next') / .focus('prev') will not wrap around the 
	// 		first last elements...
	// NOTE: if focus does not change this will trigger any handlers...
	// NOTE: this will reveal the focused item...
	focus: makeItemEventMethod('focus', {
		handler: function(evt, items){
			var item = items.shift()
			// blur .focused...
			this.focused
				&& this.blur(this.focused)
			// NOTE: if we got multiple matches we care only about the first one...
			item != null
				&& this.reveal(item)
				&& (item.focused = true) },
		default_item: function(){ return this.get(0) },
		options: function(){
			return {
				skipDisabled: !(this.options || {}).focusDisabledItems,
			} },
		getter: 'get' }),
	blur: makeItemEventMethod('blur', {
		handler: function(evt, items){
			items.forEach(function(item){
				delete item.focused }) },
		default_item: function(){ return this.focused } }),
	toggleFocus: makeItemEventToggler(
		'focused', 
		'focus', 'blur', 
		function(){ return this.focused || 0 }, 
		false),
	// NOTE: .next() / .prev() will wrap around the first/last elements,
	// 		this is different from .focus('next') / .focus('prev')...
	// NOTE: these also differ from focus in that they will only go 
	// 		through the main section...
	next: function(options){ 
		options = Object.assign(
			{ skipDisabled: !(this.options || {}).focusDisabledItems },
			options || {})
		return this.focus(this.get('next', options) || this.get('first', options)) },
	prev: function(options){ 
		options = Object.assign(
			{ skipDisabled: !(this.options || {}).focusDisabledItems },
			options || {})
		return this.focus(this.get('prev', options) || this.get('last', options)) },
	// selection...
	select: makeItemOptionOnEventMethod('select', 'selected', {
		options: function(){
			return {
				skipDisabled: !(this.options || {}).focusDisabledItems,
			} }, }),
	deselect: makeItemOptionOffEventMethod('deselect', 'selected', {
		options: { skipDisabled: false }, }),
	toggleSelect: makeItemEventToggler('selected', 'select', 'deselect', 'focused'),
	// topology...
	collapse: makeItemOptionOnEventMethod('collapse', 'collapsed', {
		filter: function(elem){ return elem.value && elem.children },
		options: {iterateCollapsed: true}, }),
	expand: makeItemOptionOffEventMethod('expand', 'collapsed', {
		filter: function(elem){ return elem.value && elem.children },
		options: {iterateCollapsed: true}, }),
	toggleCollapse: makeItemEventToggler(
		'collapsed', 
		'collapse', 'expand', 
		'focused',
		function(elem){ return elem.value && elem.children },
		{iterateCollapsed: true}),
	// item state events...
	disable: makeItemOptionOnEventMethod('disable', 'disabled', 
		{ handler: function(item){ 
			(this.options || {}).focusDisabledItems 
				|| this.blur(item) }, }),
	enable: makeItemOptionOffEventMethod('enable', 'disabled', 
		{ options: {skipDisabled: false}, }),
	toggleDisabled: makeItemEventToggler(
		'disabled', 
		'disable', 'enable', 
		'focused',
		{ skipDisabled: false }),
	// visibility...
	hide: makeItemOptionOnEventMethod('hide', 'hidden'),
	show: makeItemOptionOffEventMethod('show', 'hidden'),
	toggleHidden: makeItemEventToggler('hidden', 'hide', 'show', 'focused'),

	// primary/secondary/ternary? item actions...
	open: makeItemEventMethod('open', {
		// XXX not yet sure if this is correct...
		action: function(evt, item){
			item.length > 0
				&& this.toggleCollapse(item) },
		default_item: function(){ return this.focused } }),
	launch: makeItemEventMethod('launch', {
		default_item: function(){ return this.focused } }),

	// Update state (make then render)...
	//
	// 	Update (re-render) the current state...
	// 	.update()
	// 	.update(options)
	// 		-> state
	//
	// 	Force re-make the state and re-render...
	// 	.update(true[, options])
	// 		-> state
	//
	//
	// NOTE: .update() without arguments is the same as .render()
	// NOTE: if called too often this will delay subsequent calls...
	//
	// XXX calling this on a nested browser should update the whole thing...
	// 		...can we restore the context via .parent???
	// XXX should we force calling update if options are given???
	// 		...and should full get passed if at least one call in sequence
	// 		got a full=true???
	// XXX supported mdoes:
	// 		'full' | true	- make - render - post-render
	// 		'normal'		- render - post-render
	// 		'partial'		- post-render
	__update_mode: undefined,
	__update_args: undefined,
	__update_timeout: undefined,
	__update_max_timeout: undefined,
	update: makeEventMethod('update', 
		function(evt, mode, options){
			var modes = [
				'full', 
				'normal', 
				'partial',
			]

			options = mode instanceof Object ?
				mode
				: options
			mode = mode === options ? 
					'normal' 
				: mode === true ?
					'full'
				: mode
			// sanity check...
			if(!modes.includes(mode)){
				throw new Error(`.update(..): unsupported mode: ${mode}`) }
			var m = this.__update_mode
			// if the queued mode is deeper than the requested, ignore the requested...
			if(m != null && modes.indexOf(mode) > modes.indexOf(m)){
				return this }

			// queue update...
			// NOTE: we can't simply use _update(..) closure for this as
			// 		it can be called out of two contexts (timeout and 
			// 		max_timeout), one (timeout) is renewed on each call 
			// 		thus storing the latest args, while the other (i.e.
			// 		max_timeout) is not renewed until it is actually 
			// 		called and thus would store the args at the time of 
			// 		its setTimeout(..)...
			// 		storing the arguments in .__update_args would remove
			// 		this inconsistency...
			this.__update_mode = mode
			var args = this.__update_args = [
				[evt, mode, 
					...(options ? 
						[options] 
						: [])], 
				options]

			var timeout = (options || {}).updateTimeout
				|| this.options.updateTimeout
			var max_timeout = (options || {}).updateMaxDelay
				|| this.options.updateMaxDelay

			var _clear_timers = function(){
				// house keeping...
				clearTimeout(this.__update_max_timeout)
				delete this.__update_max_timeout
				clearTimeout(this.__update_timeout)
				delete this.__update_timeout }.bind(this)
			var _update = function(){
				_clear_timers()
				var mode = this.__update_mode
				var [args, opts] = this.__update_args

				delete this.__update_mode
				delete this.__update_args

				// make...
				modes.indexOf(mode) <= modes.indexOf('full')
					&& this.make(opts) 
				// render...
				;(!this.isRendered((opts || {}).renderer)
						|| modes.indexOf(mode) <= modes.indexOf('normal'))
					&& this
						.preRender(opts, (opts || {}).renderer)
						.render(opts, (opts || {}).renderer) 
				// update...
				this.trigger(...args) }.bind(this)
			var _update_n_delay = function(){
				// call...
				_update()
				// schedule clear...
				this.__update_timeout = setTimeout(_clear_timers, timeout) }.bind(this)

			// no timeout...
			if(!timeout){
				_update()

			// first call -> call sync then delay...
			} else if(this.__update_timeout == null){
				_update_n_delay()

			// fast subsequent calls -> delay... 
			} else {
				clearTimeout(this.__update_timeout)
				this.__update_timeout = setTimeout(_update, timeout) 
				// force run at max_timeout...
				max_timeout 
					&& this.__update_max_timeout == null
					&& (this.__update_max_timeout = 
						setTimeout(_update_n_delay, max_timeout))
			}
		}, 
		// we'll retrigger manually...
		false),
	// this is triggered by .update() just before render...
	preRender: makeEventMethod('preRender'),


	// NOTE: if given a path that does not exist this will try and load 
	// 		the longest existing sub-path...
	// XXX should level drawing be a feature of the browser or the 
	// 		client (as-is in browser.js)???
	// XXX would also need to pass the path to .make(..) and friends for 
	// 		compatibility...
	// 		...or set .options.path (and keep it up to date in the API)...
	load: makeEventMethod('load', 
		function(evt, target){},
		function(evt, target){
			// XXX use .normalizePath(..)
			target = typeof(target) == typeof('str') ?
				(target.trim().endsWith('/') ? 
					target.trim() + '*'
					: target.trim()).split(/[\\\/]/g)
				: target
			// search for longest existing path...
			var elem
			do{
				elem = this.get(target)
			} while(elem === undefined && target.pop())
			elem
				&& this.focus(elem) }),

	close: makeEventMethod('close', function(evt, reason){}),
	

	// Instance constructor...
	//
	// 	BaseBrowser(items(make, options)[, options])
	// 		-> browser
	//
	// 	Set header and items generators...
	// 	BaseBrowser(
	// 			header(make, options) | null, 
	// 			items(make, options)[, options])
	// 		-> browser
	//
	// 	Set both header and footer...
	// 	BaseBrowser(
	// 			header(make, options) | null, 
	// 			items(make, options), 
	// 			footer(make, options) | null[, options])
	// 		-> browser
	//
	//
	// NOTE: of either header or footer are set to null and 
	// 		options.defaultHeader / options.defaultFooter are set then 
	// 		they will be used. To disable header footer completely set 
	// 		the corresponding default option to null too.
	// NOTE: for options.defaultHeader / options.defaultFooter the docs
	// 		are in the options section.
	//
	// XXX should we .update(..) on init....
	__init__: function(func, options){
		var args = [...arguments]

		// header (optional)...
		args[1] instanceof Function ?
			(this.__header__ = args.shift())
		: args[0] == null
			&& args.shift()

		// items...
		this.__items__ = args.shift()

		// footer (optional)..
		args[0] instanceof Function ?
			(this.__footer__ = args.shift())
		: args[0] == null
			&& args.shift()

		// options (optional)...
		this.options = Object.assign(
			Object.create(this.options || {}), 
			Object.flatCopy(args[0] || {})) },
}


var BaseBrowser = 
module.BaseBrowser = 
object.Constructor('BaseBrowser', 
		BaseBrowserClassPrototype, 
		BaseBrowserPrototype)



//---------------------------------------------------------------------
// HTML-specific UI...

var KEYBOARD_CONFIG =
module.KEYBOARD_CONFIG = {
	ItemEdit: {
		pattern: '.list .text[contenteditable]',

		// XXX
	},

	PathEdit: {
		pattern: '.path[contenteditable]',

		// XXX
	},

	Filter: {
		pattern: '.path div.cur[contenteditable]',

		// XXX
	},

	General: {
		pattern: '*',

		// XXX use up/down
		Up: 'prev!',
		Down: 'next!',
		Left: 'left',
		Right: 'right',

		PgUp: 'pageUp!',
		PgDown: 'pageDown!',

		Home: 'focus: "first"',
		End: 'focus: "last"',

		'#1': 'open: 0',
		'#2': 'open: 1',
		'#3': 'open: 2',
		'#4': 'open: 3',
		'#5': 'open: 4',
		'#6': 'open: 5',
		'#7': 'open: 6',
		'#8': 'open: 7',
		'#9': 'open: 8',
		'#0': 'open: 9',


		Enter: 'open',

		Space: 'toggleSelect!',
		ctrl_A: 'select!: "*"',
		ctrl_D: 'deselect!: "*"',
		ctrl_I: 'toggleSelect!: "*"',

		// paste...
		ctrl_V: '__paste',
		meta_V: 'ctrl_V',
		// copy...
		ctrl_C: '__copy',
		ctrl_X: 'ctrl_C',
		meta_C: 'ctrl_C',

		// NOTE: do not bind this key, it is used to jump to buttons
		// 		via tabindex...
		Tab: 'NEXT!',
	},

	// XXX need to keep this local to each dialog instance...
	ItemShortcuts: {
		doc: 'Item shortcuts',
		pattern: '*',

		// this is where item-specific shortcuts will be set...
	},
}


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
// Item...

var HTMLItemClassPrototype = {
	text: function(elem){
		var txt = object.parentCall(HTMLItem.text, this, elem)
		return txt != null ?
			(txt + '')
				.replace(/\$(.)/g, '$1') 
			: txt },
	elem: function(elem){
		elem = elem.dom || elem
		return elem.classList.contains('list') ? 
				elem.querySelector('.item')
				: elem },
}

// XXX should we wrap .collapsed, .disabled, .selected in props to 
// 		auto-update an item on prop change???
// XXX problems with writing .dom / .elem, needs revision...
var HTMLItemPrototype = {
	__dom: undefined,
	get dom(){
		return this.__dom },
	set dom(value){
		this.__dom
			// NOTE: a node can't be attached to two places, so in this 
			// 		case (i.e. when replacing item with list containing 
			// 		item) we do not need to do anything as attaching to
			// 		the tree is done by the code that created the parent
			// 		and called us...
			&& !value.contains(this.__dom)
			&& this.__dom.replaceWith(value)
		this.__dom = value },

	get elem(){
		return this.constructor.elem(this) },
	// XXX for this to be practical we need to slightly update rendering...
	// 		...currently the following are not equivalent:
	//
	// 			dialog.get(0).elem = dialog.renderItem(dialog.get(0), 0, {})
	// 		
	// 			dialog.get(0).elem.replaceWith(dialog.renderItem(dialog.get(0), 0, {}))
	//
	// 		#2 works as expected while #1 seems not to change anything, this
	// 		is because in #1 .renderItem(..) actually sets new .dom BEFORE
	// 		calling .elem.replaceWith(..)... 
	// 		the new .dom value is replaced correctly but it is detached, 
	// 		thus we see no change...
	// XXX THIS IS WRONG...
	// 		...this can detach elements, see above for more info...
	set elem(value){
		this.dom ?
			this.elem.replaceWith(value)
			: (this.dom = value) },

	// maintain focus...
	update: function(){
		var that = this
		return object.parentCall(HTMLItemPrototype.update, this, ...arguments)
			.run(function(){
				that.focused 
					&& that.elem.focus() }) },
}

var HTMLItem = 
module.HTMLItem = 
object.Constructor('HTMLItem', BaseItem,
	HTMLItemClassPrototype,
	HTMLItemPrototype)


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
// Helpers...

// Scrolling / offset...
//
var scrollOffset = function(browser, direction, elem){
	var elem = (elem || browser.focused).elem
	var lst = browser.dom.querySelector('.list.items')
	return direction == 'top' ?
		elem.offsetTop - lst.scrollTop
		: lst.offsetHeight 
			- (elem.offsetTop - lst.scrollTop 
				+ elem.offsetHeight) }
var nudgeElement = function(browser, direction, elem){
	var threashold = browser.options.focusOffsetWhileScrolling || 0

	// keep scrolled item at threashold from list edge...
	var offset = scrollOffset(browser, 
		direction == 'up' ? 
			'top' 
			: 'bottom', 
		elem)
	var lst = browser.dom.querySelector('.list.items')

	offset < threashold
		&& lst.scrollBy(0, 
			direction == 'up' ?
				offset - threashold
				: Math.floor(threashold - offset)) } 

// Make item/page navigation methods...
//
var focusItem = function(direction){
	// sanity check...
	if(direction != 'up' && direction != 'down'){
		throw new Error('focusItem(..): unknown direction: '+ direction) }

	return function(){
		var name = direction == 'up' ? 'prev' : 'next'
		object.parentCall(HTMLBrowserPrototype, name, this, ...arguments)

		var threashold = this.options.focusOffsetWhileScrolling || 0

		var focused = this.focused
		var first = this.get('first', {skipDisabled: !(this.options || {}).focusDisabledItems})
		var last = this.get('last', {skipDisabled: !(this.options || {}).focusDisabledItems})

		// center the first/last elements to reveal hidden items before/after...
		;(focused === last || focused === first) ?
			this.scrollTo(this.focused, 'center')
		// keep scrolled item at threashold from list edge...
		: threashold > 0
			&& nudgeElement(this, direction, this.focused)

		// hold repeat at last element...
		focused === (direction == 'up' ? first : last)
			&& this.keyboard.pauseRepeat
			&& this.keyboard.pauseRepeat() 

		return this } }
// XXX this behaves in an odd way with .options.scrollBehavior = 'smooth'
var focusPage = function(direction){
	var d = direction == 'up' ?
			'pagetop'
		: direction == 'down' ?
			'pagebottom'
		: null
	var t = direction == 'up' ?
			'first'
		: direction == 'down' ?
			'last'
		: null

	// sanity check...
	if(d == null){
		throw new Error('focusPage(..): unknown direction: '+ direction) }

	return function(){
		var target = this.get(d)
		var focused = this.focused

		// reveal diabled elements above the top focusable...
		;(target === this.get(t, {skipDisabled: !(this.options || {}).focusDisabledItems}) 
				&& target === focused) ?
			this.scrollTo(target, 'center')
		// scroll one page and focus...
		: target === focused ?
			this.focus(this.get(d, 1, {skipDisabled: !(this.options || {}).focusDisabledItems}))
		// focus top/bottom of current page...
		: this.focus(target)

		;(this.options.focusOffsetWhileScrolling || 0) > 0
			&& nudgeElement(this, direction, this.focused)

		return this
	} }

// Update element class...
//
// XXX should we use .renderItem(...) for this???
var updateElemClass = function(action, cls, handler){
	return function(evt, elem, ...args){
		elem 
			&& elem.elem.classList[action](cls) 
		return handler 
			&& handler.call(this, evt, elem, ...args)} }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
// HTML Renderer...

// XXX HACK: see .nest(..)
var HTMLRenderer =
module.HTMLRenderer =
object.Constructor('HTMLRenderer', BaseRenderer, {
	isRendered: function(){ 
		return !!this.root.dom },

	// secondary renderers...
	//
	// base dialog...
	//
	// Foramt:
	// 	<div class="browse-widget" tabindex="0">
	// 		<!-- header -->
	// 		...
	//
	// 		<!-- sections -->
	// 		...
	//
	// 		<!-- footer -->
	// 		...
	// 	</div>
	//
	// NOTE: this expects a dict of lists of rendered elements...
	dialog: function(sections, options){
		var that = this
		var {header, footer, ...sections} = sections

		// dialog (container)...
		var dialog = document.createElement('div')
		dialog.classList.add('browse-widget')
		dialog.setAttribute('tabindex', '0')
		// HACK?: prevent dialog from grabbing focus from item...
		dialog.addEventListener('mousedown', 
			function(evt){ evt.stopPropagation() })

		// special case: header...
		header
			&& !options.hideListHeader
			&& dialog.appendChild(that.section('header', header, options))
		// sections...
		Object.entries(sections)
			.forEach(function([name, items]){
				dialog.appendChild(that.section(name, items, options)) })
		// special case: footer...
		footer 
			&& !options.hideListFooter
			&& dialog.appendChild(this.section('footer', footer, options))

		return dialog 
	},

	// section... 
	//
	// Format:
	// 	<div class="list v-block name">
	// 		<!-- elems -->
	// 		...
	// 	</div>
	//
	section: function(name, elems, options){
		var section = document.createElement('div')
		section.classList.add('list', 'v-block', name)
		// prevent scrollbar from grabbing focus...
		section.addEventListener('mousedown', 
			function(evt){ evt.stopPropagation() })
		elems instanceof Node ?
			section.appendChild(elems)
			: elems
				.forEach(function(item){
					section.appendChild(item) })
		return section
	},

	// header element...
	//
	// same as element with the following classes added:
	// 	- sub-list-header
	// 	- traversable
	// 	- collapsed 		- if item.collapsed is true
	//
	// NOTE: this takes an un-rendered item...
	headerElem: function(item, index, path, options){
		return this.elem(...arguments)
			// update dom...
			.run(function(){
				this.classList.add('sub-list-header', 'traversable')
				item.collapsed
					&& this.classList.add('collapsed') }) },

	// base renderers...
	//
	// Format:
	// 	<div value="value_json" class="item .." tabindex="0" ..>
	// 		<!-- value -->
	// 		<div class="text">value_a</div>
	// 		<div class="text">value_b</div>
	// 		...
	//
	// 		<!-- buttons (optional) -->
	// 		<div class="button">button_a_html</div>
	// 		<div class="button">button_b_html</div>
	// 		...
	// 	</div>
	//
	// NOTE: DOM events trigger Browser events but not the other way 
	// 		around. It is not recommended to use DOM events directly.
	//
	// XXX need to figure out an intuitive behavior of focus + disable/enable...
	// 		...do we skip disabled elements?
	// 		...can a disabled item be focused?
	// 		...how do we collapse/expand a disabled root?
	// 		...what do we focus when toggleing disabled?
	// XXX handle .options.focusDisabledItems correctly...
	// 		- tabindex -- DONE
	// 		- ???
	// XXX show button global/local keys...
	elem: function(item, index, path, options){
		var that = this
		var browser = this.root
		if(options.hidden && !options.renderHidden){
			return null
		}
		var section = item.section || options.section

		// helpers...
		// XXX we need to more carefully test the value to avoid name clashes...
		var resolveValue = function(value, context, exec_context){
			var htmlhandler = typeof(value) == typeof('str') ?
				browser.parseStringHandler(value, exec_context)
				: null
			return value instanceof Function ?
					value.call(browser, item)
				: htmlhandler 
						&& htmlhandler.action in context 
						&& context[htmlhandler.action] instanceof Function ?
					context[htmlhandler.action]
						.call(browser, item, ...htmlhandler.arguments)
				: value }
		var setDOMValue = function(target, value){
			value instanceof HTMLElement ?
				target.appendChild(value)
			: (typeof(jQuery) != 'undefined' && value instanceof jQuery) ?
				value.appendTo(target)
			: (target.innerHTML = value)
			return target }
		var doTextKeys = function(text, doKey){
			return text.replace(/\$\w/g, 
				function(k){
					// forget the '$'...
					k = k[1] 
					return (doKey && doKey(k)) ?
						`<u class="key-hint">${k}</u>`
						: k }) }

		// special-case: item.html...
		if(item.html){
			// NOTE: this is a bit of a cheat, but it saves us from either 
			// 		parsing or restricting the format...
			var tmp = document.createElement('div')
			tmp.innerHTML = item.html
			var elem = item.dom = tmp.firstElementChild 
			elem.classList.add(
				...(item['class'] instanceof Array ?
					item['class']
					: item['class'].split(/\s+/g)))
			return elem }

		// Base DOM...
		var elem = document.createElement('div')
		var text = item.text

		// classes...
		elem.classList.add(...['item']
			// user classes...
			.concat((item['class'] || item.cls || [])
				// parse space-separated class strings...
				.run(function(){
					return this instanceof Array ?
						this
						: this.split(/\s+/g) }))
			// special classes...
			.concat(
				(options.shorthandItemClasses || [])
					.filter(function(cls){ 
						return !!item[cls] })))

		// attrs...
		;(item.disabled && !options.focusDisabledItems)
			|| elem.setAttribute('tabindex', '0')
		Object.entries(item.attrs || {})
			// shorthand attrs...
			.concat((options.shorthandItemAttrs || [])
				.map(function(key){ 
					return [key, item[key]] }))
			.forEach(function([key, value]){
				value !== undefined
					&& elem.setAttribute(key, value) })
		;(item.value == null 
				|| item.value instanceof Object)
			|| elem.setAttribute('value', item.text)
		;(item.value == null 
				|| item.value instanceof Object 
				|| item.alt != item.text)
			&& elem.setAttribute('alt', item.alt)

		// values...
		text != null
			&& (item.value instanceof Array ? 
					item.value 
					: [item.value])
				// handle $keys and other stuff...
				// NOTE: the actual key setup is done in .__preRender__(..)
				// 		see that for more info...
				.map(function(v){
					// handle key-shortcuts $K...
					v = typeof(v) == typeof('str') ?
						doTextKeys(v, 
							function(k){
								return (item.keys || [])
									.includes(browser.keyboard.normalizeKey(k)) })
						: v

					var value = document.createElement('span')
					value.classList.add('text')

					// set the value...
					setDOMValue(value, 
						resolveValue(v, browser))

					elem.appendChild(value)
				})

		// system events...
		elem.addEventListener('click', 
			function(evt){
				evt.stopPropagation()
				// NOTE: if an item is disabled we retain its expand/collapse
				// 		functionality...
				// XXX revise...
				item.disabled ?
					browser.toggleCollapse(item)
					: browser.open(item, text, elem) })
		elem.addEventListener('focus', 
			function(){ 
				// NOTE: we do not retrigger focus on an item if it's 
				// 		already focused...
				browser.focused !== item
					// only trigger focus on gettable items...
					// ...i.e. items in the main section excluding headers 
					// and footers...
					&& browser.focus(item) })
		elem.addEventListener('contextmenu', 
			function(evt){ 
				evt.preventDefault()
				browser.menu(item) })
		// user events...
		Object.entries(item.events || {})
			// shorthand DOM events...
			.concat((options.shorthandItemEvents || [])
				.map(function(evt){ 
					return [evt, item[evt]] }))
			// setup the handlers...
			.forEach(function([evt, handler]){
				handler
					&& elem.addEventListener(evt, handler.bind(browser)) })

		// buttons...
		var button_keys = {}
		// XXX migrate button inheritance...
		var buttons = (item.buttons 
				|| (section == 'header' 
					&& (options.headerButtons || []))
				|| (section == 'footer' 
					&& (options.footerButtons || [])) 
				|| options.itemButtons 
				|| [])
			// resolve buttons from library...
			.map(function(button){
				return button instanceof Array ?
						button
					// XXX reference the actual make(..) and not Items...
					: Items.buttons[button] instanceof Function ?
						[Items.buttons[button].call(browser, item)].flat()
					: Items.buttons[button] || button })
			// NOTE: keep the order unsurprising -- first defined, first from left...
			.reverse()
		var stopPropagation = function(evt){ evt.stopPropagation() }
		buttons
			.forEach(function([html, handler, ...rest]){
				var force = (rest[0] === true 
						|| rest[0] === false 
						|| rest[0] instanceof Function) ? 
					rest.shift() 
					: undefined
				var metadata = rest.shift() || {}

				// metadata...
				var cls = metadata.cls || []
				cls = cls instanceof Function ?
					cls.call(browser, item)
					: cls
				cls = cls instanceof Array ? 
					cls 
					: cls.split(/\s+/g)
				var alt = metadata.alt
				alt = alt instanceof Function ?
						alt.call(browser, item)
					: alt
				var keys = metadata.keys

				var button = document.createElement('div')
				button.classList.add('button', ...cls)
				alt
					&& button.setAttribute('alt', alt)

				// button content...
				var text_keys = []
				var v = resolveValue(html, Items.buttons, {item})
				setDOMValue(button,
					typeof(v) == typeof('str') ?
						doTextKeys(v,
							function(k){
								k = browser.keyboard.normalizeKey(k)
								return options.disableButtonSortcuts ?
									false
									: !text_keys.includes(k)
										&& text_keys.push(k) })
						: v)
				keys = text_keys.length > 0 ?
					(keys || []).concat(text_keys)
					: keys

				// non-disabled button...
				if(force instanceof Function ? 
						force.call(browser, item) 
						: (force || !item.disabled) ){
					button.setAttribute('tabindex', '0')
					// events to keep in buttons...
					;(options.buttonLocalEvents || options.itemLocalEvents || [])
						.forEach(function(evt){
							button.addEventListener(evt, stopPropagation) })
					// button keys...
					keys && !options.disableButtonSortcuts
						&& (keys instanceof Array ? keys : [keys])
							.forEach(function(key){
								// XXX should we break or warn???
								if(key in button_keys){
									throw new Error(`.elem(..): button key already used: ${key}`) }
								button_keys[keyboard.joinKey(keyboard.normalizeKey(key))] = button })
					// keep focus on the item containing the button -- i.e. if
					// we tab out of the item focus the item we get to...
					button.addEventListener('focus', function(){
						item.focused 
							// only focus items in the main section, 
							// outside of headers and footers...
							|| browser.focus(item) 
								&& button.focus() })
					// main button action (click/enter)...
					// XXX should there be a secondary action (i.e. shift-enter)???
					if(handler){
						var func = handler instanceof Function ?
							handler
							// string handler -> browser.<handler>(item)
							: function(evt, ...args){
								var a = browser.parseStringHandler(
									handler, 
									// button handler arg namespace...
									{
										event: evt,
										item: item,
										// NOTE: if we are not focusing 
										// 		on button click this may 
										// 		be different from item...
										focused: browser.focused,
										button: html,
									})
								browser[a.action](...a.arguments) }

						// handle clicks and keyboard...
						button.addEventListener('click', func.bind(browser))
						// NOTE: we only trigger buttons on Enter and do 
						// 		not care about other keys...
						button.addEventListener('keydown', 
							function(evt){
								var k = keyboard.event2key(evt)
								if(k.includes('Enter')){
									event.stopPropagation()
									func.call(browser, evt, item) } }) } 
				}

				elem.appendChild(button)
			})

		// button shortcut keys...
		Object.keys(button_keys).length > 0
			&& elem.addEventListener('keydown', 
				function(evt){ 
				var k = keyboard.joinKey(keyboard.event2key(evt))
				if(k in button_keys){
					evt.preventDefault()
					evt.stopPropagation()
					button_keys[k].focus()
					// XXX should this be optional???
					button_keys[k].click() } })
		
		/*/ XXX for some reason this messes up navigation...
		// 		to reproduce:
		// 			- select element with children
		// 			- press right
		// 				-> blur current elem
		// 				-> next elem not selected...
		item.elem = elem
		/*/
		item.dom = elem
		//*/

		return elem 
	},

	//
	// Format:
	// 	<div class="group">
	// 		<!-- elements -->
	// 		...
	// 	</div>
	//
	inline: function(item, lst, index, path, options){
		if(lst.length == 0){
			return lst }
		var e = document.createElement('div')
		e.classList.add('group')
		lst
			// XXX is this wrong???
			.flat(Infinity)
			.forEach(function(item){
				e.appendChild(item) })
		return e },

	//
	// Format:
	// 	<div class="list">
	// 		<!-- header element -->
	// 		...
	//
	// 		<!-- elements -->
	// 		...
	// 	</div>
	//
	// XXX add support for headless nested blocks...
	// XXX HACK -- see inside...
	nest: function(header, lst, index, path, options){
		var that = this

		// temporarily "detach" the item from DOM...
		// NOTE: this will prevent us from overwriting the list dom with
		// 		the element by keeping the changes to .dom / .elem local 
		// 		to the actual element (not affecting the DOM)...
		// XXX should we do a stricter detach-change-attach approach to
		// 		DOM updates???
		// XXX HACK: see notes for .elem assignment below and in renderer.elem(..)
		var old = header && header.dom
		if(old){
			delete header.__dom }

		// container...
		var e = document.createElement('div')
		e.classList.add('list')

		// localize events...
		var stopPropagation = function(evt){ evt.stopPropagation() }
		;(options.itemLocalEvents || [])
			.forEach(function(evt){
				e.addEventListener(evt, stopPropagation) })

		// header...
		// XXX this will break dom... 
		// 		- hedaer just updated it's .dom in-tree, i.e. replacing 
		// 			the list block...
		// 			...this effectively deletes the old dom (i.e. list block)
		// 			...writing to .elem should solve this stage of the issue 
		// 			but it introduces new problems (detaching element's dom)
		// 		- here we place it into a detached list element, completely 
		// 			severing the connection of header to dom...
		// XXX we need assigning to items's .elem to work correctly...
		e.appendChild(header ?
			this.headerElem(header, index, path, options)
			// XXX do we need to decorate this better???
			: document.createElement('div'))

		// items...
		lst instanceof Node ?
			e.appendChild(lst)
		: lst instanceof Array ?
			lst
				.forEach(function(item){
					e.appendChild(item) })
		: null

		// reattach the item to DOM...
		// XXX HACK: see notes for .elem assignment below and in renderer.elem(..)
		old 
			&& (header.__dom = old)
		header
			&& (header.dom = e)

		return e
	},

	// life-cycle...
	//
	finalize: function(sections, options){
		var dialog = this.root

		var d = this.dialog(sections, options)

		// wrap the list (nested list) of nodes in a div...
		if(d instanceof Array){
			var c = document.createElement('div')
			d.classList.add('focusable')
			d.forEach(function(e){
				c.appendChild(e) })
			d = c
		}
		d.setAttribute('tabindex', '0')

		// Setup basic event handlers...
		// keyboard...
		// NOTE: we are not doing: 
		// 			d.addEventListener('keydown', this.keyPress.bind(this))
		// 		because we are abstracting the user from DOM events and 
		// 		directly passing them parsed keys...
		d.addEventListener('keydown', function(evt){
			dialog.keyPress(dialog.keyboard.event2key(evt)) })
		// focus...
		d.addEventListener('click', 
			function(e){ 
				e.stopPropagation()
				d.focus() })
		/* XXX this messes up the scrollbar...
		d.addEventListener('focus',
		   function(){
			   dialog.focused
					&& dialog.focused.elem.focus() })
		//*/
		

		// XXX should this be done here or in .render(..)???
		dialog.dom = d

		// set the scroll offset...
		if(this.scroll_offset){
			var ref = dialog.focused || dialog.pagetop
			var scrolled = ref.dom.offsetParent 
			//scrolled.scrollTop = 
			//	ref.elem.offsetTop - scrolled.scrollTop - this.scroll_offset
			scrolled
				&& (scrolled.scrollTop = 
					ref.elem.offsetTop - scrolled.scrollTop - this.scroll_offset)
		}

		// keep focus where it is...
		var focused = dialog.focused
		focused
			&& focused.elem
				// XXX this will trigger the focus event...
				// 		...can we do this without triggering new events???
				.focus()

		return dialog.dom
	},
	// XXX is this needed with partial render???
	__init__: function(root, options){
		var render = object.parentCall(HTMLRenderer.prototype.__init__, this, root, options)

		var browser = this.root

		// prepare for maintaining the scroll position...
		// XXX need to do this pre any .render*(..) call...
		// 		...something like:
		// 			this.getRenderContext(render)
		// 		should do the trick...
		// 		another way to go might be a render object, but that seems to be 
		// 		complicating things...
		var ref = this.scroll_reference = 
			this.scroll_reference 
				|| browser.focused 
				|| browser.pagetop
		this.scroll_offset = 
			this.scroll_offset
			|| ((ref && ref.dom && ref.dom.offsetTop) ?
				ref.dom.offsetTop - ref.dom.offsetParent.scrollTop
				: null)

		//this.scroll_offset && console.log('renderContext:', this.scroll_offset)

		return render 
	},
})


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
// HTML Browser...

var HTMLBrowserClassPrototype = {}

// XXX render of nested lists does not affect the parent list(s)...
// 		...need to render lists and items both as a whole or independently...
// XXX need a strategy to update the DOM -- i.e. add/remove nodes for 
// 		partial rendering instead of full DOM replacement...
var HTMLBrowserPrototype = {
	__item__: HTMLItem,
	__renderer__: HTMLRenderer,

	options: {
		__proto__: BaseBrowser.prototype.options,

		// Default header/footer generators...
		//
		// These are the Item.<generator> to use when the user does not
		// manually set a header/footer.
		//
		// If set to null, no corresponding header/footer will be created 
		// automatically.
		//
		// NOTE: changing these on the fly would require both clearing 
		// 		the cache and an update, i.e.:
		// 			dialog.options.defaultFooter = 'DisplayItemInfo'
		// 			dialog
		// 				.clearCache()
		// 				.update(true)
		defaultHeader: 'DisplayFocusedPath',
		//defaultFooter: 'DisplayItemInfo',
	
		// If true hide header/footer...
		//
		// NOTE: these will prevent rendering of the corresponding 
		// 		header/footer but their data will still be made and 
		// 		potentially updated...
		hideListHeader: false,
		hideListFooter: false,

		// If true render hidden elements...
		//
		renderHidden: false,

		// Sets the distance between the focused element and top/bottom
		// border while moving through elements...
		//
		// XXX can we make this relative???
		// 		...i.e. about half of the average element height...
		focusOffsetWhileScrolling: 18,

		// for more docs see:
		//	https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView
		//
		// XXX 'smooth' value yields odd results...
		//scrollBehavior: 'auto',


		itemTemplate: {
			__proto__: (BaseBrowser.prototype.options || {}).itemTemplate || {},

			'   ': {
				'class': 'separator',
				'html': '<div/>',
				noniterable: true,
			},
			'---': {
				'class': 'separator',
				'html': '<hr>',
				noniterable: true,
			},
			'...': {
				'class': 'separator',
				'html': '<center><div class="loader"/></center>',
				noniterable: true,
			},
		},


		// Item options/attributes that get processed directly if given
		// at item root and not just via the respective sections...
		//
		shorthandItemClasses: [
			'focused',
			'selected',
			'disabled',
			'hidden',
		],
		shorthandItemAttrs: [
			'doc',
			'alt',
		],
		shorthandItemEvents: [],


		// events not to bubble up the tree...
		//
		itemLocalEvents: [
			'click',
		],
		//buttonLocalEvents: [],


		// Default buttons for header/items/footer sections...
		//
		// Format:
		// 	[
		// 		// basic button handler...
		// 		['html', 
		// 			<handler>],
		//
		// 		// full button handler...
		// 		//
		// 		//	<arg> can be:
		// 		//		- item			- item containing the button
		// 		//		- focused		- currently focused item
		// 		//							NOTE: if we are not focusing 
		// 		//								on button click this may 
		// 		//								be different from item...
		// 		//		- event			- event object
		// 		//		- button		- text on button
		// 		//		- number/string/list/object
		// 		//						- any values...
		// 		//
		// 		//	<force>	(optional, bool or function), of true the button will 
		// 		//	be active while the item is disabled...
		// 		//
		// 		// NOTE: for more doc see keyboard.Keyboard.parseStringHandler(..)
		// 		[
		// 			// button view...
		// 			'text or html' 
		// 				| '<button-generator>: <arg> .. -- comment' 
		// 				| <function>
		// 				| <HTMLElement>, 
		//
		// 			// button action...
		// 			'<action>: <arg> .. -- comment' 
		// 				| <function>,
		//
		// 			// force active on disabled items (optional)...
		// 			bool 
		// 				| <function>,
		//
		// 			// button metadata (optional)...
		// 			{
		// 				cls: <css-class>,
		// 				alt: <string>,
		// 				keys: <key> | [ <key>, ... ],
		// 				...
		// 			},
		// 		],
		//
		// 		...
		// 	]
		//
		headerButtons: [],
		itemButtons: [],
		footerButtons: [],

		// Default buttons for Item.Heading(..)
		//
		// NOTE: the use of this is implemented in Items.Heading(..) see
		// 		it for more info...
		headingButtons: [
			'ToggleCollapse',
		],


		// If true will disable button shortcut key handling...
		//disableButtonSortcuts: false,

		// debug and testing options...
		//keyboardReportUnhandled: false,
	},


	// Keyboard...
	//
	// XXX these should get the root handler if not defined explicitly...
	__keyboard_config: Object.assign({}, KEYBOARD_CONFIG),
	get keybindings(){
		return this.__keyboard_config },
	__keyboard_object: null,
	get keyboard(){
		var that = this
		// XXX should this be here on in start event???
		var kb = this.__keyboard_object = 
			(this.hasOwnProperty('__keyboard_object') 
					&& this.__keyboard_object)
				|| keyboard.KeyboardWithCSSModes(
					function(data){ 
						if(data){
							that.__keyboard_config = data
						} else {
							return that.__keyboard_config
						}
					},
					function(){ return that.dom })
		return kb },
	// NOTE: this is not designed for direct use...
	____keyboard_handler: null,
	get __keyboard_handler(){
		var options = this.options || {}
		return (this.____keyboard_handler = 
			(this.hasOwnProperty('____keyboard_handler') 
					&& this.____keyboard_handler)
				|| keyboard.makePausableKeyboardHandler(
					this.keyboard,
					function(){ 
						options.keyboardReportUnhandled
							&& console.log('UNHANDLED KEY:', ...arguments) }, 
					this)) },
	
	// Proxy to .keyboard.parseStringHandler(..)
	parseStringHandler: function(code, context){
		return this.keyboard.parseStringHandler(code, context || this) },


	// Props..
	//
	// XXX the problem with nested browser elements .update(..) not 
	// 		updating unless called with correct context is that .dom / .container
	// 		are not maintained in children...
	// 		...if done correctly this should fix the issue automatically...
	// XXX might be a good idea to make dom support arrays of items...
	//
	// parent element (optional)...
	// XXX rename???
	// 		... should this be .containerDom or .parentDom???
	// XXX do we use .hasOwnProperty(..) here???
	get container(){
		return this.__container 
			|| (this.__dom ? 
				this.__dom.parentElement 
				: undefined) },
	set container(value){
		var dom = this.dom
		this.__container = value
		// transfer the dom to the new parent...
		dom 
			&& (this.dom = dom) },

	// browser dom...
	get dom(){
		return this.__dom },
	set dom(value){
		this.container 
			&& (this.__dom ?
				this.dom.replaceWith(value) 
				: this.container.appendChild(value))
		this.__dom = value },

	// page-relative items...
	get pagetop(){
		return this.get('pagetop') },
	set pagetop(item){
		this.scrollTo(item, 'start') },
	get pagebottom(){
		return this.get('pagebottom') },
	set pagebottom(item){
		this.scrollTo(item, 'end') },


	// Extending query...
	//	
	// Extended .search(..) to support:
	// 	- 'pagetop'
	// 	- 'pagebottom'
	// 	- searching for items via DOM / jQuery objects
	// 		XXX currently direct match only...
	// 			...should we add containment search -- match closest item containing obj...
	// 
	//	.search('pagetop'[, offset] ..)
	//	.search('pagebottom'[, offset] ..)
	//
	// XXX add support for pixel offset???
	search: function(pattern){
		var args = [...arguments].slice(1)
		var p = pattern

		// XXX skip detached elements...
		var getAtPagePosition = function(pos, offset){
			if(!this.dom){
				return []
			}
			pos = pos || 'top'
			var lst = this.dom.querySelector('.list.items')
			offset = lst.offsetHeight * (offset || 0)
			var st = lst.scrollTop
			var H = pos == 'bottom' ? 
				lst.offsetHeight 
				: 0
			return this.search(true,
					function(e, i, p, stop){
						var edom = e.elem
						// first below upper border...
						pos == 'top' 
							&& Math.round(edom.offsetTop 
								- Math.max(0, st - offset)) >= 0
							&& stop(e)
						// last above lower border...
						pos == 'bottom'
							&& Math.round(edom.offsetTop + edom.offsetHeight)
								- Math.max(0, st + H + offset) <= 0
							&& stop(e) },
					{ 
						rawResults: true,
						reverse: pos == 'bottom' ? 
							'full'
							: false,
						skipDisabled: !(this.options || {}).focusDisabledItems, 
					}) }.bind(this)

		pattern = arguments[0] = 
			// DOM element...
			pattern instanceof HTMLElement ?
				function(e){ return e.dom === p || e.elem === p }
			// jQuery object...
			: (typeof(jQuery) != 'undefined' && pattern instanceof jQuery) ?
				function(e){ return p.is(e.dom) || p.is(e.elem) }
			// pagetop + offset...
			: pattern == 'pagetop' ?
				getAtPagePosition('top', 
					// page offset...
					typeof(args[0]) == typeof(123) ? args.shift() : 0)
			// pagebottom + offset...
			: pattern == 'pagebottom' ?
				getAtPagePosition('bottom', 
					// page offset...
					typeof(args[0]) == typeof(123) ? args.shift() : 0)
			// other...
			: pattern

		// call parent...
		return object.parentCall(HTMLBrowserPrototype.search, this, pattern, ...args) },
	//
	// Extended .get(..) to support:
	// 	- 'pagetop'/'pagebottom' + offset...
	//
	//	.get('pagetop'[, offset] ..)
	//	.get('pagebottom'[, offset] ..)
	//
	// NOTE: this short-circuits .get(..) directly to .search(..) when 
	// 		passed 'pagetop'/'pagebottom' + offset, this may become an 
	// 		issue if .get(..) starts doing something extra, currently 
	// 		this is a non-issue...
	get: function(pattern){
		var args = [...arguments].slice(1)
		var offset = typeof(args[0]) == typeof(123) ?
			args.shift()
			: false
		var func = args[0] instanceof Function ?
			args.shift()
			: null
		return (pattern == 'pagetop' || pattern == 'pagebottom') && offset ?
			// special case: pagetop/pagebottom + offset -> do search...
			this.search(pattern, offset, 
				function(e, i, p, stop){
					stop(func ? 
						func.call(this, e, i, p)
						: e) }, ...args)
			: object.parentCall(HTMLBrowserPrototype.get, this, pattern, func, ...args) },


	// Copy/Paste support...
	//
	// The paste code is essentially a hack to work around access issues 
	// in different browser engines.
	//
	// NOTE: not for direct use...
	// NOTE: both of these feel hackish...
	__paste: function(callback){
		var focus = this.dom.querySelector(':focus') || this.dom

		var text = document.createElement('textarea')
		text.style.position = 'absolute'
		text.style.opacity = '0'
		text.style.width = '10px'
		text.style.height = '10px'
		text.style.left = '-1000px'
		this.dom.appendChild(text)
		text.focus()
		
		setTimeout(function(){
			var str = text.value
			text.remove()

			// restore focus...
			focus
				&& focus.focus()

			callback ?
				callback(str)
				: this.load(str) 
		}.bind(this), 5)
	},
	// NOTE: FF does not support permission querying so we are not asking,
	// 		yes this may result in things breaking, but all the shards 
	// 		should be contained within the handler...
	__copy: function(text){
		navigator.clipboard.writeText(text || this.path) },


	// Events extensions...
	//
	// XXX should tweaking DOM be done here or in the renderer???
	__update__: function(){
		var c = 0
		this.forEach(function(e){
			// shortcut number hint...
			if(c < 10 && !e.disabled && !e.hidden){
				var a = e.attrs = e.attrs || {}
				e.elem 
					&& e.elem.setAttribute('shortcut-number', 
						a['shortcut-number'] = (c+1) % 10)
			// cleanup...
			} else {
				delete (e.attrs || {})['shortcut-number']
				e.elem 
					&& e.elem.removeAttribute('shortcut-number')
			}
			c++
		}) },
	// NOTE: this will also kill any user-set keys for disabled/hidden items...
	// XXX also handle global button keys...
	__preRender__: function(evt, options, renderer, context){
		var that = this

		// reset item shortcuts...
		var shortcuts = 
			this.keybindings.ItemShortcuts = 
				Object.assign({}, KEYBOARD_CONFIG.ItemShortcuts)

		var i = 0
		this.map(function(e){
			// handle item keys...
			if(!e.disabled && !e.hidden){
				;((e.value instanceof Array ? 
						e.value 
						: [e.value])
					.join(' ')
					// XXX this does not include non-English chars...
					.match(/\$\w/g) || [])
						.map(function(k){
							k = that.keyboard.normalizeKey(k[1])

							if(!shortcuts[k]){
								shortcuts[k] = function(){ 
									// XXX should this focus or open???
									that
										.focus(e) 
										.open(e) } 

								var keys = e.keys = e.keys || []
								keys.includes(k)
									|| keys.push(k)

							// cleanup...
							} else {
								var keys = e.keys || []
								keys.splice(keys.indexOf(k), 1)
							} })

			// cleanup...
			} else {
				delete e.keys
			}
		}, {skipDisabled: false}) },
	// NOTE: element alignment is done via the browser focus mechanics...
	__focus__: function(evt, elem){
		var that = this
		elem
			&& elem.elem
				// update the focused CSS class...
				// NOTE: we will not remove this class on blur as it keeps
				// 		the selected element indicated...
				.run(function(){
					this.classList.add('focused') 
					// take care of visibility...
					this.scrollIntoView({
						behavior: (that.options || {}).scrollBehavior || 'auto',
						block: 'nearest',
					})
				})
				// XXX do we need this???
				.focus() },
	__blur__: function(evt, elem){
		var that = this
		elem
			&& elem.elem
				.run(function(){
					this.classList.remove('focused')
					// refocus the dialog...
					that.dom
						&& that.dom.focus() }) },
	__open__: function(evt, elem){ this.focus(elem) },
	// XXX when expanding an element at the bottom of the screen (i.e. 
	// 		when the expanded tree is not visible) need to nudge the 
	// 		element up to reveal the expanded subtree...
	// 		...would also be logical to "show" the expanded tree but 
	// 		keeping the focused elem in view...
	__expand__: function(evt, elem){ 
		elem.update() 
		this.update('partial') },
	__collapse__: function(evt, elem){
		elem.update() 
		this.update('partial') },
	__select__: updateElemClass('add', 'selected'),
	__deselect__: updateElemClass('remove', 'selected'),
	__disable__: updateElemClass('add', 'disabled', 
		function(evt, elem){
			elem.update() 
			this.update('partial') }),
	__enable__: updateElemClass('remove', 'disabled', 
		function(evt, elem){
			elem.update() 
			this.update('partial') }),
	__hide__: updateElemClass('add', 'hidden'),
	__show__: updateElemClass('remove', 'hidden'),


	// Custom events...
	//
	// NOTE: this is not directly connected to DOM key events...
	keyPress: makeEventMethod('keypress', 
		function(evt, key){
			this.__keyboard_handler(key) }),
	// XXX do we need a default behavior here???
	// 		...something like .expand(..)
	menu: makeItemEventMethod('menu'),


	// Scroll...
	//
	// position can be:
	// 	'start'
	// 	'center'
	// 	'end'
	//
	// XXX use .options.focusOffsetWhileScrolling / nudgeElement(..)
	// 		...only need to determine direction...
	// 			'start' -> nudgeElement(this, 'up', elem)
	// 			'end' -> nudgeElement(this, 'down', elem)
	scrollTo: function(pattern, position){
		var target = this.get(pattern)
		target 
			&& target.elem
				.scrollIntoView({
					behavior: (this.options || {}).scrollBehavior || 'auto',
					block: position || 'center',
				}) },


	// Navigation...
	//
	// hold key repeat on first/last elements + reveal disabled items at
	// start/end of list...
	prev: focusItem('up'),
	next: focusItem('down'), 
	pageUp: focusPage('up'),
	pageDown: focusPage('down'),

	// XXX focus element above/below...
	up: function(){},
	down: function(){},
	// XXX check if there are elements to the left...
	left: function(){
		var focused = this.focused
		var p
		if(!focused){
			return this.prev() }
		// collapsable -> collapse...
		;(focused.children && !focused.collapsed) ?
			this.collapse()
		// on a nested level -> go up one level... 
		: (p = this.parentOf()) && p !== this ?
			this.focus(p)
		// top-level -> prev on top-level...
		: this.focus(this.get('prev', {skipNested: true}))
	},
	// XXX check if there are elements to the right...
	right: function(){
		var focused = this.focused
		if(!focused){
			return this.next() }
		focused.collapsed ?
			this
				.expand()
			: this.next() },


	// Filtering/search mode...
	// XXX
}


// XXX should this be a Widget too???
var HTMLBrowser = 
module.HTMLBrowser = 
object.Constructor('HTMLBrowser', 
	BaseBrowser,
	HTMLBrowserClassPrototype, 
	HTMLBrowserPrototype)



//---------------------------------------------------------------------
// shorthands/defaults...

module.Item = HTMLItem
module.Browser = HTMLBrowser




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
