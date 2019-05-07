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

// XXX
//var walk = require('lib/walk')
var walk = require('../../node_modules/generic-walk/walk').walk



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
// XXX options???
Items.nest = function(item, list, options){
	options = options || {}
	//options = Object.assign(Object.create(this.options || {}), options || {})
	options.children = list instanceof Array ?
		collectItems(this, list)
		: list
	return this(item, options)
}



//---------------------------------------------------------------------
// wrappers...

Items.Item = function(value, options){}
Items.Action = function(value, options){}
Items.Heading = function(value, options){}
Items.Empty = function(value){}
Items.Separator = function(value){}
Items.Spinner = function(value){}
Items.Selected = function(value){}
Items.Editable = function(value){}
Items.ConfirmAction = function(value){}

// lists...
Items.List = function(values){}
Items.EditableList = function(values){}
Items.EditablePinnedList = function(values){}

// Special list components...
Items.ListPath = function(){}
Items.ListTitle = function(){}



//---------------------------------------------------------------------

// Generate an event method...
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
//
// XXX should this be simply a shorthand to .trigger(..) ???
var makeEventMethod = function(event, handler){
	return function(item){
		// register handler...
		if(item instanceof Function){
			return this.on(event, item) 
		}

		// XXX STUG: event object...
		// XXX can we generate this in one spot???
		// 		...currently it is generated here and in .trigger(..)
		var evt = {
		 	name: event,
			// XXX
			//stopPropagation: function(){
			//},
		}

		// XXX handle more of the API???
		handler
			&& handler.call(this, evt, ...arguments)

		// XXX we should get the actual item and pass it on...
		this.trigger(evt, ...arguments)

		return this
	}
}

var callItemEventHandlers = function(item, event, ...args){
	;(item[event] ?
			[item[event]]
			: [])
		.concat((item.events || {})[event] || [])
		.forEach(function(handler){
			// XXX revise call signature...
			handler.call(item, evt, item, ...args) }) }

// XXX use .find(..) instead of .get(..) here....
var makeItemEventMethod = function(event, handler){
	return makeEventMethod(event, function(evt, item, ...args){
		item = item ? 
			// XXX
			this.get(item) 
			: []
		item = item instanceof Array ? item : [item]

		handler
			&& handler.call(this, evt, item, ...args)

		item.forEach(function(item){
			callItemEventHandlers(item, event) })
	}) }



// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var BaseBrowserClassPrototype = {
}

