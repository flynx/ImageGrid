/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var object = require('lib/object')



/*********************************************************************/

var MODIFIERS =
module.MODIFIERS = [ 'ctrl', 'meta', 'alt', 'shift' ]


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
// NOTE: don't understand why am I the one who has to write this...
var SPECIAL_KEYS =
module.SPECIAL_KEYS = {
	// Special Keys...
	9:		'Tab',		33:		'PgUp',		45:		'Ins',		
	13:		'Enter',	34:		'PgDown',	46:		'Del',		
	16:		'Shift',	35:		'End',		 8:		'Backspace',
	17:		'Ctrl',		36:		'Home',		91:		'Win',		
	18:		'Alt',		37:		'Left',		93:		'Menu',		
	20:		'Caps Lock',38:		'Up',	 
	27:		'Esc',		39:		'Right',  
	32:		'Space',	40:		'Down',  

	// Function Keys...
	112:	'F1',		116:	'F5',		120:	'F9', 
	113:	'F2',		117:	'F6',		121:	'F10',
	114:	'F3',		118:	'F7',		122:	'F11',
	115:	'F4',		119:	'F8',		123:	'F12',

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


var SHIFT_KEYS =
module.SHIFT_KEYS = {
	'`': '~',	'-': '_',	'=':'+',

	'#1': '!',	'#2': '@',	'#3': '#',	'#4': '$',	'#5': '%',
	'#6':'^',	'#7':'&',	'#8': '*',	'#9': '(',	'#0': ')',	

	'[': '{',		']': '}',		'\\': '|',
	';': ':',		'\'': '"',
	',': '<',		'.': '>',		'/': '?'
}


var UNSHIFT_KEYS = 
module.UNSHIFT_KEYS = {}
for(var k in SHIFT_KEYS){
	UNSHIFT_KEYS[SHIFT_KEYS[k]] = k
}


// build a reverse map of SPECIAL_KEYS
var KEY_CODES =
module.KEY_CODES = {}
for(var k in SPECIAL_KEYS){
	KEY_CODES[SPECIAL_KEYS[k]] = k
}



/*********************************************************************/

// Documentation wrapper...
var doc =
module.doc =
function doc(text, func){
	func = !func ? function(){return true}: func
	func.doc = text
	return func
}


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
// XXX should this be here???
// XXX add support for suffix to return false / stop_propagation...
// XXX should this handle calls??? 
// 		i.e. have .call(..) / .apply(..) methods???
var parseActionCall =
module.parseActionCall =
function parseActionCall(txt){
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
	var args = JSON.parse('['+(
		((c[1] || '')
			.match(/"[^"]*"|'[^']*'|\{[^\}]*\}|\[[^\]]*\]|\d+|\d+\.\d*|null/gm) 
		|| [])
		.join(','))+']')

	return {
		action: action,
		arguments: args,
		doc: doc,
		no_default: no_default,
		stop_propagation: false,
	}
}



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
	evt = evt || event

	var key = []
	evt.ctrlKey && key.push('ctrl')
	evt.altKey && key.push('alt')
	evt.metaKey && key.push('meta')
	evt.shiftKey && key.push('shift')
	key.push(code2key(evt.keyCode))

	return key
}


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
	var modifiers = MODIFIERS 

	var mod = normalizeKey(splitKey(key))
	var k = mod.pop()

	// key is either a key code or a valid key name...
	return (!!parseInt(k) || key2code(k) != null)
		// mod must be a subset of modifiers...
		&& mod.filter(function(m){ return modifiers.indexOf(m) < 0 }).length == 0
}


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
		return code2key(key)
	}

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
	k = modifiers.indexOf(k.toLowerCase()) >= 0 ? 
		k.toLowerCase() 
		: k.capitalize()
	key.push(k)
	key = key.unique()

	return output == 'array' ? 
		key 
		: key.join(KEY_SEPARATORS[0] || '+')
}


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
			res.join(KEY_SEPARATORS[0] || '+') 
		: res
}




/*********************************************************************/
// Generic keyboard handler...

var KeyboardClassPrototype = {
	service_fields: ['doc', 'drop'],

	event2key: event2key,
	key2code: key2code,
	code2key: code2key,
	isKey: isKey,
	splitKey: splitKey,
	normalizeKey: normalizeKey,
	shifted: shifted
}

