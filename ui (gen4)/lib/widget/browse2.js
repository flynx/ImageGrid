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
var walk = require('lib/walk').walk



/*********************************************************************/
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
// XXX general design:
// 		- each of these can take either a value or a function (constructor)
//		- the function has access to Items.* and context
//		- the constructor can be called from two contexts:
//			- external
//				called from the module or as a function...
//				calls the passed constructor (passing context)
//				builds the container
//			- nested
//				called from constructor function...
//				calls constructor (if applicable)
//				builds item(s)
// XXX need a way to pass container constructors (a-la ui-widgets dialog containers)
// 		- passing through the context (this) makes this more flexible...
// 		- passing via args fixes the signature which is a good thing...
//		
//

// XXX
// XXX can't use Object.assign(..) here as it will not copy props...
var Items = module.items = function(){}


// placeholders...
Items.dialog = null
Items.items = null


// Last item created...
// XXX not sure about this...
// XXX should this be a prop???
Items.last = function(){
	return (this.items || [])[this.items.length - 1] }


// Focus last created item...
Items.focus = function(){
	this.last().current = true }




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
// XXX do we need to pass options to groups???
Items.group = function(...items){
	var that = this
	items = items.length == 1 && items[0] instanceof Array ?
		items[0]
		: items
	// replace the items with the group...
	this.items.splice(this.items.length, 0, collectItems(this, items))
	return this
}


// Place list in a sub-list of item...
//
Items.nest = function(item, list, options){
	options = options || {}
	//options = Object.assign(Object.create(this.options || {}), options || {})
	options = Object.assign({},
		{ children: list instanceof Array ?
			collectItems(this, list)
			: list },
		options)
	return this(item, options)
}



//---------------------------------------------------------------------
// Buttons...
var buttons = Items.buttons = {}

//
// 	Draw checked checkboz is <attr> is true...
// 	Checkbox('attr')
//
// 	Draw checked checkboz is <attr> is false...
// 	Checkbox('!attr')
//
// XXX rename -- distinguish from actual button...
buttons.Checkbox = function(item, attr){
	return (attr[0] == '!' 
				&& !item[attr.slice(1)]) 
			|| item[attr] ? 
		'&#9744;' 
		: '&#9745;' } 


// XXX can we make these not use the same icon...
buttons.ToggleDisabled = [
	'Checkbox: "disabled"',
	'toggleDisabled: item',
	true,
	{
		alt: 'Disable/enable item',
		cls: 'toggle-disabled',
	}]
buttons.ToggleHidden = [
	'Checkbox: "hidden"',
	'toggleHidden: item',
	{
		alt: 'Show/hide item',
		cls: 'toggle-hidden',
	}]
buttons.ToggleSelected = [
	'Checkbox: "selected"',
	'toggleSelect: item',
	{
		alt: 'Select/deselect item',
		cls: 'toggle-select',
	}]
// NOTE: this button is disabled for all items but the ones with .children...
buttons.ToggleCollapse = [
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
	}]

// XXX delete button -- requires .markDelete(..) action...
buttons.Delete = [
	'&times;',
	'markDelete: item',
	{
		alt: 'Mark item for deletion',
		cls: 'toggle-delete',
		//keys: ['Delete', 'd'],
	}]



//---------------------------------------------------------------------
// wrappers...

// this is here for uniformity...
Items.Item = function(value, options){ return this(...arguments) }

Items.Separator = function(){ return this('---') }
Items.Spinner = function(){ return this('...') }
Items.Heading = function(value, options){}
Items.Empty = function(value){}
Items.Selected = function(value){}
Items.Action = function(value, options){}
Items.ConfirmAction = function(value){}
Items.Editable = function(value){}

// lists...
Items.List = function(values){}
Items.EditableList = function(values){}
Items.EditablePinnedList = function(values){}

// Special list components...
//Items.ListPath = function(){}
//Items.ListTitle = function(){}



//---------------------------------------------------------------------
// Item...

var BaseItemClassPrototype = {
	text: function(elem){
		var txt = elem.value instanceof Array ?
				elem.value.join(' ')	
			: elem.value == null || elem.value instanceof Object ?
				elem.alt || elem.__id 
			: elem.value
		return txt },
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
	
	get id(){
		return this.__id || this.text },
	set id(value){
		this.__id = value },

	get text(){
		return this.constructor.text(this) },

	__init__(...state){
		Object.assign(this, ...state) },
}

var BaseItem = 
module.BaseItem = 
object.makeConstructor('BaseItem', 
	BaseItemClassPrototype,
	BaseItemPrototype)



//---------------------------------------------------------------------
// Event system parts and helpers...
//
// XXX might be a good idea to make this a generic module...

