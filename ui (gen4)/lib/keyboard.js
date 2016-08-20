/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/



/*********************************************************************/

// Attributes to be ignored my the key handler...
//
// These are used for system tasks.
var KEYBOARD_SYSTEM_ATTRS =
module.KEYBOARD_SYSTEM_ATTRS = [
	'doc',
	'title',
	'ignore',
	'pattern'
]


// Neither _SPECIAL_KEYS nor _KEY_CODES are meant for direct access, use
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
var _SPECIAL_KEYS =
module._SPECIAL_KEYS = {
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


var _SHIFT_KEYS =
module._SHIFT_KEYS = {
	'`': '~',	'-': '_',	'=':'+',

	'#1': '!',	'#2': '@',	'#3': '#',	'#4': '$',	'#5': '%',
	'#6':'^',	'#7':'&',	'#8': '*',	'#9': '(',	'#0': ')',	

	'[': '{',		']': '}',		'\\': '|',
	';': ':',		'\'': '"',
	',': '<',		'.': '>',		'/': '?'
}


// build a reverse map of _SPECIAL_KEYS
var _KEY_CODES =
module._KEY_CODES = {}
for(var k in _SPECIAL_KEYS){
	_KEY_CODES[_SPECIAL_KEYS[k]] = k
}


// XXX some keys look really wrong...
var toKeyName =
module.toKeyName =
function toKeyName(code){
	// check for special keys...
	var k = _SPECIAL_KEYS[code]
	if(k != null){
		return k
	}
	// chars...
	k = String.fromCharCode(code)
	if(k != ''){
		//return k.toLowerCase()
		return k
	}
	return null
}


var toKeyCode =
module.toKeyCode =
function toKeyCode(c){
	if(c in _KEY_CODES){
		return _KEY_CODES[c]
	}
	return c.charCodeAt(0)
}


// documentation wrapper...
var doc =
module.doc =
function doc(text, func){
	func = !func ? function(){return true}: func
	func.doc = text
	return func
}


// Build or normalize a modifier string. 
//
// Acceptable argument sets:
// 	- none				-> ""
// 	- true, false, true	-> "ctrl+shift"
// 	- true, false		-> "ctrl"
// 	- [true, false]		-> "ctrl"
// 	- 'alt+shift'		-> "alt+shift"
// 	- 'shift - alt'		-> "alt+shift"
//
// Bool flag order:
// 		ctrl, meta, alt, shift
//
// NOTE: 'meta' is the OSX "Command" key...
var normalizeModifiers =
module.normalizeModifiers =
function normalizeModifiers(c, m, a, s){
		if(c != null && c.constructor === Array){
			m = c[1]
			a = c[2]
			s = c[3]
			c = c[0]
		}
		if(typeof(c) == typeof('str')){
			var modifiers = c
		} else {
			var modifiers = (c ? 'ctrl' : '') 
				+ (m ? ' meta' : '') 
				+ (a ? ' alt' : '') 
				+ (s ? ' shift' : '')
		}

		// build the dormalized modifier string...
		var res = /ctrl/i.test(modifiers) ? 'ctrl' : ''
		res += /meta/i.test(modifiers) ? (res != '' ? '+meta' : 'meta') : ''
		res += /alt/i.test(modifiers) ? (res != '' ? '+alt' : 'alt') : ''
		res += /shift/i.test(modifiers) ? (res != '' ? '+shift' : 'shift') : ''

		return res
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



// supported action format:
// 	<actio-name>[!][: <args>][-- <doc>]
//
// <args> can contain space seporated:
// 	- numbers
// 	- strings
// 	- non-nested arrays or objects
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
		'no-default': no_default,
	}
}