// XXX need a way to identify items...
var BaseBrowserPrototype = {
	// XXX should we mix item/list options or separate them into sub-objects???
	options: {
		noDuplicateValues: false,
	},

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
	// 		a compromise we use .item_key_index below for item identification.
	__items: null,
	get items(){
		this.__items
			|| this.make()
		return this.__items },
	set items(value){
		this.__items = value },

	//
	// Format:
	// 	{
	// 		<key>: <item>,
	// 		...
	// 	}
	//
	// NOTE: this will get overwritten each tume .make(..) is called.
	//
	// XXX need to maintain this over item add/remove/change...
	// XXX Q: should we be able to add/remove/change items outside of .__list__(..)???
	// 		...only some item updates (how .collapsed is handled) make 
	// 		sense at this time -- need to think about this more 
	// 		carefully + strictly document the result...
	// XXX can we make the format here simpler with less level 
	// 		of indirection??
	// 		...currently to go down a path we need to:
	//			this.item_key_index.A.children.item_key_index.B.children...
	//		would be nice to be closer to:
	//			this.A.B...
	__item_index: null,
	get item_key_index(){
		this.__item_index
			|| this.make()
		return this.__item_index },
	set item_key_index(value){
		this.__item_index = value },


	// XXX what should these return??? (item, id, ...)
	__focused: undefined,
	get focused(){
		return this.__focused && this.__focused.focused ?
			this.__focused
			: (this.__focused = this
				// XXX should we simple bailout when we find an item???
				.filter(function(e){
					return e.focused }).shift()) },
	set focused(value){
		// XXX
	},

	__selected: null,
	get selected(){
		return this.__selected 
			|| (this.__selected = this
				.filter(function(e){
					return e.selected })) },
	set selected(value){
		// XXX
	},


	// Length...
	//
	// visible only...
	get length(){
		return this.map({skipNested: true}).length
			// XXX this is wrong as it will not account for nested nested elements...
			+ this.nested()
				.reduce(function(res, e){ 
					return e.collapsed ?
						res + 1
						: res + e.children.length }, 0) },
	// tree -- ignores .collapsed...
	get lengthTree(){
		return this.map({skipNested: true}).length
			// XXX this is wrong as it will not account for nested nested elements...
			+ this.nested()
				.reduce(function(res, e){ 
					return res + e.children.length }, 0) },
	// full -- ignores .collapsed and .noniterable...
	get lengthAll(){
		return this.map({skipNested: true, iterateNonIterable: true}).length
			// XXX this is wrong as it will not account for nested nested elements...
			+ this.nested()
				.reduce(function(res, e){ 
					return res + (e.children.lengthAll || e.children.length) }, 0) },


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
	// 	.item_key_index (keyed via .id or JSONified .value)
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



	// XXX need a better key/path API...
	//
	__value2key__: function(key){
		//return JSON.stringify(key)
		return key instanceof Array ?
			key.join(' ')
			: key },

	// Key getter/generator...
	//
	// XXX should these include the path???
	// XXX is JSON the best key format???
	__key__: function(item){
		return item.id 
			// value is a browser -> generate an unique id...
			// XXX identify via structure...
			|| (item.value instanceof Browser 
				&& this.__id__())
			|| this.__value2key__(item.value) },

	// ID generator...
	//
	// Format:
	// 	"<date>"
	// 	"<prefix> <date>"
	//
	// XXX do a better id...
	// 		Ex:
	//			"abc"
	// 			"abc (1)"
	// 			"abc (2)"
	// XXX not sure about the logic of this, should this take an item as 
	// 		input and return an id???
	// 		...should this check for uniqueness???
	// 		think merging this with any of the actual ID generators would be best...
	__id__: function(prefix){
		// id prefix...
		return (prefix || '') 
			// separator...
			+ (prefix ? ' ' : '') 
			// date...
			+ Date.now() },


	// Walk the browser...
	//
	// 	.walk(handleItem[, options])
	// 		-> result
	//
	// 	.walk(handleItem, handleRecursion[, options])
	// 		-> result
	//
	// 	.walk(handleItem, handleRecursion, isWalkable[, options])
	// 		-> result
	//
	//
	//
	// 	handleItem(path, elem, index, doNested, children)
	// 		-> items
	//
	// 	Trigger nested item handling...
	// 	doNested([options])
	// 	doNested(list[, options])
	// 	doNested(index[, options])
	// 	doNested(list, index[, options])
	// 		-> items
	//
	// 	Disable automatic nested item handling...
	// 	doNested(false)
	// 		-> undefined
	//
	// 	Force nested item handling...
	// 	doNested(true, ..)
	// 		-> items
	//
	// 	NOTE: doNested(..) has no effect of options.reverse is
	// 		set to 'flat'...
	// 	NOTE: only the first call to doNested(..) as any effect, all 
	// 		consecutive calls will return cached results of the first 
	// 		call...
	//
	//
	//
	// 	Handle recursion down...
	// 	handleRecursion(func, index, path, children, options)
	// 		-> items 
	//
	//
	//
	//	Test if item is walkable...
	//	isWalkable(item)
	//		-> bool
	//
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
	// XXX can we add support for partial walks, i.e. start/end ranges???
	// 		...or abort walk and return result on user request...
	// XXX can this support breadth first walking???
	// XXX revise protocol...
	// XXX use generic-walk.... (???)
	walk: function(func, options){
		var that = this

		// parse args...
		var args = [...arguments]
		func = args[0] instanceof Function ? 
			args.shift() 
			: undefined
		var recursion = (args[0] instanceof Function 
				|| typeof(args[0]) == typeof('str')) ? 
			args.shift() 
			: undefined
		var walkable = args[0] instanceof Function ?
			args.shift() 
			: null 
		var i = typeof(args[0]) == typeof(123) ?
			args.shift()
			: 0
		var path = (args[0] instanceof Array 
				|| typeof(args[0]) == typeof('str')) ?
			args.shift()
			: []
		path = path instanceof Array ? path : [path]
		options = args.pop() || {} 

		// set call context...
		options = !options.root ?
			Object.assign({},
				this.options,
				options,
				{root: this})
			: options

		/*var start = options.start || 0
		var end = options.end 
			|| (options.count >= 0 && start + (options.count))
			|| Infinity
		//*/
		var iterateNonIterable = options.iterateAll || options.iterateNonIterable
		var iterateCollapsed = options.iterateAll || options.iterateCollapsed
		var skipNested = !options.iterateAll && options.skipNested
		var reverse = options.reverse === true ?
			(options.defaultReverse || 'tree')
			: options.reverse

		var isWalkable = walkable ?
			function(elem){
				return elem instanceof Array || walkable(elem) }
			: function(elem){
				return elem instanceof Array || elem instanceof Browser }

		// level walk function...
		var walk = function(i, path, list){
			return list
				// reverse the items...
				.run(function(){
					return reverse ?
						// NOTE: we .slice() as we do not want to affect 
						// 		the actual list...
						this.slice().reverse() 
						: this })
				.map(function(elem){
					// skip non-iterable items...
					if(!iterateNonIterable && elem.noniterable){
						return []
					}

					var elem_id = elem.id || elem.value
					// these will be set in the return expression below...
					var children
					var p 

					// nested browser/list handler...
					var nested = false
					var doNested = function(list, j, opts){
						// this can be called only once...
						if(nested !== false){
							return nested
						}

						// parse args...
						var args = [...arguments]
						list = (args[0] === true 
								|| args[0] === false
								|| isWalkable(args[0])) ?
							args.shift()
							: undefined
						j = typeof(args[0]) == typeof(123) ?
							args.shift()
							: undefined
						opts = args.shift() || options

						// normalize...
						list = list === true ?
						   		children	
							: list === false ?
								list
							: (!iterateCollapsed && elem.collapsed) ?
								[]
							: (list || children)
						i = j != null ? j : i

						return (
								// request manual iteration...
								list === false ?
									[]
								: list instanceof Array ?
									walk(i, p, list)
								// user-defined recursion...
								: recursion instanceof Function ?
									recursion.call(that, func, i, p, list, opts)
								: list[recursion || 'walk'](func, i, p, opts) )
				   			.run(function(){
								var res = this instanceof Array ? 
									this 
									: [this] 
								// XXX BUG: this depends on the length 
								// 		of the result and not on the number
								// 		of func calls...
								// 		...i.e. should depend on input 
								// 		and not on output...
								i += res.length 
								nested = res.flat()
								return nested
							})
					}

					// setup iteration context...
					var inline = false
					// inline browser or array...
					if(isWalkable(elem)){
						inline = true
						p = path
						children = elem

					// nested browser / array...
					} else if(!skipNested
							&& isWalkable(elem.children)){
						p = path.concat([elem_id])
						children = elem.children

					// normal element...
					} else {
						p = path.concat([elem_id]) 
						children = null
						doNested = null
					}

					return (
						// prepend nested elements on flat reverse...
						(children && reverse == 'flat' ?
							doNested(children)
							: [])
						// append the actual element...
						.concat(
							// NOTE: func MUST return an array...
							func.call(that, 
								// NOTE: for inline elements we do not need to 
								//		count the header as it's not present...
								inline ? i : i++, 
								p, 
								// NOTE: inlined sets have no header...
								inline ? null : elem, 
								doNested, 
								children))
						// append nested elements if not done so...
						.concat((!children || nested !== false) ? 
							[] 
							: doNested(children)) )
				})
				// XXX this here loses the length information we need in doNested(..)
				// 		to calc indexes...
				//.flat()
		}

		var res = walk(i, path, this.items)
		return options.root === this ?
			res.flat()
			: res
	},


	//
	//	Get list of nodes in tree...
	//	.walk2()
	//		-> list
	//
	//	Walk the tree passing each node to func(..)
	//	.walk2(func(..)[, options])
	//		-> list
	//
	//	Walk tree passing each node to func(..) using method name to 
	//	walk nested browsers...
	//	NOTE: 'walk2' is used as name if name is not present in the object...
	//	.walk2(func(..), name, args(..)[, options])
	//	.walk2(func(..), name, args(..), walkable(..)[, options])
	//		-> list
	//
	//	Walk tree passign each node to func(..) and handle nested browser 
	//	walking in recursion(..) optionally testing if walkable with walkable(..)
	//	.walk2(func(..), recursion(..)[, options])
	//		-> list
	//
	//
	//	func(node, index, path, next(..), stop(..), children)
	//		-> list
	//
	//	next(children)
	//		-> list
	//
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
	// NOTE: if recursion(..) is not given then .walk2(..) is used to 
	// 		handle nested children...
	// NOTE: if walkable(..) is not given then we check for .walk2(..)
	// 		availability...
	// NOTE: children arrays are handled internally...
	//
	//
	// XXX need to make this the same as .walk(..) from the user's 
	// 		perspective with one addition, expose the root stop(..) 
	// 		function to func...
	// XXX this uses a slightly different signature to func(..) that .walk(..) does...
	// XXX which of the forms should be documented in the signature???
	// 		NOTE: it does not matter which is used as we manually
	// 		parse arguments...
	// XXX passing both index directly and context containing index 
	// 		(context.index) feels excessive...
	// 		...if this can produce errors we need to simplify...
	// XXX add docs:
	// 		- maintaining context to implement/extend walkers...
	// 		- correctly stopping recursive calls (call root stop(..))
	// XXX can this be simpler???
	walk2: function(func, recursion, walkable, options){
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
			throw new Error(`.walk2(func, name, formArgs, ..): `
				+`expected function as third argument, got: ${formArgs}.`) }
		var walkable = (!formArgs 
				&& (args[0] instanceof Function 
					|| args[0] == null)) ?
			args.shift() 
			: null 
		options = args.shift() || {} 

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
						|| node.walk2 ) }

		return walk(
			function(state, node, next, stop){
				// keep only the root stop(..) -> stop the entire call tree...
				stop = context.stop = context.stop || stop

				// skip non-iterable items...
				if(!iterateNonIterable && node.noniterable){
					return state }

				var nested = false
				var doNested = function(list){
					// this can be called only once -> return cached results...
					if(nested !== false){
						return nested }

					// normalize...
					list = (list === true || list == null) ?
							children	
						: (!iterateCollapsed && node.collapsed) ?
							[]
						: list

					// call .walk2(..) recursively...
					var useWalk = function(){
						return list.walk2(
							func, 
							recursion, 
							...(formArgs instanceof Function ? 
								[formArgs] 
								: []), 
							walkable, 
							options, context) }

					return (list === false ?
								[]	
							// handle arrays internally...
							: list instanceof Array ?
								// NOTE: this gets the path and i from context...
								next('do', state, 
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
							// .walk2(..)
							: useWalk())
						// normalize and merge to state...
						.run(function(){
							nested = this instanceof Array ?
								this
								: [this]
							// merge...
							!(list === false || list instanceof Array)
								&& state.splice(state.length, 0, ...nested)
							return nested
						}) }

				// prepare context...
				var id = node.id || node.value
				var path = context.path = context.path || []
				var [inline, p, children] = 
					// inline...
					isWalkable(node) ?
						[true, path, node]
					// nested...
					: (!skipNested && isWalkable(node.children)) ?
						[false, 
							// update context for nested items...
							path.push(id) 
								&& path, 
							node.children]
					// leaf...
					: [false, path.concat([id]), undefined]

				// reverse -> do children...
				reverse == 'flat' 
					&& children
					&& doNested()
				// do element...
				state.splice(state.length, 0,
					...( func ? 
						(func.call(that, 
							...(inline ? 
								[null, context.index] 
								: [node, context.index++]),
							p, 
							doNested, 
							stop,
							children) || []) 
						: [node] ))
				// normal order -> do children...
				// NOTE: doNested(..) is executed only once so in reverse 
				// 		the call will have no effect, but we need to 
				// 		update the context...
				children
					&& (doNested(), 
						// restore path context...
						context.path.pop())

				return state
			}, 
			[], 
			// input items...
			...(reverse ? 
				this.items
					.slice()
					.reverse() 
				: this.items)) },


	// Text render...
	//
	// This is mainly here for doc/debug purposes...
	//
	// XXX rename this??
	text: function(options, context){
		var that = this

		return this
			.walk2(
				function(node, i, path){
					return node ? 
						path.slice(1)
							.map(e => '  ')
							.join('') + (node.value || node)
						: [] },
				'text',
				function(func, i, path, options, context){
					return [options, context] },
				options, 
				context)
			.join('\n') },
	paths: function(options, context){
		return this.walk2(
			function(n, i, p){
				return n 
					&& [(options || {}).joinPaths !== false ? 
						p.join('/') 
						: p] }, 
			'paths',
			function(_, i, path, options, context){
				// NOTE: for paths and indexes to be consistent between
				// 		levels we need to thread the context on, here and
				// 		into the base .walk2(..) call below...
				return [options, context] },
			options, 
			context) },


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
		options = args.shift() || {}
		options = !options.defaultReverse ?
			Object.assign({},
				options, 
				{ defaultReverse: 'flat' })
			: options
		var context = args.shift()

		return this.walk2(
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
			options,
			context) },


	// XXX EXPERIMENTAL...
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
	// XXX use diff
	// XXX add support for 'next'/'prev', ... keywords... (here or in .get(..)???)
	// XXX do we actually need to stop this as soon as we find something, 
	// 		i.e. options.firstOnly???
	search: function(pattern, func, options){
		var that = this

		// parse args...
		var args = [...arguments]
		pattern = args.shift() 
		pattern = pattern === undefined ? 
			true 
			: pattern
		func = (args[0] instanceof Function 
				|| args[0] === undefined) ? 
			args.shift() 
			: undefined
		options = args.shift() || {}
		var context = args.shift()

		// pattern -- normalize and pattern keywords...
		pattern = options.ignoreKeywords ?
				pattern
			: (pattern === 'all' || pattern == '*') ?
				true
			: pattern == 'first' ?
				0
			: pattern == 'last' ?
				-1
			: pattern == 'selected' ?
				{selected: true}
			: pattern == 'focused' ?
				{focused: true}
			: pattern

		// normalize negative index...
		if(typeof(pattern) == typeof(123) && pattern < 0){
			pattern = -pattern - 1
			options.reverse = 'flat'
		}

		// normalize/build the test predicate...
		// XXX add diff support...
		var test = (
			// all...
			pattern === true ?
				pattern
			// predicate...
			: pattern instanceof Function ?
				pattern
			// regexp...
			: pattern instanceof RegExp ?
				function(elem, i, path){
					return pattern.test(elem.value)
						|| pattern.test('/'+ path.join('/')) }
			// path...
			: pattern instanceof Array ?
				function(elem, i, path){
					return path.length > 0
						&& pattern.length == path.length
						&& !pattern
							// XXX add support for '**' ???
							.reduce(function(res, e, i){
								return res || !(
									e == '*' 
										|| (e instanceof RegExp 
											&& e.test(path[i]))
										|| e == path[i]) }, false) }
			// index...
			: typeof(pattern) == typeof(123) ?
				function(elem, i, path){
					return i == pattern }
			// object query...
			: function(elem){
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
							) }, true) } )

		return this.walk2(
			function(elem, i, path, _, stop){
				console.log('--', i, path.join('/'))
				// match...
				var res = (elem
						&& (test === true 
							|| test.call(this, elem, i, path))) ?
					[ func ?
						func.call(this, elem, i, path)
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
			options, 
			context)
	},


	// XXX EXPERIMENTAL...
	//
	// 	Get focused item...
	// 	.get()
	// 	.get('focused')
	// 		-> item
	// 		-> undefined
	//
	// 	Get next/prev item relative to focused...
	// 	.get('prev'[, offset][, options])
	// 	.get('next'[, offset][, options])
	// 		-> item
	// 		-> undefined
	//
	// 	Get first item matching pattern...
	// 	.get(pattern[, options])
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
	// XXX revise return value...
	get: function(pattern, options){
		var args = [...arguments]
		pattern = args.shift()
		pattern = pattern === undefined ? 
			'focused' 
			: pattern
		var offset = (pattern == 'next' || pattern == 'prev')
				&& typeof(args[0]) == typeof(123) ?
			args.shift()
			: 1
		options = args.pop() || {}

		// sanity checks...
		if(offset <= 0){
			throw new Error(`.get(..): offset must be a positive number, got: ${offset}.`)
		}

		var res = []
		var Stop = new Error('.get(..): found match.')

		try {
			// next + offset...
			pattern == 'next' ?
				this.search(true, 
					function(elem, i, path){
						if(elem.focused == true){
							res = offset + 1

						// get the offset item...
						} else if(res <= 0){
							res = [elem, i, path]
							throw Stop
						}
						// countdown to offset...
						res = typeof(res) == typeof(123) ? 
							res - 1 
							: res
					})
			// prev + offset...
			: pattern == 'prev' ?
				this.search(true, 
					function(elem, i, path){
						if(elem.focused == true){
							res = res.length >= offset ? 
								res[0] 
								: undefined
							throw Stop
						}
						// buffer the previous offset items...
						res.push([elem, i, path])
						res.length > offset
							&& res.shift()
					})
			// base case -> get first match...
			: this.search(pattern, 
				function(elem, i, path){
					res = [elem, i, path]
					throw Stop
				})

		} catch(e){
			// pass on other errors...
			if(e !== Stop){
				throw e
			}
			return res
		}
	},


	// XXX BROKEN...
	// Sublist map functions...
	//
	// XXX NOTE: these will return a sparse array... ???
	sublists: function(func, options){
		return this.search({children: true}, func, options) },
	// XXX broken, needs support for options.skipInlined ...
	nested: function(func){
		return this.sublists(func, {skipInlined: true}) },
	inlined: function(func){
		return this.sublists(func, {skipNested: true}) },

	next: function(){},
	prev: function(){},

	// XXX should there return an array or a .constructor(..) instance??
	// XXX should these call respective methods (.forEach(..), .filter(..), 
	// 		.reduce(..)) on the nested browsers???
	forEach: function(func, options){
		this.map(...arguments)
		return this },
	// XXX should we use a recursive .walk(..), .map(..) .filter(..) or 
	// 		try and make do with what is available in a child???
	filter: function(func, options){
		return this.walk(function(i, p, e, b){
			return e && func.call(this, e, i, p, b) ? [e] : [] }) },
		//return this.map(function(e, i, p, b){
		//	return func.call(this, e, i, p, b) ? [e] : [] })
		//.flat() },
	reduce: function(){},

	// XXX move these to a more logical spot...
	// XXX these are almost identical -- reuse???
	indexOf: function(item, options){
		item = typeof(item) == typeof('str') ?
			item.split(/[\\\/]/g)
			: item

		var Stop = new Error('.indexOf(..): Result found exception.')

		var i = 0
		try{
			this.map(function(e, p){
				if(item instanceof Array ? item.cmp(p) : (item === e)){
					throw Stop }
				i++
			}, options)

		} catch(e){
			if(e === Stop){
				return i
			}
		}
		return -1
	},
	pathOf: function(item, options){
		var Stop = new Error('.pathOf(..): Result found exception.')

		var path
		var i = 0
		try{
			this.map(function(e, p){
				path = p
				if(typeof(item) == typeof(123) ? item == i : (item === e)){
					throw Stop }
				i++
			}, options)

		} catch(e){
			if(e === Stop){
				return path
			}
		}
		return undefined
	},

	// Like .get(.., {iterateCollapsed: true}) but will expand all the 
	// path items to reveal the target...
	// XXX should this return the item or this???
	reveal: function(key, options){
		// get the item...
		var res = this.get(key, Object.assign({iterateCollapsed: true}, options))

		// expand the path up...
		var cur = res.parent
		while(cur && cur.parent instanceof Browser){
			delete (cur.parent.item_key_index[cur.id]
				|| cur.parent.items
					.filter(function(e){ 
						return e.children === cur })
				.shift()).collapsed
			cur = cur.parent }

		// re-render...
		this.render()

		return res
	},


	//
	//	.find(id[, options])
	//	.find(index[, options])
	//	.find(path[, options])
	//	.find(func[, options])
	//		-> list
	//
	// XXX add '**' patterns...
	// XXX should this return item paths???
	// 		...one way to do this is to return an object instead of a list...
	find: function(query, options){
		query = typeof(query) == typeof('str') ?
			query.split(/[\\\/]/g)
				.filter(function(e){ return e.length > 0 })
			: query
		query = typeof(query) == typeof('str') ?
			[query]
			: query
		query = query instanceof Array ?
			query
				.map(function(d){
					return d == '*' ?
							d
						: d.indexOf('*') >= 0 ?
							new RegExp(d
								.replace(/\*/g, '.*'))
						: d})
			: query

		var i = -1
		return this
			.filter(function(e, p){
				i++
				return (query === e
					|| (
						// index...
						typeof(query) == typeof(123) ?
							query == i
						// predicate...
						: query instanceof Function ?
							// XXX revise signature...
							query.call(this, e, p, i, this)
						// regular expression...
						: query instanceof RegExp ?
							query.test(p.join('/'))
						// direct path comparison...
						: query instanceof Array ?
							query.cmp(p)
							|| (query.length == p.length
								&& query
									.filter(function(q, i){
										return q == '*' 
											|| (q instanceof RegExp 
												&& q.test(p[i]))
											|| q == p[i] })
									.length == p.length)
						: false)) }, options) },

	// XXX support: up/down/left/right/first/last/next/prev
	// XXX extend support for screen oriented nav in a subclass...
	navigate: function(direction){
		// XXX get then return element...
	},



	// XXX do we need edit ability here? 
	// 		i.e. .set(..), .remove(..), .sort(..), ...
	// 		...if we are going to implement editing then we'll need to 
	// 		callback the user code or update the user state...



	// Make .items and .item_key_index...
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
	// NOTE: each call to this will reset both .items and .item_key_index
	// NOTE: for items with repeating values there is no way to correctly 
	// 		identify an item thus no state is maintained between .make(..)
	// 		calls for such items...
	//
	// XXX revise options handling for .__list__(..)
	make: function(options){
		options = Object.assign(Object.create(this.options || {}), options || {})

		var items = this.items = []
		var old_index = this.__item_index || {}
		var new_index = this.__item_index = {} 

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
		var make_called = false
		var make = function(value, opts){
			make_called = true

			// special-case: inlined browser...
			//
			// NOTE: we ignore opts here...
			// XXX not sure if this is the right way to go...
			// 		...for removal just remove the if statement and its
			// 		first branch...
			if(value instanceof Browser){
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
				var id_changed = (old_index[key] || {}).id_changed

				// handle duplicate ids -> err if found...
				if(opts.id && opts.id in new_index){
					throw new Error(`make(..): duplicate id "${key}": `
						+`can't create multiple items with the same key.`) }
				// handle duplicate keys...
				// NOTE: we can't reuse an old copy when re-making the list
				// 		because there is now way to correctly identify an 
				// 		object when it's id is tweaked (and we can not rely
				// 		on item order)...
				// 		...for this reason all "persistent" state for such 
				// 		an element will be lost when calling .make(..) again
				// 		and re-making the list...
				// 		a solution to this would be to manually assign an .id 
				// 		to such elements in .__list__(..)...
				// 		XXX can we go around this without requiring the user 
				// 			to manage ids???
				var k = key
				while(k in new_index){
					// duplicate keys disabled...
					if(options.noDuplicateValues){
						throw new Error(`make(..): duplicate key "${key}": `
							+`can't create multiple items with the same key.`) }

					// mark both the current and the first items as id-mutated...
					opts.id_changed = true
					new_index[key].id_changed = true

					// create a new key...
					k = this.__id__(key)
				}
				key = opts.id = k

				// build the item...
				var item = Object.assign(
					Object.create(options || {}), 
					// get the old item values (only for non duplicate items)...
					id_changed ?
						{}
						: old_index[key] || {},
					// XXX inherit from this...
					opts,
					{
						parent: this,
					})

				// XXX do we need both this and the above ref???
				item.children instanceof Browser
					&& (item.children.parent = this)
			}

			// store the item...
			items.push(item)
			new_index[key] = item

			return make
		}.bind(this)
		make.__proto__ = Items
		make.dialog = this
		make.items = items

		//var res = this.__list__(make)
		// XXX not sure about this -- options handling...
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

		return this
	},


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
	//	.render(options[, renderer])
	//	.render(context[, renderer])
	//		-> state
	//
	//
	// context format:
	// 	{
	// 		root: <root-browser>,
	// 		options: <options>,
	// 	}
	//
	//
	// options:
	// 	{
	// 		nonFinalized: <bool>,
	//
	//		// for more supported options see: .walk(..)
	// 		...
	// 	}
	//
	//
	// NOTE: it is not recommended to extend this. all the responsibility
	// 		of actual rendering should lay on the renderer methods...
	// NOTE: calling this will re-render the existing state. to re-make 
	// 		the state anew that use .update(..)...
	// NOTE: currently options and context are distinguished only via 
	// 		the .options attribute...
	//
	// XXX would be nice to add ability to do a full render but not 
	// 		finalize the result...
	// XXX BUG: calling .render() removes all non-iterable items for some reason...
	render: function(options, renderer){
		var that = this
		// XXX Q: should options and context be distinguished only via 
		// 		the .options attr as is the case now???
		// 		...see no reason why not, though it does not feel right...
		var context = (options == null || options.options == null) ?
				{
					root: this,
					// NOTE: we are not combining this with .options as nested 
					// 		lists can have their own unique sets of options 
					// 		independently of the root list...
					//options: options || this.options || {},
					options: Object.assign(
						Object.create(this.options || {}),
						// defaults...
						// XXX is this the correct way to setup defaults???
						{ iterateNonIterable: true }, 
						options || {}),
				}
			: options
		options = context.options
		renderer = renderer || this

		// XXX should we control render parameters (range, start, end, ...)
		// 		from outside render and pass this info down to nested lists???
		// 		...if yes how??
		// 			- options
		// 			- arg threading
		var items = this
			.walk(
				function(i, path, item, nested, children){
					return (
						// inline...
						(item == null && children) ?
							// NOTE: here we are forcing rendering of the 
							// 		inline browser/list, i.e. ignoring 
							// 		options.skipNested for inline stuff...
							// NOTE: we here do not distinguish between
							// 		inlined lists and browsers... (XXX ???)
							[ renderer.renderGroup(nested(true), context) ]
						// nested...
						: children ?
							[ renderer.renderNested(
								renderer.renderNestedHeader(item, i, context),
								nested(),
								item, 
								context) ]
						// normal item...
						: [ renderer.renderItem(item, i, context) ] ) },
				function(func, i, path, children, options){
					return children.render(context, renderer, i, path) },
				// make the element render less strict...
				function(elem){
					return elem 
						&& elem.render instanceof Function },
				// pass on i and path if given...
				...[...arguments].slice(2),
				options)

		// determine the render mode...
		return (!options.nonFinalized && context.root === this) ?
			// root context -> render list and return this...
			renderer.renderFinalize(items, context)
			// nested context -> return item list...
			: items
	},
	

	// Update state (make then render)...
	//
	// 	.update()
	// 		-> state
	//
	update: function(options){
		return this
			.make(options)
			.render(options) },


	// XXX should these be moved to the HTML class...

	// Events...
	//
	// Format:
	// 	{
	// 		// XXX add tagged event support...
	// 		<event-name>: [
	// 			<handler>,
	// 			...
	// 		],
	// 		...
	// 	}
	//
	// XXX
	__event_handlers: null,

	// generic event infrastructure...
	// XXX add support for tagged events...
	// XXX should these be defined on this level or should we use DOM???
	// XXX add support for item events...
	// 		e.g. item.focus(..) -> root.focus(..)
	// XXX also need to design a means for this system to interact both 
	// 		ways with DOM events...
	// XXX need to bubble the event up through the nested browsers...
	on: function(evt, handler){
		var handlers = this.__event_handlers = this.__event_handlers || {}
		handlers = handlers[evt] = handlers[evt] || []
		handlers.push(handler)
		return this
	},
	one: function(evt, handler){
		var func = function(...args){
			handler.call(this, ...args)
			this.off(evt, func)
		}
		this.on(evt, func)
		return this
	},
	off: function(evt, handler){
		// remove all handlers
		if(handler == '*' || handler == 'all'){
			delete (this.__event_handlers || {})[evt]

		// remove only the specific handler...
		} else {
			var handlers = (this.__event_handlers || {})[evt] || []
			do{
				var i = handlers.indexOf(handler)
				i > -1
					&& handlers.splice(i, 1)
			} while(i > -1)
		}
		return this
	},
	trigger: function(evt, ...args){
		var that = this
		var stopPropagation = false
		var evt = typeof(evt) == typeof('str') ?
			// XXX construct this in one place...
			// 		...currently it is constructed here and in makeEventMethod(..)
			{
				name: evt,
				stopPropagation: function(){
					stopPropagation = true },
			}
			: evt

		// call the main set of handlers...
		;((this.__event_handlers || {})[evt.name] || [])
			// prevent .off(..) from affecting the call loop...
			.slice()
			.forEach(function(handler){
				handler.call(that, evt, ...args) })

		// trigger the parent's event...
		!stopPropagation
			&& this.parent
			&& this.parent.trigger(evt, ...args)

		return this
	},


	// domain events/actions...
	// XXX need a way to extend these to:
	// 		- be able to trigger an external (DOM) event...
	// 		- be able to be triggered from an external (DOM) event...
	focus: makeItemEventMethod('focus', function(evt, items){
		// NOTE: if we got multiple matches we care only about the last one...
		var item = items.pop()

		if(!item){
			return
		}

		// blur .focused...
		this.focused
			&& this.blur(this.focused)

		item.focused = true
	}),
	blur: makeItemEventMethod('blur', function(evt, items){
		items.forEach(function(item){
			delete item.focused }) }),
	// XXX update this.selected in a more granular way...
	select: makeItemEventMethod('select', function(evt, items){
		items.forEach(function(item){
			item.selected = true
			// XXX update this.selected in a more granular way...
			delete this.__selected
		}) }),
	deselect: makeItemEventMethod('deselect', function(evt, item){
		items.forEach(function(item){
			delete item.selected
			// XXX update this.selected in a more granular way...
			delete this.__selected
		}) }),

	open: makeItemEventMethod('open', function(evt, item){}),
	enter: makeItemEventMethod('enter', function(evt, item){}),
	// XXX can/should we unify these???
	collapse: makeItemEventMethod('collapse', function(evt, item){}),
	expand: makeItemEventMethod('expand', function(evt, item){}),

	// XXX target can be item or path...
	load: makeEventMethod('load', function(evt, item){}),

	close: makeEventMethod('close', function(evt, reason){}),
	

	// XXX should we update on on init....
	__init__: function(func, options){
		this.__list__ = func
		this.options = Object.assign(
			{}, 
			this.options || {}, 
			options || {})

		// XXX should this be here or should this be optional???
		//this.update()
	},
}


