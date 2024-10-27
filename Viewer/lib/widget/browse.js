/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/


//var promise = require('promise')

var toggler = require('../toggler')
var keyboard = require('../keyboard')
var object = require('../object')
var widget = require('./widget')



/*********************************************************************/
// Helpers...

// Quote a string and convert to RegExp to match self literally.
// XXX this depends on jli.quoteRegExp(..)
function toRegExp(str){
	return RegExp('^'
		// quote regular expression chars...
		+quoteRegExp(str)
		//+str.replace(/([\.\\\/\(\)\[\]\$\*\+\-\{\}\@\^\&\?\<\>])/g, '\\$1')
		+'$')
}


function makeBrowserMaker(constructor){
	return function(elem, list, rest){
		if(typeof(rest) == typeof('str')){
			return constructor(elem, { data: list, path: rest })

		} else {
			var opts = {}
			for(var k in rest){
				opts[k] = rest[k]
			}
			opts.data = list
			return constructor(elem, opts)
		}
	}
}


function makeSimpleAction(direction){
	return function(elem){
		if(elem != null){
			this.select(elem)
		}
		this.navigate(direction)
		return this
	}
}



/*********************************************************************/
// Collections of helpers...
//
// NOTE: from a design perspective all of these constructors can and 
// 		will be called on each refresh, so maintaining state should if
// 		state is needed should be done outside of the actual call.
// 		For this reason closures can be used but only for state 
// 		relevant within a single call.
// 		So the possible ways to store the outer state:
// 			- threaded through the arguments
// 				Example:
// 					first argument of make.EditableList(..)
// 			- make.dialog attributes
// 				Example:
// 					temporary state of make.EditableList(..)
// 			- config
// 				this requires that the config is saved and maintained 
// 				by the caller
// 				This approach is not recommended.
//
//
//---------------------------------------------------------------------
// NOTE: all item constructors/helpers abide by either the new-style 
// 		make protocol, i.e. make(content[, options]) or their own...
var Items = 
module.items = 
module.Make = function(){}

// Empty list place holder...
//
// XXX should this be in CSS???
Items.Empty = 
function(msg, options){
	options = options || {}
	options.disabled = options.disabled !== undefined ? 
		options.disabled 
		: true
	options.hide_on_search = options.hide_on_search !== undefined ?
		options.hide_on_search
		: true
	options.cls = (options.cls || '') + ' empty-msg'
	msg = msg || options.message || 'Empty...'
	return this(msg, options) }


// NOTE: this is the same as make('---'[, options])
Items.Separator = 
function(options){
	return this('---', options) }

// NOTE: this is the same as make('...'[, options])
Items.Spinner = 
function(options){
	return this('...', options) }

// Heading...
//
// options format:
// 	{
// 		doc: <text>,
//
// 		...
// 	}
//
Items.Heading = 
function(text, options){
	options = Object.create(options || {})
	options.cls = (options.cls || '') + ' heading'
	var attrs = options.doc ? {doc: options.doc} : {}
	attrs.__proto__ = options.attrs || {}
	options.attrs = attrs
	return this(text, options) }

// Action...
//
// XXX should this have a callback???
Items.Action = 
function(text, options){
	options = Object.create(options || {})
	options.cls = (options.cls || '') + ' action'
	return this(text, options) }

// Action requiring confirmation...
//
// options format:
// 	{
// 		// A callback to be called when action is confirmed...
// 		callback: <function>,
//
// 		// Time (ms) to wait for confirm before resetting...
// 		timeout: '2000ms',
//
// 		// Text to use as confirm message...
// 		//
// 		// Supported placeholders:
// 		//	${text}		- item text
// 		//	${text:l}	- item text in lowercase
// 		//	${text:u}	- item text in uppercase
// 		//	${text:c}	- item text capitalized
//		//
// 		confirm_text: 'Confirm ${text}?',
//
// 		...
// 	}
//
// XXX doc...
// XXX refactor to use options instead of elem modification...
Items.ConfirmAction = 
function(text, options){
	options = options || {}

	var elem = this.Action(text, options)

	var callback = options.callback
	var timeout = options.timeout || 2000
	var confirm_text = (options.confirm_text || 'Confirm ${text:l}?') 
		.replace(/\$\{text\}/, text)
		.replace(/\$\{text:l\}/, text.toLowerCase())
		.replace(/\$\{text:u\}/, text.toUpperCase())
		.replace(/\$\{text:c\}/, text.capitalize())

	return elem 
		.on('open', function(){
			var item = $(this)
			var elem = item.find('.text')

			// ready to delete...
			if(elem.text() != confirm_text){
				text = elem.text()

				elem.text(confirm_text)

				item.addClass('warn')

				// reset...
				setTimeout(function(){
					elem.text(text)

					item.removeClass('warn')
				}, timeout)

			// confirmed...
			} else {
				callback && callback() } }) }

// Item with auto selected text on select...
//
// options format:
// 	{
// 		// XXX make this generic, something like cls: ...
// 		action: false,
//
// 		select_text: <number> | 'first' | 'last' | <selector>,
//
// 		...
// 	}
//
// NOTE: this need selection enabled in CSS...
Items.Selected =
function(text, options){
	var elem = (options.action ? this.Action : this).call(this, text, options)
		.on('select', function(){
			var text = elem.find('.text')

			// get the specific .text element...
			text = 
				// select index...
				typeof(options.select_text) == typeof(123) ?
					text.eq(options.select_text)
				// first/last
				: (options.select_text == 'first' || options.select_text == 'last') ?
					text[options.select_text]()
				// selector...
				: typeof(options.select_text) == typeof('str') ?
					elem.find(options.select_text)
				// all...
				: text

			text.selectText()
		})
	return elem }

// Editable item or it's part...
//
// options format:
// 	{
//		// show as action (via. .Action(..))
// 		action: <bool>,
//
// 		// if true, set multi-line mode...
// 		//
// 		// (see: util.makeEditable(..) for more info)
// 		multiline: false,
//
// 		// .text element index to edit...
//		//
// 		// NOTE: by default this will select all the elements, if there
// 		//		are more than one, this may result in an odd element 
// 		//		state...
// 		// NOTE: the selector is used to filter text elements...
// 		edit_text: <number> | 'first' | 'last' | <selector>,
//
// 		// item event to start the edit on...
// 		start_on: 'select',
//
// 		// if true, trigger abort on deselect...
// 		abort_on_deselect: true,
//
//		// If true, clear text when item is selected...
//		//
// 		// (see: util.makeEditable(..) for more info)
//		clear_on_edit: false,
//
//		// Keep item selection after abort/commit...
//		keep_selection: true,
//
//		// Events to stop propagating up...
//		//
//		// This is useful to prevent actions that start should an edit 
//		// from triggering something else in the dialog...
//		//
//		// If false, nothing will get stopped...
//		stop_propagation: 'open',
//
// 		// Called when editing is abrted... 
// 		editaborted: <func(new-text)>,
//
// 		// Called when editing is done...
// 		editdone: <func>,
//
// 		...
// 	}
//
// XXX add option to select the element on start or just focus it...
Items.Editable =
function(text, options){
	options = options || {}
	var dialog = this.dialog
	var start_on = options.start_on || 'select'
	var stop_propagation = options.stop_propagation === false ? false : 'open'
	var keep_selection = options.keep_selection === undefined ? true : false

	var getEditable = function(){
		var editable = elem.find('.text')
		// get the specific .text element...
		// index...
		return typeof(options.edit_text) == typeof(123) ? 
				editable.eq(options.edit_text)
			// first/last...
			: (options.edit_text == 'first' || options.edit_text == 'last') ?
				editable[options.edit_text]()
			// selecter...
			: typeof(options.edit_text) == typeof('str') ?
				editable.filter(options.edit_text)
			// all...
			: editable }

	var elem = (options.action ? this.Action : this).call(this, text, options)
		.on(start_on, function(evt){
			event && event.preventDefault()

			// edit the element...
			var editable = getEditable()
				//.makeEditable({
					//activate: true,
					//blur_on_abort: false,
					//blur_on_commit: false,
					//multiline: options.multiline,
					//clear_on_edit: options.clear_on_edit,
					//reset_on_commit: options.reset_on_commit === undefined ?
					//	true
					//	// XXX need to take this from .makeEditable(..) defaults
					//	: options.reset_on_commit,
					//reset_on_abort: options.reset_on_abort === undefined ?
					//	true
					//	// XXX need to take this from .makeEditable(..) defaults
					//	: options.reset_on_abort,
				//)
				// XXX check if shadowing attrs between .Editable(..) and 
				// 		util.makeEditable(..) can be a problem...
				.makeEditable(Object.assign({
					activate: true,
					blur_on_abort: false,
					blur_on_commit: false,
				}, options))

			!keep_selection
				// deselect on abort/commit...
				&& editable
					.on('blur', function(){ dialog.select(null)	})

			// deselect on abort -- if we started with a select...
			start_on == 'select' 
				&& editable
					.on('edit-abort', function(){ dialog.select(null) })
			
			// edit event handlers...
			options.editaborted
				&& editable.on('edit-abort', options.editaborted)
			options.editdone
				&& editable.on('edit-commit', options.editdone)
		})
		.on('deselect', function(){
			//editable && editable.trigger(
			var editable = getEditable()
				// XXX need to pass the text....
			editable
				.trigger(
					options.abort_on_deselect !== false ? 'edit-abort' : 'edit-commit', editable.text())
		})
	
	options.multiline
		&& getEditable()
			.css('white-space', 'pre-line')

	stop_propagation
		&& elem
			.on(stop_propagation, function(e){ e.stopPropagation() })

	return elem }



//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Group items...
//
// 	.Group([<item>, ...])
// 		-> <group>
//
// This will return a group element, to get the items use .children()
//
//
// Usage example:
// 		make.Group([
//			make.Heading('Group'),
//			make('---'),
//			make('Group item'),
//			...
//		])
//
Items.Group =
function(list){
	var res = []
	list.forEach(function(e){ 
		e instanceof jQuery ? (res = res.concat(e.toArray()))
			: e instanceof Array ? (res = res.concat(e))
			: res.push(e)
	})
	var group = $('<div>')
		.addClass('item-group')
		.appendTo($(res).parent())
		.append($(res))
	return group }


// List of elements...
//
//
// data format:
//	[
//		// single text element...
//		<item-text>,
//
//		// multi-text element...
//		[<item-text>, ...],
//
//		...
//	]
//
// or:
// 	{
// 		<item-lext>: <function>,
// 	}
//
//
// options format:
// 	{
// 		// test if item is disabled/hidden... 
//		//
// 		// NOTE: if this is a string or regexp, this is used via 
// 		//		.replace(..) so the match will get removed from the item 
// 		//		text, unless prevented via regexp.
// 		isItemDisabled: <pattern> | <function>,
// 		isItemHidden: <pattern> | <function>,
//
// 		// if true, disabled/hidden items will not get created...
// 		skipDisabledItems: false,
// 		skipHiddenItems: false,
//
// 		// if true, group the items into a <span> element...
// 		groupList: false,
//
// 		// process each dom element...
// 		each: <function>,
//
// 		// if true disable all items, if list then disable all items 
// 		// from that list...
// 		disabled: <bool> | [ <item>, ... ],
//
// 		// see: make(..) for additional option info.
// 		...
// 	}
//
Items.List =
function(data, options){
	var make = this
	var res = []
	var keys = data instanceof Array ? data : Object.keys(data)
	options = options || {}

	var predicates = {
		disabled: typeof(options.isItemDisabled) == typeof('str') ?
			RegExp(options.isItemDisabled) 
			: options.isItemDisabled,
		hidden: typeof(options.isItemHidden) == typeof('str') ?
			RegExp(options.isItemHidden) 
			: options.isItemHidden,
	}

	keys.forEach(function(k){
		var txt
		var opts = Object.create(options)

		Object.keys(predicates).forEach(function(p){
			var test = predicates[p]

			if(test){
				// check only the first item...
				txt = txt || (k instanceof Array ? k[0] : k)

				// item passes disabled predicate...
				if(test instanceof Function 
						&& test(txt)){
					opts[p] = true

				// item matches disabled test...
				} else if(test instanceof RegExp 
						&& test.test(txt)){
					var t = txt.replace(test, '')

					opts.disabled = true

					txt = k instanceof Array ? 
						[t].concat(k.slice(1)) 
						: t

				// no match -- restore text...
				} else {
					txt = k } } })

		if(opts.disabled && opts.disabled instanceof Array){
			opts.disabled = opts.disabled.indexOf(txt || k) >= 0 }

		if((opts.disabled && opts.skipDisabledItems) 
				|| (opts.hidden && opts.skipHiddenItems)){
			return }

		var elem = make(txt || k, opts)

		keys !== data && data[k]
			&& elem.on('open', data[k])

		opts.each
			&& opts.each.call(elem, txt || k)

		res.push(elem[0]) })

	return options.groupList ?
		make.Group(res).children()
		: $(res) }