// Base event object...
//
var BrowserEvent =
module.BrowserEvent = 
object.makeConstructor('BrowserEvent', 
{
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
			items.filter(filter) 
			: items }
	options = Object.assign(
		{ 
			// NOTE: we need to be able to pass item objects, so we can not
			// 		use queries at the same time as there is not way to 
			// 		distinguish one from the other...
			noQueryCheck: true, 
			skipDisabled: true,
		},
		options)
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
	return Object.assign(
		// the actual method we return...
		function(item, ...args){
			var that = this
			return base.call(this, 
				// event handler...
				item instanceof Function ?
					item
				// array of queries...
				: item instanceof Array ?
					filterItems(item
						.map(function(e){
							return that.search(e, options) })
						.flat()
						.unique())
				// explicit item or query...
				: item != null ? 
					filterItems(this[getter](item, options))
				// item is undefined -- get default...
				: item !== null && default_item instanceof Function ?
					[default_item.call(that) || []].flat()
				// item is null (explicitly) or other...
				: [],
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
			items.filter(filter) 
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
					filterItems(
						[this[getter](item, options)]
							.flat())
							.map(_get_state)
				: state === true ?
					_set_state.call(this, item)
				: state == false ? 
					_unset_state.call(this, item)
				// 'next' or '!'...
				// NOTE: 'next' and '!' are opposites of each other...
				: filterItems(
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
// XXX this is incomplete...
var makeItemEventToggler2 = function(get_state, set_state, unset_state, default_item, multi){
	var _get_state = get_state instanceof Function ?
		get_state
		: function(e){ return !!e[get_state] }
	var _set_state = set_state instanceof Function ?
		set_state
		: function(e){ return !!this[set_state](e) }
	var _unset_state = unset_state instanceof Function ?
		unset_state
		: function(e){ return !this[unset_state](e) }
	multi = multi !== false
	var getter = multi ? 'search' : 'get'

	return toggler.Toggler(
		default_item,
		function(item, state){
			if(item == null){
				return false
			}
			return state == null ?
				_get_state(item)
				: state
		},
		[true, false],
		function(state, item){
			// if no item focused/given return false...
			return item == null ? 
					false 
				// XXX add support for item lists...
				: state ?
	   				_set_state.call(this, item)
				: _unset_state.call(this, item) })
}



// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var BaseBrowserClassPrototype = {
}

// XXX Q: should we be able to add/remove/change items outside of .__list__(..)???
// 		...only some item updates (how .collapsed is handled) make 
// 		sense at this time -- need to think about this more 
// 		carefully + strictly document the result...
// XXX can/should we make traversal simpler???
// 		...currently to get to a nested item we'd need to:
// 			dialog.flatIndex.B.children.index.C. ...
// 		on the other hand we can .get('B/C/...')
var BaseBrowserPrototype = {
	// XXX should we mix item/list options or separate them into sub-objects???
	options: {
		// If true item keys must be unique...
		uniqueKeys: false,

		//skipDisabledMode: 'node',

		updateTimeout: 30,
	},


	// Props and introspection...

	// parent widget object...
	//
	// NOTE: this may or may not be a Browser object.
	parent: null,

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
	// 		...
	// 	}
	//
	// NOTE: this can't be a map/dict as we need both order manipulation 
	// 		and nested structures which would overcomplicate things, as 
	// 		a compromise we use .index below for item identification.
	__items: null,
	get items(){
		this.__items
			|| this.make()
		return this.__items },
	set items(value){
		this.__items = value },


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
	clearCache: function(title){
		if(title == null){
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
	__item_index_cache: null,
	get index(){
		return (this.__item_index_cache = 
			this.__item_index_cache 
				|| this
					.reduce(function(index, e, i, p){
						var id = p = p.join('/')
						var c = 0
						// generate a unique id...
						// NOTE: no need to check if e.id is unique as we already 
						// 		did this in make(..)...
						while(id in index){
							id = this.__id__(p, ++c)
						}
						index[id] = e
						return index
					}.bind(this), {}, {iterateAll: true})) },

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
			}.bind(this), {}, {iterateAll: true}) },

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
		return this.__items != null ?
			this.get('focused', 
				function(e, i, p){ return p.join('/') }) 
			// XXX do we use .options.path???
			: (this.options || {}).path },
	set path(value){
		this.load(value) },


	// Length...
	//
	// visible only...
	get length(){
		return this.map().length },
	// include collapsed elements...
	get lengthTree(){
		return this.map({iterateCollapsed: true}).length },
	// include non-iterable elements...
	get lengthAll(){
		return this.map({iterateAll: true}).length },


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
			`${prefix}:${count || Date.now()}`
			// plain id...
			: `item${Date.now()}` },


	// Data generation (make)...
	
	// Item list constructor...
	//
	// 	.__list__(make, options)
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
	// 	- options passed to .make(<options>) method calling .__list__(..),
	// 	- options passed to make(.., <options>) constructing the item,
	// 	- {value: <value>} where <value> passed to make(<value>, ..)
	//
	// Each of the above will override values of the previous sections.
	//
	// The resulting item is stored in:
	// 	.items
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
	__list__: function(make, options){
		throw new Error('.__list__(..): Not implemented.') },

	__item__: BaseItem,

	// Make extension...
	//
	// This is called per item created by make(..) in .__list__(..)
	//
	// NOTE: this can update/modify the item but it can not replace it.
	//__make__: function(item){
	//},


	// Make .items and .index...
	//
	// 	.make()
	// 	.make(options)
	// 		-> this
	//
	// The items are constructed by passing a make function to .__list__(..)
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
	// XXX revise options handling for .__list__(..)
	// XXX might be a good idea to enable the user to merge the state 
	// 		manually...
	// 		one way to do:
	// 			- get the previous item via an index, 
	// 			- update it
	// 			- pass it to make(..)
	// 		Example:
	// 			// just a rough example in .__list__(..)...
	// 			make(value, 
	// 				value in this.index ? 
	// 					Object.assign(
	// 						this.index[value], 
	// 						opts) 
	// 					: opts)
	make: function(options){
		var that = this
		options = Object.assign(
			Object.create(this.options || {}), 
			options || {})

		var items = this.items = []

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
		var keys = options.uniqueKeys ? 
			new Set() 
			: null
		var ids = new Set()
		var make_called = false
		var make = function(value, opts){
			make_called = true

			// special-case: inlined browser...
			//
			// NOTE: we ignore opts here...
			// XXX not sure if this is the right way to go...
			// 		...for removal just remove the if statement and its
			// 		first branch...
			if(value instanceof BaseBrowser){
				var item = value
				item.parent = this

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
				var key = this.__key__(opts)

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
				var item = new this.__item__(
					// XXX do we need this???
					//options || {}, 
					opts,
					{ parent: this })

				// XXX do we need both this and the above ref???
				item.children instanceof BaseBrowser
					&& (item.children.parent = this)
			}

			// user extended make...
			this.__make__
				&& this.__make__(item)

			// store the item...
			items.push(item)
			ids.add(key)

			return make
		}.bind(this)
		make.__proto__ = Items
		make.dialog = this
		make.items = items

		//var res = this.__list__(make)
		// XXX not sure about this -- revise options handling...
		var res = this.__list__(make, 
			options ? 
				Object.assign(
					Object.create(this.options || {}), 
					options || {}) 
				: null)
		// if make was not called use the .__list__(..) return value...
		this.items = make_called ? 
			this.items 
			: res

		// reset the index/cache...
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
						e) })

		return this
	},


	// Data access and iteration...

	// Walk the browser...
	//
	//	Get list of nodes in tree...
	//	.walk()
	//		-> list
	//
	//	Walk the tree passing each node to func(..)
	//	.walk(func(..)[, options])
	//		-> list
	//
	//	Walk tree passing each node to func(..) using method name to 
	//	walk nested browsers...
	//	NOTE: 'walk' is used as name if name is not present in the object...
	//	.walk(func(..), name, args(..)[, options])
	//	.walk(func(..), name, args(..), walkable(..)[, options])
	//		-> list
	//
	//	Walk tree passign each node to func(..) and handle nested browser 
	//	walking in recursion(..) optionally testing if walkable with walkable(..)
	//	.walk(func(..), recursion(..)[, options])
	//		-> list
	//
	//
	//	Item handler...
	//	func(node, index, path, next(..), stop(..), children)
	//		-> list
	//
	//	Trigger next/nested item handling...
	//	next(children)
	//		-> list
	//
	//	Stop handling...
	//	stop(result)
	//
	//
	//	Handle walkable node children (recursively)...
	//	recursion(children, index, path, options, context, func(..), stop(..), walk())
	//		-> list
	//
	//
	//	Prepare arguments for call of name function on nested browser...
	//	args(list, index, path, options, context, func(..), stop(..))
	//		-> list
	//
	//
	//	Test if node is walkable...
	//	walkable(node)
	//		-> bool
	//
	//
	// For examples see: .text(..), .paths(..) and .map(..)
	//
	//
	// options format:
	// 	{
	// 		// Partial walking...
	// 		//
	// 		// XXX not implemented yet...
	// 		start: <index> | <path>,
	// 		count: <number>,
	// 		end: <index> | <path>,
	//
	//
	// 		// Iterate ALL items...
	// 		//
	// 		// NOTE: this if true overrides all other iteration coverage 
	// 		//		options... 
	// 		iterateAll: <bool>,
	//
	// 		// If true do not skip items with .noniterable set to true...
	// 		iterateNonIterable: <bool>,
	// 		// If true do not skip item.children of items with .collapsed 
	// 		// set to true...
	// 		iterateCollapsed: <bool>,
	// 		// If true skip iterating nested items...
	// 		skipNested: <bool>,
	//
	// 		// XXX not yet supported...
	// 		skipInlined: <bool>,
	//
	// 		skipDisabledMode: 'node' | 'branch',
	// 		skipDisabled: <bool> | 'node' | 'branch',
	//
	// 		// Reverse iteration order...
	//		//
	//		// modes:
	//		//	false | null		- normal order (default)
	//		//	true | 'tree'		- reverse order of levels but keep 
	//		//							topology order, i.e. containers
	//		//							will precede contained elements.
	//		//	'flat'				- full flat reverse
	//		//
	//		// NOTE: in 'flat' mode the client loses control over the 
	//		//		order of processing via doNested(..) as it will be 
	//		//		called before handleItem(..)
	// 		reverse: <bool> | 'flat' | 'tree',
	//
	// 		// The value to be used if .reverse is set to true...
	// 		defaultReverse: 'tree' (default) | 'flat',
	//
	//
	// 		// If true include inlined parent id in path...
	// 		// XXX not implemented yet -- can we implement this???...
	// 		// XXX do we need this??
	// 		inlinedPaths: <bool>,
	// 	}
	//
	//
	// NOTE: if recursion(..) is not given then .walk(..) is used to 
	// 		handle all the nested elements (children)...
	// NOTE: if walkable(..) is not given then we check for .walk(..)
	// 		availability...
	// NOTE: children arrays are handled internally...
	//
	//
	// XXX BUG?: next(false) will not count any of the skipped elements
	// 		thus messing up the element index...
	// XXX which of the forms should be documented in the signature???
	// 		NOTE: it does not matter which is used as we manually
	// 		parse arguments...
	// XXX passing both index directly and context containing index 
	// 		(context.index) feels excessive...
	// 			+ this is done so as to provide the user a simpler 
	// 				.map(..)-like form...
	// 				Ex:
	// 					.walk((e, i, p, next, stop) => p.join('/'))
	// 					// vs.
	// 					.walk((e, c, next, stop) => c.path.join('/'))
	// 			- two ways to get index and one to update it...
	// 		...if this can produce errors we need to simplify...
	// XXX add options.skip(elem) function to test elements for skipping...
	// XXX add docs:
	// 		- maintaining context to implement/extend walkers...
	// 		- correctly stopping recursive calls (call root stop(..))
	// XXX can this be simpler???
	walk: function(func, recursion, walkable, options){
		var that = this

		// parse args...
		var args = [...arguments]
		func = (args[0] instanceof Function 
				|| args[0] == null) ? 
			args.shift() 
			: undefined
		var recursion = (args[0] instanceof Function 
				|| typeof(args[0]) == typeof('str')
				|| args[0] == null) ? 
			args.shift() 
			: undefined
		var formArgs = (typeof(recursion) == typeof('str')
				&& args[0] instanceof Function) ?
			args.shift()
			: null
		// sanity check...
		if(formArgs == null && typeof(recursion) == typeof('str')){
			throw new Error(`.walk(func, name, formArgs, ..): `
				+`expected function as third argument, got: ${formArgs}.`) }
		var walkable = (!formArgs 
				&& (args[0] instanceof Function 
					|| args[0] == null)) ?
			args.shift() 
			: null 
		options = Object.assign(
			Object.create(this.options || {}),
			args.shift() || {})

		// get/build context...
		var context = args.shift()
		context = context instanceof Array ? 
			{ path: context } 
			: (context || {})
		context.root = context.root || this
		context.index = context.index || 0

		// options specifics...
		var iterateNonIterable = options.iterateAll || options.iterateNonIterable
		var iterateCollapsed = options.iterateAll || options.iterateCollapsed
		var skipNested = !options.iterateAll && options.skipNested
		var skipInlined = !options.iterateAll && options.skipInlined

		var skipDisabled = !options.iterateAll && options.skipDisabled
		skipDisabled = skipDisabled === true ? 
			(options.skipDisabledMode || 'node')
			: skipDisabled

		var reverse = options.reverse === true ?
			(options.defaultReverse || 'tree')
			: options.reverse

		var isWalkable = walkable ?
			function(node){
				return node instanceof Array || walkable(node) }
			: function(node){
				return node 
					&& (node instanceof Array 
						// requested method name is available...
						|| (typeof(recursion) == typeof('str') 
							&& node[recursion])
						|| node.walk ) }

		return walk(
			function(state, node, next, stop){
				// keep only the root stop(..) -> stop the entire call tree...
				stop = context.stop = context.stop || stop

				// skip non-iterable items...
				if(!iterateNonIterable && node.noniterable){
					return state }
				// skip disabled branch...
				if(skipDisabled == 'branch' && node.disabled){
					return state }

				// XXX BUG?: doNested(false) will not count any of the 
				// 		skipped elements thus messing up i...
				// 		...we can't just use .length as this would 1)
				// 		introduce a branch in the protocol + would not
				// 		comply with the passed options in all cases but 
				// 		the default...
				// 		...one way to do this is to set func to a dud
				// 		the only problem we have is the next(..) call
				// 		below that will call the parent function and
				// 		mess things up... we can go around this via 
				// 		the context (context.skipping) but this feels 
				// 		hack-ish...
				var nested = false
				var doNested = function(list){
					// this can be called only once -> return cached results...
					if(nested !== false){
						return nested }
					// calling this on a node without .children is a no-op...
					if(children == null){
						return [] }

					// normalize...
					list = list === true ?
							children	
						: (!iterateCollapsed && node.collapsed) ?
							[]
						: list == null ?
							children
						: list

					// call .walk(..) recursively...
					var useWalk = function(){
						return list.walk(
							func, 
							recursion, 
							...(formArgs instanceof Function ? 
								[formArgs] 
								: [walkable]), 
							options, context) }

					return (
							// XXX BUG?: in this case we lose item indexing...
							list === false || list == 'skip' ?
								[]
							// handle arrays internally...
							: list instanceof Array ?
								// NOTE: this gets the path and i from context...
								next('do', [], 
									...(reverse ? 
										list.slice().reverse() 
										: list))
							// user-defined recursion...
							: recursion instanceof Function ?
								recursion.call(that, 
									list, context.index, p, 
									options, context, 
									func, useWalk)
							// method with arg forming...
							: formArgs instanceof Function 
									&& list[recursion] ?
								list[recursion](
									...(formArgs(
										list, context.index, p, 
										options, context, 
										func, useWalk) || []))
							// .walk(..)
							: useWalk())
						// normalize and merge to state...
						.run(function(){
							return (nested = this instanceof Array ?
								this
								: [this]) }) }

				// prepare context...
				var id = node.id
				var path = context.path = context.path || []
				var [inline, p, children] = 
					// inline...
					isWalkable(node) ?
						[true, path.slice(), node]
					// nested...
					: (!skipNested && isWalkable(node.children)) ?
						[false, 
							// update context for nested items...
							path.push(id) 
								&& path.slice(), 
							node.children]
					// leaf...
					: [false, path.concat([id]), undefined]

				if(inline && skipInlined){
					return state }

				// go through the elements...
				state.splice(state.length, 0,
					...[
						// reverse -> do children...
						reverse == 'flat' 
							&& children
							&& doNested() 
							|| [],
						// do element...
						!(skipDisabled && node.disabled) ?
							(func ? 
								(func.call(that, 
									...(inline ? 
										[null, context.index] 
										: [node, context.index++]),
									p, 
									// NOTE: when calling this it is the 
									// 		responsibility of the caller to return
									// 		the result to be added to state...
									doNested, 
									stop,
									children) || []) 
								: [node])
							// element is disabled -> handle children...
							: [],
						// normal order -> do children...
						children
							&& nested === false
							&& doNested() 
							|| [],
				   	].flat())

				// restore path context...
				children
					&& context.path.pop()

				return state
			}, 
			[], 
			// input items...
			...(reverse ? 
				this.items
					.slice()
					.reverse() 
				: this.items)) },


	// Test/Example Text renders...
	//
	//	Recursively render the browser as text tree...
	//	._test_texttree(..)
	//		-> string
	//
	//	Recursively render the browser as text tree with manual nesting...
	//	._test_texttree_manual(..)
	//		-> string
	//
	//	Build a nested object tree from the browser...
	//	._test_tree(..)
	//		-> object
	//
	_test_texttree: function(options, context){
		// NOTE: here we do not care about the topology (other than path 
		// 		depth) and just handle items...
		return this
			.walk(
				function(node, i, path){
					return node ? 
						path.slice(1)
							.map(e => '  ')
							.join('') 
								+ node.text
						: [] },
				'_test_texttree',
				function(func, i, path, options, context){
					return [options, context] },
				options, context)
			.join('\n') },
	_test_texttree_manual: function(options, context){
		// NOTE: here we do basic topology -- append children to their 
		// 		respective node...
		return this
			.walk(
				function(node, i, path, next){
					return node == null ? 
							[]
						// make a node...
						: [path.slice(1)
							.map(e => '  ')
							.join('')
								+ node.text]
							// append child nodes if present...
			   				.concat(node.children ?
								next()
								: []) },
				'_test_texttree_manual',
				function(func, i, path, options, context){
					return [options, context] },
				options, context)
			.join('\n') },
	// XXX need to check for output key uniqueness per level...
	_test_tree: function(options, context){
		var toObject = function(res, e){
			if(e == null || e[0] == null){
				return res
			}
			res[e[0]] = e[1] instanceof Array ? 
				// handle nested arrays...
				// NOTE: these did not get through the .reduce(..) below
				// 		as they are simple arrays that do not implement
				// 		either .walk(..) or ._test_tree(..)
				e.slice(1).reduce(toObject, {}) 
				: e[1]
			return res
		}
		return this
			// build [key, children] pairs...
			.walk(
				function(node, i, path, next){
					return node == null ? 
							[]
						// make a node...
						: [[node.text]
							// append child nodes if present...
			   				.concat(node.children ?
								next()
								: null) ] },
				'_test_tree',
				function(func, i, path, options, context){
					return [options, context] },
				options, context)
			// construct the object...
   			.reduce(toObject, {}) },
	// XXX we do not need this any more, as we got paths in the index...
	_test_paths: function(options, context){
		return this.walk(
			function(n, i, p){
				return n 
					&& [(options || {}).joinPaths !== false ? 
						p.join('/') 
						: p] }, 
			'_test_paths',
			function(_, i, path, options, context){
				// NOTE: for paths and indexes to be consistent between
				// 		levels we need to thread the context on, here and
				// 		into the base .walk(..) call below...
				return [options, context] },
			options, context) },


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
	//
	//	func(item, index, path, browser)
	//		-> result
	//
	//
	//
	// options format:
	// 	{
	// 		// The value used if .reverse is set to true...
	// 		//
	// 		// NOTE: the default is different from .walk(..)
	// 		defaultReverse: 'flat' (default) | 'tree',
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
	//
	//
	// XXX should we move the defaults to .config???
	// XXX Q: should we have an option to treat groups as elements???
	map: function(func, options){
		var that = this

		// parse args...
		var args = [...arguments]
		func = (args[0] instanceof Function 
				|| args[0] === undefined) ? 
			args.shift() 
			: undefined
		// NOTE: we do not inherit options from this.options here is it 
		// 		will be done in .walk(..)
		options = args.shift() || {}
		options = !options.defaultReverse ?
			Object.assign({},
				options, 
				{ defaultReverse: 'flat' })
			: options
		var context = args.shift()

		return this.walk(
			function(elem, i, path){
				return elem != null ?
					[func === undefined ?
						elem
						// XXX should this pass the current or the root 
						// 		container to func???
						: func.call(that, elem, i, path, that)]
					: [] }, 
			'map',
			function(_, i, p, options, context){
				return [func, options, context] },
			options, context) },


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
	// 		noIdentityCheck: <bool>,
	//
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
		var args = [...arguments]

		// parse args...
		pattern = args.length == 0 ? 
			true 
			: args.shift() 
		func = (args[0] instanceof Function 
				|| args[0] === undefined) ? 
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
		var index = new Set(Object.values(this.index))
		if(index.has(pattern) 
				|| (pattern instanceof Array
					&& !pattern
						.reduce(function(r, e){ 
							return r && typeof(e) != typeof({})  }, true))){
			// reverse index...
			index = this
				.reduce(function(res, e, i, p){
					res.set(e, [i, p])
					return res
				}, new Map(), {iterateCollapsed: true})
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
							: that.search(pattern, ...args.slice(1)) })
					.flat()
					.unique() 
			} catch(e){
				if(e === Stop){
					return res
				}
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
				{reverse: 'flat'})
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
							|| (!options.noIdentityCheck 
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
			'search',
			function(_, i, p, options, context){
				return [pattern, func, options, context] },
			options, context) },


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
		options = args.pop() || {}

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
			options = Object.assign(
				Object.create(options), 
				{iterateCollapsed: true}) }

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

	// Sublist map functions...
	// XXX this does not include inlined sections, should it???
	sublists: function(func, options){
		return this.search({children: true}, func, options) },

	// XXX should these return an array or a .constructor(..) instance??
	// XXX should this call .forEach(..) on nested stuff or just fall 
	// 		back to .map(..)???
	forEach: function(func, options){
		this.map(...arguments)
		return this },
	filter: function(func, options, context){
		return this.walk(
			function(e, i, p){
				return e && func.call(this, e, i, p) ? [e] : [] },
			'filter',
			function(_, i, p, options, context){
				return [func, options, context] },
			options, context) },
	reduce: function(func, start, options){
		var that = this
		var context = arguments[3] || {result: start}
		this.walk(
			function(e, i, p){
				context.result = e ? 
					func.call(that, context.result, e, i, p) 
					: context.result
				return context.result 
			},
			'reduce',
			function(_, i, p, options, context){
				return [func, context.result, options, context]
			},
			options, context)
		return context.result
	},

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
		return this.search(item == null ? this.focused : item, 
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


	// XXX do we need edit ability here? 
	// 		i.e. .set(..), .remove(..), .sort(..), ...
	// 		...if we are going to implement editing then we'll need to 
	// 		callback the user code or update the user state...


	// Renderers...
	//
	// 	.renderFinalize(items, context)
	// 	.renderList(items, context)
	// 	.renderNested(header, children, item, context)
	// 	.renderNestedHeader(item, i, context)
	// 	.renderItem(item, i, context)
	// 	.renderGroup(items, context)
	//
	//
	// NOTE: there are not to be used directly...
	// XXX might be a good idea to move these into a separate renderer 
	// 		object (mixin or encapsulated)...
	renderFinalize: function(items, context){
		return this.renderList(items, context) },
	renderList: function(items, context){
		return items },
	// NOTE: to skip rendering an item/list return null...
	// XXX should this take an empty children???
	// 		...this would make it simpler to expand/collapse without 
	// 		re-rendering the whole list...
	renderNested: function(header, children, item, context){
		return header ? 
			this.renderGroup([
				header, 
				children,
			])
   			: children },
	// XXX use a real blank item...
	renderNestedBlank(children, i, context){
		var elem = {value: '   '}
		return this.renderNested(
			this.renderNestedHeader(elem, i, context),
			children, 
			elem, 
			context) },
	renderNestedHeader: function(item, i, context){
		return this.renderItem(item, i, context) },
	// NOTE: to skip rendering an item/list return null...
	renderItem: function(item, i, context){
		return item },
	renderGroup: function(items, context){
		return items },

	// Render state...
	//
	//	.render()
	//	.render(options[, renderer[, context]])
	//		-> state
	//
	//
	// context format:
	// 	{
	// 		root: <root-browser>,
	// 		options: <options>,
	//
	//
	// 		// These are the same as in options...
	// 		//
	// 		// NOTE: these will get set to the item indexes...
	// 		from: <index> | <query>,
	// 		to: <index> | <query>,
	// 		// optional...
	// 		// NOTE: in general we set these in options...
	// 		//around: <index> | <query>,
	// 		//count: <number>,
	//
	// 		...
	// 	}
	//
	//
	// options:
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
	//
	// NOTE: there is no need to explicitly .make(..) the state before
	// 		calling this as first access to .items will do so automatically...
	// NOTE: calling this will re-render the existing state. to re-make 
	// 		the state anew that use .update(..)...
	// NOTE: it is not recommended to extend this. all the responsibility
	// 		of actual rendering should lay on the renderer methods...
	// NOTE: currently options and context are distinguished only via 
	// 		the .options attribute...
	//
	// XXX use partial render for things like search....
	// XXX make partial render be lazy -- i.e. add/remove elements and 
	// 		do not reconstruct the ones already present...
	render: function(options, renderer, context){
		context = context || {}
		renderer = renderer || this
		options = context.options = context.options 
			|| Object.assign(
				Object.create(this.options || {}),
				{ iterateNonIterable: true }, 
				options || {})

		// build range bounds...
		// use .get(..) on full (non-partial) range...
		var get_options = Object.assign(
			Object.create(options),
			// XXX for some magical reason if we do not explicitly include 
			// 		.iterateNonIterable here it is not seen down the line...
			{from: null, to: null, around: null,
				iterateNonIterable: options.iterateNonIterable})
			//{from: null, to: null, around: null, count: null})
		// index getter...
		var normIndex = function(i){
			return (i === undefined || typeof(i) == typeof(123)) ?
				i
				: this.get(i, 
					function(_, i){ return i }, 
					get_options) }.bind(this)
		// NOTE: we prefer context.from / context.to as they are more 
		// 		likely to be normalized.
		// 		as to the rest of the values of set we look first in the 
		// 		options as we'll need them only if from/to are not 
		// 		normalized...
		var from = context.from = normIndex('from' in context ? context.from : options.from)
		var to = context.to = normIndex('to' in context ? context.to : options.to)
		var around = normIndex('around' in options ? options.around : context.around)
		var count = 'count' in options ? options.count : context.count
		// NOTE: count < 0 is the same as no count / all...
		count = count < 0 ? 
			null 
			: count
		// complete to/from based on count and/or around...
		// NOTE: we do not care about overflow here...
		;(from == null && count != null) 
			&& (from = context.from = 
				to != null ? 
					to - count
				: around != null ?
					around - Math.floor(count/2)
				: from)
		;(to == null && count != null)
			&& (to = context.to = 
				from != null ? 
					from + count
				: around != null ?
					around + Math.ceil(count/2)
				: to)
		// sanity check...
		if(from != null && to != null && to < from){
			throw new Error(`.render(..): context.from must be less than `
				+`or equal to context.to. (got: from=${from} and to=${to})`) }

		// XXX use this to check if an item is on the path to <from> and
		// 		pass it to the skipped topology constructor...
		var from_path = context.from_path =
			context.from_path	
				|| (from != null 
					&& this.get(from, 
						function(e, i, p){ return p }, 
						get_options))
		from_path = from_path instanceof Array
			&& from_path

		// do the walk...
		var elems = this.walk(
			function(elem, i, path, nested){
				return (
					// special case: nested <from> elem -> topology only...
					(from_path 
							&& i < from 
							// only for nested...
							&& elem && elem.children
							// only sub-path...
							&& path.cmp(from_path.slice(0, path.length))) ?
						[ renderer.renderNestedBlank(nested(), i, context) ]
					// out of range -> skip...
					: ((from != null && i < from) 
							|| (to != null && i >= to)) ?
						[]
					// inline...
					: elem == null ?
						// NOTE: here we are forcing rendering of the 
						// 		inline browser/list, i.e. ignoring 
						// 		options.skipNested for inline stuff...
						[ renderer.renderGroup(nested(true), context) ]
					// nested...
					: elem.children ?
						[ renderer.renderNested(
							renderer.renderNestedHeader(elem, i, context),
							nested(),
							elem, 
							context) ]
					// normal elem...
					: [ renderer.renderItem(elem, i, context) ] ) },
			'render',
			function(_, i, p, options, context){
				return [options, renderer, context] },
			options, context)

		// finalize depending on render mode...
		return (!options.nonFinalized && context.root === this) ?
			// root context -> render list and return this...
			renderer.renderFinalize(elems, context)
			// nested context -> return item list...
			: elems },
	

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
			// blur .focused...
			this.focused
				&& this.blur(this.focused)
			// NOTE: if we got multiple matches we care only about the first one...
			var item = items.shift()
			item != null
				&& this.reveal(item)
				&& (item.focused = true) },
		default_item: function(){ return this.get(0) },
		options: { 
			// XXX get this from options...
			skipDisabled: true,
		},
		getter: 'get' }),
	blur: makeItemEventMethod('blur', {
		handler: function(evt, items){
			items.forEach(function(item){
				delete item.focused }) },
		default_item: function(){ return this.focused } }),
	// NOTE: .next() / .prev() will wrap around the first/last elements,
	// 		this is different from .focus('next') / .focus('prev')...
	next: function(){ 
		this.focus('next').focused || this.focus('first') 
		return this },
	prev: function(){ 
		this.focus('prev').focused || this.focus('last') 
		return this },
	toggleFocus: makeItemEventToggler(
		'focused', 
		'focus', 'blur', 
		function(){ return this.focused || 0 }, 
		false),
	// selection...
	select: makeItemOptionOnEventMethod('select', 'selected'),
	deselect: makeItemOptionOffEventMethod('deselect', 'selected'),
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
		{ handler: function(item){ this.blur(item) }, }),
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
	__update_timeout: null,
	update: makeEventMethod('update', 
		function(evt, full, options){
			options = (full && full !== true && full !== false) ? 
				full 
				: options
			full = full === options ? 
				false 
				: full
			var timeout = (options || {}).updateTimeout
				|| this.options.updateTimeout

			var _update = function(){
				delete this.__update_timeout
				this
					.run(function(){
						full 
							&& this.make(options) 
						this.preRender() })
					.render(options) 
				this.trigger(evt, full, options) }.bind(this)

			// no timeout...
			if(!timeout){
				_update()

			// first call -> call sync then delay...
			} else if(this.__update_timeout == null){
				_update()
				this.__update_timeout = setTimeout(function(){
					delete this.__update_timeout
				}.bind(this), timeout) 

			// fast subsequent calls -> delay... 
			} else {
				clearTimeout(this.__update_timeout)
				this.__update_timeout = setTimeout(_update, timeout) 
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
	

	// XXX should we update on init....
	__init__: function(func, options){
		this.__list__ = func
		this.options = Object.assign(
			Object.create(this.options || {}), 
			options || {})
	},
}


var BaseBrowser = 
module.BaseBrowser = 
object.makeConstructor('BaseBrowser', 
		BaseBrowserClassPrototype, 
		BaseBrowserPrototype)



//---------------------------------------------------------------------

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

		'#1': 'focus: 0',
		'#2': 'focus: 1',
		'#3': 'focus: 2',
		'#4': 'focus: 3',
		'#5': 'focus: 4',
		'#6': 'focus: 5',
		'#7': 'focus: 6',
		'#8': 'focus: 7',
		'#9': 'focus: 8',
		'#0': 'focus: 9',


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
	__proto__: BaseItem,

	text: function(elem){
		var txt = object.parent(HTMLItem.text, this).call(this, elem)
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

var HTMLItemPrototype = {
	__proto__: BaseItem.prototype,

	get elem(){
		return this.constructor.elem(this) },
}

var HTMLItem = 
module.HTMLItem = 
object.makeConstructor('HTMLItem', 
	HTMLItemClassPrototype,
	HTMLItemPrototype)



// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
// Helpers...

// Scrolling / offset...
//
var scrollOffset = function(browser, direction, elem){
	var elem = (elem || browser.focused).elem
	var lst = browser.dom.querySelector('.list')
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
	var lst = browser.dom.querySelector('.list')

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
		object.parent(HTMLBrowserPrototype[name], name, this).call(this, ...arguments)

		var threashold = this.options.focusOffsetWhileScrolling || 0

		var focused = this.focused
		var first = this.get('first', {skipDisabled: true})
		var last = this.get('last', {skipDisabled: true})

		// center the first/last elements to reveal hidden items before/after...
		;(focused === last || focused === first) ?
			this.scrollTo(this.focused, 'center')
		// keep scrolled item at threashold from list edge...
		: threashold > 0
			&& nudgeElement(this, direction, this.focused)

		// hold repeat at last element...
		focused === (direction == 'up' ? first : last)
			&& this.keyboard.pauseRepeat
			&& this.keyboard.pauseRepeat() } }
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
		target === this.get(t, {skipDisabled: true}) && target === focused ?
			this.scrollTo(target, 'center')
		// scroll one page and focus...
		: target === focused ?
			this.focus(this.get(d, 1))
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

var HTMLBrowserClassPrototype = {
	__proto__: BaseBrowser,
}

// XXX render of nested lists does not affect the parent list(s)...
// 		...need to render lists and items both as a whole or independently...
// XXX need a strategy to update the DOM -- i.e. add/remove nodes for 
// 		partial rendering instead of full DOM replacement...
// XXX add a left button type/option -- expand/collapse and friends...
var HTMLBrowserPrototype = {
	__proto__: BaseBrowser.prototype,
	__item__: HTMLItem,


	options: {
		__proto__: BaseBrowser.prototype.options,

		// for more docs see:
		//	https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView
		//
		// XXX 'smooth' value yields odd results...
		//scrollBehavior: 'auto',

		// Sets the distance between the focused element and top/bottom
		// border while moving through elements...
		//
		// XXX can we make this relative???
		// 		...i.e. about half of the average element height...
		focusOffsetWhileScrolling: 18,

		hideListHeader: false,

		renderHidden: false,

		localEvents: [
			// XXX STUB???
			'click',

			// XXX keyboard stuff...
			// XXX

			// XXX custom events...
			// XXX
		],
		//buttonLocalEvents: [
		//],

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
		// 			// force active (optional)...
		// 			bool 
		// 				| <function>,
		//
		// 			// button metadata (optional)...
		// 			<metadata>,
		// 		],
		//
		// 		...
		// 	]
		itemButtons: [
		],
		// XXX need to mix these into the header only...
		headerItemButtons: [
		],

		// Shorthand elements...
		//
		// Format:
		// 	{
		// 		<key>: {
		// 			class: <element-class-str>,
		// 			html: <element-html-str>,
		// 		},
		// 		...
		// 	}
		//
		// If make(..) gets passed <key> it will construct and element
		// via <element-html-str> with an optional <element-class-str>
		//
		// NOTE: .class is optional...
		// NOTE: set this to null to disable shorthands...
		// NOTE: currently the options in the template will override 
		// 		anything explicitly given by item options... (XXX revise)
		elementShorthand: {
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
			this.__keyboard_object 
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
	get __keyboard_handler(){
		var options = this.options || {}
		return (this.____keyboard_handler = this.____keyboard_handler 
			|| keyboard.makePausableKeyboardHandler(
				this.keyboard,
				function(){ 
					options.keyboardReportUnhandled
						&& console.log('KEY:', ...arguments) }, 
				this)) },
	
	// Proxy to .keyboard.parseStringHandler(..)
	parseStringHandler: function(code, context){
		return this.keyboard.parseStringHandler(code, context || this) },


	// DOM props..
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
				this.container.replaceChild(value, this.__dom) 
				: this.container.appendChild(value))
		this.__dom = value },


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
			pos = pos || 'top'
			var lst = this.dom.querySelector('.list')
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
						reverse: pos == 'bottom' ? 
							'flat' 
							: false,
						skipDisabled: true, 
					})
				.run(function(){
					return this instanceof Array ?
						undefined
						: this }) }.bind(this)

		pattern = arguments[0] = 
			// DOM element...
			pattern instanceof HTMLElement ?
				function(e){ return e.elem === p || e.elem === p }
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
		return object.parent(HTMLBrowserPrototype.search, this).call(this, pattern, ...args) },
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
			: object.parent(HTMLBrowserPrototype.get, this).call(this, pattern, func, ...args) },


	// Copy/Paste support...
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


	// Renderers (DOM)...
	//
	// This also does:
	// 	- save the rendered state to .dom 
	// 	- wrap a list of nodes (nested list) in a div
	// 	- setup event handling
	// 	- init state...
	//
	// Format:
	// 	if list of items passed:
	// 		<div>
	// 			<!-- items -->
	// 			...
	// 		</div>
	// 	or same as .renderList(..)
	//
	renderFinalize: function(items, context){
		var that = this
		var d = this.renderList(items, context)
		var options = context.options || this.options || {}

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
			that.keyPress(that.keyboard.event2key(evt)) })
		// focus...
		d.addEventListener('click', 
			function(e){ 
				e.stopPropagation()
				d.focus() })
		/* XXX this messes up scrollbar...
		d.addEventListener('focus',
		   function(){
			   that.focused
					&& that.focused.elem.focus() })
		//*/

		// XXX should this be done here or in .render(..)???
		this.dom = d

		// keep focus where it is...
		var focused = this.focused
		focused
			&& focused.elem
				// XXX this will trigger the focus event...
				// 		...can we do this without triggering new events???
				.focus()

		return this.dom
	},
	//
	// Foramt:
	// 	<div class="browse-widget" tabindex="0">
	// 		<!-- header -->
	// 		...
	//
	// 		<!-- list -->
	// 		<div class="list v-block">
	// 			<!-- items -->
	// 			...
	// 		</div>
	// 	</div>
	//
	renderList: function(items, context){
		var that = this
		var options = context.options || this.options || {}

		// dialog (container)...
		var dialog = document.createElement('div')
		dialog.classList.add('browse-widget')
		dialog.setAttribute('tabindex', '0')
		// HACK?: prevent dialog from grabbing focus from item...
		dialog.addEventListener('mousedown', 
			function(evt){ evt.stopPropagation() })

		// header...
		options.hideListHeader
			|| dialog.appendChild(this.renderListHeader(context))

		// list...
		var list = document.createElement('div')
		list.classList.add('list', 'v-block')
		// prevent scrollbar from grabbing focus...
		list.addEventListener('mousedown', 
			function(evt){ evt.stopPropagation() })
		items
			.forEach(function(item){
				list.appendChild(item instanceof Array ? 
					that.renderGroup(item) 
					: item) })
		dialog.appendChild(list)

		return dialog 
	},
	//
	// Foramt:
	//	<div class="path v-block">
	//		<div class="dir" tabindex="0">dir</div>
	//		...
	//		<div class="dir cur" tabindex="0">dir</div>
	//	</div>
	// 	
	// XXX populate this...
	// XXX make this an item???
	renderListHeader: function(context){
		var header = document.createElement('div')
		header.classList.add('path', 'v-block')

		// XXX path/search...
		var dir = document.createElement('div')
		dir.classList.add('dir', 'cur')
		dir.setAttribute('tabindex', '0')
		header.appendChild(dir)

		return header
	},
	//
	// Format:
	// 	<div class="list">
	// 		<!-- header (optional) -->
	// 		...
	//
	// 		<!-- children (optional) -->
	// 		...
	// 	</div>
	//
	renderNested: function(header, children, item, context){
		var that = this
		var options = context.options || this.options || {}

		// container...
		var e = document.createElement('div')
		e.classList.add('list')

		// localize events...
		var stopPropagation = function(evt){ evt.stopPropagation() }
		;(options.localEvents || [])
			.forEach(function(evt){
				e.addEventListener(evt, stopPropagation) })

		// header...
		header
			&& e.appendChild(header)

		// items...
		children instanceof Node ?
			e.appendChild(children)
		: children instanceof Array ?
			children
				.forEach(function(item){
					e.appendChild(item) })
		: null

		item.dom = e

		return e
	},
	// NOTE: this is the similar to .renderItem(..)
	renderNestedHeader: function(item, i, context){
		var that = this
		return this.renderItem(item, i, context)
			// update dom...
			.run(function(){
				this.classList.add('sub-list-header', 'traversable')
				item.collapsed
					&& this.classList.add('collapsed')
			}) },
	//
	// Format:
	// 	<div class="group">
	// 		<!-- items -->
	// 		...
	// 	</div>
	//
	renderGroup: function(items, context){
		var e = document.createElement('div')
		e.classList.add('group')
		items
			// XXX is this wrong???
			.flat(Infinity)
			.forEach(function(item){
				e.appendChild(item) })
		return e },
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
	// XXX should buttons be active in disabled state???
	// 		...for enable/disable button seems logical, not so much for 
	// 		the rest...
	renderItem: function(item, i, context){
		var that = this
		var options = context.options || this.options || {}
		if(options.hidden && !options.renderHidden){
			return null
		}

		// helpers...
		var resolveValue = function(value, context, exec_context){
			var htmlhandler = typeof(value) == typeof('str') ?
				that.parseStringHandler(value, exec_context)
				: null
			return value instanceof Function ?
					value.call(that, item)
				: htmlhandler && htmlhandler.action in context ?
					context[htmlhandler.action]
						.call(that, item, ...htmlhandler.arguments)
				: value }
		var setDOMValue = function(target, value){
			value instanceof HTMLElement ?
				target.appendChild(value)
			: (typeof(jQuery) != 'undefined' && value instanceof jQuery) ?
				value.appendTo(target)
			: (target.innerHTML = value)
			return target }

		// special-case: item shorthands...
		if(item.value in (options.elementShorthand || {})){
			// XXX need to merge and not overwrite -- revise...
			Object.assign(item, options.elementShorthand[item.value])

			// NOTE: this is a bit of a cheat, but it saves us from either 
			// 		parsing or restricting the format...
			var tmp = document.createElement('div')
			tmp.innerHTML = item.html
			var elem = item.dom = tmp.firstElementChild 
			elem.classList.add(
				...(item['class'] instanceof Array ?
					item['class']
					: item['class'].split(/\s+/g)))

			return elem 
		}

		// Base DOM...
		var elem = document.createElement('div')
		var text = item.text

		// classes...
		elem.classList.add(...['item']
			// user classes...
			.concat(item['class'] || item.cls || [])
			// special classes...
			.concat([
				'focused',
				'selected',
				'disabled',
				'hidden',
			].filter(function(cls){ 
				return !!item[cls] })))

		// attrs...
		item.disabled
			|| elem.setAttribute('tabindex', '0')
		Object.entries(item.attrs || {})
			// shorthand attrs...
			.concat([
			].map(function(key){ 
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
			&& (item.value instanceof Array ? item.value : [item.value])
				// handle $keys and other stuff...
				.map(function(v){
					// handle key-shortcuts $K...
					v = typeof(v) == typeof('str') ?
							v.replace(/\$\w/g, 
								function(k){
									k = k[1] 
									return (item.keys || [])
											.includes(that.keyboard.normalizeKey(k)) ?
										`<u class="key-hint">${k}</u>`
										: k })
						: v

					var value = document.createElement('span')
					value.classList.add('text')

					// set the value...
					setDOMValue(value, 
						resolveValue(v, that))

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
					that.toggleCollapse(item)
					: that.open(item, text, elem) })
		elem.addEventListener('focus', 
			function(){ 
				// NOTE: we do not retrigger focus on an item if it's 
				// 		already focused...
				that.focused !== item
					&& that.focus(item) })
		elem.addEventListener('contextmenu', 
			function(evt){ 
				evt.preventDefault()
				that.menu(item) })
		// user events...
		Object.entries(item.events || {})
			// shorthand DOM events...
			.concat([
				].map(function(evt){ 
					return [evt, item[evt]] }))
			// setup the handlers...
			.forEach(function([evt, handler]){
				handler
					&& elem.addEventListener(evt, handler.bind(that)) })

		// buttons...
		var button_keys = {}
		// XXX migrate button inheritance...
		var buttons = (item.buttons || options.itemButtons || [])
			// resolve buttons from library...
			.map(function(button){
				return button instanceof Array ?
						button
					// XXX reference the actual make(..) and not Items...
					: Items.buttons[button] instanceof Function ?
						Items.buttons[button].call(that, item)
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
					cls.call(that, item)
					: cls
				cls = cls instanceof Array ? 
					cls 
					: cls.split(/\s+/g)
				var alt = metadata.alt
				alt = alt instanceof Function ?
						alt.call(that, item)
					: alt
				var keys = metadata.keys

				var button = document.createElement('div')
				button.classList.add('button', ...cls)
				alt
					&& button.setAttribute('alt', alt)

				// button content...
				setDOMValue(button,
					resolveValue(html, Items.buttons, {item}))

				// non-disabled button...
				if(force instanceof Function ? 
						force.call(that, item) 
						: (force || !item.disabled) ){
					button.setAttribute('tabindex', '0')
					// events to keep in buttons...
					;(options.buttonLocalEvents || options.localEvents || [])
						.forEach(function(evt){
							button.addEventListener(evt, stopPropagation) })
					// button keys...
					keys && !options.disableButtonSortcuts
						&& (keys instanceof Array ? keys : [keys])
							.forEach(function(key){
								// XXX should we break or warn???
								if(key in button_keys){
									throw new Error(`renderItem(..): button key already used: ${key}`) }
								button_keys[keyboard.joinKey(keyboard.normalizeKey(key))] = button })
					// keep focus on the item containing the button -- i.e. if
					// we tab out of the item focus the item we get to...
					button.addEventListener('focus', function(){
						item.focused 
							|| that.focus(item) 
								&& button.focus() })
					// main button action (click/enter)...
					// XXX should there be a secondary action (i.e. shift-enter)???
					if(handler){
						var func = handler instanceof Function ?
							handler
							// string handler -> that.<handler>(item)
							: function(evt, ...args){
								var a = that.parseStringHandler(
									handler, 
									// button handler arg namespace...
									{
										event: evt,
										item: item,
										// NOTE: if we are not focusing 
										// 		on button click this may 
										// 		be different from item...
										focused: that.focused,
										button: html,
									})
								that[a.action](...a.arguments) }

						// handle clicks and keyboard...
						button.addEventListener('click', func.bind(that))
						// NOTE: we only trigger buttons on Enter and do 
						// 		not care about other keys...
						button.addEventListener('keydown', 
							function(evt){
								var k = keyboard.event2key(evt)
								if(k.includes('Enter')){
									event.stopPropagation()
									func.call(that, evt, item) } }) } 
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
					button_keys[k].click() } })
		
		item.dom = elem

		return elem 
	},

	/* XXX sort out .dom updates...
	render: function(...args){
		var res = object.parent(HTMLBrowserPrototype.render, this).call(this, ...args)

		// XXX set .dom...
		// 		...need support for item lists...
		//this.dom = res

		return res
	},
	//*/


	// Events extensions...
	//
	// NOTE: this will also kill any user-set keys for disabled/hidden items...
	__preRender__: function(){
		var that = this
		// reset item shortcuts...
		var shortcuts = 
			this.keybindings.ItemShortcuts = 
				Object.assign({}, KEYBOARD_CONFIG.ItemShortcuts)

		var i = 0
		this.map(function(e){
			// shortcut number hint...
			// NOTE: these are just hints, the actual keys are handled 
			// 		in .keybindings...
			if(i < 10 && !e.disabled && !e.hidden){
				var attrs = e.attrs = e.attrs || {}
				attrs['shortcut-number'] = (++i) % 10
			// cleanup...
			} else {
				delete (e.attrs || {})['shortcut-number']
			}
			
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
								shortcuts[k] = function(){ that.focus(e) } 

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
		}, {skipDisabled: false})
	},
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
				// set focus...
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
	__expand__: function(){ this.update() },
	__collapse__: function(){ this.update() },
	__select__: updateElemClass('add', 'selected'),
	__deselect__: updateElemClass('remove', 'selected'),
	__disable__: updateElemClass('add', 'disabled', function(){ this.update() }),
	__enable__: updateElemClass('remove', 'disabled', function(){ this.update() }),
	__hide__: updateElemClass('add', 'hidden'),
	__show__: updateElemClass('remove', 'hidden'),


	// Custom events...
	//
	// NOTE: this is not directly connected to DOM key events...
	keyPress: makeEventMethod('keypress', 
		function(evt, key){
			this.__keyboard_handler(key) }),
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
object.makeConstructor('HTMLBrowser', 
		HTMLBrowserClassPrototype, 
		HTMLBrowserPrototype)


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
// shorthans...

module.Item = HTMLItem
module.Browser = HTMLBrowser



//---------------------------------------------------------------------
// Text tree renderer...
//
// This is mainly designed for testing.
//
// XXX Q: how should the header item and it's sub-list be linked???

var TextBrowserClassPrototype = {
	__proto__: BaseBrowser,
}

var TextBrowserPrototype = {
	__proto__: BaseBrowser.prototype,

	options: {
		renderIndent: '\t',
	},
	
	// NOTE: we do not need .renderGroup(..) here as a group is not 
	// 		visible in text...
	renderList: function(items, options){
		var that = this
		return this.renderNested(null, items, null, null, options)
			.join('\n') },
	renderItem: function(item, i, options){
		return item.current ?
			`[ ${ item.text } ]`
   			: item.text },
	renderNested: function(header, children, context, item, options){
		var that = this
		var nested = children 
			&& children
				.flat()
				.map(function(e){
					return e instanceof Array ?
						e.map(function(e){ 
							return (that.options.renderIndent || '  ') + e })
						: e })
				.flat() 
		return (
			// expanded...
			header && nested ?
				[
					...(header == '   ' ? 
						// blank header...
						[] 
						: ['- ' + header]),
					nested,
				]
			// collapsed...
			: header ?
				[ '+ ' + header ]
			// nested...
			: nested )},
}

var TextBrowser = 
module.TextBrowser = 
object.makeConstructor('TextBrowser', 
		TextBrowserClassPrototype, 
		TextBrowserPrototype)




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