/* Key handler getter
 *
 * For doc on format see makeKeyboardHandler(...)
 *
 * modifiers can be:
 * 	- '' (default)		- No modifiers
 * 	- '?'				- Return list of applicable modifiers per mode
 * 	- <modifier>		- Any of 'ctrl', 'alt' or 'shift' alone or in 
 * 							combination. 
 * 							Combinations MUST be ordered as shown above.
 * 							Combination elements are separated by '+'
 * 							Ex:
 * 								'ctrl+shift'
 * 							NOTE: 'shift+ctrl' is wrong.
 * 							NOTE: normalizeModifiers(...) can be used as
 * 								a reference, if in doubt.
 *
 * modes can be:
 * 	- 'any'	(default)	- Get list of all applicable handlers up until
 * 							the first applicable ignore.
 * 	- 'all'				- Get ALL handlers, including ignores
 * 	- <mode>			- Get handlers for an explicit mode
 *
 *
 * This will also resolve several shifted keys by name, for example:
 * 'shift-/' is the same as '?', and either can be used, but the shorter 
 * direct notation has priority (see _SHIFT_KEYS for supported keys).
 *
 * When resolving handler aliases this will look in:
 * 	1) the current mode
 * 	2) the keybinding object
 * 	3) the actions object if given
 *
 * NOTE: if a handler is found in the action object it will be called in
 * 		the action object context rather than the keybinding context as
 * 		as with normal handlers.
 * NOTE: if and action alias ends with '!' then event.preventDefault() will
 * 		get called before the action.
 *
 *
 * Returns:
 * 	{
 * 		<mode>: <handler>,
 * 		...
 * 	}
 *
 *
 * <handler> can be:
 * 	- <function>		- handler
 * 	- [<doc>, <function>]
 * 						- lisp-style handler
 * 	- 'IGNORE'			- if mode is 'all' and key is in .ignore
 * 	- [<function>, 'IGNORE NEXT']
 * 						- if mode is 'all' and the key is both in .ignore
 * 						  and a handler is defined in the current section
 * 						  NOTE: in this case if this mode matches, all
 * 						  		the subsequent handlers will get ignored
 * 						  		in normal modes...
 *
 *
 * NOTE: adding a key to the ignore list has the same effect as returning
 * 		false form it's handler in the same context.
 * NOTE: it is not possible to do a shift-? as it is already shifted.
 * NOTE: if a key is not handled in a mode, that mode will not be 
 * 		present in the resulting object.
 * NOTE: this will not unwrap lisp-style (see below) handlers.
 * NOTE: modes are prioritized by order of occurrence.
 * NOTE: modifiers can be a list of three bools...
 * 		(see: normalizeModifiers(...) for further information)
 *
 * XXX check do we need did_handling here...
 * XXX BUG explicitly given modes do not yield results if the pattern 
 * 		does not match...
 * XXX should action handler support event.stoppropagation()???
 * 		...at this point I'm not sure it is needed as it will not affect 
 * 		the keyboard handlers, it will preven further JS event handlers...
 * XXX this also supports the experimental 'ALL' key name that matches 
 * 		all the keys, needs more work, not for production use...
 */