// Editable list of elements...
//
// This is like .List(..) but adds functionality to add, remove and 
// manually sort list items.
// 
// 	Show list items...
// 	.EditableList([ <item>, .. ])
// 	.EditableList([ <item>, .. ], <options>)
// 		-> <items>
//
// 	Show object keys...
// 	NOTE: editing buttons are disabled.
// 	.EditableList({ <item>: <value>, .. })
// 	.EditableList({ <item>: <value>, .. }, <options>)
// 		-> <items>
//
// 	Show list provided via getter/setter function items...
// 	.EditableList(<func>)
// 	.EditableList(<func>, <options>)
// 		-> <items>
//
// This will edit the input list in-place but only when closing the dialog.
//
//
// options format:
// 	{
// 		// List identifier, used when multiple lists are drawn in one 
// 		// dialog...
// 		//
// 		// NOTE: if multiple editable lists are drawn this is required.
// 		list_id: <text>,
//
// 		// If true (default), display the "new..." item, if string set 
// 		// it as item text...
// 		new_item: <text>|<bool>,
//
// 		place_new_item: null | 'end' | 'start',
//
// 		// If true (default), enable direct editing of items...
// 		//
// 		editable_items: <bool>,
//
// 		// Keys to trigger item edit...
//		//
// 		// default: [ 'F2' ]
// 		//
// 		// NOTE: the keyboard settings are global to dialog, if multiple 
// 		//		editable lists are defined they mess things up.
// 		item_edit_keys: [ <key>, ... ],
// 		item_edit_events: 'menu',
//
// 		length_limit: <number>,
//
// 		// Item edit event handler...
// 		//
// 		itemedit: function(evt, from, to){ ... },
//
// 		// If true allow saving and triggering options.itemedit(..) on an
// 		// empty value after editing the item... (default: null)
// 		//
// 		// NOTE: this will not save the empty value (see .Editable(..))
// 		//		this will only trigger the handler on an empty value...
// 		allow_empty: null | <bool>,
//
//		// Item open event handler...
//		//
//		// NOTE: this is simpler that binding to the global open event 
//		//		and filtering through the results...
//		itemopen: function(evt, value){ ... },
//
// 		// Check input value...
// 		check: function(value){ ... },
//
// 		// Normalize new input value...
// 		//
// 		// NOTE: this will replace the input with normalized value.
// 		normalize: function(value){ ... },
//
// 		// If true only unique values will be stored...
// 		//
// 		// If a function this will be used to normalize the values before
// 		// uniqueness check is performed...
// 		//
// 		// NOTE: if this is a function the value returned is only used 
// 		//		for uniqueness checking and will not be stored.
// 		unique: <bool> | function(value){ ... },
//
// 		// called when new item is added to list...
//		//
// 		itemadded: function(value){ ... },
//
// 		// If true sort values...
// 		// If function will be used as cmp for sorting...
// 		sort: <bool> || function(a, b){ ... },
//
// 		// Make list sortable...
// 		//
// 		// This can be:
// 		//	true	- enable sort (both x and y axis)
// 		//	'y'		- sort only in y axis
// 		//	'x'		- sort only in x axis
// 		//	false	- disable
// 		//
// 		// NOTE: this will force .groupList to true.
// 		// NOTE: this depends on jquery-ui's Sortable...
// 		sortable: false,
//
// 		// This is called when a new value is added via new_item but 
// 		// list length limit is reached...
// 		overflow: function(selected){ ... },
//
// 		// predicate to test if an item is to be removed...
// 		remove: null | function(item){ ... },
//
// 		// list of items to remove, if not given this will be maintained 
// 		// internally
// 		to_remove: null | <list>,
//
// 		// Merge list state and external list mode on update...
// 		//
// 		// This can be:
// 		//	'keep_changes'	- keep dialog state, ignore external state (default)
// 		//	null			- same as 'keep_changes'
// 		//	'drop_changes'	- replace dialog state with input state
// 		//	'merge'			- merge dialog state and input state
// 		//	'live'			- live edit
// 		//	<function>		- merge the changes
//		//
// 		update_merge: null | 'drop_changes' | 'keep_changes' | 'merge' | <function>,
//
//		// Special buttons...
//		//
//		// NOTE: these can be used only if .sort if not set.
//		//
//		// Item order editing (up/down) 
//		item_order_buttons: false,
//		// Up button html... (default: '&#9206;')
//		shift_up_button: <html> | null,
//		// Down button html... (default: '&#9207;')
//		shift_down_button: <html> | null,
//
//		// Move to top/bottom buttons, if not false the button is enabled, 
//		// if not bool the value is set as button html.
//		// Defaults when enabled: '&#10514;' and '&#10515;' respectively.
//		to_top_button: false | true | <html>,
//		to_bottom_button: false | true | <html>,
//
// 		// Delete item button...
// 		delete_button: true | false | <html>,
//
// 		// Item buttons...
// 		buttons: [
// 			// Placeholders that if given will be replace with the corresponding
// 			// special button...
// 			// NOTE: placeholders for disabled or not activated buttons 
// 			//		will get removed.
// 			// NOTE: if button is enabled but no placeholder is preset
// 			//		it will be appended to the button list.
// 			// NOTE: special buttons can be set in one of two formats, 
// 			//		see UP for an example...
// 			//
// 			// Up...
// 			'UP' | ['html', 'UP'],
// 			// Down...
// 			'DOWN',
// 			// Move to top...
// 			'TO_TOP',
// 			// Move to bottom...
// 			'TO_BOTTOM'
// 			// Remove item...
// 			'REMOVE',
//
// 			// See: itemButtons doc in browse.js for more info...
// 			..
// 		],
//
// 		...
// 	}
//
//
// Temporary state is stored in the dialog object:
// 	.__list			- cached input list
// 	.__editable		- list editable status
// 	.__to_remove	- list of items to remove
// 	.__editable_list_handlers
// 					- indicator that the dialog handlers are set up
//
//
// NOTE: if at least one order button is present this will set 
// 		.groupList to true
// NOTE: this uses .List(..) internally, see it's doc for additional 
// 		info.
// NOTE: the list must contain strings.
// NOTE: this accounts for '$' as a key binding marker in item text...
//
// XXX should id be the first argument??
// XXX TEST: potential problem: when reloading the list this will 
// 		overwrite the .__list[id] cache, with the input list, this may
// 		result in losing the edited state if the lists were not synced
// 		properly...
// XXX the problem with this is that it adds elements live while removing
// 		elements on close, either both should be live or both on close...
// XXX can we avoid creating the remove button on items that do not pass
// 		the options.remove(..) predicate???
Items.EditableList =
function(list, options){
	var make = this
	var dialog = make.dialog

	// write back the list...
	var write = function(list, lst){
		return (list instanceof Function ?
				// call the writer...
				list(lst) 
				// in-place replace list elements...
				// NOTE: this is necessary as not everything we do with lst
				// 		is in-place...
				: list.splice.apply(list, [0, list.length].concat(lst))) 
					// we need to return the list itself...
					&& lst
			// in case the list(..) returns nothing...
			|| lst }
	// save item to lst...
	var saveItem = function(txt, replace){
		if(txt == replace || txt.trim() == ''){
			return txt }
		txt = options.normalize ? 
			options.normalize(txt) 
			: txt
		// account for '$' as key binding marker...
		var ntxt = txt.replace(/\$/g, '')
		// unique-test text...
		var utxt = options.unique instanceof Function ? 
			options.unique(txt)+'' 
			: null

		// invalid format...
		if(options.check && !options.check(txt)){
			dialog.update()
			return }

		lst = dialog.__list[id]
		var normalized = lst.map(function(e){ 
			return e.replace(/\$/g, '') })

		// list length limit
		if(options.length_limit 
			&& (lst.length >= options.length_limit)){

			options.overflow 
				&& options.overflow.call(dialog, txt)

			return }

		// prevent editing non-arrays...
		if(!editable || !lst){
			return }

		// check if item pre-existed...
		var preexisted = utxt ? 
			//lst.indexOf(options.unique(txt)) >= 0
			(lst.indexOf(utxt) >= 0
				// account for '$' as key binding marker... (XXX ???)
				|| normalized.indexOf(utxt.replace(/\$/g, '')) >= 0)
			: (lst.indexOf(txt) >= 0 
				|| normalized.indexOf(ntxt) >= 0)

		// add new value and sort list...
		// XXX add option to append/prepend item to list...
		;(replace && lst.indexOf(replace) >= 0) ?
			lst[lst.indexOf(replace)] = txt
		: options.place_new_item == 'start' ?
			lst.unshift(txt)
		: lst.push(txt)

		// unique...
		if(options.unique == null || options.unique === true){
			// account for '$' as key binding marker...
			lst = lst.unique(function(e){ return e.replace(/\$/g, '') })

		// unique filter...
		} else if(options.unique instanceof Function){
			lst = lst.unique(options.unique) }

		// itemadded handler...
		options.itemadded
			&& !(options.unique && preexisted)
			&& options
				.itemadded.call(dialog, txt)

		// sort...
		if(options.sort){
			lst = lst
				.sort(options.sort instanceof Function ? 
					options.sort 
					: undefined) }

		lst = write(dialog.__list[id], lst)
		
		return txt }
	// edit item inline...
	var editItem = function(elem){
		var elem = $(elem).find('.text').last()
		from = elem.attr('text') || from

		elem
			// NOTE: we need to do this to account for 
			// 		'$' in names...
			.html(from)
			.makeEditable({
				activate: true,
				clear_on_edit: false,
				abort_keys: [
					'Esc',

					// XXX
					'Up',
					'Down',
				],
			})
			.on('edit-commit', function(evt, to){
				if(options.allow_empty || to.trim() != ''){
					to = saveItem(to, from)
					options.itemedit 
						&& options.itemedit.call(elem, evt, from, to) } })
			.on('edit-abort edit-commit', function(_, title){
				title = title.trim() == '' ? from : title
				title = title.replace(/\$/g, '')
				dialog.update()
					.then(function(){ dialog.select(`"${title}"`) }) }) }

	dialog.__list = dialog.__list || {}
	dialog.__editable = dialog.__editable || {}
	dialog.__to_remove = dialog.__to_remove || {}
	dialog.__editable_list_handlers = dialog.__editable_list_handlers || {}

	options = options || {}
	var id = options.list_id || 'default' 

	var to_remove = dialog.__to_remove[id] = 
		options.to_remove 
			|| dialog.__to_remove[id] 
			|| []

	// make a copy of options, to keep it safe from changes we are going
	// to make...
	options = options || {}
	var opts = {}
	for(var k in options){
		opts[k] = options[k] }
	options = opts

	var lst = 
		// no local data -> load initial state...
		!dialog.__list[id] ?
			(list instanceof Function ? list() : list)

		// load dialog state (ignore input)...
		: (options.update_merge == null 
				|| options.update_merge == 'keep_changes'
				|| options.update_merge == 'live') ? 
			dialog.__list[id]

		// load input/external state (ignore dialog state)...
		: (options.update_merge == 'drop_changes') ? 
			(list instanceof Function ? list() : list)

		// merge local and external states...
		: (options.update_merge == 'merge') ? 
			(function(local, input){
				return input
					.sort(function(a, b){ 
						// get base order from input...
						var i = local.indexOf(a)
						var j = local.indexOf(b)
						// order items not in input (added/renamed) 
						// via their position in local...
						i = i == -1 ? input.indexOf(a) : i
						j = j == -1 ? input.indexOf(b) : j
						return i - j })
			})(dialog.__list[id] || [], list instanceof Function ? list() : list)

		// user merge...
		: options.update_merge instanceof Function ? 
			//options.update_merge(dialog.__list[id])
			options.update_merge(
				dialog.__list[id], 
				list instanceof Function ? list() : list)

		: list instanceof Function ? 
			list() 
		: list

	var editable = dialog.__editable[id] = lst instanceof Array
	// NOTE: we .slice() here to make the changes a bit better packaged
	// 		or discrete and not done as they come in...
	lst = lst instanceof Array ? 
		(options.update_merge == 'live' ?
			lst
			: lst.slice())
		: Object.keys(lst)

	dialog.__list[id] = lst

	var buttons = options.buttons = (options.buttons || []).slice()

	// buttons: options...
	// NOTE: the order here is important...
	// NOTE: user-added buttons take priority over these, so we do not 
	// 		need to check if a button already exists...
	if(editable && !options.sort){
		// up/down...
		options.item_order_buttons 
			&& buttons.push('UP')
			&& buttons.push('DOWN')
		// top/bottom...
		options.to_top_button
			&& buttons.push('TO_TOP')
		options.to_bottom_button
			&& buttons.push('TO_BOTTOM') }
	// remove...
	editable 
		&& options.delete_button !== false
		&& buttons.push('REMOVE')

	var move = function(p, offset){
		var l = dialog.__list[id]
		var i = l.indexOf(p)

		// not in list...
		if(i < 0
				// first element...
				|| (i == 0 && offset < 0) 
				// last element...
				|| (i >= l.length-1 && offset > 0)){
			return false
		}

		var j = i + offset
		j = j < 0 ? 0
			: j >= l.length ? l.length-1
			: j

		// update list...
		l.splice(j, 0, l.splice(i, 1)[0])

		// return the shift distance... 
		return j - i
	}
	var __buttons = {
		UP: [options.shift_up_button || '&#9206;',
			function(p, e){
				move(p, -1)
					&& e.prev().before(e)
					// XXX hackish...
					&& dialog
						.updateItemNumbers()
						.trigger('up_button', p, e) }],
		DOWN: [options.shift_down_button || '&#9207;',
			function(p, e){
				move(p, 1)
					&& e.next().after(e)
					// XXX hackish...
					&& dialog
						.updateItemNumbers()
						.trigger('down_button', p, e) }],
		TO_TOP: [
			(options.to_top_button === true
			 		|| buttons.indexOf('TO_TOP') >= 0) ? 
				'&#10514;'
				: options.to_top_button,
			function(p, e){
				var d = move(p, -dialog.__list[id].length)
				d != null
					//&& e.prevAll().eq(Math.abs(d+1)).before(e)
					&& e.prevAll().last().before(e)
					&& dialog
						// XXX hackish...
						.updateItemNumbers()
						.trigger('to_top_button', p, e)
			}],
		TO_BOTTOM: [
			(options.to_bottom_button === true 
			 		|| buttons.indexOf('TO_BOTTOM') >= 0) ? 
				'&#10515;' 
				: options.to_bottom_button,
			function(p, e){
				var d = move(p, dialog.__list[id].length)
				d != null
					//&& e.nextAll().eq(Math.abs(d-1)).after(e)
					&& e.nextAll().last().after(e)
					&& dialog
						// XXX hackish...
						.updateItemNumbers()
						.trigger('to_bottom_button', p, e)
			}],
		REMOVE: Buttons.markForRemoval(
			to_remove, 
			options.delete_button !== true ? 
				options.delete_button 
				: undefined)
	}

	// replace the button placeholders...
	// NOTE: only the first button instance is used, also not that all
	// 		the config buttons are pushed to the end of the list thus
	// 		they will be overridden buy user buttons...
	var seen = []
	buttons = options.buttons = 
		buttons
			.map(function(button){
				var key = button instanceof Array ? button[1] : button
				// skip seen buttons...
				if(seen.indexOf(key) >= 0){
					return key }
				var res = button in __buttons ? 
						__buttons[button]
					: button[1] in __buttons ? 
						[button[0], __buttons[button[1]][1]]
					: button
				// group if at least one sort button is present...
				if(res !== button){
					options.groupList = true
					// avoid duplicates...
					seen.push(key) }
				return res.slice() })
			// clear out the unused button placeholders...
			.filter(function(b){ 
				return ['UP', 'DOWN', 'TO_TOP', 'TO_BOTTOM', 'REMOVE'].indexOf(b) < 0 })

	// if we are sortable then we will need to also be grouped...
	options.sortable
		&& (options.groupList = true)

	// make the list...
	var res = make.List(lst, options)
		.attr('list-id', id)

	// make sortable...
	if(options.sortable){
		// add sort handle...
		res.find('.text:first-child')
			.before($('<span>')
				.addClass('sort-handle')
				.html('&#x2630;'))
		/*
		res.find('.button-container')
			.before($('<span>')
				.addClass('sort-handle')
				.html('&#x2630;'))
		//*/
		// make the block sortable...
		res.parent().sortable({
			handle: '.sort-handle',
			axis: options.sortable === true ? false : options.sortable,
			forcePlaceholderSize: true,
			containment: 'parent',
			tolerance: 'pointer',
			update: function(evt, ui){
				var order = ui.item.parent()
					.find('.item')
						.map(function(){ 
							//return $(this).find('.text').text() })
							return $(this).find('.text').attr('text')
								|| $(this).find('.text').text() })
						.toArray()
				var l = dialog.__list[id]
				l.splice.apply(l, [0, l.length].concat(order))
				dialog.updateItemNumbers() },
		}) }

	// mark items for removal -- if a list is given by user...
	to_remove
		.forEach(function(e){
			dialog.filter('"'+ e +'"')
				.addClass('strike-out') })

	options.itemopen
		&& res.on('open', function(evt){ 
			options.itemopen.call(this, evt, dialog.selected) })

	res = res.toArray()

	// editable...
	if(options.editable_items !== false){
		var trigger_edit = function(){ 
			dialog.select('!')
				.trigger('itemedit') }
		$(res)
			.on('itemedit', function(){ editItem($(this)) })
		;(options.item_edit_keys || ['F2'])
			.forEach(function(key){
				dialog.keyboard
					.handler('General', key, trigger_edit) })
		options.item_edit_events != false 
			&& options.item_edit_events != ''
		 	&& $(res).on(options.item_edit_events || 'menu', 
				function(){ $(this).trigger('itemedit') }) }

	// new item...
	if(options.new_item !== false){
		var new_item = options.new_item || true
		new_item = new_item === true ? '$New...' : new_item
		res.push(make.Editable(
			new_item, 
			{
				action: true, 
				clear_on_edit: true,
			})
			// update list on edit done...
			.on('edit-commit', function(evt, txt){ 
				if(txt.trim() != ''){
					txt = saveItem(txt) 
					dialog.update()
						.done(function(){
							//dialog.select('"'+txt+'"')
							txt 
								&& dialog
									.select('"'+txt.replace(/\$/g, '')+'"') }) } })) }

	// dialog handlers...
	// NOTE: we bind these only once per dialog...
	if(dialog.__editable_list_handlers[id] == null){
		dialog.__editable_list_handlers[id] = true
		dialog
			// update the striked-out items (to_remove)...
			.on('update', function(){
				to_remove.forEach(function(e){
					dialog.filter('"'+ e +'"')
						.addClass('strike-out') }) })
			// clear the to_remove items + save list...
			.on('close', function(){
				// prevent editing non-arrays...
				if(!editable){
					return }

				lst = dialog.__list[id]

				// remove items...
				to_remove
					.filter(options.remove 
						|| function(){ return true })
					.forEach(function(e){
						var i = lst.indexOf(e)
						i >= 0 
							&& lst.splice(i, 1) })

				// sort...
				if(options.sort){
					lst.sort(
						options.sort !== true ? 
							options.sort 
							: undefined) }

				write(list, lst) }) }

	return $(res) }