var BaseBrowser = 
module.BaseBrowser = 
object.makeConstructor('BaseBrowser', 
		BaseBrowserClassPrototype, 
		BaseBrowserPrototype)



//---------------------------------------------------------------------

var BrowserClassPrototype = {
	__proto__: BaseBrowser,
}

// XXX TODO:
// 		- need a way to update some stuff on .update() / .make() -- a way 
// 			to selectively merge the old state with the new...
// 		- event handler signature -- pass the item + optionally render...
// 		- keyboard handling...
// XXX render of nested lists does not affect the parent list(s)...
// 		...need to render lists and items both as a whole or independently...
// XXX should this use vanilla DOM or jQuery???
// XXX add a left button type/option -- expand/collapse and friends...
var BrowserPrototype = {
	__proto__: BaseBrowser.prototype,

	options: {
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
		// 		['html', <handler>],
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
	},

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
		dom && (this.dom = dom)
	},

	// browser dom...
	get dom(){
		return this.__dom },
	set dom(value){
		this.container 
			&& (this.__dom ?
				this.container.replaceChild(value, this.__dom) 
				: this.container.appendChild(value))
		this.__dom = value },


	// Element renderers...
	//
	// This does tow additional things:
	// 	- save the rendered state to .dom 
	// 	- wrap a list of nodes (nested list) in a div
	//
	// Format:
	// 	if list of items passed:
	// 		<div>
	// 			<!-- items -->
	// 			...
	// 		</div>
	// 	or same as .renderList(..)
	//
	// XXX revise...
	renderFinalize: function(items, context){
		var d = this.renderList(items, context)

		// wrap the list (nested list) of nodes in a div...
		if(d instanceof Array){
			var c = document.createElement('div')
			d.forEach(function(e){
				c.appendChild(e) })
			d = c
		}

		this.dom = d
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
	// XXX instrument interactions...
	// XXX register event handlers...
	renderList: function(items, context){
		var that = this
		var options = context.options || this.options

		// dialog (container)...
		var dialog = document.createElement('div')
		dialog.classList.add('browse-widget')
		dialog.setAttribute('tabindex', '0')

		// header...
		options.hideListHeader
			|| dialog.appendChild(this.renderListHeader(context))

		// list...
		var list = document.createElement('div')
		list.classList.add('list', 'v-block')
		items
			.forEach(function(item){
				list.appendChild(item instanceof Array ? 
					that.renderGroup(item) 
					: item) })
		dialog.appendChild(list)

		// XXX event handlers...
		// XXX

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
	// XXX register event handlers...
	renderNested: function(header, children, item, context){
		var that = this
		var options = context.options || this.options

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
		// XXX should this add the items to a container???
		: children instanceof Array ?
			children
				.forEach(function(item){
					e.appendChild(item) })
		: null

		// XXX event handlers... (???)
		// XXX

		item.dom = e

		return e
	},
	// NOTE: this is the similar to .renderItem(..)
	// XXX make collapse action overloadable....
	renderNestedHeader: function(item, i, context){
		var that = this
		return this.renderItem(item, i, context)
			// update dom...
			.run(function(){
				// class...
				// XXX should be done here or in the config???
				this.classList.add('sub-list-header', 'traversable')
				item.collapsed
					&& this.classList.add('collapsed')

				// collapse action handler...
				// XXX make this overloadable...
				$(this).on('open', function(evt){
					item.collapsed = !item.collapsed
					that.render(context)
				})
			}) },
	//
	// Format:
	// 	<div class="group">
	// 		..
	// 	</div>
	//
	// XXX this does not seem to get called by .render(..)...
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
	// XXX add custom events:
	// 		- open
	// 		- select
	// 		- update
	renderItem: function(item, i, context){
		var options = context.options || this.options
		if(options.hidden && !options.renderHidden){
			return null
		}

		// special-case: item shorthands...
		if(item.value in options.elementShorthand){
			// XXX need to merge and not overwrite -- revise...
			Object.assign(item, options.elementShorthand[item.value])

			// NOTE: this is a bit of a cheat, but it saves us from either 
			// 		parsing or restricting the format...
			var elem = item.dom = $(item.html)[0]
			elem.classList.add(
				...(item['class'] instanceof Array ?
					item['class']
					: item['class'].split(/\s+/g)))

			return elem 
		}

		// Base DOM...
		var elem = document.createElement('div')
		var text = this.__value2key__(item.value || item)

		// classes...
		elem.classList.add(...['item']
			// user classes...
			.concat(item['class'] || item.cls || [])
			// special classes...
			.concat([
				'selected',
				'disabled',
				'hidden',
			].filter(function(cls){ 
				return !!item[cls] })))

		// attrs...
		item.disabled
			|| elem.setAttribute('tabindex', '0')
		Object.entries(item.attrs || {})
			.forEach(function([key, value]){
				elem.setAttribute(key, value) })
		elem.setAttribute('value', text)

		// values...
		text
			&& (item.value instanceof Array ? item.value : [item.value])
				// XXX handle $keys and other stuff...
				.map(function(v){
					var value = document.createElement('span')
					value.classList.add('text')
					value.innerHTML = v || item || ''
					elem.appendChild(value)
				})

		// events...
		// XXX revise signature...
		elem.addEventListener('click', 
			function(){ $(elem).trigger('open', [text, item, elem]) })
		//elem.addEventListener('tap', function(){ $(elem).trigger('open', [text, item, elem]) })
		Object.entries(item.events || {})
			// shorthand events...
			.concat([
					'click',
				].map(function(evt){ 
					return [evt, item[evt]] }))
			// setup the handlers...
			.forEach(function([evt, handler]){
				handler
					&& elem.addEventListener(evt, handler) })

		// buttons...
		// XXX migrate the default buttons functionality and button inheritance...
		var buttons = (item.buttons || options.itemButtons || [])
			.slice()
			// NOTE: keep the order unsurprising...
			.reverse()
		var stopPropagation = function(evt){ evt.stopPropagation() }
		buttons
			.forEach(function([html, handler]){
				var button = document.createElement('div')
				button.classList.add('button')
				button.innerHTML = html
				if(!item.disabled){
					button.setAttribute('tabindex', '0')
					;(options.buttonLocalEvents || options.localEvents || [])
						.forEach(function(evt){
							button.addEventListener(evt, stopPropagation) })
					handler
						&& button.addEventListener('click', handler)
				}
				elem.appendChild(button)
			})
		
		item.dom = elem

		return elem 
	},


	// Custom events...
	// XXX do we use jQuery event handling or vanilla?
	// 		...feels like jQuery here wins as it provides a far simpler
	// 		API + it's a not time critical area...
	// 		....another idea is to force the user to use the provided API
	// 		by not implementing ANY direct functionality in DOM -- I do
	// 		not like this idea at this point as it violates POLS...
	//open: function(func){},

	//filter: function(){},

	//select: function(){},
	//get: function(){},
	//focus: function(){},

	// Navigation...
	//
	up: function(){},
	down: function(){},
	left: function(){},
	right: function(){},

	next: function(){},
	prev: function(){},

	collapse: function(){},
	// XXX scroll...


}


// XXX should this be a Widget too???
var Browser = 
module.Browser = 
object.makeConstructor('Browser', 
		BrowserClassPrototype, 
		BrowserPrototype)



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
		valueSeparator: ' ',
		renderIndent: '\t',
	},
	
	// NOTE: we do not need .renderGroup(..) here as a group is not 
	// 		visible in text...
	renderList: function(items, options){
		var that = this
		return this.renderNested(null, items, null, null, options)
			.join('\n') },
	renderItem: function(item, i, options){
		var value = item.value || item
		value = value instanceof Array ? 
			value.join(this.options.valueSeparator || ' ')
			: value
		return item.current ?
			`[ ${value} ]`
   			: value },
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
					'- ' + header,
					nested,
				]
			// collapsed...
			: header ?
				[ '+ ' + header ]
			// headerless...
			: nested )},
}

var TextBrowser = 
module.TextBrowser = 
object.makeConstructor('TextBrowser', 
		TextBrowserClassPrototype, 
		TextBrowserPrototype)




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