var KeyboardPrototype = {
	//service_fields: ['doc', 'drop'],
	special_handlers: {
		DROP: 'drop key', 
		NEXT_SECTION: 'handle key in next section',
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
	// 	- DROP			- drop checking of key
	// 						NOTE: this will prevent handling next sections
	// 							for this key.
	// 	- NEXT_SECTION	- force check next section, this has priority 
	// 						over .drop
	//
	__keyboard: null,
	get keyboard(){
		return this.__keyboard instanceof Function ? 
			this.__keyboard() 
			: this.__keyboard },
	set keyboard(value){
		this.__keyboard = value },

	// XXX is this needed???
	//context: null,

	// utils...
	event2key: KeyboardClassPrototype.event2key,
	key2code: KeyboardClassPrototype.key2code,
	code2key: KeyboardClassPrototype.code2key,
	shifted: KeyboardClassPrototype.shifted,
	splitKey: KeyboardClassPrototype.splitKey,
	normalizeKey: KeyboardClassPrototype.normalizeKey,
	isKey: KeyboardClassPrototype.isKey,

	//isModeApplicable: function(mode, keyboard, context){ return true },
	
	// XXX merge configs...
	// 		- need to match and order groups (use 1'st as reference)...
	// 		- need to create new set w/o changing the originals...
	merge: function(){
	},

	// Get keys for handler...
	//
	// 	List all handlers...
	// 	.keys()
	// 	.keys('*')
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
	keys: function(handler){
		var that = this
		var res = {}
		var keyboard = this.keyboard
		var key_separators = KEY_SEPARATORS 
		var service_fields = this.service_fields 
			|| this.constructor.service_fields

		handler = arguments.length > 1 ? [].slice.call(arguments)
			: handler == null ? '*'
			: handler == '*' || handler instanceof Function ? handler
			: handler instanceof Array ? handler 
			: [handler]

		var walkAliases = function(res, rev, bindings, key, mod){
			mod = mod || []
			if(key in rev){
				rev[key].forEach(function(k){
					k = that.normalizeKey(mod
						.concat(that.splitKey(k))
						.unique()
						.join(key_separators[0]))
					res.indexOf(k) < 0 
						&& res.push(k)
						&& walkAliases(res, rev, bindings, k, mod)
				})
			}
		}

		Object.keys(keyboard).forEach(function(mode){
			var bindings = keyboard[mode]

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
						.unique()
				})

			var seen = []
			var handlers = handler == '*' ?  Object.keys(rev) 
				: handler instanceof Function ? 
					Object.keys(rev)
						.filter(handler)
				: handler

			handlers
				.forEach(function(h){
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

					if(keys.length > 0){
						var m = res[mode] = res[mode] || {}
						m[h] = keys
					}
				})
		})

		return res
	},

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
	handler: function(mode, key, handler){
		var that = this
		var keyboard = this.keyboard
		var key_separators = KEY_SEPARATORS  

		if(mode == null){
			return null
		}
		if(key == null && this.isKey(mode)){
			key = mode
			mode = '*'
		}


		var genKeys = function(key, shift_key){
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
		var walkAliases = function(bindings, handler, modifiers){
			var seen = []
			var modifiers = modifiers || []

			while(handler in bindings){
				handler = bindings[handler]

				handler = modifiers
						.filter(function(m){
							return handler.indexOf(m) < 0
								&& seen.indexOf(m+handler) < 0
								&& m+handler in bindings })
						.map(function(m){ return m+handler })[0]
					|| handler

				// check for loops...
				if(seen.indexOf(handler) >= 0){
					handler = null
					break
				}
				seen.push(handler)
			}

			return handler
		}

		key = this.normalizeKey(this.splitKey(key))
		var shift_key = this.shifted(key)

		// match candidates...
		var keys = genKeys(key, shift_key).unique()

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

			var mod = genKeys(key.slice(0, -1).concat(''))

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
						mod)
				}

				// explicit DROP -- ignore next sections...
				if(drop && handler == 'DROP'){
					break
				}

				// we got a match...
				if(handler){
					res[m] = handler
				}

				// if key in .drop then ignore the rest...
				if(drop 
						// explicit go to next section...
						&& handler != 'NEXT_SECTION'
						&& (bindings.drop == '*'
							// XXX should this be more flexible by adding a
							// 		specific key combo?
							// 		... if yes, we'll need to differentiate 
							// 		between X meaning drop only X and drop
							// 		all combos with X...
							|| (bindings.drop || []).indexOf(k) >= 0)){
					break
				}
			}

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
					keyboard[mode][key] = handler
				}
			})
		}

		return this
	},

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


	// init base data...
	__init__: function(keyboard, is_mode_applicable){
		this.keyboard = keyboard

		if(is_mode_applicable instanceof Function){
			this.isModeApplicable = is_mode_applicable
		}
	},
}

var Keyboard = 
module.Keyboard = 
object.makeConstructor('Keyboard', 
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
			// XXX can we join these into one search???
			|| context.is(pattern)
			|| context.find(pattern).length > 0
	},

	__init__: function(keyboard, context){
		object.superMethod(KeyboardWithCSSModes, '__init__').call(this, keyboard)
		
		if(context instanceof Function){
			Object.defineProperty(this, 'context', {
				get: context,
			})

		} else {
			this.context = context
		}
	},
}

var KeyboardWithCSSModes = 
module.KeyboardWithCSSModes = 
object.makeConstructor('KeyboardWithCSSModes', 
		KeyboardClassPrototype, 
		KeyboardWithCSSModesPrototype)
// inherit from Keyboard...
KeyboardWithCSSModes.prototype.__proto__ = Keyboard.prototype




/*********************************************************************/

// Base event handler wrapper of Keyboard...
//
var makeKeyboardHandler =
module.makeKeyboardHandler =
function makeKeyboardHandler(keyboard, unhandled, actions){

	var kb = keyboard instanceof Keyboard ? 
		keyboard 
		//: Keyboard(keyboard, checkGlobalMode)
		: Keyboard(keyboard)

	return function(evt){
		var res = undefined
		var did_handling = false

		var key = kb.event2key(evt)
		var handlers = kb.handler('test', key)

		Object.keys(handlers).forEach(function(mode){
			if(res === false){
				return
			}

			var handler = handlers[mode]

			// raw function handler...
			if(handler instanceof Function){
				res = handler.call(actions)

			// action call syntax...
			} else {
				var h = parseActionCall(handler)

				if(h && h.action in actions){
					did_handling = true

					h.no_default 
						&& evt.preventDefault()

					// call the handler...
					res = actions[h.action].apply(actions, h.args)

					if(h.stop_propagation){
						res = false
						evt.stopPropagation()
					}
				} 
			}
		})

		unhandled 
			&& !did_handling 
			&& unhandled.call(actions, evt)

		return res
	}
}



//---------------------------------------------------------------------
// handler wrappers...

// Event handler wrapper to stop handling keys if check callback does 
// not pass (returns false)...
//
var stoppableKeyboardRepeat = 
module.stoppableKeyboardRepeat = 
function(handler, check){
	return function(evt){
		return check() && handler(evt)
	}
}


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
			return
		}

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

		return handler(evt)
	}
}




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