// Editable list of pinnable elements...
//
// This is like .EditableList(..) but adds the ability to pin items to 
// the top sub-list and either maintain that sub-list order independently
// or keep it the same as the main list...
//
// Format:
// 	{
// 		// Equivalent to .length_limit option in .List(..) but applies 
// 		// only to pins...
// 		pins_length_limit: .. ,
//
// 		// Equivalent to .sortable option in .List(..) but applies only
// 		// to pins...
// 		pins_sortable: .. ,
//
// 		// Equivalent to .buttons option in .List(..) but applies only 
// 		// to pins...
// 		// If this is not given the same buttons are used for both lists.
// 		pins_buttons: .. ,
//
// 		...
// 	}
//
// XXX should id be the first argument??
Items.EditablePinnedList =
function(list, pins, options){
	var that = this
	pins = pins || []
	options = options || {}
	var id = options.list_id
	var pins_id = id + '-pins'
	var dialog = this.dialog

	// prepare the cache...
	// XXX check if either list/pins is a function...
	dialog.__list = dialog.__list || {}
	list = dialog.__list[id] = dialog.__list[id] || list
	pins = dialog.__list[pins_id] = dialog.__list[pins_id] || pins

	// link the to_remove lists of pins and the main list...
	dialog.__to_remove = dialog.__to_remove || {}
	if(dialog.__to_remove[id] == null){
		dialog.__to_remove[id] = 
			dialog.__to_remove[pins_id] = [] }

	// XXX redraw....
	// 		- sort			- within one list this is trivial (history.js)
	// 		- pin/unpin 	- remove item from one list and update the 
	// 							other... (can we update a sub-list?)

	//------------------------------------ setup options: main/pins ---
	// buttons...
	var buttons = options.buttons = (options.buttons || []).slice()
	var pins_buttons = (options.pins_buttons || buttons).slice()
	// pin/unpin button...
	var pin = [
		'<span class="pin-set">&#9679;</span>'
		+'<span class="pin-unset">&#9675;</span>', 
			function(p, cur){
				// XXX if this line's not here, for some reason on first
				// 		run this sees the wrong instance of pins...
				var pins = dialog.__list[pins_id]

				// pin...
				if(!cur.hasClass('pinned')){
					// XXX check pins length limit...
					pins.splice(0, 0, p)
					// sort pins...
					sortable
						|| (options.sort instanceof Function ? 
							pins.sort(options.sort) 
							: pins.sortAs(dialog.__list[id]))

				// unpin...
				} else {
					pins.splice(pins.indexOf(p), 1) }

				// XXX this is slow...
				that.dialog
					.update()
					.then(function(){
						that.dialog.trigger('pin_button', p, cur) })
			}]
	;[buttons, pins_buttons]
		.forEach(function(b){
			var i = b.indexOf('PIN')
			i < 0 ? 
				b.push(pin)
				: (b[i] = pin) })
	options.isItemHidden = function(e){ return pins.indexOf(e) >= 0 }
	options.skipHiddenItems = options.skipHiddenItems !== false ? true : false

	//----------------------------------------- setup options: pins ---
	var pins_options = {
		list_id: pins_id,
		new_item: false,
		length_limit: options.pins_length_limit || 10,

		isItemHidden: null,

		buttons: pins_buttons,
	}
	pins_options.__proto__ = options
	var sortable = pins_options.sortable = 
		options.pins_sortable === undefined 
			|| options.pins_sortable
	if(!sortable){
		 pins_options.sort = options.sort instanceof Function ? 
			options.sort
			: pins.sortAs(dialog.__list[id]) }

	//---------------------------------------------- build the list ---
	var res = this.EditableList(pins, pins_options)
		.addClass('pinned')
		.toArray()

	res.length > 0 
		&& res.push(this.Separator()[0])

	res.concat(this.EditableList(
			// remove pinned from list...
			list, 
			options)
		.toArray())

	return $(res) }



//---------------------------------------------------------------------
// Browse item buttons (button constructors)...

var Buttons = 
Items.buttons =
module.buttons = {}


// Mark an item for removal and add it to a list of marked items...
//
Buttons.markForRemoval = function(list, html){
	return [html || '&times;', 
		function(p, e){
			e.toggleClass('strike-out')

			if(list == null){
				return
			}

			p = e.find('.text').attr('text') || p

			if(e.hasClass('strike-out')){
				list.indexOf(p) < 0 
					&& list.push(p)

			} else {
				var i = list.indexOf(p)
				i >= 0
					&& list.splice(i, 1) } }] }




/*********************************************************************/

// NOTE: the widget itself does not need a title, that's the job for
//		a container widget (dialog, field, ...)
//		...it can be implemented trivially via an attribute and a :before
//		CSS class...
var BrowserClassPrototype = {

	// Normalize path...
	//
	// This converts the path into a universal absolute array 
	// representation, taking care of relative path constructs including
	// '.' (current path) and '..' (up one level)
	//
	// XXX does this need to handle trailing '/'???
	// 		...the problem is mainly encoding a trailing '/' into an 
	// 		array, adding a '' at the end seems both obvious and 
	// 		artificial...
	// XXX is this the correct name???
	// 		...should this be .normalizePath(..)???
	path2list: function(path){
		var splitter = /[\\\/]/

		if(typeof(path) == typeof('str')){
			path = path
				.split(splitter)
				.filter(function(e){ return e != '' })
		}

		// we've got a relative path...
		if(path[0] == '.' || path[0] == '..'){
			path = this.path.concat(path)
		}

		path = path
			// clear the '..' and markers...
			// NOTE: we reverse to avoid setting elements with negative
			// 		indexes if we have a leading '..'
			.reverse()
			.map(function(e, i){
				if(e == '..'){
					e = '.'
					path[i] = '.'
					path[i+1] = '.'
				}
				return e
			})
			.reverse()
			// filter out '.'...
			.filter(function(e){ return e != '.' })

		return path
	},

	// Construct the dom...
	make: function(obj, options){
		var browser = $('<div>')
			.addClass('browse-widget '+ (options.cloudView ? 'cloud-view' : ''))
			// make thie widget focusable...
			// NOTE: tabindex 0 means automatic tab indexing and -1 means 
			//		focusable bot not tabable...
			//.attr('tabindex', -1)
			.attr('tabindex', 0)
			// focus the widget if something inside is clicked...
			.click(function(){
				if($(this).find(':focus').length == 0){
					$(this).focus()
				}
			})

		if(options.flat){
			browser.addClass('flat')
		}

		if(options.cls){
			browser.addClass(options.cls)
		}

		// path...
		var path = $('<div>')
			.addClass('v-block path')
			/*
			.click(function(){
				// XXX set contenteditable...
				// XXX set value to path...
				// XXX select all...
			})
			.on('blur', function(){
				// XXX unset contenteditable...
			})
			.keyup(function(){
				// XXX update path...
				// 		- set /../..../ to path
				// 		- use the part after the last '/' ad filter...
			})
		  	*/

		if(options.pathPrefix){
			path.attr('prefix', options.pathPrefix)
		}
		if(options.show_path == false){
			path.hide()
		}

		browser
			.append(path)
			// list...
			.append($('<div>')
				   .addClass('v-block list'))

		return browser
	},
}