var getKeyHandlers =
module.getKeyHandlers =
function getKeyHandlers(key, modifiers, keybindings, modes, shifted_keys, actions){
	var chr = null
	var s_chr = null
	// XXX I do not understand why this is here...
	var did_handling = false
	var did_ignore = false
	modifiers = modifiers || ''
	modifiers = modifiers != '?' ? normalizeModifiers(modifiers) : modifiers
	modes = modes || 'any'
	shifted_keys = shifted_keys || _SHIFT_KEYS
	actions = actions || {}

	if(typeof(key) == typeof(123)){
		key = key
		chr = toKeyName(key)
	} else {
		chr = key
		key = toKeyCode(key)
	}

	// XXX this is not done yet...
	if(shifted_keys != false && /shift/i.test(modifiers)){
		var s_chr = shifted_keys[chr]
	}

	res = {}

	for(var title in keybindings){
		// skip functions...
		if(typeof(keybindings[title]) == 'function'){
			continue
		}

		// If a key is ignored then look no further...
		if(did_ignore){
			if(modes != 'all'){
				break
			} else {
				did_ignore = false
				if(modifiers != '?' && res[mode] != 'IGNORE'){
					res[mode] = [ res[mode], 'IGNORE NEXT']
				}
			}
		}

		// older version compatibility...
		if(keybindings[title].pattern != null){
			var mode = keybindings[title].pattern
		} else {
			var mode = title
		}

		// check if we need to skip this mode...
		if( !(modes == 'all'
			// explicit mode match...
			|| modes == mode
			// 'any' means we need to check the mode...
			|| (modes == 'any'
				// '*' always matches...
				&& mode == '*'
				// match the mode...
				|| $(mode).length != 0))){
			continue
		}

		var bindings = keybindings[title]

		if(s_chr != null && s_chr in bindings){
			var handler = bindings[s_chr]
			chr = s_chr
			modifiers = modifiers.replace(/\+?shift/i, '') 
		} else if(chr in bindings){
			var handler = bindings[chr]
		} else if(key in bindings) {
			var handler = bindings[key]
		// XXX experimental...
		} else {
			var handler = bindings['ALL']
		}

		// alias...
		// XXX should this be before after or combined with ignore handling...
		while(handler != null && typeof(handler) != 'function'){

			// do the complex handler aliases...
			if(handler != null && handler.constructor == Object){
				// build modifier list...
				if(modifiers == '?'){
					break
				}
				if(modifiers in handler){
					if(typeof(handler[modifiers]) == typeof('str')){
						handler = handler[modifiers]
					} else {
						break
					}
				} else if(typeof(handler['default']) == typeof('str')){
					handler = handler['default']
				} else {
					break
				} 
			}

			// simple handlers...
			if(handler in bindings){
				// XXX need to take care of that we can always be a number or a string...
				handler = bindings[handler]

			// global alias...
			} else if(handler in keybindings){
				handler = keybindings[handler]

			// actions...
			} else if(handler in actions 
					|| handler.split(/!?\s*:\s*|!|--/)[0].trim() in actions){

				var c = parseActionCall(handler)

				handler = function(n, no_default, args, doc){ 
					if(no_default){
						var f = function(){ 
							event.preventDefault()
							return actions[n].apply(actions, args) 
						}
					} else {
						var f = function(){ 
							return actions[n].apply(actions, args) 
						}
					}
					// make this doc-generator compatible -- inherit all
					// the docs from the actual action...
					f.__proto__ = actions[n]
					// tell the doc generator about the action stuff...
					f.action = n
					f.args = args
					f.no_default = no_default

					// use the inherited doc if no specific doc is defined...
					if(doc && doc.length > 0){
						f.doc = doc
					}

					return f
				}(c.action, c['no-default'], c.arguments, c.doc)

			// ignore...
			} else if(handler == 'IGNORE'){
				break

			// key code...
			} else if(typeof(handler) == typeof(1)) {
				handler = bindings[toKeyName(handler)]

			// key name...
			} else {
				handler = bindings[toKeyCode(handler)]
			}
		}

		// if something is ignored then just breakout and stop handling...
		if(handler == 'IGNORE' 
				|| bindings.ignore == '*' 
				|| bindings.ignore != null 
					&& (bindings.ignore.indexOf(key) != -1 
						|| bindings.ignore.indexOf(chr) != -1)){
			did_handling = true
			// ignoring a key will stop processing it...
			if(modes == 'all' || mode == modes){
				// NOTE: if a handler is defined in this section, this 
				// 		will be overwritten...
				// XXX need to add the handler to this if it's defined...
				res[mode] = 'IGNORE'
			}
			did_ignore = true
		}

		// no handler...
		if(handler == null){
			continue
		}

		// complex handler...
		if(handler != null && handler.constructor === Object){
			// build modifier list...
			if(modifiers == '?'){
				res[mode] = Object.keys(handler)
				did_handling = true
				continue
			}

			var callback = handler[modifiers]
			if(callback == null){
				callback = handler['default']
			}

			if(callback != null){
				res[mode] = callback

				did_handling = true
				continue
			}

		// simple callback...
		} else {
			// build modifier list...
			if(modifiers == '?'){
				res[mode] = 'none'
			} else {
				res[mode] = handler
			}

			did_handling = true
			continue
		}

		if(modes != 'all' && did_handling){
			break
		}
	}

	return res
}


