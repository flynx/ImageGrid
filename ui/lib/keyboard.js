/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true



/*********************************************************************/

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
var _SPECIAL_KEYS = {
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

var _KEY_CODES = {}
for(var k in _SPECIAL_KEYS){
	_KEY_CODES[_SPECIAL_KEYS[k]] = k
}


// XXX some keys look really wrong...
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

function toKeyCode(c){
	if(c in _KEY_CODES){
		return _KEY_CODES[c]
	}
	return c.charCodeAt(0)
}

// documentation wrapper...
function doc(text, func){
	func.doc = text
	return func
}


/* Basic key binding format:
 *
 * {
 * 		<css-selector>: {
 *			// meta-data used to generate user docs/help/config
 * 			title: <text>,
 * 			doc: <text>,
 *
 *			// this defines the list of keys to ignore by the handler.
 *			// NOTE: use "*" to ignore all keys other than explicitly 
 *			// 		defined in the current section.
 *			// NOTE: ignoring a key will stop processing it in other 
 *			//		compatible modes.
 * 			ignore: <ignored-keys>
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
 * 				// optional documentation string...
 * 				doc: <doc-string>,
 *
 *				// modifiers can either have a callback or an alias as 
 *				// a value...
 *				// NOTE: when the alias is resolved, the same modifiers 
 *				//		will be applied to the final resolved handler.
 * 				default: <callback> | <key-def-x>,
 *
 *				// a modifier can be any single modifier, like shift or a 
 *				// combination of modifiers like 'ctrl+shift', given in order 
 *				// of priority.
 *				// supported modifiers are (in order of priority):
 *				//	- ctrl
 *				//	- alt
 *				//	- shift
 * 				<modifer>: [...],
 * 				...
 * 			},
 *
 *			// alias...
 * 			<key-def-a> : <key-def-b>,
 *
 *			...
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
 *
 *
 * NOTE: to rest what to use as <key-def> use toKeyCode(..) / toKeyName(..).
 * NOTE: all fields are optional.
 * NOTE: if a handler explicitly returns false then that will break the 
 * 		event propagation chain and exit the handler.
 * 		i.e. no other matching handlers will be called.
 * NOTE: a <css-selector> is used as a predicate to select a section to 
 * 		use. if multiple selectors match something then multiple sections 
 * 		will be resolved in order of occurrence.
 * NOTE: the number keys are named with a leading hash '#' (e.g. '#8') 
 * 		to avoid conflicsts with keys that have the code with the same 
 * 		value (e.g. 'backspace' (8)).
 * NOTE: one can use a doc(<doc-string>, <callback>) as a shorthand to assign
 * 		a docstring to a handler.
 * 		it will only assign .doc attr and return the original function.
 *
 * XXX use getKeyHandler(...)
 * XXX need an explicit way to prioritize modes...
 */
function makeKeyboardHandler(keybindings, unhandled){
	if(unhandled == null){
		unhandled = function(){}
	}
	return function(evt){
		var did_handling = false
		var res = null

		// key data...
		var key = evt.keyCode

		// normalize the modifiers...
		var modifiers = evt.ctrlKey ? 'ctrl' : ''
		modifiers += evt.altKey ? (modifiers != '' ? '+alt' : 'alt') : ''
		modifiers += evt.shiftKey ? (modifiers != '' ? '+shift' : 'shift') : ''

		//window.DEBUG && console.log('KEY:', key, chr, modifiers)

		var handlers = getKeyHandlers(key, modifiers, keybindings)

		for(var mode in handlers){
			var handler = handlers[mode]
			if(handler != null){

				did_handling = true
				res = handler(evt)

				if(res === false){
					break
				}
			}
		}
		if(!did_handling){
			return unhandled(key)
		}
		return res

		/* XXX remove this after through testing...
		var chr = toKeyName(key)

		for(var mode in keybindings){
			if($(mode).length > 0){
				var bindings = keybindings[mode]

				if(chr in bindings){
					var handler = bindings[chr]
				} else {
					var handler = bindings[key]
				}

				// alias...
				while( handler != null 
						&& (typeof(handler) == typeof(123) 
							|| typeof(handler) == typeof('str')
							|| typeof(handler) == typeof({}) 
								&& handler.constructor.name == 'Object') ){

					// do the complex handler aliases...
					if(typeof(handler) == typeof({}) && handler.constructor.name == 'Object'){
						if(typeof(handler[modifiers]) == typeof('str')){
							handler = handler[modifiers]
						} else if(typeof(handler['default']) == typeof('str')){
							handler = handler['default']
						} else {
							break
						}
					}

					// simple handlers...
					if(handler in bindings){
						handler = bindings[handler]
					} else if(typeof(handler) == typeof(1)) {
						handler = bindings[toKeyName(handler)]
					} else {
						handler = bindings[toKeyCode(handler)]
					}
				}
				// no handler...
				if(handler == null){
					// if something is ignored then just breakout and stop handling...
					if(bindings.ignore == '*' 
							|| bindings.ignore != null 
								&& (bindings.ignore.indexOf(key) != -1 
									|| bindings.ignore.indexOf(chr) != -1)){
						res = res == null ? true : res
						did_handling = true
						// ignoring a key will stop processing it...
						break
					}
					continue
				}
				// Array, lisp style with docs...
				// XXX for some odd reason typeof([]) == typeof({})!!!
				if(typeof(handler) == typeof([]) && handler.constructor.name == 'Array'){
					// we do not care about docs here, so just get the handler...
					handler = handler[0]
				}
				// complex handler...
				if(typeof(handler) == typeof({}) && handler.constructor.name == 'Object'){
					var callback = handler[modifiers]
					if(callback == null){
						callback = handler['default']
					}

					if(callback != null){
						res = callback(evt)
						did_handling = true
						continue
					}
				} else {
					// simple callback...
					//res = handler(evt) 
					res = handler(evt) 
					// if the handler explicitly returned false break out...
					if(res === false){
						// XXX is this corrent???
						// XXX should we just break here instead of return...
						return res
					}
					did_handling = true
					continue
				}
			}
		}
		if(!did_handling){
			// key is unhandled by any modes...
			return unhandled(key)
		} else {
			// XXX should we handle multiple hits???
			return res
		}
		*/
	}
}


// NOTE: if modifiers are null then this will not resolve aliases that
// 		depend on modifiers and return a complex ahndler as-is.
// NOTE: this will test modes and return only compatible handlers by 
// 		default, to return all modes, set all_modes to true.
// XXX need an explicit way to prioritize modes...
// XXX check do we need did_handling here...
function getKeyHandlers(key, modifiers, keybindings, all_modes){
	var chr = null
	var did_handling = false
	modifiers = modifiers == null ? '' : modifiers

	if(typeof(key) == typeof(123)){
		key = key
		chr = toKeyName(key)
	} else {
		chr = key
		key = toKeyCode(key)
	}

	res = {}

	for(var mode in keybindings){

		// test for mode compatibility...
		if(!all_modes && $(mode).length == 0){
			continue
		}

		var bindings = keybindings[mode]

		if(chr in bindings){
			var handler = bindings[chr]
		} else {
			var handler = bindings[key]
		}

		// alias...
		while( handler != null 
				&& (typeof(handler) == typeof(123) 
					|| typeof(handler) == typeof('str')
					|| typeof(handler) == typeof({}) 
						&& handler.constructor.name == 'Object') ){

			// do the complex handler aliases...
			if(typeof(handler) == typeof({}) && handler.constructor.name == 'Object'){
				if(typeof(handler[modifiers]) == typeof('str')){
					handler = handler[modifiers]
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
			} else if(typeof(handler) == typeof(1)) {
				handler = bindings[toKeyName(handler)]
			} else {
				handler = bindings[toKeyCode(handler)]
			}
		}

		// no handler...
		if(handler == null){
			// if something is ignored then just breakout and stop handling...
			if(bindings.ignore == '*' 
					|| bindings.ignore != null 
						&& (bindings.ignore.indexOf(key) != -1 
							|| bindings.ignore.indexOf(chr) != -1)){
				did_handling = true
				// ignoring a key will stop processing it...
				if(all_modes){
					res[mode] = 'IGNORE'
				} else {
					break
				}
			}
			continue
		}

		// Array, lisp style with docs...
		if(typeof(handler) == typeof([]) && handler.constructor.name == 'Array'){
			// we do not care about docs here, so just get the handler...
			handler = handler[0]
		}
		// complex handler...
		if(typeof(handler) == typeof({}) && handler.constructor.name == 'Object'){
			var callback = handler[modifiers]
			if(callback == null){
				callback = handler['default']
			}

			if(callback != null){
				res[mode] = callback

				did_handling = true
				continue
			}
		} else {
			// simple callback...
			res[mode] = handler

			did_handling = true
			continue
		}

		if(did_handling){
			break
		}
	}

	return res
}



/* Build structure ready for conversion to HTML help.
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
*/
function buildKeybindingsHelp(keybindings){
	var res = {}

	// XXX
	return res
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