// XXX Q: should we make a base list dialog and build this on that or
//		simplify this to implement a list (removing the path and disabling
//		traversal)??
// XXX might be a good idea to add a ctrl-c/copy handler...
// 		...copy path by default but overloadable with something like 
// 		.getCopyValue() which would return .strPath by default...
// XXX feels a bit over-complicated...
// 		...might be a good idea to split this into:
// 			- base 
// 				- structure 
// 				- path/traversable
// 				- navigation (mouse/keyboard)
// 			- search/filtering
// 			- buttons
// XXX add a fast redraw mode to .update(..) (???)
// 		- do not clear items
// 		- if args did not change:
// 			- check if cur item is the same 
// 				...same text, options, signature to make(..)???
// 			- if the same, keep the element
// 			- if different find and place
// 			- if nothing found, create
var BrowserPrototype = {
	dom: null,

	// option defaults and doc...
	options: {
		// CSS classes to add to widget...
		cls: null,

		// Initial path...
		//
		// NOTE: this can be a number indicating the item to select when
		// 		load is done.
		//path: null,
		//selected: null,

		//show_path: true,
		
		// Set the path prefix...
		//
		// XXX at this time this is used only for generating paths, need
		// 		to also use this for parsing...
		pathPrefix: '/',

		// Enable/disable user selection filtering...
		//
		// NOTE: this only affects starting the filter...
		filter: true,

		// Enable/disable full path editing...
		//
		// NOTE: as with .filter above, this only affects .startFullPathEdit(..)
		fullPathEdit: true,

		// If false will disable traversal...
		// NOTE: if false this will also disable traversal up.
		// NOTE: this will not disable manual updates or explicit path 
		// 		setting.
		// NOTE: another way to disable traversal is to set 
		// 		.not-traversable on the .browse-widget element
		// NOTE: if false this will also disable .toggleNonTraversableDrawing()
		// 		as this will essentially hide/show the whole list.
		traversable: true,

		// If true non-traversable items will be shown...
		//
		// NOTE: setting both this and .traversable to false will hide 
		// 		all elements in the list.
		showNonTraversable: true,

		// If true disabled items will be shown...
		//
		// NOTE: this will have an effect only on items disabled via list/make
		// 		items with .disabled CSS class set manually will not be 
		// 		affected...
		showDisabled: true,

		// XXX
		showHidden: false,

		// Enable/disable disabled drawing...
		// 
		// If false these will disable the corresponding methods.
		//
		// NOTE: these are here to let the user enable/disable these 
		// 		without the need to go into the keyboard configuration...
		// NOTE: non-traversable drawing is disabled/enabled by .traversable
		// 		option above.
		// NOTE: this will have an effect only on items disabled via list/make
		// 		items with .disabled CSS class set manually will not be 
		// 		affected...
		toggleDisabledDrawing: true,

		// XXX
		toggleHiddenDrawing: true,

		// Group traversable elements...
		//
		// Possible values:
		// 	null | false | 'none'	- show items as-is
		// 	'first'					- group traversable items at top
		// 	'last'					- group traversable items at bottom
		sortTraversable: null,

		// Create item shortcuts...
		//
		// If false, no shortcuts will be created.
		setItemShortcuts: true,

		// Item shortcut text marker...
		//
		// This can be a regexp string pattern or a RegExp object. This 
		// should contain one group containing the key. 
		// Everything outside the last group will be cleaned out of the
		// text...
		//
		// NOTE: it is best to keep this HTML compatible, this makes the
		// 		use of chars like '&' not to be recommended...
		itemShortcutMarker: '\\$(\\w)',

		// Controls the display of the action button on each list item...
		//
		// Possible values:
		// 	false			- disable the action button
		// 	true			- show default action button
		// 	<text/html>		- display <text/html> in action button
		actionButton: false,

		// Controls the display of the push button on each list item...
		//
		// This has the same semantics as .actionButton so see that for 
		// more info.
		pushButton: false,

		// A set of custom buttons to add to each item.
		//
		// Format:
		itemButtons: false,

		// Handle keys that are not bound...
		// NOTE: to disable, set ot undefined.
		logKeys: function(k){ window.DEBUG && console.log(k) },

		// If set disables leading and trailing '/' on list and path 
		// elements.
		// This is mainly used for flat list selectors.
		flat: false,

		// If set this will switch the browse dialog into cloud mode.
		cloudView: false,

		// List of events that will not get propagated outside the browser...
		//
		// NOTE: these are local events defined on the widget, so it 
		// 		would not be logical to propagate them up the DOM, but if
		// 		such behavior is desired one could always change the 
		// 		configuration ;)
		nonPropagatedEvents: [
			'push',
			'pop',
			'open',
			'update',
			'select',
			'deselect',

			'keydown',

			//'close',
		],

		// List of event handlers that can be set directly from item 
		// options...
		//
		// This is a shorthand to using options.events object.
		itemOptionsEventShorthands: [
			'select',
			'deselect',
			'open',
			'menu',
			'update',
			'close',
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
		elementShorthand: {
			'---': {
				'class': 'separator',
				'html': '<hr>'
			},
			'...': {
				'class': 'separator',
				'html': '<center><div class="loader"/></center>',
			},
		},

		// Separator class...
		//
		// NOTE: if make(..) is passed an element with this class it will
		// 		be treated as a separator and not as a list element.
		// NOTE: to disable class checking set this to null
		elementSeparatorClass: 'separator',

		// Hold browse widget's size between updates...
		//
		// This prevents the element from collapsing and then growing 
		// again on slowish loads.
		//
		// Supported values:
		// 	- null/false/undefined	- feature disabled
		// 	- number				- number of milliseconds to hold size
		// 								before timing out
		// 	- true					- hold till first make is called
		// 								without a timeout.
		//
		// NOTE: recommended values are about the same value till the 
		// 		first make(..) is called, but obviously this should be 
		// 		as short as possible -- under 20-50ms.
		holdSize: 20,

		keyboardRepeatPause: 100,
	},

	// XXX need a way to access buttons...
	// XXX should we have things like ctrl-<number> for fast selection 
	// 		in filter mode???
	keybindings: {
		ItemEdit: {
			pattern: '.list .text[contenteditable]',

			// keep text editing action from affecting the selection...
			drop: '*',

			Up: 'NEXT!',
			Down: 'NEXT!',
			Tab: 'NEXT!',
			shift_Tab: 'NEXT!',

			Enter: 'push!',
			Esc: 'update!',
		},

		FullPathEdit: {
			pattern: '.path[contenteditable]',

			// keep text editing action from affecting the selection...
			drop: '*',

			Enter: 'stopFullPathEdit!',
			Esc: 'abortFullPathEdit!',
		},

		Filter: {
			pattern: '.path div.cur[contenteditable]',

			// keep text editing action from affecting the selection...
			drop: '*',
			
			Up: 'NEXT!',
			Down: 'NEXT!',
			Tab: 'NEXT!',
			shift_Tab: 'NEXT!',

			Enter: 'push!',
			Esc: 'stopFilter!',
		},

		General: {
			pattern: '*',

			Up: 'up!',
			Down: 'down!',
			Left: 'left!',
			ctrl_Left: 'update!: "/"',
			Right: 'right',
			Backspace: 'Left',
			Space: 'Right',

			// XXX should these also select buttons???
			Tab: 'down!',
			shift_Tab: 'up!',

			// XXX is this correct??
			ctrl_Tab: 'nop!',

			// XXX
			PgUp: 'prevPage!',
			PgDown: 'nextPage!',

			Home: 'navigate!: "first"',
			End: 'navigate!: "last"',

			Enter: 'action',

			Esc: 'close: "reject"',

			'/': 'startFilter!',
			ctrl_F: '/',

			ctrl_A: 'startFullPathEdit!',

			ctrl_D: 'toggleDisabledDrawing',
			ctrl_H: 'toggleHiddenDrawing',
			ctrl_T: 'toggleNonTraversableDrawing',

			// XXX should these use .select(..)???
			// XXX should these be relative to visible area or absolute 
			// 		to current list regardless of scroll (as is now)???
			// XXX should these work while filtering??
			'#1': 'push!: "0!"',
			'#2': 'push!: "1!"',
			'#3': 'push!: "2!"',
			'#4': 'push!: "3!"',
			'#5': 'push!: "4!"',
			'#6': 'push!: "5!"',
			'#7': 'push!: "6!"',
			'#8': 'push!: "7!"',
			'#9': 'push!: "8!"',
			'#0': 'push!: "9!"',

			// handlers for standard shortcuts...
			Menu: 'menu!',

			ctrl_C: function(){ console.log('!!!!!') },
		},

		ItemShortcuts: {
			doc: 'Item shortcuts',
			pattern: '*',

		},
	},


	// Call the constructor's .path2list(..) and clear out shortcut markers...
	//
	// See: BrowserClassPrototype.path2list(..) for docs...
	path2list: function(path){ 
		var marker = this.options.itemShortcutMarker 
		marker = marker && RegExp(marker, 'g')
		// if list is flat we do not need to split it, just format...
		if(this.options.flat && path && path instanceof Array){
			return (path == '' || path.length == 0) ? [] : [path]
		}
		return this.constructor
			.path2list.apply(this, arguments) 
			.map(function(e){ 
				return marker ? e.replace(marker, '$1') : e })
	},

	// Trigger jQuery events on Item then bubble to Browser...
	//
	// This will extend the event object with:
	// 	.source		- Browser instance that triggered the event
	// 	.type		- event type/name
	// 	.args		- arguments passed to trigger
	//
	// NOTE: event propagation for some events is disabled by binding 
	// 		to them handlers that stop propagation in .__init__(..).
	// 		The list of non-propagated events in defined in 
	// 		.options.nonPropagatedEvents
	trigger: function(event){
		var elem = this.select('!')

		// NOTE: this will propagate up to the dialog...
		if(elem.length > 0){
			var args = [...arguments].slice(1)
			elem.trigger({
				type: arguments[0],
				source: this,
				args: args,
			}, args)

		// no items selected -- trigger event on main ui...
		} else {
			object.parent(BrowserPrototype.trigger, this).apply(this, arguments)
		}

		return this
	},

	// specific events...
	focus: function(handler){
		if(handler != null){
			//this.on('focus', handler)
			this.on('focus', handler.bind(this))

		// focus only if we do not have focus...
		} else if(!this.dom.is(':focus') 
				&& this.dom.find(':focus').length == 0) {
			this.dom.focus()
		}
		return this
	},
	blur: widget.proxyToDom('blur'),

	// Trigger/bind to menu event...
	//
	//	Bind handler to menu event...
	//	.menu(handler)
	//		-> this
	//
	//	Trigger menu event on current item...
	//	.menu()
	//		-> this
	//
	//	Select and trigger menu event on selected item...
	//	.menu(pattern)
	//		-> this
	//
	menu: function(){
		arguments[0] instanceof Function ? 
			this.dom.on('menu', arguments[0])
			: this.select(arguments[0] || '!')
				.trigger('menu', [this.selected])
		return this
	},


	// base api...

	// XXX should these set both the options and dom???
	get flat(){
		return !this.dom.hasClass('flat') || this.options.flat },
	set flat(value){
		if(value){
			this.dom.addClass('flat')
		} else {
			this.dom.removeClass('flat')
		}
		this.options.flat = value
	},
	get traversable(){
		return !this.dom.hasClass('not-traversable') && this.options.traversable },
	set traversable(value){
		if(value){
			this.dom.removeClass('not-traversable')
		} else {
			this.dom.addClass('not-traversable')
		}
		this.options.traversable = value
	},

	get cloud(){
		return this.dom.hasClass('cloud-view') || this.options.cloudView },
	set cloud(value){
		if(value){
			this.dom.addClass('cloud-view')
		} else {
			this.dom.removeClass('cloud-view')
		}
		this.options.cloudView = value
	},

	// Get/set the listed path...
	//
	// On more info on setting the path see .update(..)
	//
	// NOTE: .path = <path> is equivalent to .update(<path>) 
	// NOTE: if the string path assigned does not contain a trailing '/'
	// 		the path will be loaded up to the last item and the last item
	// 		will be selected (see .update(..) for example).
	// NOTE: to avoid duplicating and syncing data, the actual path is 
	//		stored in DOM...
	// NOTE: path returned does not include the currently selected list 
	// 		element, just the path to the current list...
	// 		To get the path with selection use: .selectionPath prop
	get path(){
		var skip = false
		return this.dom.find('.path .dir:not(.cur)')
			.map(function(i, e){ return $(e).text() })
			.toArray() },
	set path(value){
		this.update(value) },

	// String path...
	//
	// This is the same as .path but returns a string result.
	//
	// NOTE: this does not include the selected element, i.e. the returned 
	// 		path always ends with a trailing '/'.
	// NOTE: the setter is just a shorthand to .path setter for uniformity...
	//
	// XXX need to append '/' only if traversable...
	get strPath(){
		return this.options.pathPrefix + this.path.join('/') + '/' },
	set strPath(value){
		this.path = value },

	// Get/set path with selection...
	//
	// NOTE: this always returns the selected element last if one is 
	// 		selected, if no element is selected this is equivalent to 
	// 		.strPath
	// NOTE: the setter is just a shorthand to .path setter for uniformity...
	get selectionPath(){
		return this.strPath + (this.selected || '') },
	set selectionPath(value){
		this.path = value },

	// Get/set current selection (text)...
	//
	// NOTE: .selected = <value> is equivalent to .select(<value>) for 
	// 		more info on accepted values see .select(..)
	get selected(){
		var e = this.select('!')
		if(e.length <= 0){
			return null
		}
		return e.find('.text').text() },
	set selected(value){
		return this.select(value) },


	// NOTE: if .options.traversable is false this will have no effect.
	// XXX might be a good idea to toggle .non-traversable-hidden CSS 
	// 		class here too...
	// 		...will need to account for 1-9 shortcut keys and hints to 
	// 		still work...
	toggleNonTraversableDrawing: function(){
		var cur = this.selected 
		if(this.options.traversable == false){
			return this
		}
		this.options.showNonTraversable = !this.options.showNonTraversable
		this.update()
		cur && this.select(cur)
		return this
	},
	// XXX this will not affect elements that were disabled via setting 
	// 		the .disabled class and not via list/make...
	// 		...is this a problem???
	// XXX might be a good idea to toggle .disabled-hidden CSS class 
	// 		here too...
	// 		...will need to account for 1-9 shortcut keys and hints to 
	// 		still work...
	toggleDisabledDrawing: function(){
		var cur = this.selected 
		if(this.options.toggleDisabledDrawing == false){
			return this
		}
		this.options.showDisabled = !this.options.showDisabled
		this.update()
		cur && this.select(cur)
		return this
	},
	toggleHiddenDrawing: function(){
		var cur = this.selected 
		if(this.options.toggleHiddenDrawing == false){
			return this
		}
		this.options.showHidden = !this.options.showHidden
		this.update()
		cur && this.select(cur)
		return this
	},


	/*/ Copy/Paste actions...
	//
	// XXX use 'Text' for IE...
	copy: function(){
		var path = this.strPath

		if(NW){
			gui.Clipboard.get()
				.set(path, 'text')

		// browser...
		// XXX use 'Test' for IE...
		} else if(event != undefined){
			event.clipboardData.setData('text/plain', path)
		}

		return path
	},
	paste: function(str){
		// generic...
		if(str != null){
			this.path = str

		// nw.js
		} else if(NW){
			this.path = gui.Clipboard.get()
				.get('text')

		// browser...
		// XXX use 'Test' for IE...
		} else if(event != undefined){
			this.path = event.clipboardData.getData('text/plain')
		}

		return this
	},
	//*/

	// update (load) path...
	// 	- build the path
	// 	- build the element list
	// 	- bind to control events
	// 	- return a deferred
	//
	// This will trigger the 'update' event.
	//
	// For uniformity and ease of access from DOM, this will also set the
	// 'path' html attribute on the .browse-widget element.
	//
	// If the given string path does not end with a '/' then the path
	// up to the last item will be loaded and the last item loaded.
	//
	// Examle:
	// 		Load and select...
	// 		'/some/path/there'		-> .update('/some/path/')
	// 									.select('there')
	//
	// 		Load path only...
	// 		'/some/path/there/'		-> .update('/some/path/there/')
	//
	//
	// NOTE: setting the DOM attr 'path' works one way, navigating to a
	// 		different path will overwrite the attr but setting a new 
	// 		value to the html attr will not affect the actual path.
	// NOTE: .path = <some-path> is equivalent to .update(<some-path>)
	// 		both exist at the same time to enable chaining...
	// NOTE: this will scroll the path to show the last element for paths
	// 		that do not fit in view...
	//
	//
	// Item constructor:
	// 	This is passed to the lister and can be used by the user to 
	// 	construct and extend list items.
	//
	// Make an item...
	//	make(item, options)
	//	make(item, traversable, disabled, buttons)
	//		-> item
	//
	//	item format:
	//	- str					- item text
	//								NOTE: see: .options.elementShorthand
	//									for shorthands for common elements
	//									
	//	- [str/func, ... ]		- item elements
	//								Each of the elements is individually
	//								wrapped in a .text container.
	//								If an item is a function it is called 
	//								and the returned value is treated as
	//								the text.
	//								NOTE: empty strings will get replaced 
	//									with &nbsp;
	//								NOTE: if one of the items or constructor
	//									returns is "$BUTTONS" then this
	//									item will get replaced with the 
	//									button container
	//	- DOM/jQuery			- an element to be used as an item
	//
	//	Both traversable and disabled are optional and can take bool 
	//	values.
	//
	//	If item matches .options.itemShortcutMarker (default: /\$(\w)/)
	//	then the char after the '$' will be used as a keyboard shortcut
	//	for this item the char wrapped in a span (class: .keyboard-shortcut),
	//	and the marker (in this case '$') will be cleaned out.
	//	Also see: item.options.shortcut_key below.
	//
	//	NOTE: only the first occurrence of key will get registered...
	//	NOTE: shortcuts can't override Browse shortcuts...
	//
	//
	//	options format:
	//	{
	//		// item css class...
	//		cls: <str>,
	//
	//		// If true make the element traversable...
	//		traversable: <bool>,
	//
	//		// If true disable the element...
	//		disabled: <bool>,
	//
	//		// If true hide the element...
	//		hidden: <bool>,
	//
	//		// If true the open event will also pass the element to open...
	//		//
	//		// This is useful for opening traversable elements both on 
	//		// pressing Enter or Left keys...
	//		//
	//		// This is equivalent to:
	//		//		make(...)
	//		//			.attr('push-on-open', 'on')
	//		//	or:
	//		//		make(...)
	//		//			.on('open', function(){ 
	//		//				// X here is the browser object...
	//		//				X.push(this) })
	//		//
	//		push_on_open: <bool>,
	//
	// 		// If true this element will be uncondionally hidden on search...
	// 		//
	// 		// NOTE: this is equivalent to setting .hide-on-search class
	// 		//		on the element...
	//		hide_on_search: <bool>,
	//
	//		// If true the item will not get searched...
	//		//
	// 		// NOTE: this is equivalent to setting .not-searchable class
	// 		//		on the element...
	//		not_searchable: <bool>,
	//
	//		// If true item will not get hidden on filtering... 
	//		//
	// 		// NOTE: this is equivalent to setting .not-filtered-out class
	// 		//		on the element...
	//		not_filtered_out: <bool>,
	//
	//		// element button spec...
	//		buttons: <bottons>,
	//
	//		// shortcut key to open the item...
	//		shortcut_key: <key>,
	//
	//		// event handler shorthands...
	//		// 
	//		// These are the sugar for commonly used events in the events
	//		// section below...
	//		// NOTE: these are defined in .options.itemOptionsEventShorthands
	//		open: <handler>,
	//		menu: <handler>,
	//		update: <handler>,
	//		close: <handler>,
	//
	//		// event handlers...
	//		events: {
	//			// item-specific update events...
	//			//
	//			// item added to dom by .update(..)...
	//			// NOTE: this is not propagated up, thus it will not trigger
	//			//		the list update.
	//			update: <handler>,
	//
	//			menu: <handler>,
	//
	//			<event>: <handler>,
	//			...
	//		},
	//
	//		// element attributes...
	//		attrs: {
	//			<attr>: <value>,
	//			...
	//		},
	//
	//		// element css style...
	//		style: {
	//			<attr>: <value>,
	//		}
	//	}
	//
	//	<buttons> format (optional):
	//	[ 
	//		[<html>, <func>], 
	//		... 
	//	]
	//
	// NOTE: buttons will override .options.itemButtons, if this is not
	// 		desired simply copy .itemButtons and modify it...
	// 			Example:
	// 				make(.., {
	// 					buttons: [
	//
	// 						...
	//
	// 					// dialog here refers to the browse object...
	// 					].concat(dialog.options.itemButtons),
	// 				})
	//
	//
	// Finalize the dialog (optional)...
	// 	- Call make.done() can optionally be called after all the items
	// 		are created. This will update the dialog to align the 
	// 		selected position.
	// 		This is useful for dialogs with async loading items. 
	//
	//
	// XXX need a way to handle path errors in the extension API...
	// 		...for example, if .list(..) can't list or lists a different
	// 		path due to an error, we need to be able to render the new
	// 		path both in the path and list sections...
	// 		NOTE: current behaviour is not wrong, it just not too flexible...
	//
	// XXX one use-case here would be to pass this a custom lister or a full
	// 		browser, need to make this work correctly for full set of 
	// 		events...
	// 			- custom lister -- handle all sub-paths in some way...
	// 			- full browser -- handle all sub-paths by the nested 
	// 								browser...
	// 		one way to handle nested browsers is to implement a browser 
	// 		stack which if not empty the top browser handles all the 
	// 		sub-paths
	// 		...this will also need to indicate a way to split the path 
	// 		and when to 'pop' the sub browser...
	// XXX should we use the button tag for item buttons???
	// 		...basically for this to work we need to either reset or override
	// 		user-agent-stylesheet...
	// 		to override just set most of the affected options to inherit...
	// XXX make(..): this trims of the trailing '/' of the text in some cases...
	// 		...is this a bug???
	update: function(path, list){
		path = path || this.path
		var browser = this.dom
		var that = this
		var focus = browser.find(':focus').length > 0
		list = list || this.list

		var deferred = $.Deferred()

		//-------------------------- prepare the path and selection ---
		// string path and terminated with '/' -- no selection...
		if(typeof(path) == typeof('str') 
				&& !/[\\\/]/.test(path.trim().slice(-1))){
			path = this.path2list(path)
			var selection = path.pop()

		// restore selection if path did not change...
		} else if(path instanceof Array 
				&& path.length == this.path.length
				&& path.filter(function(e, i){ return e != that.path[i] }).length == 0){
			var selection = this.selected

		// no selection...
		} else {
			path = this.path2list(path)
			var selection = null }

		//-------------------------------------- prepare for update ---
		// prevent the browser from collapsing and then growing on 
		// slow-ish loads...
		if(this.options.holdSize){
			var _freeSize = function(){
				browser.height('')
				browser.width('')
			}

			// cleanup, just in case...
			_freeSize()

			// only fix the size if we are not empty...
			if(browser.find('.list').children().length > 0){
				browser.height(browser.height())
				browser.width(browser.width())
			}
			// reset after a timeout...
			typeof(this.options.holdSize) == typeof(123) 
				&& setTimeout(_freeSize, this.options.holdSize)
		}

		// clear the ui...
		var p = browser.find('.path').empty()
		var l = browser.find('.list').empty()

		//---------------------------------------------- setup path ---
		// set the path prefix...
		p
			.attr('prefix', this.options.pathPrefix)
			.scroll(function(){
				// handle path scroll..
				if(p[0].offsetWidth < p[0].scrollWidth){
					// scroll all the way to the right...
					p.addClass('scrolling')

					// left out of view...
					p[0].scrollLeft > 0 ? 
						p.addClass('left') 
						: p.removeClass('left')

					// right out of view...
					p[0].scrollLeft + p[0].offsetWidth + 5 <= p[0].scrollWidth ? 
						p.addClass('right') 
						: p.removeClass('right')

				// keep left aligned...
				} else {
					p.removeClass('scrolling')
				}
			})

		var c = []
		// fill the path field...
		path.forEach(function(e){
			c.push(e)
			var cur = c.slice()
			p.append($('<div>')
				.addClass('dir')
				.click(function(){
					if(that.traversable){
						that.update(cur.join('/')) 
					}
				})
				.text(e))
		})

		// add current selection indicator...
		var txt
		p.append($('<div>')
			.addClass('dir cur')
			.click(function(){
				event.stopPropagation()
				that.toggleFilter('on')
			})
			.on('blur', function(){
				that.toggleFilter('off')
			})
			// only update if text changed...
			.focus(function(){
				txt = $(this).text()
			})
			.keyup(function(){
				var cur  = $(this).text()
				if(txt != cur){
					txt = cur
					that.filterList(cur)
				}
			}))


		// handle path scroll..
		// scroll to the end when wider than view...
		if(p[0].offsetWidth < p[0].scrollWidth){
			// scroll all the way to the right...
			p.scrollLeft(p[0].scrollWidth)

		// keep left aligned...
		} else {
			p.scrollLeft(0)
		}


		//---------------------------------------------------- make ---
		var sort_traversable = this.options.sortTraversable
		var section_tail
		// fill the children list...
		// NOTE: this will be set to true if make(..) is called at least once...
		var interactive = false
		var size_freed = false

		// NOTE: this is only used for the contextmenu event...
		var debounced = false
		setTimeout(function(){ debounced = true }, 100)


		//---------------------- prepare for new keyboard shortcuts ---
		// clear previous shortcuts...
		var item_shortcuts = this.options.setItemShortcuts ? 
			(this.keybindings.ItemShortcuts = this.keybindings.ItemShortcuts || {})
			: null
		// clear the shortcuts...
		Object.keys(item_shortcuts).forEach(function(k){
			if(k != 'doc' && k != 'pattern'){
				delete item_shortcuts[k]
			}
		})
		var item_shortcut_marker = this.options.itemShortcutMarker
		item_shortcut_marker = item_shortcut_marker ? 
			RegExp(item_shortcut_marker, 'g') 
			: null
		var registered_shortcuts = []

		//--------------------------------------------- define make ---
		// XXX revise signature... 
		var make = function(p, traversable, disabled, buttons){
			var opts = {}

			var hidden = false

			// we've started, no need to hold the size any more... 
			// ...and we do not need to do this more than once.
			that.options.holdSize
				&& (size_freed = !size_freed ? 
					!_freeSize() 
					: true)

			// options passed as an object...
			if(traversable != null && typeof(traversable) != typeof(true)){
				opts = traversable
				var {traversable, disabled, buttons, hidden} = opts }

			buttons = buttons
				|| (that.options.itemButtons 
					&& that.options.itemButtons.slice())

			// NOTE: this is becoming a bit big, so here the code is 
			// 		split into more wieldable sections...
			//------------------------ special case: shorthand item ---
			if(p && (p in (that.options.elementShorthand || {})
					|| (p.hasClass 
						&& p in that.options.elementShorthand
						&& that.options.elementShorthand[p].class
						&& p.hasClass(that.options.elementShorthand[p].class)))){
				var res = p
				var shorthand = that.options.elementShorthand[p]
				if(typeof(res) == typeof('str')){
					res = $(shorthand.html)
						.addClass(shorthand.class || '') }
				opts.attrs
					&& res.attr(opts.attrs)
				opts.style
					&& res.css(opts.style)
				res.appendTo(l)
				return res }

			//------------------------------------------- item text ---
			// array of str/func/dom...
			if(p.constructor === Array){
				// resolve handlers...
				p = p.map(function(e){ 
					return typeof(e) == typeof(function(){}) ? 
						// XXX should this pass anything to the handler 
						// 		and set the context???
						e.call(that, p) 
						: e})

				var txt = p.join('')
				// XXX check if traversable...
				p = $(p.map(function(t){
					return t == '$BUTTONS' ? 
							$('<span/>')
								.addClass('button-container')[0]
						: t instanceof jQuery ?
							t[0]
						: $('<span>')
							.addClass('text')
							.attr('text', t || '')
							// here we also replace empty strings with &nbsp;...
							[t ? 'text' : 'html'](t || '&nbsp;')[0]
				}))

			// jQuery or dom...
			} else if(p instanceof jQuery){
				// XXX is this the correct way to do this???
				var txt = p.text()
				// XXX disable search???
				//console.warn('jQuery objects as browse list elements not yet fully supported.')

			// str and other stuff...
			} else {
				var txt = p = p + ''

				// trailing '/' -- dir...
				var dir = /[\\\/]\s*$/
				traversable = dir.test(p) && traversable == null ? true : traversable
				traversable = traversable == null ? false : traversable
				p = $('<span>')
						.addClass('text')
						.attr('text', p.replace(dir, ''))
						.text(p.replace(dir, ''))
			}

			//---------------------------------- keyboard shortcuts ---
			if(item_shortcuts){
				// key set in options...
				opts.shortcut_key && !item_shortcuts[opts.shortcut_key]
					&& that.keyboard.handler(
						'ItemShortcuts', 
						opts.shortcut_key, 
						//function(){ that.push(res) })
						function(){ that.select(res) })

				// text marker...
				if(item_shortcut_marker){
					var _replace = function(){
						// get the last group...
						var key = [...arguments].slice(-3)[0]
						!item_shortcuts[keyboard.normalizeKey(key)]
							// NOTE: this is a side-effect...
							&& that.keyboard.handler(
								'ItemShortcuts', 
								key,
								//function(){ that.push(res) })
								function(){ that.action(res) })
						return key 
					}

					// clean out markers from text...
					txt = txt.replace(item_shortcut_marker, '$1')

					p.filter('.text')
						.each(function(_, e){
							e = $(e)
							e.html(e.html().replace(item_shortcut_marker, 
								function(){ 
									var k = _replace.apply(this, arguments) 
									var nk = keyboard.normalizeKey(k)
									// only mark the first occurrence...
									var mark = !!(registered_shortcuts.indexOf(nk) < 0 
										&& registered_shortcuts.push(nk))
									return mark ?
										`<span class="keyboard-shortcut">${k}</span>`
										: k })) }) } }
			//---------------------------------------------------------

			// tell the lister that we have started in interactive mode...
			interactive = true

			// skip drawing of non-traversable or disabled elements if
			// .showNonTraversable or .showDisabled are false respectively...
			if((!traversable && !that.options.showNonTraversable)
					|| (disabled && !that.options.showDisabled)
					|| (hidden && !that.options.showHidden)){
				return $()
			}

			//------------------------------------------ build item ---
			var res = $('<div>')
				// handle clicks ONLY when not disabled...
				.click(function(){
					!$(this).hasClass('disabled')
						&& that.push($(this)) })
				.on('contextmenu', function(evt){ 
					evt.preventDefault()
					evt.stopPropagation()

					if(debounced){
						that.select($(this))
						res.trigger('menu', [txt]) 
					}
				})
				// append text elements... 
				.append(p)

			// NOTE: this is not done inline because we need access to 
			// 		res below...
			res.addClass([
				'item',
				// XXX use the same algorithm as .select(..)
				selection && res.text() == selection ? 'selected' : '',

				!traversable ? 'not-traversable' : '',
				disabled ? 'disabled' : '',
				hidden ? 'hidden' : '',
				opts.hide_on_search ? 'hide-on-search' : '',
				(opts.hide_on_search || opts.not_searchable) ? 'not-searchable' : '',
				opts.not_filtered_out ? 'not-filtered-out' : '',
				
				// extra user classes...
				opts.cls || '',
			].join(' '))

			opts.push_on_open 
				&& res.attr('push-on-open', 'on')

			opts.attrs
				&& res.attr(opts.attrs)
			opts.style
				&& res.css(opts.style)

			//--------------------------------------------- buttons ---
			// button container...
			var btn = res.find('.button-container')
			btn = btn.length == 0 ? 
				$('<span/>')
					.addClass('button-container')
					.appendTo(res)
				: btn

			// action (open) button...
			if(traversable && that.options.actionButton){
				btn.append($('<div>')
					.addClass('button')
					.html(that.options.actionButton === true ? 
						'&check;' 
						: that.options.actionButton)
					.click(function(evt){
						evt.stopPropagation()
						that.select(res)
						that.action()
					}))
			}

			// push button...
			if(traversable && that.options.pushButton){
				btn.append($('<div>')
					.addClass('button')
					.html(that.options.pushButton ?
						'p' 
						: that.options.pushButton)
					.click(function(evt){
						evt.stopPropagation()
						that.push(res)
					}))
			}

			// custom buttons...
			buttons && buttons
				.slice()
				// make the order consistent for the user -- first
				// in list, first in item (from left), and should
				// be added last...
				.reverse()
				.forEach(function(e){
					var html = e[0]
					var func = e[1]

					// blank button...
					if(func == null){
						btn.append($('<div>')
							.addClass('button blank')
							.html(html))

					} else {
						btn.append($('<div>')
							.addClass('button')
							.html(html)
							.click(function(evt){
								// prevent clicks from triggering the item action...
								evt.stopPropagation()

								// action name...
								if(typeof(func) == typeof('str')){
									that[func](txt, res)

								// handler...
								} else {
									func.call(that, txt, res)
								}
							}))
					}
				})

			//--------------------------------- user event handlers ---
			res.on('update', function(evt){ evt.stopPropagation() })
			// shorthands...
			;(that.options.itemOptionsEventShorthands || [])
				.forEach(function(p){ res.on(p, opts[p]) })
			// events...
			Object.keys(opts.events || {})
				.forEach(function(evt){
					res.on(evt, opts.events[evt]) })

			//--------------------------------------- place in list ---
			// as-is...
			if(!sort_traversable || sort_traversable == 'none'){
				res.appendTo(l)

			// traversable first/last...
			} else {
				if(sort_traversable == 'first' ? traversable : !traversable){
					section_tail == null ?
						l.prepend(res)
						: section_tail.after(res)
					section_tail = res

				} else {
					res.appendTo(l)
				}
			}
			
			//------------------------------- item lifecycle events ---
			res.trigger('update', txt)

			//---------------------------------------------------------
			return res
		}

		make.__proto__ = Items
		Object.defineProperty(make, 'constructor', {
			value: Items,
			enumerable: false,
		})
		
		// align the dialog...
		make.done = function(){
			var s = l.find('.selected')			
			s.length > 0 && that.select(s)
			return deferred
		}
		make.dialog = this


		//------------------------------------------ build the list ---
		var res = list.call(this, path, make)

		// second API: make is not called and .list(..) returns an Array
		// that will get loaded as list items...
		if(!interactive && res && res.constructor == Array){
			res.forEach(make)
		} 

		// -------------------------------- notify that we are done ---
		// wait for the render...
		if(res && res.then){
			res.then(function(){ deferred.resolve() })

		// sync...
		} else {
			deferred.resolve()
		}

		//return this
		return deferred
			.done(function(){
				that.dom.attr('path', this.strPath)
				that.trigger('update')

				// select the item...
				if(selection){
					that.select('"'+ selection +'"')
				}

				// maintain focus within the widget...
				if(focus && browser.find(':focus').length == 0){
					that.focus()
				}

				// XXX hackish...
				that.updateItemNumbers()
			})
		//-------------------------------------------------------------
	},

	// Update item shortcut key number hints...
	//
	// 	Update hints...
	// 	.updateItemNumbers()
	// 		-> this
	//
	// 	Clear hints...
	// 	.updateItemNumbers(true)
	// 		-> this
	//
	// This should be called every time the list is modified manually, 
	// the automatic side of things is taken care of by .update(..)...
	//
	// XXX hackish -- move this back to CSS as soon as :nth-match(..) gets
	// 		enough support...
	updateItemNumbers: function(clear){
		this.dom
			.find('[shortcut-number]')
				.removeAttr('shortcut-number')
		!clear 
			&& this.filter('*', false)
				.slice(0, 10)
				.each(function(i){ 
					$(this).attr('shortcut-number', (i+1)%10) })
		return this
	},

	// Filter the item list...
	//
	// 	General signature...
	// 	.filter(<pattern>[, <rejected-handler>][, <ignore-disabled>])
	// 		-> elements
	// 	
	//
	// 	Get all elements...
	// 	.filter()
	// 	.filter('*')
	// 		-> all elements
	//
	// 	Get all elements containing a string...
	// 	.filter(<string>)
	// 		-> elements
	// 		NOTE: as whitespace is treated as a pattern separator, if it
	// 			is need explicitly simply quote it...
	// 				'a b c'		- three sub patterns: 'a', 'b' and 'c'
	// 				'a\ b\ c'	- single pattern
	//
	// 	Get element exactly matching a string...
	// 	.filter(<quoted-string>)
	// 		-> elements
	// 		NOTE: this supports bot single and double quotes, e.g. 
	// 			'"abc"' and "'abc'" are equivalent...
	// 		NOTE: only outer quotes are considered, so if there is a 
	// 			need to exactly match '"X"', just add a set of quotes 
	// 			around it, e.g. '""X""' or '\'"X"\''...
	//
	// 	Get all elements matching a regexp...
	// 	.filter(<regexp>)
	// 		-> elements
	//
	// 	Filter the elements via a function...
	// 	.filter(<function>)
	// 		-> elements
	// 		NOTE: the elements passed to the <function> on each iteration
	// 			are unwrapped for compatibility with jQuery API.
	//
	// 	Get specific element...
	// 	.filter(<index>)
	// 	.filter(<jQuery-obj>)
	// 		-> element
	//		-> $()
	// 		NOTE: when passing a jQuery-obj it will be returned iff it's
	// 			an element.
	// 		NOTE: unlike .select(..) index overflow will produce empty 
	// 			lists rather than to/bottom elements.
	//
	// 	Get specific absolute element...
	// 	.filter('<index>!')
	// 		-> element
	//		-> $()
	//		NOTE: this is equivalent to setting ignore_disabled tp false
	//
	// If <rejected-handler> function is passed it will get called with 
	// every element that was rejected by the predicate / not matching 
	// the pattern.
	//
	// By default, <ignore-disabled> is true, thus this will ignore 
	// disabled elements. If <ignore_disabled> is false then disabled 
	// elements will be searched too.
	//
	// If an item has .not-searchable class set, then it will neither be
	// searched nor filtered out.
	//
	// If an item has .not-filtered-out class set, then it will not be 
	// hidden on filtering (see: .filterList(..)).
	//
	// NOTE: this will filter every item loaded regardless of visibility.
	//
	//
	// Extended string patterns:
	//
	// The pattern string is split by whitespace and each resulting 
	// substring is searched independently.
	// Order is not considered.
	//
	// 	Examples:
	// 		'aaa'			- matches any element containing 'aaa'
	// 							(Same as: /aaa/)
	// 		'aa bb'			- matches any element containing both 'aa'
	// 							AND 'bb' in any order.
	// 							(Same as: /aa.*bb|bb.*aa/)
	//
	// NOTE: currently there is no way to search for whitespace explicitly,
	// 		at this point this is "by-design" as an experiment on how
	// 		vital this feature is.
	//
	// TODO need to support glob / nested patterns...
	// 		..things like /**/a*/*moo/ should list all matching items in
	// 		a single list.
	//
	// XXX case sensitivity???
	// XXX invalid patterns that the user did not finish inputing???
	filter: function(pattern, a, b){
		pattern = pattern == null ? '*' : pattern
		var ignore_disabled = typeof(a) == typeof(true) ? a : b
		ignore_disabled = ignore_disabled == null ? true : ignore_disabled
		var rejected = typeof(a) == typeof(true) ? null : a

		var that = this
		var browser = this.dom

		var elems = browser.find('.list .item' 
			+ (this.options.elementSeparatorClass ? 
				':not('+ this.options.elementSeparatorClass +')'
				: '')
			+ (ignore_disabled ? 
				':not(.disabled):not(.filtered-out)' 
				: ''))

		if(pattern == '*'){
			return elems 
		}

		// special case: absolute position...
		if(/\d+!/.test(pattern)){
			return this.filter(parseInt(pattern), rejected, false)
		}

		// function...
		if(typeof(pattern) == typeof(function(){})){
			var filter = function(i, e){
				e = e[0]
				if(!pattern.call(e, i, e)){
					if(rejected){
						rejected.call(e, i, e)
					}
					return false
				}
				return true
			}

		// regexp...
		} else if(pattern.constructor == RegExp
				|| (typeof(pattern) == typeof('str') 
					&& /^(['"]).*\1$/.test(pattern.trim()))){
			if(typeof(pattern) == typeof('str')){
				pattern = toRegExp(pattern.trim().slice(1, -1))
			}
			var filter = function(i, e){
				if(!pattern.test($(e).find('.text').text())){
					if(rejected){
						rejected.call(e, i, e)
					}
					return false
				}
				return true
			}

		// string...
		// NOTE: this supports several space-separated patterns.
		// NOTE: this is case-agnostic...
		// 		...for case sensitivity remove .toLowerCase()...
		// XXX support glob...
		} else if(typeof(pattern) == typeof('str')){
			//var pl = pattern.trim().split(/\s+/)
			var pl = pattern.trim()
				// allow pattern matching regardless of special chars...
				// XXX not sure about this...
				.replace(/\$/g, '')
				// split on whitespace but keep quoted chars...
				.split(/\s*((?:\\\s|[^\s])*)\s*/g)
				// remove empty strings...
				.filter(function(e){ return e.trim() != '' })
				// remove '\' -- enables direct string comparison...
				.map(function(e){ return e.replace(/\\(\s)/g, '$1').toLowerCase() })
			var filter = function(i, e){
				e = $(e)
				var t = e.find('.text').text().toLowerCase()
				for(var p=0; p < pl.length; p++){
					// NOTE: we are not using search here as it treats 
					// 		the string as a regex and we need literal
					// 		search...
					var i = t.indexOf(pl[p])
					if(!(i >= 0)){
						if(rejected){
							rejected.call(e, i, e)
						}
						return false
					}
				}
				return true
			}

		// number...
		} else if(typeof(pattern) == typeof(123)){
			return elems.eq(pattern)

		// jQuery object...
		} else if(elems.index(pattern) >= 0){
			return pattern

		// unknown pattern...
		} else {
			return $()
		}

		return elems.filter(filter)
	},

	// Filter list elements...
	//
	// This will set the .filtered-out class on all non-matching elements.
	//
	// Use .filterList('*') to clear filter and show all elements.
	//
	// If an item has .not-filtered-out class set, then it will not be 
	// hidden on filtering. 
	//
	// NOTE: see .filter(..) for docs on actual filtering.
	// NOTE: this does not affect any UI modes, for list filtering mode
	// 		see: .toggleFilter(..)...
	// XXX should this be case insensitive???
	filterList: function(pattern){
		var that = this
		var browser = this.dom

		// show all...
		if(pattern == null || pattern.trim() == '*' || pattern == ''){
			browser.find('.filtered-out')
				.removeClass('filtered-out')
			// clear the highlighting...
			browser.find('.list b')
				.replaceWith(function(){ return this.innerHTML })

		// basic filter...
		} else {
			// hide stuff that needs to be unconditionally hidden...
			browser.find('.hide-on-search')
				.addClass('filtered-out')

			var p = RegExp('(' 
				+ pattern
					.trim()
					// ignore trailing '\'
					.replace(/\\+$/, '')
					.split(/(?=[^\\])\s/)
					// drop empty strings...
					.filter(function(e){ return e.trim() != '' })
					// remove escapes...
					.map(function(e){ return e.replace(/\\(\s)/, '$1') })
					.join('|') 
				+ ')', 'gi')
			// XXX should this be case insensitive???
			this.filter(pattern,
					// rejected...
					function(i, e){
						!e.hasClass('not-filtered-out')
							&& e
								.addClass('filtered-out')
								.removeClass('selected')

						// clear selection...
						e.find('b')
							.replaceWith(function(){ return this.innerHTML })
					},
					// NOTE: setting this to true will not remove disabled
					// 		elements from view as they will neither get 
					// 		included in the filter nor in the filtered out
					// 		thus it will require manual setting of the
					// 		.filtered-out class
					false)
				// skip non-searchable...
				.filter(':not(.not-searchable)')
				// passed...
				.removeClass('filtered-out')
				// NOTE: this will mess up (clear) any highlighting that was 
				// 		present before...
				.each(function(_, e){
					e = $(e)
						.find('.text')
						// NOTE: here we support multiple text elements per
						// 		list element...
						.each(function(i, e){
							e = $(e)
							var t = e.text()
							e.html(t.replace(p, '<b>$1</b>'))
						})
				})
		}

		return this
	},


	// internal actions...
	
	// full path editing...
	//
	// 	start ---->	edit --(enter)--> stop (accept)
	// 				  |
	// 			 	 +-------(esc)--> abort (reset)
	//
	//
	// NOTE: the event handlers for this are set in .__init__()...
	//
	// XXX should these be a toggle???
	startFullPathEdit: function(){
		if(this.options.fullPathEdit){
			var browser = this.dom
			var path = this.strPath
			var orig = this.selected
			browser
				.attr('orig-path', path)
				.attr('orig-selection', orig)

			var range = document.createRange()
			var selection = window.getSelection()

			var e = browser.find('.path')
				.text(path)
				.attr('contenteditable', true)
				.focus()

			range.selectNodeContents(e[0])
			selection.removeAllRanges()
			selection.addRange(range)
		}
		return this
	},
	abortFullPathEdit: function(){
		var browser = this.dom
		var e = browser.find('.path')

		var path = '/' + browser.attr('orig-path')
		var selection = browser.attr('orig-selection')

		this.stopFullPathEdit(path)

		if(selection != ''){
			this.select(selection)	
		}

		return this
	},
	stopFullPathEdit: function(path){
		var browser = this.dom
			.removeAttr('orig-path')
			.removeAttr('orig-selection')

		var e = browser.find('.path')
			.removeAttr('contenteditable')

		this.path = path || e.text()

		return this
			.focus()
	},
	
	// list filtering...
	//
	// 	start ---->	edit / select --(enter)--> action (use selection)
	// 					 |
	// 					 +-------(blur/esc)--> exit (clear)
	//
	//
	// NOTE: the action as a side effect exits the filter (causes blur 
	// 		on filter field)...
	// NOTE: this uses .filter(..) for actual filtering...
	// NOTE: on state change this will return this...
	toggleFilter: toggler.CSSClassToggler(
		function(){ return this.dom }, 
		'filtering',
		// do not enter filter mode if filtering is disabled...
		function(action){ return action != 'on' || this.options.filter },
		function(action){
			// on...
			if(action == 'on'){
				var range = document.createRange()
				var selection = window.getSelection()

				var that = this
				var e = this.dom.find('.path .dir.cur')
					//.text('')
					.attr('contenteditable', true)

				// place the cursor...
				//range.setStart(e[0], 0)
				//range.collapse(true)
				range.selectNodeContents(e[0])
				selection.removeAllRanges()
				selection.addRange(range)
					
			// off...
			} else {
				this.filterList('*')
				this.dom
					.find('.path .dir.cur')
						.text('')
						.removeAttr('contenteditable')

				// NOTE: we might select an item outside of the current visible
				// 		area, thus re-selecting it after we remove the filter 
				// 		will place it correctly.
				this.select(this.select('!'))

				this.focus()
			}

			return this
		}),
	// shorthands mostly for use as actions...
	startFilter: function(){ return this.toggleFilter('on') },
	stopFilter: function(){ return this.toggleFilter('off') },

	// Toggle filter view mode...
	toggleFilterViewMode: function(){
		this.dom.toggleClass('show-filtered-out')
		return this },

	// XXX should this be a toggler???
	disableElements: function(pattern){
		this.filter(pattern, false)
			.addClass('disabled')
			.removeClass('selected')
		return this },
	enableElements: function(pattern){
		this.filter(pattern, false)
			.removeClass('disabled')
		return this },

	// Select an element from current list...
	//
	// This is like .filter(..) but:
	// 	- adds several special case arguments (see below)
	// 	- gets it first matched element and selects it
	// 	- takes care of visual scrolling.
	//
	//	Get selected element if it exists, otherwise select and return 
	//	the first...
	//	.select()
	//		-> elem
	//
	//	Get selected element if it exists, null otherwise...
	//	.select('!')
	//		-> elem
	//		-> $()
	//
	//	Deselect
	//	.select(null)
	//		-> $()
	//
	//	Select jQuery object...
	//	.select(<elem>)
	//		-> elem
	//		-> $()
	//
	// All other call configurations are like .filter(..) so see that 
	// for more info.
	//
	// This will return a jQuery object.
	//
	// This will trigger the 'select' or 'deselect' events.
	//
	// For uniformity and ease of access from DOM, this will also set 
	// the value attr on the .browse-widget element.
	// NOTE: this is one way and setting the html attribute "value" will
	// 		not affect the selection, but changing the selection will 
	// 		overwrite the attribute.
	//
	// NOTE: if multiple matches occur this will select the first.
	// NOTE: 'none' will always return an empty jQuery object, to get 
	// 		the selection state before deselecting use .select('!')
	// NOTE: this uses .filter(..) for string and regexp matching...
	// NOTE: this will not select disabled elements (XXX)
	select: function(elem, filtering){
		var browser = this.dom
		var pattern = '.list .item'
			+ (this.options.elementSeparatorClass ? 
				':not('+ this.options.elementSeparatorClass +')'
				: '')
			+':not(.disabled):not(.filtered-out):visible'
		var elems = browser.find(pattern)

		if(elems.length == 0){
			return $()
		}

		filtering = filtering == null ? this.toggleFilter('?') == 'on' : filtering

		// empty list/string selects none...
		elem = elem != null && elem.length == 0 ? null : elem
		// no args -> either we start with the selected or the first...
		if(elem === undefined){
			var cur = this.select('!')
			elem = cur.length == 0 ? 0 : cur
		}

		// explicit deselect...
		if(elem === null){
			if(!filtering){
				browser.find('.path .dir.cur').empty()
			}
			elems = elems
				.filter('.selected')
				.removeClass('selected')
				.trigger('deselect')
			this.trigger('deselect', elems)
			return $()
		}

		// strict...
		if(elem == '!'){
			return elems.filter('.selected')
		}

		var item = elem instanceof $ ? elem : this.filter(elem).first()

		// we found a match or got an element...
		// NOTE: if elem was a keyword it means we have an item with the
		// 		same text on the list...
		if(item.length != 0){
			elem = $(item).first()

			// clear selection...
			this.select(null, filtering)

			// XXX not sure if this is correct...
			if(elem.hasClass('disabled')){
				return $()
			}

			if(!filtering){
				browser.find('.path .dir.cur').text(elem.find('.text').text())
			}

			// handle scroll position...
			var p = elem.scrollParent()
			var S = p.scrollTop()
			var H = p.height()

			var h = elem.height()
			var t = elem.offset().top - p.offset().top

			// XXX should this be in config???
			var D = 3 * h 

			// too low...
			if(t+h+D > H){
				p.scrollTop(S + (t+h+D) - H)

			// too high...
			} else if(t < D){
				p.scrollTop(S + t - D)
			}

			// now do the selection...
			elem.addClass('selected')
			browser.attr('value', elem.find('.text').text())

			this.trigger('select', elem)

			// handle path scroll -- scroll to the end when wider than view...
			var p = browser.find('.path')
			if(p[0].offsetWidth < p[0].scrollWidth){
				// scroll all the way to the right...
				p.scrollLeft(p[0].scrollWidth)

			// keep left aligned...
			} else {
				p.scrollLeft(0)
			}

			return elem
		}

		// nothing found...
		return $()
	},

	// Navigate relative to selection...
	//
	// 	Navigate to first/previous/next/last element...
	// 	.navigate('first')
	// 	.navigate('prev')
	// 	.navigate('next')
	// 	.navigate('last')
	// 		-> elem
	// 		NOTE: this will overflow, i.e. navigating 'next' when on the
	// 				last element will navigate to the first.
	// 		NOTE: when no element is selected, 'next' will select the 
	// 				first, while 'prev' the last element's
	//
	// 	Navigate to element above/below current element...
	// 	.navigate('up')
	// 	.navigate('down')
	// 		-> elem
	//
	// 	Deselect element...
	// 	.navigate('none')
	// 		-> elem
	//
	//
	// Other arguments are compatible with .select(..) and then .filter(..)
	// but note that this will "shadow" any element with the save name as
	// a keyword, e.g. if we have an element with the text "next", 
	// .navigate('next') will simply navigate to the next element while
	// .select('next') / .filter('next') will yield that element by name.
	navigate: function(action, filtering){
		var pattern = '.list .item'
			+ (this.options.elementSeparatorClass ? 
				':not('+ this.options.elementSeparatorClass +')'
				: '')
			+':not(.disabled):not(.filtered-out):visible'
		action = action || 'first'
																   
		if(action == 'none'){
			return this.select(null, filtering)

		} else if(action == 'next' || action == 'prev'){
			var all = this.filter('*')
			//var to = this.select('!', filtering)[action+'All'](pattern).first()
			var to = all.eq(all.index(this.select('!', filtering)) + (action == 'next' ? 1 : -1))

			// stop keyboard repeat...
			to.length == 1
				&& this.options.keyboardRepeatPause > 0
				&& this.keyboard.pauseRepeat 
				&& this.keyboard.pauseRepeat()

			// range check and overflow...
			if(to.length == 0){
				action = action == 'next' ? 'first' : 'last'

			} else {
				return this.select(to, filtering)
			}

		} else if(action == 'down' || action == 'up'){
			var from = this.select('!', filtering)
			var all = this.filter('*')

			// special case: nothing selected -> select first/last...
			if(from.length == 0){
				return this.navigate(action == 'down' ? 'first' : 'last')
			}

			var t = from.offset()
			var l = t.left
			t = t.top

			// next lines...
			//var to = from[(action == 'down' ? 'next' : 'prev') +'All'](pattern)
			var to = (action == 'down' ?
					all.slice(all.index(from))
					: $(all.slice(0, all.index(from)).toArray().reverse()))
				.filter(function(_, e){ return $(e).offset().top != t })

			// stop keyboard repeat...
			to.length == 1
				&& this.options.keyboardRepeatPause > 0
				&& this.keyboard.pauseRepeat 
				&& this.keyboard.pauseRepeat()

			// special case: nothing below -> select wrap | last/first...
			if(to.length == 0){
				// select first/last...
				//return this.navigate(action == 'down' ? 'last' : 'first')
				
				// wrap around....
				to = this.filter('*').filter(pattern)

				// when going up start from the bottom...
				if(action == 'up'){
					to = $(to.toArray().reverse())
				} 
			}
			
			t = to.eq(0).offset().top
			to = to
				// next line only...
				.filter(function(_, e){ return $(e).offset().top == t })
				// sort by distance...
				// XXX this does not account for element width...
				.sort(function(a, b){
					return Math.abs(l - $(a).offset().left) 
						- Math.abs(l - $(b).offset().left)
				})
				.first()

			return this.select(to, filtering)
		}

		return action == 'first' ? this.select(0, filtering)
			: action == 'last' ? this.select(-1, filtering)
			// fall back to select...
			: this.select(action, filtering)
	},
	
	// shorthand actions...
	next: makeSimpleAction('next'),
	prev: makeSimpleAction('prev'),

	up: makeSimpleAction('up'),
	down: makeSimpleAction('down'),
	left: function(elem){
		if(elem != null){
			this.select(elem)
		}
		return this.cloud ?
			this.navigate('prev')
			: this.pop()
	},
	right: function(elem){
		if(elem != null){
			this.select(elem)
		}
		return this.cloud ?
			this.navigate('next')
			: this.push()
	},


	getTopVisibleElem: function(){
		var elems = this.filter('*')

		var p = elems.first().scrollParent()
		var S = p.scrollTop()
		var T = p.offset().top

		if(S == 0){
			return elems.first()
		}

		return elems
			.filter(function(i, e){
				return $(e).offset().top - T >= 0
			})
			.first()
	},
	getBottomVisibleElem: function(){
		var elems = this.filter('*')

		var p = elems.first().scrollParent()
		var S = p.scrollTop()
		var T = p.offset().top
		var H = p.height()

		if(S + H == p[0].scrollHeight){
			return elems.last()
		}

		return elems
			.filter(function(i, e){
				e = $(e)
				return e.offset().top + e.height() <= T + H
			})
			.last()
	},
	// NOTE: this will not give a number greater than the number of 
	// 		elements, thus for lists without scroll, this will always
	// 		return the number of elements.
	// XXX this will not count the elements at the top if they are 
	// 		disabled...
	getHeightInElems: function(){
		var t = this.getTopVisibleElem()
		var b = this.getBottomVisibleElem()

		var res = 1
		while(!t.is(b)){
			t = t.next()
			if(t.length == 0){
				break
			}
			res += 1
		}

		return res
	},

	// XXX there are two modes of doing page travel:
	// 		1) keep relative to page position
	// 		2) travel up on top element and down on bottom (curret)
	// 		...is this the natural choice?
	// XXX merge with .select(..)???
	// XXX still not too happy with this, item sizes will throw this
	// 		off...
	prevPage: function(){
		var t = this.getTopVisibleElem()
		var cur = this.select('!')

		// nothing selected...
		if(cur.length == 0 
				// element not near the top...
				// XXX make the delta configurable (see .select(..) 
				// 		for same issue)...
				|| cur.offset().top - t.offset().top > (3 * t.height())){
			// select top...
			this.select(t)

		// make the top bottom...
		} else {
			var p = t.scrollParent()
			var S = p.scrollTop()
			var H = p.height()

			// rough scroll...
			// XXX make the delta configurable (see .select(..) 
			// 		for same issue)...
			p.scrollTop(S - (H - 4 * t.height()))

			// select the element and fix scrolling errors...
			this.select(this.getTopVisibleElem())
		}

		return this
	},
	// XXX this is essentially identical to .prevPage(..)
	nextPage: function(){
		var b = this.getBottomVisibleElem()
		var cur = this.select('!')


		// nothing selected...
		if(cur.length == 0 
				// element not near the top...
				// XXX make the delta configurable (see .select(..) 
				// 		for same issue)...
				|| b.offset().top - cur.offset().top > (3 * b.height())){
			// select bottom...
			this.select(b)

		// make the top bottom...
		} else {
			var p = b.scrollParent()
			var S = p.scrollTop()
			var H = p.height()

			// rough scroll...
			// XXX make the delta configurable (see .select(..) 
			// 		for same issue)...
			p.scrollTop(S + (H - 4 * b.height()))

			// select the element and fix scrolling errors...
			this.select(this.getBottomVisibleElem())
		}

		return this
	},
	
	// Push an element to path / go down one level...
	//
	// This will trigger the 'push' event.
	//
	// NOTE: if the element is not traversable it will be opened.
	//
	// XXX might be a good idea to add a live traversable check...
	// XXX revise event...
	push: function(pattern){
		var browser = this.dom 
		var cur = this.select('!')
		var elem = arguments.length == 0 ? 
			cur 
			: this.filter(/-?[0-9]+/.test(pattern) ? pattern
				// XXX avoid keywords that .select(..) understands...
				//: '"'+pattern+'"' )
				: pattern)

		// item not found...
		if(elem.length == 0 && pattern != null){
			return this
		}

		// item disabled...
		if(elem.hasClass('disabled')){
			return this
		}

		// nothing selected, select first and exit...
		if(cur.length == 0 && elem.length == 0){
			this.select()
			return this
		}

		// if not traversable call the action...
		if(!this.traversable || elem.hasClass('not-traversable')){
			this.select(elem)
			return this.action()
		}

		this.select(elem)

		var path = this.path
		// XXX do we need qotes here???
		//path.push('"'+ elem.find('.text').text() +'"')
		path.push(elem.find('.text').text())

		// XXX should this be before or after the actual path update???
		// XXX can we cancel the update from a handler???
		this.trigger('push', path)

		// do the actual traverse...
		this.path = path

		this.select()

		return this
	},

	// Pop an element off the path / go up one level...
	//
	// This will trigger the 'pop' event.
	//
	// XXX revise event...
	pop: function(){
		var that = this
		var browser = this.dom

		if(!this.traversable){
			return this
		}

		var path = this.path
		var dir = path.pop()

		// XXX should this be before or after the actual path update???
		// XXX can we cancel the update from a handler???
		this
			.trigger('pop', path)
			.update(path)
				.done(function(){
					that.select('"'+dir+'"')
				})

		return this
	},

	// Pre-open action...
	//
	// This opens (.open(..)) the selected item and if none are selected
	// selects the default (.select()) and exits.
	//
	// NOTE: this ignores items with empty text...
	// 		XXX not sure about this...
	action: function(elem){
		elem = this.select(elem || '!')

		// nothing selected, select first and exit...
		if(elem.length == 0){
			//this.select()
			return this
		}

		var path = this.path

		var txt = elem.find('.text').text()

		// if text is empty, skip action...
		if(txt != ''){
			//path.push(elem.find('.text').text())
			path.push(txt)

			var res = this.open(path)
		}

		return res
	},


	// Extension methods...
	// ...these are resolved from .options

	// Open action...
	//
	// 	Open current element...
	// 	NOTE: if no element selected this will do nothing.
	// 	NOTE: this will return the return of .options.open(..) or the 
	// 		full path if null is returned...
	// 	.open()
	// 		-> this
	// 		-> object
	//
	// 	Open a path...
	// 	.open(<path>)
	// 		-> this
	// 		-> object
	//
	// 	Register an open event handler...
	// 	.open(<function>)
	// 		-> this
	//
	//
	// The following signatures are relative from current context via 
	// .select(..), see it for more details...
	// NOTE: this will also select the opened element, so to get the full
	// 		path from the handler just get the current path and value:
	// 			browser.dom.attr('path') +'/'+ browser.dom.attr('value')
	// 		or:
	// 			browser.selectionPath
	//
	// 	Open first/last element...
	// 	.open('first')
	// 	.open('last')
	// 		-> this
	//
	// 	Open next/prev element...
	// 	.open('next')
	// 	.open('prev')
	// 		-> this
	//
	// 	Open active element at index...
	// 	.open(<number>)
	// 		-> this
	//
	// 	Open element by absolute index...
	// 	.open('<number>!')
	// 		-> this
	//
	// 	Open element by full or partial text...
	//	.open('<text>')
	//	.open("'<text>'")
	//	.open('"<text>"')
	// 		-> this
	//
	//	Open first element matching a regexp...
	//	.open(<regexp>)
	// 		-> this
	//
	//	Open an element explicitly...
	//	.open(<elem>)
	// 		-> this
	//
	//
	// This will trigger the 'open' event on the opened element and the
	// widget.
	//
	// This is called when an element is selected and opened.
	//
	// By default this happens in the following situations:
	// 	- an element is selected and Enter is pressed.
	// 	- an element is not traversable and push (Left, click) is called.
	//
	// By default this only triggers the 'open' event on both the browser
	// and the selected element if one exists.
	//
	// This is signature compatible with .select(..) but adds support 
	// for full paths.
	//
	// The .options.open(..), if defined, will always get the full path 
	// as first argument.
	//
	// If 'push-on-open' attribute is set on an element, then this will 
	// also pass the element to .push(..)
	//
	// NOTE: if nothing is selected this will do nothing...
	// NOTE: internally this is never called directly, instead a pre-open
	// 		stage is used to execute default behavior not directly 
	// 		related to opening an item (see: .action()).
	// NOTE: unlike .list(..) this can be used directly if an item is 
	// 		selected and an actual open action is defined, either in an
	// 		instance or in .options
	open: function(path){ 
		// special case: register the open handler...
		if(path instanceof Function){
			return this.on('open', path.bind(this)) }

		var elem = this.select('!')

		// normalize and load path...
		if(path && (path.constructor == Array || /[\\\/]/.test(path))){
			path = this.path2list(path)
			var elem = path.slice(-1)[0]

			// only update path if it has changed...
			if(this.path.filter(function(e, i){ return e == path[i] }).length != path.length - 1){
				this.path = path.slice(0, -1)
			}

			elem = this.select('"'+ elem +'"')

		// get path + selection...
		} else {
			// select-compatible -- select from current context...	
			if(!path){
				// NOTE: this is select compatible thus no need to quote 
				// 		anything here...
				elem = this.select(path)
			}

			if(elem.length == 0){
				return this
			}

			path = this.path
			// NOTE: we are quoting here to get a explicit element 
			// 		selected from list...
			path.push('"'+ elem.find('.text').text() +'"')
		}

		// get the options method and call it if it exists...
		var m = this.options.open
		var args = [...arguments]
		args[0] = path
		var res = m ? m.apply(this, args) : this
		res = res || this

		// XXX do we stringify the path???
		// XXX should we use .strPath here???
		path = this.options.pathPrefix + path.join('/')

		// trigger the 'open' events...
		this.trigger('open', path)

		if(elem.length > 0){
			// push an element if attr is set... 
			// NOTE: a good way to do this is to check if we have any 
			// 		handlers bound, but so var I've found no non-hack-ish
			// 		ways to do this...
			elem.attr('push-on-open') == 'on'
				&& this.push(elem)
		}

		return res
	},

	// List current path level...
	//
	// This will get passed a path and an item constructor and should 
	// return a list.
	//
	// NOTE: This is not intended for direct client use, rather it is 
	// 		designed to either be overloaded by the user in an instance 
	// 		or in the .options
	//		To re-list/re-load the view use .update()
	//
	//
	// There are two mods of operation:
	//
	// 1) interactive:
	// 		.list(path, make)
	// 			- for each item make is called with it's text
	//			- make will return a jQuery object of the item
	//
	// 		NOTE: selection is currently done based on .find('.text').text() thus the 
	// 			modification should not affect it's output...
	//
	// 2) non-interactive:
	// 		.list(path) -> list
	// 			- .list(..) should return an array
	// 			- make should never get called
	// 			- the returned list will be rendered
	//
	//
	// This can set the following classes on elements:
	//
	// 	.disabled
	// 		an element is disabled.
	//
	// 	.non-traversable
	// 		an element is not traversable/listable and will trigger the
	// 		.open(..) on push...
	//
	// XXX need a way to constructively communicate errors up...
	// XXX also need a load strategy when something bad happens...
	// 		...e.g. load up until the first error, or something like:
	// 			while(!this.list(path, make)){
	// 				path.pop()
	// 			}
	list: function(path, make){
		path = path || this.path
		var m = this.options.list
		return m ? 
			m.apply(this, arguments) 
			: [] },

	// Run a function in the context of the object...
	//
	run: function(func){
		var res = func ? func.call(this) : undefined
		return res === undefined ? 
			this 
			: res },

	// XXX need to get a container -- UI widget API....
	// XXX paste does not work on IE yet...
	// XXX handle copy...
	__init__: function(parent, options){
		var that = this

		object.parentCall(Browser.prototype.__init__, this, parent, options)

		var dom = this.dom
		options = this.options

		// handle close event...
		options.close
			&& this.close(options.close)

		// basic permanent interactions...
		dom.find('.path')
			// NOTE: these are used for full-path editing and are defined
			// 		here in contrast to other feature handlers as the
			// 		'.path' element is long-lived and not rewritten 
			// 		on .update(..)
			.dblclick(function(){
				that.startFullPathEdit()
			})
			.keyup(function(){
				var e = $(this)
				// clear the list on edit...
				if(e.attr('contenteditable') && e.text() != dom.attr('orig-path')){
					dom.find('.list').empty()
				}
			})
			/* XXX 
			// Handle copy/paste...
			//
			// Make the whole widget support copy/paste of current path.
			//
			// NOTE: on nw.js mode this will handle this via keyboard 
			// 		directly, skipping the events and their quirks...
			//
			// XXX does not work on IE yet...
			// XXX do we handle other types???
			// 		...try and get the path of anything, including files, dirs, etc...
			// XXX seems not to work until we cycle any of the editable
			// 		controls (filter/path), and then it still is on and 
			// 		off...
			// XXX does not work with ':not([contenteditable])' and kills
			// 		copy/paste on editable fields without...
			// XXX do we bother with these??
			.on('paste', ':not([contenteditable])', function(){
				event.preventDefault()
				that.paste()
			})
			// XXX does not work...
			.on('cut copy', function(){
				event.preventDefault()
				that.copy()
			})
			*/

		// attach to parent...
		parent != null
			&& parent.append(dom)

		// load the initial state...
		// NOTE: path can be a number so simply or-ing here is a bad idea...
		var path = options.path != null ? options.path : that.path
		var selected = options.selected
		typeof(path) == typeof(123) ?
			// select item number...
			that
				.update()
				.then(function(){ 
					that.select(path) })
			// select path...
			: that
				.update(path || '/')
				// Select the default path...
				.then(function(){ 
					// explicit config selection...
					// NOTE: this takes precedence over the path syntax...
					// XXX not sure if we need this...
					// 		...currently this is used only when path is 
					// 		a list and we need to also select an item...
					selected ? 
						that.select(selected) 
					// we have a manually selected item but that was 
					// not aligned...
					: that.selected ? 
						that.select()
					: null })
	},
}


var Browser = 
module.Browser = 
object.Constructor('Browser', 
		widget.Widget,
		BrowserClassPrototype, 
		BrowserPrototype)



/*********************************************************************/

var Lister = 
module.Lister = 
object.Constructor('Lister', Browser, {
	options: {
		__proto__: Browser.prototype.options,

		pathPrefix: '', 
		fullPathEdit: false,
		traversable: false,
		flat: true,

		// XXX not sure if we need these...
		skipDisabledItems: false,
		// NOTE: to disable this set it to false or null
		isItemDisabled: '^- ',
	},
})


// This is a shorthand for: new List(<elem>, { data: <list> })
var makeLister = 
module.makeLister = function(elem, lister, options){
	var opts = {}
	for(var k in options){
		opts[k] = options[k]
	}
	opts.list = lister
	return Lister(elem, opts)
}



/*********************************************************************/

// Flat list...
//
// This expects a data option set with one of the following formats:
// 	{
// 		<option-text>: <callback>,
// 		...
// 	}
//
// or:
// 	[
// 		<option-text>,
// 		...
// 	]
//
// If <option-test> starts with a '- ' then it will be added disabled,
// to control the pattern use the .isItemDisabled option, and to 
// disable this feature set it to false|null.
// 	
// NOTE: this essentially a different default configuration of Browser...
// NOTE: this is essentially a wrapper around make.List(...)
var List = 
module.List = 
object.Constructor('List', Browser, {
	options: {
		__proto__: Browser.prototype.options,

		pathPrefix: '', 
		fullPathEdit: false,
		traversable: false,
		flat: true,

		// XXX not sure if we need these...
		skipDisabledItems: false,
		// NOTE: to disable this set it to false or null
		isItemDisabled: '^- ',

		list: function(path, make){
			var that = this
			var data = this.options.data

			var res = []

			// this is here to get the modified titles...
			var _make = function(txt){
				res.push(txt)
				return make.apply(make, arguments)
			}
			_make.__proto__ = make

			// build the list...
			_make
				.List(data, {
					isItemDisabled: this.options.isItemDisabled,
					skipDisabledItems: this.options.skipDisabledItems,
				})

			return res
		},
	},
})


// This is a shorthand for: new List(<elem>, { data: <list> })
var makeList = 
module.makeList = makeBrowserMaker(List)



/*********************************************************************/

// Make an list/Array editor...
//
//
// For options format see: Items.EditableList(..)
var makeListEditor = 
module.makeListEditor =
function(list, options){
	return makeLister(null, 
		function(path, make){
			make.EditableList(list, options) }, 
		options) }



/*********************************************************************/

// This is similar to List(..) but will parse paths in keys...
//
// Path grammar:
//
// 	PATH ::= [/]<dirs>				- simple traversable path
// 			| [/]<dirs>/<item>		- path with last item non-traversable
// 			| [/]<dirs>/*			- path to lister
//
// 	<dirs> ::= <item> 
// 			| <dirs>/<item>/
//
// 	<item> ::= <name>				- explicit path element 
// 			| <item>|<name>			- multiple path elements (a-la simlink)
//
// 	<name> ::= [^\|\\\/]*
//
// 	NOTE: <dirs> always ends with '/' or '\' and produces a set of 
// 		traversable items.
// 	NOTE: the last item is non-traversable iff:
// 		- it does not end with '/' or '\'
// 		- there is no other path defined where it is traversable
//
//
// Format:
// 	{
// 		// basic 'file' path...
// 		// NOTE: this path is non-traversable by default, but if a 
// 		//		sub-path handler is defined (e.g. 'dir/file/x') then this
// 		//		will be set traversable...
// 		'dir/file': function(evt, path){ .. },
//
// 		// file object at the tree root...
// 		// NOTE: the leading '/' is optional...
// 		'file': function(evt, path){ .. },
//
// 		// a directory handler is defined by path ending with '/', 
// 		// set traversable...
// 		'dir/dir/': function(evt, path){ .. },
//
// 		// add a file object to two dirs...
// 		'dir|other/other file': function(evt, path){ .. },
//
//		// path lister...
//		'dynamic/*': function(path, make){ .. }
// 	}
//
// The above definition will be interpreted into the following tree:
//
// 	/
// 		dir/
// 			file
// 			dir/
// 			other file
// 		file
// 		other/
// 			other file
// 		dynamic/
// 			..
//
// Here the contents of the '/dynamic/' path are generated by the matching 
// lister for that pattern path...
//
// NOTE: in the A|B|C pattern, ALL of the alternatives will be created.
// NOTE: there may be multiple matching patterns/listers or a given path
// 		the one used is the longest match.
// NOTE: if path is receded with '- ' ('- a|b/c') then the basename of 
// 		that path will be disabled, to control the pattern use
// 		.isItemDisabled and to disable this feature set it to false.
//
//
// Handler format:
// 	function(evt, path){ .. }
//
// 		This function will be called on the 'open' event for the defined 
// 		item.
//
//
// Lister format:
// 	function(path, make){ .. } -> list
//
//		This function will get called on .update(..) of the matching path.
//
//		make(text, traversable) is a list item constructor.
//		for more docs see: Browser.list(..)
//
//
// NOTE: listers take precedence over explicit path definitions, thus 
// 		if a custom lister pattern intersects with a normal path the path
// 		will be ignored and the lister called.
// NOTE: currently only trailing '*' are supported.
//
// XXX add support for '*' and '**' glob patterns...
var PathList = 
module.PathList = 
object.Constructor('PathList', Browser, {
	options: {
		__proto__: Browser.prototype.options,

		fullPathEdit: true,
		traversable: true,
		flat: false,

		// XXX not sure if we need these...
		skipDisabledItems: false,
		// NOTE: to disable this set it to false or null
		isItemDisabled: '^- ',

		list: function(path, make){
			var that = this
			var data = this.options.data
			var keys = data.constructor == Array ? data : Object.keys(data)
			var pattern = this.options.isItemDisabled 
				&& RegExp(this.options.isItemDisabled)

			if(pattern && this.options.skipDisabledItems){
				keys = keys.filter(function(k){ return !pattern.test(k) })
			}

			var visited = []

			// match path elements accounting for patterns...
			//
			// Supported patterns:
			// 	A		- matches A exactly
			// 	A|B		- matches either A or B
			// 	shortcut marker
			// 			- see .options.itemShortcutMarker
			//
			// NOTE: only the second argument is checked for '|' patterns...
			var match = function(a, path){
				var marker = that.options.itemShortcutMarker 
				marker = marker && RegExp(marker, 'g')
				path = marker ? path.replace(marker, '$1') : path
				// NOTE: might be good to make this recursive when expanding
				// 		pattern support...
				return a
						.split('|')
						.map(function(e){ 
							return marker ? e.replace(marker, '$1') : e })
						.filter(function(e){ 
							return e == path })
						.length > 0 }

			// get the '*' listers...
			var lister = keys
				.filter(function(k){ 
					return k.trim().split(/[\\\/]+/g).pop() == '*' })
				.filter(function(k){
					k = k.split(/[\\\/]+/)
						// remove the trailing '*'...
						.slice(0, -1)

					// do the match...
					return k.length <= path.length 
						&& k.filter(function(e, i){ 
								return e != '*' && !match(e, path[i])
							}).length == 0 })
				.sort(function(a, b){ return a.length - b.length})
				.pop()

			// use the custom lister (defined by trailing '*')...
			if(data !== keys && lister){
				return data[lister].call(this, this.options.pathPrefix + path.join('/'), make)

			// list via provided paths...
			} else {
				return keys
					.map(function(k){
						var disable = null
						if(pattern){
							var n = k.replace(pattern, '')
							disable = n != k
							k = n
						}

						var kp = k.split(/[\\\/]+/g)
						kp[0] == '' && kp.shift()

						// see if we have a star...
						var star = kp.slice(-1)[0] == '*'
						star && kp.pop()

						// get and check current path, continue if relevant...
						var p = kp.splice(0, path.length)
						if(kp.length == 0 
								|| p.length < path.length
								|| p.filter(function(e, i){ return !match(e, path[i]) }).length > 0){
							return false
						}

						// get current path element if one exists and we did not create it already...
						cur = kp.shift()
						if(cur == undefined){
							return false
						}

						cur.split('|')
							// skip empty path items...
							// NOTE: this avoids creating empty items in cases
							// 		of paths ending with '/' or containing '//'
							.filter(function(e){ return e.trim() != '' })
							.forEach(function(cur){
								if(visited.indexOf(cur) >= 0){
									// set element to traversable if we visit it again...
									if(kp.length > 0){
										that.filter(cur, false)
											.removeClass('not-traversable')
											//.removeClass('disabled')
									}
									return false
								}
								visited.push(cur)

								// build the element....
								var e = make(cur,
									star || kp.length > 0, 
									// XXX this might still disable a dir...
									!star && kp.length == 0 && disable)

								// setup handlers...
								if(!star && data !== keys && kp.length == 0 && data[k] != null){
									e.on('open', function(){ 
										return that.options.data[k].apply(this, arguments)
									})
								}
							})

						return cur
					})
					.filter(function(e){ return e !== false })
			}
		},
	},
})


var makePathList = 
module.makePathList = makeBrowserMaker(PathList)




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