/* Make a keyboard handler function...
 *
 * Basic key binding format:
 *
 * {
 *		// alias...
 * 		<alias> : <handler> | <callback>,
 *
 * 		// section...
 * 		<title>: {
 * 			doc: <text>,
 * 			pattern: <css-selector>,
 *
 *			// this defines the list of keys to ignore by the handler.
 *			// NOTE: use "*" to ignore all keys other than explicitly 
 *			// 		defined in the current section.
 *			// NOTE: ignoring a key will stop processing it in other 
 *			//		compatible modes.
 * 			ignore: <ignored-keys>
 *
 *			// alias...
 * 			<alias> : <handler> | <callback> | 'IGNORE',
 *
 *			// ignore handling...
 * 			<key-def> : 'IGNORE',
 *
 *			// NOTE: a callback can have a .doc attr containing 
 *			//		documentation...
 * 			<key-def> : <callback>,
 *
 * 			<key-def> : [
 *				// this can be any type of handler except for an alias...
 * 				<handler>, 
 * 				<doc>
 * 			],
 *
 * 			<key-def> : {
 *				// modifiers can either have a callback or an alias as 
 *				// a value...
 *				// NOTE: when the alias is resolved, the same modifiers 
 *				//		will be applied to the final resolved handler.
 * 				default: <callback> | <alias> | 'IGNORE',
 *
 *				// a modifier can be any single modifier, like shift or a 
 *				// combination of modifiers like 'ctrl+shift', in order 
 *				// of priority.
 *				// supported modifiers, ordered by priority, are:
 *				//	- ctrl
 *				//	- alt
 *				//	- shift
 *				// NOTE: if in doubt use normalizeModifiers(..) as a 
 *				//		reference...
 * 				<modifer>: <callback> | <alias> | 'IGNORE',
 * 				...
 * 			},
 *
 *			// alias...
 * 			<key-def> : <alias>,
 *
 *			...
 * 		},
 *
 *		// legacy format, still supported... (deprecated)
 * 		<css-selector>: {
 *			// meta-data used to generate user docs/help/config
 * 			title: <text>,
 * 			...
 * 		},
 *
 * 		...
 * }
 *
 *
 * <key-def> can be:
 * 	- explicit key code, e.g. 65
 * 	- key name, if present in _SPECIAL_KEYS, e.g. Enter
 * 	- key char (uppercase), as is returned by String.fromCharCode(...) e.g. A
 * 	- action/alias -- any arbitrary string that is not in the above 
 * 	  categories.
 *
 * <alias> will be matched to key definitions in sections and in the key
 * binding object itself and in an actions object if given.
 *
 * <alias> syntax examples:
 * 		actionName		- simple alias / action name
 * 		actionName!		- same as above but calls event.preventDefault()
 * 		actionNmae: 1 "2" [3, 4] {5:6, 7:8}
 * 						- action with arguments.
 * 						  arguments can be:
 * 						  	- numbers
 * 						  	- strings
 * 						  	- non-nested arrays and/or objects
 * 		actionNmae!: 1 "2" [3, 4] {5:6, 7:8}
 * 						- same as above but calls event.preventDefault()
 *
 *
 *
 * NOTE: The handler will be called with keybindings as context (this).
 * NOTE: handlers found in actions will be called with the actions as context.
 * NOTE: only for handlers found in actions, if the alias ends with '!'
 * 		then event.preventDefault() will be called before the handler.
 * NOTE: adding a key to the ignore list has the same effect as returning
 * 		false form it's handler in the same context.
 * NOTE: actions,the last case, are used for alias referencing, they will
 * 		never match a real key, but will get resolved in alias searches.
 * NOTE: to test what to use as <key-def> use toKeyCode(..) / toKeyName(..).
 * NOTE: all fields are optional.
 * NOTE: if a handler explicitly returns false then that will break the 
 * 		event propagation chain and exit the handler.
 * 		i.e. no other matching handlers will be called.
 * NOTE: if more than one match is found all matching handlers will be 
 * 		called in sequence until one returns false explicitly.
 * NOTE: a <css-selector> is used as a predicate to select a section to 
 * 		use. if multiple selectors match something then multiple sections 
 * 		will be resolved in order of occurrence.
 * NOTE: the number keys are named with a leading hash '#' (e.g. '#8') 
 * 		to avoid conflicsts with keys that have the code with the same 
 * 		value (e.g. 'backspace' (8)).
 * NOTE: one can use a doc(<doc-string>, <callback>) as a shorthand to 
 * 		assign a docstring to a handler.
 * 		it will only assign .doc attr and return the original function.
 *
 * XXX need an explicit way to prioritize modes...
 * XXX will aliases get resolved if they are in a different mode??
 */
