/**********************************************************************
* 
* Keyboard handler
*
* This provides language layout independent way to handle keyboard 
* control based on the base English language keys.
*
*
*
* Non-US English punctuation
* 	Difene a new layout then overload SHIFT_KEYS and regenerate 
* 	UNSHIFT_KEYS via:
* 		UNSHIFT_KEYS = reverseDict(SHIFT_KEYS)
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var object = require('lib/object')


/*********************************************************************/
// Helpers...

var reverseDict = 
module.reverseDict =
function(dict, res={}){
	for(var k in dict){
		res[dict[k]] = k }
	return res }



/*********************************************************************/

var MODIFIERS =
module.MODIFIERS = [ 'caps', 'ctrl', 'meta', 'alt', 'shift' ]


var KEY_SEPARATORS =
module.KEY_SEPARATORS = ['+', '-', '_']


// Neither SPECIAL_KEYS nor KEY_CODES are meant for direct access, use
// toKeyName(<code>) and toKeyCode(<name>) for a more uniform access.
//
// NOTE: these are un-shifted ASCII key names rather than actual key 
// 		code translations.
// NOTE: ASCII letters (capital) are not present because they actually 
// 		match their key codes and are accessible via:
// 			String.fromCharCode(<code>) or <letter>.charCodeAt(0)
// NOTE: the lower case letters are accessible by adding 32 to the 
// 		capital key code.
// NOTE: this is *mostly* language agnostic.
// NOTE: don't understand why am I the one who has to write this...
var SPECIAL_KEYS =
module.SPECIAL_KEYS = {
	// Special Keys...
	 8: 'Backspace',		 9: 'Tab',				13: 'Enter',	
	16: 'Shift',			17: 'Ctrl',				18: 'Alt',			
	20: 'Caps Lock',		27: 'Esc',				32: 'Space',		
	33: 'PgUp',				34: 'PgDown',			35: 'End',			 
	36: 'Home',				37: 'Left',				38: 'Up',	 
	39: 'Right',  			40: 'Down',				45: 'Ins',		
	46: 'Del',				91: 'Win',				93: 'Menu',		

	// Function Keys...
	112: 'F1',		113: 'F2',		114: 'F3',		115: 'F4',		
	116: 'F5',		117: 'F6',		118: 'F7',		119: 'F8',		
	120: 'F9',		121: 'F10',		122: 'F11',		123: 'F12',

	// Number row..
	// NOTE: to avoid conflicts with keys that have a code the same as
	// 		the value of a number key...
	// 			Ex:
	// 				'Backspace' (8) vs. '8' (56)
	// 				'Tab' (9) vs. '9' (57)
	// 		...all of the numbers start with a '#'
	// 		this is a problem due to JS coercing the types to string
	// 		on object attr access.
	// 			Ex:
	// 				o = {1: 2}
	// 				o[1] == o['1'] == true
	49: '#1',	50: '#2',	51: '#3',	52: '#4',	53: '#5',
	54: '#6', 	55: '#7',	56: '#8',	57: '#9',	48: '#0',

	// Punctuation...
	// top row...
	192: '`',		/* Numbers */		189: '-',	187: '=',

							// right side of keyboard...
							219: '[',	221: ']',	220: '\\',
							186: ';',	222: '\'',
				188: ',',	190: '.',	191: '/',
}
// build a reverse map of SPECIAL_KEYS
var KEY_CODES =
module.KEY_CODES = {}
	reverseDict(SPECIAL_KEYS)


var SHIFT_KEYS =
module.SHIFT_KEYS = {
	// Number row...
	'#1': '!',	'#2': '@',	'#3': '#',	'#4': '$',	'#5': '%',
	'#6': '^',	'#7': '&',	'#8': '*',	'#9': '(',	'#0': ')',	

	// top row...
	'`': '~',		/* Numbers */		'-':  '_',	'=':  '+',

							// right side of keyboard...
							'[': '{',	']':  '}',	'\\': '|',
							';': ':',	'\'': '"',
				',': '<',	'.':  '>',	'/':  '?',
}
var UNSHIFT_KEYS = 
module.UNSHIFT_KEYS = 
	reverseDict(SHIFT_KEYS)


// This is used to identify and correct key notation...
// NOTE: the keys here are intentionally lowercase...
var SPECIAL_KEY_ALTERNATIVE_TITLES =
module.SPECIAL_KEY_ALTERNATIVE_TITLES = {
	1: '#1', 2: '#2', 3: '#3', 4: '#4', 5: '#5', 
	6: '#6', 7: '#7', 8: '#8', 9: '#9', 0: '#0',

	ctl: 'Ctrl', control: 'Ctrl',

	capslock: 'Caps Lock', caps: 'Caps Lock',

	'page up': 'PgUp', pageup: 'PgUp',

	'page down': 'PgDown', pagedown: 'PgDown',

	insert: 'Ins',

	delete: 'Del',

	bkspace : 'Backspace', 'back space' : 'Backspace',

	windows: 'Win',
}
var SPECIAL_KEYS_DICT =
module.SPECIAL_KEYS_DICT = {}
for(var k in SPECIAL_KEYS){
	SPECIAL_KEYS_DICT[SPECIAL_KEYS[k].toLowerCase()] = SPECIAL_KEYS[k] }