var makeKeyboardHandler =
module.makeKeyboardHandler =
function makeKeyboardHandler(keybindings, unhandled, actions){
	if(unhandled == null){
		unhandled = function(){}
	}

	return function(evt){
		var did_handling = false
		var res = null

		var _keybindings = typeof(keybindings) == typeof(function(){}) ? 
				keybindings.call(this) 
			: keybindings

		// key data...
		var key = evt.keyCode

		// get modifiers...
		var modifiers = [evt.ctrlKey, evt.metaKey, evt.altKey, evt.shiftKey]

		//window.DEBUG && console.log('KEY:', key, chr, modifiers)

		var handlers = getKeyHandlers(key, modifiers, _keybindings, null, null, actions)

		for(var mode in handlers){
			var handler = handlers[mode]
			if(handler != null){

				// Array, lisp style with docs...
				if(typeof(handler) == typeof([]) && handler.constructor == Array){
					// we do not care about docs here, so just get the handler...
					handler = handler[0]
				}

				// stop handling explicitly ignored keys...
				// XXX
				if(handler == 'IGNORE'){
					break
				}

				did_handling = true
				//res = handler(evt)
				res = handler.call(_keybindings)

				if(res === false){
					break
				}
			}
		}
		if(!did_handling){
			return unhandled(key)
		}
		return res
	}
}


/* Build structure ready for conversion to HTML help.
* 
* Structure:
* 	{
* 		<section-title>: {
* 			doc: ...
*
* 			<handler-doc>: <keys-spec>
* 			...
* 		}
* 	}
*
* 	<keys-spec> 	- list of key names.
*
*
* NOTE: this will not add keys (key names) that are not explicit key names.
*/
// XXX do we need to normalize/pre-process keybindings???
// 		- might be a good idea to normalize the <modifiers>...
// XXX do we show ignored keys???
// 		...at this point we show explicitly ignored keys only...
// XXX do we show overloaded keys???
var buildKeybindingsHelp =
module.buildKeybindingsHelp =
function buildKeybindingsHelp(keybindings, shifted_keys, actions){
	shifted_keys = shifted_keys == null ? _SHIFT_KEYS : shifted_keys
	var res = {}
	var mode, title

	for(var title in keybindings){
		mode = keybindings[title]

		// older version compatibility...
		if(keybindings[title].pattern != null){
			var pattern = keybindings[title].pattern
		} else {
			var pattern = title
			// titles and docs...
			var title = mode.title == null ? pattern : mode.title
		}

		res[title] = {
			doc: mode.doc == null ? '' : mode.doc
		}
		section = res[title]

		// handlers...
		for(var key in mode){
			if(KEYBOARD_SYSTEM_ATTRS.indexOf(key) >= 0){
				continue
			}
			var modifiers = getKeyHandlers(key, '?', keybindings, 'all', null, actions)[pattern]
			modifiers = modifiers == 'none' || modifiers == undefined ? [''] : modifiers

			for(var i=0; i < modifiers.length; i++){
				var mod = modifiers[i]

				var handler = getKeyHandlers(key, mod, keybindings, 'all', null, actions)[pattern]

				// no handler...
				// NOTE: handler is present in config but not present
				// 		in actions...
				if(handler == null){
					continue
				}

				if(handler.constructor === Array && handler[1] == 'IGNORE NEXT'){
					handler = handler[0]
				}

				if(handler == 'IGNORE'){
					// XXX do we show ignored keys???
					var doc = 'Ignored'
					//continue

				// standard object doc...
				} else if('doc' in handler){
					var doc = handler.doc

				// lisp style...
				} else if(handler.constructor === Array){
					var doc = handler[1]

				// no doc...
				} else {
					if('name' in handler && handler.name != ''){
						var doc = handler.name
					} else {
						// XXX is this the right way to do this?
						var doc = handler
					}
				}

				// populate the section...
				// NOTE: we need a list of keys per action...
				if(doc in section){
					var keys = section[doc]
				} else {
					var keys = []
					section[doc] = keys
				}

				// translate shifted keys...
				if(shifted_keys != false && mod == 'shift' && key in shifted_keys){
					mod = ''
					key = shifted_keys[key]
				}

				// skip anything that is not a key...
				if(key.length > 1 && !(key in _KEY_CODES)){
					continue
				}

				keys.push((mod == '' || mod == 'default') ? key : (mod +'+'+ key))
			}

		}
	}

	return res
}