/*********************************************************************/

// Documentation wrapper...
var doc =
module.doc =
function doc(text, func){
	func = !func ? 
		function(){
			return true }
		: func
	func.doc = text
	return func }


// Parse action call format...
// 
// supported format:
// 	<actio-name>[!][: <args>][-- <doc>]
//
// <args> can contain space seporated:
// 	- numbers
// 	- strings
// 	- non-nested arrays or objects
// 	
// XXX EXPERIMENTAL...
// 	This will resolve names to context attributes 
//
// XXX should this be here???
// XXX add support for suffix to return false / stop_propagation...
// XXX should this handle calls??? 
// 		i.e. have .call(..) / .apply(..) methods???
// XXX this is the same as actions.parseStringAction(..), reuse in a logical manner...
var parseActionCall =
module.parseActionCall =
function parseActionCall(txt, context){
	context = context || this
	// split off the doc...
	var c = txt.split('--')
	var doc = (c[1] || '').trim()
	// the actual code...
	c = c[0].split(':')

	// action and no default flag...
	var action = c[0].trim()
	var no_default = action.slice(-1) == '!'
	action = no_default ? action.slice(0, -1) : action

	// parse arguments...
	/*
	var args = JSON.parse('['+(
		((c[1] || '')
			.match(/"[^"]*"|'[^']*'|\{[^\}]*\}|\[[^\]]*\]|\d+|\d+\.\d*|null/gm) 
		|| [])
		.join(','))+']')
	//*/
	// XXX EXPERIMENTAL -- is this safe???
	var args = ((c[1] || '')
			.match(RegExp([
				'"[^"]*"',
				"'[^']*",
				'`[^`]*`',

				'\\{[^\\}]*\\}',
				'\\[[^\\]]*\\]',

				'\\d+|\\d+\\.\\d*',

				'[a-zA-Z$@#_][0-9a-zA-Z$@#_]*',

				'null',
			].join('|'), 'gm'))
		|| [])
		.map(function(e){
			// resolve vars to context attrs...
			return /^[a-zA-Z$@#_][0-9a-zA-Z$@#_]*$/.test(e) ?
				(context || {})[e]
				: JSON.parse(e) })

	return {
		action: action,
		arguments: args,
		doc: doc,
		no_default: no_default,
		stop_propagation: false,
	} }



//---------------------------------------------------------------------
// Helpers and utility functions...

// Form standard key string from keyboard event...
//
// Format:
// 	"[ctrl+][meta+][alt+][shift+]<key>"
// 	
// 	<key> - string returned by code2key(..)
// 	
var event2key =
module.event2key =
function event2key(evt){
	evt = evt || window.event
	// NOTE: we do not care about the jQuery wrapper here...
	evt = evt.originalEvent || evt

	var key = []
	evt.ctrlKey && key.push('ctrl')
	evt.altKey && key.push('alt')
	evt.metaKey && key.push('meta')
	evt.shiftKey && key.push('shift')
	evt.getModifierState 
		&& evt.getModifierState('CapsLock') 
		&& key.push('caps')

	var k = code2key(evt.keyCode)

	// add the key if it's not already in, this can happen if we just 
	// pressed a modifier key...
	key.indexOf(k.toLowerCase()) < 0 && key.push(k)

	return key }


// Get key code from key name...
var key2code =
module.key2code =
function key2code(key){
	return key in KEY_CODES ? KEY_CODES[key]
		: key.length > 1 ? null
		: key.charCodeAt(0) }


// Get key name from key code...
var code2key =
module.code2key =
function code2key(code){
	var name = String.fromCharCode(code)
	return code in SPECIAL_KEYS ? SPECIAL_KEYS[code]
		: name != '' ? name 
		: null }


// Check if string is a standard key string...
var isKey =
module.isKey = 
function isKey(key){
	if(!key || key.length == 0 || key.trim() == ''){
		return false
	}
	var modifiers = MODIFIERS 

	var mod = normalizeKey(splitKey(key))
	var k = mod.pop()

	// key is either a key code or a valid key name...
	return (!!parseInt(k) || key2code(k) != null)
		// mod must be a subset of modifiers...
		&& mod.filter(function(m){ return modifiers.indexOf(m) < 0 }).length == 0 }


// Split key...
//
// NOTE: if this gets an array, it will get returned as-is... 
// NOTE: no checks are made on the key, use isKey(..) in conjunction 
// 		with normalizeKey(..) for checking...
var splitKey =
module.splitKey = 
function splitKey(key){
	var sep = KEY_SEPARATORS 
	return key instanceof Array ? key
		: typeof(key) == typeof(123) ? [key]
		: key
			.split(RegExp('['
				+sep.join('\\')
				+']'))
			.concat(sep.indexOf(key.slice(-1)) >= 0 ? key.slice(-1) : [])
			.filter(function(c){ return c != '' }) }


var joinKey =
module.joinKey = 
function joinKey(key){
	return key instanceof Array ? 
		key.join(KEY_SEPARATORS[0] || '+') 
		: key }


// Normalize key string/array...
// 
// NOTE: this will not check if a key is a key use isKey(..) for that.
var normalizeKey =
module.normalizeKey = 
function normalizeKey(key){
	var output = key instanceof Array ? 'array' : 'string'
	var modifiers = MODIFIERS 

	// special case: got a number...
	if(typeof(key) == typeof(123)){
		return code2key(key) }

	// sort modifiers via .modifiers and keep the key last...
	key = splitKey(key)
		.slice()
		.sort(function(a, b){
			a = modifiers.indexOf(a.toLowerCase())
			b = modifiers.indexOf(b.toLowerCase())
			return a >= 0 && b >= 0 ? a - b
				: a < 0 ? 1
				: -1 })

	var k = key.pop()
	k = parseInt(k) ? code2key(parseInt(k)) : k

	if(!k){
		return k }

	// get the propper name...
	k = SPECIAL_KEY_ALTERNATIVE_TITLES[k.toLowerCase()] || k
	k = SPECIAL_KEYS_DICT[k.toLowerCase()] || k

	k = modifiers.indexOf(k.toLowerCase()) >= 0 ? 
		k.toLowerCase() 
		: k.capitalize()
	key.push(k)
	key = key.unique()

	return output == 'array' ? 
		key 
		: joinKey(key) }


// Get shifted key if available...
// 
// Examples:
// 	- '{' 		-> 'shift+['
// 	- ')'		-> 'shift+#0'
var shifted =
module.shifted = 
function shifted(key){
	var output = key instanceof Array ? 'array' : 'string'
	key = normalizeKey(splitKey(key)).slice()
	var k = key.pop()

	var s = (key.indexOf('shift') >= 0 ? 
			SHIFT_KEYS[k]
			: UNSHIFT_KEYS[k])
		|| null

	var res = s == null ? key
		: (key.indexOf('shift') >= 0 ?
				key.filter(function(k){ return k != 'shift' })
				: key.concat(['shift']))
	res.push(s)

	return s == null ? null 
		: output == 'string' ? 
			joinKey(res)
		: res }




/*********************************************************************/
// Generic keyboard handler...
// 
// Key binding format:
//	{
//		<section-title>: {
//			doc: <section-doc>,
//
//			// list of keys to drop after this section is done.
//			//
//			// Setting this to '*' will drop all keys...
//			//
//			// NOTE: these keys will be handled in current section.
//			// NOTE: these keys will not get propagated to the next 
//			//		matching section...
//			// NOTE: it is possible to override this and explicitly pass
//			//		a key to the next section via 'NEXT' (see below).
//			drop: [ <key>, ... ] | '*',
//
//			// Key mapped to action...
//			//
//			// NOTE: the system poses no restrictions on action format,
//			//		but it is recommended to stick to strings or use the
//			//		doc(..) wrapper...
//			<key>: <action>,
//
//			// Key mapped to an alias...
//			//
//			// An alias is any string that is also a key in bindings, it
//			// can be just a string or a key, when matching the string of
//			// aliases will be resolved till either an action (non-alias)
//			// is found or a loop is detected.
//			//
//			// NOTE: in case of a loop, nothing will get called...
//			<key>: <alias> | <key>,
//
//			// Alias-action mapping...
//			<alias>: <action>,
//
//			// Explicitly drop key...
//			//
//			// NOTE: this is similar in effect to .drop
//			<key>: 'DROP',
//
//			// Explicitly pass key to next section...
//			//
//			// This can be useful when it is needed to drop all keys 
//			// except for a small sub-group, this can be dune by setting
//			// .drop to '*' (drop all) and explicitly setting the keys to
//			// be propagated to 'NEXT'.
//			//
//			// NOTE: this takes precedence over .drop 
//			<key>: 'NEXT',
//
//			...
//		},
//		...
//	}
//

var KeyboardClassPrototype = {
	service_fields: ['doc', 'drop'],

	event2key: event2key,
	key2code: key2code,
	code2key: code2key,
	isKey: isKey,
	splitKey: splitKey,
	joinKey: joinKey,
	normalizeKey: normalizeKey,
	shifted: shifted
}

var KeyboardPrototype = {
	//service_fields: ['doc', 'drop'],
	special_handlers: {
		DROP: 'drop key', 
		NEXT: 'handle key in next section',
	},

	// Format:
	// 	{
	// 		<mode>: {
	// 			doc: <doc>,
	// 			drop: [ <key>, ... ] | '*',
	//
	//			<alias>: <handler>,
	//
	//			<key>: <handler>,
	//			<key>: <alias>,
	// 		},
	// 		...
	// 	}
	//
	// Reserved special handlers:
	// 	- DROP		- drop checking of key
	// 					NOTE: this will prevent handling next sections
	// 						for this key.
	// 	- NEXT		- force check next section, this has priority 
	// 					over .drop
	//
	// NOTE: if .__keyboard is set to a function, it will be used both as
	// 		a getter and as a setter via the .keyboard prop, to overwrite
	// 		write to .__keyboard directly...
	__keyboard: null,
	get keyboard(){
		return this.__keyboard instanceof Function ? 
			this.__keyboard() 
			: this.__keyboard },
	// XXX might be a good idea to normalize the value here...
	// 		...i.e. normalize key specs as they are input by humans...
	set keyboard(value){
		if(this.__keyboard instanceof Function){
			this.__keyboard(value) 
		} else {
			this.__keyboard = value } },

	// XXX is this needed???
	//context: null,


	// string handler parser...
	// 
	// Return format:
	// {
	//		action: <str>,
	//		arguments: <array>,
	//		doc: <str> || null,
	//		no_default: <bool>,
	//		stop_propagation: <bool>,
	// }
	//
	// XXX should this be a Keyboard thing or a context thing???
	// XXX revise name...
	parseStringHandler: parseActionCall,

	// call keyboard handler...
	//
	callKeyboardHandler: function(data, context){
		// call the handler...
		return data.action
			.split('.') 
			.reduce(function(res, k){ 
				context = res
				return res[k] 
			}, context)
			.apply(context, data.arguments) },


	// utils...
	event2key: KeyboardClassPrototype.event2key,
	key2code: KeyboardClassPrototype.key2code,
	code2key: KeyboardClassPrototype.code2key,
	shifted: KeyboardClassPrototype.shifted,
	splitKey: KeyboardClassPrototype.splitKey,
	joinKey: KeyboardClassPrototype.joinKey,
	normalizeKey: KeyboardClassPrototype.normalizeKey,
	isKey: KeyboardClassPrototype.isKey,

	//isModeApplicable: function(mode, keyboard, context){ return true },
	
	// XXX merge configs...
	// 		- need to match and order groups (use 1'st as reference)...
	// 		- need to create new set w/o changing the originals...
	merge: function(){
	},


	// Sort modes...
	//
	// 	Sort via cmp function...
	// 	.sortModes(func)
	// 		-> this
	//
	// 	Sort to the same order as list...
	// 	.sortModes(list)
	// 		-> this
	//
	//
	// NOTE: calling this with no arguments will have no effect.
	//
	// XXX should this update the kb in-place???
	sortModes: function(cmp){
		var ordered = {}
		var bindings = this.keyboard

		if(cmp == null){
			return
		}

		cmp = cmp instanceof Function ?
			Object.keys(bindings).sort(cmp)
			: cmp
				.concat(Object.keys(bindings))
				.unique()

		cmp
			.forEach(function(mode){
				ordered[mode] = bindings[mode]
			})

		// reorder only if we moved all the modes...
		if(Object.keys(bindings).length == Object.keys(ordered).length){
			this.keyboard = ordered
		}

		return this },

	// Get keys for handler...
	//
	// 	List all handlers...
	// 	.keys()
	// 	.keys('*')
	//		-> keys
	//
	// 	List only applicable handlers...
	// 	.keys('?')
	//		-> keys
	//
	//	List keys for handler...
	//	.keys(handler)
	//		-> keys
	//
	//	List keys for given handlers...
	//	.keys(handler, ...)
	//	.keys([handler, ...])
	//		-> keys
	//
	//	List keys for handlers that pass the func predicate...
	//	.keys(func)
	//		-> keys
	//
	//
	// Format:
	// 	{
	// 		<mode>: {
	// 			<handler>: [ <key>, ... ],
	// 			...
	// 		},
	// 		...
	// 	}
	//
	//
	// NOTE: this will also return non-key aliases...
	// NOTE: to match several compatible handlers, pass a list of handlers,
	// 		the result for each will be merged into one common list.
	//
	// XXX drop/DROP/NEXT handling need more testing...
	// XXX this and .handler(..) in part repeat handling dropped keys, 
	// 		can we unify this???
	keys: function(handler){
		var that = this
		var res = {}
		var keyboard = this.keyboard
		var key_separators = KEY_SEPARATORS 
		var service_fields = this.service_fields 
			|| this.constructor.service_fields

		handler = arguments.length > 1 ? [...arguments]
			: handler == null ? '*'
			: handler == '*' || handler == '?' || handler instanceof Function ? handler
			: handler instanceof Array ? handler 
			: [handler]

		var walkAliases = function(res, rev, bindings, key, mod){
			mod = mod || []
			if(key in rev){
				rev[key].forEach(function(k){
					k = that.normalizeKey(
						that.joinKey(mod
							.concat(that.splitKey(k))
							.unique()))
					res.indexOf(k) < 0 
						&& res.push(k)
						&& walkAliases(res, rev, bindings, k, mod) }) } }

		var modes = handler == '?' ? this.modes() : '*'
		var drop = []
		var next = []

		Object.keys(keyboard).forEach(function(mode){
			// skip non-applicable modes...
			if(modes != '*' && modes.indexOf(mode) < 0){
				return }

			var bindings = keyboard[mode]

			if(handler == '?'){
				next = next.concat(bindings.NEXT || []) }

			// build a reverse index...
			var rev = {}
			// NOTE: this will not work for handlers that are not strings 
			// 		and have no .doc...
			Object.keys(bindings)
				.filter(function(key){ 
					return service_fields.indexOf(key) < 0 })
				.forEach(function(key){
					var h = bindings[key]
					h = typeof(h) == typeof('str') ? h
						: (h.doc || h.name)
					rev[h] = (rev[h] || [])
						.concat((rev[bindings[key]] || []).concat([key]))
						.unique() })

			var seen = []
			var handlers = handler == '*' || handler == '?' ?  
					Object.keys(rev) 
				: handler instanceof Function ? 
					Object.keys(rev)
						.filter(handler)
				: handler

			handlers
				.forEach(function(h){
					if(handler == '?'&& h == 'NEXT'){
						return
					}

					var keys = (rev[h] || []).map(that.normalizeKey.bind(that))

					if(handler == '?' &&  h == 'DROP'){
						drop = drop == '*' ?  '*' : drop.concat(keys)
						next = next
							.filter(function(k){ return keys.indexOf(k) >= 0 })
						return }

					var keys = (rev[h] || []).map(that.normalizeKey.bind(that))

					// find all reachable keys from the ones we just found in reverse...
					keys.slice()
						.filter(function(key){ return seen.indexOf(key) < 0 })
						.forEach(function(key){
							// direct aliases...
							walkAliases(keys, rev, bindings, key)

							var mod = that.splitKey(key)
							var k = mod.pop()

							// aliases with modifiers...
							k != key 
								&& walkAliases(keys, rev, bindings, k, mod)

							seen.push(seen)
						})

					if(handler == '?'){
						keys = keys
							.filter(function(key){ 
								var k = that.splitKey(key)
								return next.indexOf(key) >= 0
									|| next.indexOf(k) >= 0
									|| (drop != '*' 
										&& drop.indexOf(key) < 0
										&& drop.indexOf(k) < 0) }) }

					if(keys.length > 0){
						var m = res[mode] = res[mode] || {}
						m[h] = keys }
				})

			if(handler == '?'){
				drop = drop == '*' || bindings.drop == '*' ? 
					'*' 
					: drop.concat(bindings.drop || []) }
		})

		return res },

	// Get/set/unset handler for key...
	//
	// In general if handler is not passed this will get the handlers,
	// if a handler is given this will set the handler, if the passed 
	// handler is either null or '' then it will be unbound.
	//
	// 	Get handler for key in all modes...
	// 	.handler(key)
	// 	.handler('*', key)
	// 		-> key-spec
	//
	// 	Get handlers for key in applicable modes...
	// 	.handler('?', key)
	// 	.handler('test', key)
	// 		-> key-spec
	//
	// 	Get handler for key in a specific mode...
	// 	.handler(mode, key)
	// 		-> key-spec
	//
	// 	Get handler for key in a specific list of modes...
	// 	.handler([mode, ..], key)
	// 		-> key-spec
	//
	//
	// 	Bind handler to key in specific mode...
	// 	.handler(mode, key, handler)
	// 		-> this
	//
	// 	Bind handler to key in all modes...
	// 	.handler('*', key, handler)
	// 		-> this
	//
	// 	Bind handler to key in applicable modes...
	// 	.handler('?', key, handler)
	// 	.handler('test', key, handler)
	// 		-> this
	//
	// 	Bind handler to key in a specific list of modes...
	// 	.handler([mode, ..], key, handler)
	// 		-> this 
	//
	//
	// 	Unbind handler from key in specific mode...
	// 	.handler(mode, key, null)
	// 	.handler(mode, key, '')
	// 		-> this
	//
	// 	Unbind handler from key in all modes...
	// 	.handler('*', key, null)
	// 	.handler('*', key, '')
	// 		-> this
	//
	// 	Unbind handler from key in applicable modes...
	// 	.handler('?', key, null)
	// 	.handler('?', key, '')
	// 	.handler('test', key, null)
	// 	.handler('test', key, '')
	// 		-> this
	//
	// 	Unbind handler from key in a specific list of modes...
	// 	.handler([mode, ..], key, null)
	// 	.handler([mode, ..], key, '')
	// 		-> this 
	//
	//
	// Format:
	// 	{
	// 		<mode>: <handler>,
	// 		...
	// 	}
	//
	//
	// Search order:
	// 	- search for full key
	// 	- search for shifted key if applicable
	// 	- search for key without modifiers
	// 		- if an alias is found it is first checked with and then 
	// 			without modifiers
	// 	- search for key code without modifiers
	// 		- if an alias is found it is first checked with and then 
	// 			without modifiers
	//
	// XXX this and .keys('?') in part repeat handling dropped keys, 
	// 		can we unify this???
	handler: function(mode, key, handler){
		var that = this
		var keyboard = this.keyboard
		var key_separators = KEY_SEPARATORS  

		if(mode == null){
			return null }
		if(key == null && this.isKey(mode)){
			key = mode
			mode = '*' }

		var joinKeys = function(key, shift_key){
			// match candidates...
			return key_separators
				// full key...
				.map(function(s){ return key.join(s) })
				// full shift key...
				.concat(shift_key ? 
					key_separators
						.map(function(s){ return shift_key.join(s) }) 
					: [])
	   			.unique() }
		// NOTE: the generated list is in the following order:
		// 		- longest chain first
		// 		- shifted keys first
		// 		- modifiers are skipped in order, left to right
		// XXX carefully revise key search order...
		// XXX should we normalize what's in the bindings????
		// 		...currently we will match 'Ins' but not 'insert'
		var keyCombinations = function(key, shift_key, remove_single_keys){
			if(key.length <= 1){
				//return shift_key ? [key, shift_key] : [key]
				return key }
			var k = remove_single_keys ? 1 : 0 
			// generate recursively, breadth first...
			var _combinations = function(level, res){
				var next = []
				level
					.map(function(elem){
						var c = elem.join('+++')
						res.indexOf(c) < 0
							&& res.push(c)
							&& elem
								.slice(0, -1)
								.map(function(_, i){
									var s = elem.slice()
									s.splice(i, 1)
									// NOTE: we do not include single keys
									// 		as they are searched separately...
									//s.length > 0 
									s.length > k 
										&& next.push(s) }) })
				next.length > 0 
					&& _combinations(next, res)
				return res }
			return _combinations(shift_key && shift_key.length > 0 ?
				[key, shift_key] 
				: [key], [])
					.map(function(e){ return joinKeys(e.split(/\+\+\+/g)) })
					.reduce(function(a, b){ return a.concat(b) }, []) }
		var walkAliases = function(bindings, handler, modifiers){
			var seen = []
			var modifiers = modifiers || []

			while(handler in bindings){
				handler = bindings[handler]

				handler = modifiers
						.filter(function(m){
							return handler instanceof Function 
								|| (handler.indexOf(m) < 0
									&& seen.indexOf(m+handler) < 0
									&& m+handler in bindings) })
						.map(function(m){ return m+handler })[0]
					|| handler

				// check for loops...
				if(seen.indexOf(handler) >= 0){
					handler = null
					break }
				seen.push(handler) }

			return handler }

		key = this.normalizeKey(this.splitKey(key))
		var shift_key = this.shifted(key)

		// match candidates...
		//var keys = joinKeys(key, shift_key).unique()
		// NOTE: we are skipping single keys from list as they are searched
		// 		separately...
		var keys = keyCombinations(key, shift_key, true)

		// XXX
		//console.log(keys, '--', joinKeys(key, shift_key).unique())

		// get modes...
		var modes = mode == '*' ? Object.keys(keyboard)
			: mode == 'test' || mode == '?' ? this.modes()
			: mode instanceof Array ? mode
			: [mode]

		// get...
		if(handler === undefined){
			var res = {}
			var k = key.slice(-1)[0]
			var c = this.key2code(k) 

			//var mod = joinKeys(key.slice(0, -1).concat(''))
			var mod = keyCombinations(key.slice(0, -1).concat(''), null, true)

			var drop = mode == 'test' || mode == '?'
			for(var i=0; i < modes.length; i++){
				var m = modes[i]

				var bindings = keyboard[m]

				// stage 1: check key aliases with modifiers...
				handler = walkAliases(
					bindings, 
					keys.filter(function(k){ return bindings[k] })[0])

				// stage 2: check raw key aliases with and without modifiers...
				if(!handler){
					handler = walkAliases(
						bindings, 
						[k, c].filter(function(k){ return bindings[k] })[0],
						mod) }

				// explicit DROP -- ignore next sections...
				if(drop && handler == 'DROP'){
					break }

				// we got a match...
				if(handler){
					res[m] = handler }

				// if key in .drop then ignore the rest...
				if(drop 
						// explicit go to next section...
						&& (!handler 
							|| (typeof(handler) == typeof('str') 
								&& handler.slice(0, 4) != 'NEXT'))
						&& (bindings.drop == '*'
							// XXX should this be more flexible by adding a
							// 		specific key combo?
							// 		... if yes, we'll need to differentiate 
							// 		between X meaning drop only X and drop
							// 		all combos with X...
							|| (bindings.drop || []).indexOf(k) >= 0)){
					break } }

			return (typeof(mode) == typeof('str') 
					&& ['*', 'test', '?'].indexOf(mode) < 0) ? 
				res[mode]
				: res

		// set / remove...
		} else {
			modes.forEach(function(m){
				var bindings = keyboard[m]

				// remove all matching keys...
				// NOTE: if key with modifiers, then this will remove only 
				// 		the full matched keys and shifted matches but will 
				// 		leave the key without modifiers as-is...
				keys.forEach(function(k){ delete bindings[k] })

				// set handler if given...
				if(handler && handler != ''){
					keyboard[mode][that.joinKey(key)] = handler } }) }

		return this },

	// Trigger handler...
	//
	// XXX can this be implemented here???
	// 		...we need context among other things...
	// 		might be a good idea to add config options for everything 
	// 		and just set things up in wrappers...
	handle: function(mode, key){
		// XXX
		return this },


	// get applicable modes...
	//
	modes: function(context){
		var that = this
		return that.isModeApplicable ?
			Object.keys(this.keyboard)
				.filter(function(mode){ 
					return that.isModeApplicable(
							mode, 
							that.keyboard, 
							context || that.context) })
			: Object.keys(this.keyboard) },


	// XXX EXPERIMENTAL...
	// Basic binding editing API...
	//
	// NOTE: this is an event-like proxy to the .handler(..)
	//
	// 	Bind handler key ('General' section)...
	// 	.on(key, handler)
	// 		-> this
	//
	// 	.on(key, section, handler)
	// 		-> this
	//
	// NOTE: default mode is 'General'...
	on: function(key, handler){
		// normalize args...
		if(arguments.length == 3){
			var [key, mode, handler] = arguments
		} else {
			var [key, handler] = arguments }
		var mode = mode 
			//|| Object.keys(this.keyboard)[0]
			|| 'General'
		// bind...
		return this.handler(mode, key, handler) },
	off: function(key, mode){
		// normalize args...
		mode = mode 
			//|| Object.keys(this.keyboard)[0]
			|| 'General'
		// unbind...
		return this.handler(mode, key, null) },


	// init base data...
	__init__: function(keyboard, is_mode_applicable){
		this.keyboard = keyboard

		if(is_mode_applicable instanceof Function){
			this.isModeApplicable = is_mode_applicable } },
}

var Keyboard = 
module.Keyboard = 
object.Constructor('Keyboard', 
		KeyboardClassPrototype, 
		KeyboardPrototype)


//---------------------------------------------------------------------
// Keyboard handler with modes identified by CSS selectors...

var KeyboardWithCSSModesPrototype = {
	service_fields: ['doc', 'drop', 'pattern'],

	isModeApplicable: function(mode, keyboard, context){ 
		var pattern = keyboard[mode].pattern || mode
		context = context || this.context
		return !pattern 
			|| pattern == '*' 
			// jQuery...
			|| (context.is ? 
				(context.is(pattern)
					|| context.find(pattern).length > 0)
				: false)
			// Vanilla JS...
			|| (context.matches ? 
				(context.matches(pattern)
					|| !!context.querySelector(pattern))
				: false) },

	__init__: function(keyboard, context){
		object.parentCall(KeyboardWithCSSModesPrototype.__init__, this, keyboard)
		
		if(context instanceof Function){
			Object.defineProperty(this, 'context', {
				get: context,
			})

		} else {
			this.context = context } },
}

var KeyboardWithCSSModes = 
module.KeyboardWithCSSModes = 
object.Constructor('KeyboardWithCSSModes', 
		KeyboardClassPrototype, 
		KeyboardWithCSSModesPrototype)
// inherit from Keyboard...
KeyboardWithCSSModes.prototype.__proto__ = Keyboard.prototype




/*********************************************************************/

// Base event handler wrapper of Keyboard...
//
// This will produce a handler that can be used in one of two ways:
// 	- event handler
// 		- an event is passed as the only argument 
// 		- the function can be used directly as an event handler
// 	- direct key handler
// 		- a key and optionally a no_match handler are passed
// 		
// 	Example:
// 		var handler = makeKeyboardHandler(kb, null, action)
// 		
// 		// event handler...
// 		$(window).keydown(handler)
// 		
// 		// used directly...
// 		handler('ctrl_C', function(k){ console.log('Not bound:', k) })
// 		
// NOTE: the handler will also set the .capslock attribute on the 
// 		keyboard object and update it on each key press...
// NOTE: if .capslock is false means that either it is not on or 
// 		undetectable...
// NOTE: before any key is pressed the .capslock is set to undefined
// 
// XXX not sure if handler calling mechanics should be outside of the 
// 		Keyboard object...
var makeKeyboardHandler =
module.makeKeyboardHandler =
function makeKeyboardHandler(keyboard, unhandled, actions){
	var kb = keyboard instanceof Keyboard ? 
		keyboard 
		//: Keyboard(keyboard, checkGlobalMode)
		: Keyboard(keyboard)
	kb.capslock = undefined

	return function(key, no_match){
		no_match = no_match || unhandled
		var did_handling = false
		var evt = window.event
		var res

		//if(key instanceof Event || key instanceof $.Event){
		if(typeof(key) != typeof('str') && !(key instanceof Array)){
			evt = key
			key = kb.event2key(evt)

			kb.capslock = key.indexOf('caps') >= 0
		}

		var handlers = kb.handler('test', key)

		Object.keys(handlers).forEach(function(mode){
			if(res === false){
				return }

			var handler = handlers[mode]

			// raw function handler...
			if(handler instanceof Function){
				res = handler.call(actions)

			// action call syntax...
			// XXX should this be a Keyboard thing or a context thing???
			} else if(actions.parseStringHandler || kb.parseStringHandler){
				var h = actions.parseStringHandler ?
					actions.parseStringHandler(handler, actions)
					: kb.parseStringHandler(handler, actions)
				var path = h ? h.action.split('.') : []

				if(path.length > 0 && path[0] in actions){
					did_handling = true

					evt 
						&& h.no_default 
						&& evt.preventDefault()

					// call the handler...
					res = actions.callKeyboardHandler ?
						actions.callKeyboardHandler(h, actions)
						: kb.callKeyboardHandler(h, actions)

					evt 
						&& h.stop_propagation
						&& evt.stopPropagation()
						&& (res = false) } } })

		no_match 
			&& !did_handling 
			&& no_match.call(actions, evt, key)

		return res }
}



//---------------------------------------------------------------------
// Pausable base event handler wrapper of Keyboard...
//
// This is the same as .makeKeyboardHandler(..) but adds ability to 
// pause repeating key handling...
// 
// This will extend the keyboard object by adding:
// 		.pauseRepeat() 		- will pause repeating keys...
// 		
// XXX should we drop only when the same key is repeating or any keys 
// 		repeating (as is now)???
var makePausableKeyboardHandler =
module.makePausableKeyboardHandler =
function makePausableKeyboardHandler(keyboard, unhandled, actions, check_interval){

	var kb = keyboard instanceof Keyboard ? 
		keyboard 
		//: Keyboard(keyboard, checkGlobalMode)
		: Keyboard(keyboard)

	kb.pauseRepeat = function(){
		this.__repeat_pause_timeout
			&& clearTimeout(this.__repeat_pause_timeout)

		this.__repeat_pause_timeout = setTimeout(
			function(){
				delete kb.__repeat_pause_timeout 
			},
			(check_interval instanceof Function ?
				check_interval.call(actions) 
				: (check_interval || 100))) }


	return stoppableKeyboardRepeat(
		makeKeyboardHandler(kb, unhandled, actions), 
		function(){
			if(kb.__repeat_pause_timeout){
				kb.pauseRepeat()
				return false }
			return true }) }



//---------------------------------------------------------------------
// handler wrappers...

// Event handler wrapper to stop handling keys if check callback does 
// not pass (returns false)...
//
var stoppableKeyboardRepeat = 
module.stoppableKeyboardRepeat = 
function(handler, check){
	return function(evt){
		return check() 
			&& handler(evt) } }


// Event handler wrapper that will drop identical keys repeating at rate
// greater than max_rate
//
// NOTE: this will only limit repeating key combinations thus no lag is 
// 		introduced...
var dropRepeatingkeys =
module.dropRepeatingkeys =
function dropRepeatingkeys(handler, max_rate){
	var _timeout = null

	var key = null

	var ctrl = null
	var meta = null
	var alt = null
	var shift = null

	return function(evt){
		if(_timeout != null
				&& key == evt.keyCode
				&& ctrl == evt.ctrlKey
				&& meta == evt.metaKey
				&& alt == evt.altKey
				&& shift == evt.shiftKey){
			return }

		key = evt.keyCode
		ctrl = evt.ctrlKey
		meta = evt.metaKey
		alt = evt.altKey
		shift = evt.shiftKey

		_timeout = setTimeout(function(){
				_timeout = null
			}, 
			// XXX is this the right way to go???
			typeof(max_rate) == typeof(123) ? max_rate : max_rate())

		return handler(evt) } }




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