// Get a list of keys associated with a given doc...
//
// The second argument must be a structure formated as returned by 
// buildKeybindingsHelp(...)
//
// Returned format:
// 	{
// 		<section-name> : <key-spec>
// 		...
// 	}
//
// NOTE: <key-spec> is the same as generated by buildKeybindingsHelp(..)
var getKeysByDoc =
module.getKeysByDoc =
function getKeysByDoc(doc, help){
	var res = {}
	for(var mode in help){
		var name = mode
		var section = help[mode]
		if(doc in section){
			res[mode] = section[doc]
		}
	}
	return res
}


// Build a basic HTML table with keyboard help...
//
//	The table will look like this:
//
// 		<table class="keyboard-help">
//
// 			<!-- section head -->
// 			<tr class="section-title">
// 				<th colspan=2> SECTION TITLE <th>
// 			</tr>
// 			<tr class="section-doc">
// 				<td colspan=2> SECTION DESCRIPTION <td>
// 			</tr>
//
// 			<!-- section keys -->
// 			<tr>
// 				<td> KEYS <td>
// 				<td> ACTION DESCRIPTION <td>
// 			</tr>
//
// 			...
//
//		</table>
//
// NOTE: section are not separated in any way other than the <th> element.
// NOTE: the actual HTML is created by jQuery, so the table may get 
// 		slightly structurally changed, i.e. a <tbody> element will be 
// 		added etc.
//
var buildKeybindingsHelpHTML =
module.buildKeybindingsHelpHTML =
function buildKeybindingsHelpHTML(keybindings, actions){
	var doc = buildKeybindingsHelp(keybindings, null, actions)

	var res = '<table class="keyboard-help">'
	for(var mode in doc){
		if(mode == 'doc'){
			continue
		}
		// section head...
		res += '  <tr class="section-title"><th colspan=2>' + mode + '</th></tr>\n' 
		mode = doc[mode]
		res += '  <tr class="section-doc"><td colspan=2>'+ mode.doc + '</td></tr>\n'

		// keys...
		for(var action in mode){
			if(action == 'doc'){
				continue
			}
			res += '  <tr><td>' + mode[action].join(', ') +'</td><td>'+ action + '</td></tr>\n'
		}
	}
	res += '</table>'

	return $(res)
}


// Build HTML for a single key definition...
//
// Format if combining sections (default):
// 		<span class="key-doc">
// 			<span class="doc"> DOC </span>
// 			<span class="keys"> KEYS </span>
// 		</span>
//
// Format if not combining sections:
// 		<span class="key-doc">
// 			<span class="doc"> DOC </span>
// 			<span class="section">
// 				<span class="name"> MODE NAME </span>
// 				<span class="keys"> KEYS </span>
// 			</span>
// 			...
// 		</span>
//
// XXX not yet sure if we are handling the sections correctly...
var getKeysByDocHTML =
module.getKeysByDocHTML =
function getKeysByDocHTML(doc, help, combine_sections){
	combine_sections = combine_sections == null ? true : combine_sections

	var spec = getKeysByDoc(doc, help)
	var res = '<span class="key-doc">'

	res += '<span class="doc">'+ doc +'</span>'
	
	var keys = []

	for(var section in spec){
		if(!combine_sections){
			keys = spec[section].join(', ')
			res += '<span class="section">'
					+'<span class="name">'+ section +'</span>'
					+'<span class="keys">'+ keys +'</span>'
				+'</span>'
		} else {
			keys = keys.concat(spec[section])
		}
	}

	if(combine_sections){
		res += '<span class="keys">'+ keys.join(', ') +'</span>'
	}

	return res + '</span>'
}


// Update key definitions...
//
// NOTE: this does not support multiple sections...
var updateHTMLKeyDoc =
module.updateHTMLKeyDoc =
function updateHTMLKeyDoc(help, root){
	root = root == null ? $('body') : root
	return root.find('.key-doc').each(function(i, e){
		e = $(e)
		var doc = e.find('.doc')
		var keys = $(getKeysByDocHTML(doc.html(), help)).find('.keys')
		e.find('.keys').html(keys.html())
	})
}



/**********************************************************************
* Key binding editor...
*/

// XXX



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
